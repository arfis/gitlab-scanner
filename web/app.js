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
        
        // Load saved configuration from API/local storage
        await loadConfiguration();
        
        // Initialize autocomplete functionality
        initGoVersionAutocomplete();
        initLibraryAutocomplete();
        initLibraryVersionAutocomplete();
        initModuleAutocomplete();
        
        // Load cache stats
        loadCacheStats();
        
        // Update URL display
        updateUrlDisplay();
        
        // Add event listeners for URL updates
        document.getElementById('gitlab-group').addEventListener('input', updateUrlDisplay);
        document.getElementById('gitlab-tag').addEventListener('input', updateUrlDisplay);
        document.getElementById('gitlab-branch').addEventListener('change', updateUrlDisplay);
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
    const formatSelect = document.getElementById('format');
    const format = formatSelect ? (formatSelect.value || 'mermaid') : 'mermaid';
    
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
            const branch = getSelectedBranch();
            
            const params = new URLSearchParams();
            if (ignore) params.append('ignore', ignore);
            if (showClientsOnly) params.append('clients_only', 'true');
            if (branch) params.append('branch', branch);
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
            const branch = getSelectedBranch();
            
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
            if (branch) params.append('branch', branch);
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
function getBranchSelect() {
    return document.getElementById('gitlab-branch');
}

function ensureBranchSelectOptions(branches) {
    const select = getBranchSelect();
    if (!select) {
        return;
    }

    const options = Array.isArray(branches) ? branches : [];
    const saved = localStorage.getItem('gitlab-branch');
    const current = select.value;

    select.innerHTML = '';

    if (options.length === 0) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'No branches configured';
        select.appendChild(placeholder);
        select.disabled = true;
        return;
    }

    select.disabled = false;
    options.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch;
        option.textContent = branch;
        select.appendChild(option);
    });

    const target = options.includes(saved)
        ? saved
        : options.includes(current)
            ? current
            : options[0];
    select.value = target;
    localStorage.setItem('gitlab-branch', target);

    if (!select.dataset.branchListenerAttached) {
        select.addEventListener('change', () => {
            localStorage.setItem('gitlab-branch', select.value);
        });
        select.dataset.branchListenerAttached = 'true';
    }
}

function getSelectedBranch() {
    const select = getBranchSelect();
    return select ? (select.value || '').trim() : '';
}

