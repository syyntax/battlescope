// BattleScope JavaScript
let currentResults = { columns: [], rows: [] };

// Initialize theme
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
        // Default to system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
}

// Toggle theme
document.getElementById('theme-toggle').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// File upload handling
const fileInput = document.getElementById('file-input');
const uploadArea = document.getElementById('upload-area');
const uploadStatus = document.getElementById('upload-status');

// Click to upload
fileInput.addEventListener('change', handleFileSelect);

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        handleFileSelect();
    }
});

function handleFileSelect() {
    const file = fileInput.files[0];
    if (!file) return;

    // Validate file extension
    const validExtensions = ['.nessus', '.xml'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
        showUploadStatus('Invalid file type. Please upload a .nessus or .xml file.', 'error');
        return;
    }

    uploadFile(file);
}

function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    showUploadStatus('Uploading and parsing file...', 'success');

    fetch('/api/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showUploadStatus(data.error, 'error');
        } else {
            showUploadStatus(`✓ ${data.message}`, 'success');
            displayStatistics(data.statistics);
        }
    })
    .catch(error => {
        showUploadStatus(`Error: ${error.message}`, 'error');
    });
}

function showUploadStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = `upload-status ${type}`;
    uploadStatus.style.display = 'block';
}

// Query handling
const queryInput = document.getElementById('query-input');
const executeBtn = document.getElementById('execute-btn');

// Pre-built query buttons
document.querySelectorAll('.query-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const query = btn.getAttribute('data-query');
        queryInput.value = query;
        executeQuery(query);
    });
});

// Execute query button
executeBtn.addEventListener('click', () => {
    const query = queryInput.value.trim();
    if (query) {
        executeQuery(query);
    }
});

// Execute on Ctrl/Cmd + Enter
queryInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const query = queryInput.value.trim();
        if (query) {
            executeQuery(query);
        }
    }
});

function executeQuery(query) {
    fetch('/api/query', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(`Query Error: ${data.error}`);
        } else {
            displayResults(data);
        }
    })
    .catch(error => {
        alert(`Error: ${error.message}`);
    });
}

function displayResults(data) {
    currentResults = data;
    const resultsSection = document.getElementById('results-section');
    const resultsCount = document.getElementById('results-count');
    const resultsTable = document.getElementById('results-table');

    // Show results section
    resultsSection.style.display = 'block';

    // Update count
    const rowCount = data.rows.length;
    resultsCount.textContent = `${rowCount} row${rowCount !== 1 ? 's' : ''}`;

    // Clear existing table
    resultsTable.innerHTML = '';

    // Create table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    data.columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    resultsTable.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');
    data.rows.forEach(row => {
        const tr = document.createElement('tr');
        // Convert Row object to array
        const rowArray = Array.isArray(row) ? row : Object.values(row);
        rowArray.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell !== null && cell !== undefined ? cell : '';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    resultsTable.appendChild(tbody);

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Export CSV
document.getElementById('export-btn').addEventListener('click', () => {
    if (!currentResults.columns || currentResults.columns.length === 0) {
        alert('No data to export');
        return;
    }

    // Convert rows to plain arrays if they're Row objects
    const rows = currentResults.rows.map(row => {
        return Array.isArray(row) ? row : Object.values(row);
    });

    fetch('/api/export-csv', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            columns: currentResults.columns,
            rows: rows
        })
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'battlescope_export.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    })
    .catch(error => {
        alert(`Export Error: ${error.message}`);
    });
});

// Display statistics in right pane
function displayStatistics(stats) {
    const statsContent = document.getElementById('stats-content');

    let html = `
        <div class="stat-card">
            <h3>Scan Summary</h3>
            <div class="stat-item">
                <span class="stat-label">Filename:</span>
                <span class="stat-value">${stats.filename}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Type:</span>
                <span class="stat-value">${stats.scan_type.toUpperCase()}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Hosts:</span>
                <span class="stat-value">${stats.host_count}</span>
            </div>
        </div>
    `;

    // Add severity counts for Nessus scans
    if (stats.severities) {
        html += `
            <div class="stat-card">
                <h3>Vulnerabilities</h3>
        `;

        const severityOrder = ['Critical', 'High', 'Medium', 'Low', 'Info'];
        severityOrder.forEach(severity => {
            if (stats.severities[severity]) {
                const severityClass = `severity-${severity.toLowerCase()}`;
                html += `
                    <div class="stat-item">
                        <span class="stat-label">${severity}:</span>
                        <span class="stat-value ${severityClass}">${stats.severities[severity]}</span>
                    </div>
                `;
            }
        });

        html += `</div>`;
    }

    // Add top ports
    if (stats.top_ports && stats.top_ports.length > 0) {
        html += `
            <div class="stat-card">
                <h3>Top 10 Ports</h3>
        `;

        stats.top_ports.forEach(port => {
            html += `
                <div class="stat-item">
                    <span class="stat-label">${port.port}/${port.protocol} (${port.service})</span>
                    <span class="stat-value">${port.count}</span>
                </div>
            `;
        });

        html += `</div>`;
    }

    // Add top operating systems
    if (stats.top_os && stats.top_os.length > 0) {
        html += `
            <div class="stat-card">
                <h3>Top 10 Operating Systems</h3>
        `;

        stats.top_os.forEach(os => {
            html += `
                <div class="stat-item">
                    <span class="stat-label">${os.os}</span>
                    <span class="stat-value">${os.count}</span>
                </div>
            `;
        });

        html += `</div>`;
    }

    statsContent.innerHTML = html;
}

// Initialize theme on page load
initTheme();

// Load statistics if available
fetch('/api/statistics')
    .then(response => {
        if (response.ok) {
            return response.json();
        }
    })
    .then(stats => {
        if (stats) {
            displayStatistics(stats);
        }
    })
    .catch(() => {
        // No statistics available yet
    });
