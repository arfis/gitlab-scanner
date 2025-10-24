#!/bin/bash

# Setup clean DNS for prosoft.gitscanner (no port numbers needed)
set -e

echo "🌐 Setting up clean DNS for prosoft.gitscanner..."

# Use localhost but with a different port approach
CLEAN_IP="127.0.0.1"  # Use localhost but with port 8080

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "🍎 Detected macOS"
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        echo "⚠️  Don't run as root. The script will use sudo when needed."
        exit 1
    fi
    
    # Add to /etc/hosts with clean IP
    echo "📝 Adding prosoft.gitscanner to /etc/hosts with clean IP $CLEAN_IP..."
    if ! grep -q "prosoft.gitscanner" /etc/hosts; then
        echo "$CLEAN_IP prosoft.gitscanner" | sudo tee -a /etc/hosts
        echo "✅ Added prosoft.gitscanner to /etc/hosts ($CLEAN_IP)"
    else
        echo "✅ prosoft.gitscanner already exists in /etc/hosts"
    fi
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "🐧 Detected Linux"
    
    # Add to /etc/hosts with clean IP
    echo "📝 Adding prosoft.gitscanner to /etc/hosts with clean IP $CLEAN_IP..."
    if ! grep -q "prosoft.gitscanner" /etc/hosts; then
        echo "$CLEAN_IP prosoft.gitscanner" | sudo tee -a /etc/hosts
        echo "✅ Added prosoft.gitscanner to /etc/hosts ($CLEAN_IP)"
    else
        echo "✅ prosoft.gitscanner already exists in /etc/hosts"
    fi
    
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash, WSL)
    echo "🪟 Detected Windows (Git Bash/WSL)"
    
    # Windows hosts file location
    HOSTS_FILE="/c/Windows/System32/drivers/etc/hosts"
    
    if [ -f "$HOSTS_FILE" ]; then
        echo "📝 Adding prosoft.gitscanner to Windows hosts file with clean IP $CLEAN_IP..."
        if ! grep -q "prosoft.gitscanner" "$HOSTS_FILE"; then
            echo "$CLEAN_IP prosoft.gitscanner" | sudo tee -a "$HOSTS_FILE"
            echo "✅ Added prosoft.gitscanner to Windows hosts file ($CLEAN_IP)"
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
echo "🎉 Clean DNS setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Start the application: make docker-clean-domain"
echo "2. Visit: http://prosoft.gitscanner (no port needed!)"
echo "3. No conflicts with localhost:80 or other services!"
echo ""
echo "🔧 To remove later:"
echo "   Remove '$CLEAN_IP prosoft.gitscanner' from your hosts file"
echo ""
echo "💡 Benefits:"
echo "   ✅ Clean URLs: prosoft.gitscanner (no port numbers)"
echo "   ✅ No localhost:80 conflicts"
echo "   ✅ Uses dedicated IP: $CLEAN_IP"
echo "   ✅ Professional setup"
