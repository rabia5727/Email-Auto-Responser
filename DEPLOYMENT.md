# Deployment Guide

Guide for deploying AI Email Auto-Responder to production.

## Pre-Deployment Checklist

- [ ] All features tested locally
- [ ] Environment variables configured
- [ ] Gmail OAuth credentials updated with production URLs
- [ ] Database backup created
- [ ] Production MongoDB ready (Atlas or self-hosted)
- [ ] API keys secured

## Deployment Options

### Option 1: Emergent Platform (Recommended)

**Pros:**
- One-click deployment
- Automatic environment management
- Built-in monitoring
- Easy rollback

**Steps:**
1. From Emergent dashboard, click "Deploy"
2. Configure environment variables
3. Deploy automatically handles:
   - Backend & Frontend deployment
   - MongoDB connection
   - SSL certificates
   - Domain setup

### Option 2: Manual Deployment

#### A. Backend Deployment (Railway / Render / Heroku)

**Railway:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Add environment variables
railway variables set MONGO_URL=your_mongo_atlas_url
railway variables set EMERGENT_LLM_KEY=your_key
railway variables set GOOGLE_CLIENT_ID=your_client_id
railway variables set GOOGLE_CLIENT_SECRET=your_secret
railway variables set BACKEND_URL=https://your-backend.railway.app

# Deploy
railway up
```

**Render:**
1. Go to [render.com](https://render.com)
2. Connect GitHub repository
3. Create Web Service
4. Set build command: `pip install -r requirements.txt`
5. Set start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
6. Add environment variables
7. Deploy

#### B. Frontend Deployment (Vercel / Netlify)

**Vercel:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel

# Add environment variable
vercel env add REACT_APP_BACKEND_URL

# Production deploy
vercel --prod
```

