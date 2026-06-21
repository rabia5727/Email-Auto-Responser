# AI Email Auto-Responder

🤖 Intelligent email workflow automation with AI-powered replies using GPT-5.4-mini

## Features

✅ **Smart Email Processing**
- Automatic fetching of unread Gmail emails
- AI-generated professional replies using OpenAI GPT-5.4-mini
- Draft creation in Gmail (with optional auto-send)
- Email status tracking (Processed ✓ / Failed ✗)

✅ **Advanced Filtering**
- VIP Senders - Skip important contacts for manual reply
- Whitelist - Only process specific senders
- Blacklist - Ignore specific senders
- Adjustable processing limit (1-50 emails per run)

✅ **Workflow Management**
- Manual trigger (Run Now button)
- Automatic scheduling (every 5 minutes)
- Custom AI prompts for reply generation
- Success rate tracking and analytics

✅ **Data Management**
- Pagination (20 items per page)
- Date filters (Last 7/30 days, All time)
- CSV export for processed emails
- Clear old data functionality
- Search and filter capabilities

✅ **Professional Dashboard**
- Real-time metrics and statistics
- Error logs with detailed tracking
- Gmail account management (connect/disconnect)
- Responsive Swiss & High-Contrast design

## Tech Stack

**Frontend:**
- React 18
- Axios for API calls
- Lucide React icons
- Custom CSS with modern design system

**Backend:**
- FastAPI (Python)
- MongoDB (Motor async driver)
- APScheduler for background tasks
- Gmail API integration
- Emergent Integrations (OpenAI GPT-5.4-mini)

**Infrastructure:**
- Hot reload enabled for development
- Supervisor for process management
- CORS configured
- Environment-based configuration

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+ / Yarn
- MongoDB 5.0+
- Gmail API credentials
- OpenAI API key (or Emergent LLM key)

### Installation

See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for detailed setup instructions.

```bash
# 1. Clone repository
git clone <your-repo-url>
cd ai-email-auto-responder

# 2. Backend setup
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials

# 3. Frontend setup
cd ../frontend
yarn install
cp .env.example .env
# Edit .env with backend URL

# 4. Run locally
# Terminal 1 - Backend
cd backend && python server.py

# Terminal 2 - Frontend
cd frontend && yarn start
```

### Environment Variables

**Backend (.env):**
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=email_automation
CORS_ORIGINS=http://localhost:3000
EMERGENT_LLM_KEY=your_emergent_key_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
BACKEND_URL=http://localhost:8001
```

**Frontend (.env):**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

## Gmail API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Gmail API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - Local: `http://localhost:8001/api/oauth/gmail/callback`
   - Production: `https://your-domain.com/api/oauth/gmail/callback`
6. Download credentials and add to `.env`

## Usage

### First Time Setup

1. **Connect Gmail:**
   - Click "Connect Gmail" button
   - Complete OAuth flow
   - Grant required permissions

2. **Configure Settings:**
   - Click "Settings" in sidebar
   - Set processing limit (default: 5)
   - Add VIP senders if needed
   - Customize AI prompt (optional)
   - Save settings

3. **Process Emails:**
   - Click "Run Now" for immediate processing
   - Or enable "Start Workflow" for automatic processing every 5 minutes

### VIP Senders (Important Emails)

Add email addresses that should NOT be auto-replied:
1. Settings → VIP Senders section
2. Enter email address (e.g., boss@company.com)
3. Click "Add VIP"
4. These emails will remain unread for manual reply

### Data Management

**Viewing Processed Emails:**
- Navigate to "Processed Emails" tab
- Use date filters: All Time / Last 7 Days / Last 30 Days
- Browse pages (20 emails per page)
- Click any email to view AI-generated reply

**Exporting Data:**
- Click "Export CSV" button (appears after processing emails)
- Downloads all processed emails with timestamps and replies

**Cleaning Old Data:**
- Click "Clear Old" button on Processed Emails or Error Logs
- Deletes data older than 30 days
- Confirms before deletion

## API Documentation

