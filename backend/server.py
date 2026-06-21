from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
import warnings
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import base64
import email
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Environment variables
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:8001')
REDIRECT_URI = f"{BACKEND_URL}/api/oauth/gmail/callback"

# Gmail OAuth scopes
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.labels",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Scheduler
scheduler = AsyncIOScheduler()

# Models
class GmailToken(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    access_token: str
    refresh_token: Optional[str]
    expires_at: datetime
    client_id: str
    client_secret: str
    token_uri: str

class ProcessedEmail(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email_id: str
    from_email: str
    subject: str
    body: str
    ai_reply: str
    draft_id: Optional[str]
    processed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str  # "success", "error"

class ErrorLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email_id: Optional[str]
    error_message: str
    error_type: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkflowConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    enabled: bool = False
    last_run: Optional[datetime]

class WorkflowStatus(BaseModel):
    enabled: bool
    last_run: Optional[datetime]
    total_processed: int
    total_errors: int
    is_authenticated: bool

# Helper functions
async def save_state(state: str, user_id: str, flow_data: dict, ttl: int = 600):
    """Save OAuth state and flow data with TTL"""
    await db.oauth_states.insert_one({
        "state": state,
        "user_id": user_id,
        "flow_data": flow_data,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=ttl)
    })

async def get_and_delete_state(state: str) -> tuple:
    """Verify and return user_id and flow_data from state, then delete"""
    doc = await db.oauth_states.find_one({"state": state})
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid state")
    
    if datetime.now(timezone.utc) > doc["expires_at"].replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="State expired")
    
    # Clean up used state
    await db.oauth_states.delete_one({"state": state})
    return doc["user_id"], doc.get("flow_data", {})

async def get_credentials(user_id: str = "default_user"):
    """Get and refresh Gmail credentials if needed"""
    token_doc = await db.gmail_tokens.find_one({"user_id": user_id})
    if not token_doc:
        return None
    
    creds = Credentials(
        token=token_doc["access_token"],
        refresh_token=token_doc.get("refresh_token"),
        token_uri=token_doc["token_uri"],
        client_id=token_doc["client_id"],
        client_secret=token_doc["client_secret"]
    )
    
    # Handle timezone properly
    expires_at = token_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    # Refresh if expired
    if datetime.now(timezone.utc) >= expires_at:
        try:
            creds.refresh(GoogleRequest())
            # Update token in DB
            await db.gmail_tokens.update_one(
                {"user_id": user_id},
                {"$set": {
                    "access_token": creds.token,
                    "expires_at": datetime.now(timezone.utc) + timedelta(seconds=3600)
                }}
            )
        except Exception as e:
            logger.error(f"Failed to refresh token: {e}")
            return None
    
    return creds

def decode_email_body(payload):
    """Decode email body from Gmail API response"""
    body = ""
    if 'parts' in payload:
        for part in payload['parts']:
            if part['mimeType'] == 'text/plain':
                if 'data' in part['body']:
                    body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                    break
    elif 'body' in payload and 'data' in payload['body']:
        body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')
    
    return body[:1000]  # Limit to first 1000 chars

