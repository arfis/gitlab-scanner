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
        
        // Load saved configuration
        loadConfiguration();
        
        // Initialize autocomplete functionality
        initGoVersionAutocomplete();
        initLibraryAutocomplete();
        initLibraryVersionAutocomplete();
        initModuleAutocomplete();
        
        // Load cache stats
        loadCacheStats();
    } catch (error) {
        console.error('❌ Cannot connect to API server:', error);
        showError('Cannot connect to API server. Please make sure the server is running.');
    }
});

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showLoading(show, text = 'Loading...') {
    const loadingElement = document.getElementById('loading');
    const loadingTextElement = document.getElementById('loading-text');
    
    if (show) {
        loadingTextElement.textContent = text;
        loadingElement.style.display = 'block';
    } else {
        loadingElement.style.display = 'none';
    }
}

function showLoadingOverlay(show, text = 'Loading...', subtext = '') {
    const overlay = document.getElementById('loading-overlay');
    const textElement = document.getElementById('loading-overlay-text');
    const subtextElement = document.getElementById('loading-overlay-subtext');
    
    if (show) {
        textElement.textContent = text;
        subtextElement.textContent = subtext;
        overlay.style.display = 'flex';
    } else {
        overlay.style.display = 'none';
    }
}

// Toggle architecture options based on type
function toggleArchitectureOptions() {
    const type = document.getElementById('architecture-type').value;
    const singleOptions = document.getElementById('single-module-options');
    
    if (type === 'single') {
        singleOptions.style.display = 'block';
    } else {
        singleOptions.style.display = 'none';
    }
}

