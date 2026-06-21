# Local Development Setup Guide

Complete guide for running AI Email Auto-Responder locally.

## Prerequisites Installation

### 1. Python 3.11+

**macOS:**
```bash
brew install python@3.11
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install python3.11 python3.11-venv python3-pip
```

**Windows:**
Download from [python.org](https://www.python.org/downloads/)

### 2. Node.js 18+ & Yarn

**macOS:**
```bash
brew install node
npm install -g yarn
```

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g yarn
```

**Windows:**
Download from [nodejs.org](https://nodejs.org/)
```bash
npm install -g yarn
```

### 3. MongoDB 5.0+

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

**Ubuntu/Debian:**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

**Windows:**
Download from [mongodb.com](https://www.mongodb.com/try/download/community)

**Alternative: MongoDB Atlas (Cloud)**
- Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
- Create free cluster
- Get connection string
- Use in `.env` file

### 4. Git

**macOS:**
```bash
brew install git
```

**Ubuntu/Debian:**
```bash
sudo apt install git
```

**Windows:**
Download from [git-scm.com](https://git-scm.com/)

## Project Setup

### Step 1: Clone Repository

```bash
# After saving to GitHub from Emergent
git clone https://github.com/your-username/ai-email-auto-responder.git
cd ai-email-auto-responder
```

### Step 2: Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

**Edit `backend/.env`:**
```env
# MongoDB (Local)
MONGO_URL=mongodb://localhost:27017
DB_NAME=email_automation

# Or MongoDB Atlas (Cloud)
# MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/
# DB_NAME=email_automation

# CORS (Local development)
CORS_ORIGINS=http://localhost:3000

# API Keys
EMERGENT_LLM_KEY=your_emergent_key_here
# Or use OpenAI directly:
# OPENAI_API_KEY=your_openai_key_here

# Gmail API Credentials
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Backend URL (for OAuth callback)
BACKEND_URL=http://localhost:8001
```

### Step 3: Frontend Setup

```bash
cd ../frontend

# Install dependencies
yarn install
# or: npm install

# Create .env file
cp .env.example .env
```

**Edit `frontend/.env`:**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Step 4: Gmail API Configuration

#### Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Create Project"
3. Name: "AI Email Auto-Responder"
4. Click "Create"

#### Enable Gmail API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Gmail API"
3. Click "Enable"

#### Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
3. Configure OAuth consent screen (if first time):
   - User Type: External
   - App name: AI Email Auto-Responder
   - User support email: your@email.com
   - Developer contact: your@email.com
   - Scopes: Add Gmail scopes (readonly, modify, labels)
   - Test users: Add your Gmail address
4. Create OAuth client ID:
   - Application type: Web application
   - Name: Local Development
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `http://localhost:8001`
   - Authorized redirect URIs:
     - `http://localhost:8001/api/oauth/gmail/callback`
5. Click "Create"
6. Copy Client ID and Client Secret
7. Add to `backend/.env`

#### Add Test Users

1. OAuth consent screen → Test users
2. Click "+ ADD USERS"
3. Add your Gmail email address
4. Save

### Step 5: Get Emergent LLM Key (Optional)

If you want to use Emergent's LLM key:

1. Log in to [Emergent Dashboard](https://app.emergent.ai)
2. Go to Profile → Universal Key
3. Copy your key
4. Add to `backend/.env` as `EMERGENT_LLM_KEY`

**Or use OpenAI directly:**
1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Create API key
3. Add to `backend/.env` as `OPENAI_API_KEY`
4. Update `server.py` to use OpenAI SDK instead of emergentintegrations

## Running Locally

### Start Backend

```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python server.py
```

You should see:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8001
```

### Start Frontend

**In a new terminal:**
```bash
cd frontend
yarn start
# or: npm start
```

You should see:
```
Compiled successfully!

You can now view frontend in the browser.

  Local:            http://localhost:3000
```

### Open Application

Navigate to: **http://localhost:3000**

## Testing the Setup

### 1. Connect Gmail

1. Click "Connect Gmail" button
2. Sign in with your Google account
3. Grant permissions
4. You should be redirected back to dashboard
5. Status should show "Connected"

### 2. Configure Settings

1. Click "Settings" in sidebar
2. Set processing limit: 5
3. Add a test email to VIP senders (optional)
4. Save settings

### 3. Send Test Email

1. Send yourself a test email from another account
2. Make sure it's unread in Gmail

### 4. Process Email

1. Click "Run Now" button
2. Wait 5-10 seconds
3. Check "Processed Emails" tab
4. You should see your test email
5. Click on it to view AI-generated reply
6. Check Gmail drafts for the reply

## Development Workflow

### Hot Reload

Both backend and frontend support hot reload:

**Frontend:**
- Edit any file in `frontend/src/`
- Changes appear immediately in browser

**Backend:**
- Edit `server.py`
- Server restarts automatically
- API changes take effect immediately

### Code Structure

**Backend Entry Point:** `backend/server.py`
- FastAPI app initialization
- API routes
- Gmail integration
- Email processing workflow
- APScheduler setup

**Frontend Entry Point:** `frontend/src/App.js`
- Main React component
- Dashboard, Emails, Errors tabs
- API calls to backend

**Settings Component:** `frontend/src/components/Settings.js`
- Workflow configuration
- VIP senders management
- Filters (whitelist/blacklist)

### Making Changes

**Add New API Endpoint:**
1. Edit `backend/server.py`
2. Add route under `api_router`
3. Test with curl or Postman
4. Update frontend to call new endpoint

**Add New UI Feature:**
1. Edit `frontend/src/App.js` or create new component
2. Use existing design system (Cabinet Grotesk, IBM Plex Sans)
3. Add data-testid attributes for testing
4. Test in browser

## Database Management

### View Database

**MongoDB Compass (GUI):**
```bash
# Download from mongodb.com/products/compass
# Connect to: mongodb://localhost:27017
```

**Mongo Shell:**
```bash
mongosh
use email_automation

# View collections
show collections

# View processed emails
db.processed_emails.find().pretty()

# Count emails
db.processed_emails.countDocuments()

# View workflow config
db.workflow_config.find().pretty()
```

### Reset Database

```bash
mongosh
use email_automation
db.dropDatabase()
```

### Backup Database

```bash
mongodump --db=email_automation --out=./backup
```

### Restore Database

```bash
mongorestore --db=email_automation ./backup/email_automation
```

## Common Issues

### Port Already in Use

**Backend (8001):**
```bash
# Find process
lsof -i :8001
# Kill process
kill -9 <PID>
```

**Frontend (3000):**
```bash
# Find process
lsof -i :3000
# Kill process
kill -9 <PID>
```

### MongoDB Not Running

```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

### Python Module Not Found

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Node Modules Error

```bash
cd frontend
rm -rf node_modules yarn.lock
yarn install
```

### CORS Error in Browser

1. Check `backend/.env` has:
   ```
   CORS_ORIGINS=http://localhost:3000
   ```
2. Restart backend server
3. Clear browser cache

### Gmail OAuth Error

**"Error 400: redirect_uri_mismatch"**
- Check Google Cloud Console authorized redirect URIs
- Must include: `http://localhost:8001/api/oauth/gmail/callback`

**"Access blocked: This app's request is invalid"**
- Add your email as Test User in OAuth consent screen
- Wait 1-2 minutes after adding

## Production Deployment

When ready to deploy:

1. Update `.env` files with production values:
   - `BACKEND_URL`: Your production domain
   - `REACT_APP_BACKEND_URL`: Your production domain
   - `CORS_ORIGINS`: Your production frontend URL
   - Update Gmail OAuth redirect URIs in Google Cloud

2. Build frontend:
   ```bash
   cd frontend
   yarn build
   ```

3. Deploy to:
   - **Emergent Platform** (recommended)
   - **Vercel/Netlify** (frontend)
   - **Railway/Render** (backend)
   - **Your own VPS**

4. Set up environment variables on hosting platform

5. Update Gmail OAuth redirect URIs with production URLs

## Performance Tips

### For Local Development

1. **Use MongoDB indexes** (already configured):
   ```javascript
   db.processed_emails.createIndex({ "processed_at": -1 })
   db.error_logs.createIndex({ "timestamp": -1 })
   ```

2. **Limit log output** during development:
   - Edit logging level in `server.py` if needed

3. **Clear old data regularly**:
   - Use "Clear Old" button in dashboard
   - Or run cleanup manually:
     ```bash
     curl -X DELETE http://localhost:8001/api/emails/cleanup?days=30
     ```

## Next Steps

✅ Test all features locally
✅ Make customizations as needed
✅ Test with real Gmail account
✅ Review error logs
✅ Deploy to production when ready

---

**Need Help?**
- Check main [README.md](./README.md)
- Review error logs in dashboard
- Check MongoDB connection
- Verify all environment variables

**Built with Emergent AI - [emergent.ai](https://emergent.ai)**