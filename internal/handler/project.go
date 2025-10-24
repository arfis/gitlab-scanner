// internal/handler/project.go
package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"gitlab-list/internal/domain"
	"gitlab-list/internal/service"
)

// ProjectHandler handles HTTP requests for project operations
type ProjectHandler struct {
	projectService *service.ProjectService
}

// NewProjectHandler creates a new project handler
func NewProjectHandler(projectService *service.ProjectService) *ProjectHandler {
	return &ProjectHandler{
		projectService: projectService,
	}
}

// SearchProjects handles GET /api/projects/search
func (h *ProjectHandler) SearchProjects(w http.ResponseWriter, r *http.Request) {
	// Get library version from either 'library_version' or 'version' parameter (support both)
	libraryVersion := r.URL.Query().Get("library_version")
	if libraryVersion == "" {
		libraryVersion = r.URL.Query().Get("version")
	}

	criteria := domain.SearchCriteria{
		GoVersion:           r.URL.Query().Get("go_version"),
		GoVersionComparison: r.URL.Query().Get("go_version_comparison"),
		Library:             r.URL.Query().Get("library"),
		Version:             libraryVersion,
		VersionComparison:   r.URL.Query().Get("version_comparison"),
		Group:               r.URL.Query().Get("group"),
		Tag:                 r.URL.Query().Get("tag"),
	}

	// Check if cache should be used
	useCache := r.URL.Query().Get("use_cache") == "true"
	forceCache := r.URL.Query().Get("force_cache") == "true"

	// Extract GitLab token from Authorization header if provided
	var token string
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		token = strings.TrimPrefix(authHeader, "Bearer ")
		if token == authHeader {
			token = "" // Invalid format
		}
	}

	projects, err := h.projectService.SearchProjectsWithToken(criteria, useCache, forceCache, token)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Determine if results came from cache
	fromCache := useCache && len(projects) > 0

	// If force_cache is true and no cache found, return empty results
	if forceCache && !fromCache {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"projects":   []domain.Project{},
			"count":      0,
			"from_cache": false,
			"cached_at":  "",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"projects":   projects,
		"count":      len(projects),
		"from_cache": fromCache,
		"cached_at":  time.Now().Format(time.RFC3339),
	})
}

// LoadInitialCache handles POST /api/cache/load
func (h *ProjectHandler) LoadInitialCache(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract GitLab token from Authorization header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Authorization header required", http.StatusUnauthorized)
		return
	}

	// Extract token from "Bearer <token>" format
	token := strings.TrimPrefix(authHeader, "Bearer ")
	if token == authHeader {
		http.Error(w, "Invalid authorization format. Use 'Bearer <token>'", http.StatusBadRequest)
		return
	}

	// Load all projects into cache with the provided token
	projectsCached, err := h.projectService.LoadInitialCacheWithToken(token)
	if err != nil {
		// Check if it's a MongoDB not available error
		if strings.Contains(err.Error(), "MongoDB repository not available") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Cache service unavailable",
				"message": "MongoDB is not available. Please configure MongoDB to enable caching.",
				"details": err.Error(),
			})
			return
		}
		http.Error(w, fmt.Sprintf("Failed to load initial cache: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":         "Initial cache loaded successfully",
		"projects_cached": projectsCached,
	})
}

// RefreshCache handles POST /api/cache/refresh
func (h *ProjectHandler) RefreshCache(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Clear expired cache entries
	err := h.projectService.ClearExpiredCache()
	if err != nil {
		// Check if it's a MongoDB not available error
		if strings.Contains(err.Error(), "MongoDB repository not available") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Cache service unavailable",
				"message": "MongoDB is not available. Please configure MongoDB to enable caching.",
				"details": err.Error(),
			})
			return
		}
		http.Error(w, fmt.Sprintf("Failed to refresh cache: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Cache refreshed successfully",
	})
}

// ClearCache handles POST /api/cache/clear
func (h *ProjectHandler) ClearCache(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Clear all cache entries
	err := h.projectService.ClearAllCache()
	if err != nil {
		// Check if it's a MongoDB not available error
		if strings.Contains(err.Error(), "MongoDB repository not available") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Cache service unavailable",
				"message": "MongoDB is not available. Please configure MongoDB to enable caching.",
				"details": err.Error(),
			})
			return
		}
		http.Error(w, fmt.Sprintf("Failed to clear cache: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "All cache cleared successfully (hash-based cache system)",
	})
}

