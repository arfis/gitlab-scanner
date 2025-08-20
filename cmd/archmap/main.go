// cmd/archmap/main.go
package main

import (
	"encoding/json"
	"fmt"
	"gitlab-list/internal/service/graph"
	"gitlab-list/internal/service/scanner"
	"io"
	"os"
	"regexp"

	"gitlab-list/internal"
)

func main() {
	cfg, err := internal.NewConfiguration()
	if err != nil {
		panic(err)
	}
	ref := os.Getenv("REF") // e.g., "main" or "develop"

	g, err := scanner.NewArchScanner(cfg).
		SetRef(ref).
		SetIgnore("archived", "sandbox").
		ScanGraph()
	if err != nil {
		panic(err)
	}

	// 1) JSON for machines
	f1, _ := os.Create("arch.json")
	_ = json.NewEncoder(f1).Encode(g)
	_ = f1.Close()

	// 2) Mermaid for humans (use the safe writer)
	f2, _ := os.Create("arch.mmd")
	defer f2.Close()
	writeMermaid(f2, g)
}

// ---------- Mermaid writer (safe IDs, no quotes on IDs) ----------

func writeMermaid(w io.Writer, g *graph.Graph) {
	// collect originals from nodes (edges should reference these)
	var originals []string
	for _, n := range g.Nodes {
		originals = append(originals, n.ID)
	}
	idMap := buildIDMap(originals)

	fmt.Fprintln(w, "flowchart LR")

	// nodes
	for _, n := range g.Nodes {
		id := idMap[n.ID] // SAFE id
		label := prettyNode(n.ID, n.Type)
		// Label can be quoted inside brackets
		fmt.Fprintf(w, "  %s[%q]\n", id, label)
	}

	// edges
	for _, e := range g.Edges {
		from := idMap[e.From]
		to := idMap[e.To]

		lbl := e.Rel
		if e.Version != "" && e.Rel == "calls" {
			lbl = fmt.Sprintf("%s (%s)", e.Rel, e.Version)
		}
		// IMPORTANT: do NOT quote IDs here
		fmt.Fprintf(w, "  %s -- %s --> %s\n", from, lbl, to)
	}
}

func prettyNode(id string, t graph.NodeType) string {
	switch t {
	case "service":
		return "🧩 " + id
	case "client":
		return "📦 " + id
	case "topic":
		return "🛰 " + id
	default:
		return id
	}
}

var invalidID = regexp.MustCompile(`[^A-Za-z0-9_-]`)

// sanitizeID makes a Mermaid-safe identifier (no spaces, no slashes, etc.)
// Also avoids starting with a digit by prefixing '_'.
func sanitizeID(id string) string {
	s := invalidID.ReplaceAllString(id, "_")
	if s == "" {
		return "node"
	}
	// Mermaid can be picky if the id starts with a digit.
	if s[0] >= '0' && s[0] <= '9' {
		s = "_" + s
	}
	return s
}

// buildIDMap returns a stable mapping from original IDs to unique sanitized IDs.
func buildIDMap(originals []string) map[string]string {
	m := make(map[string]string, len(originals))
	used := map[string]bool{}
	for _, o := range originals {
		base := sanitizeID(o)
		id := base
		i := 2
		for used[id] {
			id = fmt.Sprintf("%s_%d", base, i)
			i++
		}
		used[id] = true
		m[o] = id
	}
	return m
}