async function generateArchitecture() {
    const type = document.getElementById('architecture-type').value;
    const format = document.getElementById('format').value || 'mermaid';
    
    // Check if token is configured
    const token = document.getElementById('gitlab-token').value;
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }
    
    showLoading(true);
    document.getElementById('architecture-results').style.display = 'none';
    
    try {
        let response;
        
        if (type === 'full') {
            // Generate full architecture for all projects
            const ignore = document.getElementById('ignore').value;
            const showClientsOnly = document.getElementById('show-clients-only').checked;
            
            const params = new URLSearchParams();
            if (ignore) params.append('ignore', ignore);
            if (showClientsOnly) params.append('clients_only', 'true');
            params.append('format', format);
            
            response = await fetch(`${API_BASE}/architecture/full?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } else {
            // Generate architecture for single module
            const module = document.getElementById('module').value;
            const radius = document.getElementById('radius').value;
            const ref = document.getElementById('ref').value;
            const ignore = document.getElementById('ignore').value;
            const showClientsOnly = document.getElementById('show-clients-only').checked;
            
            if (!module) {
                alert('Please enter a module name');
                return;
            }
            
            const params = new URLSearchParams();
            if (module) params.append('module', module);
            if (radius) params.append('radius', radius);
            if (ref) params.append('ref', ref);
            if (ignore) params.append('ignore', ignore);
            if (showClientsOnly) params.append('clients_only', 'true');
            if (format) params.append('format', format);
            
            response = await fetch(`${API_BASE}/architecture?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const content = await response.text();
        displayArchitectureInResults(content, format);
        
    } catch (error) {
        showError(`Failed to generate architecture: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

function displayArchitectureInResults(content, format) {
    const resultsDiv = document.getElementById('architecture-results');
    const contentDiv = document.getElementById('architecture-content');
    
    if (format === 'mermaid') {
        // Clear any existing content
        contentDiv.innerHTML = '';
        
        // Create a unique ID for this diagram
        const diagramId = 'mermaid-diagram-' + Date.now();
        
        // Add the mermaid content with a unique ID
        contentDiv.innerHTML = `<div id="${diagramId}" class="mermaid">${content}</div>`;
        
        // Initialize Mermaid with better configuration (only once)
        if (!window.mermaidInitialized) {
            mermaid.initialize({ 
                startOnLoad: false,
                theme: 'default',
                themeVariables: {
                    primaryColor: '#3498db',
                    primaryTextColor: '#2c3e50',
                    primaryBorderColor: '#2980b9',
                    lineColor: '#34495e',
                    sectionBkgColor: '#ecf0f1',
                    altSectionBkgColor: '#bdc3c7',
                    gridColor: '#95a5a6',
                    secondaryColor: '#e74c3c',
                    tertiaryColor: '#f39c12'
                },
                flowchart: {
                    useMaxWidth: false,
                    htmlLabels: true
                }
            });
            window.mermaidInitialized = true;
        }
        
        // Render the specific diagram
        mermaid.init(undefined, document.getElementById(diagramId));
    } else {
        try {
            const jsonData = JSON.parse(content);
            contentDiv.innerHTML = `<pre>${JSON.stringify(jsonData, null, 2)}</pre>`;
        } catch (e) {
            contentDiv.innerHTML = `<pre>${content}</pre>`;
        }
    }
    
    resultsDiv.style.display = 'block';
}

function displayArchitecture(content, format) {
    const container = document.getElementById('architecture-container');
    const contentDiv = document.getElementById('architecture-content');
    
    if (format === 'mermaid') {
        contentDiv.innerHTML = `<pre>${content}</pre>`;
        // Initialize Mermaid
        mermaid.initialize({ startOnLoad: true });
        mermaid.init(undefined, contentDiv);
    } else {
        try {
            const data = JSON.parse(content);
            contentDiv.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        } catch (e) {
            contentDiv.innerHTML = `<pre>${content}</pre>`;
        }
    }
    
    container.style.display = 'block';
}

async function loadArchitectureFiles() {
    try {
        const response = await fetch(`${API_BASE}/architecture/files`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        displayFileList(data.files);
        
    } catch (error) {
        showError(`Failed to load files: ${error.message}`);
    }
}

function displayFileList(files) {
    const fileListDiv = document.getElementById('file-list');
    const filesDiv = document.getElementById('files');
    
    if (files.length === 0) {
        filesDiv.innerHTML = '<p>No architecture files found.</p>';
    } else {
        filesDiv.innerHTML = files.map(file => `
            <div class="file-item">
                <div class="file-info">
                    <div class="file-name">${file.filename}</div>
                    <div class="file-meta">
                        ${file.type.toUpperCase()} • ${formatFileSize(file.size)} • 
                        ${new Date(file.modified_at).toLocaleString()}
                        ${file.module ? ` • Module: ${file.module}` : ''}
                    </div>
                </div>
                <div class="file-actions">
                    <button onclick="loadArchitectureFile('${file.filename}')">Load</button>
                </div>
            </div>
        `).join('');
    }
    
    fileListDiv.style.display = 'block';
}

async function loadArchitectureFile(filename) {
    try {
        const response = await fetch(`${API_BASE}/architecture/files/${filename}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const content = await response.text();
        const format = filename.endsWith('.mmd') ? 'mermaid' : 'json';
        displayArchitecture(content, format);
        
    } catch (error) {
        showError(`Failed to load file: ${error.message}`);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
           versionInput.placeholder = `Version for ${this.value} (e.g., v1.9.1)`;
       } else {
           versionInput.disabled = true;
           versionInput.value = '';
           versionInput.placeholder = 'Version (e.g., v1.9.1)';
       }
   });
       }
       
       // Initialize autocomplete for library versions
       function initLibraryVersionAutocomplete() {
   const input = document.getElementById('search-library-version');
   const dropdown = document.getElementById('library-version-dropdown');
   const libraryInput = document.getElementById('search-library');
   
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
    
    // Check if token is configured
    const token = document.getElementById('gitlab-token').value;
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }
    
    // Determine loading message based on search mode
    let loadingMessage = 'Searching Projects';
    let loadingSubtext = 'Fetching data...';
    
    switch (searchMode) {
        case 'cache':
            loadingMessage = 'Searching Cache';
            loadingSubtext = 'Looking for cached results...';
            break;
        case 'live':
            loadingMessage = 'Live Search';
            loadingSubtext = 'Fetching fresh data from GitLab...';
            break;
        case 'cache-first':
            loadingMessage = 'Smart Search';
            loadingSubtext = 'Checking cache first, then GitLab...';
            break;
    }
    
    // Show enhanced loading overlay
    showLoadingOverlay(true, loadingMessage, loadingSubtext);
    document.getElementById('project-results').style.display = 'none';
    
    try {
        const params = new URLSearchParams();
        if (goVersion) params.append('go_version', goVersion);
        if (goVersionComparison) params.append('go_version_comparison', goVersionComparison);
        if (library) params.append('library', library);
        if (libraryVersion) {
            params.append('version', libraryVersion);
            params.append('version_comparison', versionComparison);
        }
        if (group) params.append('group', group);
        if (tag) params.append('tag', tag);
        
        // Add cache preference based on search mode
        switch (searchMode) {
            case 'cache':
                params.append('use_cache', 'true');
                params.append('force_cache', 'true');
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
        showLoadingOverlay(false);
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
                modeInfo = ' • <span style="color: #27ae60;">Smart Mode (Cache Hit)</span>';
            } else {
                cacheInfo = ' • <span style="color: #3498db;">🔄 Live Data</span>';
                modeInfo = ' • <span style="color: #f39c12;">Smart Mode (Cache Miss)</span>';
            }
            break;
    }
    
    statsDiv.innerHTML = `Found ${data.count} project(s) matching your criteria${cacheInfo}${modeInfo}${cachedAt ? ` • <small style="color: #7f8c8d;">Cached: ${new Date(cachedAt).toLocaleString()}</small>` : ''}`;
    statsDiv.style.display = 'block';
    
    // Display projects
    if (data.projects && data.projects.length > 0) {
        projectsDiv.innerHTML = data.projects.map(project => `
            <div class="project-item">
                <div class="project-info">
                    <div class="project-name">${project.name}</div>
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
                </div>
            </div>
        `).join('');
    } else {
        projectsDiv.innerHTML = '<p>No projects found matching your criteria.</p>';
    }
    
    resultsDiv.style.display = 'block';
}

