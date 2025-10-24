# Makefile for gitlab-list project

.PHONY: help build test clean run-api run-archmap run-scanner start dev

# Default target
help:
	@echo "Available targets:"
	@echo "  build       - Build all binaries"
	@echo "  test        - Run tests"
	@echo "  clean       - Clean build artifacts"
	@echo "  run-api     - Run the REST API server"
	@echo "  run-archmap - Run architecture mapping"
	@echo "  run-scanner - Run project scanner"
	@echo "  run-scheduler - Run the scheduler service"
	@echo "  start       - Start server and open browser (auto-start)"
	@echo "  dev         - Development mode (start with auto-reload)"
	@echo "  tidy        - Tidy go modules"
	@echo "  docker-start - Start with Docker (production)"
	@echo "  docker-dev  - Start with Docker (development)"
	@echo "  docker-stop - Stop Docker services"
	@echo "  docker-logs - View Docker logs"
	@echo "  docker-external-mongo - Start with external MongoDB"
	@echo "  docker-custom-port - Start with custom MongoDB port"
	@echo "  docker-local-dns - Start with local domain (prosoft.gitscanner)"
	@echo "  docker-custom-domain - Start with custom port (no localhost conflicts)"
	@echo "  docker-dedicated-dns - Start with dedicated IP (advanced)"
	@echo "  docker-ultimate - Start with clean domain (no port numbers!)"
	@echo "  docker-simple-clean - Start with simple clean domain (port 8080)"
	@echo "  docker-fixed-domain - Start with fixed domain (direct backend)"
	@echo "  docker-clean-url - Start with clean URL (no port needed!)"
	@echo "  docker-dev-tool - Start as development tool (port 9090, clean URLs)"
	@echo "  setup-dns - Setup local DNS for prosoft.gitscanner"
	@echo "  setup-custom-dns - Setup custom port DNS (no localhost conflicts)"
	@echo "  setup-dedicated-dns - Setup dedicated IP DNS (advanced)"
	@echo "  setup-clean-dns - Setup clean domain (no port numbers!)"
	@echo "  setup-simple-clean - Setup simple clean domain (port 8080)"
	@echo "  setup-fixed-domain - Setup fixed domain (direct backend)"
	@echo "  setup-clean-url - Setup clean URL (no port needed!)"
	@echo "  setup-dev-tool - Setup development tool (port 9090, clean URLs)"

# Build all binaries
build:
	go build -o bin/api cmd/api/main.go
	go build -o bin/archmap cmd/archmap/main.go
	go build -o bin/scanner cmd/scanner/main.go
	go build -o bin/scheduler cmd/scheduler/main.go

# Run tests
test:
	go test -v ./...

# Run tests with coverage
test-coverage:
	go test -cover ./...

# Clean build artifacts
clean:
	rm -rf bin/
	rm -f *.json *.mmd

# Run the REST API server
run-api:
	go run cmd/api/main.go

# Run architecture mapping
run-archmap:
	go run cmd/archmap/main.go

# Run project scanner
run-scanner:
	go run cmd/scanner/main.go

# Run scheduler service
run-scheduler:
	go run cmd/scheduler/main.go

# Start server and open browser (auto-start)
start:
	@echo "🚀 Starting GitLab Architecture Viewer..."
	@if [ -f scripts/start.sh ]; then \
		chmod +x scripts/start.sh && ./scripts/start.sh; \
	else \
		echo "❌ Startup script not found. Please run: go run cmd/api/main.go"; \
	fi

# Development mode with auto-reload (requires air)
dev:
	@echo "🔧 Starting in development mode..."
	@if command -v air >/dev/null 2>&1; then \
		air -c .air.toml; \
	else \
		echo "⚠️  Air not installed. Installing air for auto-reload..."; \
		go install github.com/cosmtrek/air@latest; \
		air -c .air.toml; \
	fi

# Start with custom port
start-port:
	@echo "🚀 Starting with custom port..."
	@read -p "Enter port (default 8080): " port; \
	PORT=$${port:-8080} ./scripts/start.sh

# Tidy go modules
tidy:
	go mod tidy

# Install dependencies
deps:
	go mod download

# Install development tools
install-tools:
	@echo "📦 Installing development tools..."
	go install github.com/cosmtrek/air@latest
	@echo "✅ Development tools installed"

# Docker commands
docker-start:
	@echo "🐳 Starting GitLab List with Docker..."
	@if [ -f scripts/docker-start.sh ]; then \
		chmod +x scripts/docker-start.sh && ./scripts/docker-start.sh; \
	else \
		docker compose up -d; \
	fi

docker-dev:
	@echo "🔧 Starting development environment..."
	docker compose -f docker-compose.dev.yml up -d

