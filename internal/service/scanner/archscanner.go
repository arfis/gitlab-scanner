// scanner/arch_scanner.go
package scanner

import (
	"fmt"
	"gitlab-list/internal/service/graph"
	"path/filepath"
	"regexp"
	"strings"

	"gitlab-list/internal/configuration"

	"golang.org/x/mod/modfile"
)

type ArchScanner struct {
	cfg     *configuration.Configuration
	ref     string
	ignores []string
	roots   []string // only scan these dir prefixes in repo; default: cmd,internal,pkg
}

func NewArchScanner(cfg *configuration.Configuration) *ArchScanner {
	return &ArchScanner{cfg: cfg, roots: []string{"cmd", "internal", "pkg"}}
}

func (s *ArchScanner) SetRef(ref string) *ArchScanner {
	s.ref = ref
	return s
}
func (s *ArchScanner) SetIgnore(ignores ...string) *ArchScanner {
	s.ignores = append([]string{}, ignores...)
	return s
}
func (s *ArchScanner) SetRoots(roots ...string) *ArchScanner {
	if len(roots) > 0 {
		s.roots = append([]string{}, roots...)
	}
	return s
}

func (s *ArchScanner) ScanGraph() (*graph.Graph, error) {
	g := &graph.Graph{Nodes: []graph.Node{}, Edges: []graph.Edge{}}
	projects := GetProjects(*s.cfg)

	// Handy indexers
	nodeIdx := map[string]bool{}
	addNode := func(id string, t graph.NodeType, meta map[string]string) {
		if !nodeIdx[id] {
			g.Nodes = append(g.Nodes, graph.Node{ID: id, Type: t, Meta: meta})
			nodeIdx[id] = true
		}
	}
	addEdge := func(e graph.Edge) {
		g.Edges = append(g.Edges, e)
	}

	for _, p := range projects {
		fmt.Printf("Scanning project %s", p.Name)
		if shouldIgnore(p.Path, s.ignores) {
			continue
		}
		goMod := GetGoMod(*s.cfg, p.ID, p.Name, s.ref)
		if len(goMod) == 0 {
			continue
		}

		// service
		mod, serviceShort := parseModuleID(goMod) // "git.prosoftke.sk/nghis/services/drg", "drg"
		svcID := "svc:" + serviceShort
		addNode(svcID, graph.NodeService, map[string]string{
			"module": mod,
			"path":   p.Path,
			"label":  serviceShort, // used by Mermaid writer
		})

		// --- Dependencies via go.mod (treat ALL requires as clients)
		reqs, _ := parseRequiresEffective(goMod) // keep replace support
		for mpath, ver := range reqs {
			if !isClientModule(mpath) {
				continue // skip normal libraries
			}

			depID := "dep:" + mpath
			addNode(depID, graph.NodeClient, map[string]string{
				"module": mpath,
				"label":  deriveClientLabel(mpath), // e.g. "nghisclinicalclient/v2"
			})
			addEdge(graph.Edge{
				From:     svcID, // svcID like "svc:drg"
				To:       depID,
				Rel:      "calls", // or "depends"
				Version:  ver,
				Evidence: []graph.Evidence{{Hint: "require go.mod"}},
			})
		}

		// --- Kafka topics via grep-like scanning
		s.scanKafkaArch()
	}
	return g, nil
}

