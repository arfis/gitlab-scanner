package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"gitlab-list/internal/configuration"
	"gitlab-list/internal/domain"
)

type LibraryUpdater struct {
	config        *configuration.Configuration
	gitlabToken   string
	gitlabBaseURL string
}

type LibraryUpdate struct {
	ProjectID      int    `json:"project_id"`
	ProjectName    string `json:"project_name"`
	LibraryName    string `json:"library_name"`
	CurrentVersion string `json:"current_version"`
	LatestVersion  string `json:"latest_version"`
	UpdatePath     string `json:"update_path"`
}

type ProjectLibrary struct {
	ProjectID         int      `json:"project_id"`
	ProjectName       string   `json:"project_name"`
	LibraryName       string   `json:"library_name"`
	CurrentVersion    string   `json:"current_version"`
	LatestVersion     string   `json:"latest_version"`
	AvailableVersions []string `json:"available_versions,omitempty"`
	IsUpdatable       bool     `json:"is_updatable"`
	IsDowngradable    bool     `json:"is_downgradable"`
}

type ProjectLibraryUpdate struct {
	ProjectID     int    `json:"project_id"`
	LibraryName   string `json:"library_name"`
	TargetVersion string `json:"target_version"`
	UpdateType    string `json:"update_type"` // "upgrade", "downgrade", "same"
}

type UpdateResult struct {
	ProjectID    int             `json:"project_id"`
	ProjectName  string          `json:"project_name"`
	Success      bool            `json:"success"`
	Message      string          `json:"message"`
	MergeRequest *MergeRequest   `json:"merge_request,omitempty"`
	Error        string          `json:"error,omitempty"`
	UpdatedFiles []string        `json:"updated_files,omitempty"`
	Changes      *LibraryChanges `json:"changes,omitempty"`
}

type MergeRequest struct {
	ID          int    `json:"id"`
	IID         int    `json:"iid"`
	Title       string `json:"title"`
	Description string `json:"description"`
	WebURL      string `json:"web_url"`
	State       string `json:"state"`
}

type LibraryChanges struct {
	GoModChanges string   `json:"go_mod_changes"`
	GoSumChanges string   `json:"go_sum_changes"`
	FilesChanged []string `json:"files_changed"`
}

func NewLibraryUpdater(config *configuration.Configuration) *LibraryUpdater {
	gitlabBaseURL := config.GitLabURL

	return &LibraryUpdater{
		config:        config,
		gitlabToken:   config.Token,
		gitlabBaseURL: gitlabBaseURL,
	}
}

// GetOutdatedLibraries finds libraries that can be updated
func (lu *LibraryUpdater) GetOutdatedLibraries(projectID int) ([]LibraryUpdate, error) {
	// Get project details
	project, err := lu.getProjectDetails(projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to get project details: %w", err)
	}

	// Get go.mod content
	goModContent, err := lu.getFileContent(projectID, "go.mod", "main")
	if err != nil {
		return nil, fmt.Errorf("failed to get go.mod: %w", err)
	}

	// Parse go.mod and find outdated libraries
	updates, err := lu.analyzeGoMod(goModContent, project.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to analyze go.mod: %w", err)
	}

	return updates, nil
}

