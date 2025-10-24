'use strict';

const API_BASE = '/api';

// Utility functions
function showError(message) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        } else {
        console.error('Error:', message);
        alert(message);
    }
}

function showSuccess(message) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
        errorDiv.style.background = '#d4edda';
        errorDiv.style.color = '#155724';
        errorDiv.style.border = '1px solid #c3e6cb';
    } else {
        console.log('Success:', message);
        alert(message);
    }
}

function showLoading(show, message = 'Loading...') {
    const loadingDiv = document.getElementById('loading');
    const loadingText = document.getElementById('loading-text');
    
    if (loadingDiv) {
    if (show) {
            if (loadingText) loadingText.textContent = message;
            loadingDiv.style.display = 'block';
    } else {
            loadingDiv.style.display = 'none';
        }
    }
}

// Test API connection on page load
window.addEventListener('load', async function() {
    try {
        const response = await fetch('/health');
        if (response.ok) {
            console.log('✅ API server is running - CACHE BUSTED! v2');
        } else {
            console.warn('⚠️ API server health check failed');
        }
        
        // Initialize autocomplete functionality
        initGoVersionAutocomplete();
        initLibraryAutocomplete();
        initLibraryVersionAutocomplete();
        initModuleAutocomplete();
        
        // Load configuration safely
        await loadConfiguration();
        
        // Load cache stats
        loadCacheStats();
        
        // Update URL display
        updateUrlDisplay();
        
        // Add event listeners for URL updates
        const groupInput = document.getElementById('gitlab-group');
        const tagInput = document.getElementById('gitlab-tag');
        const branchInput = document.getElementById('gitlab-branch');
        
        if (groupInput) groupInput.addEventListener('input', updateUrlDisplay);
        if (tagInput) tagInput.addEventListener('input', updateUrlDisplay);
        if (branchInput) branchInput.addEventListener('change', updateUrlDisplay);
    } catch (error) {
        console.error('❌ Cannot connect to API serverr:', error);
        showError('Cannot connect to API serverr. Please make sure the server is running.');
    }
});

function showError(message) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    } else {
        console.error('Error:', message);
        alert(message);
    }
}

function showLoading(show, text = 'Loading...') {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingTextElement = document.getElementById('loading-text');
    
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    
    if (loadingTextElement) {
        loadingTextElement.textContent = text;
    }
}

// Autocomplete functionality
let autocompleteTimeout;
let cachedElements = {};

// Performance optimization: Cache DOM elements
function getCachedElement(id) {
    if (!cachedElements[id]) {
        cachedElements[id] = document.getElementById(id);
    }
    return cachedElements[id];
}

// Debounce utility function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize autocomplete for Go versions
function initGoVersionAutocomplete() {
    const input = getCachedElement('search-go-version');
    const dropdown = getCachedElement('go-version-dropdown');
    
    if (!input || !dropdown) {
        console.error('Go version autocomplete elements not found');
        return;
    }
    
    // Debounced search function
    const debouncedSearch = debounce((query) => {
        if (query.length >= 1) {
            searchGoVersions(query, dropdown);
        } else {
            dropdown.style.display = 'none';
        }
    }, 300);
    
    input.addEventListener('input', function() {
        debouncedSearch(this.value);
    });
    
    input.addEventListener('blur', function() {
        setTimeout(() => {
            dropdown.style.display = 'none';
        }, 200);
    });
    
    input.addEventListener('focus', function() {
        if (this.value.length >= 1) {
            searchGoVersions(this.value, dropdown);
        }
    });
}

       // Initialize autocomplete for libraries
       function initLibraryAutocomplete() {
   const input = getCachedElement('search-library');
   const dropdown = getCachedElement('library-dropdown');
   const versionInput = getCachedElement('search-library-version');
    
    if (!input || !dropdown || !versionInput) {
        console.error('Library autocomplete elements not found');
        return;
    }
   
   // Debounced search function
   const debouncedSearch = debounce((query) => {
       if (query.length >= 1) {
           searchLibraries(query, dropdown);
       } else {
           dropdown.style.display = 'none';
           // Disable version input when no library is selected
           versionInput.disabled = true;
           versionInput.value = '';
       }
   }, 300);
   
   input.addEventListener('input', function() {
       debouncedSearch(this.value);
   });
   
   input.addEventListener('blur', function() {
       setTimeout(() => {
           dropdown.style.display = 'none';
       }, 200);
   });
   
   input.addEventListener('focus', function() {
       if (this.value.length >= 1) {
           searchLibraries(this.value, dropdown);
       }
   });
   
   // When a library is selected, enable version input and load versions
   input.addEventListener('change', function() {
       if (this.value.trim()) {
           versionInput.disabled = false;
           versionInput.placeholder = 'Version (e.g., v1.9.1)';
       }
   });
       }
       
       // Initialize autocomplete for library versions
       function initLibraryVersionAutocomplete() {
   const input = document.getElementById('search-library-version');
   const dropdown = document.getElementById('library-version-dropdown');
   const libraryInput = document.getElementById('search-library');
    
    if (!input || !dropdown || !libraryInput) {
        return;
    }
   
   input.addEventListener('input', function() {
       const libraryName = libraryInput.value.trim();
       if (!libraryName) {
           dropdown.style.display = 'none';
           return;
       }
       
       const query = this.value;
       if (query.length >= 1) {
           clearTimeout(autocompleteTimeout);
           autocompleteTimeout = setTimeout(() => {
               searchLibraryVersions(libraryName, query, dropdown);
           }, 300);
       } else {
           dropdown.style.display = 'none';
       }
   });
   
   input.addEventListener('blur', function() {
       setTimeout(() => {
           dropdown.style.display = 'none';
       }, 200);
   });
   
   input.addEventListener('focus', function() {
       const libraryName = libraryInput.value.trim();
       if (libraryName && this.value.length >= 1) {
           searchLibraryVersions(libraryName, this.value, dropdown);
       }
   });
       }
       
       // Initialize autocomplete for modules
       function initModuleAutocomplete() {
   const input = document.getElementById('module');
   const dropdown = document.getElementById('module-dropdown');
    
    if (!input || !dropdown) {
        return;
    }
   
   input.addEventListener('input', function() {
       const query = this.value;
       if (query.length >= 1) {
           clearTimeout(autocompleteTimeout);
           autocompleteTimeout = setTimeout(() => {
               searchModules(query, dropdown);
           }, 300);
       } else {
           dropdown.style.display = 'none';
       }
   });
   
   input.addEventListener('blur', function() {
       setTimeout(() => {
           dropdown.style.display = 'none';
       }, 200);
   });
   
   input.addEventListener('focus', function() {
       if (this.value.length >= 1) {
           searchModules(this.value, dropdown);
       }
   });
       }

