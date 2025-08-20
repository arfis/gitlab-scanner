package scanner

import (
	"fmt"
	"gitlab-list/internal"
	"log"

	"golang.org/x/mod/semver"
)

type Scanner interface {
	Scan()
}

type GoScanner struct {
	minimalVersion string
	cfg            *internal.Configuration
	ignores        []string
}

func NewGoScanner(cfg *internal.Configuration) *GoScanner {
	return &GoScanner{cfg: cfg}
}

func (s *GoScanner) SetParams(minimalVersion string) *GoScanner {
	s.minimalVersion = minimalVersion
	return s
}

func (s *GoScanner) SetIgnore(ignores ...string) *GoScanner {
	s.ignores = append([]string{}, ignores...)
	return s
}

func (s *GoScanner) Scan() {
	if s.minimalVersion == "" {
		return
	}
	projects := internal.GetProjects(*s.cfg)

	for _, project := range projects {
		if shouldIgnore(project.Path, s.ignores) {
			continue
		}

		goMod := internal.GetGoMod(*s.cfg, project.ID, project.Name) // []byte
		if len(goMod) == 0 {
			continue
		}

		goVersion, err := parseGoVersionBytes(goMod)
		if err != nil {
			log.Printf("parse go.mod failed for %s: %v", project.Path, err)
			continue
		}
		if goVersion == "" {
			log.Printf("Could not find Go version in %s", project.Path)
			continue
		}

		// semver.Compare expects a leading "v"
		if semver.Compare("v"+goVersion, "v"+s.minimalVersion) < 0 {
			fmt.Printf("%s : %s\n", project.Name, goVersion)
		}
	}
}
