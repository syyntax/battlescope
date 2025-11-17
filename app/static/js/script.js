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
    // Check if "Vulnerability" column exists
    const vulnColIndex = data.columns.findIndex(col =>
        col.toLowerCase() === 'vulnerability' || col.toLowerCase() === 'plugin_name'
    );

    data.rows.forEach(row => {
        const tr = document.createElement('tr');
        // Convert Row object to array
        const rowArray = Array.isArray(row) ? row : Object.values(row);
        rowArray.forEach((cell, index) => {
            const td = document.createElement('td');
            const cellValue = cell !== null && cell !== undefined ? cell : '';

            // Make vulnerability names clickable
            if (index === vulnColIndex && cellValue) {
                const link = document.createElement('span');
                link.className = 'vuln-link';
                link.textContent = cellValue;
                link.onclick = () => showVulnerabilityModal(cellValue);
                td.appendChild(link);
            } else {
                td.textContent = cellValue;
            }
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

// Modal functionality
const modal = document.getElementById('vuln-modal');
const modalClose = document.querySelector('.modal-close');
let currentPluginId = null;

// Close modal when clicking X
modalClose.onclick = () => {
    modal.classList.remove('active');
};

// Close modal when clicking outside
window.onclick = (event) => {
    if (event.target === modal) {
        modal.classList.remove('active');
    }
};

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.classList.remove('active');
    }
});

// Show vulnerability modal
function showVulnerabilityModal(pluginName) {
    // Fetch vulnerability details from backend
    fetch('/api/vulnerability/details', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plugin_name: pluginName })
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(`Error: ${data.error}`);
                return;
            }

            // Populate modal with data
            document.getElementById('modal-vuln-title').textContent = data.plugin_name;
            document.getElementById('modal-plugin-id').textContent = data.plugin_id;
            document.getElementById('modal-severity').value = data.risk_factor;
            document.getElementById('modal-synopsis').textContent = data.synopsis || 'N/A';
            document.getElementById('modal-description').textContent = data.description || 'N/A';
            document.getElementById('modal-solution').textContent = data.solution || 'N/A';
            document.getElementById('modal-references').textContent = data.cve || 'N/A';
            document.getElementById('modal-plugin-output').textContent = data.plugin_output || 'N/A';

            // Store current plugin ID for saving
            currentPluginId = data.plugin_id;

            // Populate affected hosts table
            const tbody = document.getElementById('modal-hosts-tbody');
            tbody.innerHTML = '';

            if (data.affected_hosts && data.affected_hosts.length > 0) {
                data.affected_hosts.forEach(host => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${host.hostname || 'N/A'}</td>
                        <td>${host.ip_address}</td>
                        <td>${host.port || 'N/A'}</td>
                        <td>${host.protocol || 'N/A'}</td>
                        <td>${host.service_name || 'N/A'}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No affected hosts found</td></tr>';
            }

            // Show modal
            modal.classList.add('active');
        })
        .catch(error => {
            alert(`Error loading vulnerability details: ${error.message}`);
        });
}

// Save severity changes
document.getElementById('modal-save-severity').onclick = () => {
    if (!currentPluginId) {
        alert('No plugin ID available');
        return;
    }

    const newSeverity = document.getElementById('modal-severity').value;

    fetch('/api/vulnerability/update-severity', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            plugin_id: currentPluginId,
            risk_factor: newSeverity
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(`Error: ${data.error}`);
        } else {
            alert('Severity updated successfully!');
            // Refresh statistics
            fetch('/api/statistics')
                .then(response => response.json())
                .then(stats => {
                    if (stats) {
                        displayStatistics(stats);
                    }
                })
                .catch(() => {});
        }
    })
    .catch(error => {
        alert(`Error updating severity: ${error.message}`);
    });
};

// Report Generation
document.getElementById('generate-report').addEventListener('click', () => {
    generateReport();
});

