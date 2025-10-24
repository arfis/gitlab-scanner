#!/bin/bash

# Docker startup script for GitLab List
set -e

echo "🐳 Starting GitLab List with Docker..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from example..."
    if [ -f env.example ]; then
        cp env.example .env
        echo "📝 Please edit .env file with your GitLab token and settings"
        echo "   Required: GITLAB_TOKEN=your_gitlab_token_here"
        exit 1
    else
        echo "❌ No env.example file found. Please create a .env file manually."
        exit 1
    fi
fi

# Check if GitLab token is set
if ! grep -q "GITLAB_TOKEN=your_gitlab_token_here" .env && ! grep -q "GITLAB_TOKEN=" .env; then
    echo "❌ GITLAB_TOKEN not found in .env file"
    echo "   Please set GITLAB_TOKEN=your_gitlab_token_here in .env file"
    exit 1
fi

# Check for MongoDB port conflict
echo "🔍 Checking for MongoDB port conflicts..."
if lsof -i :27017 >/dev/null 2>&1; then
    echo "⚠️  Port 27017 is already in use!"
    echo ""
    echo "You have several options:"
    echo "1. Use external MongoDB (recommended if you have one running)"
    echo "2. Use custom port for Docker MongoDB"
    echo "3. Stop the existing MongoDB service"
    echo ""
    read -p "Choose option (1/2/3): " choice
    
    case $choice in
        1)
            echo "🔗 Using external MongoDB..."
            echo "   Make sure your MongoDB is accessible and update MONGODB_URI in .env if needed"
            COMPOSE_FILE="docker-compose.external-mongo.yml"
            ;;
        2)
            echo "🔧 Using custom port (27018) for Docker MongoDB..."
            COMPOSE_FILE="docker-compose.custom-port.yml"
            ;;
        3)
            echo "🛑 Please stop the existing MongoDB service and run this script again"
            exit 1
            ;;
        *)
            echo "❌ Invalid choice. Exiting."
            exit 1
            ;;
    esac
else
    echo "✅ Port 27017 is available"
    COMPOSE_FILE="docker-compose.yml"
fi

# Create logs directory
mkdir -p logs

# Start services
echo "🚀 Starting Docker services with $COMPOSE_FILE..."
docker-compose -f $COMPOSE_FILE up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if main service is running
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ GitLab List is running!"
    echo "🌍 Web Interface: http://localhost:8080"
    echo "🔧 API Endpoints: http://localhost:8080/api"
    echo "❤️  Health Check: http://localhost:8080/health"
    echo ""
    echo "📊 View logs: docker-compose logs -f"
    echo "🛑 Stop services: docker-compose down"
else
    echo "❌ Service failed to start. Check logs:"
    echo "   docker-compose logs"
    exit 1
fi