function clearSearch() {
    document.getElementById('search-go-version').value = '';
    document.getElementById('go-version-comparison').value = '';
    document.getElementById('search-library').value = '';
    document.getElementById('search-library-version').value = '';
    document.getElementById('search-library-version').disabled = true;
    document.getElementById('version-comparison').value = 'exact';
    document.getElementById('search-group').value = '';
    document.getElementById('search-tag').value = '';
    document.getElementById('project-results').style.display = 'none';
}

// Configuration management functions
function loadConfiguration() {
    // Load from localStorage
    const savedToken = localStorage.getItem('gitlab-token');
    const savedGroup = localStorage.getItem('gitlab-group');
    const savedTag = localStorage.getItem('gitlab-tag');
    
    if (savedToken) {
        document.getElementById('gitlab-token').value = savedToken;
    }
    if (savedGroup) {
        document.getElementById('gitlab-group').value = savedGroup;
    }
    if (savedTag) {
        document.getElementById('gitlab-tag').value = savedTag;
    }
}

async function saveConfiguration() {
    const token = document.getElementById('gitlab-token').value;
    const group = document.getElementById('gitlab-group').value;
    const tag = document.getElementById('gitlab-tag').value;
    
    if (!token.trim()) {
        showConfigStatus('Please enter a GitLab API token', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token: token,
                group: group,
                tag: tag
            })
        });
        
        if (response.ok) {
            // Save to localStorage
            localStorage.setItem('gitlab-token', token);
            localStorage.setItem('gitlab-group', group);
            localStorage.setItem('gitlab-tag', tag);
            
            showConfigStatus('Configuration saved successfully', 'success');
        } else {
            const error = await response.text();
            showConfigStatus(`Failed to save configuration: ${error}`, 'error');
        }
    } catch (error) {
        showConfigStatus(`Failed to save configuration: ${error.message}`, 'error');
    }
}