// UpdateLibrary updates a specific library and creates a merge request
func (lu *LibraryUpdater) UpdateLibrary(projectID int, libraryName, targetVersion, token string) (*UpdateResult, error) {
	// Get project details
	project, err := lu.getProjectDetailsWithToken(projectID, token)
	if err != nil {
		return nil, fmt.Errorf("failed to get project details: %w", err)
	}

	// Create a new branch for the update
	branchName := fmt.Sprintf("update-%s-to-%s", libraryName, targetVersion)
	branchName = strings.ReplaceAll(branchName, "/", "-")
	branchName = strings.ReplaceAll(branchName, ".", "-")

	// Clone the repository (using HTTPS URL with authentication)
	// Extract domain from gitlabBaseURL (e.g., "https://git.prosoftke.sk" -> "git.prosoftke.sk")
	gitlabDomain := strings.TrimPrefix(lu.gitlabBaseURL, "https://")
	gitlabDomain = strings.TrimPrefix(gitlabDomain, "http://")
	cloneURL := fmt.Sprintf("https://oauth2:%s@%s/%s.git", token, gitlabDomain, project.Path)
	clonePath, err := lu.cloneRepository(cloneURL, branchName)
	if err != nil {
		return nil, fmt.Errorf("failed to clone repository: %w", err)
	}
	defer os.RemoveAll(clonePath)

	// Update the library
	changes, err := lu.updateLibraryInRepo(clonePath, libraryName, targetVersion)
	if err != nil {
		return nil, fmt.Errorf("failed to update library: %w", err)
	}

	// Commit changes
	commitMessage := fmt.Sprintf("Update %s to %s", libraryName, targetVersion)
	if err := lu.commitChanges(clonePath, commitMessage); err != nil {
		return nil, fmt.Errorf("failed to commit changes: %w", err)
	}

	// Push changes
	if err := lu.pushChanges(clonePath, branchName); err != nil {
		return nil, fmt.Errorf("failed to push changes: %w", err)
	}

	// Create merge request
	targetBranch := project.DefaultBranch
	if targetBranch == "" {
		targetBranch = "main" // fallback if default branch is not set
	}
	mr, err := lu.createMergeRequest(projectID, branchName, libraryName, targetVersion, changes, token, targetBranch)
	if err != nil {
		return nil, fmt.Errorf("failed to create merge request: %w", err)
	}

	return &UpdateResult{
		ProjectID:    projectID,
		ProjectName:  project.Name,
		Success:      true,
		Message:      fmt.Sprintf("Successfully updated %s to %s", libraryName, targetVersion),
		MergeRequest: mr,
		Changes:      changes,
	}, nil
}

// BatchUpdateLibraries updates multiple libraries in a single project
func (lu *LibraryUpdater) BatchUpdateLibraries(projectID int, updates []LibraryUpdate, token string) ([]UpdateResult, error) {
	var results []UpdateResult

	for _, update := range updates {
		result, err := lu.UpdateLibrary(projectID, update.LibraryName, update.LatestVersion, token)
		if err != nil {
			results = append(results, UpdateResult{
				ProjectID:   projectID,
				ProjectName: update.ProjectName,
				Success:     false,
				Error:       err.Error(),
			})
			continue
		}
		results = append(results, *result)
	}

	return results, nil
}

// GetProjectLibraries gets all libraries in a project with their versions
func (lu *LibraryUpdater) GetProjectLibraries(projectID int, token string) ([]ProjectLibrary, error) {
	// Get project details
	project, err := lu.getProjectDetailsWithToken(projectID, token)
	if err != nil {
		return nil, fmt.Errorf("failed to get project details: %w", err)
	}

	// Get go.mod content - try multiple branches
	branches := []string{"main", "master", "develop", "dev"}
	var goModContent string
	var goModErr error

	for _, branch := range branches {
		goModContent, goModErr = lu.getFileContentWithToken(projectID, "go.mod", branch, token)
		if goModErr == nil {
			break // Found go.mod file
		}
		// If it's not a 404, return the error immediately
		if !strings.Contains(goModErr.Error(), "HTTP 404") {
			return nil, fmt.Errorf("failed to get go.mod: %w", goModErr)
		}
	}

	if goModErr != nil {
		// All branches failed with 404
		return nil, fmt.Errorf("project does not have a go.mod file in any branch (main, master, develop, dev) - this project is not a Go module")
	}

	// Parse go.mod and extract libraries
	libraries, err := lu.parseGoModLibraries(goModContent, project.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to parse go.mod: %w", err)
	}

	return libraries, nil
}

