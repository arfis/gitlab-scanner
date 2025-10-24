#!/bin/bash

# Setup dev tool with clean URLs (port 80) and no development conflicts
set -e

echo "🛠️  Setting up GitLab Scanner as a development tool..."

# Use localhost for clean URLs
CLEAN_IP="127.0.0.1"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "🍎 Detected macOS"
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        echo "⚠️  Don't run as root. The script will use sudo when needed."
        exit 1
    fi
    
    # Remove any existing entries
    echo "🧹 Cleaning existing DNS entries..."
    sudo sed -i '' '/prosoft.gitscanner/d' /etc/hosts 2>/dev/null || true
    
    # Add to /etc/hosts
    echo "📝 Adding prosoft.gitscanner to /etc/hosts..."
    echo "$CLEAN_IP prosoft.gitscanner" | sudo tee -a /etc/hosts
    echo "✅ Added prosoft.gitscanner to /etc/hosts"
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "🐧 Detected Linux"
    
    # Remove any existing entries
    echo "🧹 Cleaning existing DNS entries..."
    sudo sed -i '/prosoft.gitscanner/d' /etc/hosts 2>/dev/null || true
    
    # Add to /etc/hosts
    echo "📝 Adding prosoft.gitscanner to /etc/hosts..."
    echo "$CLEAN_IP prosoft.gitscanner" | sudo tee -a /etc/hosts
    echo "✅ Added prosoft.gitscanner to /etc/hosts"
    
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash, WSL)
    echo "🪟 Detected Windows (Git Bash/WSL)"
    
    # Windows hosts file location
    HOSTS_FILE="/c/Windows/System32/drivers/etc/hosts"
    
    if [ -f "$HOSTS_FILE" ]; then
        echo "📝 Adding prosoft.gitscanner to Windows hosts file..."
        if ! grep -q "prosoft.gitscanner" "$HOSTS_FILE"; then
            echo "$CLEAN_IP prosoft.gitscanner" | sudo tee -a "$HOSTS_FILE"
            echo "✅ Added prosoft.gitscanner to Windows hosts file"
        else
            echo "✅ prosoft.gitscanner already exists in Windows hosts file"
        fi
    else
        echo "❌ Could not find Windows hosts file at $HOSTS_FILE"
        echo "   Please manually add: $CLEAN_IP prosoft.gitscanner"
    fi
    
else
    echo "❓ Unknown OS: $OSTYPE"
    echo "   Please manually add to your hosts file: $CLEAN_IP prosoft.gitscanner"
fi

echo ""
echo "🎉 Development tool setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Stop current services: make docker-stop"
echo "2. Start dev tool: make docker-dev-tool"
echo "3. Visit: http://prosoft.gitscanner (clean URL, no port!)"
echo "4. Direct access: http://localhost:9090 (if needed)"
echo ""
echo "🔧 Benefits:"
echo "   ✅ Clean URLs: http://prosoft.gitscanner (no port needed)"
echo "   ✅ Port 8080 free for development"
echo "   ✅ All API calls work correctly"
echo "   ✅ Professional setup"
echo ""
echo "🔧 To remove later:"
echo "   Remove '$CLEAN_IP prosoft.gitscanner' from your hosts file"
