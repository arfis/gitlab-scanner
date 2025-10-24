#!/bin/bash

# Setup custom port DNS for prosoft.gitscanner (no localhost conflicts)
set -e

echo "🌐 Setting up custom port DNS for prosoft.gitscanner..."

# Use a custom port instead of localhost
CUSTOM_PORT="9090"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "🍎 Detected macOS"
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        echo "⚠️  Don't run as root. The script will use sudo when needed."
        exit 1
    fi
    
    # Add to /etc/hosts with custom port
    echo "📝 Adding prosoft.gitscanner to /etc/hosts with custom port $CUSTOM_PORT..."
    if ! grep -q "prosoft.gitscanner" /etc/hosts; then
        echo "127.0.0.1 prosoft.gitscanner" | sudo tee -a /etc/hosts
        echo "✅ Added prosoft.gitscanner to /etc/hosts"
    else
        echo "✅ prosoft.gitscanner already exists in /etc/hosts"
    fi
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "🐧 Detected Linux"
    
    # Add to /etc/hosts with custom port
    echo "📝 Adding prosoft.gitscanner to /etc/hosts with custom port $CUSTOM_PORT..."
    if ! grep -q "prosoft.gitscanner" /etc/hosts; then
        echo "127.0.0.1 prosoft.gitscanner" | sudo tee -a /etc/hosts
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
        echo "📝 Adding prosoft.gitscanner to Windows hosts file with custom port $CUSTOM_PORT..."
        if ! grep -q "prosoft.gitscanner" "$HOSTS_FILE"; then
            echo "127.0.0.1 prosoft.gitscanner" | sudo tee -a "$HOSTS_FILE"
            echo "✅ Added prosoft.gitscanner to Windows hosts file"
        else
            echo "✅ prosoft.gitscanner already exists in Windows hosts file"
        fi
    else
        echo "❌ Could not find Windows hosts file at $HOSTS_FILE"
        echo "   Please manually add: 127.0.0.1 prosoft.gitscanner"
    fi
    
else
    echo "❓ Unknown OS: $OSTYPE"
    echo "   Please manually add to your hosts file: 127.0.0.1 prosoft.gitscanner"
fi

echo ""
echo "🎉 Custom port DNS setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Start the application: make docker-custom-domain"
echo "2. Visit: http://prosoft.gitscanner:$CUSTOM_PORT"
echo "3. Or visit: http://localhost:$CUSTOM_PORT"
echo "4. No conflicts with localhost:80 or other services!"
echo ""
echo "🔧 To remove later:"
echo "   Remove '127.0.0.1 prosoft.gitscanner' from your hosts file"
echo ""
echo "💡 Benefits:"
echo "   ✅ No localhost:80 conflicts"
echo "   ✅ Custom port: $CUSTOM_PORT"
echo "   ✅ Clean separation from other services"
echo "   ✅ Still uses prosoft.gitscanner domain"
