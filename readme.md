# GitLab List - Architecture Viewer

A tool for analyzing GitLab projects and their dependencies, with automatic synchronization capabilities.

## Features

- 🔍 **Project Discovery**: Search and analyze GitLab projects
- 🏗️ **Architecture Mapping**: Generate dependency graphs and architecture diagrams
- 📊 **OpenAPI Analysis**: Extract and analyze OpenAPI specifications
- 🔄 **Automatic Sync**: Scheduled synchronization with configurable timing
- 💾 **Caching**: MongoDB-based caching for improved performance
- 🐳 **Docker Support**: Full containerization with Docker Compose
- 📦 **Library Updates**: Update Go dependencies and create merge requests automatically

## Quick Start with Docker

1. **Clone and setup:**
   ```bash
   git clone <repository>
   cd gitlab-list
   cp env.example .env
   ```

2. **Configure your GitLab token in `.env`:**
   ```bash
   GITLAB_TOKEN=your_gitlab_token_here
   ```

3. **Start with Docker:**
   ```bash
   docker-compose up -d
   ```

4. **Access the application:**
   - Web Interface: http://localhost:8080
   - API: http://localhost:8080/api

For detailed Docker setup, see [DOCKER.md](DOCKER.md).

## Documentation

- 📖 [Library Updates Guide](LIBRARY-UPDATES.md) - How to update dependencies
- 🔑 [GitLab Token Permissions](GITLAB-TOKEN-PERMISSIONS.md) - Required token scopes and setup
- 🐳 [Docker Setup](DOCKER.md) - Container deployment guide

## Local Development

### Prerequisites
- Go 1.24+
- MongoDB (optional, for caching)

### Setup
1. **Install dependencies:**
   ```bash
   go mod download
   ```

2. **Configure environment:**
   ```bash
   cp env.example .env
   # Edit .env with your GitLab token
   ```

3. **Start MongoDB (optional):**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d mongodb
   ```

4. **Run the application:**
   ```bash
   make run-api
   ```

## Usage

### API Server
```bash
# Start the REST API server
make run-api
# or
go run cmd/api/main.go
```

### Architecture Mapping
```bash
# Full graph (no module):
go run ./cmd/archmap

# Focused (module by short name or full module path), radius 2:
go run ./cmd/archmap --module=drg --radius=2

# Pick a branch/ref and ignore some paths:
go run ./cmd/archmap --ref=develop --ignore=archived,sandbox
```

### Project Scanner
```bash
# Scan projects for specific client usage
go run cmd/scanner/main.go
```

### Scheduler Service
```bash
# Run automatic synchronization
make run-scheduler
# or
go run cmd/scheduler/main.go
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GITLAB_TOKEN` | - | **Required** GitLab API token |
| `GROUP` | `nghis` | GitLab group to scan |
| `TAG` | `services` | Tag filter for projects |
| `BRANCHES` | `default` | Comma-separated list of branches |
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `CACHE_TTL` | `24h` | Cache time-to-live |
| `SYNC_SCHEDULE` | `0 3 * * *` | Cron schedule for sync (daily at 3 AM) |
| `TZ` | `UTC` | Timezone for scheduler |

### Schedule Format

The `SYNC_SCHEDULE` uses standard cron format:
- `0 3 * * *` - Daily at 3:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 1` - Every Monday at midnight

## API Endpoints

- `GET /health` - Health check
- `GET /api/projects/search` - Search projects
- `GET /api/projects/openapi` - Projects with OpenAPI
- `GET /api/architecture` - Architecture data
- `POST /api/cache/refresh` - Manual cache refresh
- `GET /api/cache/stats` - Cache statistics

## Development

### Build
```bash
make build
```

### Test
```bash
make test
```

### Development Mode (with auto-reload)
```bash
make dev
```

## Docker Commands

```bash
# Development
docker-compose -f docker-compose.dev.yml up -d

# Production
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```