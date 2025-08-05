#!/bin/bash

# Production Environment Setup Script

set -e

echo "🔧 Setting up production environment..."

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p ssl
mkdir -p temp
mkdir -p backups

# Set proper permissions
chmod 755 logs temp backups
chmod 700 ssl

# Copy environment files if they don't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your production values"
fi

if [ ! -f packages/backend/.env ]; then
    echo "📝 Creating backend .env file from template..."
    cp packages/backend/.env.example packages/backend/.env
    echo "⚠️  Please edit packages/backend/.env file with your production values"
fi

if [ ! -f packages/frontend/.env ]; then
    echo "📝 Creating frontend .env file from template..."
    cp packages/frontend/.env.example packages/frontend/.env
    echo "⚠️  Please edit packages/frontend/.env file with your production values"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:all

# Build applications
echo "🔨 Building applications..."
npm run build:production

# Run tests
echo "🧪 Running tests..."
npm run test

# Run linting
echo "🔍 Running linting..."
npm run lint

echo "✅ Production environment setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env files with your production values"
echo "2. Configure SSL certificates in ./ssl/ directory"
echo "3. Review nginx.conf for your domain settings"
echo "4. Run deployment script: ./scripts/deploy.sh"