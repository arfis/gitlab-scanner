package scanner

import (
	"strings"

	"golang.org/x/mod/modfile"
)

// shouldIgnore reports whether any ignore substring is contained in the path (case-insensitive).
func shouldIgnore(path string, ignores []string) bool {
	lp := strings.ToLower(path)
	for _, ig := range ignores {
		if ig == "" {
			continue
		}
		if strings.Contains(lp, strings.ToLower(ig)) {
			return true
		}
	}
	return false
}

// parseRequireBytes parses go.mod bytes and returns map[modulePath]version.
func parseRequireBytes(goMod []byte) (map[string]string, error) {
	f, err := modfile.Parse("go.mod", goMod, nil)
	if err != nil {
		return nil, err
	}
	out := make(map[string]string, len(f.Require))
	for _, r := range f.Require {
		out[r.Mod.Path] = r.Mod.Version
	}
	return out, nil
}

// parseGoVersionBytes returns the "go" directive version (e.g., "1.22.3") from go.mod bytes.
func parseGoVersionBytes(goMod []byte) (string, error) {
	f, err := modfile.Parse("go.mod", goMod, nil)
	if err != nil {
		return "", err
	}
	if f.Go != nil && f.Go.Version != "" {
		return f.Go.Version, nil
	}
	return "", nil
}

// deriveClientLabel tries to extract a friendly "clientName/vN" from a module path like
// ".../openapi/clients/go/nghisclinicalclient/v2". Falls back to the full module path.
func deriveClientLabel(modulePath string) string {
	parts := strings.Split(modulePath, "/")
	for i := 0; i < len(parts)-2; i++ {
		if parts[i] == "openapi" && i+2 < len(parts) && parts[i+1] == "clients" && parts[i+2] == "go" {
			name := ""
			verDir := ""
			if i+3 < len(parts) {
				name = parts[i+3]
			}
			if i+4 < len(parts) && strings.HasPrefix(parts[i+4], "v") {
				verDir = parts[i+4]
			}
			if name != "" && verDir != "" {
				return name + "/" + verDir
			}
			if name != "" {
				return name
			}
			break
		}
	}
	return modulePath
}

// parseRequiresEffective reads go.mod bytes and returns the *effective* version per module,
// applying any `replace` directives that bump version or change path.
func parseRequiresEffective(goMod []byte) (map[string]string, error) {
	f, err := modfile.Parse("go.mod", goMod, nil)
	if err != nil {
		return nil, err
	}

	// Build a map of replacements: oldPath -> (newPath, newVersion, oldVersionMatcher)
	type repl struct{ newPath, newVer, oldVer string }
	replMap := map[string][]repl{}
	for _, r := range f.Replace {
		ov := r.Old.Version // may be empty (matches any)
		nv := r.New.Version // may be empty for local path replace
		replMap[r.Old.Path] = append(replMap[r.Old.Path], repl{
			newPath: r.New.Path,
			newVer:  nv,
			oldVer:  ov,
		})
	}

	out := make(map[string]string, len(f.Require))
	for _, r := range f.Require {
		path := r.Mod.Path
		ver := r.Mod.Version

		// Apply replace if present for this path (and version, if specified).
		if repls, ok := replMap[path]; ok {
			for _, rp := range repls {
				if rp.oldVer == "" || rp.oldVer == ver {
					// If newVer is empty, it’s a local path replace; keep version as-is but you may
					// want to annotate it in the printer.
					if rp.newVer != "" {
						ver = rp.newVer
					}
					// If path changed, you might also want to report rp.newPath; up to you.
					// path = rp.newPath
					break
				}
			}
		}
		out[path] = ver
	}
	return out, nil
}