docker-stop:
	@echo "🛑 Stopping Docker services..."
	docker compose down

docker-logs:
	@echo "📋 Viewing Docker logs..."
	docker compose logs -f

docker-build:
	@echo "🔨 Building Docker images..."
	docker compose build

docker-clean:
	@echo "🧹 Cleaning Docker resources..."
	docker compose down -v
	docker system prune -f

docker-external-mongo:
	@echo "🔗 Starting with external MongoDB..."
	docker compose -f docker-compose.external-mongo.yml up -d

docker-custom-port:
	@echo "🔧 Starting with custom MongoDB port (27018)..."
	docker compose -f docker-compose.custom-port.yml up -d

docker-local-dns:
	@echo "🌐 Starting with local domain (prosoft.gitscanner)..."
	docker compose -f docker-compose.nginx-proxy.yml up -d

setup-dns:
	@echo "🌐 Setting up local DNS..."
	@if [ -f scripts/setup-local-dns.sh ]; then \
		chmod +x scripts/setup-local-dns.sh && ./scripts/setup-local-dns.sh; \
	else \
		echo "❌ DNS setup script not found"; \
	fi

docker-custom-domain:
	@echo "🌐 Starting with custom port (no localhost conflicts)..."
	docker compose -f docker-compose.custom-domain.yml up -d

docker-dedicated-dns:
	@echo "🌐 Starting with dedicated IP (advanced)..."
	docker compose -f docker-compose.dedicated-dns.yml up -d

setup-custom-dns:
	@echo "🌐 Setting up custom port DNS..."
	@if [ -f scripts/setup-custom-port-dns.sh ]; then \
		chmod +x scripts/setup-custom-port-dns.sh && ./scripts/setup-custom-port-dns.sh; \
	else \
		echo "❌ Custom DNS setup script not found"; \
	fi

setup-dedicated-dns:
	@echo "🌐 Setting up dedicated IP DNS..."
	@if [ -f scripts/setup-dedicated-dns.sh ]; then \
		chmod +x scripts/setup-dedicated-dns.sh && ./scripts/setup-dedicated-dns.sh; \
	else \
		echo "❌ Dedicated DNS setup script not found"; \
	fi

docker-ultimate:
	@echo "🚀 Starting with ultimate clean domain (no port numbers!)..."
	docker compose -f docker-compose.ultimate.yml up -d

setup-clean-dns:
	@echo "🌐 Setting up clean domain DNS..."
	@if [ -f scripts/setup-clean-dns.sh ]; then \
		chmod +x scripts/setup-clean-dns.sh && ./scripts/setup-clean-dns.sh; \
	else \
		echo "❌ Clean DNS setup script not found"; \
	fi

docker-simple-clean:
	@echo "🚀 Starting with simple clean domain (port 8080)..."
	docker compose -f docker-compose.simple-clean.yml up -d

setup-simple-clean:
	@echo "🌐 Setting up simple clean domain DNS..."
	@if [ -f scripts/setup-simple-clean.sh ]; then \
		chmod +x scripts/setup-simple-clean.sh && ./scripts/setup-simple-clean.sh; \
	else \
		echo "❌ Simple clean DNS setup script not found"; \
	fi

docker-fixed-domain:
	@echo "🔧 Starting with fixed domain (direct backend)..."
	docker compose -f docker-compose.fixed-domain.yml up -d

setup-fixed-domain:
	@echo "🌐 Setting up fixed domain DNS..."
	@if [ -f scripts/setup-fixed-domain.sh ]; then \
		chmod +x scripts/setup-fixed-domain.sh && ./scripts/setup-fixed-domain.sh; \
	else \
		echo "❌ Fixed domain DNS setup script not found"; \
	fi

docker-clean-url:
	@echo "🌐 Starting with clean URL (no port needed)..."
	docker compose -f docker-compose.clean-url.yml up -d

setup-clean-url:
	@echo "🌐 Setting up clean URL DNS..."
	@if [ -f scripts/setup-clean-url.sh ]; then \
		chmod +x scripts/setup-clean-url.sh && ./scripts/setup-clean-url.sh; \
	else \
		echo "❌ Clean URL DNS setup script not found"; \
	fi

docker-dev-tool:
	@echo "🛠️  Starting as development tool (port 9090, clean URLs)..."
	docker compose -f docker-compose.dev-tool.yml up -d

setup-dev-tool:
	@echo "🛠️  Setting up development tool DNS..."
	@if [ -f scripts/setup-dev-tool.sh ]; then \
		chmod +x scripts/setup-dev-tool.sh && ./scripts/setup-dev-tool.sh; \
	else \
		echo "❌ Dev tool DNS setup script not found"; \
	fi
