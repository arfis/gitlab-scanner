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
	@echo "  start       - Start server and open browser (auto-start)"
	@echo "  dev         - Development mode (start with auto-reload)"
	@echo "  tidy        - Tidy go modules"

# Build all binaries
build:
	go build -o bin/api cmd/api/main.go
	go build -o bin/archmap cmd/archmap/main.go
	go build -o bin/scanner cmd/scanner/main.go

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
