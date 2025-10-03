// internal/repository/interfaces.go
package repository

import "gitlab-list/internal/domain"

// ProjectRepository defines the interface for project data access
type ProjectRepository interface {
	GetProjects() ([]domain.Project, error)
	GetProjectDetails(projectID int, ref string) (*domain.Project, error)
	GetGroup() string
	GetTag() string
}
