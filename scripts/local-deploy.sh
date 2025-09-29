#!/bin/bash

# Local Development Deployment Script

echo "🚂 TrainVision AI - Local Development Setup"
echo "=========================================="

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from example..."
    cp .env.production.example .env
    echo "⚠️  Please edit .env file and add your GEMINI_API_KEY"
    echo "You can get it from: https://makersuite.google.com/app/apikey"
fi

# Build and start services
echo "🔨 Building Docker images..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

echo "⏳ Waiting for services to start..."
sleep 20

echo "✅ Services started!"
echo ""
echo "🌐 Application URLs:"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "API Documentation: http://localhost:8000/docs"
echo ""
echo "📋 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down"