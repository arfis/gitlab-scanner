#!/bin/bash

# Setup dedicated DNS for prosoft.gitscanner (no localhost conflicts)
set -e

echo "🌐 Setting up dedicated DNS for prosoft.gitscanner..."

# Use a dedicated IP range that won't conflict with localhost
DEDICATED_IP="192.168.100.100"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "🍎 Detected macOS"
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        echo "⚠️  Don't run as root. The script will use sudo when needed."
        exit 1
    fi
    
    # Add to /etc/hosts with dedicated IP
    echo "📝 Adding prosoft.gitscanner to /etc/hosts with dedicated IP $DEDICATED_IP..."
    if ! grep -q "prosoft.gitscanner" /etc/hosts; then
        echo "$DEDICATED_IP prosoft.gitscanner" | sudo tee -a /etc/hosts
        echo "✅ Added prosoft.gitscanner to /etc/hosts ($DEDICATED_IP)"
    else
        echo "✅ prosoft.gitscanner already exists in /etc/hosts"
    fi
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "🐧 Detected Linux"
    
    # Add to /etc/hosts with dedicated IP
    echo "📝 Adding prosoft.gitscanner to /etc/hosts with dedicated IP $DEDICATED_IP..."
    if ! grep -q "prosoft.gitscanner" /etc/hosts; then
        echo "$DEDICATED_IP prosoft.gitscanner" | sudo tee -a /etc/hosts
        echo "✅ Added prosoft.gitscanner to /etc/hosts ($DEDICATED_IP)"
    else
        echo "✅ prosoft.gitscanner already exists in /etc/hosts"
    fi
    
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash, WSL)
    echo "🪟 Detected Windows (Git Bash/WSL)"
    
    # Windows hosts file location
    HOSTS_FILE="/c/Windows/System32/drivers/etc/hosts"
    
    if [ -f "$HOSTS_FILE" ]; then
        echo "📝 Adding prosoft.gitscanner to Windows hosts file with dedicated IP $DEDICATED_IP..."
        if ! grep -q "prosoft.gitscanner" "$HOSTS_FILE"; then
            echo "$DEDICATED_IP prosoft.gitscanner" | sudo tee -a "$HOSTS_FILE"
            echo "✅ Added prosoft.gitscanner to Windows hosts file ($DEDICATED_IP)"
        else
            echo "✅ prosoft.gitscanner already exists in Windows hosts file"
        fi
    else
        echo "❌ Could not find Windows hosts file at $HOSTS_FILE"
        echo "   Please manually add: $DEDICATED_IP prosoft.gitscanner"
    fi
    
else
    echo "❓ Unknown OS: $OSTYPE"
    echo "   Please manually add to your hosts file: $DEDICATED_IP prosoft.gitscanner"
fi

echo ""
echo "🎉 Dedicated DNS setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Start the application: make docker-dedicated-dns"
echo "2. Visit: http://prosoft.gitscanner"
echo "3. No conflicts with localhost or other services!"
echo ""
echo "🔧 To remove later:"
echo "   Remove '$DEDICATED_IP prosoft.gitscanner' from your hosts file"
echo ""
echo "💡 Benefits:"
echo "   ✅ No localhost conflicts"
echo "   ✅ Dedicated IP: $DEDICATED_IP"
echo "   ✅ Clean separation from other services"
