package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"gitlab-list/internal/service"
)

type LibraryUpdaterHandler struct {
	updater *service.LibraryUpdater
}

func NewLibraryUpdaterHandler(updater *service.LibraryUpdater) *LibraryUpdaterHandler {
	return &LibraryUpdaterHandler{
		updater: updater,
	}
}

// GetOutdatedLibraries handles GET /api/library/outdated/{project_id}
func (h *LibraryUpdaterHandler) GetOutdatedLibraries(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract project ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 5 {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	projectIDStr := pathParts[4]
	projectID, err := strconv.Atoi(projectIDStr)
	if err != nil {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	// Get authorization token
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Authorization header required", http.StatusUnauthorized)
		return
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	if token == authHeader {
		http.Error(w, "Invalid authorization format. Use 'Bearer <token>'", http.StatusBadRequest)
		return
	}

	// Get outdated libraries
	updates, err := h.updater.GetOutdatedLibraries(projectID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get outdated libraries: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"project_id": projectID,
		"updates":    updates,
		"count":      len(updates),
	})
}

// UpdateLibrary handles POST /api/library/update
func (h *LibraryUpdaterHandler) UpdateLibrary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get authorization token
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Authorization header required", http.StatusUnauthorized)
		return
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	if token == authHeader {
		http.Error(w, "Invalid authorization format. Use 'Bearer <token>'", http.StatusBadRequest)
		return
	}

	// Parse request body
	var request struct {
		ProjectID     int    `json:"project_id"`
		LibraryName   string `json:"library_name"`
		TargetVersion string `json:"target_version"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if request.ProjectID == 0 || request.LibraryName == "" || request.TargetVersion == "" {
		http.Error(w, "Missing required fields: project_id, library_name, target_version", http.StatusBadRequest)
		return
	}

	// Update the library
	result, err := h.updater.UpdateLibrary(request.ProjectID, request.LibraryName, request.TargetVersion, token)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to update library: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// BatchUpdateLibraries handles POST /api/library/batch-update
func (h *LibraryUpdaterHandler) BatchUpdateLibraries(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get authorization token
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Authorization header required", http.StatusUnauthorized)
		return
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	if token == authHeader {
		http.Error(w, "Invalid authorization format. Use 'Bearer <token>'", http.StatusBadRequest)
		return
	}

	// Parse request body
	var request struct {
		ProjectID int                     `json:"project_id"`
		Updates   []service.LibraryUpdate `json:"updates"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if request.ProjectID == 0 || len(request.Updates) == 0 {
		http.Error(w, "Missing required fields: project_id, updates", http.StatusBadRequest)
		return
	}

	// Batch update libraries
	results, err := h.updater.BatchUpdateLibraries(request.ProjectID, request.Updates, token)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to batch update libraries: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"project_id": request.ProjectID,
		"results":    results,
		"count":      len(results),
	})
}

// GetUpdateStatus handles GET /api/library/status/{project_id}
func (h *LibraryUpdaterHandler) GetUpdateStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract project ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 5 {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	projectIDStr := pathParts[4]
	projectID, err := strconv.Atoi(projectIDStr)
	if err != nil {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	// Get authorization token
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Authorization header required", http.StatusUnauthorized)
		return
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	if token == authHeader {
		http.Error(w, "Invalid authorization format. Use 'Bearer <token>'", http.StatusBadRequest)
		return
	}

	// Get update status (this would track ongoing updates)
	// For now, return a simple status
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"project_id": projectID,
		"status":     "ready",
		"message":    "Library updater is ready",
	})
}

// GetProjectLibraries handles GET /api/library/project/{project_id}
func (h *LibraryUpdaterHandler) GetProjectLibraries(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract project ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 5 {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	projectIDStr := pathParts[4]
	projectID, err := strconv.Atoi(projectIDStr)
	if err != nil {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	// Get authorization token
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Authorization header required", http.StatusUnauthorized)
		return
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	if token == authHeader {
		http.Error(w, "Invalid authorization format. Use 'Bearer <token>'", http.StatusBadRequest)
		return
	}

	// Get project libraries
	libraries, err := h.updater.GetProjectLibraries(projectID, token)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get project libraries: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"project_id": projectID,
		"libraries":  libraries,
		"count":      len(libraries),
	})
}

// UpdateProjectLibraries handles POST /api/library/project-update
func (h *LibraryUpdaterHandler) UpdateProjectLibraries(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get authorization token
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Authorization header required", http.StatusUnauthorized)
		return
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	if token == authHeader {
		http.Error(w, "Invalid authorization format. Use 'Bearer <token>'", http.StatusBadRequest)
		return
	}

	// Parse request body
	var request struct {
		ProjectID  int                            `json:"project_id"`
		Updates    []service.ProjectLibraryUpdate `json:"updates"`
		GoVersion  string                         `json:"go_version,omitempty"`
		BranchName string                         `json:"branch_name,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if request.ProjectID == 0 || (len(request.Updates) == 0 && request.GoVersion == "") {
		http.Error(w, "Missing required fields: project_id and at least one update or go_version", http.StatusBadRequest)
		return
	}

	// Update project libraries
	results, err := h.updater.UpdateProjectLibraries(request.ProjectID, request.Updates, request.GoVersion, request.BranchName, token)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to update project libraries: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"project_id": request.ProjectID,
		"results":    results,
		"count":      len(results),
	})
}
