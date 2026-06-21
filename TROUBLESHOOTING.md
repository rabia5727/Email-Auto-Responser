# Troubleshooting Guide

Common issues and solutions when running locally.

## Installation Issues

### Python Virtual Environment Won't Activate

**macOS/Linux:**
```bash
# If 'source venv/bin/activate' doesn't work:
. venv/bin/activate

# Or use full path:
source /full/path/to/venv/bin/activate
```

**Windows:**
```bash
# PowerShell:
venv\Scripts\Activate.ps1

# CMD:
venv\Scripts\activate.bat

# If execution policy error:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Pip Install Fails

```bash
# Update pip first:
pip install --upgrade pip

# Install with verbose output:
pip install -r requirements.txt -v

# Common fixes:
pip install wheel setuptools
pip install -r requirements.txt
```

### Yarn Install Fails

```bash
# Clear cache:
yarn cache clean

# Remove and reinstall:
rm -rf node_modules yarn.lock
yarn install

# Or use npm:
npm install
```

## Runtime Issues

### Backend Won't Start

**Issue: Port 8001 already in use**
```bash
# Find and kill process:
lsof -i :8001
kill -9 <PID>

# Or use different port in server.py:
uvicorn.run(app, host="0.0.0.0", port=8002)
```

**Issue: MongoDB connection refused**
```bash
# Check MongoDB is running:
# macOS:
brew services list | grep mongodb

# Linux:
sudo systemctl status mongod

# Start MongoDB:
# macOS:
brew services start mongodb-community

# Linux:
sudo systemctl start mongod
```

**Issue: Module 'emergentintegrations' not found**
```bash
# Install from requirements.txt:
pip install emergentintegrations

# Or switch to OpenAI SDK:
pip install openai
# Update server.py to use openai instead
```

### Frontend Won't Start

**Issue: Port 3000 already in use**
```bash
# Kill process:
lsof -i :3000
kill -9 <PID>

# Or specify different port:
PORT=3001 yarn start
```

**Issue: Module not found**
```bash
# Clear cache and reinstall:
rm -rf node_modules package-lock.json yarn.lock
yarn install

# Or:
npm cache clean --force
npm install
```

**Issue: Webpack compilation errors**
```bash
# Clear webpack cache:
rm -rf node_modules/.cache

# Restart dev server:
yarn start
```

## API Issues

### CORS Errors in Browser Console

**Symptom:** 
```
Access to XMLHttpRequest at 'http://localhost:8001/api/...' 
from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solution:**
1. Check `backend/.env`:
   ```env
   CORS_ORIGINS=http://localhost:3000
   ```
2. Restart backend server
3. Clear browser cache (Cmd/Ctrl + Shift + R)

### API Calls Return 404

**Check:**
1. Backend is running on port 8001
2. All API routes have `/api` prefix
3. Frontend `.env` has correct backend URL:
   ```env
   REACT_APP_BACKEND_URL=http://localhost:8001
   ```
4. Restart frontend after changing .env

### API Returns 500 Internal Server Error

**Check backend logs:**
```bash
# Backend terminal will show error details
# Common causes:
# - Database connection issue
# - Missing environment variable
# - Python exception in code
```

## Gmail OAuth Issues

### Error: "redirect_uri_mismatch"

**Solution:**
1. Go to Google Cloud Console
2. Credentials → OAuth 2.0 Client IDs
3. Edit your client
4. Add to Authorized redirect URIs:
   ```
   http://localhost:8001/api/oauth/gmail/callback
   ```
5. Save and wait 1-2 minutes

### Error: "access_denied" or "This app isn't verified"

**Solution:**
1. OAuth consent screen → Test users
2. Add your Gmail address
3. Save
4. Try connecting again

### OAuth Succeeds but Still Shows "Not Connected"

**Check:**
1. Backend logs for errors during callback
2. MongoDB has `gmail_tokens` collection
3. Check token was saved:
   ```bash
   mongosh
   use email_automation
   db.gmail_tokens.find().pretty()
   ```

## Email Processing Issues

### "Run Now" Does Nothing

**Check:**
1. Gmail is connected (status shows "Connected")
2. Backend logs for errors
3. You have unread emails in Gmail
4. MongoDB is running

**Debug:**
```bash
# Check processed emails:
mongosh
use email_automation
db.processed_emails.find().pretty()

# Check errors:
db.error_logs.find().pretty()
```

