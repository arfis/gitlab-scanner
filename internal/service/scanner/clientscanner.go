package scanner

import (
	"fmt"
	"gitlab-list/internal"
	"strings"
)

type ClientScanner struct {
	cfg           *internal.Configuration
	prefixes      []string // module path prefixes that mark "clients"
	ignores       []string // substrings to ignore in project path
	printFullPath bool
}

func NewClientScanner(cfg *internal.Configuration) *ClientScanner {
	return &ClientScanner{cfg: cfg}
}

func (s *ClientScanner) SetPrefixes(prefixes ...string) *ClientScanner {
	s.prefixes = append([]string{}, prefixes...)
	return s
}

func (s *ClientScanner) SetIgnore(ignores ...string) *ClientScanner {
	s.ignores = append([]string{}, ignores...)
	return s
}

func (s *ClientScanner) SetPrintFullPath(v bool) *ClientScanner {
	s.printFullPath = v
	return s
}

func (s *ClientScanner) Scan() {
	projects := internal.GetProjects(*s.cfg)

	for _, project := range projects {
		if shouldIgnore(project.Path, s.ignores) {
			continue
		}

		goMod := internal.GetGoMod(*s.cfg, project.ID, project.Name)
		if len(goMod) == 0 {
			continue
		}

		reqs, err := parseRequireBytes(goMod)
		if err != nil {
			// If parsing fails, just skip this project; or log if you prefer.
			continue
		}

		for modPath, modVersion := range reqs {
			if !s.matchesAnyPrefix(modPath) {
				continue
			}
			label := deriveClientLabel(modPath)
			if s.printFullPath {
				fmt.Printf("%s : %s -> %s (module: %s)\n", project.Name, label, modVersion, modPath)
			} else {
				fmt.Printf("%s : %s -> %s\n", project.Name, label, modVersion)
			}
		}
	}
}

// todo: for now it is locked to this openapi/clients/go
func (s *ClientScanner) matchesAnyPrefix(modulePath string) bool {
	if len(s.prefixes) == 0 {
		// Sensible default: anything under openapi/clients/go is a "client".
		return strings.Contains(modulePath, "/openapi/clients/go/")
	}
	for _, p := range s.prefixes {
		if strings.HasPrefix(modulePath, p) {
			return true
		}
	}
	return false
}
