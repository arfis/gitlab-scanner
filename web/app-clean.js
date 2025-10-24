'use strict';

const API_BASE = '/api';

// Test API connection on page load
window.addEventListener('load', async function() {
    try {
        const response = await fetch('/health');
        if (response.ok) {
            console.log('✅ API server is running');
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
        console.error('❌ Cannot connect to API server:', error);
        showError('Cannot connect to API server. Please make sure the server is running.');
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
    const loadingElement = document.getElementById('loading');
    const loadingTextElement = document.getElementById('loading-text');
    
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
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
        <strong>Found ${data.total || 0} project(s)</strong>${cacheInfo}${modeInfo}
    `;
    statsDiv.style.display = 'block';
    
    // Display projects
    if (data.projects && data.projects.length > 0) {
        projectsDiv.innerHTML = data.projects.map(project => `
            <div class="project-item" data-project-id="${project.id}">
                <div class="project-header">
                    <div class="project-name">${project.name}</div>
                    <div class="project-actions">
                        <button onclick="loadProjectLibrariesForProject(${project.id}, '${project.name}')" 
                                class="btn btn-primary btn-sm" 
                                style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            📦 Manage Libraries
                        </button>
                        <button onclick="checkOutdatedLibrariesForProject(${project.id}, '${project.name}')" 
                                class="btn btn-secondary btn-sm" 
                                style="background: #6c757d; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 5px;">
                            🔍 Check Updates
                        </button>
                    </div>
                </div>
                <div class="project-path">${project.path_with_namespace}</div>
                ${project.web_url ? `
                    <div class="project-url">
                        <a href="${project.web_url}" target="_blank" rel="noopener noreferrer">
                            🔗 ${project.web_url}
                        </a>
                    </div>
                ` : ''}
                <div class="project-details">
                    ${project.go_version ? `
                        <div class="detail-item">
                            <div class="detail-label">Go Version</div>
                            <div class="detail-value">${project.go_version}</div>
                        </div>
                    ` : ''}
                    ${project.libraries && project.libraries.length > 0 ? `
                        <div class="detail-item">
                            <div class="detail-label">Libraries (${project.libraries.length})</div>
                            <div class="libraries-list">
                                ${project.libraries.map(lib => `
                                    <div class="library-item">
                                        <span class="library-name">${lib.name}</span>
                                        <span class="library-version">${lib.version}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="project-libraries-management" id="libraries-${project.id}" style="display: none;">
                    <div class="libraries-management-header">
                        <h4>📦 Library Management for ${project.name}</h4>
                        <button onclick="closeProjectLibraries(${project.id})" 
                                style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                            ✕ Close
                        </button>
                    </div>
                    <div class="libraries-management-content" id="libraries-content-${project.id}">
                        <div style="text-align: center; color: #6c757d; font-style: italic; padding: 20px;">
                            Loading libraries...
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
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
            const isUpdatable = library.is_updatable;
            const isDowngradable = library.is_downgradable;
            const statusColor = isUpdatable ? '#d4edda' : '#f8f9fa';
            const statusText = isUpdatable ? 'Updatable' : 'Latest';
            
            html += `
                <div style="border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin-bottom: 8px; background: ${statusColor};" 
                     data-library-index="${index}">
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <input type="checkbox" id="lib-${projectId}-${index}" style="margin-right: 10px;" 
                               onchange="toggleLibrarySelectionInProject(${projectId}, ${index})">
                        <div style="flex: 1;">
                            <strong>${library.library_name}</strong>
                            <div style="color: #6c757d; font-size: 12px; margin-top: 2px;">
                                Current: ${library.current_version} | Latest: ${library.latest_version}
                            </div>
                            <div style="color: #28a745; font-size: 11px; margin-top: 2px;">
                                ${statusText} ${isDowngradable ? '| Downgradable' : ''}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <label style="font-size: 12px; color: #6c757d;">Target Version:</label>
                        <input type="text" id="lib-version-${projectId}-${index}" 
                               placeholder="${library.latest_version}" 
                               value="${library.latest_version}"
                               style="flex: 1; padding: 4px 8px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
                        <button onclick="updateSingleLibraryInProject(${projectId}, ${index})" 
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
            selectedUpdates.push({
                library_name: library.library_name,
                target_version: versionInput.value || library.latest_version
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

async function updateSingleLibraryInProject(projectId, index) {
    const token = document.getElementById('gitlab-token').value;
    const versionInput = document.getElementById(`lib-version-${projectId}-${index}`);
    
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }
    
    const libraries = projectLibrariesCache[projectId] || [];
    const library = libraries[index];
    const targetVersion = versionInput.value;
    
    if (!targetVersion) {
        showError('Please enter a target version');
        return;
    }
    
    showLoading(true, `Updating ${library.library_name} to ${targetVersion}...`);
    
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
                    library_name: library.library_name,
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