// Search Go versions from cache
async function searchGoVersions(query, dropdown) {
    try {
        const response = await fetch(`${API_BASE}/search/go-versions?q=${encodeURIComponent(query)}&limit=10`);
        if (response.ok) {
            const data = await response.json();
            displayAutocompleteResults(data.versions, dropdown, 'search-go-version', query);
        }
    } catch (error) {
        console.log('Failed to search Go versions:', error);
    }
}

       // Search libraries from cache
       async function searchLibraries(query, dropdown) {
   try {
       const response = await fetch(`${API_BASE}/search/libraries?q=${encodeURIComponent(query)}&limit=10`);
       if (response.ok) {
           const data = await response.json();
           displayAutocompleteResults(data.libraries, dropdown, 'search-library', query);
       }
   } catch (error) {
       console.log('Failed to search libraries:', error);
   }
       }
       
       // Search library versions from cache
       async function searchLibraryVersions(libraryName, query, dropdown) {
   try {
       const response = await fetch(`${API_BASE}/search/library-versions?library=${encodeURIComponent(libraryName)}&q=${encodeURIComponent(query)}&limit=10`);
       if (response.ok) {
           const data = await response.json();
           displayAutocompleteResults(data.versions, dropdown, 'search-library-version', query);
       }
   } catch (error) {
       console.log('Failed to search library versions:', error);
   }
       }

// Search modules from cache
async function searchModules(query, dropdown) {
    try {
        const response = await fetch(`${API_BASE}/search/modules?q=${encodeURIComponent(query)}&limit=10`);
        if (response.ok) {
            const data = await response.json();
            displayAutocompleteResults(data.modules, dropdown, 'module', query);
        }
    } catch (error) {
        console.log('Failed to search modules:', error);
   }
       }

// Display autocomplete results
function displayAutocompleteResults(items, dropdown, inputId, query) {
    if (items.length === 0) {
        dropdown.style.display = 'none';
        return;
    }
    
    dropdown.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.innerHTML = highlightMatch(item, query);
        div.addEventListener('click', function() {
            document.getElementById(inputId).value = item;
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(div);
    });
    
    dropdown.style.display = 'block';
}

// Highlight matching text in autocomplete results
function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="autocomplete-highlight">$1</span>');
}

// Load configuration safely
async function loadConfiguration() {
    try {
        const response = await fetch(`${API_BASE}/config`);
        if (response.ok) {
            const data = await response.json();
            if (data && typeof data === 'object') {
                const tokenInput = document.getElementById('gitlab-token');
                const groupInput = document.getElementById('gitlab-group');
                const tagInput = document.getElementById('gitlab-tag');
                
                if (tokenInput && typeof data.token === 'string' && data.token !== '') {
                    tokenInput.value = data.token;
                }
                if (groupInput && typeof data.group === 'string' && data.group !== '') {
                    groupInput.value = data.group;
                }
                if (tagInput && typeof data.tag === 'string' && data.tag !== '') {
                    tagInput.value = data.tag;
                }
            }
        }
    } catch (error) {
        alert("ERROR: " + error);
        console.warn('Failed to load configuration:', error);
    }
}

// Load cache stats
async function loadCacheStats() {
    try {
        const response = await fetch(`${API_BASE}/cache/stats`);
        if (response.ok) {
            const stats = await response.json();
            const statsDiv = document.getElementById('cache-stats');
            if (statsDiv) {
                const totalCached = document.getElementById('total-cached');
                const cacheType = document.getElementById('cache-type');
                const searchHashes = document.getElementById('search-hashes');
                
                if (totalCached) totalCached.textContent = stats.total_cached_projects || 0;
                if (cacheType) cacheType.textContent = stats.cache_type || 'Hash-Based';
                if (searchHashes) searchHashes.textContent = stats.search_hashes ? stats.search_hashes.length : 0;
                statsDiv.style.display = 'block';
            }
        }
    } catch (error) {
        console.warn('Failed to load cache stats:', error);
    }
}

// Update URL display
function updateUrlDisplay() {
    const group = document.getElementById('gitlab-group')?.value || '';
    const tag = document.getElementById('gitlab-tag')?.value || '';
    const branch = document.getElementById('gitlab-branch')?.value || '';
    
    const baseUrl = document.getElementById('gitlab-base-url');
    const apiEndpoint = document.getElementById('gitlab-api-endpoint');
    const fullUrl = document.getElementById('gitlab-full-url');
    
    if (baseUrl) baseUrl.value = `https://gitlab.com/api/v4`;
    if (apiEndpoint) apiEndpoint.value = `/projects?membership=true&with_issues_enabled=true&with_merge_requests_enabled=true&with_programming_language=go&search=${group}&tag_list=${tag}`;
    if (fullUrl) fullUrl.value = `https://gitlab.com/api/v4/projects?membership=true&with_issues_enabled=true&with_merge_requests_enabled=true&with_programming_language=go&search=${group}&tag_list=${tag}`;
}