### AI Reply Generation Fails

**Check error logs:**
```bash
# In app: Error Logs tab
# Or MongoDB:
db.error_logs.find().sort({timestamp:-1}).limit(5).pretty()
```

**Common causes:**
1. Invalid API key
2. API rate limit exceeded
3. Network connectivity issue

**Solution:**
```bash
# Test API key:
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}]}'
```

### Emails Not Being Marked as Read

**Check:**
1. Gmail API permissions include "modify" scope
2. Reconnect Gmail if needed
3. Check backend logs for Gmail API errors

## Database Issues

### MongoDB Won't Start

**macOS:**
```bash
# Check for existing process:
ps aux | grep mongod

# Check data directory permissions:
ls -la /usr/local/var/mongodb

# Reset permissions:
sudo chown -R $(whoami) /usr/local/var/mongodb
sudo chown -R $(whoami) /usr/local/var/log/mongodb

# Start:
brew services start mongodb-community
```

**Linux:**
```bash
# Check status:
sudo systemctl status mongod

# Check logs:
sudo tail -f /var/log/mongodb/mongod.log

# Fix permissions:
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown mongodb:mongodb /tmp/mongodb-27017.sock

# Start:
sudo systemctl start mongod
```

### Can't Connect to MongoDB

**If using MongoDB Atlas:**
1. Check connection string in `.env`
2. Whitelist your IP address in Atlas
3. Check username/password are correct

**If using local MongoDB:**
```bash
# Test connection:
mongosh

# If fails, check if running:
ps aux | grep mongod
```

## Performance Issues

### Slow Dashboard Loading

**Solution:**
1. Use date filters (Last 7 Days instead of All Time)
2. Clear old data regularly
3. Check you're not loading thousands of emails at once
4. Pagination should limit to 20 per page

### High Memory Usage

**Check:**
1. Close unused browser tabs
2. Restart backend/frontend servers
3. Clear MongoDB old data
4. Check for memory leaks in browser DevTools

## Development Issues

### Hot Reload Not Working

**Backend:**
- Check you're using `uvicorn` with `--reload` flag
- Save files properly (Cmd/Ctrl + S)
- Check file watching isn't disabled

**Frontend:**
- Check React dev server is running
- Try hard refresh (Cmd/Ctrl + Shift + R)
- Restart dev server

### Changes Not Appearing

**Backend:**
- Restart server manually
- Check for Python syntax errors
- View terminal for error messages

**Frontend:**
- Clear browser cache
- Check for JavaScript console errors
- Restart dev server

## Common Error Messages

### "EADDRINUSE: address already in use"

**Solution:** Port is already taken
```bash
# Kill the process using the port
lsof -i :PORT_NUMBER
kill -9 <PID>
```

### "MongoNetworkError: failed to connect"

**Solution:** MongoDB not running or wrong connection string
```bash
# Start MongoDB
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

### "ModuleNotFoundError: No module named 'X'"

**Solution:** Missing Python package
```bash
source venv/bin/activate
pip install X
# Or reinstall all:
pip install -r requirements.txt
```

### "Cannot find module 'X'"

**Solution:** Missing Node package
```bash
yarn add X
# Or reinstall all:
rm -rf node_modules
yarn install
```

## Getting Help

### Check Logs

**Backend:**
- Terminal where `python server.py` is running
- Look for Python tracebacks

**Frontend:**
- Browser DevTools → Console tab
- Look for red error messages

**MongoDB:**
```bash
# macOS:
tail -f /usr/local/var/log/mongodb/mongo.log

# Linux:
sudo tail -f /var/log/mongodb/mongod.log
```

### Enable Debug Mode

**Backend:**
Edit `server.py`:
```python
logging.basicConfig(level=logging.DEBUG)
```

**Frontend:**
Check browser DevTools → Network tab for API calls

### Still Having Issues?

1. Check [LOCAL_SETUP.md](LOCAL_SETUP.md) for detailed setup
2. Review [README.md](README.md) for architecture
3. Check GitHub issues (if repository is public)
4. Contact support for Emergent-specific features

---

**Pro Tips:**
- Always check logs first
- Use browser DevTools Network tab to debug API calls
- Test API endpoints with curl before debugging frontend
- Keep MongoDB running in the background
- Activate Python virtual environment in each new terminal
