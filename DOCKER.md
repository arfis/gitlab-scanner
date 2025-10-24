# Docker Setup for GitLab List

This document explains how to run the GitLab List application using Docker.

## Prerequisites

- Docker and Docker Compose installed
- GitLab token with appropriate permissions

## Quick Start

1. **Copy environment file:**
   ```bash
   cp env.example .env
   ```

2. **Edit `.env` file with your configuration:**
   ```bash
   # Required
   GITLAB_TOKEN=your_gitlab_token_here
   
   # Optional (defaults shown)
   GROUP=nghis
   TAG=services
   BRANCHES=default
   MONGODB_USERNAME=admin
   MONGODB_PASSWORD=admin
   MONGODB_DATABASE=gitlab_cache
   CACHE_TTL=24h
   SYNC_SCHEDULE=0 3 * * *
   TZ=UTC
   ```

3. **Start the application:**
   ```bash
   # Automatic conflict detection
   make docker-start
   
   # Or manually
   docker-compose up -d
   ```

4. **Access the application:**
   - Web Interface: http://localhost:8080
   - API: http://localhost:8080/api
   - Health Check: http://localhost:8080/health

## MongoDB Port Conflicts

If you already have MongoDB running on port 27017, you have several options:

### Option 1: Use External MongoDB (Recommended)
```bash
# Use your existing MongoDB
make docker-external-mongo
# or
docker-compose -f docker-compose.external-mongo.yml up -d
```

**Configuration:**
- Update `MONGODB_URI` in `.env` if your MongoDB is not on localhost:27017
- Example: `MONGODB_URI=mongodb://your-mongo-host:27017`

### Option 2: Use Custom Port
```bash
# Use port 27018 for Docker MongoDB
make docker-custom-port
# or
docker-compose -f docker-compose.custom-port.yml up -d
```

### Option 3: Automatic Detection
The startup script will automatically detect port conflicts and offer options:
```bash
make docker-start
```

## Services

### Main Application (`gitlab-list`)
- **Port:** 8080
- **Purpose:** REST API and web interface
- **Dependencies:** MongoDB

### MongoDB (`mongodb`)
- **Port:** 27017
- **Purpose:** Caching layer for GitLab data
- **Data:** Persisted in Docker volume

### Scheduler (`scheduler`)
- **Purpose:** Automatic synchronization at configured times
- **Schedule:** Configurable via `SYNC_SCHEDULE` (default: daily at 3 AM UTC)
- **Dependencies:** MongoDB, Main Application

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GITLAB_TOKEN` | - | **Required** GitLab API token |
| `GROUP` | `nghis` | GitLab group to scan |
| `TAG` | `services` | Tag filter for projects |
| `BRANCHES` | `default` | Comma-separated list of branches |
| `MONGODB_USERNAME` | `admin` | MongoDB username |
| `MONGODB_PASSWORD` | `admin` | MongoDB password |
| `MONGODB_DATABASE` | `gitlab_cache` | MongoDB database name |
| `CACHE_TTL` | `24h` | Cache time-to-live |
| `SYNC_SCHEDULE` | `0 3 * * *` | Cron schedule for sync (daily at 3 AM) |
| `TZ` | `UTC` | Timezone for scheduler |

### Schedule Format

The `SYNC_SCHEDULE` uses standard cron format:
```
# ┌───────────── minute (0 - 59)
# │ ┌───────────── hour (0 - 23)
# │ │ ┌───────────── day of the month (1 - 31)
# │ │ │ ┌───────────── month (1 - 12)
# │ │ │ │ ┌───────────── day of the week (0 - 6) (Sunday to Saturday)
# │ │ │ │ │
# │ │ │ │ │
# * * * * *
```

Examples:
- `0 3 * * *` - Daily at 3:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 1` - Every Monday at midnight
- `0 2 1 * *` - First day of every month at 2:00 AM

## Production Deployment

For production, use the production compose file:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

This includes:
- Resource limits
- Health checks
- Proper service dependencies
- Optimized configurations

## Development

For development with local Go code:

1. **Start only MongoDB:**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Run application locally:**
   ```bash
   make run-api
   ```

## Monitoring

### Health Checks

- **Application:** `curl http://localhost:8080/health`
- **MongoDB:** Built-in health check in production mode

### Logs

View logs for all services:
```bash
docker-compose logs -f
```

View logs for specific service:
```bash
docker-compose logs -f gitlab-list
docker-compose logs -f scheduler
docker-compose logs -f mongodb
```

### Cache Management

The application provides cache management endpoints:
- `GET /api/cache/stats` - Cache statistics
- `POST /api/cache/refresh` - Manual cache refresh
- `POST /api/cache/clear` - Clear cache

## Troubleshooting

### Common Issues

1. **MongoDB port conflict (Port 27017 already in use):**
   ```bash
   # Check what's using port 27017
   lsof -i :27017
   
   # Use external MongoDB
   make docker-external-mongo
   
   # Or use custom port
   make docker-custom-port
   ```

2. **MongoDB connection failed:**
   - Check if MongoDB container is running: `docker-compose ps`
   - Check MongoDB logs: `docker-compose logs mongodb`
   - Verify credentials in `.env` file
   - For external MongoDB: verify `MONGODB_URI` is correct

3. **Scheduler not running:**
   - Check scheduler logs: `docker-compose logs scheduler`
   - Verify `SYNC_SCHEDULE` format
   - Check timezone setting

4. **GitLab API errors:**
   - Verify `GITLAB_TOKEN` is valid
   - Check GitLab API rate limits
   - Verify group and tag settings

5. **External MongoDB connection issues:**
   - Ensure MongoDB is accessible from Docker containers
   - Check firewall settings
   - Verify MongoDB authentication
   - Use `host.docker.internal` for local MongoDB on macOS/Windows

### Reset Everything

To start fresh:
```bash
docker-compose down -v
docker-compose up -d
```

This will remove all data and start fresh.

## Security Notes

- Change default MongoDB credentials in production
- Use environment files or secrets management
- Consider using Docker secrets for sensitive data
- Regularly update base images
