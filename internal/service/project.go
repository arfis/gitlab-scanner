// internal/service/project.go
package service

import (
	"crypto/md5"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"gitlab-list/internal/domain"
	"gitlab-list/internal/repository"
	"gitlab-list/internal/service/archmap"
	"gitlab-list/internal/service/graph"
)

// ProjectService handles project-related business logic
type ProjectService struct {
	repo      repository.ProjectRepository
	mongoRepo *repository.MongoDBRepository
}

// NewProjectService creates a new project service
func NewProjectService(repo repository.ProjectRepository) *ProjectService {
	return &ProjectService{
		repo: repo,
	}
}

// NewProjectServiceWithCache creates a new project service with MongoDB caching
func NewProjectServiceWithCache(repo repository.ProjectRepository, mongoRepo *repository.MongoDBRepository) *ProjectService {
	return &ProjectService{
		repo:      repo,
		mongoRepo: mongoRepo,
	}
}

// SearchProjects searches for projects based on criteria
func (s *ProjectService) SearchProjects(criteria domain.SearchCriteria, useCache bool) ([]domain.Project, error) {
	// Generate search hash for caching
	searchHash := s.generateSearchHash(criteria)

	// Try cache first if enabled and available
	if useCache && s.mongoRepo != nil {
		// First try the specific search hash
		if valid, err := s.mongoRepo.IsCacheValid(searchHash); err == nil && valid {
			if cachedProjects, err := s.mongoRepo.GetCachedProjects(searchHash); err == nil {
				return cachedProjects, nil
			}
		}

		// If no specific cache found, try the initial load cache and filter
		if valid, err := s.mongoRepo.IsCacheValid("initial_load_all_projects"); err == nil && valid {
			if allCachedProjects, err := s.mongoRepo.GetCachedProjects("initial_load_all_projects"); err == nil {
				// Filter the cached projects based on criteria
				var filtered []domain.Project
				for _, project := range allCachedProjects {
					if s.matchesDetailedCriteria(project, criteria) {
						filtered = append(filtered, project)
					}
				}
				return filtered, nil
			}
		}
	}

	// Fetch from GitLab
	projects, err := s.repo.GetProjects()
	if err != nil {
		return nil, fmt.Errorf("failed to get projects: %w", err)
	}

	var filtered []domain.Project
	for _, project := range projects {
		if s.matchesCriteria(project, criteria) {
			// Get detailed information if needed and not already available
			if (criteria.GoVersion != "" || criteria.Library != "") && (project.GoVersion == "" && len(project.Libraries) == 0) {
				detailed, err := s.repo.GetProjectDetails(project.ID, "")
				if err == nil {
					project = *detailed
				}
			}

			if s.matchesDetailedCriteria(project, criteria) {
				filtered = append(filtered, project)
			}
		}
	}

	// Cache the results if MongoDB is available
	if s.mongoRepo != nil {
		go func() {
			// Calculate project hashes
			projectHashes := make(map[int]string)
			for _, project := range filtered {
				projectHashes[project.ID] = s.calculateProjectHash(project)
			}
			if err := s.mongoRepo.CacheProjects(filtered, searchHash, projectHashes); err != nil {
				fmt.Printf("Failed to cache projects: %v\n", err)
			}
		}()
	}

	return filtered, nil
}

// SearchProjectsWithToken searches for projects using a specific GitLab token
func (s *ProjectService) SearchProjectsWithToken(criteria domain.SearchCriteria, useCache bool, forceCache bool, token string) ([]domain.Project, error) {
	// Generate search hash for caching
	searchHash := s.generateSearchHash(criteria)

	// Try cache first if enabled and available
	if useCache && s.mongoRepo != nil {
		// First try the specific search hash
		if valid, err := s.mongoRepo.IsCacheValid(searchHash); err == nil && valid {
			if cachedProjects, err := s.mongoRepo.GetCachedProjects(searchHash); err == nil {
				return cachedProjects, nil
			}
		}

		// If no specific cache found, try the initial load cache and filter
		if valid, err := s.mongoRepo.IsCacheValid("initial_load_all_projects"); err == nil && valid {
			if allCachedProjects, err := s.mongoRepo.GetCachedProjects("initial_load_all_projects"); err == nil {
				// Filter the cached projects based on criteria
				var filtered []domain.Project
				for _, project := range allCachedProjects {
					if s.matchesDetailedCriteria(project, criteria) {
						filtered = append(filtered, project)
					}
				}
				return filtered, nil
			}
		}
	}

	// If force_cache is true, only use cache and don't call GitLab APIs
	if forceCache {
		// Try to get from the general "initial_load_all_projects" cache
		if s.mongoRepo != nil {
			if valid, err := s.mongoRepo.IsCacheValid("initial_load_all_projects"); err == nil && valid {
				if allProjects, err := s.mongoRepo.GetCachedProjects("initial_load_all_projects"); err == nil {
					// Filter the cached projects based on criteria
					var filtered []domain.Project
					for _, project := range allProjects {
						if s.matchesCriteria(project, criteria) && s.matchesDetailedCriteria(project, criteria) {
							filtered = append(filtered, project)
						}
					}
					return filtered, nil
				}
			}
		}
		// If no cache available and force_cache is true, return empty results
		return []domain.Project{}, nil
	}

	// Use provided token or fall back to default repository
	var repo repository.ProjectRepository = s.repo
	if token != "" {
		repo = repository.NewGitLabRepositoryWithToken(token, s.repo.GetGroup(), s.repo.GetTag())
	}

	// Fetch from GitLab
	projects, err := repo.GetProjects()
	if err != nil {
		return nil, fmt.Errorf("failed to get projects: %w", err)
	}

	var filtered []domain.Project
	for _, project := range projects {
		if s.matchesCriteria(project, criteria) {
			// Get detailed information if needed and not already available
			if (criteria.GoVersion != "" || criteria.Library != "") && (project.GoVersion == "" && len(project.Libraries) == 0) {
				detailed, err := repo.GetProjectDetails(project.ID, "")
				if err == nil {
					project = *detailed
				}
			}

			if s.matchesDetailedCriteria(project, criteria) {
				filtered = append(filtered, project)
			}
		}
	}

	// Cache the results if MongoDB is available
	if s.mongoRepo != nil {
		go func() {
			// Calculate project hashes
			projectHashes := make(map[int]string)
			for _, project := range filtered {
				projectHashes[project.ID] = s.calculateProjectHash(project)
			}
			if err := s.mongoRepo.CacheProjects(filtered, searchHash, projectHashes); err != nil {
				fmt.Printf("Failed to cache projects: %v\n", err)
			}
		}()
	}

	return filtered, nil
}

