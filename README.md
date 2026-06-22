# AutoReply — AI Email Auto-Responder

> 🤖 Intelligent email workflow automation with AI-powered replies using GPT-5.4-mini

---

## 🚀 Quick Overview

**AutoReply** connects to your Gmail, reads unread emails, generates professional AI replies, and creates drafts — automatically.

**What it does:**
- 📥 Reads unread Gmail emails
- 🤖 Generates AI replies with GPT-5.4-mini
- ✍️ Creates drafts for review (or auto-sends)
- ⏱️ Runs every 5 minutes automatically
- 📊 Full dashboard with metrics and logs

**Who it's for:**
- Busy professionals drowning in emails
- Agencies managing client communication
- Anyone who wants to save 10+ hours/week

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Axios, Lucide Icons |
| **Backend** | FastAPI (Python) |
| **Database** | MongoDB (Motor async driver) |
| **Scheduler** | APScheduler |
| **AI** | OpenAI GPT-5.4-mini (via Emergent) |
| **Email** | Gmail API (OAuth 2.0) |

---

## ⚡ Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+ / Yarn
- MongoDB 5.0+
- Gmail API credentials
- OpenAI API key (or Emergent LLM key)

### Installation

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd ai-email-auto-responder

# 2. Backend setup
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# 3. Frontend setup
cd ../frontend
yarn install
cp .env.example .env

# 4. Configure environment variables
# Edit backend/.env and frontend/.env with your credentials

# 5. Run it
# Terminal 1 - Backend
cd backend && python server.py

# Terminal 2 - Frontend
cd frontend && yarn start
```

**Access:** http://localhost:3000

---

## 🔑 Required Credentials

| Credential | Where to Get It |
|------------|-----------------|
| **Gmail API Credentials** | [Google Cloud Console](https://console.cloud.google.com/) |
| **OpenAI API Key** | [OpenAI Platform](https://platform.openai.com/api-keys) (or Emergent) |
| **MongoDB URL** | Local installation or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) |

### Gmail API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Library**
4. Search for **Gmail API** and enable it
5. Go to **APIs & Services** → **Credentials**
6. Click **Create Credentials** → **OAuth 2.0 Client IDs**
7. Select **Web application** as the type
8. Add authorized redirect URIs:
   - Local: `http://localhost:8001/api/oauth/gmail/callback`
   - Production: `https://your-domain.com/api/oauth/gmail/callback`
9. Copy Client ID and Client Secret
10. Add your email as a **Test User** in OAuth consent screen

### OpenAI API Setup

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in
3. Click **Create new secret key**
4. Name it (e.g., "AutoReply")
5. Copy the key immediately

### MongoDB Setup

**Option A: Local Installation**
```bash
sudo apt-get install mongodb  # Ubuntu/Debian
sudo systemctl start mongod
# URL: mongodb://localhost:27017
```

**Option B: MongoDB Atlas (Cloud)**
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free account
3. Create cluster (free tier)
4. Get connection string
5. Add IP to whitelist

---

## 🔧 Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=email_automation
CORS_ORIGINS=http://localhost:3000
EMERGENT_LLM_KEY=your_key_here
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
BACKEND_URL=http://localhost:8001
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## 📋 Key Features

### Smart Email Processing
- ✅ Auto-fetch unread emails
- ✅ AI-generated professional replies
- ✅ Draft creation (optional auto-send)
- ✅ Status tracking (Processed ✓ / Failed ✗)

### Advanced Controls
- 🛡️ VIP Senders — Skip important contacts
- ✅ Whitelist — Only process specific senders
- 🚫 Blacklist — Ignore specific senders
- ⚙️ Adjustable processing limit (1-50 emails/run)

### Dashboard & Analytics
- 📊 Real-time metrics
- 📝 Error logs with tracking
- 📥 CSV export
- 🔍 Search and filter

---

## 📖 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/workflow/status` | GET | Get workflow status |
| `/api/workflow/toggle` | POST | Start/stop workflow |
| `/api/workflow/trigger` | POST | Run now |
| `/api/emails/processed` | GET | View processed emails |
| `/api/emails/export` | GET | Export CSV |
| `/api/settings` | GET/POST | Manage settings |
| `/api/oauth/gmail/login` | GET | Connect Gmail |
| `/api/errors` | GET | View error logs |

---

## 🗄️ Database Schema

| Collection | Purpose |
|------------|---------|
| **gmail_tokens** | OAuth tokens for Gmail |
| **processed_emails** | Email history + AI replies |
| **error_logs** | Error tracking |
| **workflow_config** | Settings and filters |
| **oauth_states** | Temporary OAuth states |

---

## 📂 Project Structure

```
ai-email-auto-responder/
├── backend/
│   ├── server.py              # FastAPI application
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Backend configuration
├── frontend/
│   ├── src/
│   │   ├── App.js            # Main React component
│   │   ├── App.css           # Component styles
│   │   ├── index.css         # Global styles
│   │   └── components/
│   │       └── Settings.js   # Settings modal
│   ├── package.json          # Node dependencies
│   └── .env                  # Frontend configuration
├── memory/
│   └── test_credentials.md   # Test account info
├── design_guidelines.json    # UI/UX design system
├── README.md                 # This file
└── LOCAL_SETUP.md           # Local development guide
```

---

## 🔒 Security Notes

- ⚠️ Never commit `.env` files to Git
- 🔐 Keep API keys secure
- ✅ Use environment variables for all credentials
- 📝 Review Gmail permissions before granting access
- 🛡️ Use VIP senders for important contacts

---

## 🐛 Troubleshooting

### Gmail OAuth Issues

**Error: "can't access your Google account"**
- Add your email as Test User in Google Cloud Console
- OAuth consent screen → Test users → Add your email

**Error: "Missing code verifier"**
- Already fixed in current implementation
- Uses PKCE flow with proper state management

### Backend Issues

**MongoDB Connection Failed:**
```bash
sudo systemctl status mongod  # Check status
sudo systemctl start mongod   # Start MongoDB
```

**Import Error:**
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend Issues

**Module not found:**
```bash
rm -rf node_modules yarn.lock
yarn install
```

**CORS Error:**
- Check CORS_ORIGINS in backend .env
- Should include: `http://localhost:3000`

---

## 📄 License

MIT License

---

## 🙏 Built With

Built with ❤️ using [Emergent AI Platform](https://emergent.com)
