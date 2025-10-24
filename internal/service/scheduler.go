package service

import (
	"log"
	"time"

	"gitlab-list/internal/configuration"

	"github.com/robfig/cron/v3"
)

// SchedulerService handles scheduled tasks
type SchedulerService struct {
	projectService *ProjectService
	cron           *cron.Cron
	config         *configuration.Configuration
}

// NewSchedulerService creates a new scheduler service
func NewSchedulerService(projectService *ProjectService, config *configuration.Configuration) *SchedulerService {
	// Create cron with timezone support
	location, err := time.LoadLocation(config.Timezone)
	if err != nil {
		log.Printf("Warning: Invalid timezone %s, using UTC: %v", config.Timezone, err)
		location = time.UTC
	}

	c := cron.New(cron.WithLocation(location))

	return &SchedulerService{
		projectService: projectService,
		cron:           c,
		config:         config,
	}
}

// Start starts the scheduler
func (s *SchedulerService) Start() error {
	log.Printf("Starting scheduler with schedule: %s (timezone: %s)", s.config.SyncSchedule, s.config.Timezone)

	// Add the sync job
	_, err := s.cron.AddFunc(s.config.SyncSchedule, s.syncJob)
	if err != nil {
		return err
	}

	// Start the cron scheduler
	s.cron.Start()

	log.Println("Scheduler started successfully")
	return nil
}

// Stop stops the scheduler
func (s *SchedulerService) Stop() {
	log.Println("Stopping scheduler...")
	s.cron.Stop()
	log.Println("Scheduler stopped")
}

// syncJob performs the synchronization task
func (s *SchedulerService) syncJob() {
	log.Println("Starting scheduled synchronization...")
	startTime := time.Now()

	// Perform cache refresh
	err := s.projectService.ClearExpiredCache()
	if err != nil {
		log.Printf("Error during scheduled sync: %v", err)
		return
	}

	duration := time.Since(startTime)
	log.Printf("Scheduled synchronization completed in %v", duration)
}

// GetNextRunTime returns the next scheduled run time
func (s *SchedulerService) GetNextRunTime() time.Time {
	entries := s.cron.Entries()
	if len(entries) > 0 {
		return entries[0].Next
	}
	return time.Time{}
}

// GetSchedule returns the current schedule
func (s *SchedulerService) GetSchedule() string {
	return s.config.SyncSchedule
}