// UpdateProjectLibraries updates multiple libraries in a project with custom versions
func (lu *LibraryUpdater) UpdateProjectLibraries(projectID int, updates []ProjectLibraryUpdate, goVersion string, branchName string, token string) ([]UpdateResult, error) {
	var results []UpdateResult

	// Get project details
	project, err := lu.getProjectDetailsWithToken(projectID, token)
	if err != nil {
		return nil, fmt.Errorf("failed to get project details: %w", err)
	}

	// Use provided branch name or generate one
	if branchName == "" {
		branchName = fmt.Sprintf("update-libraries-%d", time.Now().Unix())
	}

	// Clone the repository (using HTTPS URL with authentication)
	// Extract domain from gitlabBaseURL (e.g., "https://git.prosoftke.sk" -> "git.prosoftke.sk")
	gitlabDomain := strings.TrimPrefix(lu.gitlabBaseURL, "https://")
	gitlabDomain = strings.TrimPrefix(gitlabDomain, "http://")
	cloneURL := fmt.Sprintf("https://oauth2:%s@%s/%s.git", token, gitlabDomain, project.Path)
	clonePath, err := lu.cloneRepository(cloneURL, branchName)
	if err != nil {
		return nil, fmt.Errorf("failed to clone repository: %w", err)
	}
	defer os.RemoveAll(clonePath)

	// Update Go version if specified
	if goVersion != "" {
		if err := lu.updateGoVersionInRepo(clonePath, goVersion); err != nil {
			return nil, fmt.Errorf("failed to update Go version: %w", err)
		}
	}

	// Update each library
	var allChanges []string
	var goModChanges, goSumChanges string

	for _, update := range updates {
		// Update the library using go get
		changes, err := lu.updateLibraryInRepo(clonePath, update.LibraryName, update.TargetVersion)
		if err != nil {
			results = append(results, UpdateResult{
				ProjectID:   projectID,
				ProjectName: project.Name,
				Success:     false,
				Error:       fmt.Sprintf("Failed to update %s: %v", update.LibraryName, err),
			})
			continue
		}

		allChanges = append(allChanges, changes.FilesChanged...)
		goModChanges += changes.GoModChanges + "\n"
		goSumChanges += changes.GoSumChanges + "\n"
	}

	// Commit all changes
	var commitMessage string
	if goVersion != "" && len(updates) > 0 {
		commitMessage = fmt.Sprintf("Update Go version to %s and %d libraries", goVersion, len(updates))
	} else if goVersion != "" {
		commitMessage = fmt.Sprintf("Update Go version to %s", goVersion)
	} else {
		commitMessage = fmt.Sprintf("Update %d libraries", len(updates))
	}

	if err := lu.commitChanges(clonePath, commitMessage); err != nil {
		return nil, fmt.Errorf("failed to commit changes: %w", err)
	}

	// Push changes
	if err := lu.pushChanges(clonePath, branchName); err != nil {
		return nil, fmt.Errorf("failed to push changes: %w", err)
	}

	// Create merge request
	combinedChanges := &LibraryChanges{
		GoModChanges: goModChanges,
		GoSumChanges: goSumChanges,
		FilesChanged: allChanges,
	}

	targetBranch := project.DefaultBranch
	if targetBranch == "" {
		targetBranch = "main" // fallback if default branch is not set
	}
	mr, err := lu.createBatchMergeRequest(projectID, branchName, updates, goVersion, combinedChanges, token, targetBranch)
	if err != nil {
		return nil, fmt.Errorf("failed to create merge request: %w", err)
	}

	// Return success result
	results = append(results, UpdateResult{
		ProjectID:    projectID,
		ProjectName:  project.Name,
		Success:      true,
		Message:      fmt.Sprintf("Successfully updated %d libraries", len(updates)),
		MergeRequest: mr,
		Changes:      combinedChanges,
	})

	return results, nil
}

// Helper methods

