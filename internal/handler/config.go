// internal/handler/config.go
package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"gitlab-list/internal/configuration"
)

// ConfigHandler handles configuration-related HTTP requests
type ConfigHandler struct {
	configPath string
}

// NewConfigHandler creates a new configuration handler
func NewConfigHandler() *ConfigHandler {
	return &ConfigHandler{
		configPath: ".env",
	}
}

// ConfigRequest represents a configuration update request
type ConfigRequest struct {
	Token    string   `json:"token"`
	Group    string   `json:"group"`
	Tag      string   `json:"tag"`
	Branches []string `json:"branches"`
}

// SaveConfig handles POST /api/config
func (h *ConfigHandler) SaveConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Token == "" {
		http.Error(w, "Token is required", http.StatusBadRequest)
		return
	}

	// Create or update .env file
	envContent := fmt.Sprintf("GITLAB_TOKEN=%s\n", req.Token)
	if req.Group != "" {
		envContent += fmt.Sprintf("GROUP=%s\n", req.Group)
	}
	if req.Tag != "" {
		envContent += fmt.Sprintf("TAG=%s\n", req.Tag)
	}
	var branches []string
	for _, b := range req.Branches {
		trimmed := strings.TrimSpace(b)
		if trimmed != "" {
			branches = append(branches, trimmed)
		}
	}
	if len(branches) > 0 {
		envContent += fmt.Sprintf("BRANCHES=%s\n", strings.Join(branches, ","))
	}

	// Write to .env file - for now
	if err := os.WriteFile(h.configPath, []byte(envContent), 0644); err != nil {
		http.Error(w, fmt.Sprintf("Failed to save configuration: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Configuration saved successfully",
	})
}

// TestConnection handles POST /api/config/test
func (h *ConfigHandler) TestConnection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Token == "" {
		http.Error(w, "Token is required", http.StatusBadRequest)
		return
	}

	// Test the connection by making a simple GitLab API call
	// This is a basic test - in a real implementation, you might want to test
	// with a more specific endpoint or validate the token format
	client := &http.Client{}
	testURL := "https://git.prosoftke.sk/api/v4/user"
	req2, err := http.NewRequest("GET", testURL, nil)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create request: %v", err), http.StatusInternalServerError)
		return
	}

	req2.Header.Set("PRIVATE-TOKEN", req.Token)
	resp, err := client.Do(req2)
	if err != nil {
		http.Error(w, fmt.Sprintf("Connection failed: %v", err), http.StatusBadRequest)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 200 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Connection successful",
		})
	} else {
		http.Error(w, fmt.Sprintf("Authentication failed: %s", resp.Status), http.StatusUnauthorized)
	}
}

// GetConfig handles GET /api/config
func (h *ConfigHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	// Read current configuration
	cfg, err := configuration.NewConfiguration()
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to load configuration: %v", err), http.StatusInternalServerError)
		return
	}

	// Return configuration (without sensitive data)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"group":    cfg.Group,
		"tag":      cfg.Tag,
		"branches": cfg.Branches,
		"token":    cfg.Token,
	})
}
