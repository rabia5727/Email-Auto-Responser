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
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
import warnings
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import base64
import email
from emergentintegrations.llm.chat import LlmChat, UserMessage
from authlib.integrations.starlette_client import OAuth
from authlib.common.security import generate_token
import secrets

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
    user_email: str
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
    user_email: str
    email_id: Optional[str]
    error_message: str
    error_type: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkflowConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    enabled: bool = False
    last_run: Optional[datetime]
    processing_limit: int = 5
    auto_send_drafts: bool = False
    custom_prompt: str = "You are a professional email assistant. Reply to emails in a helpful, professional, and concise manner."
    sender_whitelist: List[str] = []
    sender_blacklist: List[str] = []

class WorkflowSettings(BaseModel):
    processing_limit: int = 5
    auto_send_drafts: bool = False
    custom_prompt: str = "You are a professional email assistant. Reply to emails in a helpful, professional, and concise manner."
    sender_whitelist: List[str] = []
    sender_blacklist: List[str] = []
    vip_senders: List[str] = []  # Skip these for manual reply

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

async def get_current_user_email(user_id: str = "default_user") -> Optional[str]:
    """Get the currently authenticated user's email"""
    token_doc = await db.gmail_tokens.find_one({"user_id": user_id})
    if token_doc:
        return token_doc.get("user_email")
    return None

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

