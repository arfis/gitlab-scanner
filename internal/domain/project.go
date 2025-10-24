// internal/domain/project.go
package domain

import "time"

// Project represents a GitLab project
type Project struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Path        string    `json:"path_with_namespace"`
	WebURL      string    `json:"web_url,omitempty"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
	UpdatedAt   time.Time `json:"updated_at,omitempty"`
	GoVersion   string    `json:"go_version,omitempty"`
	Libraries   []Library `json:"libraries,omitempty"`
	OpenAPI     *OpenAPI  `json:"openapi,omitempty"`
}

// Library represents a Go module dependency
type Library struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Path    string `json:"path,omitempty"`
}

// OpenAPI represents OpenAPI specification data
type OpenAPI struct {
	Content string `json:"content"` // Raw YAML content
	Path    string `json:"path"`    // File path in repository
	Found   bool   `json:"found"`   // Whether OpenAPI file was found
}

// SearchCriteria represents search parameters for projects
type SearchCriteria struct {
	GoVersion           string `json:"go_version,omitempty"`
	GoVersionComparison string `json:"go_version_comparison,omitempty"`
	Library             string `json:"library,omitempty"`
	Version             string `json:"version,omitempty"`
	VersionComparison   string `json:"version_comparison,omitempty"`
	Group               string `json:"group,omitempty"`
	Tag                 string `json:"tag,omitempty"`
}
