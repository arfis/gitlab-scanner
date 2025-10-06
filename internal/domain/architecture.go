// internal/domain/architecture.go
package domain

import "time"

// ArchitectureResponse represents the response for architecture generation
type ArchitectureResponse struct {
	Graph       *Graph    `json:"graph"`
	Mermaid     string    `json:"mermaid"`
	Module      string    `json:"module"`
	Radius      int       `json:"radius"`
	Ref         string    `json:"ref"`
	GeneratedAt time.Time `json:"generated_at"`
	Libraries   []ArchitectureLibrary `json:"libraries,omitempty"`
}

// ArchitectureLibrary describes a dependency included in the architecture graph.
type ArchitectureLibrary struct {
	Module  string `json:"module"`
	Label   string `json:"label,omitempty"`
	Version string `json:"version,omitempty"`
}

// ArchitectureFile represents a saved architecture file
type ArchitectureFile struct {
	Filename   string    `json:"filename"`
	Size       int64     `json:"size"`
	ModifiedAt time.Time `json:"modified_at"`
	Type       string    `json:"type"` // json or mermaid
	Module     string    `json:"module,omitempty"`
	Radius     int       `json:"radius,omitempty"`
}