async def generate_ai_reply(from_email: str, subject: str, body: str) -> str:
    """Generate AI reply using OpenAI via emergentintegrations"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message="You are a professional email assistant. Reply to emails in a helpful, professional, and concise manner."
        ).with_model("openai", "gpt-3.5-turbo")
        
        user_prompt = f"Read this email and draft a reply. Email from: {from_email} Subject: {subject} Body: {body}"
        user_message = UserMessage(text=user_prompt)
        
        # Use send_message for non-streaming response
        response = await chat.send_message(user_message)
        return response.message
    except Exception as e:
        logger.error(f"AI generation failed: {e}")
        raise

async def process_email_workflow():
    """Main email processing workflow"""
    logger.info("Starting email processing workflow...")
    
    try:
        # Get credentials
        creds = await get_credentials()
        if not creds:
            logger.warning("No Gmail credentials found. Skipping workflow.")
            return
        
        # Build Gmail service
        service = build('gmail', 'v1', credentials=creds)
        
        # Fetch unread emails
        results = service.users().messages().list(
            userId='me',
            q='label:UNREAD',
            maxResults=5
        ).execute()
        
        messages = results.get('messages', [])
        logger.info(f"Found {len(messages)} unread emails")
        
        for msg in messages:
            try:
                # Get full message
                full_msg = service.users().messages().get(
                    userId='me',
                    id=msg['id'],
                    format='full'
                ).execute()
                
                # Extract headers
                headers = full_msg['payload']['headers']
                from_email = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
                
                # Decode body
                body = decode_email_body(full_msg['payload'])
                
                # Generate AI reply
                ai_reply = await generate_ai_reply(from_email, subject, body)
                
                # Create draft
                draft_body = {
                    'message': {
                        'raw': base64.urlsafe_b64encode(
                            f"To: {from_email}\r\nSubject: Re: {subject}\r\n\r\n{ai_reply}".encode('utf-8')
                        ).decode('utf-8')
                    }
                }
                
                draft = service.users().drafts().create(
                    userId='me',
                    body=draft_body
                ).execute()
                
                # Mark as READ
                service.users().messages().modify(
                    userId='me',
                    id=msg['id'],
                    body={'removeLabelIds': ['UNREAD'], 'addLabelIds': []}
                ).execute()
                
                # Save to database
                processed_email = ProcessedEmail(
                    email_id=msg['id'],
                    from_email=from_email,
                    subject=subject,
                    body=body,
                    ai_reply=ai_reply,
                    draft_id=draft['id'],
                    status="success"
                )
                
                doc = processed_email.model_dump()
                doc['processed_at'] = doc['processed_at'].isoformat()
                await db.processed_emails.insert_one(doc)
                
                logger.info(f"Successfully processed email: {subject}")
                
            except Exception as e:
                logger.error(f"Error processing email {msg['id']}: {e}")
                
                # Log error
                error_log = ErrorLog(
                    email_id=msg['id'],
                    error_message=str(e),
                    error_type="processing_error"
                )
                error_doc = error_log.model_dump()
                error_doc['timestamp'] = error_doc['timestamp'].isoformat()
                await db.error_logs.insert_one(error_doc)
        
        # Update last run
        await db.workflow_config.update_one(
            {},
            {"$set": {"last_run": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        
    except Exception as e:
        logger.error(f"Workflow error: {e}")
        # Log error
        error_log = ErrorLog(
            email_id=None,
            error_message=str(e),
            error_type="workflow_error"
        )
        error_doc = error_log.model_dump()
        error_doc['timestamp'] = error_doc['timestamp'].isoformat()
        await db.error_logs.insert_one(error_doc)

# Routes
@api_router.get("/")
async def root():
    return {"message": "Email Auto-Responder API"}

@api_router.get("/oauth/gmail/login")
async def gmail_login(user_id: str = "default_user"):
    """Initiate Gmail OAuth flow"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Gmail OAuth not configured")
    
    flow = Flow.from_client_config({
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token"
        }
    }, scopes=SCOPES, redirect_uri=REDIRECT_URI)
    
    url, state = flow.authorization_url(
        access_type='offline',
        prompt='consent',
        include_granted_scopes='true'
    )
    
    # Save state and flow session data
    flow_data = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI
    }
    await save_state(state, user_id, flow_data)
    return RedirectResponse(url)