// generateSearchHash creates a hash for caching search results
func (s *ProjectService) generateSearchHash(criteria domain.SearchCriteria) string {
	hashInput := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		criteria.GoVersion,
		criteria.GoVersionComparison,
		criteria.Library,
		criteria.Version,
		criteria.VersionComparison,
		criteria.Group,
		criteria.Tag,
	)
	hash := md5.Sum([]byte(hashInput))
	return fmt.Sprintf("%x", hash)
}

// LoadInitialCache loads all projects into cache with detailed information
func (s *ProjectService) LoadInitialCache() (int, error) {
	if s.mongoRepo == nil {
		return 0, fmt.Errorf("MongoDB repository not available")
	}

	// Get all projects from GitLab
	projects, err := s.repo.GetProjects()
	if err != nil {
		return 0, fmt.Errorf("failed to get projects: %w", err)
	}

	// Get detailed information for each project (Go version and libraries)
	var detailedProjects []domain.Project
	for _, project := range projects {
		detailed, err := s.repo.GetProjectDetails(project.ID, "")
		if err != nil {
			// If we can't get details, use the basic project info
			fmt.Printf("Warning: Failed to get details for project %d (%s): %v\n", project.ID, project.Name, err)
			detailedProjects = append(detailedProjects, project)
		} else {
			detailedProjects = append(detailedProjects, *detailed)
		}
	}

	// Cache all projects with detailed information
	searchHash := "initial_load_all_projects"
	// Calculate project hashes
	projectHashes := make(map[int]string)
	for _, project := range detailedProjects {
		projectHashes[project.ID] = s.calculateProjectHash(project)
	}
	err = s.mongoRepo.CacheProjects(detailedProjects, searchHash, projectHashes)
	if err != nil {
		return 0, fmt.Errorf("failed to cache projects: %w", err)
	}

	return len(detailedProjects), nil
}

// LoadInitialCacheWithToken loads all projects into cache using a specific GitLab token with detailed information
func (s *ProjectService) LoadInitialCacheWithToken(token string) (int, error) {
	if s.mongoRepo == nil {
		return 0, fmt.Errorf("MongoDB repository not available")
	}

	// Create a temporary repository with the provided token
	tempRepo := repository.NewGitLabRepositoryWithToken(token, s.repo.GetGroup(), s.repo.GetTag())

	// Get all projects from GitLab using the provided token
	projects, err := tempRepo.GetProjects()
	if err != nil {
		return 0, fmt.Errorf("failed to get projects: %w", err)
	}

	// Get detailed information for each project (Go version and libraries)
	var detailedProjects []domain.Project
	for _, project := range projects {
		detailed, err := tempRepo.GetProjectDetails(project.ID, "")
		if err != nil {
			// If we can't get details, use the basic project info
			fmt.Printf("Warning: Failed to get details for project %d (%s): %v\n", project.ID, project.Name, err)
			detailedProjects = append(detailedProjects, project)
		} else {
			detailedProjects = append(detailedProjects, *detailed)
		}
	}

	// Cache all projects with detailed information
	searchHash := "initial_load_all_projects"
	// Calculate project hashes
	projectHashes := make(map[int]string)
	for _, project := range detailedProjects {
		projectHashes[project.ID] = s.calculateProjectHash(project)
	}
	err = s.mongoRepo.CacheProjects(detailedProjects, searchHash, projectHashes)
	if err != nil {
		return 0, fmt.Errorf("failed to cache projects: %w", err)
	}

	return len(detailedProjects), nil
}

// ClearExpiredCache removes expired cache entries (deprecated - use ClearAllCache for hash-based system)
func (s *ProjectService) ClearExpiredCache() error {
	if s.mongoRepo == nil {
		return fmt.Errorf("MongoDB repository not available")
	}
	// In hash-based system, we clear all cache instead of just expired
	return s.mongoRepo.ClearAllCache()
}

// ClearAllCache removes all cache entries
func (s *ProjectService) ClearAllCache() error {
	if s.mongoRepo == nil {
		return fmt.Errorf("MongoDB repository not available")
	}
	return s.mongoRepo.ClearAllCache()
}

// GetCacheStats returns cache statistics
func (s *ProjectService) GetCacheStats() (map[string]interface{}, error) {
	if s.mongoRepo == nil {
		return map[string]interface{}{
			"total_cached_projects": 0,
			"valid_cache_entries":   0,
			"expired_cache_entries": 0,
			"cache_enabled":         false,
		}, nil
	}

	stats, err := s.mongoRepo.GetCacheStats()
	if err != nil {
		return nil, err
	}

	stats["cache_enabled"] = true
	return stats, nil
}

