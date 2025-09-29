#!/bin/bash

echo "🚂 Deploying TrainVision AI Backend to Railway"
echo "============================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login to Railway
echo "🔐 Please login to Railway..."
railway login

# Create new project
echo "🆕 Creating new Railway project..."
railway new trainvision-backend

# Link to project
railway link

# Set environment variables
echo "🔧 Setting environment variables..."
echo "Please enter your Gemini API key:"
read -s GEMINI_API_KEY

railway variables set GEMINI_API_KEY="$GEMINI_API_KEY"
railway variables set GEMINI_MODEL="gemini-2.5-flash"
railway variables set PORT="8000"

# Deploy from backend directory
echo "🚀 Deploying backend..."
cd backend
railway up

echo "✅ Deployment complete!"
echo "🌐 Your backend will be available at the URL shown above"
echo "📋 Add this URL to your frontend environment variables"