// GetCacheStats handles GET /api/cache/stats
func (h *ProjectHandler) GetCacheStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats, err := h.projectService.GetCacheStats()
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get cache stats: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// RefreshProjectCache handles POST /api/cache/refresh-project
func (h *ProjectHandler) RefreshProjectCache(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ProjectID int    `json:"project_id"`
		Token     string `json:"token"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.ProjectID == 0 {
		http.Error(w, "project_id is required", http.StatusBadRequest)
		return
	}

	if req.Token == "" {
		http.Error(w, "token is required", http.StatusBadRequest)
		return
	}

	// Refresh the specific project in cache
	err := h.projectService.RefreshProjectInCache(req.ProjectID, req.Token)
	if err != nil {
		// Check if it's a MongoDB not available error
		if strings.Contains(err.Error(), "MongoDB repository not available") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Cache service unavailable",
				"message": "MongoDB is not available. Please configure MongoDB to enable caching.",
				"details": err.Error(),
			})
			return
		}
		http.Error(w, fmt.Sprintf("Failed to refresh project cache: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Project cache refreshed successfully",
	})
}

// SearchLibraries handles GET /api/search/libraries
func (h *ProjectHandler) SearchLibraries(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := r.URL.Query().Get("q")
	limitStr := r.URL.Query().Get("limit")
	limit := 20 // default limit

	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	libraries, err := h.projectService.SearchLibraries(query, limit)
	if err != nil {
		// Check if it's a MongoDB not available error
		if strings.Contains(err.Error(), "MongoDB repository not available") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Cache service unavailable",
				"message": "MongoDB is not available. Please configure MongoDB to enable caching.",
				"details": err.Error(),
			})
			return
		}
		http.Error(w, fmt.Sprintf("Failed to search libraries: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"libraries": libraries,
		"count":     len(libraries),
		"query":     query,
	})
}

// SearchGoVersions handles GET /api/search/go-versions
func (h *ProjectHandler) SearchGoVersions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := r.URL.Query().Get("q")
	limitStr := r.URL.Query().Get("limit")
	limit := 20 // default limit

	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	versions, err := h.projectService.SearchGoVersions(query, limit)
	if err != nil {
		// Check if it's a MongoDB not available error
		if strings.Contains(err.Error(), "MongoDB repository not available") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Cache service unavailable",
				"message": "MongoDB is not available. Please configure MongoDB to enable caching.",
				"details": err.Error(),
			})
			return
		}
		http.Error(w, fmt.Sprintf("Failed to search Go versions: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"versions": versions,
		"count":    len(versions),
		"query":    query,
	})
}

// SearchLibraryVersions handles GET /api/search/library-versions
func (h *ProjectHandler) SearchLibraryVersions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	libraryName := r.URL.Query().Get("library")
	query := r.URL.Query().Get("q")
	limitStr := r.URL.Query().Get("limit")
	limit := 20 // default limit

	if libraryName == "" {
		http.Error(w, "library parameter is required", http.StatusBadRequest)
		return
	}

	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	versions, err := h.projectService.SearchLibraryVersions(libraryName, query, limit)
	if err != nil {
		// Check if it's a MongoDB not available error
		if strings.Contains(err.Error(), "MongoDB repository not available") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Cache service unavailable",
				"message": "MongoDB is not available. Please configure MongoDB to enable caching.",
				"details": err.Error(),
			})
			return
		}
		http.Error(w, fmt.Sprintf("Failed to search library versions: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"library":  libraryName,
		"versions": versions,
		"count":    len(versions),
		"query":    query,
	})
}

// SearchModules handles GET /api/search/modules
func (h *ProjectHandler) SearchModules(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := r.URL.Query().Get("q")
	limitStr := r.URL.Query().Get("limit")
	limit := 20 // default limit

	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	modules, err := h.projectService.SearchModules(query, limit)
	if err != nil {
		// Check if it's a MongoDB not available error
		if strings.Contains(err.Error(), "MongoDB repository not available") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Cache service unavailable",
				"message": "MongoDB is not available. Please configure MongoDB to enable caching.",
				"details": err.Error(),
			})
			return
		}
		http.Error(w, fmt.Sprintf("Failed to search modules: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"modules": modules,
		"count":   len(modules),
		"query":   query,
	})
}

// GenerateFullArchitecture handles GET /api/architecture/full
func (h *ProjectHandler) GenerateFullArchitecture(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "mermaid"
	}

	// Parse ignore patterns
	ignores := r.URL.Query().Get("ignore")
	var ignoreList []string
	if ignores != "" {
		ignoreList = strings.Split(ignores, ",")
		for i := range ignoreList {
			ignoreList[i] = strings.TrimSpace(ignoreList[i])
		}
	}

	// Parse clients only option
	clientsOnly := r.URL.Query().Get("clients_only") == "true"

	// Generate full architecture with ignore patterns and clients only option
	arch, err := h.projectService.GenerateFullArchitectureWithOptions(ignoreList, clientsOnly)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to generate full architecture: %v", err), http.StatusInternalServerError)
		return
	}

	// Set appropriate content type
	if format == "mermaid" {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(arch.Mermaid))
	} else {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(arch)
	}
}

// GitLabWebhook handles POST /api/webhook/gitlab
func (h *ProjectHandler) GitLabWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse GitLab webhook payload
	var webhookPayload struct {
		ObjectKind string `json:"object_kind"`
		Project    struct {
			ID   int    `json:"id"`
			Name string `json:"name"`
			Path string `json:"path_with_namespace"`
		} `json:"project"`
		Ref     string `json:"ref"`
		Commits []struct {
			ID        string `json:"id"`
			Message   string `json:"message"`
			Timestamp string `json:"timestamp"`
		} `json:"commits"`
	}

	if err := json.NewDecoder(r.Body).Decode(&webhookPayload); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	// Only process push events for now
	if webhookPayload.ObjectKind != "push" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Webhook received but not a push event, ignoring",
		})
		return
	}

	// Get GitLab token from Authorization header or query parameter
	token := r.Header.Get("X-Gitlab-Token")
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token == "" {
		http.Error(w, "GitLab token required (X-Gitlab-Token header or token query param)", http.StatusUnauthorized)
		return
	}

	// Refresh the specific project in cache
	err := h.projectService.RefreshProjectInCache(webhookPayload.Project.ID, token)
	if err != nil {
		// Check if it's a MongoDB not available error
		if strings.Contains(err.Error(), "MongoDB repository not available") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Cache service unavailable",
				"message": "MongoDB is not available. Please configure MongoDB to enable caching.",
				"details": err.Error(),
			})
			return
		}
		http.Error(w, fmt.Sprintf("Failed to refresh project cache: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":      "Project cache refreshed successfully",
		"project_id":   webhookPayload.Project.ID,
		"project_name": webhookPayload.Project.Name,
		"commits":      len(webhookPayload.Commits),
	})
}

// GetChangedProjects handles GET /api/projects/changed
func (h *ProjectHandler) GetChangedProjects(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get GitLab token from Authorization header or query parameter
	token := r.Header.Get("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
		if token == r.Header.Get("Authorization") {
			token = "" // Invalid format
		}
	}
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token == "" {
		http.Error(w, "GitLab token required (Authorization header or token query param)", http.StatusUnauthorized)
		return
	}

	// Get changed projects
	changedProjects, err := h.projectService.GetChangedProjects(token)
	if err != nil {
		// Check if it's a MongoDB not available error
		if strings.Contains(err.Error(), "MongoDB repository not available") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Cache service unavailable",
				"message": "MongoDB is not available. Please configure MongoDB to enable caching.",
				"details": err.Error(),
			})
			return
		}
		http.Error(w, fmt.Sprintf("Failed to get changed projects: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"projects": changedProjects,
		"count":    len(changedProjects),
		"message":  fmt.Sprintf("Found %d projects that have changed since last cache build", len(changedProjects)),
	})
}

// TestCache handles GET /api/test/cache - for debugging cache functionality
func (h *ProjectHandler) TestCache(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Test if we can save and retrieve from cache
	testProject := domain.Project{
		ID:        999,
		Name:      "test-project",
		Path:      "test/test-project",
		GoVersion: "1.21.0",
		Libraries: []domain.Library{
			{Name: "gin", Version: "v1.9.1"},
		},
	}

	// Try to cache a test project
	projectHashes := map[int]string{
		999: "test-hash-123",
	}

	err := h.projectService.TestCacheSave([]domain.Project{testProject}, "initial_load_all_projects", projectHashes)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":   "Failed to save test cache",
			"details": err.Error(),
		})
		return
	}

	// Try to retrieve from cache
	cachedProjects, err := h.projectService.TestCacheGet("initial_load_all_projects")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":   "Failed to get test cache",
			"details": err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":         "Cache test successful",
		"cached_projects": len(cachedProjects),
		"projects":        cachedProjects,
	})
}

// GetProject handles GET /api/projects/{id}
func (h *ProjectHandler) GetProject(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Path[len("/api/projects/"):]
	projectID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	ref := r.URL.Query().Get("ref")

	// This would need to be implemented in the repository
	// For now, return a placeholder
	http.Error(w, "Not implemented", http.StatusNotImplemented)
	_ = projectID
	_ = ref
}

// GetLibraries handles GET /api/libraries
func (h *ProjectHandler) GetLibraries(w http.ResponseWriter, r *http.Request) {
	// This would aggregate all libraries from all projects
	// For now, return a placeholder
	http.Error(w, "Not implemented", http.StatusNotImplemented)
}

// GetArchitecture handles GET /api/architecture
func (h *ProjectHandler) GetArchitecture(w http.ResponseWriter, r *http.Request) {
	// Get query parameters
	module := r.URL.Query().Get("module")
	radiusStr := r.URL.Query().Get("radius")
	ref := r.URL.Query().Get("ref")
	ignores := r.URL.Query().Get("ignore")
	clientsOnly := r.URL.Query().Get("clients_only") == "true"
	format := r.URL.Query().Get("format") // json or mermaid
	if format == "" {
		format = "mermaid"
	}

	// Parse radius
	radius := 1
	if radiusStr != "" {
		if r, err := strconv.Atoi(radiusStr); err == nil {
			radius = r
		}
	}

	// Parse ignores
	var ignoreList []string
	if ignores != "" {
		ignoreList = strings.Split(ignores, ",")
		for i, ignore := range ignoreList {
			ignoreList[i] = strings.TrimSpace(ignore)
		}
	}

	// Generate architecture
	arch, err := h.projectService.GenerateArchitectureWithOptions(ref, module, radius, ignoreList, clientsOnly)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to generate architecture: %v", err), http.StatusInternalServerError)
		return
	}

	// Set appropriate content type
	if format == "mermaid" {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(arch.Mermaid))
	} else {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(arch)
	}
}

// ListArchitectureFiles handles GET /api/architecture/files
func (h *ProjectHandler) ListArchitectureFiles(w http.ResponseWriter, r *http.Request) {
	// List available architecture files
	files, err := h.projectService.ListArchitectureFiles()
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to list files: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"files": files,
		"count": len(files),
	})
}

// GetArchitectureFile handles GET /api/architecture/files/{filename}
func (h *ProjectHandler) GetArchitectureFile(w http.ResponseWriter, r *http.Request) {
	// Extract filename from path
	path := r.URL.Path
	filename := path[len("/api/architecture/files/"):]

	if filename == "" {
		http.Error(w, "Filename required", http.StatusBadRequest)
		return
	}

	// Get file content
	content, contentType, err := h.projectService.GetArchitectureFile(filename)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get file: %v", err), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Write(content)
}

// GetProjectOpenAPI handles GET /api/projects/{id}/openapi
func (h *ProjectHandler) GetProjectOpenAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract project ID from URL path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid URL path", http.StatusBadRequest)
		return
	}

	projectIDStr := parts[3]
	projectID, err := strconv.Atoi(projectIDStr)
	if err != nil {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	// Get OpenAPI specification
	openAPI, err := h.projectService.GetProjectOpenAPI(projectID)
	if err != nil {
		// Check if it's a MongoDB not available error
		if strings.Contains(err.Error(), "MongoDB repository not available") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Cache service unavailable",
				"message": "MongoDB is not available. Please configure MongoDB to enable caching.",
				"details": err.Error(),
			})
			return
		}
		http.Error(w, fmt.Sprintf("Failed to get OpenAPI specification: %v", err), http.StatusInternalServerError)
		return
	}

	if !openAPI.Found {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":   "OpenAPI specification not found",
			"message": fmt.Sprintf("No OpenAPI specification found for project %d", projectID),
		})
		return
	}

	// Return the OpenAPI content
	w.Header().Set("Content-Type", "application/yaml")
	w.Write([]byte(openAPI.Content))
}

// GetProjectsWithOpenAPI handles GET /api/projects/openapi
func (h *ProjectHandler) GetProjectsWithOpenAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get all projects with OpenAPI specifications
	projects, err := h.projectService.GetProjectsWithOpenAPI()
	if err != nil {
		// Check if it's a MongoDB not available error
		if strings.Contains(err.Error(), "MongoDB repository not available") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Cache service unavailable",
				"message": "MongoDB is not available. Please configure MongoDB to enable caching.",
				"details": err.Error(),
			})
			return
		}
		http.Error(w, fmt.Sprintf("Failed to get projects with OpenAPI: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"projects": projects,
		"count":    len(projects),
		"message":  fmt.Sprintf("Found %d projects with OpenAPI specifications", len(projects)),
	})
}

// SearchProjectsForOpenAPI handles GET /api/projects/search-openapi
func (h *ProjectHandler) SearchProjectsForOpenAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get search parameters
	query := r.URL.Query().Get("q")
	hasOpenAPI := r.URL.Query().Get("has_openapi")
	limitStr := r.URL.Query().Get("limit")

	// Parse limit
	limit := 50 // default limit
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 200 {
			limit = l
		}
	}

	// Get all cached projects
	allProjects, err := h.projectService.GetCachedProjects("initial_load_all_projects")
	if err != nil {
		// Check if it's a MongoDB not available error
		if strings.Contains(err.Error(), "MongoDB repository not available") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "Cache service unavailable",
				"message": "MongoDB is not available. Please configure MongoDB to enable caching.",
				"details": err.Error(),
			})
			return
		}
		http.Error(w, fmt.Sprintf("Failed to get cached projects: %v", err), http.StatusInternalServerError)
		return
	}

	// Filter projects based on search criteria
	var filteredProjects []domain.Project
	for _, project := range allProjects {
		// Check if project has OpenAPI
		hasOpenAPISpec := project.OpenAPI != nil && project.OpenAPI.Found

		// Apply OpenAPI filter
		if hasOpenAPI == "true" && !hasOpenAPISpec {
			continue
		}
		if hasOpenAPI == "false" && hasOpenAPISpec {
			continue
		}

		// Apply text search
		if query != "" {
			queryLower := strings.ToLower(query)
			matches := strings.Contains(strings.ToLower(project.Name), queryLower) ||
				strings.Contains(strings.ToLower(project.Path), queryLower) ||
				strings.Contains(strings.ToLower(project.Description), queryLower)

			// Also search in OpenAPI content if available
			if project.OpenAPI != nil && project.OpenAPI.Found {
				matches = matches || strings.Contains(strings.ToLower(project.OpenAPI.Content), queryLower)
			}

			if !matches {
				continue
			}
		}

		filteredProjects = append(filteredProjects, project)

		// Apply limit
		if len(filteredProjects) >= limit {
			break
		}
	}

	// Prepare response with project summaries (not full OpenAPI content)
	var projectSummaries []map[string]interface{}
	for _, project := range filteredProjects {
		summary := map[string]interface{}{
			"id":          project.ID,
			"name":        project.Name,
			"path":        project.Path,
			"description": project.Description,
			"web_url":     project.WebURL,
		}

		if project.OpenAPI != nil {
			summary["openapi"] = map[string]interface{}{
				"found":          project.OpenAPI.Found,
				"path":           project.OpenAPI.Path,
				"content_length": len(project.OpenAPI.Content),
			}
		} else {
			summary["openapi"] = map[string]interface{}{
				"found":          false,
				"path":           "",
				"content_length": 0,
			}
		}

		projectSummaries = append(projectSummaries, summary)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"projects":    projectSummaries,
		"count":       len(projectSummaries),
		"total":       len(allProjects),
		"query":       query,
		"has_openapi": hasOpenAPI,
		"limit":       limit,
	})
}

// DebugOpenAPI handles GET /api/debug/openapi - for debugging OpenAPI data in cache
func (h *ProjectHandler) DebugOpenAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get all cached projects to check OpenAPI data
	allProjects, err := h.projectService.GetCachedProjects("initial_load_all_projects")
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get cached projects: %v", err), http.StatusInternalServerError)
		return
	}

	var openAPIProjects []map[string]interface{}
	var projectsWithoutOpenAPI []map[string]interface{}

	for _, project := range allProjects {
		projectInfo := map[string]interface{}{
			"id":   project.ID,
			"name": project.Name,
			"path": project.Path,
		}

		if project.OpenAPI != nil {
			projectInfo["openapi"] = map[string]interface{}{
				"found":          project.OpenAPI.Found,
				"path":           project.OpenAPI.Path,
				"content_length": len(project.OpenAPI.Content),
			}
			if project.OpenAPI.Found {
				openAPIProjects = append(openAPIProjects, projectInfo)
			} else {
				projectsWithoutOpenAPI = append(projectsWithoutOpenAPI, projectInfo)
			}
		} else {
			projectInfo["openapi"] = "nil"
			projectsWithoutOpenAPI = append(projectsWithoutOpenAPI, projectInfo)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_projects":           len(allProjects),
		"projects_with_openapi":    len(openAPIProjects),
		"projects_without_openapi": len(projectsWithoutOpenAPI),
		"openapi_projects":         openAPIProjects,
		"no_openapi_projects":      projectsWithoutOpenAPI,
	})
}