async function loadConfiguration() {
    const tokenInput = document.getElementById('gitlab-token');
    const groupInput = document.getElementById('gitlab-group');
    const tagInput = document.getElementById('gitlab-tag');

    // Drop legacy cached value if present
    localStorage.removeItem('gitlab-branches');

    try {
        const response = await fetch(`${API_BASE}/config`);
        if (response.ok) {
            const data = await response.json();
            if (data && typeof data.group === 'string' && data.group !== '') {
                groupInput.value = data.group;
            }
            if (data && typeof data.tag === 'string' && data.tag !== '') {
                tagInput.value = data.tag;
            }
            if (data && typeof data.token === 'string' && data.token !== '') {
                tokenInput.value = data.token;
            }
            if (data && Array.isArray(data.branches)) {
                ensureBranchSelectOptions(data.branches);
            }
        } else {
            console.warn(`Failed to load configuration: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.warn('Failed to load configuration from API:', error);
    }

    const savedToken = localStorage.getItem('gitlab-token');
    if (savedToken) {
        tokenInput.value = savedToken;
    }

    const savedGroup = localStorage.getItem('gitlab-group');
    if (!groupInput.value && savedGroup) {
        groupInput.value = savedGroup;
    }

    const savedTag = localStorage.getItem('gitlab-tag');
    if (!tagInput.value && savedTag) {
        tagInput.value = savedTag;
    }

    if (!getSelectedBranch()) {
        const savedBranch = localStorage.getItem('gitlab-branch');
        if (savedBranch) {
            const select = getBranchSelect();
            if (select && Array.from(select.options).some(opt => opt.value === savedBranch)) {
                select.value = savedBranch;
                localStorage.setItem('gitlab-branch', savedBranch);
            }
        }
    }

    const branchSelect = getBranchSelect();
    if (branchSelect && branchSelect.options.length === 0) {
        const savedBranch = localStorage.getItem('gitlab-branch');
        if (savedBranch) {
            ensureBranchSelectOptions([savedBranch]);
        }
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
        // First clear the cache to force fresh data
        const clearResponse = await fetch(`${API_BASE}/cache/clear`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!clearResponse.ok) {
            console.warn('Failed to clear cache, continuing with refresh...');
        }
        
        // Then load fresh cache
        const response = await fetch(`${API_BASE}/cache/load`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            showCacheStatus(`✅ Cache refreshed successfully: ${result.projects_cached || 'Unknown'} projects cached`, 'success');
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

// Update URL display based on current configuration
function updateUrlDisplay() {
    const group = document.getElementById('gitlab-group').value || 'nghis';
    const tag = document.getElementById('gitlab-tag').value || 'services';
    const branch = document.getElementById('gitlab-branch').value || 'default';
    
    // Update API endpoint
    document.getElementById('api-endpoint').value = `/api/v4/groups/${group}/projects`;
    
    // Update full URL
    const fullUrl = `https://gitlab.com/api/v4/groups/${group}/projects?with_issues_enabled=true&with_merge_requests_enabled=true&order_by=last_activity_at&sort=desc&per_page=100`;
    document.getElementById('full-url').value = fullUrl;
    
    console.log('🔗 GitLab API URL updated:', fullUrl);
    showConfigStatus('URL display updated', 'success');
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

// OpenAPI Documentation Functions
let allOpenAPIProjects = []; // Store all projects for search
let filteredOpenAPIProjects = []; // Store filtered projects

async function loadProjectsWithOpenAPI() {
    try {
        showLoading(true, 'Loading projects with OpenAPI specifications...');
        
        // Use the new search endpoint to get projects with OpenAPI
        const response = await fetch(`${API_BASE}/projects/search-openapi?has_openapi=true&limit=100`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.projects && data.projects.length > 0) {
            allOpenAPIProjects = data.projects;
            filteredOpenAPIProjects = [...allOpenAPIProjects];
            displayProjectsWithOpenAPI(filteredOpenAPIProjects);
            // Show the side-by-side layout
            document.getElementById('openapi-layout').style.display = 'flex';
        } else {
            showError('No projects with OpenAPI specifications found. Make sure to load cache first.');
        }
    } catch (error) {
        console.error('Error loading projects with OpenAPI:', error);
        showError(`Failed to load projects with OpenAPI: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

async function loadAllProjectsForOpenAPI() {
    try {
        showLoading(true, 'Loading all projects...');
        
        // Use the new search endpoint to get all projects
        const response = await fetch(`${API_BASE}/projects/search-openapi?limit=200`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.projects && data.projects.length > 0) {
            allOpenAPIProjects = data.projects;
            filteredOpenAPIProjects = [...allOpenAPIProjects];
            displayProjectsWithOpenAPI(filteredOpenAPIProjects);
            // Show the side-by-side layout
            document.getElementById('openapi-layout').style.display = 'flex';
        } else {
            showError('No projects found. Make sure to load cache first.');
        }
    } catch (error) {
        console.error('Error loading all projects:', error);
        showError(`Failed to load projects: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

function displayProjectsWithOpenAPI(projects) {
    const list = document.getElementById('openapi-projects-list');
    const searchResults = document.getElementById('openapi-search-results');
    
    list.innerHTML = '';
    
    // Check if projects is valid
    if (!projects || !Array.isArray(projects) || projects.length === 0) {
        searchResults.style.display = 'block';
        return;
    }
    
    searchResults.style.display = 'none';
    
    projects.forEach(project => {
        // Validate project object
        if (!project || !project.id || !project.name) {
            console.warn('Invalid project object:', project);
            return;
        }
        
        const projectDiv = document.createElement('div');
        projectDiv.className = 'project-item';
        projectDiv.onclick = () => selectProject(project.id, project.name, projectDiv);
        
        // Check if project has OpenAPI
        const hasOpenAPI = project.openapi && project.openapi.found;
        const openAPIInfo = hasOpenAPI 
            ? `📋 ${project.openapi.path} (${project.openapi.content_length || 0} chars)`
            : '❌ No OpenAPI specification found';
        
        projectDiv.innerHTML = `
            <h4>${project.name || 'Unknown Project'}</h4>
            <p>${project.path || 'No path'}</p>
            <div class="openapi-info ${hasOpenAPI ? '' : 'no-openapi'}">
                ${openAPIInfo}
            </div>
        `;
        
        list.appendChild(projectDiv);
    });
}

// Debounce timer for search
let searchTimeout = null;

async function searchOpenAPIProjects() {
    const searchTerm = document.getElementById('openapi-search').value || 
                      document.getElementById('openapi-panel-search').value;
    const filterValue = document.getElementById('openapi-filter').value || 
                       document.getElementById('openapi-panel-filter').value;
    
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // If no search term and showing all, use cached results
    if (!searchTerm && filterValue === 'all' && allOpenAPIProjects.length > 0) {
        filteredOpenAPIProjects = [...allOpenAPIProjects];
        displayProjectsWithOpenAPI(filteredOpenAPIProjects);
        return;
    }
    
    // Add visual feedback for search
    const searchInput = document.getElementById('openapi-search') || document.getElementById('openapi-panel-search');
    if (searchInput) {
        searchInput.classList.add('searching');
    }
    
    // Debounce the search to avoid too many API calls
    searchTimeout = setTimeout(async () => {
        try {
            // Show loading only for actual API calls
            if (searchTerm || (filterValue !== 'all' && filterValue !== '')) {
                showLoading(true, 'Searching projects...');
            }
            
            // Build search URL
            const searchParams = new URLSearchParams();
            if (searchTerm) searchParams.append('q', searchTerm);
            if (filterValue === 'has-openapi') searchParams.append('has_openapi', 'true');
            if (filterValue === 'no-openapi') searchParams.append('has_openapi', 'false');
            searchParams.append('limit', '100');
            
            const response = await fetch(`${API_BASE}/projects/search-openapi?${searchParams.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Debug logging
            console.log('Search API response:', data);
            
            // Validate response structure
            if (!data) {
                throw new Error('Invalid response from server');
            }
            
            if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
                filteredOpenAPIProjects = data.projects;
                
                // Show dropdown results if there's a search term
                if (searchTerm) {
                    displaySearchDropdown(data.projects);
                } else {
                    displayProjectsWithOpenAPI(filteredOpenAPIProjects);
                }
            } else {
                // Show no results message
                if (searchTerm) {
                    displaySearchDropdown([]);
                } else {
                    const list = document.getElementById('openapi-projects-list');
                    const searchResults = document.getElementById('openapi-search-results');
                    
                    list.innerHTML = '';
                    searchResults.style.display = 'block';
                    searchResults.querySelector('.search-info').textContent = 
                        `No projects found matching "${searchTerm || 'your criteria'}"`;
                }
            }
        } catch (error) {
            console.error('Error searching projects:', error);
            showError(`Failed to search projects: ${error.message}`);
            
            // Fallback: show cached results if available
            if (allOpenAPIProjects.length > 0) {
                console.log('Falling back to cached results');
                filteredOpenAPIProjects = [...allOpenAPIProjects];
                displayProjectsWithOpenAPI(filteredOpenAPIProjects);
            }
        } finally {
            showLoading(false);
            // Remove searching visual feedback
            const searchInput = document.getElementById('openapi-search') || document.getElementById('openapi-panel-search');
            if (searchInput) {
                searchInput.classList.remove('searching');
            }
        }
    }, 300); // 300ms debounce delay
}

function filterOpenAPIProjects() {
    searchOpenAPIProjects(); // Reuse search logic
}

function displaySearchDropdown(projects) {
    const dropdown = document.getElementById('openapi-search-dropdown');
    const resultsContainer = document.getElementById('openapi-search-results-dropdown');
    
    if (!dropdown || !resultsContainer) return;
    
    resultsContainer.innerHTML = '';
    
    if (projects.length === 0) {
        resultsContainer.innerHTML = '<div class="search-dropdown-item" style="text-align: center; color: #6c757d; font-style: italic;">No projects found</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    // Limit to 10 results for dropdown
    const limitedProjects = projects.slice(0, 10);
    
    limitedProjects.forEach(project => {
        const item = document.createElement('div');
        item.className = 'search-dropdown-item';
        
        const hasOpenAPI = project.openapi && project.openapi.found;
        const openAPIBadge = hasOpenAPI 
            ? '<span class="openapi-badge has-openapi">Has OpenAPI</span>'
            : '<span class="openapi-badge no-openapi">No OpenAPI</span>';
        
        item.innerHTML = `
            <div>
                <h5>${project.name || 'Unknown Project'}</h5>
                <p class="project-path">${project.path || 'No path'}</p>
            </div>
            <div>
                ${openAPIBadge}
            </div>
        `;
        
        item.onclick = () => {
            selectProjectFromDropdown(project);
        };
        
        resultsContainer.appendChild(item);
    });
    
    dropdown.style.display = 'block';
}

function selectProjectFromDropdown(project) {
    // Hide dropdown
    const dropdown = document.getElementById('openapi-search-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    
    // Set search input to selected project
    const searchInput = document.getElementById('openapi-search');
    if (searchInput) {
        searchInput.value = project.name;
    }
    
    // Load the project's OpenAPI if it has one
    if (project.openapi && project.openapi.found) {
        viewProjectOpenAPI(project.id, project.name);
    } else {
        // Show message that project doesn't have OpenAPI
        const viewer = document.getElementById('openapi-viewer');
        const placeholder = document.getElementById('openapi-placeholder');
        
        if (viewer) viewer.style.display = 'none';
        if (placeholder) {
            placeholder.style.display = 'block';
            const placeholderContent = placeholder.querySelector('.placeholder-content');
            if (placeholderContent) {
                placeholderContent.innerHTML = `
                    <h3>❌ No OpenAPI Specification</h3>
                    <p>This project doesn't have an OpenAPI specification</p>
                `;
            }
        }
    }
}

function showSearchResults() {
    const searchTerm = document.getElementById('openapi-search').value;
    if (searchTerm && searchTerm.length > 0) {
        const dropdown = document.getElementById('openapi-search-dropdown');
        if (dropdown) {
            dropdown.style.display = 'block';
        }
    }
}

function hideSearchResults() {
    // Delay hiding to allow clicking on dropdown items
    setTimeout(() => {
        const dropdown = document.getElementById('openapi-search-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }, 200);
}

// cURL Parser Functions
function parseCurlAndFindProject() {
    const curlInput = document.getElementById('curl-input').value.trim();
    const resultDiv = document.getElementById('curl-result');
    const resultContent = document.getElementById('curl-result-content');
    
    if (!curlInput) {
        showCurlResult('Please paste a cURL command', 'error');
        return;
    }
    
    try {
        const parsedUrl = parseCurlCommand(curlInput);
        if (!parsedUrl) {
            showCurlResult('Could not extract URL from cURL command', 'error');
            return;
        }
        
        showCurlResult(`Extracted URL: ${parsedUrl}`, 'info');
        console.log('Parsed URL:', parsedUrl);
        findProjectByUrl(parsedUrl);
        
    } catch (error) {
        console.error('Error parsing cURL:', error);
        showCurlResult(`Error parsing cURL: ${error.message}`, 'error');
    }
}

function parseCurlCommand(curlCommand) {
    // Remove line breaks and normalize spaces
    const normalized = curlCommand.replace(/\s+/g, ' ').trim();
    
    // Extract URL using regex patterns
    const urlPatterns = [
        // Standard cURL with URL
        /curl\s+['"]?([^'"\s]+)['"]?/i,
        // cURL with -X and URL
        /curl\s+-X\s+\w+\s+['"]?([^'"\s]+)['"]?/i,
        // cURL with multiple options and URL
        /curl\s+[^'"\s]*['"]?([^'"\s]+)['"]?/i,
        // Look for http:// or https:// URLs
        /(https?:\/\/[^\s'"]+)/i
    ];
    
    for (const pattern of urlPatterns) {
        const match = normalized.match(pattern);
        if (match && match[1]) {
            let url = match[1];
            // Clean up the URL
            url = url.replace(/['"]/g, '');
            // Remove trailing parameters that might be part of the command
            url = url.split(' ')[0];
            return url;
        }
    }
    
    return null;
}

function findProjectByUrl(url) {
    showLoading(true, 'Searching for project...');
    
    // Extract domain/path information from URL
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    
    // Extract the actual endpoint (last part of the path)
    const pathParts = pathname.split('/').filter(part => part.length > 0);
    const actualEndpoint = pathParts[pathParts.length - 1]; // Last part like "base-reg"
    const endpointPath = `/${actualEndpoint}`; // Just the endpoint like "/base-reg"
    
    // Create search terms from the actual endpoint
    const searchTerms = [
        actualEndpoint,  // Just "base-reg"
        endpointPath,   // "/base-reg"
        actualEndpoint.replace(/-/g, ' '), // "base reg"
        actualEndpoint.replace(/-/g, '_'), // "base_reg"
    ].filter(term => term && term.length > 0);
    
    console.log('Searching for project with actual endpoint:', actualEndpoint);
    console.log('Search terms:', searchTerms);
    
    // Try multiple search strategies - focus on actual endpoint
    const searchStrategies = [
        // Strategy 1: Actual endpoint with quotes for exact matching
        `"${actualEndpoint}"`,
        // Strategy 2: Actual endpoint
        actualEndpoint,
        // Strategy 3: Endpoint path
        endpointPath,
        // Strategy 4: Endpoint with spaces
        actualEndpoint.replace(/-/g, ' '),
        // Strategy 5: Endpoint with underscores
        actualEndpoint.replace(/-/g, '_')
    ].filter(term => term && term.length > 0);
    
    // Try each search strategy
    trySearchStrategy(searchStrategies, 0, url);
}

function scoreAndSortResults(projects, searchQuery) {
    const searchLower = searchQuery.toLowerCase().replace(/"/g, ''); // Remove quotes for comparison
    
    return projects.map(project => {
        let score = 0;
        const projectName = (project.name || '').toLowerCase();
        const projectPath = (project.path || '').toLowerCase();
        
        // Check if project has OpenAPI content to search in
        const hasOpenAPIContent = project.openapi && project.openapi.content_length > 0;
        
        // Highest score: Project name matches endpoint path
        if (projectName === searchLower) {
            score += 10000;
        }
        
        // High score: Project name contains endpoint path
        else if (projectName.includes(searchLower)) {
            score += 5000;
        }
        
        // Medium score: Project path contains endpoint path
        else if (projectPath.includes(searchLower)) {
            score += 3000;
        }
        
        // Check if OpenAPI content contains the endpoint path
        if (hasOpenAPIContent) {
            // This would require fetching the OpenAPI content, but for now we'll assume
            // projects with OpenAPI that match the name/path are relevant
            score += 1000;
        }
        
        // Lower score for partial matches
        else {
            score += 100;
        }
        
        return {
            ...project,
            relevanceScore: score
        };
    })
    .filter(project => project.relevanceScore > 0) // Only keep projects with some relevance
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 3); // Only return top 3 results
}

function trySearchStrategy(searchStrategies, index, originalUrl) {
    if (index >= searchStrategies.length) {
        showLoading(false);
        showCurlResult('No projects found matching the URL. Try searching manually.', 'warning');
        return;
    }
    
    const searchQuery = searchStrategies[index];
    console.log(`Trying search strategy ${index + 1}: "${searchQuery}"`);
    
    // Use the existing search API with OpenAPI filter
    const searchParams = new URLSearchParams({
        query: searchQuery,
        hasOpenAPI: 'true',  // Only search for projects with OpenAPI
        limit: 10  // Get more results to filter properly
    });
    
    fetch(`${API_BASE}/projects/search-openapi?${searchParams.toString()}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`Search strategy ${index + 1} results:`, data);
            if (data.projects && data.projects.length > 0) {
                // Score and sort results by relevance
                const scoredResults = scoreAndSortResults(data.projects, searchQuery);
                console.log('Scored results:', scoredResults);
                
                // Check if we have a perfect match (exact name match)
                const perfectMatch = scoredResults.find(p => p.relevanceScore >= 10000);
                if (perfectMatch) {
                    console.log('Found perfect match, stopping search');
                    showLoading(false);
                    displayCurlResults([perfectMatch], originalUrl);
                    return;
                }
                
                // Found results, show them
                showLoading(false);
                displayCurlResults(scoredResults, originalUrl);
            } else {
                // No results with this strategy, try the next one
                trySearchStrategy(searchStrategies, index + 1, originalUrl);
            }
        })
        .catch(error => {
            console.error(`Error with search strategy ${index + 1}:`, error);
            // Try next strategy on error
            trySearchStrategy(searchStrategies, index + 1, originalUrl);
        });
}

function displayCurlResults(projects, originalUrl) {
    const resultDiv = document.getElementById('curl-result');
    const resultContent = document.getElementById('curl-result-content');
    
    let html = `
        <div style="margin-bottom: 10px;">
            <strong>Found ${projects.length} matching project(s) with OpenAPI:</strong>
        </div>
    `;
    
    projects.forEach((project, index) => {
        const hasOpenAPI = project.openapi && project.openapi.found;
        const openAPIBadge = hasOpenAPI 
            ? '<span style="background: #d4edda; color: #155724; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Has OpenAPI</span>'
            : '<span style="background: #f8d7da; color: #721c24; padding: 2px 6px; border-radius: 3px; font-size: 10px;">No OpenAPI</span>';
        
        // Show relevance score for debugging
        const relevanceInfo = project.relevanceScore ? 
            `<div style="color: #6c757d; font-size: 10px; margin-top: 2px;">Relevance: ${project.relevanceScore}</div>` : '';
        
        html += `
            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin-bottom: 8px; cursor: pointer; background: white;" 
                 onclick="selectProjectFromCurl(${project.id}, '${project.name}', ${hasOpenAPI})">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${project.name || 'Unknown Project'}</strong>
                        <div style="color: #6c757d; font-size: 12px; margin-top: 2px;">${project.path || 'No path'}</div>
                        ${relevanceInfo}
                    </div>
                    <div>
                        ${openAPIBadge}
                    </div>
                </div>
            </div>
        `;
    });
    
    resultContent.innerHTML = html;
    resultDiv.style.display = 'block';
}

function selectProjectFromCurl(projectId, projectName, hasOpenAPI) {
    // Clear cURL input
    document.getElementById('curl-input').value = '';
    
    // Hide cURL results
    document.getElementById('curl-result').style.display = 'none';
    
    // Set search input to selected project
    const searchInput = document.getElementById('openapi-search');
    if (searchInput) {
        searchInput.value = projectName;
    }
    
    // Always try to load the OpenAPI, regardless of what the search said
    // This will verify if the OpenAPI actually exists
    console.log(`Attempting to load OpenAPI for project ${projectId} (${projectName})`);
    viewProjectOpenAPI(projectId, projectName);
}

function showCurlResult(message, type) {
    const resultDiv = document.getElementById('curl-result');
    const resultContent = document.getElementById('curl-result-content');
    
    const colors = {
        'info': '#17a2b8',
        'success': '#28a745',
        'warning': '#ffc107',
        'error': '#dc3545'
    };
    
    resultContent.innerHTML = `
        <div style="color: ${colors[type] || colors.info}; font-weight: 500;">
            ${message}
        </div>
    `;
    resultDiv.style.display = 'block';
}

function selectProject(projectId, projectName, element) {
    // Remove active class from all project items
    document.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to selected item
    element.classList.add('active');
    
    // Load and display the OpenAPI spec
    viewProjectOpenAPI(projectId, projectName);
}

async function viewProjectOpenAPI(projectId, projectName) {
    try {
        showLoading(true, `Loading OpenAPI documentation for ${projectName}...`);
        
        const response = await fetch(`${API_BASE}/projects/${projectId}/openapi`);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('OpenAPI specification not found for this project');
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const openAPIContent = await response.text();
        
        // Hide placeholder and show viewer
        const placeholder = document.getElementById('openapi-placeholder');
        const viewer = document.getElementById('openapi-viewer');
        
        if (placeholder) placeholder.style.display = 'none';
        if (viewer) viewer.style.display = 'block';
        
        displayOpenAPIDocumentation(projectName, openAPIContent);
    } catch (error) {
        console.error('Error loading OpenAPI documentation:', error);
        
        // Show specific error message in the placeholder
        const placeholder = document.getElementById('openapi-placeholder');
        const viewer = document.getElementById('openapi-viewer');
        
        if (viewer) viewer.style.display = 'none';
        if (placeholder) {
            placeholder.style.display = 'block';
            const placeholderContent = placeholder.querySelector('.placeholder-content');
            if (placeholderContent) {
                if (error.message.includes('not found')) {
                    placeholderContent.innerHTML = `
                        <h3>❌ No OpenAPI Specification</h3>
                        <p>This project doesn't have an OpenAPI specification</p>
                        <p style="color: #6c757d; font-size: 12px; margin-top: 10px;">
                            The search indicated this project has OpenAPI, but it's not available. 
                            This might be due to cache inconsistency.
                        </p>
                    `;
                } else {
                    placeholderContent.innerHTML = `
                        <h3>⚠️ Error Loading OpenAPI</h3>
                        <p>Failed to load OpenAPI specification: ${error.message}</p>
                    `;
                }
            }
        }
        
        showError(`Failed to load OpenAPI documentation: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

function displayOpenAPIDocumentation(projectName, openAPIContent) {
    const container = document.getElementById('openapi-viewer');
    const content = document.getElementById('openapi-content');
    const placeholder = document.getElementById('openapi-placeholder');
    const title = document.getElementById('openapi-viewer-title');
    
    // Hide placeholder and show viewer
    if (placeholder) placeholder.style.display = 'none';
    if (container) container.style.display = 'block';
    
    // Update title
    if (title) {
        title.textContent = `${projectName} - OpenAPI Documentation`;
    }
    
    // Store the content for copying/downloading
    window.currentOpenAPIContent = openAPIContent;
    window.currentProjectName = projectName;
    
    // Clear previous content
    content.innerHTML = '';
    
    try {
        // Parse YAML to JSON for Swagger UI
        const openAPISpec = jsyaml.load(openAPIContent);
        
        // Ensure the spec has the required structure for Swagger UI
        if (!openAPISpec.openapi && !openAPISpec.swagger) {
            console.warn('OpenAPI spec missing version, adding default');
            openAPISpec.openapi = '3.0.0';
        }
        
        // Ensure we have paths for Swagger UI to work with
        if (!openAPISpec.paths || Object.keys(openAPISpec.paths).length === 0) {
            console.warn('No paths found in OpenAPI spec, adding example');
            openAPISpec.paths = {
                '/test': {
                    get: {
                        summary: 'Test endpoint',
                        description: 'A simple test endpoint',
                        responses: {
                            '200': {
                                description: 'Successful response',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                message: {
                                                    type: 'string',
                                                    example: 'Hello World'
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
        }
        
        // Initialize Swagger UI
        const ui = SwaggerUIBundle({
            spec: openAPISpec,
            dom_id: '#openapi-content',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
            ],
            plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout",
            tryItOutEnabled: true,
            supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'],
            validatorUrl: null, // Disable validator to avoid CORS issues
            docExpansion: 'list', // Show all endpoints by default
            defaultModelsExpandDepth: 1,
            defaultModelExpandDepth: 1,
            requestInterceptor: function(request) {
                console.log('Making request:', request);
                // Add CORS headers if needed
                request.headers = request.headers || {};
                request.headers['Access-Control-Allow-Origin'] = '*';
                return request;
            },
            responseInterceptor: function(response) {
                console.log('Received response:', response);
                return response;
            },
            onComplete: function() {
                console.log('Swagger UI loaded successfully');
                // Debug: Check if try buttons exist
                setTimeout(() => {
                    const tryButtons = document.querySelectorAll('.try-out__btn');
                    const executeButtons = document.querySelectorAll('.btn.execute');
                    console.log('Found try buttons:', tryButtons.length);
                    console.log('Found execute buttons:', executeButtons.length);
                    
                    // Log all buttons for debugging
                    const allButtons = document.querySelectorAll('button');
                    console.log('All buttons found:', allButtons.length);
                    allButtons.forEach((btn, index) => {
                        if (btn.textContent.toLowerCase().includes('try') || btn.textContent.toLowerCase().includes('execute')) {
                            console.log(`Button ${index}:`, btn.textContent, btn.className);
                        }
                    });
                }, 2000);
            },
            onFailure: function(error) {
                console.error('Swagger UI failed to load:', error);
                // Fallback to raw YAML display
                displayRawOpenAPI(openAPIContent);
            }
        });
    } catch (error) {
        console.error('Failed to parse OpenAPI YAML:', error);
        // Fallback to raw YAML display
        displayRawOpenAPI(openAPIContent);
    }
}

function displayRawOpenAPI(openAPIContent) {
    const content = document.getElementById('openapi-content');
    content.innerHTML = `
        <div style="padding: 20px;">
            <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; margin: 10px 0;">
                <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; color: #2c3e50;">${escapeHtml(openAPIContent)}</pre>
            </div>
        </div>
    `;
}

function clearOpenAPIView() {
    // Clear content
    document.getElementById('openapi-content').innerHTML = '';
    
    // Show placeholder and hide viewer
    document.getElementById('openapi-placeholder').style.display = 'block';
    document.getElementById('openapi-viewer').style.display = 'none';
    
    // Reset search state
    allOpenAPIProjects = [];
    filteredOpenAPIProjects = [];
    document.getElementById('openapi-search').value = '';
    document.getElementById('openapi-filter').value = 'all';
    
    // Hide dropdown
    const dropdown = document.getElementById('openapi-search-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

function copyOpenAPIToClipboard() {
    if (window.currentOpenAPIContent) {
        navigator.clipboard.writeText(window.currentOpenAPIContent).then(() => {
            showError('OpenAPI content copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
            showError('Failed to copy to clipboard');
        });
    }
}

function downloadOpenAPI() {
    if (window.currentOpenAPIContent && window.currentProjectName) {
        const blob = new Blob([window.currentOpenAPIContent], { type: 'application/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${window.currentProjectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_openapi.yaml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debugSwaggerUI() {
    console.log('=== Swagger UI Debug Info ===');
    
    // Check if Swagger UI is loaded
    const swaggerContainer = document.getElementById('openapi-content');
    console.log('Swagger container:', swaggerContainer);
    console.log('Container HTML:', swaggerContainer.innerHTML.substring(0, 200) + '...');
    
    // Check for try buttons
    const tryButtons = document.querySelectorAll('.try-out__btn');
    console.log('Try buttons found:', tryButtons.length);
    tryButtons.forEach((btn, index) => {
        console.log(`Try button ${index}:`, {
            text: btn.textContent,
            className: btn.className,
            visible: btn.offsetParent !== null,
            disabled: btn.disabled
        });
    });
    
    // Check for execute buttons
    const executeButtons = document.querySelectorAll('.btn.execute');
    console.log('Execute buttons found:', executeButtons.length);
    
    // Check for operation blocks
    const opBlocks = document.querySelectorAll('.opblock');
    console.log('Operation blocks found:', opBlocks.length);
    
    // Check for any buttons with "try" or "execute" in text
    const allButtons = document.querySelectorAll('button');
    const relevantButtons = Array.from(allButtons).filter(btn => 
        btn.textContent.toLowerCase().includes('try') || 
        btn.textContent.toLowerCase().includes('execute')
    );
    console.log('Relevant buttons:', relevantButtons.length);
    relevantButtons.forEach((btn, index) => {
        console.log(`Button ${index}:`, {
            text: btn.textContent.trim(),
            className: btn.className,
            visible: btn.offsetParent !== null,
            disabled: btn.disabled
        });
    });
    
    // Check if Swagger UI global is available
    console.log('SwaggerUIBundle available:', typeof SwaggerUIBundle !== 'undefined');
    console.log('SwaggerUIStandalonePreset available:', typeof SwaggerUIStandalonePreset !== 'undefined');
    
    // Show debug info in alert
    alert(`Debug Info:\nTry buttons: ${tryButtons.length}\nExecute buttons: ${executeButtons.length}\nOperation blocks: ${opBlocks.length}\nCheck console for details.`);
}
    
