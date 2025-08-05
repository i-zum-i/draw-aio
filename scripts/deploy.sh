#!/bin/bash

# AI Diagram Generator Deployment Script

set -e

echo "🚀 Starting deployment process..."

# Check if required environment variables are set
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ Error: ANTHROPIC_API_KEY environment variable is required"
    exit 1
fi

# Build production images
echo "🔨 Building production Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# Start new containers
echo "▶️ Starting new containers..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "🏥 Waiting for services to be healthy..."
timeout 120 bash -c 'until docker-compose -f docker-compose.prod.yml ps | grep -q "healthy"; do sleep 5; done'

# Run health checks
echo "🔍 Running health checks..."
sleep 10

# Check backend health
if curl -f http://localhost:8001/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
    docker-compose -f docker-compose.prod.yml logs backend
    exit 1
fi

# Check frontend health
if curl -f http://localhost:8000 > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend health check failed"
    docker-compose -f docker-compose.prod.yml logs frontend
    exit 1
fi

echo "🎉 Deployment completed successfully!"
echo "📊 Frontend: http://localhost:8000"
echo "🔧 Backend API: http://localhost:8001"
echo "💊 Health check: http://localhost:8001/health"