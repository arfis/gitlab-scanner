package graph

type NodeType string

const (
	NodeService NodeType = "service"
	NodeClient  NodeType = "client"
	NodeTopic   NodeType = "topic"
)

type Node struct {
	ID   string            `json:"id"`   // unique key (e.g., "drg", "nghisclinicalclient/v2", "topic:orders.created")
	Type NodeType          `json:"type"` // service|client|topic
	Meta map[string]string `json:"meta,omitempty"`
}

type Evidence struct {
	File string `json:"file,omitempty"`
	Line int    `json:"line,omitempty"`
	Hint string `json:"hint,omitempty"` // e.g., "require go.mod", "kafka.ProducerConfig{Topic:...}"
}

type Edge struct {
	From     string     `json:"from"`
	To       string     `json:"to"`
	Rel      string     `json:"rel"`               // "calls", "produces", "consumes"
	Version  string     `json:"version,omitempty"` // client version, if any
	Evidence []Evidence `json:"evidence,omitempty"`
}

type Graph struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}