// TestCacheSave tests cache saving functionality
func (s *ProjectService) TestCacheSave(projects []domain.Project, searchHash string, projectHashes map[int]string) error {
	if s.mongoRepo == nil {
		return fmt.Errorf("MongoDB repository not available")
	}
	return s.mongoRepo.CacheProjects(projects, searchHash, projectHashes)
}

// TestCacheGet tests cache retrieval functionality
func (s *ProjectService) TestCacheGet(searchHash string) ([]domain.Project, error) {
	if s.mongoRepo == nil {
		return nil, fmt.Errorf("MongoDB repository not available")
	}
	return s.mongoRepo.GetCachedProjects(searchHash)
}

// RefreshProjectInCache refreshes a specific project in the cache
func (s *ProjectService) RefreshProjectInCache(projectID int, token string) error {
	if s.mongoRepo == nil {
		return fmt.Errorf("MongoDB repository not available")
	}

	// Create a temporary repository with the provided token
	tempRepo := repository.NewGitLabRepositoryWithToken(token, s.repo.GetGroup(), s.repo.GetTag())

	// Get the specific project details
	project, err := tempRepo.GetProjectDetails(projectID, "")
	if err != nil {
		return fmt.Errorf("failed to get project details: %w", err)
	}

	// Update the project in the "initial_load_all_projects" cache
	// First, get all cached projects
	allProjects, err := s.mongoRepo.GetCachedProjects("initial_load_all_projects")
	if err != nil {
		// If no cache exists, create a new one with just this project
		allProjects = []domain.Project{*project}
	} else {
		// Update the specific project in the list
		found := false
		for i, p := range allProjects {
			if p.ID == projectID {
				allProjects[i] = *project
				found = true
				break
			}
		}
		if !found {
			// If project not found in cache, add it
			allProjects = append(allProjects, *project)
		}
	}

	// Cache the updated projects
	projectHashes := make(map[int]string)
	for _, project := range allProjects {
		projectHashes[project.ID] = s.calculateProjectHash(project)
	}
	err = s.mongoRepo.CacheProjects(allProjects, "initial_load_all_projects", projectHashes)
	if err != nil {
		return fmt.Errorf("failed to update project in cache: %w", err)
	}

	return nil
}

// SearchLibraries searches for library names from cached projects
func (s *ProjectService) SearchLibraries(query string, limit int) ([]string, error) {
	if s.mongoRepo == nil {
		return nil, fmt.Errorf("MongoDB repository not available")
	}

	// Get all cached projects
	projects, err := s.mongoRepo.GetCachedProjects("initial_load_all_projects")
	if err != nil {
		return nil, fmt.Errorf("failed to get cached projects: %w", err)
	}

	// Collect all unique library names
	librarySet := make(map[string]bool)
	for _, project := range projects {
		for _, lib := range project.Libraries {
			librarySet[lib.Name] = true
		}
	}

	// Convert to slice and filter by query
	var libraries []string
	for libName := range librarySet {
		if query == "" || strings.Contains(strings.ToLower(libName), strings.ToLower(query)) {
			libraries = append(libraries, libName)
		}
	}

	// Sort alphabetically
	sort.Strings(libraries)

	// Apply limit
	if len(libraries) > limit {
		libraries = libraries[:limit]
	}

	return libraries, nil
}

// SearchGoVersions searches for Go versions from cached projects
func (s *ProjectService) SearchGoVersions(query string, limit int) ([]string, error) {
	if s.mongoRepo == nil {
		return nil, fmt.Errorf("MongoDB repository not available")
	}

	// Get all cached projects
	projects, err := s.mongoRepo.GetCachedProjects("initial_load_all_projects")
	if err != nil {
		return nil, fmt.Errorf("failed to get cached projects: %w", err)
	}

	// Collect all unique Go versions
	versionSet := make(map[string]bool)
	for _, project := range projects {
		if project.GoVersion != "" {
			versionSet[project.GoVersion] = true
		}
	}

	// Convert to slice and filter by query
	var versions []string
	for version := range versionSet {
		if query == "" || strings.Contains(strings.ToLower(version), strings.ToLower(query)) {
			versions = append(versions, version)
		}
	}

	// Sort versions (simple string sort for now)
	sort.Strings(versions)

	// Apply limit
	if len(versions) > limit {
		versions = versions[:limit]
	}

	return versions, nil
}

// SearchLibraryVersions searches for versions of a specific library from cached projects
func (s *ProjectService) SearchLibraryVersions(libraryName, query string, limit int) ([]string, error) {
	if s.mongoRepo == nil {
		return nil, fmt.Errorf("MongoDB repository not available")
	}

	// Get all cached projects
	projects, err := s.mongoRepo.GetCachedProjects("initial_load_all_projects")
	if err != nil {
		return nil, fmt.Errorf("failed to get cached projects: %w", err)
	}

	// Collect all unique versions for the specific library
	versionSet := make(map[string]bool)
	for _, project := range projects {
		for _, lib := range project.Libraries {
			if lib.Name == libraryName {
				versionSet[lib.Version] = true
			}
		}
	}

	// Convert to slice and filter by query
	var versions []string
	for version := range versionSet {
		if query == "" || strings.Contains(strings.ToLower(version), strings.ToLower(query)) {
			versions = append(versions, version)
		}
	}

	// Sort versions (simple string sort for now)
	sort.Strings(versions)

	// Apply limit
	if len(versions) > limit {
		versions = versions[:limit]
	}

	return versions, nil
}