// Project search functions
async function searchProjects() {
    const goVersion = document.getElementById('search-go-version').value;
    const goVersionComparison = document.getElementById('go-version-comparison').value;
    const library = document.getElementById('search-library').value;
    const libraryVersion = document.getElementById('search-library-version').value;
    const versionComparison = document.getElementById('version-comparison').value;
    const group = document.getElementById('search-group').value;
    const tag = document.getElementById('search-tag').value;
    const searchMode = document.getElementById('search-mode').value;
    
    const token = document.getElementById('gitlab-token').value;
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }
    
    showLoading(true, 'Searching projects...');
    
    try {
        const params = new URLSearchParams();
        if (goVersion) params.append('go_version', goVersion);
        if (goVersionComparison) params.append('go_version_comparison', goVersionComparison);
        if (library) params.append('library', library);
        if (libraryVersion) params.append('library_version', libraryVersion);
        if (versionComparison) params.append('version_comparison', versionComparison);
        if (group) params.append('group', group);
        if (tag) params.append('tag', tag);
        
        switch (searchMode) {
            case 'cache':
                params.append('use_cache', 'true');
                break;
            case 'live':
                params.append('use_cache', 'false');
                break;
            case 'cache-first':
                params.append('use_cache', 'true');
                break;
        }
        
        const response = await fetch(`${API_BASE}/projects/search?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        displayProjectResults(data, searchMode);
        
    } catch (error) {
        showError(`Failed to search projects: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

function displayProjectResults(data, searchMode = 'cache-first') {
    const resultsDiv = document.getElementById('project-results');
    const statsDiv = document.getElementById('search-stats');
    const projectsDiv = document.getElementById('projects-list');
    
    // Show stats with cache information
    const fromCache = data.from_cache || false;
    const cachedAt = data.cached_at;
    let cacheInfo = '';
    let modeInfo = '';
    
    // Determine cache status based on search mode and result
    switch (searchMode) {
        case 'cache':
            if (fromCache) {
                cacheInfo = ' • <span style="color: #27ae60;">📦 From Cache</span>';
                modeInfo = ' • <span style="color: #27ae60;">Cache Mode</span>';
            } else {
                cacheInfo = ' • <span style="color: #e74c3c;">❌ No Cache Found</span>';
                modeInfo = ' • <span style="color: #e74c3c;">Cache Mode (No Results)</span>';
            }
            break;
        case 'live':
            cacheInfo = ' • <span style="color: #3498db;">🔄 Live Data</span>';
            modeInfo = ' • <span style="color: #3498db;">Live Mode</span>';
            break;
        case 'cache-first':
            if (fromCache) {
                cacheInfo = ' • <span style="color: #27ae60;">📦 From Cache</span>';
                modeInfo = ' • <span style="color: #27ae60;">Cache First</span>';
            } else {
                cacheInfo = ' • <span style="color: #3498db;">🔄 Live Data</span>';
                modeInfo = ' • <span style="color: #3498db;">Cache First (Live Fallback)</span>';
            }
            break;
    }
    
    if (cachedAt) {
        const cacheDate = new Date(cachedAt);
        cacheInfo += ` • <span style="color: #7f8c8d;">Cached: ${cacheDate.toLocaleString()}</span>`;
    }
    
    statsDiv.innerHTML = `
        <strong>Found ${data.count || 0} project(s)</strong>${cacheInfo}${modeInfo}
    `;
    statsDiv.style.display = 'block';
    
    // Store search results globally for library management
    window.currentSearchResults = data.projects || [];
    
    // Debug: Log first project to see structure
    if (data.projects && data.projects.length > 0) {
        console.log('First project data:', data.projects[0]);
        console.log('Libraries field:', data.projects[0].Libraries);
        console.log('libraries field:', data.projects[0].libraries);
    }
    
    // Display projects
    if (data.projects && data.projects.length > 0) {
        projectsDiv.innerHTML = data.projects.map(project => {
            const libraries = project.Libraries || project.libraries || [];
            const gitlabUrl = project.web_url || `https://git.prosoftke.sk/${project.path_with_namespace}`;
            
            return `
            <div class="project-item" data-project-id="${project.id}">
                <!-- Project Header with Basic Info -->
                <div class="project-header-section">
                    <div class="project-header-top">
                        <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                            <button class="collapse-btn" id="collapse-btn-${project.id}" onclick="toggleProject(${project.id})">
                                ▼
                            </button>
                            <div style="flex: 1;">
                                <h3 class="project-title">${project.name}</h3>
                                <a href="${gitlabUrl}" target="_blank" class="project-link">
                                    🔗 ${project.path_with_namespace || 'View on GitLab'}
                            </a>
                        </div>
                            </div>
                        <span class="project-id">#${project.id}</span>
                                        </div>
                    
                    <div class="project-description">
                        ${project.description}
                                </div>
                    
                <div class="project-meta-grid">
                    <div class="project-meta-row">
                        <label class="meta-label">Go Version:</label>
                        <input type="text" 
                               id="go-version-${project.id}" 
                               class="meta-input"
                               value="${project.go_version || ''}"
                               placeholder="e.g., 1.21"
                               data-original="${project.go_version || ''}"
                               onchange="handleGoVersionChange(${project.id}, this.value, this.dataset.original)">
                            </div>
                    <div class="project-meta-row">
                        <label class="meta-label">Branch:</label>
                        <select id="branch-${project.id}" class="meta-select">
                            <option value="${project.default_branch || project.DefaultBranch || 'main'}" selected>
                                ${project.default_branch || project.DefaultBranch || 'main'} (default)
                            </option>
                        </select>
                    </div>
                    <div class="project-meta-row">
                        <label class="meta-label">Libraries:</label>
                        <span class="meta-value">${libraries.length} dependencies</span>
                </div>
                    <div class="project-meta-row">
                        <label class="meta-label">Last Activity:</label>
                        <span class="meta-value">${project.last_activity_at ? new Date(project.last_activity_at).toLocaleDateString() : 'N/A'}</span>
            </div>
                </div>
                </div>
                
                <!-- Collapsible Content -->
                <div class="project-content" id="project-content-${project.id}">
                
                <!-- Update Result -->
                <div class="update-result" id="update-result-${project.id}" style="display: none;">
                    <h4>✅ Update Successful</h4>
                    <div id="update-result-content-${project.id}" class="update-result-content"></div>
                </div>
                
                <!-- Library Management Section (Always Visible) -->
                <div class="library-management-section" id="libraries-${project.id}">
                    <div class="library-management-header">
                        <h4>📦 Libraries (${libraries.length} dependencies)</h4>
                    </div>
                    
                    <div class="library-management-content" id="libraries-content-${project.id}">
                        ${libraries.length > 0 ? `
                            <!-- Library Search -->
                            <div class="library-search-container">
                                <input type="text" 
                                       id="library-search-${project.id}" 
                                       class="library-search-input" 
                                       placeholder="🔍 Filter libraries..."
                                       oninput="filterLibraries(${project.id})">
                                <button onclick="clearLibrarySearch(${project.id})" class="btn-clear-lib-search" title="Clear filter">✕</button>
                            </div>
                            <div class="library-summary" id="library-summary-${project.id}">
                                Showing ${libraries.length} ${libraries.length === 1 ? 'library' : 'libraries'} • Scroll to see all
                            </div>
                            <div class="libraries-table" id="libraries-table-${project.id}">
                                ${libraries.map((lib, index) => {
                                    const libName = lib.name || lib.Name;
                                    const libVersion = lib.version || lib.Version;
                                    return `
                                    <div class="library-row" data-library-index="${index}" data-library-name="${libName}">
                                        <div class="library-name-col">
                                            <span class="library-name">${libName}</span>
                                        </div>
                                        <div class="library-current-version">
                                            <span class="version-badge">Current: ${libVersion}</span>
                                        </div>
                                        <div class="library-new-version">
                                            <input type="text" 
                                                   id="lib-version-${project.id}-${index}"
                                                   class="version-input"
                                                   placeholder="New version..."
                                                   value="${libVersion}"
                                                   data-library-name="${libName}"
                                                   data-original="${libVersion}"
                                                   onchange="handleLibraryVersionChange(${project.id}, '${libName}', this.value, this.dataset.original)">
                                        </div>
                                    </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : `
                            <div class="no-libraries-message">
                                📦 No library information available. Please load cache first using "Load Initial Cache" button in Advanced Configuration.
                            </div>
                        `}
                    </div>
                </div>
                </div><!-- End project-content -->
            </div><!-- End project-item -->
            `;
        }).join('');
        
        // Initialize version autocomplete for all version inputs
        setTimeout(() => {
            data.projects.forEach(project => {
                const libraries = project.Libraries || project.libraries || [];
                libraries.forEach((lib, index) => {
                    initVersionAutocomplete(project.id, index, lib.name || lib.Name);
                });
                // Load branches for branch selector
                loadProjectBranches(project.id, project.path_with_namespace);
            });
        }, 100);
    } else {
        projectsDiv.innerHTML = '<div class="no-results">No projects found matching your criteria.</div>';
    }
    
    resultsDiv.style.display = 'block';
}

function clearSearch() {
    document.getElementById('search-go-version').value = '';
    document.getElementById('search-library').value = '';
    document.getElementById('search-library-version').value = '';
    document.getElementById('search-group').value = '';
    document.getElementById('search-tag').value = '';
    
    const resultsDiv = document.getElementById('project-results');
    resultsDiv.style.display = 'none';
}

// Load branches for a project
async function loadProjectBranches(projectId, projectPath) {
    const token = document.getElementById('gitlab-token').value;
    const branchSelect = document.getElementById(`branch-${projectId}`);
    
    if (!token || !branchSelect) return;
    
    try {
        // Encode the project path for URL
        const encodedPath = encodeURIComponent(projectPath);
        const gitlabUrl = document.getElementById('gitlab-url')?.value || 'https://git.prosoftke.sk';
        const response = await fetch(`${gitlabUrl}/api/v4/projects/${encodedPath}/repository/branches`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const branches = await response.json();
            const currentValue = branchSelect.value;
            
            // Populate dropdown with branches
            branchSelect.innerHTML = branches.map(branch => `
                <option value="${branch.name}" ${branch.name === currentValue ? 'selected' : ''}>
                    ${branch.name}${branch.default ? ' (default)' : ''}
                </option>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load branches:', error);
    }
}

// Project collapse/expand functionality
function toggleProject(projectId) {
    const content = document.getElementById(`project-content-${projectId}`);
    const btn = document.getElementById(`collapse-btn-${projectId}`);
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        btn.textContent = '▼';
        } else {
        content.style.display = 'none';
        btn.textContent = '▶';
    }
}

// Track changes for each project
window.projectChanges = {};

function trackChange(projectId, type, data) {
    if (!window.projectChanges[projectId]) {
        window.projectChanges[projectId] = {
            goVersion: null,
            libraries: []
        };
    }
    
    if (type === 'goVersion') {
        window.projectChanges[projectId].goVersion = data;
    } else if (type === 'library') {
        // Remove existing change for this library
        window.projectChanges[projectId].libraries = 
            window.projectChanges[projectId].libraries.filter(lib => lib.name !== data.name);
        // Add new change
        window.projectChanges[projectId].libraries.push(data);
    }
    
    updateChangesSummary(projectId);
}

function updateChangesSummary(projectId) {
    // Use global changes box
    const emptyState = document.getElementById('global-changes-empty');
    const listDiv = document.getElementById('global-changes-list');
    const actionsWrapper = document.getElementById('global-changes-actions');
    const branchInput = document.getElementById('global-target-branch');
    
    // Collect all changes from all projects
    let allChanges = [];
    let totalLibraries = 0;
    let hasGoVersion = false;
    let currentProjectId = null;
    
    for (const [pid, changes] of Object.entries(window.projectChanges || {})) {
        if (changes && (changes.goVersion || changes.libraries.length > 0)) {
            currentProjectId = pid;
            allChanges.push({
                projectId: pid,
                changes: changes
            });
            if (changes.goVersion) hasGoVersion = true;
            totalLibraries += changes.libraries.length;
        }
    }
    
    const hasAnyChanges = allChanges.length > 0;
    
    if (!hasAnyChanges) {
        // Show empty state
        if (emptyState) emptyState.style.display = 'block';
        if (listDiv) listDiv.style.display = 'none';
        if (actionsWrapper) actionsWrapper.style.display = 'none';
        return;
    }
    
    // Hide empty state, show content
    if (emptyState) emptyState.style.display = 'none';
    if (listDiv) listDiv.style.display = 'block';
    if (actionsWrapper) actionsWrapper.style.display = 'block';
    
    // Set branch name if only one project has changes
    if (branchInput && allChanges.length === 1) {
        branchInput.value = `update-libraries-${Date.now()}`;
        branchInput.dataset.projectId = currentProjectId;
    }
    
    // Build HTML for all changes
    let html = '';
    
    allChanges.forEach(({projectId, changes}) => {
        const project = window.currentSearchResults?.find(p => p.id == projectId);
        const projectName = project ? project.name : `Project #${projectId}`;
        
        html += `<div class="change-project-section">
            <div class="change-project-header">${projectName}</div>`;
        
        if (changes.goVersion) {
            html += `<div class="change-item">
                <span class="change-type">Go Version:</span>
                <span class="change-value">${changes.goVersion.from} → ${changes.goVersion.to}</span>
            </div>`;
        }
        
        if (changes.libraries.length > 0) {
            html += `<div class="change-item">
                <span class="change-type">Libraries (${changes.libraries.length}):</span>
            </div>`;
            changes.libraries.forEach(lib => {
                html += `<div class="change-item-sub">
                    📦 ${lib.name}: ${lib.from} → ${lib.to}
                </div>`;
            });
        }
        
        html += `</div>`;
    });
    
    listDiv.innerHTML = html;
}

function clearChanges(projectId) {
    window.projectChanges[projectId] = {
        goVersion: null,
        libraries: []
    };
    updateChangesSummary(projectId);
}

function clearAllChanges() {
    if (!confirm('Clear all pending changes?')) {
        return;
    }
    window.projectChanges = {};
    updateChangesSummary(null);
}

async function applyGlobalChanges() {
    // Find which project has changes
    let projectWithChanges = null;
    for (const [pid, changes] of Object.entries(window.projectChanges || {})) {
        if (changes && (changes.goVersion || changes.libraries.length > 0)) {
            projectWithChanges = pid;
            break;
        }
    }
    
    if (!projectWithChanges) {
        showError('No changes to apply');
        return;
    }
    
    // Call applyAllChanges for that project
    await applyAllChanges(projectWithChanges);
}

function handleGoVersionChange(projectId, newValue, originalValue) {
    if (newValue !== originalValue) {
        trackChange(projectId, 'goVersion', {
            from: originalValue,
            to: newValue
        });
        } else {
        // Remove change if reverted to original
        if (window.projectChanges[projectId]) {
            window.projectChanges[projectId].goVersion = null;
            updateChangesSummary(projectId);
        }
    }
}

function handleLibraryVersionChange(projectId, libraryName, newValue, originalValue) {
    if (newValue !== originalValue) {
        trackChange(projectId, 'library', {
            name: libraryName,
            from: originalValue,
            to: newValue
        });
        } else {
        // Remove change if reverted to original
        if (window.projectChanges[projectId]) {
            window.projectChanges[projectId].libraries = 
                window.projectChanges[projectId].libraries.filter(lib => lib.name !== libraryName);
            updateChangesSummary(projectId);
        }
    }
}

function displayUpdateResult(projectId, results, changes) {
    const resultDiv = document.getElementById(`update-result-${projectId}`);
    const contentDiv = document.getElementById(`update-result-content-${projectId}`);
    
    if (!resultDiv || !contentDiv) return;
    
    // Debug logging
    console.log('displayUpdateResult called with:', { results, changes });
    
    // Assuming results is an array with at least one item
    const result = Array.isArray(results) ? results[0] : results;
    console.log('Extracted result:', result);
    console.log('Merge request data:', result.merge_request);
    
    let html = '<div class="update-result-details">';
    
    // Show what was updated
    if (changes.goVersion) {
        html += `<div class="result-item">
            <span class="result-label">Go Version:</span>
            <span class="result-value">${changes.goVersion.from} → ${changes.goVersion.to}</span>
        </div>`;
    }
    
    if (changes.libraries && changes.libraries.length > 0) {
        html += `<div class="result-item">
            <span class="result-label">Updated Libraries:</span>
            <span class="result-value">${changes.libraries.length} ${changes.libraries.length === 1 ? 'library' : 'libraries'}</span>
        </div>`;
        
        changes.libraries.forEach(lib => {
            html += `<div class="result-item-sub">
                📦 ${lib.name}: ${lib.from} → ${lib.to}
            </div>`;
        });
    }
    
    html += '</div>';
    
    // Show merge request link as a prominent button
    if (result.merge_request && result.merge_request.web_url) {
        html += `<div class="result-mr-section">
            <a href="${result.merge_request.web_url}" target="_blank" class="btn-view-mr">
                🔗 Open Merge Request #${result.merge_request.iid || result.merge_request.id} in GitLab
            </a>
        </div>`;
    }
    
    // Show branch info
    if (result.merge_request && result.merge_request.source_branch) {
        html += `<div class="result-branch-info">
            <strong>Branch:</strong> <code>${result.merge_request.source_branch}</code>
        </div>`;
    }
    
    // Add close button
    html += `<div class="result-actions">
        <button onclick="closeUpdateResult(${projectId})" class="btn-close-result">
            ✕ Close
        </button>
    </div>`;
    
    contentDiv.innerHTML = html;
    resultDiv.style.display = 'block';
}

function closeUpdateResult(projectId) {
    const resultDiv = document.getElementById(`update-result-${projectId}`);
    if (resultDiv) {
        resultDiv.style.display = 'none';
    }
}

async function applyAllChanges(projectId) {
    const changes = window.projectChanges[projectId];
    const token = document.getElementById('gitlab-token').value;

    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }
    
    if (!changes || (!changes.goVersion && changes.libraries.length === 0)) {
        showError('No changes to apply');
        return;
    }
    
    // Get custom branch name from global input
    const branchInput = document.getElementById('global-target-branch');
    const branchName = branchInput ? branchInput.value.trim() : '';
    
    if (!branchName) {
        showError('Please enter a branch name');
        return;
    }
    
    const changeCount = (changes.goVersion ? 1 : 0) + changes.libraries.length;
    if (!confirm(`Apply ${changeCount} change(s) to branch "${branchName}"? This will create a merge request.`)) {
        return;
    }
    
    showLoading(true, `Applying ${changeCount} changes...`);
    
    try {
        const updates = changes.libraries.map(lib => ({
            library_name: lib.name,
            target_version: lib.to
        }));
        
        const requestBody = {
            project_id: parseInt(projectId),
            updates: updates,
            branch_name: branchName
        };
        
        // Add go_version if it was changed
        if (changes.goVersion && changes.goVersion.to) {
            requestBody.go_version = changes.goVersion.to;
        }
        
        const response = await fetch(`${API_BASE}/library/project-update`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
            const data = await response.json();
            showSuccess(`✅ Successfully applied all changes!`);
            clearChanges(projectId);
            // Pass the actual results array from the response
            displayUpdateResult(projectId, data.results || data, changes);
            console.log('Update result:', data);
        } else {
            const errorData = await response.json();
            showError(`Failed to apply changes: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        showError(`Failed to apply changes: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Project-specific library management functions
let projectLibrariesCache = {};

async function loadProjectLibrariesForProject(projectId, projectName) {
    const token = document.getElementById('gitlab-token').value;
    
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }
    
    // Show the library management section for this project
    const librariesDiv = document.getElementById(`libraries-${projectId}`);
    const contentDiv = document.getElementById(`libraries-content-${projectId}`);
    
    librariesDiv.style.display = 'block';
    contentDiv.innerHTML = '<div style="text-align: center; color: #6c757d; font-style: italic; padding: 20px;">Loading libraries...</div>';
    
    // First check if we have libraries in the current search results
    const projectData = window.currentSearchResults?.find(p => p.id === projectId);
    if (projectData && (projectData.Libraries || projectData.libraries)) {
        const libraries = projectData.Libraries || projectData.libraries;
        displayProjectLibrariesInResults(projectId, projectName, {
            libraries: libraries,
            count: libraries.length,
            project_id: projectId
        });
        return;
    }
    
    // If not in cache, fetch from API
    try {
        const response = await fetch(`${API_BASE}/library/project/${projectId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            projectLibrariesCache[projectId] = data.libraries;
            displayProjectLibrariesInResults(projectId, projectName, data);
        } else {
            const errorData = await response.json();
            contentDiv.innerHTML = `<div style="color: #dc3545; text-align: center; padding: 20px;">Failed to load libraries: ${errorData.message || errorData}</div>`;
        }
    } catch (error) {
        contentDiv.innerHTML = `<div style="color: #dc3545; text-align: center; padding: 20px;">Failed to load libraries: ${error.message}</div>`;
    }
}

// Update library version function
async function updateLibraryVersion(projectId, libraryName, currentVersion) {
    const newVersion = prompt(`Enter new version for ${libraryName} (current: ${currentVersion}):`);
    if (!newVersion || newVersion.trim() === '') {
        return;
    }
    
    const token = document.getElementById('gitlab-token').value;
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }
    
    showLoading(true, `Updating ${libraryName} to ${newVersion}...`);
    
    try {
        const response = await fetch(`${API_BASE}/library/update`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                project_id: projectId,
                library_name: libraryName,
                target_version: newVersion.trim()
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            showSuccess(`✅ Successfully updated ${libraryName} to ${newVersion}`);
            // Refresh the project libraries display
            loadProjectLibrariesForProject(projectId, '');
        } else {
            const errorData = await response.json();
            showError(`❌ Failed to update library: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        showError(`❌ Failed to update library: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

function displayProjectLibrariesInResults(projectId, projectName, data) {
    const contentDiv = document.getElementById(`libraries-content-${projectId}`);
    
    if (data.libraries && data.libraries.length > 0) {
        let html = `
            <div style="margin-bottom: 15px;">
                <strong>Found ${data.count} libraries in ${projectName}:</strong>
            </div>
            <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px;">
        `;
        
        data.libraries.forEach((library, index) => {
            // Handle both API response format and cached format
            const libName = library.library_name || library.name || library.Name;
            const currentVer = library.current_version || library.version || library.Version;
            const latestVer = library.latest_version || currentVer;
            
            html += `
                <div style="border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin-bottom: 8px; background: #f8f9fa;" 
                     data-library-index="${index}" data-library-name="${libName}">
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <input type="checkbox" id="lib-${projectId}-${index}" style="margin-right: 10px;" 
                               onchange="toggleLibrarySelectionInProject(${projectId}, ${index})">
                        <div style="flex: 1;">
                            <strong>${libName}</strong>
                            <div style="color: #6c757d; font-size: 12px; margin-top: 2px;">
                                Current: ${currentVer}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <label style="font-size: 12px; color: #6c757d;">New Version:</label>
                        <input type="text" id="lib-version-${projectId}-${index}" 
                               placeholder="${currentVer}" 
                               value="${currentVer}"
                               style="flex: 1; padding: 4px 8px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
                        <button onclick="updateSingleLibraryInProject(${projectId}, ${index}, '${libName}')" 
                                style="background: #007bff; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                            Update
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        
        // Add batch action buttons
        html += `
            <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                <button onclick="updateSelectedLibrariesInProject(${projectId})" 
                        style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    🚀 Update Selected Libraries
                </button>
                <button onclick="selectAllLibrariesInProject(${projectId})" 
                        style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    ✅ Select All
                </button>
                <button onclick="clearAllSelectionsInProject(${projectId})" 
                        style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    ❌ Clear All
                </button>
            </div>
        `;
        
        contentDiv.innerHTML = html;
        } else {
        contentDiv.innerHTML = '<div style="text-align: center; color: #6c757d; font-style: italic;">No libraries found in this project</div>';
    }
}

function toggleLibrarySelectionInProject(projectId, index) {
    const checkbox = document.getElementById(`lib-${projectId}-${index}`);
    const container = document.querySelector(`[data-library-index="${index}"]`);
    
    if (checkbox.checked) {
        container.style.borderColor = '#007bff';
        container.style.backgroundColor = '#e7f3ff';
    } else {
        container.style.borderColor = '#ddd';
        container.style.backgroundColor = '#f8f9fa';
    }
}

function selectAllLibrariesInProject(projectId) {
    const libraries = projectLibrariesCache[projectId] || [];
    libraries.forEach((_, index) => {
        const checkbox = document.getElementById(`lib-${projectId}-${index}`);
        if (checkbox) {
            checkbox.checked = true;
            toggleLibrarySelectionInProject(projectId, index);
        }
    });
}

function clearAllSelectionsInProject(projectId) {
    const libraries = projectLibrariesCache[projectId] || [];
    libraries.forEach((_, index) => {
        const checkbox = document.getElementById(`lib-${projectId}-${index}`);
        if (checkbox) {
            checkbox.checked = false;
            toggleLibrarySelectionInProject(projectId, index);
        }
    });
}

async function updateSelectedLibrariesInProject(projectId) {
    const token = document.getElementById('gitlab-token').value;
    
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }

    // Collect selected libraries
    const libraries = projectLibrariesCache[projectId] || [];
    const selectedUpdates = [];
    
    libraries.forEach((library, index) => {
        const checkbox = document.getElementById(`lib-${projectId}-${index}`);
        const versionInput = document.getElementById(`lib-version-${projectId}-${index}`);
        
        if (checkbox && checkbox.checked && versionInput) {
            // Handle both field name formats
            const libName = library.library_name || library.name || library.Name;
            const targetVersion = versionInput.value || library.latest_version || library.version || library.Version;
            
            selectedUpdates.push({
                library_name: libName,
                target_version: targetVersion
            });
        }
    });
    
    if (selectedUpdates.length === 0) {
        showError('Please select at least one library to update');
        return;
    }
    
    if (!confirm(`Are you sure you want to update ${selectedUpdates.length} libraries? This will create a merge request.`)) {
        return;
    }

    showLoading(true, `Updating ${selectedUpdates.length} libraries...`);

    try {
        const response = await fetch(`${API_BASE}/library/project-update`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                project_id: parseInt(projectId),
                updates: selectedUpdates
            })
        });

        if (response.ok) {
            const results = await response.json();
            displayProjectUpdateResultsInProject(projectId, results);
        } else {
            const errorData = await response.json();
            showError(`Failed to update libraries: ${errorData.message || errorData}`);
        }
    } catch (error) {
        showError(`Failed to update libraries: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

async function updateSingleLibraryInProject(projectId, index, libraryName) {
    const token = document.getElementById('gitlab-token').value;
    const versionInput = document.getElementById(`lib-version-${projectId}-${index}`);
    
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }
    
    const targetVersion = versionInput.value;
    
    if (!targetVersion) {
        showError('Please enter a target version');
        return;
    }
    
    showLoading(true, `Updating ${libraryName} to ${targetVersion}...`);
    
    try {
        const response = await fetch(`${API_BASE}/library/project-update`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                project_id: parseInt(projectId),
                updates: [{
                    library_name: libraryName,
                    target_version: targetVersion
                }]
            })
        });
        
        if (response.ok) {
            const results = await response.json();
            displayProjectUpdateResultsInProject(projectId, results);
        } else {
            const errorData = await response.json();
            showError(`Failed to update library: ${errorData.message || errorData}`);
        }
    } catch (error) {
        showError(`Failed to update library: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

function displayProjectUpdateResultsInProject(projectId, results) {
    const contentDiv = document.getElementById(`libraries-content-${projectId}`);
    
    let html = `
        <div style="margin-bottom: 15px;">
            <strong>Update Results:</strong>
        </div>
    `;
    
    results.results.forEach((result, index) => {
        const statusColor = result.success ? '#d4edda' : '#f8d7da';
        const textColor = result.success ? '#155724' : '#721c24';
        const icon = result.success ? '✅' : '❌';
        
        html += `
            <div style="border: 1px solid ${statusColor}; border-radius: 4px; padding: 10px; margin-bottom: 8px; background: ${statusColor};">
                <div style="color: ${textColor}; font-weight: bold;">${icon} ${result.message || result.error}</div>
        `;
        
        if (result.success && result.merge_request) {
            html += `
                <div style="margin-top: 8px;">
                    <strong>Merge Request:</strong>
                    <a href="${result.merge_request.web_url}" target="_blank" style="color: #007bff;">
                        ${result.merge_request.title} (#${result.merge_request.iid})
                    </a>
                </div>
            `;
        }
        
        if (result.changes && result.changes.files_changed) {
            html += `
                <div style="margin-top: 8px;">
                    <strong>Files Changed:</strong> ${result.changes.files_changed.join(', ')}
            </div>
        `;
        }
        
        html += `</div>`;
    });
    
    contentDiv.innerHTML = html;
}

function closeProjectLibraries(projectId) {
    const librariesDiv = document.getElementById(`libraries-${projectId}`);
    librariesDiv.style.display = 'none';
}

async function checkOutdatedLibrariesForProject(projectId, projectName) {
    const token = document.getElementById('gitlab-token').value;
    
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }
    
    showLoading(true, `Checking for outdated libraries in ${projectName}...`);

    try {
        const response = await fetch(`${API_BASE}/library/outdated/${projectId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayOutdatedLibrariesForProject(projectId, projectName, data);
                } else {
            const errorData = await response.json();
            showError(`Failed to check outdated libraries: ${errorData.message || errorData}`);
            }
        } catch (error) {
        showError(`Failed to check outdated libraries: ${error.message}`);
        } finally {
            showLoading(false);
    }
}

function displayOutdatedLibrariesForProject(projectId, projectName, data) {
    if (data.updates && data.updates.length > 0) {
        let message = `Found ${data.count} outdated libraries in ${projectName}:\n\n`;
        data.updates.forEach(update => {
            message += `• ${update.library_name}: ${update.current_version} → ${update.latest_version}\n`;
        });
        message += `\nClick "📦 Manage Libraries" to update them.`;
        alert(message);
    } else {
        alert(`No outdated libraries found in ${projectName}. All libraries are up to date!`);
    }
}

// Initialize Mermaid
mermaid.initialize({ 
    startOnLoad: true,
    theme: 'default',
    flowchart: {
        useMaxWidth: true,
    },
    securityLevel: 'loose',
});

// Initial URL display update
// Cache management functions
async function loadInitialCache() {
    const token = document.getElementById('gitlab-token').value;
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }

    showLoading(true, 'Loading initial cache...');

    try {
        const response = await fetch(`${API_BASE}/cache/load`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            showSuccess(`Cache loaded successfully! ${data.count || 0} projects cached.`);
    } else {
            const errorData = await response.json();
            showError(`Failed to load cache: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        showError(`Failed to load cache: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

async function refreshCache() {
    const token = document.getElementById('gitlab-token').value;
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }
    
    showLoading(true, 'Refreshing cache...');
    
    try {
        const response = await fetch(`${API_BASE}/cache/refresh`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
        const data = await response.json();
            showSuccess(`Cache refreshed successfully! ${data.count || 0} projects updated.`);
        } else {
            const errorData = await response.json();
            showError(`Failed to refresh cache: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        showError(`Failed to refresh cache: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

async function clearCache() {
    const token = document.getElementById('gitlab-token').value;
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }
    
    if (!confirm('Are you sure you want to clear the cache? This will remove all cached project data.')) {
            return;
        }
        
    showLoading(true, 'Clearing cache...');
    
    try {
        const response = await fetch(`${API_BASE}/cache/clear`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            showSuccess('Cache cleared successfully!');
                } else {
            const errorData = await response.json();
            showError(`Failed to clear cache: ${errorData.message || 'Unknown error'}`);
            }
        } catch (error) {
        showError(`Failed to clear cache: ${error.message}`);
        } finally {
            showLoading(false);
    }
}

async function refreshProjectCache() {
    const token = document.getElementById('gitlab-token').value;
    const projectId = document.getElementById('webhook-project-id').value;
    
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }
    
    if (!projectId.trim()) {
        showError('Please enter a project ID');
        return;
    }
    
    showLoading(true, `Refreshing project ${projectId} cache...`);
    
    try {
        const response = await fetch(`${API_BASE}/cache/refresh-project?project_id=${projectId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            showSuccess(`Project ${projectId} cache refreshed successfully!`);
    } else {
            const errorData = await response.json();
            showError(`Failed to refresh project cache: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        showError(`Failed to refresh project cache: ${error.message}`);
    } finally {
                    showLoading(false);
    }
}

async function checkChangedProjects() {
    const token = document.getElementById('gitlab-token').value;
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
                    return;
                }
                
    showLoading(true, 'Checking for changed projects...');
    
    try {
        const response = await fetch(`${API_BASE}/cache/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            showSuccess(`Found ${data.changed_projects || 0} changed projects. Cache status: ${data.status || 'Unknown'}`);
                } else {
            const errorData = await response.json();
            showError(`Failed to check changed projects: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        showError(`Failed to check changed projects: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

async function testGitLabConnection() {
    const token = document.getElementById('gitlab-token').value;
    if (!token.trim()) {
        showError('Please enter your GitLab API token first');
        return;
    }
    
    showLoading(true, 'Testing GitLab connection...');
    
    try {
        const response = await fetch(`${API_BASE}/config/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: token
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            showSuccess(`✅ GitLab connection successful! User: ${data.user || 'Unknown'}, Projects accessible: ${data.projects_count || 0}`);
        } else {
            const errorData = await response.json();
            showError(`❌ GitLab connection failed: ${errorData.message || 'Invalid token or network error'}`);
        }
    } catch (error) {
        showError(`❌ GitLab connection failed: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Quick search/filter functions
function filterProjects() {
    const searchTerm = document.getElementById('quick-search').value.toLowerCase().trim();
    const allProjectItems = document.querySelectorAll('.project-item');
    const filterCountDiv = document.getElementById('filter-count');
    
    if (!searchTerm) {
        // Show all projects
        allProjectItems.forEach(item => {
            item.style.display = 'block';
        });
        filterCountDiv.textContent = '';
        return;
    }
    
    let visibleCount = 0;
    let totalCount = allProjectItems.length;
    
    allProjectItems.forEach(item => {
        const projectTitle = item.querySelector('.project-title');
        const projectPath = item.querySelector('.project-link');
        
        if (projectTitle && projectPath) {
            const titleText = projectTitle.textContent.toLowerCase();
            const pathText = projectPath.textContent.toLowerCase();
            
            if (titleText.includes(searchTerm) || pathText.includes(searchTerm)) {
                item.style.display = 'block';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        }
    });
    
    // Update filter count
    if (visibleCount === totalCount) {
        filterCountDiv.textContent = '';
    } else {
        filterCountDiv.textContent = `Showing ${visibleCount} of ${totalCount} projects`;
    }
}

function clearQuickSearch() {
    const searchInput = document.getElementById('quick-search');
    if (searchInput) {
        searchInput.value = '';
        filterProjects(); // Reset the filter
    }
}

// Library search/filter functions
function filterLibraries(projectId) {
    const searchTerm = document.getElementById(`library-search-${projectId}`).value.toLowerCase().trim();
    const librariesTable = document.getElementById(`libraries-table-${projectId}`);
    const librarySummary = document.getElementById(`library-summary-${projectId}`);
    
    if (!librariesTable) return;
    
    const allLibraryRows = librariesTable.querySelectorAll('.library-row');
    
    if (!searchTerm) {
        // Show all libraries
        allLibraryRows.forEach(row => {
            row.style.display = 'grid';
        });
        if (librarySummary) {
            librarySummary.textContent = `Showing ${allLibraryRows.length} ${allLibraryRows.length === 1 ? 'library' : 'libraries'} • Scroll to see all`;
        }
        return;
    }
    
    let visibleCount = 0;
    const totalCount = allLibraryRows.length;
    
    allLibraryRows.forEach(row => {
        const libraryName = row.dataset.libraryName || '';
        
        if (libraryName.toLowerCase().includes(searchTerm)) {
            row.style.display = 'grid';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    // Update summary
    if (librarySummary) {
        if (visibleCount === totalCount) {
            librarySummary.textContent = `Showing ${totalCount} ${totalCount === 1 ? 'library' : 'libraries'} • Scroll to see all`;
        } else {
            librarySummary.textContent = `Showing ${visibleCount} of ${totalCount} ${totalCount === 1 ? 'library' : 'libraries'}`;
        }
    }
}

function clearLibrarySearch(projectId) {
    const searchInput = document.getElementById(`library-search-${projectId}`);
    if (searchInput) {
        searchInput.value = '';
        filterLibraries(projectId); // Reset the filter
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateUrlDisplay();
    
    // Add event listeners for configuration changes
    const groupInput = document.getElementById('gitlab-group');
    const tagInput = document.getElementById('gitlab-tag');
    const branchInput = document.getElementById('gitlab-branch');
    
    if (groupInput) groupInput.addEventListener('change', updateUrlDisplay);
    if (tagInput) tagInput.addEventListener('change', updateUrlDisplay);
    if (branchInput) branchInput.addEventListener('change', updateUrlDisplay);
});
