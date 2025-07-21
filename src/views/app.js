document.addEventListener('DOMContentLoaded', () => {
    const locationsSelect = document.getElementById('locations');
    const devicesContainer = document.getElementById('devicesContainer');
    const rebootBtn = document.getElementById('rebootDevices');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const signjetCsvInput = document.getElementById('signjetCsv');
    const matchResults = document.getElementById('matchResults');
    const matchAndRebootBtn = document.getElementById('matchAndReboot');
    const clientLoadingBar = document.getElementById('clientLoadingBar');
    const progressBarFill = document.getElementById('progressBarFill');
    const retryDisplaysBtn = document.getElementById('retryDisplaysBtn');
    const locationSearch = document.getElementById('locationSearch');

    let allDisplays = []; // Store all fetched displays
    let allSites = []; // Store all sites for search functionality
    const CLIENT_HANDLE = 'kwik-trip'; // Hardcoded client

    // TAB HANDLING
    const locationTab = document.getElementById('locationTab');
    const signjetTab = document.getElementById('signjetTab');
    const configCheckTab = document.getElementById('configCheckTab');
    const locationTabContent = document.getElementById('locationTabContent');
    const signjetTabContent = document.getElementById('signjetTabContent');
    const configCheckTabContent = document.getElementById('configCheckTabContent');

    // Add references for enabling/disabling UI
    const tabsContainer = document.getElementById('tabsContainer');

    // Function to enable UI after devices are loaded
    function enableUI() {
        tabsContainer.classList.remove('disabled');
        locationTabContent.classList.remove('disabled');
        signjetTabContent.classList.remove('disabled');
        configCheckTabContent.classList.remove('disabled');
        locationsSelect.disabled = false;
        locationSearch.disabled = false;
        rebootBtn.disabled = false;
        signjetCsvInput.disabled = false;
        matchAndRebootBtn.disabled = false;
        document.getElementById('runConfigCheck').disabled = false;
    }

    locationTab.addEventListener('click', () => {
        setActiveTab('location');
    });

    signjetTab.addEventListener('click', () => {
        setActiveTab('signjet');
    });

    configCheckTab.addEventListener('click', () => {
        setActiveTab('configCheck');
    });

    function setActiveTab(tabName) {
        // Remove active class from all tabs and content
        [locationTab, signjetTab, configCheckTab].forEach(tab => tab.classList.remove('active'));
        [locationTabContent, signjetTabContent, configCheckTabContent].forEach(content => content.classList.remove('active'));
        
        // Add active class to selected tab and content
        if (tabName === 'location') {
            locationTab.classList.add('active');
            locationTabContent.classList.add('active');
        } else if (tabName === 'signjet') {
            signjetTab.classList.add('active');
            signjetTabContent.classList.add('active');
        } else if (tabName === 'configCheck') {
            configCheckTab.classList.add('active');
            configCheckTabContent.classList.add('active');
        }
    }

    // LOGIN HANDLING
    const loginBtn = document.getElementById('loginBtn');
    const passwordInput = document.getElementById('passwordInput');
    const loginSection = document.getElementById('loginSection');
    const mainUI = document.getElementById('mainUI');
    const loginError = document.getElementById('loginError');

    loginBtn.onclick = function() {
        const pw = passwordInput.value;
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        })
        .then(res => {
            if (res.ok) return res.json();
            throw new Error('Login failed');
        })
        .then(data => {
            if (data.success) {
                loginSection.style.display = 'none';
                mainUI.style.display = 'block';
                loginError.style.display = 'none';
                // Auto-load displays for Kwik Trip
                fetchDisplaysForClient(CLIENT_HANDLE);
            } else {
                loginError.style.display = 'block';
            }
        })
        .catch(() => {
            loginError.style.display = 'block';
        });
    };
    passwordInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') loginBtn.click();
    });

    // Function to fetch displays for the hardcoded client
    function fetchDisplaysForClient(clientHandle) {
        locationsSelect.innerHTML = '';
        devicesContainer.innerHTML = '';
        if (!clientHandle) return;
        // Show progress bar
        clientLoadingBar.style.display = 'block';
        progressBarFill.style.width = '0%';
        retryDisplaysBtn.style.display = 'none';
        // Animate progress bar (indeterminate)
        let progress = 0;
        let progressInterval = setInterval(() => {
            progress = (progress + Math.random() * 20) % 100;
            progressBarFill.style.width = `${progress}%`;
        }, 400);
        fetch(`/api/clients/${clientHandle}/displays`)
            .then(res => res.json())
            .then(displays => {
                clearInterval(progressInterval);
                progressBarFill.style.width = '100%';
                setTimeout(() => { clientLoadingBar.style.display = 'none'; }, 400);
                allDisplays = displays; // Save for later use
                // Populate locations dropdown
                const sitesMap = {};
                displays.forEach(display => {
                    if (display.site && display.site.id) {
                        sitesMap[display.site.id] = display.site;
                    }
                });
                allSites = Object.values(sitesMap); // Store for search functionality
                populateLocations(allSites); // Use the new function
                devicesContainer.innerHTML = '';
                loadingSpinner.style.display = 'none';
                enableUI(); // Enable UI elements after loading
            })
            .catch(() => {
                clearInterval(progressInterval);
                progressBarFill.style.width = '0%';
                clientLoadingBar.style.display = 'none';
                retryDisplaysBtn.style.display = 'inline-block';
            });
    }
    retryDisplaysBtn.addEventListener('click', () => {
        fetchDisplaysForClient(CLIENT_HANDLE);
    });

    // Location search functionality
    locationSearch.addEventListener('input', (e) => {
        populateLocations(allSites, e.target.value);
    });

    // Configuration check functionality
    document.getElementById('runConfigCheck').addEventListener('click', async () => {
        const checks = {
            powerSchedules: document.getElementById('checkPowerSchedules').checked,
            defaultSource: document.getElementById('checkDefaultSource').checked,
            timeZone: document.getElementById('checkTimeZone').checked,
            powerSettings: document.getElementById('checkPowerSettings').checked
        };
        
        // Get all online device IDs for the check
        const onlineDisplayIds = allDisplays
            .filter(d => d.presence && d.presence.connected)
            .map(d => d.id);
        
        if (onlineDisplayIds.length === 0) {
            alert('No online devices found to check.');
            return;
        }
        
        // Show loading
        const configCheckResults = document.getElementById('configCheckResults');
        configCheckResults.style.display = 'block';
        configCheckResults.innerHTML = `
            <div>
                <h3>Configuration Validation Progress</h3>
                <div id="batchProgress">Checking configurations for ${onlineDisplayIds.length} devices...</div>
                <div style="margin: 10px 0;">
                    <div style="width: 100%; height: 12px; background: #eee; border-radius: 6px; overflow: hidden;">
                        <div id="validationProgressBar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #51722c 40%, #92c344 100%); transition: width 0.4s ease; border-radius: 6px;"></div>
                    </div>
                    <div id="progressText" style="text-align: center; color: #666; font-size: 13px; margin-top: 4px;">Starting validation...</div>
                </div>
                <div id="resultsContainer" style="margin-top: 15px;"></div>
            </div>
        `;
        
        try {
            // Process devices in batches of 50 to avoid payload size issues
            const batchSize = 50;
            const allResults = [];
            const allIssues = [];
            let totalDevicesChecked = 0;
            
            const batchProgressDiv = document.getElementById('batchProgress');
            const resultsContainer = document.getElementById('resultsContainer');
            const progressBar = document.getElementById('validationProgressBar');
            const progressText = document.getElementById('progressText');
            const totalBatches = Math.ceil(onlineDisplayIds.length / batchSize);
            
            for (let i = 0; i < onlineDisplayIds.length; i += batchSize) {
                const batch = onlineDisplayIds.slice(i, i + batchSize);
                const batchNumber = Math.floor(i / batchSize) + 1;
                
                // Update progress bar and text
                const progressPercent = ((batchNumber - 1) / totalBatches) * 100;
                progressBar.style.width = `${progressPercent}%`;
                progressText.textContent = `Batch ${batchNumber} of ${totalBatches} (${progressPercent.toFixed(0)}% complete)`;
                
                batchProgressDiv.innerHTML = `Checking batch ${batchNumber} of ${totalBatches} (${batch.length} devices)...`;
                
                const response = await fetch(`/api/clients/${CLIENT_HANDLE}/config-check`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayIds: batch, checks })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const batchResult = await response.json();
                allResults.push(batchResult);
                
                // Update running totals
                totalDevicesChecked += batchResult.totalDevicesChecked;
                if (batchResult.issues) {
                    allIssues.push(...batchResult.issues);
                }
                
                // Update progress bar for completed batch
                const completedPercent = (batchNumber / totalBatches) * 100;
                progressBar.style.width = `${completedPercent}%`;
                progressText.textContent = `Batch ${batchNumber} of ${totalBatches} complete (${completedPercent.toFixed(0)}%)`;
                
                // Update progress display
                batchProgressDiv.innerHTML = `
                    Batch ${batchNumber} of ${totalBatches} complete. 
                    Progress: ${totalDevicesChecked}/${onlineDisplayIds.length} devices checked. 
                    Issues found: ${allIssues.length}
                `;
                
                // Show incremental results
                if (batchResult.issues && batchResult.issues.length > 0) {
                    batchResult.issues.forEach(device => {
                        const deviceDiv = document.createElement('div');
                        deviceDiv.style.cssText = 'border: 1px solid #ddd; padding: 10px; margin-bottom: 8px; border-radius: 5px; background: #fff3cd;';
                        
                        let issuesList = '';
                        device.issues.forEach(issue => {
                            let severityColor = '#ff9800';
                            let severityIcon = '⚠️';
                            
                            if (issue.severity === 'error') {
                                severityColor = '#d32f2f';
                                severityIcon = '❌';
                            } else if (issue.severity === 'info') {
                                severityColor = '#2196f3';
                                severityIcon = 'ℹ️';
                            }
                            
                            issuesList += `
                                <li style="margin-bottom: 5px; color: ${severityColor};">
                                    ${severityIcon} <strong>${issue.message}</strong><br>
                                    <small style="color: #666;">Current: ${issue.currentValue} | Expected: ${issue.expectedValue}</small>
                                </li>
                            `;
                        });
                        
                        deviceDiv.innerHTML = `
                            <h5 style="margin: 0 0 8px 0;">${device.deviceName} at ${device.siteName}</h5>
                            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
                                ${issuesList}
                            </ul>
                        `;
                        
                        resultsContainer.appendChild(deviceDiv);
                    });
                }
            }
            
            // Complete the progress bar
            progressBar.style.width = '100%';
            progressText.innerHTML = '<span style="color: #51722c; font-weight: bold;">✅ Validation Complete!</span>';
            
            // Show final summary and grid view
            batchProgressDiv.innerHTML = `
                <strong>✅ Validation Complete!</strong><br>
                Total devices checked: ${totalDevicesChecked}<br>
                Devices with issues: ${allIssues.length}<br>
                ${allIssues.length === 0 ? '<span style="color: green;">🎉 All devices passed validation!</span>' : ''}
            `;
            
            // Create comprehensive grid view if there are issues
            if (allIssues.length > 0) {
                createValidationGridView(allIssues, totalDevicesChecked, resultsContainer);
            }
            
        } catch (error) {
            configCheckResults.innerHTML = '<div style="color:red;">Failed to check device configurations. ' + error.message + '</div>';
            console.error('Config check error:', error);
        }
    });

    function displayConfigCheckResults(result) {
        const configCheckResults = document.getElementById('configCheckResults');
        
        // Handle validation mode (new standard-based checking)
        if (result.validationMode) {
            if (result.devicesWithIssues === 0) {
                configCheckResults.innerHTML = `
                    <div style="color: green; font-weight: bold;">
                        ✅ All ${result.totalDevicesChecked} devices passed configuration validation!
                    </div>
                `;
                return;
            }
            
            let html = `
                <div>
                    <h3>Configuration Validation Results</h3>
                    <p><strong>Total devices checked:</strong> ${result.totalDevicesChecked}</p>
                    <p><strong>Devices with issues:</strong> ${result.devicesWithIssues}</p>
                    <div style="margin-top: 15px;">
            `;
            
            result.issues.forEach(device => {
                html += `
                    <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 5px;">
                        <h4>${device.deviceName} at ${device.siteName}</h4>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                `;
                
                device.issues.forEach(issue => {
                    let severityColor = '#ff9800'; // warning default
                    let severityIcon = '⚠️';
                    
                    if (issue.severity === 'error') {
                        severityColor = '#d32f2f';
                        severityIcon = '❌';
                    } else if (issue.severity === 'info') {
                        severityColor = '#2196f3';
                        severityIcon = 'ℹ️';
                    }
                    
                    html += `
                        <li style="margin-bottom: 8px; color: ${severityColor};">
                            ${severityIcon} <strong>${issue.message}</strong><br>
                            <small style="color: #666;">${issue.description}</small><br>
                            <small>Current: ${issue.currentValue} | Expected: ${issue.expectedValue}</small>
                        </li>
                    `;
                });
                
                html += '</ul></div>';
            });
            
            html += `
                    </div>
                    <button onclick="exportConfigReport()" style="margin-top: 15px;">Export Report</button>
                </div>
            `;
            
            configCheckResults.innerHTML = html;
            return;
        }
        
        // Legacy discovery mode display (if still needed)
        if (result.discoveryMode) {
            let html = `
                <div>
                    <h3>Device Configuration Discovery</h3>
                    <p><strong>Total devices analyzed:</strong> ${result.totalDevicesChecked}</p>
                    <p style="color: #ff9800; font-weight: bold;">📊 Discovery Mode: Showing actual device configurations to help determine standards</p>
                    <div style="margin-top: 15px;">
            `;
            
            result.deviceConfigurations.forEach(device => {
                html += `
                    <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; background: #f9f9f9;">
                        <h4>${device.deviceName} at ${device.siteName}</h4>
                `;
                
                // Time Zone Discovery
                if (device.configurations.timeZone) {
                    const tz = device.configurations.timeZone;
                    const statusIcon = tz.isCorrect ? '✅' : '⚠️';
                    html += `
                        <div style="margin: 10px 0; padding: 8px; background: white; border-radius: 3px;">
                            <strong>${statusIcon} Time Zone:</strong><br>
                            Current: <code>${tz.current}</code><br>
                            Expected: <code>${tz.expected}</code>
                        </div>
                    `;
                }
                
                // Content Source Discovery
                if (device.configurations.contentSource) {
                    const cs = device.configurations.contentSource;
                    html += `
                        <div style="margin: 10px 0; padding: 8px; background: white; border-radius: 3px;">
                            <strong>📺 Content Source:</strong><br>
                            Type: <code>${cs.type}</code><br>
                            <details style="margin-top: 5px;">
                                <summary>Full Configuration</summary>
                                <pre style="background: #f5f5f5; padding: 8px; margin-top: 5px; font-size: 12px; overflow-x: auto;">${cs.current}</pre>
                            </details>
                        </div>
                    `;
                }
                
                // Power Settings Discovery
                if (device.configurations.powerSettings) {
                    const ps = device.configurations.powerSettings;
                    const sdIcon = ps.signalDetection.isCorrect ? '✅' : '⚠️';
                    html += `
                        <div style="margin: 10px 0; padding: 8px; background: white; border-radius: 3px;">
                            <strong>⚡ Power Settings:</strong><br>
                            ${sdIcon} Signal Detection: <code>${ps.signalDetection.current}</code> (Expected: <code>${ps.signalDetection.expected}</code>)<br>
                            <details style="margin-top: 5px;">
                                <summary>All Power Settings</summary>
                                <pre style="background: #f5f5f5; padding: 8px; margin-top: 5px; font-size: 12px; overflow-x: auto;">${JSON.stringify(ps.fullPowerSettings, null, 2)}</pre>
                            </details>
                        </div>
                    `;
                }
                
                // Power Management Discovery
                if (device.configurations.powerManagement) {
                    const pm = device.configurations.powerManagement;
                    html += `
                        <div style="margin: 10px 0; padding: 8px; background: white; border-radius: 3px;">
                            <strong>🔋 Power Management:</strong><br>
                            Reported: <code>${pm.reported}</code><br>
                            Desired: <code>${pm.desired}</code><br>
                            <details style="margin-top: 5px;">
                                <summary>Full Power Data</summary>
                                <pre style="background: #f5f5f5; padding: 8px; margin-top: 5px; font-size: 12px; overflow-x: auto;">${JSON.stringify(pm.fullPowerData, null, 2)}</pre>
                            </details>
                        </div>
                    `;
                }
                
                html += '</div>';
            });
            
            html += `
                    </div>
                    <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 5px;">
                        <strong>💡 Next Steps:</strong>
                        <ol style="margin: 10px 0 0 20px;">
                            <li>Review the actual device configurations above</li>
                            <li>Identify the correct standards for Kwik Trip devices</li>
                            <li>Update the configuration check logic with the discovered standards</li>
                            <li>Switch from discovery mode to validation mode</li>
                        </ol>
                    </div>
                </div>
            `;
            
            configCheckResults.innerHTML = html;
            return;
        }
    }

    // Create sortable grid view for validation results
    function createValidationGridView(allIssues, totalDevicesChecked, container) {
        // Clear previous results and create grid container
        container.innerHTML = '';
        
        // Create header with controls
        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = 'margin: 20px 0 15px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;';
        headerDiv.innerHTML = `
            <h3 style="margin: 0 0 10px 0;">Validation Results Summary</h3>
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                    <strong>Sort by:</strong>
                    <select id="sortSelect" style="margin-left: 8px; padding: 4px 8px;">
                        <option value="location">Location (A-Z)</option>
                        <option value="locationNum">Location (Numerical)</option>
                        <option value="device">Device Name</option>
                        <option value="warning">Warning Type</option>
                        <option value="severity">Severity</option>
                    </select>
                </div>
                <button id="exportGridBtn" style="padding: 8px 16px; background: #51722c; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Export Report
                </button>
            </div>
        `;
        
        // Create table container
        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = 'overflow-x: auto; border: 1px solid #ddd; border-radius: 5px; margin-top: 15px;';
        
        const table = document.createElement('table');
        table.id = 'validationTable';
        table.style.cssText = 'width: 100%; border-collapse: collapse; background: white;';
        
        // Create table header
        table.innerHTML = `
            <thead>
                <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 1px solid #dee2e6;">Site Name</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 1px solid #dee2e6;">Device Name</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 1px solid #dee2e6;">Warning Type</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 1px solid #dee2e6;">Severity</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 1px solid #dee2e6;">Current Value</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 1px solid #dee2e6;">Expected Value</th>
                </tr>
            </thead>
            <tbody id="validationTableBody"></tbody>
        `;
        
        tableContainer.appendChild(table);
        container.appendChild(headerDiv);
        container.appendChild(tableContainer);
        
        // Flatten all issues into table rows
        const tableRows = [];
        allIssues.forEach(device => {
            device.issues.forEach(issue => {
                tableRows.push({
                    siteName: device.siteName,
                    deviceName: device.deviceName,
                    warningType: issue.type,
                    severity: issue.severity,
                    currentValue: issue.currentValue,
                    expectedValue: issue.expectedValue,
                    message: issue.message
                });
            });
        });
        
        // Function to render table rows
        function renderTable(rows) {
            const tbody = document.getElementById('validationTableBody');
            tbody.innerHTML = '';
            
            rows.forEach((row, index) => {
                const tr = document.createElement('tr');
                tr.style.cssText = `border-bottom: 1px solid #dee2e6; ${index % 2 === 0 ? 'background: #f8f9fa;' : 'background: white;'}`;
                
                let severityIcon = '⚠️';
                let severityColor = '#ff9800';
                if (row.severity === 'error') {
                    severityIcon = '❌';
                    severityColor = '#d32f2f';
                } else if (row.severity === 'info') {
                    severityIcon = 'ℹ️';
                    severityColor = '#2196f3';
                }
                
                tr.innerHTML = `
                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${row.siteName}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${row.deviceName}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">
                        <span style="color: ${severityColor};">${severityIcon}</span>
                        ${formatWarningType(row.warningType)}
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6; color: ${severityColor}; font-weight: 500;">
                        ${row.severity.toUpperCase()}
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-family: monospace; font-size: 14px;">
                        ${row.currentValue}
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-family: monospace; font-size: 14px;">
                        ${row.expectedValue}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
        
        // Function to sort rows
        function sortRows(rows, sortBy) {
            return [...rows].sort((a, b) => {
                switch (sortBy) {
                    case 'location':
                        return a.siteName.localeCompare(b.siteName);
                    case 'locationNum':
                        // Extract numbers from site names for numerical sorting
                        const aNum = extractLocationNumber(a.siteName);
                        const bNum = extractLocationNumber(b.siteName);
                        return aNum - bNum;
                    case 'device':
                        return a.deviceName.localeCompare(b.deviceName);
                    case 'warning':
                        return a.warningType.localeCompare(b.warningType);
                    case 'severity':
                        const severityOrder = { 'error': 0, 'warning': 1, 'info': 2 };
                        return severityOrder[a.severity] - severityOrder[b.severity];
                    default:
                        return 0;
                }
            });
        }
        
        // Helper function to extract location number from site name
        function extractLocationNumber(siteName) {
            const match = siteName.match(/(\d+)/);
            return match ? parseInt(match[1]) : 9999; // Put non-numeric at end
        }
        
        // Helper function to format warning type for display
        function formatWarningType(type) {
            const typeMap = {
                'timeZone': 'Time Zone',
                'contentSource': 'Content Source',
                'powerSettings': 'Power Settings',
                'powerSchedule': 'Power Schedule'
            };
            return typeMap[type] || type;
        }
        
        // Initial render with numerical location sorting
        let currentSort = 'locationNum';
        renderTable(sortRows(tableRows, currentSort));
        
        // Add sort functionality
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            currentSort = e.target.value;
            renderTable(sortRows(tableRows, currentSort));
        });
        
        // Add export functionality
        document.getElementById('exportGridBtn').addEventListener('click', () => {
            exportConfigReport(allIssues, totalDevicesChecked);
        });
    }
    window.exportConfigReport = function(issues, totalDevices) {
        // Create CSV content
        let csvContent = "Device Name,Site Name,Issue Type,Severity,Message,Current Value,Expected Value\n";
        
        issues.forEach(device => {
            device.issues.forEach(issue => {
                csvContent += `"${device.deviceName}","${device.siteName}","${issue.type}","${issue.severity}","${issue.message}","${issue.currentValue}","${issue.expectedValue}"\n`;
            });
        });
        
        // Create and download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `kwik-trip-device-validation-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(`Exported validation report with ${issues.length} devices having issues out of ${totalDevices} total devices checked.`);
    };

    // When location changes, show checkboxes for devices
    locationsSelect.addEventListener('change', () => {
        const locationId = locationsSelect.value;
        devicesContainer.innerHTML = '';
        if (!locationId) return;
        // Show loading indicator
        devicesContainer.innerHTML = '<p>Loading devices...</p>';
        loadingSpinner.style.display = 'block';
        setTimeout(() => { // Simulate loading for UX, remove if not needed
            const devices = allDisplays.filter(d => d.site && d.site.id === locationId);
            loadingSpinner.style.display = 'none';
            devicesContainer.innerHTML = '';
            if (devices.length === 0) {
                devicesContainer.innerHTML = '<p>No devices found at this location.</p>';
                return;
            }
            devices.forEach(device => {
                const label = document.createElement('label');
                label.style.display = 'block';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = device.id;
                if (!device.presence?.connected) {
                    checkbox.disabled = true;
                    label.style.color = '#aaa';
                }
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(
                    ` ${device.alias || device.id}${device.presence?.connected ? '' : ' (offline)'}`
                ));
                devicesContainer.appendChild(label);
            });
        }, 400); // Adjust/remove delay as needed
    });

    // Handle reboot button click
    rebootBtn.addEventListener('click', () => {
        const checked = devicesContainer.querySelectorAll('input[type="checkbox"]:checked');
        const displayIds = Array.from(checked).map(cb => cb.value);
        if (displayIds.length === 0) {
            alert('Please select at least one device.');
            return;
        }
        fetch(`/api/clients/${CLIENT_HANDLE}/reboot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayIds })
        })
        .then(res => res.json())
        .then(result => {
            alert('Reboot command sent!');
            // Optionally, show result/displays info
        })
        .catch(() => alert('Failed to send reboot command.'));
    });

    matchAndRebootBtn.addEventListener('click', () => {
        const file = signjetCsvInput.files[0];
        matchResults.style.display = 'none';
        matchResults.innerHTML = '';
        if (!file) {
            alert('Please upload a SignJet CSV.');
            return;
        }
        const formData = new FormData();
        formData.append('csv', file);
        formData.append('waveDevices', JSON.stringify(allDisplays)); // Send displays

        console.log('Sending match-signjet request', formData);

        fetch(`/api/clients/${CLIENT_HANDLE}/match-signjet`, {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(result => {
            if (result.matched && result.matched.length > 0) {
                // Show count and list with checkboxes
                matchResults.style.display = 'block';
                matchResults.innerHTML = `
                    <div>
                        <strong>Matched ${result.matched.length} devices:</strong>
                        <div style="margin: 10px 0;">
                            <label style="display: block; margin-bottom: 10px; font-weight: bold;">
                                <input type="checkbox" id="selectAllMatched" style="margin-right: 8px;" />
                                Select All
                            </label>
                        </div>
                        <div id="matchedDevicesContainer">
                            ${result.matched.map(d => {
                                const waveModel = d.waveModel ? ` (${d.waveModel})` : '';
                                const signjetModel = d.signjetModel ? ` [SignJet: ${d.signjetModel}]` : '';
                                return `
                                <label style="display: block; margin-bottom: 5px;">
                                    <input type="checkbox" class="matched-device" value="${d.waveID}" style="margin-right: 8px;" />
                                    ${d.waveName}${waveModel} at ${d.waveSite || 'Unknown Location'}${signjetModel}
                                </label>
                            `}).join('')}
                        </div>
                        <button id="rebootMatchedBtn" style="margin-top: 15px;">Reboot Selected Devices</button>
                    </div>
                `;
                
                // Handle select all functionality
                const selectAllCheckbox = document.getElementById('selectAllMatched');
                const deviceCheckboxes = document.querySelectorAll('.matched-device');
                
                selectAllCheckbox.addEventListener('change', function() {
                    deviceCheckboxes.forEach(checkbox => {
                        checkbox.checked = this.checked;
                    });
                });
                
                // Update select all when individual checkboxes change
                deviceCheckboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', function() {
                        const allChecked = Array.from(deviceCheckboxes).every(cb => cb.checked);
                        const noneChecked = Array.from(deviceCheckboxes).every(cb => !cb.checked);
                        selectAllCheckbox.checked = allChecked;
                        selectAllCheckbox.indeterminate = !allChecked && !noneChecked;
                    });
                });
                
                document.getElementById('rebootMatchedBtn').onclick = function() {
                    const checkedDevices = Array.from(document.querySelectorAll('.matched-device:checked'));
                    const displayIds = checkedDevices.map(cb => cb.value);
                    
                    if (displayIds.length === 0) {
                        alert('Please select at least one device to reboot.');
                        return;
                    }
                    
                    fetch(`/api/clients/${CLIENT_HANDLE}/reboot`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ displayIds })
                    })
                    .then(res => res.json())
                    .then(() => alert(`Reboot command sent to ${displayIds.length} device(s)!`))
                    .catch(() => alert('Failed to send reboot command.'));
                };
            } else {
                matchResults.style.display = 'block';
                matchResults.innerHTML = '<div>No matching devices found.</div>';
            }
        })
        .catch(() => {
            matchResults.style.display = 'block';
            matchResults.innerHTML = '<div style="color:red;">Failed to process CSV or match devices.</div>';
        });
    });

    // Function to populate locations with sorting and search
    function populateLocations(sites, searchTerm = '') {
        // Sort sites alphanumerically by extracting numbers from the name
        const sortedSites = sites.sort((a, b) => {
            const getNumber = (name) => {
                const match = name.match(/(\d+)/);
                return match ? parseInt(match[1]) : 0;
            };
            const numA = getNumber(a.name);
            const numB = getNumber(b.name);
            if (numA !== numB) return numA - numB;
            return a.name.localeCompare(b.name);
        });

        // Filter by search term if provided
        const filteredSites = searchTerm 
            ? sortedSites.filter(site => 
                site.name.toLowerCase().includes(searchTerm.toLowerCase())
              )
            : sortedSites;

        // Populate dropdown
        locationsSelect.innerHTML = '<option value="">Select a location</option>';
        filteredSites.forEach(site => {
            const option = document.createElement('option');
            option.value = site.id;
            option.textContent = site.name;
            locationsSelect.appendChild(option);
        });
    }
});