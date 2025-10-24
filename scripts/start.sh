#!/bin/bash

# GitLab Architecture Viewer Startup Script
# This script starts the backend server and opens the frontend in the browser

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default port
PORT=${PORT:-8100}

echo -e "${BLUE}🚀 Starting GitLab Architecture Viewer...${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from example...${NC}"
    if [ -f env.example ]; then
        cp env.example .env
        echo -e "${YELLOW}📝 Please edit .env file with your GitLab token and settings${NC}"
    else
        echo -e "${RED}❌ No env.example file found. Please create a .env file manually.${NC}"
        exit 1
    fi
fi

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo -e "${RED}❌ Go is not installed. Please install Go first.${NC}"
    exit 1
fi

# Check if the project builds
echo -e "${BLUE}🔨 Building project...${NC}"
if ! go build -o /tmp/gitlab-arch-api cmd/api/main.go; then
    echo -e "${RED}❌ Failed to build project. Please check for errors.${NC}"
    exit 1
fi

# Clean up build artifact
rm -f /tmp/gitlab-arch-api

# Start the server in the background
echo -e "${BLUE}🌐 Starting API server on port ${PORT}...${NC}"
go run cmd/api/main.go &
SERVER_PID=$!

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down server...${NC}"
    kill $SERVER_PID 2>/dev/null || true
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for server to start
echo -e "${BLUE}⏳ Waiting for server to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:${PORT}/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Server failed to start within 30 seconds${NC}"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Open browser
echo -e "${BLUE}🌍 Opening web interface in browser...${NC}"
URL="http://localhost:${PORT}"

# Detect OS and open browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open "$URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v xdg-open &> /dev/null; then
        xdg-open "$URL"
    elif command -v firefox &> /dev/null; then
        firefox "$URL" &
    elif command -v chromium-browser &> /dev/null; then
        chromium-browser "$URL" &
    else
        echo -e "${YELLOW}⚠️  Could not auto-open browser. Please open: ${URL}${NC}"
    fi
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows
    start "$URL"
else
    echo -e "${YELLOW}⚠️  Could not auto-open browser. Please open: ${URL}${NC}"
fi

echo -e "${GREEN}🎉 GitLab Architecture Viewer is running!${NC}"
echo -e "${GREEN}📱 Web Interface: ${URL}${NC}"
echo -e "${GREEN}🔧 API Endpoints: ${URL}/api${NC}"
echo -e "${GREEN}❤️  Health Check: ${URL}/health${NC}"
echo ""
echo -e "${BLUE}Press Ctrl+C to stop the server${NC}"

# Wait for server process
wait $SERVER_PID