@api_router.get("/oauth/gmail/callback")
async def gmail_callback(code: str, state: str):
    """Handle Gmail OAuth callback"""
    try:
        user_id, flow_data = await get_and_delete_state(state)
        
        # Use requests directly to exchange code for token (bypass Flow issues)
        import requests
        
        token_data = {
            'code': code,
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'redirect_uri': REDIRECT_URI,
            'grant_type': 'authorization_code'
        }
        
        response = requests.post('https://oauth2.googleapis.com/token', data=token_data)
        
        if response.status_code != 200:
            raise Exception(f"Token exchange failed: {response.text}")
        
        tokens = response.json()
        
        # Save tokens to database
        token_doc = {
            "user_id": user_id,
            "access_token": tokens['access_token'],
            "refresh_token": tokens.get('refresh_token'),
            "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=tokens.get('expires_in', 3600))).isoformat(),
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "token_uri": "https://oauth2.googleapis.com/token"
        }
        
        await db.gmail_tokens.update_one(
            {"user_id": user_id},
            {"$set": token_doc},
            upsert=True
        )
        
        logger.info(f"Gmail OAuth successful for user: {user_id}")
        return RedirectResponse("/")
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return RedirectResponse(f"/?error=oauth_failed&message={str(e)}")

@api_router.get("/workflow/status", response_model=WorkflowStatus)
async def get_workflow_status():
    """Get workflow status"""
    config = await db.workflow_config.find_one({})
    
    # Check authentication
    token = await db.gmail_tokens.find_one({"user_id": "default_user"})
    is_authenticated = token is not None
    
    # Count processed emails and errors
    total_processed = await db.processed_emails.count_documents({})
    total_errors = await db.error_logs.count_documents({})
    
    last_run = None
    enabled = False
    
    if config:
        enabled = config.get('enabled', False)
        if config.get('last_run'):
            last_run_str = config['last_run']
            if isinstance(last_run_str, str):
                last_run = datetime.fromisoformat(last_run_str)
            else:
                last_run = last_run_str
    
    return WorkflowStatus(
        enabled=enabled,
        last_run=last_run,
        total_processed=total_processed,
        total_errors=total_errors,
        is_authenticated=is_authenticated
    )

@api_router.post("/workflow/toggle")
async def toggle_workflow():
    """Start or stop the workflow"""
    config = await db.workflow_config.find_one({})
    current_state = config.get('enabled', False) if config else False
    
    new_state = not current_state
    
    await db.workflow_config.update_one(
        {},
        {"$set": {"enabled": new_state}},
        upsert=True
    )
    
    if new_state:
        # Start scheduler if not running
        if not scheduler.running:
            scheduler.start()
        return {"message": "Workflow started", "enabled": True}
    else:
        return {"message": "Workflow stopped", "enabled": False}

@api_router.post("/workflow/trigger")
async def trigger_workflow_manually():
    """Manually trigger the workflow immediately (for testing)"""
    try:
        await process_email_workflow()
        return {"message": "Workflow executed successfully", "success": True}
    except Exception as e:
        logger.error(f"Manual trigger failed: {e}")
        return {"message": f"Workflow failed: {str(e)}", "success": False}

@api_router.get("/emails/processed")
async def get_processed_emails(limit: int = 50):
    """Get processed emails"""
    emails = await db.processed_emails.find({}, {"_id": 0}).sort("processed_at", -1).to_list(limit)
    
    # Convert datetime strings back to datetime objects for JSON response
    for email in emails:
        if isinstance(email.get('processed_at'), str):
            email['processed_at'] = datetime.fromisoformat(email['processed_at'])
    
    return emails

@api_router.get("/errors")
async def get_errors(limit: int = 50):
    """Get error logs"""
    errors = await db.error_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    
    # Convert datetime strings
    for error in errors:
        if isinstance(error.get('timestamp'), str):
            error['timestamp'] = datetime.fromisoformat(error['timestamp'])
    
    return errors

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Start scheduler on app startup"""
    # Add job to run every 5 minutes
    scheduler.add_job(
        process_email_workflow,
        trigger=IntervalTrigger(minutes=5),
        id='email_workflow',
        name='Process unread emails',
        replace_existing=True
    )
    
    # Check if workflow is enabled
    config = await db.workflow_config.find_one({})
    if config and config.get('enabled', False):
        scheduler.start()
        logger.info("Scheduler started (workflow enabled)")
    else:
        logger.info("Scheduler configured but not started (workflow disabled)")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    if scheduler.running:
        scheduler.shutdown()
    client.close()