// SearchModules searches for module names from cached projects
func (s *ProjectService) SearchModules(query string, limit int) ([]string, error) {
	if s.mongoRepo == nil {
		return nil, fmt.Errorf("MongoDB repository not available")
	}

	// Get all cached projects
	projects, err := s.mongoRepo.GetCachedProjects("initial_load_all_projects")
	if err != nil {
		return nil, fmt.Errorf("failed to get cached projects: %w", err)
	}

	// Collect all unique module names (project paths)
	moduleSet := make(map[string]bool)
	for _, project := range projects {
		if project.Path != "" {
			moduleSet[project.Path] = true
		}
	}

	// Convert to slice and filter by query
	var modules []string
	for module := range moduleSet {
		if query == "" || strings.Contains(strings.ToLower(module), strings.ToLower(query)) {
			modules = append(modules, module)
		}
	}

	// Sort alphabetically
	sort.Strings(modules)

	// Apply limit
	if len(modules) > limit {
		modules = modules[:limit]
	}

	return modules, nil
}

// GetProjectHash calculates a hash for a project based on its content
func (s *ProjectService) GetProjectHash(projectID int, token string) (string, error) {
	// Create a temporary repository with the provided token
	tempRepo := repository.NewGitLabRepositoryWithToken(token, s.repo.GetGroup(), s.repo.GetTag())

	// Get the specific project details
	project, err := tempRepo.GetProjectDetails(projectID, "")
	if err != nil {
		return "", fmt.Errorf("failed to get project details: %w", err)
	}

	// Create a hash based on project content
	hashInput := fmt.Sprintf("%d|%s|%s|%s|%s|%s",
		project.ID,
		project.Name,
		project.Path,
		project.GoVersion,
		project.UpdatedAt.Format(time.RFC3339),
		s.getLibrariesHash(project.Libraries),
	)

	hash := md5.Sum([]byte(hashInput))
	return fmt.Sprintf("%x", hash), nil
}

// getLibrariesHash creates a hash of all libraries
func (s *ProjectService) getLibrariesHash(libraries []domain.Library) string {
	var libStrings []string
	for _, lib := range libraries {
		libStrings = append(libStrings, fmt.Sprintf("%s:%s", lib.Name, lib.Version))
	}
	sort.Strings(libStrings)
	return strings.Join(libStrings, "|")
}

// GetChangedProjects returns projects that have changed since last cache build
func (s *ProjectService) GetChangedProjects(token string) ([]domain.Project, error) {
	if s.mongoRepo == nil {
		return nil, fmt.Errorf("MongoDB repository not available")
	}

	// Get all cached projects with their hashes
	cachedProjectsWithHashes, err := s.mongoRepo.GetCachedProjectsWithHashes("initial_load_all_projects")
	if err != nil {
		return nil, fmt.Errorf("failed to get cached projects: %w", err)
	}

	// Create a temporary repository with the provided token
	tempRepo := repository.NewGitLabRepositoryWithToken(token, s.repo.GetGroup(), s.repo.GetTag())

	var changedProjects []domain.Project

	// Check each cached project for changes
	for _, cachedEntry := range cachedProjectsWithHashes {
		// Get current project details
		currentProject, err := tempRepo.GetProjectDetails(cachedEntry.Project.ID, "")
		if err != nil {
			// If we can't get current details, skip this project
			continue
		}

		// Calculate current hash
		currentHash := s.calculateProjectHash(*currentProject)

		// If hashes are different, project has changed
		if currentHash != cachedEntry.ProjectHash {
			changedProjects = append(changedProjects, *currentProject)
		}
	}

	return changedProjects, nil
}

// calculateProjectHash calculates hash for a project (internal method)
func (s *ProjectService) calculateProjectHash(project domain.Project) string {
	hashInput := fmt.Sprintf("%d|%s|%s|%s|%s|%s",
		project.ID,
		project.Name,
		project.Path,
		project.GoVersion,
		project.UpdatedAt.Format(time.RFC3339),
		s.getLibrariesHash(project.Libraries),
	)

	hash := md5.Sum([]byte(hashInput))
	return fmt.Sprintf("%x", hash)
}

// matchesCriteria checks if a project matches basic criteria
func (s *ProjectService) matchesCriteria(project domain.Project, criteria domain.SearchCriteria) bool {
	if criteria.Group != "" && !strings.Contains(project.Path, criteria.Group) {
		return false
	}

	if criteria.Tag != "" && !strings.Contains(strings.ToLower(project.Name), strings.ToLower(criteria.Tag)) {
		return false
	}

	return true
}

// matchesDetailedCriteria checks if a project matches detailed criteria (Go version, libraries)
func (s *ProjectService) matchesDetailedCriteria(project domain.Project, criteria domain.SearchCriteria) bool {
	// Check Go version comparison
	if criteria.GoVersion != "" {
		if criteria.GoVersionComparison == "" {
			// Exact match if no comparison specified
			if project.GoVersion != criteria.GoVersion {
				return false
			}
		} else {
			// Version comparison for Go version
			if !s.compareVersions(project.GoVersion, criteria.GoVersion, criteria.GoVersionComparison) {
				return false
			}
		}
	}

	// Check library criteria
	if criteria.Library != "" {
		found := false
		for _, lib := range project.Libraries {
			// Use exact match for library name
			if lib.Name == criteria.Library {
				if criteria.Version == "" {
					found = true
					break
				}

				// Check version comparison for library
				if s.compareVersions(lib.Version, criteria.Version, criteria.VersionComparison) {
					found = true
					break
				}
			}
		}
		if !found {
			return false
		}
	}

	return true
}