async function testConnection() {
    const token = document.getElementById('gitlab-token').value;
    
    if (!token.trim()) {
        showConfigStatus('Please enter a GitLab API token first', 'warning');
        return;
    }
    
    showConfigStatus('Testing connection...', 'warning');
    
    try {
        const response = await fetch(`${API_BASE}/config/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token: token
            })
        });
        
        if (response.ok) {
            showConfigStatus('✅ Connection successful!', 'success');
        } else {
            const error = await response.text();
            showConfigStatus(`❌ Connection failed: ${error}`, 'error');
        }
    } catch (error) {
        showConfigStatus(`❌ Connection failed: ${error.message}`, 'error');
    }
}

function showConfigStatus(message, type) {
    const statusElement = document.getElementById('config-status');
    statusElement.textContent = message;
    statusElement.className = `config-status ${type}`;
    
    // Clear status after 5 seconds
    setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = '';
    }, 5000);
}

// Cache management functions
async function loadInitialCache() {
    const token = document.getElementById('gitlab-token').value;
    if (!token.trim()) {
        showCacheStatus('Please configure your GitLab API token first', 'error');
        return;
    }

    showCacheStatus('Loading initial cache...', 'warning');
    showLoadingOverlay(true, 'Loading Initial Cache', 'Fetching all projects from GitLab and analyzing Go modules...');

    try {
        const response = await fetch(`${API_BASE}/cache/load`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            showCacheStatus(`✅ Initial cache loaded: ${result.projects_cached} projects with detailed information cached`, 'success');
            await loadCacheStats();
        } else {
            const errorData = await response.json();
            if (errorData.error === 'Cache service unavailable') {
                showCacheStatus(`⚠️ ${errorData.message}`, 'warning');
            } else {
                showCacheStatus(`❌ Failed to load initial cache: ${errorData.message || errorData}`, 'error');
            }
        }
    } catch (error) {
        showCacheStatus(`❌ Failed to load initial cache: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function refreshCache() {
    const token = document.getElementById('gitlab-token').value;
    if (!token.trim()) {
        showCacheStatus('Please configure your GitLab API token first', 'error');
        return;
    }
    
    showCacheStatus('Refreshing cache...', 'warning');
    showLoadingOverlay(true, 'Refreshing Cache', 'Updating cached data from GitLab...');
    
    try {
        const response = await fetch(`${API_BASE}/cache/refresh`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            showCacheStatus('✅ Cache refreshed successfully', 'success');
            await loadCacheStats();
        } else {
            const errorData = await response.json();
            if (errorData.error === 'Cache service unavailable') {
                showCacheStatus(`⚠️ ${errorData.message}`, 'warning');
            } else {
                showCacheStatus(`❌ Failed to refresh cache: ${errorData.message || errorData}`, 'error');
            }
        }
    } catch (error) {
        showCacheStatus(`❌ Failed to refresh cache: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function clearCache() {
    const token = document.getElementById('gitlab-token').value;
    if (!token.trim()) {
        showCacheStatus('Please configure your GitLab API token first', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to clear all cached data? This action cannot be undone.')) {
        return;
    }
    
    showCacheStatus('Clearing cache...', 'warning');
    showLoadingOverlay(true, 'Clearing Cache', 'Removing all cached data...');
    
    try {
        const response = await fetch(`${API_BASE}/cache/clear`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            showCacheStatus('✅ Cache cleared successfully', 'success');
            await loadCacheStats();
        } else {
            const errorData = await response.json();
            if (errorData.error === 'Cache service unavailable') {
                showCacheStatus(`⚠️ ${errorData.message}`, 'warning');
            } else {
                showCacheStatus(`❌ Failed to clear cache: ${errorData.message || errorData}`, 'error');
            }
        }
    } catch (error) {
        showCacheStatus(`❌ Failed to clear cache: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function loadCacheStats() {
    const token = document.getElementById('gitlab-token').value;
    if (!token.trim()) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/cache/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            displayCacheStats(stats);
        }
    } catch (error) {
        console.log('Failed to load cache stats:', error);
    }
}

function displayCacheStats(stats) {
    const statsDiv = document.getElementById('cache-stats');
    const totalCached = document.getElementById('total-cached');
    const cacheType = document.getElementById('cache-type');
    const searchHashes = document.getElementById('search-hashes');
    
    if (stats) {
        totalCached.textContent = stats.total_cached_projects || 0;
        cacheType.textContent = stats.cache_type || 'Hash-Based';
        searchHashes.textContent = stats.search_hashes ? stats.search_hashes.length : 0;
        statsDiv.style.display = 'block';
    }
}

function showCacheStatus(message, type) {
    const statusElement = document.getElementById('cache-status');
    statusElement.textContent = message;
    statusElement.className = `cache-status ${type}`;

    // Clear status after 5 seconds
    setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = '';
    }, 5000);
}

// Check for changed projects
async function checkChangedProjects() {
    const token = document.getElementById('gitlab-token').value;
    
    if (!token.trim()) {
        showCacheStatus('Please configure your GitLab API token first', 'error');
        return;
    }

    showCacheStatus('Checking for changed projects...', 'warning');
    showLoadingOverlay(true, 'Checking Changed Projects', 'Comparing current projects with cached data...');

    try {
        const response = await fetch(`${API_BASE}/projects/changed`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.count > 0) {
                showCacheStatus(`✅ Found ${data.count} changed projects`, 'success');
                // Display changed projects
                displayChangedProjects(data.projects);
            } else {
                showCacheStatus('✅ No projects have changed since last cache build', 'success');
            }
        } else {
            const errorData = await response.json();
            if (errorData.error === 'Cache service unavailable') {
                showCacheStatus(`⚠️ ${errorData.message}`, 'warning');
            } else {
                showCacheStatus(`❌ Failed to check changed projects: ${errorData.message || errorData}`, 'error');
            }
        }
    } catch (error) {
        showCacheStatus(`❌ Failed to check changed projects: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// Display changed projects
function displayChangedProjects(projects) {
    const resultsDiv = document.getElementById('project-results');
    const statsDiv = document.getElementById('search-stats');
    const projectsDiv = document.getElementById('projects-list');
    
    statsDiv.innerHTML = `Found ${projects.length} project(s) that have changed since last cache build`;
    statsDiv.style.display = 'block';
    
    if (projects.length > 0) {
        projectsDiv.innerHTML = projects.map(project => `
            <div class="project-item">
                <div class="project-info">
                    <div class="project-name">${project.name} <span style="color: #e74c3c; font-size: 12px;">(CHANGED)</span></div>
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
                </div>
            </div>
        `).join('');
    } else {
        projectsDiv.innerHTML = '<div class="no-results">No changed projects found.</div>';
    }
    
    resultsDiv.style.display = 'block';
}

// Webhook function to refresh specific project cache
async function refreshProjectCache() {
    const projectId = document.getElementById('webhook-project-id').value;
    const token = document.getElementById('gitlab-token').value;
    
    if (!projectId.trim()) {
        showCacheStatus('Please enter a project ID', 'error');
        return;
    }
    
    if (!token.trim()) {
        showCacheStatus('Please configure your GitLab API token first', 'error');
        return;
    }

    showCacheStatus('Refreshing project cache...', 'warning');
    showLoadingOverlay(true, 'Refreshing Project Cache', `Updating cache for project ${projectId}...`);

    try {
        const response = await fetch(`${API_BASE}/cache/refresh-project`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                project_id: parseInt(projectId),
                token: token
            })
        });

        if (response.ok) {
            showCacheStatus(`✅ Project ${projectId} cache refreshed successfully`, 'success');
            await loadCacheStats();
        } else {
            const errorData = await response.json();
            if (errorData.error === 'Cache service unavailable') {
                showCacheStatus(`⚠️ ${errorData.message}`, 'warning');
            } else {
                showCacheStatus(`❌ Failed to refresh project cache: ${errorData.message || errorData}`, 'error');
            }
        }
    } catch (error) {
        showCacheStatus(`❌ Failed to refresh project cache: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// Initialize Mermaid
mermaid.initialize({ 
    startOnLoad: true,
    theme: 'default',
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true
    }
});
    