func (lu *LibraryUpdater) getProjectDetails(projectID int) (*domain.Project, error) {
	url := fmt.Sprintf("%s/api/v4/projects/%d", lu.gitlabBaseURL, projectID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+lu.gitlabToken)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get project: HTTP %d", resp.StatusCode)
	}

	var project domain.Project
	if err := json.NewDecoder(resp.Body).Decode(&project); err != nil {
		return nil, err
	}

	return &project, nil
}

// getProjectDetailsWithToken gets project details using a specific token
func (lu *LibraryUpdater) getProjectDetailsWithToken(projectID int, token string) (*domain.Project, error) {
	url := fmt.Sprintf("%s/api/v4/projects/%d", lu.gitlabBaseURL, projectID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get project: HTTP %d", resp.StatusCode)
	}

	var project domain.Project
	if err := json.NewDecoder(resp.Body).Decode(&project); err != nil {
		return nil, err
	}

	return &project, nil
}

func (lu *LibraryUpdater) getFileContent(projectID int, filePath, ref string) (string, error) {
	url := fmt.Sprintf("%s/api/v4/projects/%d/repository/files/%s/raw",
		lu.gitlabBaseURL, projectID, strings.ReplaceAll(filePath, "/", "%2F"))

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+lu.gitlabToken)
	q := req.URL.Query()
	q.Add("ref", ref)
	req.URL.RawQuery = q.Encode()

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to get file: HTTP %d", resp.StatusCode)
	}

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(content), nil
}

// getFileContentWithToken gets file content using a specific token
func (lu *LibraryUpdater) getFileContentWithToken(projectID int, filePath, ref, token string) (string, error) {
	url := fmt.Sprintf("%s/api/v4/projects/%d/repository/files/%s/raw",
		lu.gitlabBaseURL, projectID, strings.ReplaceAll(filePath, "/", "%2F"))

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	q := req.URL.Query()
	q.Add("ref", ref)
	req.URL.RawQuery = q.Encode()

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to get file: HTTP %d", resp.StatusCode)
	}

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(content), nil
}

func (lu *LibraryUpdater) analyzeGoMod(goModContent, projectName string) ([]LibraryUpdate, error) {
	// This is a simplified analysis - in a real implementation, you'd want to:
	// 1. Parse the go.mod file properly
	// 2. Check for available updates using go list -m -u all
	// 3. Query Go module proxy for latest versions

	var updates []LibraryUpdate

	// For now, return a mock implementation
	// In reality, you'd parse the go.mod and check for updates
	lines := strings.Split(goModContent, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "require ") && !strings.Contains(line, "// indirect") {
			// Parse require line and check for updates
			// This is where you'd implement the actual update detection
		}
	}

	return updates, nil
}

func (lu *LibraryUpdater) cloneRepository(repoURL, branchName string) (string, error) {
	// Create temporary directory
	tempDir, err := os.MkdirTemp("", "gitlab-update-*")
	if err != nil {
		return "", err
	}

	// Clone repository
	cmd := exec.Command("git", "clone", repoURL, tempDir)
	if err := cmd.Run(); err != nil {
		os.RemoveAll(tempDir)
		return "", err
	}

	// Create new branch
	cmd = exec.Command("git", "checkout", "-b", branchName)
	cmd.Dir = tempDir
	if err := cmd.Run(); err != nil {
		os.RemoveAll(tempDir)
		return "", err
	}

	return tempDir, nil
}

func (lu *LibraryUpdater) updateGoVersionInRepo(repoPath, goVersion string) error {
	// Read go.mod file
	goModPath := fmt.Sprintf("%s/go.mod", repoPath)
	content, err := os.ReadFile(goModPath)
	if err != nil {
		return fmt.Errorf("failed to read go.mod: %w", err)
	}

	lines := strings.Split(string(content), "\n")
	updated := false

	// Update the go version line
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "go ") {
			// Extract just the version number if it includes "v" prefix
			version := strings.TrimPrefix(goVersion, "v")
			lines[i] = fmt.Sprintf("go %s", version)
			updated = true
			break
		}
	}

	if !updated {
		return fmt.Errorf("go version line not found in go.mod")
	}

	// Write back the updated content
	updatedContent := strings.Join(lines, "\n")
	if err := os.WriteFile(goModPath, []byte(updatedContent), 0644); err != nil {
		return fmt.Errorf("failed to write go.mod: %w", err)
	}

	// Run go mod tidy to update dependencies for the new Go version
	cmd := exec.Command("go", "mod", "tidy")
	cmd.Dir = repoPath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to run go mod tidy: %s", string(output))
	}

	return nil
}