// compareVersions compares two version strings based on the comparison type
func (s *ProjectService) compareVersions(version1, version2, comparison string) bool {
	if comparison == "" || comparison == "exact" {
		return version1 == version2
	}

	// Normalize versions (remove 'v' prefix if present)
	v1 := strings.TrimPrefix(version1, "v")
	v2 := strings.TrimPrefix(version2, "v")

	// Parse semantic versions
	ver1, err1 := s.parseVersion(v1)
	ver2, err2 := s.parseVersion(v2)

	if err1 != nil || err2 != nil {
		// Fallback to string comparison if parsing fails
		switch comparison {
		case "greater_equal", "gte":
			return version1 >= version2
		case "less_equal", "lte":
			return version1 <= version2
		case "greater", "gt":
			return version1 > version2
		case "less", "lt":
			return version1 < version2
		default:
			return version1 == version2
		}
	}

	// Compare parsed versions
	switch comparison {
	case "greater_equal", "gte":
		return s.versionGreaterOrEqual(ver1, ver2)
	case "less_equal", "lte":
		return s.versionLessOrEqual(ver1, ver2)
	case "greater", "gt":
		return s.versionGreater(ver1, ver2)
	case "less", "lt":
		return s.versionLess(ver1, ver2)
	default:
		return s.versionEqual(ver1, ver2)
	}
}

// Version represents a parsed semantic version
type Version struct {
	Major int
	Minor int
	Patch int
}

// parseVersion parses a semantic version string
func (s *ProjectService) parseVersion(version string) (Version, error) {
	// Remove any pre-release or build metadata
	version = strings.Split(version, "-")[0]
	version = strings.Split(version, "+")[0]

	// Match semantic version pattern (major.minor.patch)
	re := regexp.MustCompile(`^(\d+)\.(\d+)(?:\.(\d+))?$`)
	matches := re.FindStringSubmatch(version)

	if len(matches) < 3 {
		return Version{}, fmt.Errorf("invalid version format: %s", version)
	}

	major, _ := strconv.Atoi(matches[1])
	minor, _ := strconv.Atoi(matches[2])
	patch := 0
	if len(matches) > 3 && matches[3] != "" {
		patch, _ = strconv.Atoi(matches[3])
	}

	return Version{Major: major, Minor: minor, Patch: patch}, nil
}

// versionEqual checks if two versions are equal
func (s *ProjectService) versionEqual(v1, v2 Version) bool {
	return v1.Major == v2.Major && v1.Minor == v2.Minor && v1.Patch == v2.Patch
}

// versionGreater checks if v1 > v2
func (s *ProjectService) versionGreater(v1, v2 Version) bool {
	if v1.Major != v2.Major {
		return v1.Major > v2.Major
	}
	if v1.Minor != v2.Minor {
		return v1.Minor > v2.Minor
	}
	return v1.Patch > v2.Patch
}

// versionGreaterOrEqual checks if v1 >= v2
func (s *ProjectService) versionGreaterOrEqual(v1, v2 Version) bool {
	return s.versionEqual(v1, v2) || s.versionGreater(v1, v2)
}

// versionLess checks if v1 < v2
func (s *ProjectService) versionLess(v1, v2 Version) bool {
	return !s.versionGreaterOrEqual(v1, v2)
}

// versionLessOrEqual checks if v1 <= v2
func (s *ProjectService) versionLessOrEqual(v1, v2 Version) bool {
	return s.versionEqual(v1, v2) || s.versionLess(v1, v2)
}

// GenerateArchitecture generates architecture data for the given parameters using cached data
func (s *ProjectService) GenerateArchitecture(ref, module string, radius int, ignores []string) (*domain.ArchitectureResponse, error) {
	// Use cached data instead of calling GitLab APIs
	return s.GenerateArchitectureFromCache(ref, module, radius, ignores)
}

// GenerateArchitectureWithOptions generates architecture with additional options
func (s *ProjectService) GenerateArchitectureWithOptions(ref, module string, radius int, ignores []string, clientsOnly bool) (*domain.ArchitectureResponse, error) {
	// Use cached data instead of calling GitLab APIs
	return s.GenerateArchitectureFromCacheWithOptions(ref, module, radius, ignores, clientsOnly)
}

// GenerateFullArchitecture generates architecture for all cached projects using cached data
func (s *ProjectService) GenerateFullArchitecture() (*domain.ArchitectureResponse, error) {
	return s.GenerateFullArchitectureWithIgnores([]string{})
}

// GenerateFullArchitectureWithIgnores generates architecture for all cached projects with ignore patterns
func (s *ProjectService) GenerateFullArchitectureWithIgnores(ignores []string) (*domain.ArchitectureResponse, error) {
	return s.GenerateFullArchitectureWithOptions(ignores, false)
}

