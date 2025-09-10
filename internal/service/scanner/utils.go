package scanner

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"gitlab-list/internal/configuration"

	"golang.org/x/mod/modfile"
)

const gitlabAPI = "https://git.prosoftke.sk/api/v4"

type Project struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Path string `json:"path_with_namespace"`
}

func GetProjects(cfg configuration.Configuration) []Project {

	var projects []Project
	page := 1

	for {
		//groupPath := "nghis/services"
		groupPath := "nghis"
		escaped := url.PathEscape(groupPath) // results in "nghis%2Fservices"

		url := fmt.Sprintf("%s/groups/%s/projects?include_subgroups=true&per_page=100&page=%d", gitlabAPI, escaped, page)
		resp, err := GitlabRequest(cfg.Token, url)
		defer resp.Body.Close()

		if err != nil {
			log.Printf("There was a problem getting the data")
			return nil
		}
		var pageProjects []Project
		if err = json.NewDecoder(resp.Body).Decode(&pageProjects); err != nil {
			log.Fatalf("Failed to parse projects: %v", err)
		}

		if len(pageProjects) == 0 {
			break
		}

		projects = append(projects, pageProjects...)
		if len(pageProjects) < 100 {
			break
		}
		page++
	}

	return projects
}

// internal/gitlab.go (or wherever GetGoMod lives)
func GetGoMod(cfg configuration.Configuration, projectID int, projectName string, ref ...string) []byte {
	u := fmt.Sprintf("%s/projects/%d/repository/files/%s/raw", gitlabAPI, projectID, url.PathEscape("go.mod"))
	if len(ref) > 0 && ref[0] != "" {
		u += "?ref=" + url.QueryEscape(ref[0])
	}
	resp, err := GitlabRequest(cfg.Token, u)
	defer func() {
		if resp != nil {
			resp.Body.Close()
		}
	}()
	if err != nil {
		return nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read go.mod for %s: %v", projectName, err)
		return nil
	}
	return body
}

//func ExtractModuleVersion(data []byte, module string) string {
//	f, err := modfile.Parse("go.mod", data, nil)
//	if err != nil {
//		log.Printf("Failed to parse go.mod: %v", err)
//		return ""
//	}
//
//	for _, r := range f.Require {
//		if r.Mod.Path == module {
//			return r.Mod.Version
//		}
//	}
//	return ""
//}

func GitlabRequest(token, url string) (*http.Response, error) {
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("PRIVATE-TOKEN", token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, errors.New(fmt.Sprintf("Request failed: %v", err))

	}

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, errors.New(fmt.Sprintf("GitLab error: %s\nResponse: %s", resp.Status, string(body)))
	}
	return resp, nil
}

func ExtractGoVersion(data []byte) string {
	f, err := modfile.Parse("go.mod", data, nil)
	if err != nil {
		log.Printf("Failed to parse go.mod: %v", err)
		return ""
	}
	return f.Go.Version
}

// File represents an entry from the GitLab repository tree API.
type File struct {
	ID   string `json:"id,omitempty"`
	Path string `json:"path"`
	Type string `json:"type"` // "blob" (file) or "tree" (directory)
	Name string `json:"name,omitempty"`
	Mode string `json:"mode,omitempty"`
}

// ListRepoFiles lists files (and directories) for a repo.
// It walks the tree with ?recursive=true and handles pagination.
// If ref is empty, GitLab uses the default branch.
func ListRepoFiles(cfg configuration.Configuration, projectID int, ref string) []File {
	perPage := 100
	page := 1
	var out []File

	for {
		u := fmt.Sprintf("%s/projects/%d/repository/tree?recursive=true&per_page=%d&page=%d",
			gitlabAPI, projectID, perPage, page)
		if strings.TrimSpace(ref) != "" {
			u += "&ref=" + url.QueryEscape(ref)
		}

		resp, err := GitlabRequest(cfg.Token, u)
		if err != nil {
			log.Printf("ListRepoFiles: request failed for project %d: %v", projectID, err)
			return out
		}
		func() {
			defer resp.Body.Close()
			if resp.StatusCode < 200 || resp.StatusCode >= 300 {
				b, _ := io.ReadAll(resp.Body)
				log.Printf("ListRepoFiles: bad status %d for project %d: %s", resp.StatusCode, projectID, string(b))
				return
			}
			var batch []File
			if err := json.NewDecoder(resp.Body).Decode(&batch); err != nil {
				log.Printf("ListRepoFiles: decode failed for project %d: %v", projectID, err)
				return
			}
			out = append(out, batch...)
		}()

		// GitLab pagination via X-Next-Page header
		next := resp.Header.Get("X-Next-Page")
		if next == "" {
			break
		}
		n, _ := strconv.Atoi(next)
		if n <= page {
			break
		}
		page = n
	}
	return out
}

// GetRawFileBytes downloads a file's raw content at path for a given ref (branch/commit/tag).
// Path must be URL-encoded as a path segment; url.PathEscape handles slashes -> %2F.
func GetRawFileBytes(cfg configuration.Configuration, projectID int, filePath, ref string) []byte {
	escaped := url.PathEscape(filePath) // encodes "/" as %2F (required by GitLab API)
	u := fmt.Sprintf("%s/projects/%d/repository/files/%s/raw", gitlabAPI, projectID, escaped)
	if strings.TrimSpace(ref) != "" {
		u += "?ref=" + url.QueryEscape(ref)
	}

	resp, err := GitlabRequest(cfg.Token, u)
	if err != nil {
		log.Printf("GetRawFileBytes: request failed for %s: %v", filePath, err)
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		log.Printf("GetRawFileBytes: bad status %d for %s: %s", resp.StatusCode, filePath, string(b))
		return nil
	}

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("GetRawFileBytes: read failed for %s: %v", filePath, err)
		return nil
	}
	return b
}
