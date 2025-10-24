#!/bin/bash

# Setup fixed domain for prosoft.gitscanner (direct backend access)
set -e

echo "🌐 Setting up fixed domain for prosoft.gitscanner..."

# Use localhost with port 8080 (direct backend access)
FIXED_IP="127.0.0.1"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "🍎 Detected macOS"
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        echo "⚠️  Don't run as root. The script will use sudo when needed."
        exit 1
    fi
    
    # Add to /etc/hosts
    echo "📝 Adding prosoft.gitscanner to /etc/hosts..."
    if ! grep -q "prosoft.gitscanner" /etc/hosts; then
        echo "$FIXED_IP prosoft.gitscanner" | sudo tee -a /etc/hosts
        echo "✅ Added prosoft.gitscanner to /etc/hosts"
    else
        echo "✅ prosoft.gitscanner already exists in /etc/hosts"
    fi
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "🐧 Detected Linux"
    
    # Add to /etc/hosts
    echo "📝 Adding prosoft.gitscanner to /etc/hosts..."
    if ! grep -q "prosoft.gitscanner" /etc/hosts; then
        echo "$FIXED_IP prosoft.gitscanner" | sudo tee -a /etc/hosts
        echo "✅ Added prosoft.gitscanner to /etc/hosts"
    else
        echo "✅ prosoft.gitscanner already exists in /etc/hosts"
    fi
    
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash, WSL)
    echo "🪟 Detected Windows (Git Bash/WSL)"
    
    # Windows hosts file location
    HOSTS_FILE="/c/Windows/System32/drivers/etc/hosts"
    
    if [ -f "$HOSTS_FILE" ]; then
        echo "📝 Adding prosoft.gitscanner to Windows hosts file..."
        if ! grep -q "prosoft.gitscanner" "$HOSTS_FILE"; then
            echo "$FIXED_IP prosoft.gitscanner" | sudo tee -a "$HOSTS_FILE"
            echo "✅ Added prosoft.gitscanner to Windows hosts file"
        else
            echo "✅ prosoft.gitscanner already exists in Windows hosts file"
        fi
    else
        echo "❌ Could not find Windows hosts file at $HOSTS_FILE"
        echo "   Please manually add: $FIXED_IP prosoft.gitscanner"
    fi
    
else
    echo "❓ Unknown OS: $OSTYPE"
    echo "   Please manually add to your hosts file: $FIXED_IP prosoft.gitscanner"
fi

echo ""
echo "🎉 Fixed domain setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Start the application: make docker-fixed-domain"
echo "2. Visit: http://prosoft.gitscanner:8080"
echo "3. Direct backend access - no proxy issues!"
echo ""
echo "🔧 To remove later:"
echo "   Remove '$FIXED_IP prosoft.gitscanner' from your hosts file"
echo ""
echo "💡 Benefits:"
echo "   ✅ Clean domain: prosoft.gitscanner"
echo "   ✅ Direct backend access (no proxy)"
echo "   ✅ No API routing issues"
echo "   ✅ Simple and reliable"