func (lu *LibraryUpdater) updateLibraryInRepo(repoPath, libraryName, targetVersion string) (*LibraryChanges, error) {
	// Change to repository directory
	originalDir, err := os.Getwd()
	if err != nil {
		return nil, err
	}
	defer os.Chdir(originalDir)

	if err := os.Chdir(repoPath); err != nil {
		return nil, err
	}

	// Get current go.mod content
	goModContent, err := os.ReadFile("go.mod")
	if err != nil {
		return nil, err
	}

	// Update the library using go get
	cmd := exec.Command("go", "get", fmt.Sprintf("%s@%s", libraryName, targetVersion))
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("failed to update library: %s", string(output))
	}

	// Get updated go.mod content
	updatedGoModContent, err := os.ReadFile("go.mod")
	if err != nil {
		return nil, err
	}

	// Get updated go.sum content
	goSumContent, err := os.ReadFile("go.sum")
	if err != nil {
		// go.sum might not exist yet
		goSumContent = []byte("")
	}

	// Calculate changes
	goModChanges := lu.calculateDiff(string(goModContent), string(updatedGoModContent))
	goSumChanges := ""

	// Check if go.sum was updated
	if len(goSumContent) > 0 {
		originalGoSum, _ := os.ReadFile("go.sum")
		goSumChanges = lu.calculateDiff(string(originalGoSum), string(goSumContent))
	}

	return &LibraryChanges{
		GoModChanges: goModChanges,
		GoSumChanges: goSumChanges,
		FilesChanged: []string{"go.mod", "go.sum"},
	}, nil
}

func (lu *LibraryUpdater) commitChanges(repoPath, message string) error {
	cmd := exec.Command("git", "add", ".")
	cmd.Dir = repoPath
	if err := cmd.Run(); err != nil {
		return err
	}

	cmd = exec.Command("git", "commit", "-m", message)
	cmd.Dir = repoPath
	return cmd.Run()
}

func (lu *LibraryUpdater) pushChanges(repoPath, branchName string) error {
	cmd := exec.Command("git", "push", "origin", branchName)
	cmd.Dir = repoPath
	return cmd.Run()
}

func (lu *LibraryUpdater) createMergeRequest(projectID int, branchName, libraryName, targetVersion string, changes *LibraryChanges, token, targetBranch string) (*MergeRequest, error) {
	title := fmt.Sprintf("Update %s to %s", libraryName, targetVersion)
	description := fmt.Sprintf(`
## Library Update

**Library:** %s
**Version:** %s

### Changes
- Updated go.mod
- Updated go.sum

### Files Changed
%s

### Go.mod Changes
`+"```"+`diff
%s
`+"```"+`

### Go.sum Changes
`+"```"+`diff
%s
`+"```"+`
`, libraryName, targetVersion, strings.Join(changes.FilesChanged, ", "), changes.GoModChanges, changes.GoSumChanges)

	url := fmt.Sprintf("%s/api/v4/projects/%d/merge_requests", lu.gitlabBaseURL, projectID)

	data := map[string]interface{}{
		"source_branch": branchName,
		"target_branch": targetBranch,
		"title":         title,
		"description":   description,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("failed to create merge request: HTTP %d", resp.StatusCode)
	}

	var mr MergeRequest
	if err := json.NewDecoder(resp.Body).Decode(&mr); err != nil {
		return nil, err
	}

	return &mr, nil
}

