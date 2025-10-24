// Library management helper functions

// Store library data globally
window.projectLibrariesData = {};

// Initialize version autocomplete for a specific input
function initVersionAutocomplete(projectId, libIndex, libraryName) {
    const inputId = `lib-version-${projectId}-${libIndex}`;
    const input = document.getElementById(inputId);
    
    if (!input || !libraryName) {
        return;
    }
    
    // Add autocomplete container
    const container = document.createElement('div');
    container.className = 'version-autocomplete';
    container.id = `autocomplete-${inputId}`;
    container.style.display = 'none';
    input.parentNode.appendChild(container);
    
    let debounceTimer;
    
    input.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        const query = this.value;
        
        if (query.length < 1) {
            container.style.display = 'none';
            return;
        }
        
        debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch(`${API_BASE}/search/library-versions?library=${encodeURIComponent(libraryName)}&query=${encodeURIComponent(query)}&limit=10`);
                if (response.ok) {
                    const data = await response.json();
                    // API returns {versions: [...], count: N}
                    displayVersionSuggestions(inputId, data.versions || [], projectId, libIndex);
                }
            } catch (error) {
                console.error('Failed to fetch version suggestions:', error);
            }
        }, 300);
    });
    
    // Close autocomplete when clicking outside
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !container.contains(e.target)) {
            container.style.display = 'none';
        }
    });
}

function displayVersionSuggestions(inputId, versions, projectId, libIndex) {
    const container = document.getElementById(`autocomplete-${inputId}`);
    const input = document.getElementById(inputId);
    
    if (!container || !input) return;
    
    if (versions.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.innerHTML = versions.map(version => `
        <div class="autocomplete-item" onclick="selectVersion('${inputId}', '${version}')">
            ${version}
        </div>
    `).join('');
    
    container.style.display = 'block';
}

function selectVersion(inputId, version) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(`autocomplete-${inputId}`);
    
    if (input) {
        input.value = version;
        
        // Trigger the onchange event to update pending changes
        const event = new Event('change', { bubbles: true });
        input.dispatchEvent(event);
    }
    if (container) {
        container.style.display = 'none';
    }
}

// Select/Deselect functions
function selectAllLibraries(projectId) {
    const checkboxes = document.querySelectorAll(`#libraries-${projectId} .library-checkbox`);
    checkboxes.forEach(cb => cb.checked = true);
}

function clearAllLibraries(projectId) {
    const checkboxes = document.querySelectorAll(`#libraries-${projectId} .library-checkbox`);
    checkboxes.forEach(cb => cb.checked = false);
}

// Update functions
async function updateSingleLibrary(projectId, libIndex, libraryName) {
    const versionInput = document.getElementById(`lib-version-${projectId}-${libIndex}`);
    const token = document.getElementById('gitlab-token').value;
    
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }
    
    const targetVersion = versionInput.value.trim();
    if (!targetVersion) {
        showError('Please enter a target version');
        return;
    }
    
    if (!confirm(`Update ${libraryName} to ${targetVersion}?`)) {
        return;
    }
    
    showLoading(true, `Updating ${libraryName}...`);
    
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
            const result = await response.json();
            showSuccess(`✅ Successfully updated ${libraryName} to ${targetVersion}`);
            console.log('Update result:', result);
        } else {
            const errorData = await response.json();
            showError(`Failed to update: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        showError(`Failed to update: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

async function updateSelectedLibraries(projectId) {
    const token = document.getElementById('gitlab-token').value;
    
    if (!token.trim()) {
        showError('Please configure your GitLab API token first');
        return;
    }
    
    // Collect selected libraries
    const checkboxes = document.querySelectorAll(`#libraries-${projectId} .library-checkbox:checked`);
    const updates = [];
    
    checkboxes.forEach(checkbox => {
        const libName = checkbox.dataset.libraryName;
        const index = checkbox.id.match(/lib-check-\d+-(\d+)/)[1];
        const versionInput = document.getElementById(`lib-version-${projectId}-${index}`);
        
        if (versionInput && versionInput.value.trim()) {
            updates.push({
                library_name: libName,
                target_version: versionInput.value.trim()
            });
        }
    });
    
    if (updates.length === 0) {
        showError('Please select at least one library to update');
        return;
    }
    
    if (!confirm(`Update ${updates.length} selected libraries? This will create a merge request.`)) {
        return;
    }
    
    showLoading(true, `Updating ${updates.length} libraries...`);
    
    try {
        const response = await fetch(`${API_BASE}/library/project-update`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                project_id: parseInt(projectId),
                updates: updates
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            showSuccess(`✅ Successfully updated ${updates.length} libraries. Check merge request for details.`);
            console.log('Batch update result:', result);
        } else {
            const errorData = await response.json();
            showError(`Failed to update: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        showError(`Failed to update: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