**Netlify:**
1. Go to [netlify.com](https://netlify.com)
2. Connect GitHub repository
3. Build settings:
   - Base directory: `frontend`
   - Build command: `yarn build`
   - Publish directory: `frontend/build`
4. Environment variables:
   - `REACT_APP_BACKEND_URL`: Your backend URL
5. Deploy

#### C. Database (MongoDB Atlas)

**Setup:**
1. Sign up at [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Create cluster (M0 Free tier available)
3. Create database user
4. Whitelist IP addresses (or allow from anywhere: 0.0.0.0/0)
5. Get connection string
6. Add to backend environment variables

**Connection String:**
```
mongodb+srv://username:password@cluster.mongodb.net/email_automation?retryWrites=true&w=majority
```

## Production Configuration

### Backend Environment Variables

```env
# Production MongoDB
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/
DB_NAME=email_automation_prod

# CORS - Your frontend URL
CORS_ORIGINS=https://your-app.vercel.app

# API Keys
EMERGENT_LLM_KEY=your_production_key
GOOGLE_CLIENT_ID=your_production_client_id
GOOGLE_CLIENT_SECRET=your_production_client_secret

# Backend URL
BACKEND_URL=https://your-backend.railway.app
```

### Frontend Environment Variables

```env
REACT_APP_BACKEND_URL=https://your-backend.railway.app
```

### Gmail OAuth Production Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Credentials → Edit OAuth client
4. Update Authorized redirect URIs:
   ```
   https://your-backend.railway.app/api/oauth/gmail/callback
   ```
5. Update Authorized JavaScript origins:
   ```
   https://your-app.vercel.app
   ```
6. Save changes

## Security Best Practices

### Environment Variables

**Never commit:**
- `.env` files
- API keys
- Database credentials
- OAuth secrets

**Use:**
- Platform secret managers
- Environment variable management
- Encrypted storage

### CORS Configuration

**Production:**
```python
# Only allow your frontend domain
CORS_ORIGINS=https://your-app.vercel.app

# Or multiple domains
CORS_ORIGINS=https://app.com,https://www.app.com
```

### API Rate Limiting

Add rate limiting to protect your API:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/api/workflow/trigger")
@limiter.limit("5/minute")
async def trigger_workflow():
    # Your code
```

### HTTPS Only

Ensure all connections use HTTPS:
- Backend uses SSL certificate
- Frontend forces HTTPS
- No mixed content warnings

## Monitoring & Logging

### Backend Logging

**Production logging setup:**
```python
import logging
from logging.handlers import RotatingFileHandler

# Configure logging
handler = RotatingFileHandler('app.log', maxBytes=10000000, backupCount=3)
formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
handler.setFormatter(formatter)
logger = logging.getLogger(__name__)
logger.addHandler(handler)
logger.setLevel(logging.INFO)
```

### Error Tracking

**Sentry Integration:**
```bash
pip install sentry-sdk
```

```python
import sentry_sdk

sentry_sdk.init(
    dsn="your_sentry_dsn",
    traces_sample_rate=1.0
)
```

### Uptime Monitoring

**Options:**
- [UptimeRobot](https://uptimerobot.com) - Free, easy setup
- [Pingdom](https://pingdom.com) - Advanced monitoring
- [StatusCake](https://statuscake.com) - Multiple check types

**Setup:**
1. Add health check endpoint
2. Configure monitoring service
3. Set alert notifications

### Performance Monitoring

**Add health check:**
```python
@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": "connected" if await db.command("ping") else "disconnected"
    }
```

## Backup Strategy

### Database Backups

**MongoDB Atlas (Automatic):**
- Enabled by default
- Point-in-time recovery available
- Snapshot downloads

**Self-Hosted:**
```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
mongodump --uri="$MONGO_URL" --out=/backups/backup_$DATE
```

### Code Backups

- Use Git for version control
- Push to GitHub/GitLab regularly
- Tag releases
- Document changes

## Scaling Considerations

### When to Scale

**Indicators:**
- Processing >1000 emails/day
- Response time >2 seconds
- High memory usage
- Frequent errors

### Scaling Options

**Horizontal Scaling:**
- Add more backend instances
- Use load balancer
- Implement job queue

**Vertical Scaling:**
- Upgrade server resources
- Optimize database queries
- Add caching layer

**Database Scaling:**
- Upgrade MongoDB tier
- Add indexes
- Implement data archival

### Performance Optimization

**Backend:**
```python
# Add database indexes
await db.processed_emails.create_index([("processed_at", -1)])
await db.processed_emails.create_index([("from_email", 1)])

# Implement caching
from functools import lru_cache

@lru_cache(maxsize=100)
def get_settings():
    # Cache settings
```

**Frontend:**
```javascript
// Use React.memo for expensive components
const ExpensiveComponent = React.memo(({ data }) => {
  // Component code
});

// Implement virtual scrolling for large lists
import { FixedSizeList } from 'react-window';
```

## Rollback Procedure

### Emergent Platform

1. Go to deployment history
2. Select previous stable version
3. Click "Rollback"

### Manual Deployment

**Backend:**
```bash
# Railway
railway rollback

# Render
# Use Render dashboard to rollback to previous deploy
```

**Frontend:**
```bash
# Vercel
vercel rollback

# Netlify
# Use Netlify dashboard to rollback
```

**Database:**
```bash
# Restore from backup
mongorestore --uri="$MONGO_URL" /backups/backup_YYYYMMDD
```

## Post-Deployment

### Testing Checklist

- [ ] Homepage loads correctly
- [ ] Gmail OAuth flow works
- [ ] Can connect Gmail account
- [ ] Run Now processes emails
- [ ] Drafts created in Gmail
- [ ] Error logs working
- [ ] Settings saved correctly
- [ ] CSV export downloads
- [ ] All API endpoints responding

### Monitoring Setup

1. Set up uptime monitoring
2. Configure error alerts
3. Monitor API response times
4. Track error rates
5. Monitor database performance

### Documentation

1. Document production URLs
2. Update team on new deployment
3. Note any configuration changes
4. Update runbook if needed

## Maintenance

### Regular Tasks

**Daily:**
- Check error logs
- Monitor uptime
- Review API usage

**Weekly:**
- Check database size
- Review performance metrics
- Clear old test data

**Monthly:**
- Update dependencies
- Review security updates
- Optimize database queries
- Clear old processed emails (30+ days)

### Updating Dependencies

**Backend:**
```bash
pip list --outdated
pip install --upgrade package_name
pip freeze > requirements.txt
```

**Frontend:**
```bash
yarn outdated
yarn upgrade package_name
```

**Test after updates!**

## Support & Troubleshooting

### Common Production Issues

**Issue: High response times**
- Check database query performance
- Add indexes
- Implement caching
- Scale resources

**Issue: Memory leaks**
- Monitor process memory
- Check for unclosed connections
- Review APScheduler jobs
- Implement proper cleanup

**Issue: OAuth fails in production**
- Verify redirect URIs match exactly
- Check HTTPS is enforced
- Ensure OAuth credentials are production ones

### Getting Help

- Check application logs
- Review error tracking (Sentry)
- Contact hosting support
- Check Emergent documentation

---

**Pro Tips:**
- Deploy to staging first
- Test OAuth flow in production
- Monitor closely after deployment
- Keep rollback plan ready
- Document everything
- Use infrastructure as code
- Implement CI/CD pipeline

**Built with Emergent AI** - [emergent.ai](https://emergent.ai)
