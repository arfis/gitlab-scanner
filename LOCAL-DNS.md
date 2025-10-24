# Local DNS Setup for prosoft.gitscanner

This guide shows you how to set up a custom local domain `prosoft.gitscanner` for your GitLab List application.

## 🚀 Quick Setup

### Option 1: Automated Setup (Recommended)
```bash
# 1. Setup local DNS
make setup-dns

# 2. Start with local domain
make docker-local-dns

# 3. Visit: http://prosoft.gitscanner
```

### Option 2: Manual Setup

#### Step 1: Add to hosts file

**macOS/Linux:**
```bash
sudo echo "127.0.0.1 prosoft.gitscanner" >> /etc/hosts
```

**Windows:**
1. Open Notepad as Administrator
2. Open `C:\Windows\System32\drivers\etc\hosts`
3. Add: `127.0.0.1 prosoft.gitscanner`
4. Save the file

#### Step 2: Start the application
```bash
make docker-local-dns
```

## 🌐 How It Works

### Architecture
```
Internet → prosoft.gitscanner → Nginx Proxy → GitLab List App
```

1. **Local DNS**: `prosoft.gitscanner` resolves to `127.0.0.1`
2. **Nginx Proxy**: Routes traffic from port 80 to your app
3. **GitLab List**: Runs on internal port 8080

### Port Mapping
- **External**: `prosoft.gitscanner:80` (or `localhost:80`)
- **Internal**: `gitlab-list:8080`
- **Direct Access**: `localhost:8100` (if you want direct access)

## 🔧 Configuration Options

### 1. Nginx Proxy (Default)
```bash
# Uses nginx to route prosoft.gitscanner to your app
make docker-local-dns
```
- **URL**: http://prosoft.gitscanner
- **Features**: Load balancing, SSL ready, easy configuration

### 2. Traefik Proxy (Advanced)
```bash
# Uses Traefik for more advanced routing
docker compose -f docker-compose.local-dns.yml up -d
```
- **URL**: http://prosoft.gitscanner
- **Features**: Automatic SSL, service discovery, dashboard

## 📋 Available Commands

```bash
# DNS Setup
make setup-dns              # Setup local DNS
make docker-local-dns       # Start with local domain

# Alternative setups
make docker-external-mongo  # Use external MongoDB
make docker-custom-port     # Use custom port (27018)

# Management
make docker-logs            # View logs
make docker-stop            # Stop services
```

## 🔍 Troubleshooting

### DNS Issues
```bash
# Test DNS resolution
nslookup prosoft.gitscanner
# Should return: 127.0.0.1

# Test with ping
ping prosoft.gitscanner
# Should ping 127.0.0.1
```

### Port Conflicts
```bash
# Check what's using port 80
lsof -i :80

# If port 80 is busy, modify nginx.conf to use different port
# Change "listen 80;" to "listen 8080;" in nginx.conf
```

### Application Not Loading
```bash
# Check if containers are running
docker compose ps

# Check logs
make docker-logs

# Test direct access
curl http://localhost:8100/health
```

## 🎨 Customization

### Change Domain Name
1. Edit `nginx.conf`:
   ```nginx
   server_name your-custom-domain.local;
   ```

2. Update hosts file:
   ```bash
   echo "127.0.0.1 your-custom-domain.local" | sudo tee -a /etc/hosts
   ```

### Add SSL/HTTPS
1. Get SSL certificates (Let's Encrypt, self-signed, etc.)
2. Update `nginx.conf` with SSL configuration
3. Add certificate paths to nginx volume mounts

### Multiple Services
You can run multiple services on different domains:
```nginx
server {
    listen 80;
    server_name prosoft.gitscanner;
    # ... your app config
}

server {
    listen 80;
    server_name another.service.local;
    # ... another app config
}
```

## 🧹 Cleanup

### Remove Local DNS
```bash
# Remove from hosts file
sudo sed -i '/prosoft.gitscanner/d' /etc/hosts

# Stop services
make docker-stop
```

### Complete Cleanup
```bash
# Remove all containers and volumes
make docker-clean

# Remove from hosts file
sudo sed -i '/prosoft.gitscanner/d' /etc/hosts
```

## 🔒 Security Notes

- **Local Only**: This setup only works on your local machine
- **No External Access**: `prosoft.gitscanner` won't work from other machines
- **Development Use**: Perfect for development, not for production
- **Firewall**: Make sure your firewall allows local connections

## 📚 Advanced Usage

### Custom Nginx Configuration
Edit `nginx.conf` to add:
- Rate limiting
- Authentication
- Caching
- SSL termination
- Load balancing

### Integration with Other Tools
- **Docker Compose**: Easy integration with other services
- **Development Tools**: Works with your IDE and debugging tools
- **CI/CD**: Can be used in automated testing environments

## 🆘 Support

If you encounter issues:
1. Check the logs: `make docker-logs`
2. Verify DNS: `nslookup prosoft.gitscanner`
3. Test connectivity: `curl http://prosoft.gitscanner/health`
4. Check ports: `lsof -i :80`