function generateReport() {
    // Show loading indicator
    const reportBtn = document.getElementById('generate-report');
    const originalText = reportBtn.textContent;
    reportBtn.textContent = 'Generating...';
    reportBtn.disabled = true;

    fetch('/api/report/generate')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(`Error: ${data.error}`);
                reportBtn.textContent = originalText;
                reportBtn.disabled = false;
                return;
            }

            // Generate HTML report
            const html = generateReportHTML(data);

            // Download as HTML file
            const blob = new Blob([html], { type: 'text/html' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Use company name in filename
            const companyName = data.settings?.company_name || 'BattleScope';
            const sanitizedCompanyName = companyName.replace(/[^a-z0-9]/gi, '_');
            a.download = `${sanitizedCompanyName}_Report_${new Date().toISOString().split('T')[0]}.html`;

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            reportBtn.textContent = originalText;
            reportBtn.disabled = false;
        })
        .catch(error => {
            alert(`Error generating report: ${error.message}`);
            reportBtn.textContent = originalText;
            reportBtn.disabled = false;
        });
}

function generateReportHTML(data) {
    const currentDate = new Date().toLocaleString();
    const settings = data.settings || {
        company_name: 'BattleScope',
        analyst_name: '',
        report_author: '',
        organization: '',
        contact_email: '',
        notes: ''
    };
    const companyName = settings.company_name || 'BattleScope';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName} Vulnerability Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
            padding: 2rem;
        }

        .report-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 3rem;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }

        .report-header {
            text-align: center;
            border-bottom: 4px solid #6f42c1;
            padding-bottom: 2rem;
            margin-bottom: 2rem;
        }

        .report-header h1 {
            font-size: 2.5rem;
            color: #6f42c1;
            margin-bottom: 0.5rem;
        }

        .report-meta {
            color: #666;
            font-size: 0.9rem;
        }

        .section {
            margin-bottom: 3rem;
        }

        .section h2 {
            color: #6f42c1;
            font-size: 1.8rem;
            margin-bottom: 1rem;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 0.5rem;
        }

        .section h3 {
            color: #4c6ef5;
            font-size: 1.3rem;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        .info-card {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid #6f42c1;
        }

        .info-card label {
            display: block;
            font-weight: bold;
            color: #666;
            font-size: 0.85rem;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
        }

        .info-card value {
            display: block;
            font-size: 1.5rem;
            color: #333;
            font-weight: bold;
        }

        .severity-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        .severity-card {
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            color: white;
        }

        .severity-card.critical {
            background: #dc3545;
        }

        .severity-card.high {
            background: #fd7e14;
        }

        .severity-card.medium {
            background: #ffc107;
            color: #333;
        }

        .severity-card.low {
            background: #20c997;
        }

        .severity-card.info {
            background: #17a2b8;
        }

        .severity-card label {
            display: block;
            font-size: 0.85rem;
            margin-bottom: 0.5rem;
            opacity: 0.9;
        }

        .severity-card value {
            display: block;
            font-size: 2rem;
            font-weight: bold;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
            font-size: 0.9rem;
        }

        table thead {
            background: #6f42c1;
            color: white;
        }

        table th {
            padding: 0.75rem;
            text-align: left;
            font-weight: 600;
        }

        table td {
            padding: 0.75rem;
            border-bottom: 1px solid #e9ecef;
        }

        table tbody tr:hover {
            background: #f8f9fa;
        }

        .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-size: 0.85rem;
            font-weight: bold;
        }

        .badge.critical {
            background: #dc3545;
            color: white;
        }

        .badge.high {
            background: #fd7e14;
            color: white;
        }

        .badge.medium {
            background: #ffc107;
            color: #333;
        }

        .badge.low {
            background: #20c997;
            color: white;
        }

        .badge.info {
            background: #17a2b8;
            color: white;
        }

        .executive-summary {
            background: #e7f3ff;
            padding: 2rem;
            border-radius: 8px;
            border-left: 4px solid #4c6ef5;
            margin-bottom: 2rem;
        }

        .footer {
            text-align: center;
            padding-top: 2rem;
            margin-top: 3rem;
            border-top: 2px solid #e9ecef;
            color: #666;
            font-size: 0.9rem;
        }

        @media print {
            body {
                padding: 0;
                background: white;
            }

            .report-container {
                box-shadow: none;
                padding: 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1>${companyName} Vulnerability Report</h1>
            <div class="report-meta">
                <p><strong>Scan File:</strong> ${data.scan_info.filename}</p>
                <p><strong>Scan Type:</strong> ${data.scan_info.scan_type.toUpperCase()}</p>
                <p><strong>Report Generated:</strong> ${currentDate}</p>
                ${settings.analyst_name ? `<p><strong>Analyst:</strong> ${escapeHtml(settings.analyst_name)}</p>` : ''}
                ${settings.report_author ? `<p><strong>Author:</strong> ${escapeHtml(settings.report_author)}</p>` : ''}
                ${settings.organization ? `<p><strong>Organization:</strong> ${escapeHtml(settings.organization)}</p>` : ''}
                ${settings.contact_email ? `<p><strong>Contact:</strong> ${escapeHtml(settings.contact_email)}</p>` : ''}
            </div>
        </div>

        ${generateExecutiveSummary(data)}
        ${generateHostStatistics(data)}
        ${generateVulnerabilityStatistics(data)}
        ${generateCriticalFindings(data)}
        ${generateTopVulnerableHosts(data)}
        ${generateOpenPortsSummary(data)}
        ${generateDetailedVulnerabilityList(data)}

        <div class="footer">
            <p><strong>${companyName}</strong> - Vulnerability Assessment Report</p>
            ${settings.analyst_name || settings.report_author ? `<p>Prepared by: ${escapeHtml(settings.analyst_name || settings.report_author)}</p>` : ''}
            ${settings.notes ? `<p style="margin-top: 1rem; font-style: italic;">${escapeHtml(settings.notes)}</p>` : ''}
            <p style="margin-top: 1rem; font-size: 0.85rem;">Report generated using <strong>BattleScope</strong> by syyntax</p>
        </div>
    </div>
</body>
</html>`;
}

function generateExecutiveSummary(data) {
    const stats = data.vulnerability_stats;
    const criticalCount = stats.Critical || 0;
    const highCount = stats.High || 0;
    const totalHosts = data.host_stats.total_hosts;

    return `
        <div class="section">
            <h2>Executive Summary</h2>
            <div class="executive-summary">
                <p>This report provides a comprehensive analysis of the security posture based on the scan of <strong>${totalHosts} host(s)</strong>.
                The assessment identified <strong>${stats.unique_vulnerabilities || 0} unique vulnerabilities</strong> across the scanned systems.</p>
                <p style="margin-top: 1rem;"><strong>Critical Findings:</strong> ${criticalCount} Critical and ${highCount} High severity vulnerabilities require immediate attention.
                These vulnerabilities pose significant security risks and should be prioritized for remediation.</p>
            </div>
        </div>
    `;
}

function generateHostStatistics(data) {
    return `
        <div class="section">
            <h2>Host Statistics</h2>
            <div class="info-grid">
                <div class="info-card">
                    <label>Total Hosts</label>
                    <value>${data.host_stats.total_hosts}</value>
                </div>
                <div class="info-card">
                    <label>Alive Hosts</label>
                    <value>${data.host_stats.alive_hosts}</value>
                </div>
                <div class="info-card">
                    <label>Open Ports</label>
                    <value>${data.open_ports.length > 0 ? data.open_ports.reduce((sum, p) => sum + p.count, 0) : 0}</value>
                </div>
                <div class="info-card">
                    <label>Unique Vulnerabilities</label>
                    <value>${data.vulnerability_stats.unique_vulnerabilities || 0}</value>
                </div>
            </div>
        </div>
    `;
}

function generateVulnerabilityStatistics(data) {
    const stats = data.vulnerability_stats;

    return `
        <div class="section">
            <h2>Vulnerability Statistics</h2>
            <div class="severity-grid">
                <div class="severity-card critical">
                    <label>Critical</label>
                    <value>${stats.Critical || 0}</value>
                </div>
                <div class="severity-card high">
                    <label>High</label>
                    <value>${stats.High || 0}</value>
                </div>
                <div class="severity-card medium">
                    <label>Medium</label>
                    <value>${stats.Medium || 0}</value>
                </div>
                <div class="severity-card low">
                    <label>Low</label>
                    <value>${stats.Low || 0}</value>
                </div>
                <div class="severity-card info">
                    <label>Info</label>
                    <value>${stats.Info || 0}</value>
                </div>
            </div>
        </div>
    `;
}

function generateCriticalFindings(data) {
    if (!data.critical_findings || data.critical_findings.length === 0) {
        return `
            <div class="section">
                <h2>Critical Findings</h2>
                <p>No critical or high severity vulnerabilities found.</p>
            </div>
        `;
    }

    let rows = '';
    data.critical_findings.forEach(vuln => {
        rows += `
            <tr>
                <td><span class="badge ${vuln.severity.toLowerCase()}">${vuln.severity}</span></td>
                <td><strong>${escapeHtml(vuln.name)}</strong></td>
                <td>${vuln.affected_hosts}</td>
                <td>${vuln.cvss_score}</td>
                <td>${escapeHtml(vuln.synopsis || 'N/A')}</td>
            </tr>
        `;
    });

    return `
        <div class="section">
            <h2>Critical Findings (Top 10)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Severity</th>
                        <th>Vulnerability</th>
                        <th>Affected Hosts</th>
                        <th>CVSS Score</th>
                        <th>Synopsis</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

function generateTopVulnerableHosts(data) {
    if (!data.top_vulnerable_hosts || data.top_vulnerable_hosts.length === 0) {
        return '';
    }

    let rows = '';
    data.top_vulnerable_hosts.forEach(host => {
        rows += `
            <tr>
                <td>${host.ip_address}</td>
                <td>${host.hostname}</td>
                <td style="color: #dc3545; font-weight: bold;">${host.critical}</td>
                <td style="color: #fd7e14; font-weight: bold;">${host.high}</td>
                <td style="color: #ffc107; font-weight: bold;">${host.medium}</td>
                <td style="color: #20c997; font-weight: bold;">${host.low}</td>
                <td><strong>${host.total}</strong></td>
            </tr>
        `;
    });

    return `
        <div class="section">
            <h2>Top 10 Vulnerable Hosts</h2>
            <table>
                <thead>
                    <tr>
                        <th>IP Address</th>
                        <th>Hostname</th>
                        <th>Critical</th>
                        <th>High</th>
                        <th>Medium</th>
                        <th>Low</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

function generateOpenPortsSummary(data) {
    if (!data.open_ports || data.open_ports.length === 0) {
        return '';
    }

    let rows = '';
    data.open_ports.forEach(port => {
        rows += `
            <tr>
                <td><strong>${port.port}</strong></td>
                <td>${port.protocol.toUpperCase()}</td>
                <td>${port.service}</td>
                <td>${port.count}</td>
            </tr>
        `;
    });

    return `
        <div class="section">
            <h2>Open Ports Summary (Top 20)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Port</th>
                        <th>Protocol</th>
                        <th>Service</th>
                        <th>Host Count</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

function generateDetailedVulnerabilityList(data) {
    if (!data.all_vulnerabilities || data.all_vulnerabilities.length === 0) {
        return '';
    }

    let rows = '';
    data.all_vulnerabilities.forEach(vuln => {
        rows += `
            <tr>
                <td><span class="badge ${vuln.severity.toLowerCase()}">${vuln.severity}</span></td>
                <td><strong>${escapeHtml(vuln.name)}</strong><br><small>Plugin ID: ${vuln.plugin_id}</small></td>
                <td>${vuln.affected_hosts}</td>
                <td>${escapeHtml(vuln.synopsis || 'N/A')}</td>
                <td>${escapeHtml(vuln.cve || 'N/A')}</td>
            </tr>
        `;
    });

    return `
        <div class="section">
            <h2>Detailed Vulnerability List</h2>
            <table>
                <thead>
                    <tr>
                        <th>Severity</th>
                        <th>Vulnerability</th>
                        <th>Affected Hosts</th>
                        <th>Synopsis</th>
                        <th>CVE</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
