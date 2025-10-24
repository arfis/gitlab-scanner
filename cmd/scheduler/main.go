package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"gitlab-list/internal/configuration"
	"gitlab-list/internal/repository"
	"gitlab-list/internal/service"
)

func main() {
	log.Println("Starting GitLab List Scheduler...")

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

	// Initialize service
	var projectService *service.ProjectService
	if mongoRepo != nil {
		projectService = service.NewProjectServiceWithCache(gitlabRepo, mongoRepo)
		log.Println("Project service initialized with MongoDB caching")
	} else {
		projectService = service.NewProjectService(gitlabRepo)
		log.Println("Project service initialized without caching")
	}

	// Initialize scheduler
	scheduler := service.NewSchedulerService(projectService, cfg)

	// Start scheduler
	err = scheduler.Start()
	if err != nil {
		log.Fatal("Failed to start scheduler:", err)
	}

	log.Printf("Scheduler running with schedule: %s", scheduler.GetSchedule())
	log.Printf("Next run: %s", scheduler.GetNextRunTime().Format("2006-01-02 15:04:05 MST"))

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Println("Received interrupt signal, shutting down...")
	scheduler.Stop()
	log.Println("Scheduler stopped")
}