async def generate_ai_reply(from_email: str, subject: str, body: str, custom_prompt: str = None) -> str:
    """Generate AI reply using OpenAI via emergentintegrations"""
    try:
        system_prompt = custom_prompt or "You are a professional email assistant. Reply to emails in a helpful, professional, and concise manner."
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message=system_prompt
        ).with_model("openai", "gpt-5.4-mini")
        
        user_prompt = f"Read this email and draft a reply. Email from: {from_email} Subject: {subject} Body: {body}"
        user_message = UserMessage(text=user_prompt)
        
        # Use send_message for non-streaming response
        response = await chat.send_message(user_message)
        # Response is already a string
        return response if isinstance(response, str) else str(response)
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
        
        # Get current user email
        user_email = await get_current_user_email()
        if not user_email:
            logger.warning("No user email found. Skipping workflow.")
            return
        
        # Get workflow configuration for this user
        config = await db.workflow_config.find_one({"user_email": user_email})
        processing_limit = config.get('processing_limit', 5) if config else 5
        auto_send = config.get('auto_send_drafts', False) if config else False
        custom_prompt = config.get('custom_prompt') if config else None
        whitelist = config.get('sender_whitelist', []) if config else []
        blacklist = config.get('sender_blacklist', []) if config else []
        vip_senders = config.get('vip_senders', []) if config else []
        
        # Build Gmail service
        service = build('gmail', 'v1', credentials=creds)
        
        # Fetch unread emails
        results = service.users().messages().list(
            userId='me',
            q='label:UNREAD',
            maxResults=processing_limit
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
                
                # Extract email address from "Name <email@example.com>" format
                import re
                email_match = re.search(r'<(.+?)>|^(.+?)$', from_email)
                sender_email = email_match.group(1) or email_match.group(2) if email_match else from_email
                sender_email = sender_email.strip()
                
                # Skip VIP senders (for manual reply)
                if vip_senders and sender_email in vip_senders:
                    logger.info(f"Skipping VIP sender {sender_email} - requires manual reply")
                    continue
                
                # Apply whitelist filter
                if whitelist and sender_email not in whitelist:
                    logger.info(f"Skipping email from {sender_email} - not in whitelist")
                    continue
                
                # Apply blacklist filter
                if blacklist and sender_email in blacklist:
                    logger.info(f"Skipping email from {sender_email} - in blacklist")
                    continue
                
                # Decode body
                body = decode_email_body(full_msg['payload'])
                
                # Generate AI reply
                ai_reply = await generate_ai_reply(from_email, subject, body, custom_prompt)
                
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
                
                # Auto-send if enabled
                draft_id = draft['id']
                if auto_send:
                    service.users().drafts().send(
                        userId='me',
                        body={'id': draft_id}
                    ).execute()
                    logger.info(f"Auto-sent draft for email: {subject}")
                
                # Mark as READ
                service.users().messages().modify(
                    userId='me',
                    id=msg['id'],
                    body={'removeLabelIds': ['UNREAD'], 'addLabelIds': []}
                ).execute()
                
                # Save to database
                processed_email = ProcessedEmail(
                    user_email=user_email,
                    email_id=msg['id'],
                    from_email=from_email,
                    subject=subject,
                    body=body,
                    ai_reply=ai_reply,
                    draft_id=draft_id,
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
                    user_email=user_email,
                    email_id=msg['id'],
                    error_message=str(e),
                    error_type="processing_error"
                )
                error_doc = error_log.model_dump()
                error_doc['timestamp'] = error_doc['timestamp'].isoformat()
                await db.error_logs.insert_one(error_doc)
        
        # Update last run for this user
        await db.workflow_config.update_one(
            {"user_email": user_email},
            {"$set": {"last_run": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        
    except Exception as e:
        logger.error(f"Workflow error: {e}")
        # Get user email for error logging
        user_email = await get_current_user_email()
        if user_email:
            # Log error
            error_log = ErrorLog(
                user_email=user_email,
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
    """Initiate Gmail OAuth flow with PKCE"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Gmail OAuth not configured")
    
    # Generate PKCE code verifier and challenge
    code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
    
    # Build authorization URL with PKCE
    import urllib.parse
    params = {
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'scope': ' '.join(SCOPES),
        'access_type': 'offline',
        'prompt': 'consent',
        'state': generate_token(32),
        'code_challenge': code_verifier,
        'code_challenge_method': 'plain'
    }
    
    auth_url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode(params)
    
    # Save state and code verifier
    flow_data = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
        "code_verifier": code_verifier
    }
    await save_state(params['state'], user_id, flow_data)
    
    return RedirectResponse(auth_url)

@api_router.get("/oauth/gmail/callback")
async def gmail_callback(code: str, state: str):
    """Handle Gmail OAuth callback"""
    try:
        user_id, flow_data = await get_and_delete_state(state)
        
        # Exchange code for tokens with PKCE
        import requests
        
        token_data = {
            'code': code,
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'redirect_uri': REDIRECT_URI,
            'grant_type': 'authorization_code',
            'code_verifier': flow_data['code_verifier']
        }
        
        response = requests.post('https://oauth2.googleapis.com/token', data=token_data)
        
        if response.status_code != 200:
            raise Exception(f"Token exchange failed: {response.text}")
        
        tokens = response.json()
        
        # Get user's Gmail email address
        user_info_response = requests.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {tokens["access_token"]}'}
        )
        user_info = user_info_response.json()
        user_email = user_info.get('email', 'unknown@gmail.com')
        
        # Save tokens to database with user email
        token_doc = {
            "user_id": user_id,
            "user_email": user_email,
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
        
        logger.info(f"Gmail OAuth successful for user: {user_email}")
        return RedirectResponse("/")
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return RedirectResponse(f"/?error=oauth_failed")

@api_router.get("/workflow/status", response_model=WorkflowStatus)
async def get_workflow_status():
    """Get workflow status"""
    # Check authentication and get user email
    user_email = await get_current_user_email()
    is_authenticated = user_email is not None
    
    # Count processed emails and errors for current user
    if is_authenticated:
        total_processed = await db.processed_emails.count_documents({"user_email": user_email})
        total_errors = await db.error_logs.count_documents({"user_email": user_email})
        config = await db.workflow_config.find_one({"user_email": user_email})
    else:
        total_processed = 0
        total_errors = 0
        config = None
    
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
async def get_processed_emails(
    limit: int = 20, 
    skip: int = 0,
    days: int = None  # Filter by last N days
):
    """Get processed emails with pagination and filters (user-specific)"""
    # Get current user email
    user_email = await get_current_user_email()
    if not user_email:
        return {
            "emails": [],
            "total": 0,
            "skip": 0,
            "limit": limit
        }
    
    query = {"user_email": user_email}
    
    # Add date filter if specified
    if days:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        query['processed_at'] = {'$gte': cutoff_date.isoformat()}
    
    # Get total count
    total = await db.processed_emails.count_documents(query)
    
    # Get paginated emails
    emails = await db.processed_emails.find(query, {"_id": 0})\
        .sort("processed_at", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    # Convert datetime strings
    for email in emails:
        if isinstance(email.get('processed_at'), str):
            email['processed_at'] = datetime.fromisoformat(email['processed_at'])
    
    return {
        "emails": emails,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.delete("/emails/cleanup")
async def cleanup_old_emails(days: int = 30):
    """Delete processed emails older than specified days"""
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.processed_emails.delete_many({
        'processed_at': {'$lt': cutoff_date.isoformat()}
    })
    return {
        "message": f"Deleted {result.deleted_count} emails older than {days} days",
        "deleted_count": result.deleted_count
    }

@api_router.get("/emails/search")
async def search_emails(q: str, limit: int = 20):
    """Search processed emails by sender or subject"""
    query = {
        '$or': [
            {'from_email': {'$regex': q, '$options': 'i'}},
            {'subject': {'$regex': q, '$options': 'i'}}
        ]
    }
    
    emails = await db.processed_emails.find(query, {"_id": 0})\
        .sort("processed_at", -1)\
        .limit(limit)\
        .to_list(limit)
    
    for email in emails:
        if isinstance(email.get('processed_at'), str):
            email['processed_at'] = datetime.fromisoformat(email['processed_at'])
    
    return emails

@api_router.get("/emails/export")
async def export_processed_emails():
    """Export processed emails as CSV"""
    from fastapi.responses import StreamingResponse
    import io
    import csv
    
    emails = await db.processed_emails.find({}, {"_id": 0}).sort("processed_at", -1).to_list(1000)
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(['Timestamp', 'From', 'Subject', 'Original Body', 'AI Reply', 'Draft ID', 'Status'])
    
    # Write data
    for email in emails:
        writer.writerow([
            email.get('processed_at', ''),
            email.get('from_email', ''),
            email.get('subject', ''),
            email.get('body', ''),
            email.get('ai_reply', ''),
            email.get('draft_id', ''),
            email.get('status', '')
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=processed_emails.csv"}
    )

@api_router.get("/settings")
async def get_settings():
    """Get workflow settings (user-specific)"""
    user_email = await get_current_user_email()
    if not user_email:
        return WorkflowSettings().model_dump()
    
    config = await db.workflow_config.find_one({"user_email": user_email})
    if not config:
        return WorkflowSettings().model_dump()
    
    return {
        "processing_limit": config.get('processing_limit', 5),
        "auto_send_drafts": config.get('auto_send_drafts', False),
        "custom_prompt": config.get('custom_prompt', "You are a professional email assistant. Reply to emails in a helpful, professional, and concise manner."),
        "sender_whitelist": config.get('sender_whitelist', []),
        "sender_blacklist": config.get('sender_blacklist', []),
        "vip_senders": config.get('vip_senders', [])
    }

@api_router.post("/settings")
async def update_settings(settings: WorkflowSettings):
    """Update workflow settings (user-specific)"""
    user_email = await get_current_user_email()
    if not user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    settings_dict = settings.model_dump()
    settings_dict['user_email'] = user_email
    
    await db.workflow_config.update_one(
        {"user_email": user_email},
        {"$set": settings_dict},
        upsert=True
    )
    return {"message": "Settings updated successfully"}

@api_router.delete("/data/clear-all")
async def clear_all_data():
    """Clear all data from database (useful for reset/cleanup)"""
    try:
        # Clear all collections
        emails_deleted = await db.processed_emails.delete_many({})
        errors_deleted = await db.error_logs.delete_many({})
        config_deleted = await db.workflow_config.delete_many({})
        states_deleted = await db.oauth_states.delete_many({})
        
        logger.info("Cleared all data from database")
        
        return {
            "message": "All data cleared successfully",
            "success": True,
            "deleted": {
                "emails": emails_deleted.deleted_count,
                "errors": errors_deleted.deleted_count,
                "configs": config_deleted.deleted_count,
                "states": states_deleted.deleted_count
            }
        }
    except Exception as e:
        logger.error(f"Clear all data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/logout")
async def logout(user_id: str = "default_user", clear_data: bool = False):
    """Logout and disconnect Gmail, optionally clear user's data"""
    try:
        # Get user email before deleting token
        user_email = await get_current_user_email(user_id)
        
        # Delete Gmail tokens
        token_result = await db.gmail_tokens.delete_one({"user_id": user_id})
        
        if clear_data and user_email:
            # Clear ONLY this user's data
            emails_result = await db.processed_emails.delete_many({"user_email": user_email})
            errors_result = await db.error_logs.delete_many({"user_email": user_email})
            config_result = await db.workflow_config.delete_many({"user_email": user_email})
            
            logger.info(f"Cleared all data for user: {user_email}")
            
            return {
                "message": f"Disconnected {user_email} and cleared all data",
                "success": True,
                "data_cleared": True,
                "deleted": {
                    "emails": emails_result.deleted_count,
                    "errors": errors_result.deleted_count
                }
            }
        
        if token_result.deleted_count > 0:
            return {
                "message": f"Disconnected Gmail (data preserved for {user_email})",
                "success": True,
                "data_cleared": False
            }
        
        return {
            "message": "No connection found",
            "success": False,
            "data_cleared": False
        }
    except Exception as e:
        logger.error(f"Logout error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/errors")
async def get_errors(limit: int = 20, skip: int = 0, days: int = None):
    """Get error logs with pagination (user-specific)"""
    # Get current user email
    user_email = await get_current_user_email()
    if not user_email:
        return {
            "errors": [],
            "total": 0,
            "skip": 0,
            "limit": limit
        }
    
    query = {"user_email": user_email}
    
    if days:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        query['timestamp'] = {'$gte': cutoff_date.isoformat()}
    
    total = await db.error_logs.count_documents(query)
    
    errors = await db.error_logs.find(query, {"_id": 0})\
        .sort("timestamp", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    # Convert datetime strings
    for error in errors:
        if isinstance(error.get('timestamp'), str):
            error['timestamp'] = datetime.fromisoformat(error['timestamp'])
    
    return {
        "errors": errors,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.delete("/errors/cleanup")
async def cleanup_old_errors(days: int = 30):
    """Delete error logs older than specified days"""
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.error_logs.delete_many({
        'timestamp': {'$lt': cutoff_date.isoformat()}
    })
    return {
        "message": f"Deleted {result.deleted_count} errors older than {days} days",
        "deleted_count": result.deleted_count
    }

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
