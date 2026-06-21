#!/bin/bash

echo "🚀 AI Email Auto-Responder - Local Setup Script"
echo "================================================"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.11+"
    exit 1
fi
echo "✓ Python $(python3 --version | cut -d' ' -f2) found"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi
echo "✓ Node.js $(node --version) found"

# Check Yarn
if ! command -v yarn &> /dev/null; then
    echo "❌ Yarn not found. Installing..."
    npm install -g yarn
fi
echo "✓ Yarn $(yarn --version) found"

# Check MongoDB
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB not found. Please install MongoDB or use MongoDB Atlas"
    echo "   Continue anyway? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✓ MongoDB found"
fi

echo ""
echo "🔧 Setting up backend..."
cd backend || exit

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt > /dev/null 2>&1

# Create .env if not exists
if [ ! -f ".env" ]; then
    echo "Creating backend .env file..."
    cp .env.example .env
    echo "⚠️  Please edit backend/.env with your credentials!"
fi

cd ..

echo ""
echo "🎨 Setting up frontend..."
cd frontend || exit

# Install dependencies
echo "Installing Node.js dependencies..."
yarn install > /dev/null 2>&1

# Create .env if not exists
if [ ! -f ".env" ]; then
    echo "Creating frontend .env file..."
    cp .env.example .env
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit backend/.env with your credentials:"
echo "   - EMERGENT_LLM_KEY (or OPENAI_API_KEY)"
echo "   - GOOGLE_CLIENT_ID"
echo "   - GOOGLE_CLIENT_SECRET"
echo "   - MONGO_URL (if using MongoDB Atlas)"
echo ""
echo "2. Start MongoDB (if local):"
echo "   macOS:  brew services start mongodb-community"
echo "   Linux:  sudo systemctl start mongod"
echo ""
echo "3. Start the application:"
echo "   Terminal 1: cd backend && source venv/bin/activate && python server.py"
echo "   Terminal 2: cd frontend && yarn start"
echo ""
echo "4. Open http://localhost:3000 in your browser"
echo ""
echo "📚 See LOCAL_SETUP.md for detailed instructions"
echo ""
