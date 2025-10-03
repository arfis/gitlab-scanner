// internal/domain/graph.go
package domain

// Node represents a node in the dependency graph
type Node struct {
	ID    string            `json:"id"`
	Type  string            `json:"type"`
	Label string            `json:"label,omitempty"`
	Meta  map[string]string `json:"meta,omitempty"`
}

// Edge represents an edge in the dependency graph
type Edge struct {
	From    string `json:"from"`
	To      string `json:"to"`
	Rel     string `json:"rel"`
	Version string `json:"version,omitempty"`
}

// Graph represents a dependency graph
type Graph struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}