### Workflow Endpoints

```
GET  /api/workflow/status       - Get workflow status and stats
POST /api/workflow/toggle       - Start/stop automatic workflow
POST /api/workflow/trigger      - Manually trigger workflow now
```

### Email Endpoints

```
GET    /api/emails/processed    - Get processed emails (paginated)
GET    /api/emails/export       - Export emails as CSV
GET    /api/emails/search       - Search emails by sender/subject
DELETE /api/emails/cleanup      - Delete old emails (30+ days)
```

### Settings Endpoints

```
GET  /api/settings              - Get workflow settings
POST /api/settings              - Update workflow settings
```

### Auth Endpoints

```
GET  /api/oauth/gmail/login     - Initiate Gmail OAuth
GET  /api/oauth/gmail/callback  - Handle OAuth callback
POST /api/auth/logout           - Disconnect Gmail account
```

### Error Endpoints

```
GET    /api/errors              - Get error logs (paginated)
DELETE /api/errors/cleanup      - Delete old errors (30+ days)
```

## Project Structure

```
/app/
├── backend/
│   ├── server.py              # FastAPI application
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Backend config
├── frontend/
│   ├── src/
│   │   ├── App.js            # Main React component
│   │   ├── App.css           # Component styles
│   │   ├── index.css         # Global styles
│   │   └── components/
│   │       └── Settings.js   # Settings modal
│   ├── package.json          # Node dependencies
│   └── .env                  # Frontend config
├── memory/
│   └── test_credentials.md   # Test account info
├── design_guidelines.json    # UI/UX design system
├── README.md                 # This file
└── LOCAL_SETUP.md           # Local development guide
```

## Database Schema

**Collections:**

```javascript
// gmail_tokens
{
  user_id: String,
  access_token: String,
  refresh_token: String,
  expires_at: DateTime,
  client_id: String,
  client_secret: String,
  token_uri: String
}

// processed_emails
{
  id: String (UUID),
  email_id: String,
  from_email: String,
  subject: String,
  body: String,
  ai_reply: String,
  draft_id: String,
  processed_at: DateTime,
  status: String  // "success" | "error"
}

// error_logs
{
  id: String (UUID),
  email_id: String (optional),
  error_message: String,
  error_type: String,
  timestamp: DateTime
}

// workflow_config
{
  enabled: Boolean,
  last_run: DateTime,
  processing_limit: Number,
  auto_send_drafts: Boolean,
  custom_prompt: String,
  sender_whitelist: [String],
  sender_blacklist: [String],
  vip_senders: [String]
}

// oauth_states (temporary)
{
  state: String,
  user_id: String,
  flow_data: Object,
  created_at: DateTime,
  expires_at: DateTime
}
```

## Troubleshooting

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
# Check MongoDB is running
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod
```

**Import Error:**
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### Frontend Issues

**Module not found:**
```bash
# Clear cache and reinstall
rm -rf node_modules yarn.lock
yarn install
```

**CORS Error:**
- Check `CORS_ORIGINS` in backend `.env`
- Should include frontend URL: `http://localhost:3000`

## Performance Optimization

**For Heavy Usage (1000+ emails/month):**

1. **Enable Pagination:** Already implemented (20 per page)
2. **Regular Cleanup:** Use "Clear Old" button monthly
3. **Filter by Date:** Use "Last 7 Days" for recent activity
4. **MongoDB Indexes:** Added automatically on email_id and timestamp

## Security Notes

⚠️ **Important:**
- Never commit `.env` files to Git
- Keep API keys secure
- Use environment variables for all credentials
- Review Gmail permissions before granting access
- Turn off auto-send for sensitive accounts
- Use VIP senders for important contacts

## Contributing

This project was built with [Emergent AI](https://emergent.ai) - an AI-powered development platform.

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:
- Check [LOCAL_SETUP.md](./LOCAL_SETUP.md) for detailed setup
- Review error logs in dashboard
- Contact support for Emergent-specific features

---

**Built with ❤️ using Emergent AI Platform**