// GenerateFullArchitectureWithOptions generates architecture for all cached projects with options
func (s *ProjectService) GenerateFullArchitectureWithOptions(ignores []string, clientsOnly bool) (*domain.ArchitectureResponse, error) {
	// Get all cached projects
	projects, err := s.mongoRepo.GetCachedProjects("initial_load_all_projects")
	if err != nil {
		return nil, fmt.Errorf("failed to get cached projects: %w", err)
	}

	if len(projects) == 0 {
		return &domain.ArchitectureResponse{
			Module: "all",
			Ref:    "cache",
		}, nil
	}

	// Generate architecture from cached data without calling GitLab APIs
	graph, err := s.generateArchitectureFromCacheWithOptions(projects, "", 1, ignores, clientsOnly)
	if err != nil {
		return nil, fmt.Errorf("failed to generate architecture from cache: %w", err)
	}

	// Convert to mermaid format
	app, err := archmap.NewApp()
	if err != nil {
		return nil, fmt.Errorf("failed to create archmap app: %w", err)
	}

	mermaidContent, err := app.GenerateMermaid(graph)
	if err != nil {
		return nil, fmt.Errorf("failed to generate mermaid: %w", err)
	}

	return &domain.ArchitectureResponse{
		Module:      "all",
		Radius:      1,
		Ref:         "cache",
		Mermaid:     mermaidContent,
		Graph:       s.toDomainGraph(graph),
		Libraries:   s.extractLibraries(graph),
		GeneratedAt: time.Now(),
	}, nil
}

// GenerateArchitectureFromCache generates architecture for a specific module using cached data
func (s *ProjectService) GenerateArchitectureFromCache(ref, module string, radius int, ignores []string) (*domain.ArchitectureResponse, error) {
	return s.GenerateArchitectureFromCacheWithOptions(ref, module, radius, ignores, false)
}

// GenerateArchitectureFromCacheWithOptions generates architecture for a specific module using cached data with options
func (s *ProjectService) GenerateArchitectureFromCacheWithOptions(ref, module string, radius int, ignores []string, clientsOnly bool) (*domain.ArchitectureResponse, error) {
	// Get all cached projects
	projects, err := s.mongoRepo.GetCachedProjects("initial_load_all_projects")
	if err != nil {
		return nil, fmt.Errorf("failed to get cached projects: %w", err)
	}

	if len(projects) == 0 {
		return &domain.ArchitectureResponse{
			Module: module,
			Ref:    ref,
		}, nil
	}

	// Generate architecture from cached data
	graph, err := s.generateArchitectureFromCacheWithOptions(projects, module, radius, ignores, clientsOnly)
	if err != nil {
		return nil, fmt.Errorf("failed to generate architecture from cache: %w", err)
	}

	// Convert to mermaid format
	app, err := archmap.NewApp()
	if err != nil {
		return nil, fmt.Errorf("failed to create archmap app: %w", err)
	}

	mermaidContent, err := app.GenerateMermaid(graph)
	if err != nil {
		return nil, fmt.Errorf("failed to generate mermaid: %w", err)
	}

	return &domain.ArchitectureResponse{
		Module:      module,
		Radius:      radius,
		Ref:         ref,
		Mermaid:     mermaidContent,
		Graph:       s.toDomainGraph(graph),
		Libraries:   s.extractLibraries(graph),
		GeneratedAt: time.Now(),
	}, nil
}

// generateArchitectureFromCache creates a graph from cached project data without GitLab API calls
func (s *ProjectService) generateArchitectureFromCache(projects []domain.Project, module string, radius int, ignores []string) (*graph.Graph, error) {
	return s.generateArchitectureFromCacheWithOptions(projects, module, radius, ignores, false)
}

// generateArchitectureFromCacheWithOptions creates a graph from cached project data with options
func (s *ProjectService) generateArchitectureFromCacheWithOptions(projects []domain.Project, module string, radius int, ignores []string, clientsOnly bool) (*graph.Graph, error) {
	g := &graph.Graph{Nodes: []graph.Node{}, Edges: []graph.Edge{}}

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
		// Skip ignored projects
		if s.shouldIgnoreProject(p.Path, ignores) {
			continue
		}

		// Skip if no Go version (not a Go project)
		if p.GoVersion == "" {
			continue
		}

		// Create service node
		serviceShort := s.parseModuleID(p.Path) // Extract short name from path
		svcID := "svc:" + serviceShort
		addNode(svcID, graph.NodeService, map[string]string{
			"module": p.Path,
			"path":   p.Path,
			"label":  serviceShort,
		})

		// Add dependencies from cached libraries
		for _, lib := range p.Libraries {
			// If clientsOnly is true, only show client modules
			if clientsOnly && !s.isClientModule(lib.Name) {
				continue // Skip normal libraries when clients only is enabled
			}

			// If clientsOnly is false, show all libraries (existing behavior)
			if !clientsOnly && !s.isClientModule(lib.Name) {
				continue // Skip normal libraries
			}

			// Check if this library should be ignored
			if s.shouldIgnoreLibrary(lib.Name, ignores) {
				continue // Skip ignored libraries
			}

			depID := "dep:" + lib.Name
			addNode(depID, graph.NodeClient, map[string]string{
				"module": lib.Name,
				"label":  s.deriveClientLabel(lib.Name),
			})
			addEdge(graph.Edge{
				From:     svcID,
				To:       depID,
				Rel:      "calls",
				Version:  lib.Version,
				Evidence: []graph.Evidence{{Hint: "require go.mod (cached)"}},
			})
		}
	}

	// Apply module filtering if specified
	if strings.TrimSpace(module) != "" {
		targetID := s.resolveTargetNodeID(g, module)
		if targetID == "" {
			return nil, fmt.Errorf("could not find node for module %q", module)
		}
		g = s.filterGraphByRadius(g, targetID, radius)
	}

	return g, nil
}