func (lu *LibraryUpdater) calculateDiff(original, updated string) string {
	// Simple diff implementation - in production, use a proper diff library
	if original == updated {
		return ""
	}

	// This is a simplified diff - you'd want to use a proper diff algorithm
	return fmt.Sprintf("Updated content (simplified diff)\n- %s\n+ %s", original, updated)
}

func (lu *LibraryUpdater) parseGoModLibraries(goModContent, projectName string) ([]ProjectLibrary, error) {
	var libraries []ProjectLibrary

	lines := strings.Split(goModContent, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Skip comments and empty lines
		if strings.HasPrefix(line, "//") || line == "" {
			continue
		}

		// Parse require statements
		if strings.HasPrefix(line, "require ") {
			// Extract library name and version
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				libraryName := parts[1]
				currentVersion := parts[2]

				// Get latest version (simplified - in production, query Go module proxy)
				latestVersion := lu.getLatestVersion(libraryName)

				// Determine if updatable/downgradable
				isUpdatable := currentVersion != latestVersion
				isDowngradable := true // Allow downgrades

				libraries = append(libraries, ProjectLibrary{
					ProjectID:      0, // Will be set by caller
					ProjectName:    projectName,
					LibraryName:    libraryName,
					CurrentVersion: currentVersion,
					LatestVersion:  latestVersion,
					IsUpdatable:    isUpdatable,
					IsDowngradable: isDowngradable,
				})
			}
		}
	}

	return libraries, nil
}

func (lu *LibraryUpdater) getLatestVersion(libraryName string) string {
	// Simplified version detection - in production, query Go module proxy
	// For now, return a mock latest version
	return "v1.0.0"
}

func (lu *LibraryUpdater) createBatchMergeRequest(projectID int, branchName string, updates []ProjectLibraryUpdate, goVersion string, changes *LibraryChanges, token, targetBranch string) (*MergeRequest, error) {
	// Create title based on what's being updated
	var title string
	if goVersion != "" && len(updates) > 0 {
		title = fmt.Sprintf("Update Go %s and %d libraries", goVersion, len(updates))
	} else if goVersion != "" {
		title = fmt.Sprintf("Update Go version to %s", goVersion)
	} else {
		title = fmt.Sprintf("Update %d libraries", len(updates))
	}

	// Create detailed description
	var descriptionParts []string

	// Add Go version update if present
	if goVersion != "" {
		descriptionParts = append(descriptionParts, fmt.Sprintf(`## Go Version Update

**New Go Version:** %s
`, goVersion))
	}

	// Add library updates if present
	if len(updates) > 0 {
		var updateList strings.Builder
		for _, update := range updates {
			updateList.WriteString(fmt.Sprintf("- **%s**: %s\n", update.LibraryName, update.TargetVersion))
		}

		descriptionParts = append(descriptionParts, fmt.Sprintf(`## Library Updates

**Updated Libraries (%d):**
%s`, len(updates), updateList.String()))
	}

	// Add file changes summary (no detailed diffs in description)
	var changesList []string
	if goVersion != "" {
		changesList = append(changesList, "Updated Go version in go.mod")
	}
	if len(updates) > 0 {
		changesList = append(changesList, "Updated library dependencies in go.mod")
		changesList = append(changesList, "Updated go.sum")
	}

	descriptionParts = append(descriptionParts, fmt.Sprintf(`
### Changes Made
%s

*See the "Changes" tab in GitLab to view detailed diffs.*
`, strings.Join(changesList, "\n- ")))

	description := strings.Join(descriptionParts, "\n")

	url := fmt.Sprintf("%s/api/v4/projects/%d/merge_requests", lu.gitlabBaseURL, projectID)

	data := map[string]interface{}{
		"source_branch": branchName,
		"target_branch": targetBranch,
		"title":         title,
		"description":   description,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("failed to create merge request: HTTP %d", resp.StatusCode)
	}

	var mr MergeRequest
	if err := json.NewDecoder(resp.Body).Decode(&mr); err != nil {
		return nil, err
	}

	return &mr, nil
}
