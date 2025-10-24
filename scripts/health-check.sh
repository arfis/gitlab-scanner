#!/bin/bash

# Health check script for GitLab List
set -e

# Check if the main service is responding
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Main service is healthy"
    exit 0
else
    echo "❌ Main service is not responding"
    exit 1
fi
