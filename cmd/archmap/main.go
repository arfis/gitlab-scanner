// cmd/archmap/main.go
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"gitlab-list/internal/configuration"
	"gitlab-list/internal/service/graph"
	"gitlab-list/internal/service/scanner"
	"io"
	"os"
	"regexp"
	"strings"
)

func main() {
	// ----- flags / env -----
	var (
		ref     string
		mod     string
		radius  int
		ignores string
	)
	flag.StringVar(&ref, "ref", getenv("REF", ""), "Git ref (branch/commit) to scan (default: repo default branch)")
	flag.StringVar(&mod, "module", getenv("MODULE", ""), "Module/service to focus on (e.g., drg or full module path)")
	flag.IntVar(&radius, "radius", getenvInt("RADIUS", 1), "Neighborhood radius from the selected node (ignored if no module)")
	flag.StringVar(&ignores, "ignore", getenv("IGNORE", "archived,sandbox"), "Comma-separated substrings to ignore in project path")
	flag.Parse()

	cfg, err := configuration.NewConfiguration()
	if err != nil {
		panic(err)
	}

	// ----- build full graph -----
	arch, err := scanner.NewArchScanner(cfg).
		SetRef(ref).
		SetIgnore(splitCSV(ignores)...).
		ScanGraph()
	if err != nil {
		panic(err)
	}

	// ----- focus or full -----
	var fg *graph.Graph
	var base string
	if strings.TrimSpace(mod) == "" {
		// no module -> dump full graph
		fg = arch
		base = "full"
	} else {
		// module set -> focus view
		targetID := resolveTargetNodeID(arch, mod)
		if targetID == "" {
			panic(fmt.Sprintf("could not find node for module %q", mod))
		}
		fg = filterGraphByRadius(arch, targetID, radius)
		base = sanitizeFileBase(mod)
	}

	// ----- write JSON -----
	jsonPath := fmt.Sprintf("%s-arch.json", base)
	if f, err := os.Create(jsonPath); err == nil {
		_ = json.NewEncoder(f).Encode(fg)
		_ = f.Close()
	} else {
		panic(err)
	}

	// ----- write Mermaid (safe IDs) -----
	mmdPath := fmt.Sprintf("%s-arch.mmd", base)
	if f, err := os.Create(mmdPath); err == nil {
		writeMermaid(f, fg)
		_ = f.Close()
	} else {
		panic(err)
	}

	fmt.Printf("Wrote %s and %s (module=%q, radius=%d)\n", jsonPath, mmdPath, mod, radius)
}

// ---------- selection / filtering ----------

// resolveTargetNodeID tries to find a node by:
// 1) exact module path (node.Meta["module"])
// 2) exact node ID
// 3) last segment of provided path vs. label/module/id (namespace stripped)
func resolveTargetNodeID(g *graph.Graph, query string) string {
	q := strings.TrimSpace(query)
	if q == "" {
		return ""
	}

	// 1) exact module path
	for _, n := range g.Nodes {
		if n.Meta != nil && n.Meta["module"] == q {
			return n.ID
		}
	}

	// 2) exact ID
	for _, n := range g.Nodes {
		if n.ID == q {
			return n.ID
		}
	}

	// 3) last segment matches
	short := lastSeg(q)
	for _, n := range g.Nodes {
		// prefer explicit label
		if n.Meta != nil && n.Meta["label"] != "" && lastSeg(n.Meta["label"]) == short {
			return n.ID
		}
		// module last segment
		if n.Meta != nil && n.Meta["module"] != "" && lastSeg(n.Meta["module"]) == short {
			return n.ID
		}
		// id last segment with namespace stripped (e.g., "svc:drg" -> "drg")
		if lastSeg(stripNamespace(n.ID)) == short {
			return n.ID
		}
	}
	return ""
}

func stripNamespace(id string) string {
	if i := strings.IndexByte(id, ':'); i >= 0 && i+1 < len(id) {
		return id[i+1:]
	}
	return id
}

func lastSeg(s string) string {
	if i := strings.LastIndex(s, "/"); i >= 0 && i+1 < len(s) {
		return s[i+1:]
	}
	return s
}

// BFS-style neighborhood filter up to N hops (treat edges as undirected for reachability).
func filterGraphByRadius(g *graph.Graph, center string, radius int) *graph.Graph {
	if radius < 0 {
		radius = 0
	}
	adj := map[string]map[string]bool{}
	add := func(a, b string) {
		if adj[a] == nil {
			adj[a] = map[string]bool{}
		}
		adj[a][b] = true
	}
	for _, e := range g.Edges {
		add(e.From, e.To)
		add(e.To, e.From)
	}

	keep := map[string]bool{center: true}
	frontier := map[string]bool{center: true}
	for hop := 0; hop < radius; hop++ {
		next := map[string]bool{}
		for v := range frontier {
			for nb := range adj[v] {
				if !keep[nb] {
					keep[nb] = true
					next[nb] = true
				}
			}
		}
		frontier = next
		if len(frontier) == 0 {
			break
		}
	}

	var nodes []graph.Node
	for _, n := range g.Nodes {
		if keep[n.ID] {
			nodes = append(nodes, n)
		}
	}
	var edges []graph.Edge
	for _, e := range g.Edges {
		if keep[e.From] && keep[e.To] {
			edges = append(edges, e)
		}
	}
	return &graph.Graph{Nodes: nodes, Edges: edges}
}

// ---------- Mermaid writer (safe IDs, uses Meta["label"]) ----------

func writeMermaid(w io.Writer, g *graph.Graph) {
	// collect originals
	var originals []string
	for _, n := range g.Nodes {
		originals = append(originals, n.ID)
	}
	idMap := buildIDMap(originals)

	fmt.Fprintln(w, "flowchart LR")

	// nodes
	for _, n := range g.Nodes {
		id := idMap[n.ID] // SAFE id
		label := nodeLabel(n)
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
		fmt.Fprintf(w, "  %s -- %s --> %s\n", from, lbl, to)
	}
}

// Prefer Meta["label"] for display; fall back sensibly.
func nodeLabel(n graph.Node) string {
	if n.Meta != nil && n.Meta["label"] != "" {
		switch n.Type {
		case "service":
			return "🧩 " + n.Meta["label"]
		case "client":
			return "📦 " + n.Meta["label"]
		case "topic":
			return "🛰 " + n.Meta["label"]
		}
	}
	// fallback: use ID (namespace stripped)
	base := stripNamespace(n.ID)
	switch n.Type {
	case "service":
		return "🧩 " + base
	case "client":
		return "📦 " + base
	case "topic":
		return "🛰 " + base
	default:
		return base
	}
}

// ---------- utils ----------

var invalidID = regexp.MustCompile(`[^A-Za-z0-9_-]`)
var invalidFile = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

func sanitizeID(id string) string {
	s := invalidID.ReplaceAllString(id, "_")
	if s == "" {
		return "node"
	}
	// avoid starting with a digit
	if s[0] >= '0' && s[0] <= '9' {
		s = "_" + s
	}
	return s
}

// unique, stable map from original IDs to Mermaid-safe IDs
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

func sanitizeFileBase(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, string(os.PathSeparator), "-")
	s = strings.ReplaceAll(s, "/", "-")
	s = invalidFile.ReplaceAllString(s, "-")
	if s == "" {
		return "arch"
	}
	return s
}

func splitCSV(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
func getenvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		var x int
		if _, err := fmt.Sscanf(v, "%d", &x); err == nil {
			return x
		}
	}
	return def
}