func (s *ProjectService) toDomainGraph(g *graph.Graph) *domain.Graph {
	if g == nil {
		return nil
	}
	dNodes := make([]domain.Node, 0, len(g.Nodes))
	for _, n := range g.Nodes {
		label := ""
		if n.Meta != nil {
			label = n.Meta["label"]
		}
		dNodes = append(dNodes, domain.Node{
			ID:    n.ID,
			Type:  string(n.Type),
			Label: label,
			Meta:  n.Meta,
		})
	}
	dEdges := make([]domain.Edge, 0, len(g.Edges))
	for _, e := range g.Edges {
		dEdges = append(dEdges, domain.Edge{
			From:    e.From,
			To:      e.To,
			Rel:     e.Rel,
			Version: e.Version,
		})
	}
	return &domain.Graph{Nodes: dNodes, Edges: dEdges}
}

func (s *ProjectService) extractLibraries(g *graph.Graph) []domain.ArchitectureLibrary {
	if g == nil {
		return nil
	}
	nodesByID := make(map[string]graph.Node, len(g.Nodes))
	for _, n := range g.Nodes {
		nodesByID[n.ID] = n
	}
	libs := map[string]domain.ArchitectureLibrary{}
	for _, n := range g.Nodes {
		if n.Type != graph.NodeClient {
			continue
		}
		module := strings.TrimPrefix(n.ID, "dep:")
		label := ""
		if n.Meta != nil {
			if m := n.Meta["module"]; m != "" {
				module = m
			}
			label = n.Meta["label"]
		}
		entry := libs[module]
		entry.Module = module
		if label != "" && label != module {
			entry.Label = label
		}
		libs[module] = entry
	}
	if len(libs) == 0 {
		return nil
	}
	// Attach versions by scanning edges touching the dependency nodes.
	for _, e := range g.Edges {
		if e.Version == "" {
			continue
		}
		if n, ok := nodesByID[e.To]; ok && n.Type == graph.NodeClient {
			module := libsKeyForNode(n)
			entry := libs[module]
			if entry.Module == "" {
				entry.Module = module
			}
			entry.Version = e.Version
			libs[module] = entry
			continue
		}
		if n, ok := nodesByID[e.From]; ok && n.Type == graph.NodeClient {
			module := libsKeyForNode(n)
			entry := libs[module]
			if entry.Module == "" {
				entry.Module = module
			}
			entry.Version = e.Version
			libs[module] = entry
		}
	}
	result := make([]domain.ArchitectureLibrary, 0, len(libs))
	for _, lib := range libs {
		result = append(result, lib)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Module < result[j].Module
	})
	return result
}

func libsKeyForNode(n graph.Node) string {
	if n.Meta != nil {
		if m := n.Meta["module"]; m != "" {
			return m
		}
	}
	return strings.TrimPrefix(n.ID, "dep:")
}

// Helper methods for architecture generation
func (s *ProjectService) shouldIgnoreProject(path string, ignores []string) bool {
	for _, ignore := range ignores {
		if strings.Contains(strings.ToLower(path), strings.ToLower(ignore)) {
			return true
		}
	}
	return false
}

func (s *ProjectService) shouldIgnoreLibrary(libraryName string, ignores []string) bool {
	for _, ignore := range ignores {
		ignore = strings.TrimSpace(ignore)
		if ignore == "" {
			continue
		}

		// Check if the library name contains the ignore pattern
		if strings.Contains(strings.ToLower(libraryName), strings.ToLower(ignore)) {
			return true
		}

		// Also check if the ignore pattern is a path segment
		// For example, "go-libraries" should match "git.prosoftke.sk/nghis/modules/go-libraries/kafka"
		if strings.Contains(libraryName, "/") {
			pathSegments := strings.Split(libraryName, "/")
			for _, segment := range pathSegments {
				if strings.EqualFold(segment, ignore) {
					return true
				}
			}
		}
	}
	return false
}

func (s *ProjectService) parseModuleID(path string) string {
	// Extract the last segment of the path as the service short name
	if i := strings.LastIndex(path, "/"); i >= 0 && i+1 < len(path) {
		return path[i+1:]
	}
	return path
}

func (s *ProjectService) isClientModule(moduleName string) bool {
	moduleName = strings.TrimSpace(moduleName)
	if moduleName == "" {
		return false
	}
	lower := strings.ToLower(moduleName)
	if !strings.HasPrefix(lower, "git.prosoftke.sk/") {
		return false
	}
	return strings.Contains(lower, "client")
}

func (s *ProjectService) deriveClientLabel(moduleName string) string {
	// Try to extract a friendly "clientName/vN" from the module path like
	// ".../openapi/clients/go/nghisclinicalclient/v2" or "client/v3/user-service"
	parts := strings.Split(moduleName, "/")

	// Look for the pattern: .../openapi/clients/go/clientName/version
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

	// Look for the pattern: .../client/version/service-name
	for i := 0; i < len(parts)-2; i++ {
		if parts[i] == "client" && i+1 < len(parts) && strings.HasPrefix(parts[i+1], "v") {
			version := parts[i+1]
			serviceName := ""
			if i+2 < len(parts) {
				serviceName = parts[i+2]
			}
			if serviceName != "" {
				return "client/" + version + "/" + serviceName
			}
			return "client/" + version
		}
	}

	// Fallback: if it contains "client", try to extract meaningful parts
	if strings.Contains(strings.ToLower(moduleName), "client") {
		// Find the "client" part and take everything from there
		clientIndex := -1
		for i, part := range parts {
			if strings.ToLower(part) == "client" {
				clientIndex = i
				break
			}
		}
		if clientIndex >= 0 && clientIndex+1 < len(parts) {
			// Take from "client" onwards
			remainingParts := parts[clientIndex:]
			return strings.Join(remainingParts, "/")
		}
	}

	// Final fallback: return the full module name
	return moduleName
}

