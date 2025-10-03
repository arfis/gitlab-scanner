// cmd/api/main.go
package main

import (
	"log"
	"net/http"
	"strings"

	"gitlab-list/internal/configuration"
	"gitlab-list/internal/handler"
	"gitlab-list/internal/repository"
	"gitlab-list/internal/service"
)

func main() {
	// Load configuration
	cfg, err := configuration.NewConfiguration()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}

	// Initialize repository
	gitlabRepo := repository.NewGitLabRepository(cfg)

	// Initialize MongoDB cache (optional)
	var mongoRepo *repository.MongoDBRepository
	if cfg.MongoDBURI != "" {
		var err error
		mongoURI := cfg.GetMongoDBURI()
		mongoRepo, err = repository.NewMongoDBRepository(mongoURI, cfg.MongoDBDatabase)
		if err != nil {
			log.Printf("Warning: Failed to connect to MongoDB: %v", err)
			log.Println("Continuing without caching...")
		} else {
			log.Println("MongoDB cache initialized successfully")
		}
	}

	// Hash-based cache system - no TTL needed

	// Initialize service
	var projectService *service.ProjectService
	if mongoRepo != nil {
		projectService = service.NewProjectServiceWithCache(gitlabRepo, mongoRepo)
		log.Println("Project service initialized with MongoDB caching")
	} else {
		projectService = service.NewProjectService(gitlabRepo)
		log.Println("Project service initialized without caching")
	}

	// Initialize handlers
	projectHandler := handler.NewProjectHandler(projectService)
	configHandler := handler.NewConfigHandler()

	// Setup routes
	mux := http.NewServeMux()

	// Health check (highest priority)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// API routes
	mux.HandleFunc("/api/projects/search", projectHandler.SearchProjects)
	mux.HandleFunc("/api/projects/changed", projectHandler.GetChangedProjects)
	mux.HandleFunc("/api/projects/", projectHandler.GetProject)
	mux.HandleFunc("/api/libraries", projectHandler.GetLibraries)

	// Architecture routes
	mux.HandleFunc("/api/architecture", projectHandler.GetArchitecture)
	mux.HandleFunc("/api/architecture/full", projectHandler.GenerateFullArchitecture)
	mux.HandleFunc("/api/architecture/files", projectHandler.ListArchitectureFiles)
	mux.HandleFunc("/api/architecture/files/", projectHandler.GetArchitectureFile)

	// Test endpoint (first to test routing)
	mux.HandleFunc("/api/test", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Test endpoint called: %s %s", r.Method, r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"message": "test endpoint works"}`))
	})

	// Simple test endpoint
	mux.HandleFunc("/test", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Simple test works"))
	})

	// Cache management routes
	mux.HandleFunc("/api/cache/load", projectHandler.LoadInitialCache)
	mux.HandleFunc("/api/cache/refresh", projectHandler.RefreshCache)
	mux.HandleFunc("/api/cache/clear", projectHandler.ClearCache)
	mux.HandleFunc("/api/cache/stats", projectHandler.GetCacheStats)
	mux.HandleFunc("/api/cache/refresh-project", projectHandler.RefreshProjectCache)

	// Search routes
	mux.HandleFunc("/api/search/libraries", projectHandler.SearchLibraries)
	mux.HandleFunc("/api/search/go-versions", projectHandler.SearchGoVersions)
	mux.HandleFunc("/api/search/library-versions", projectHandler.SearchLibraryVersions)
	mux.HandleFunc("/api/search/modules", projectHandler.SearchModules)

	// Webhook routes
	mux.HandleFunc("/api/webhook/gitlab", projectHandler.GitLabWebhook)

	// Test routes
	mux.HandleFunc("/api/test/cache", projectHandler.TestCache)

	log.Println("Cache routes registered: /api/cache/load, /api/cache/refresh, /api/cache/clear, /api/cache/stats, /api/cache/refresh-project")
	log.Println("Search routes registered: /api/search/libraries, /api/search/go-versions, /api/search/library-versions, /api/search/modules")
	log.Println("Webhook routes registered: /api/webhook/gitlab")

	// Configuration routes
	mux.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			configHandler.SaveConfig(w, r)
		} else if r.Method == http.MethodGet {
			configHandler.GetConfig(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/config/test", configHandler.TestConnection)

	// Static file server for web assets - only handle non-API routes
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Don't serve static files for API routes
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		// Serve static files for all other routes
		http.FileServer(http.Dir("./web/")).ServeHTTP(w, r)
	})

	// Start server
	port := cfg.Port
	if port == "" {
		port = "8080"
	}
	log.Printf("Starting API server on :%s", port)
	log.Printf("Web interface available at: http://localhost:%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
