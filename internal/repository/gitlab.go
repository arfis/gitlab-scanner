// internal/repository/gitlab.go
package repository

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"gitlab-list/internal/configuration"
	"gitlab-list/internal/domain"
)

const gitlabAPI = "https://git.prosoftke.sk/api/v4"

// GitLabRepository implements project repository using GitLab API
type GitLabRepository struct {
	config *configuration.Configuration
	client *http.Client
}

// NewGitLabRepository creates a new GitLab repository instance
func NewGitLabRepository(cfg *configuration.Configuration) *GitLabRepository {
	return &GitLabRepository{
		config: cfg,
		client: http.DefaultClient,
	}
}

// NewGitLabRepositoryWithToken creates a new GitLab repository instance with a specific token
func NewGitLabRepositoryWithToken(token, group, tag string) *GitLabRepository {
	cfg := &configuration.Configuration{
		Token: token,
		Group: group,
		Tag:   tag,
	}
	return &GitLabRepository{
		config: cfg,
		client: http.DefaultClient,
	}
}

// GetGroup returns the configured group
func (r *GitLabRepository) GetGroup() string {
	return r.config.Group
}

// GetTag returns the configured tag
func (r *GitLabRepository) GetTag() string {
	return r.config.Tag
}

// GetProjects retrieves all projects from GitLab
func (r *GitLabRepository) GetProjects() ([]domain.Project, error) {
	var projects []domain.Project
	page := 1

	for {
		groupPath := r.config.Group
		escaped := url.PathEscape(groupPath)

		url := fmt.Sprintf("%s/groups/%s/projects?include_subgroups=true&per_page=100&page=%d",
			gitlabAPI, escaped, page)

		resp, err := r.makeRequest(url)
		if err != nil {
			return nil, fmt.Errorf("failed to get projects: %w", err)
		}
		defer resp.Body.Close()

		var pageProjects []domain.Project
		if err = json.NewDecoder(resp.Body).Decode(&pageProjects); err != nil {
			return nil, fmt.Errorf("failed to decode projects: %w", err)
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

	return projects, nil
}

// GetProjectDetails retrieves detailed information about a project including Go version and dependencies
func (r *GitLabRepository) GetProjectDetails(projectID int, ref string) (*domain.Project, error) {
	// Get basic project info
	url := fmt.Sprintf("%s/projects/%d", gitlabAPI, projectID)
	resp, err := r.makeRequest(url)
	if err != nil {
		return nil, fmt.Errorf("failed to get project details: %w", err)
	}
	defer resp.Body.Close()

	var project domain.Project
	if err = json.NewDecoder(resp.Body).Decode(&project); err != nil {
		return nil, fmt.Errorf("failed to decode project: %w", err)
	}

	// Get Go version from go.mod
	goVersion, err := r.getGoVersion(projectID, ref)
	if err == nil {
		project.GoVersion = goVersion
	}

	// Get dependencies
	libraries, err := r.getDependencies(projectID, ref)
	if err == nil {
		project.Libraries = libraries
	}

	return &project, nil
}

// getGoVersion retrieves the Go version from go.mod file
func (r *GitLabRepository) getGoVersion(projectID int, ref string) (string, error) {
	filePath := "go.mod"
	escaped := url.PathEscape(filePath)
	requestURL := fmt.Sprintf("%s/projects/%d/repository/files/%s/raw", gitlabAPI, projectID, escaped)

	if strings.TrimSpace(ref) != "" {
		requestURL += "?ref=" + url.QueryEscape(ref)
	}

	resp, err := r.makeRequest(requestURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	// Parse go.mod to extract Go version
	return r.parseGoVersion(body), nil
}

// getDependencies retrieves dependencies from go.mod file
func (r *GitLabRepository) getDependencies(projectID int, ref string) ([]domain.Library, error) {
	filePath := "go.mod"
	escaped := url.PathEscape(filePath)
	requestURL := fmt.Sprintf("%s/projects/%d/repository/files/%s/raw", gitlabAPI, projectID, escaped)

	if strings.TrimSpace(ref) != "" {
		requestURL += "?ref=" + url.QueryEscape(ref)
	}

	resp, err := r.makeRequest(requestURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Parse go.mod to extract dependencies
	return r.parseDependencies(body), nil
}

// makeRequest makes an authenticated request to GitLab API
func (r *GitLabRepository) makeRequest(url string) (*http.Response, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("PRIVATE-TOKEN", r.config.Token)

	resp, err := r.client.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitLab API error: %s\nResponse: %s", resp.Status, string(body))
	}

	return resp, nil
}

// parseGoVersion extracts Go version from go.mod content
func (r *GitLabRepository) parseGoVersion(data []byte) string {
	// Simple parsing - look for "go 1.x" line
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "go ") {
			return strings.TrimPrefix(line, "go ")
		}
	}
	return ""
}

// parseDependencies extracts dependencies from go.mod content
func (r *GitLabRepository) parseDependencies(data []byte) []domain.Library {
	var libraries []domain.Library
	lines := strings.Split(string(data), "\n")

	// Debug: log the go.mod content for troubleshooting (uncomment for debugging)
	// fmt.Printf("DEBUG: Parsing go.mod content:\n%s\n", string(data))

	inRequireBlock := false
	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Check if we're entering the require block
		if line == "require (" {
			inRequireBlock = true
			continue
		}

		// Check if we're exiting the require block
		if line == ")" && inRequireBlock {
			inRequireBlock = false
			continue
		}

		// Check for single-line require statements
		if strings.HasPrefix(line, "require ") {
			// Single line require: "require module version"
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				lib := domain.Library{
					Name:    parts[1],
					Version: parts[2],
				}
				libraries = append(libraries, lib)
			}
			continue
		}

		// Check for multi-line require block entries
		if inRequireBlock && line != "" && !strings.HasPrefix(line, "//") {
			// Multi-line require block: "module version"
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				lib := domain.Library{
					Name:    parts[0],
					Version: parts[1],
				}
				libraries = append(libraries, lib)
			}
		}
	}

	// fmt.Printf("DEBUG: Parsed %d libraries\n", len(libraries))
	return libraries
}