func (s *ProjectService) resolveTargetNodeID(g *graph.Graph, query string) string {
	q := strings.TrimSpace(query)
	if q == "" {
		return ""
	}

	// 1) exact module path
	for _, n := range g.Nodes {
		if n.Meta != nil && n.Meta["module"] == q {
			return n.ID
		}
	}

	// 2) exact ID
	for _, n := range g.Nodes {
		if n.ID == q {
			return n.ID
		}
	}

	// 3) last segment matches
	short := s.lastSeg(q)
	for _, n := range g.Nodes {
		// prefer explicit label
		if n.Meta != nil && n.Meta["label"] != "" && s.lastSeg(n.Meta["label"]) == short {
			return n.ID
		}
		// module last segment
		if n.Meta != nil && n.Meta["module"] != "" && s.lastSeg(n.Meta["module"]) == short {
			return n.ID
		}
		// id last segment with namespace stripped
		if s.lastSeg(s.stripNamespace(n.ID)) == short {
			return n.ID
		}
	}
	return ""
}

func (s *ProjectService) stripNamespace(id string) string {
	if i := strings.IndexByte(id, ':'); i >= 0 && i+1 < len(id) {
		return id[i+1:]
	}
	return id
}

func (s *ProjectService) lastSeg(str string) string {
	if i := strings.LastIndex(str, "/"); i >= 0 && i+1 < len(str) {
		return str[i+1:]
	}
	return str
}

func (s *ProjectService) filterGraphByRadius(g *graph.Graph, center string, radius int) *graph.Graph {
	if radius < 0 {
		radius = 0
	}
	adj := map[string]map[string]bool{}
	add := func(a, b string) {
		if adj[a] == nil {
			adj[a] = map[string]bool{}
		}
		adj[a][b] = true
	}
	for _, e := range g.Edges {
		add(e.From, e.To)
		add(e.To, e.From)
	}

	keep := map[string]bool{center: true}
	frontier := map[string]bool{center: true}
	for hop := 0; hop < radius; hop++ {
		next := map[string]bool{}
		for v := range frontier {
			for nb := range adj[v] {
				if !keep[nb] {
					keep[nb] = true
					next[nb] = true
				}
			}
		}
		frontier = next
		if len(frontier) == 0 {
			break
		}
	}

	var nodes []graph.Node
	for _, n := range g.Nodes {
		if keep[n.ID] {
			nodes = append(nodes, n)
		}
	}
	var edges []graph.Edge
	for _, e := range g.Edges {
		if keep[e.From] && keep[e.To] {
			edges = append(edges, e)
		}
	}
	return &graph.Graph{Nodes: nodes, Edges: edges}
}

// ListArchitectureFiles lists all available architecture files
func (s *ProjectService) ListArchitectureFiles() ([]domain.ArchitectureFile, error) {
	var files []domain.ArchitectureFile

	// Look for .json and .mmd files in current directory
	entries, err := os.ReadDir(".")
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		filename := entry.Name()
		if !strings.HasSuffix(filename, ".json") && !strings.HasSuffix(filename, ".mmd") {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		fileType := "json"
		if strings.HasSuffix(filename, ".mmd") {
			fileType = "mermaid"
		}

		// Extract module name from filename
		module := ""
		if strings.Contains(filename, "-arch.") {
			parts := strings.Split(filename, "-arch.")
			if len(parts) > 0 {
				module = parts[0]
			}
		}

		files = append(files, domain.ArchitectureFile{
			Filename:   filename,
			Size:       info.Size(),
			ModifiedAt: info.ModTime(),
			Type:       fileType,
			Module:     module,
		})
	}

	return files, nil
}

// GetArchitectureFile retrieves the content of a specific architecture file
func (s *ProjectService) GetArchitectureFile(filename string) ([]byte, string, error) {
	// Validate filename to prevent directory traversal
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
		return nil, "", fmt.Errorf("invalid filename")
	}

	// Check if file exists
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		return nil, "", fmt.Errorf("file not found")
	}

	// Read file content
	content, err := os.ReadFile(filename)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read file: %w", err)
	}

	// Determine content type
	contentType := "application/json"
	if strings.HasSuffix(filename, ".mmd") {
		contentType = "text/plain"
	}

	return content, contentType, nil
}

// GetProjectOpenAPI retrieves OpenAPI specification for a specific project
func (s *ProjectService) GetProjectOpenAPI(projectID int) (*domain.OpenAPI, error) {
	if s.mongoRepo == nil {
		return nil, fmt.Errorf("MongoDB repository not available")
	}

	return s.mongoRepo.GetProjectOpenAPI(projectID)
}

// GetProjectsWithOpenAPI retrieves all projects that have OpenAPI specifications
func (s *ProjectService) GetProjectsWithOpenAPI() ([]domain.Project, error) {
	if s.mongoRepo == nil {
		return nil, fmt.Errorf("MongoDB repository not available")
	}

	return s.mongoRepo.GetProjectsWithOpenAPI()
}

// GetCachedProjects retrieves cached projects by search hash
func (s *ProjectService) GetCachedProjects(searchHash string) ([]domain.Project, error) {
	if s.mongoRepo == nil {
		return nil, fmt.Errorf("MongoDB repository not available")
	}

	return s.mongoRepo.GetCachedProjects(searchHash)
}