func (s *ArchScanner) scanKafkaArch() {
	//files := internal.ListRepoFiles(*s.cfg, p.ID, s.ref) // returns []internal.File {Path string, Type string}
	//for _, f := range files {
	//	if f.Type != "blob" || !strings.HasSuffix(f.Path, ".go") {
	//		continue
	//	}
	//	if !s.withinRoots(f.Path) {
	//		continue
	//	}
	//	if shouldIgnore(f.Path, s.ignores) {
	//		continue
	//	}
	//	src := internal.GetRawFileBytes(*s.cfg, p.ID, f.Path, s.ref)
	//	if len(src) == 0 {
	//		continue
	//	}
	//	// produce topic
	//	for _, mt := range findKafkaProducerTopics(src) {
	//		topicID := "topic:" + mt.Name
	//		addNode(topicID, graph.NodeTopic, nil)
	//		addEdge(graph.Edge{
	//			From: serviceID, To: topicID, Rel: "produces",
	//			Evidence: []graph.Evidence{{File: f.Path, Line: mt.Line, Hint: mt.Hint}},
	//		})
	//	}
	//	// consume topic
	//	for _, mt := range findKafkaConsumerTopics(src) {
	//		topicID := "topic:" + mt.Name
	//		addNode(topicID, graph.NodeTopic, nil)
	//		addEdge(graph.Edge{
	//			From: topicID, To: serviceID, Rel: "consumes",
	//			Evidence: []graph.Evidence{{File: f.Path, Line: mt.Line, Hint: mt.Hint}},
	//		})
	//	}
	//}
}

func (s *ArchScanner) withinRoots(path string) bool {
	if len(s.roots) == 0 {
		return true
	}
	for _, r := range s.roots {
		if strings.HasPrefix(path, r+"/") || path == r || strings.HasPrefix(path, filepath.ToSlash(r)+"/") {
			return true
		}
	}
	return false
}

func parseModuleID(goMod []byte) (modulePath, serviceID string) {
	f, err := modfile.Parse("go.mod", goMod, nil)
	if err != nil || f.Module == nil {
		return "", ""
	}
	mp := f.Module.Mod.Path
	parts := strings.Split(mp, "/")
	return mp, parts[len(parts)-1]
}

// --- Kafka detectors (very lightweight)
type match struct {
	Name string
	Line int
	Hint string
}

var (
	reTopicKV     = regexp.MustCompile(`(?m)Topic:\s*"(.*?)"`)
	reProduceCall = regexp.MustCompile(`(?m)\.(?:Produce|Send)\s*\(\s*context?.*?,\s*"(.*?)"`)
	reSubscribe   = regexp.MustCompile(`(?m)Subscribe\s*\(\s*"(.*?)"`)
	reTopicsSlice = regexp.MustCompile(`(?m)Topics:\s*\[\]\s*string\s*\{([^}]*)\}`)
	reStringLit   = regexp.MustCompile(`"(.*?)"`)
)

func findKafkaProducerTopics(src []byte) (out []match) {
	lines := strings.Split(string(src), "\n")
	for i, ln := range lines {
		if m := reTopicKV.FindStringSubmatch(ln); len(m) == 2 {
			out = append(out, match{Name: m[1], Line: i + 1, Hint: "ProducerConfig.Topic"})
		}
		if m := reProduceCall.FindStringSubmatch(ln); len(m) == 2 {
			out = append(out, match{Name: m[1], Line: i + 1, Hint: ".Produce/.Send"})
		}
	}
	return
}

func findKafkaConsumerTopics(src []byte) (out []match) {
	text := string(src)
	lines := strings.Split(text, "\n")
	for i, ln := range lines {
		if m := reSubscribe.FindStringSubmatch(ln); len(m) == 2 {
			out = append(out, match{Name: m[1], Line: i + 1, Hint: "Subscribe"})
		}
		if m := reTopicsSlice.FindStringSubmatch(ln); len(m) == 2 {
			inner := m[1]
			all := reStringLit.FindAllStringSubmatch(inner, -1)
			for _, s := range all {
				if len(s) == 2 {
					out = append(out, match{Name: s[1], Line: i + 1, Hint: "ConsumerConfig.Topics"})
				}
			}
		}
	}
	return
}

// put this near your scanner struct or as a package var
var clientRe = regexp.MustCompile(`^git\.prosoftke\.sk/nghis/openapi/clients/go/[^/]+(?:/v\d+)?$`)

// helper
func isClientModule(path string) bool {
	// strict org-specific match:
	return clientRe.MatchString(path)
	// If you want looser match, comment line above and use:
	// return strings.Contains(path, "/openapi/clients/go/")
}
