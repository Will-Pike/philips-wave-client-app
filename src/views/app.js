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
        const fullButton = document.getElementById('runConfigCheck');
        const originalButtonText = fullButton.innerHTML;
        
        // Immediately show loading state
        fullButton.disabled = true;
        fullButton.innerHTML = '🔄 Preparing validation...';
        fullButton.style.opacity = '0.7';
        
        const checks = {
            powerSchedules: document.getElementById('checkPowerSchedules').checked,
            defaultSource: document.getElementById('checkDefaultSource').checked,
            timeZone: document.getElementById('checkTimeZone').checked,
            powerSettings: document.getElementById('checkPowerSettings').checked,
            recommendedSettings: document.getElementById('checkRecommendedSettings').checked
        };
        
        // Get all online device IDs for the check
        const onlineDisplayIds = allDisplays
            .filter(d => d.presence && d.presence.connected)
            .map(d => d.id);
        
        if (onlineDisplayIds.length === 0) {
            // Restore button state
            fullButton.disabled = false;
            fullButton.innerHTML = originalButtonText;
            fullButton.style.opacity = '1';
            alert('No online devices found to check.');
            return;
        }
        
        // Update button text
        fullButton.innerHTML = '🔄 Validating configurations...';
        
        // Show loading
        const configCheckResults = document.getElementById('configCheckResults');
        configCheckResults.style.display = 'block';
        configCheckResults.innerHTML = `
            <div>
                <h3>Configuration Validation Progress</h3>
                <div id="batchProgress">Processing ${onlineDisplayIds.length} devices in reliable batches of 25...</div>
                <div style="margin: 10px 0;">
                    <div style="width: 100%; height: 12px; background: #eee; border-radius: 6px; overflow: hidden;">
                        <div id="validationProgressBar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #51722c 40%, #92c344 100%); transition: width 0.4s ease; border-radius: 6px;"></div>
                    </div>
                    <div id="progressText" style="text-align: center; color: #666; font-size: 13px; margin-top: 4px;">Using optimized batching with automatic retry...</div>
                </div>
                
                <div id="resultsContainer" style="margin-top: 15px;"></div>
            </div>
        `;
        
        try {
            // Let backend handle all batching with massive 500-device batches
            const batchProgressDiv = document.getElementById('batchProgress');
            const resultsContainer = document.getElementById('resultsContainer');
            const progressBar = document.getElementById('validationProgressBar');
            const progressText = document.getElementById('progressText');
            
            // Update initial progress
            progressBar.style.width = '5%';
            progressText.textContent = 'Starting streaming config check...';
            batchProgressDiv.innerHTML = `Initiating real-time streaming for ${onlineDisplayIds.length} devices...`;
            
            // Manual fetch with streaming support
            const response = await fetch(`/api/clients/${CLIENT_HANDLE}/config-check-streaming`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayIds: onlineDisplayIds, checks })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let totalProcessed = 0;
            let totalBatches = 0;
            let allIssues = [];
            
            // Process streaming response
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                
                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.type === 'start') {
                            progressBar.style.width = '10%';
                            progressText.textContent = `Processing ${data.totalDevices} devices in 500-device batches...`;
                            batchProgressDiv.innerHTML = `Starting real-time streaming for ${data.totalDevices} devices...`;
                        
                        } else if (data.type === 'batch-complete') {
                            const batch = data.data;
                            totalProcessed += batch.devicesProcessed;
                            totalBatches = batch.totalBatches;
                            allIssues.push(...batch.issues);
                            
                            // Update progress bar
                            const progress = Math.min(10 + (batch.progress * 0.85), 95);
                            progressBar.style.width = progress + '%';
                            progressText.textContent = `Batch ${batch.batchNumber}/${batch.totalBatches} complete - ${totalProcessed} devices processed`;
                            
                            // Update batch progress with real-time results
                            // batchProgressDiv.innerHTML = `
                            //     <strong>📊 Real-time Results - Batch ${batch.batchNumber}/${batch.totalBatches}</strong><br>
                            //     🔥 Just processed: ${batch.devicesProcessed} devices<br>
                            //     ⚠️ Issues found in batch: ${batch.devicesWithIssues}<br>
                            //     📈 Total processed: ${totalProcessed} devices<br>
                            //     🎯 Progress: ${batch.progress}%<br>
                            //     ${batch.devicesWithIssues > 0 ? `<span style="color: orange;">Found ${batch.devicesWithIssues} devices with issues in this batch</span>` : '<span style="color: green;">✅ All devices in this batch passed!</span>'}
                            // `;
                            batchProgressDiv.innerHTML = `
                                <strong> Real-time Results - Batch ${batch.batchNumber}/${batch.totalBatches}</strong><br>
                                Just processed: <b> ${batch.devicesProcessed} devices </b><br>
                                Issues found in batch: <b> ${batch.devicesWithIssues} </b><br>
                                Total processed: <b> ${totalProcessed} devices </b><br>
                                Progress: <b> ${batch.progress}% </b><br>
                                ${batch.devicesWithIssues > 0 ? `<span style="color: orange;">Found ${batch.devicesWithIssues} devices with issues in this batch</span>` : '<span style="color: green;">✅ All devices in this batch passed!</span>'}
                            `;
                            
                        } else if (data.type === 'complete') {
                            const result = data.data;
                            
                            // Complete progress
                            progressBar.style.width = '100%';
                            progressText.innerHTML = '<span style="color: #4caf50; font-weight: bold;">✅ Streaming Config Check Complete!</span>';
                            
                            // Show final summary
                            batchProgressDiv.innerHTML = `
                                <strong>🎉 Streaming Config Check Complete!</strong><br>
                                Total devices checked: ${result.totalDevicesChecked}<br>
                                Devices with issues: ${result.devicesWithIssues}<br>
                                Total batches processed: ${result.batchResults?.length || 0}<br>
                                ${result.devicesWithIssues === 0 ? '<span style="color: green;">🎉 All devices passed validation!</span>' : ''}
                            `;
                            
                            // Always show results (either success message or update options)
                            createResultsWithUpdateOptions(result, resultsContainer);
                            
                        } else if (data.type === 'error') {
                            throw new Error(data.error);
                        }
                    }
                }
            }
            
        } catch (error) {
            configCheckResults.innerHTML = '<div style="color:red;">Failed to check device configurations. ' + error.message + '</div>';
            console.error('Config check error:', error);
        } finally {
            // Restore button state
            fullButton.disabled = false;
            fullButton.innerHTML = originalButtonText;
            fullButton.style.opacity = '1';
        }
    });

    // Results display functions
    function createResultsWithUpdateOptions(result, resultsContainer) {
        if (result.devicesWithIssues === 0) {
            resultsContainer.innerHTML = `
                <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; border: 1px solid #4caf50; text-align: center;">
                    <h4 style="color: #2e7d32; margin: 0 0 10px 0;">🎉 All Devices Passed!</h4>
                    <p style="margin: 0;">All ${result.totalDevicesChecked} devices are properly configured.</p>
                </div>
            `;
            return;
        }

        // Convert streaming result format to the format expected by the grid view
        // The grid view expects an array of device objects with issues arrays
        const allIssues = [];
        if (result.issues) {
            result.issues.forEach(deviceResult => {
                if (deviceResult.issues && deviceResult.issues.length > 0) {
                    // Add device with its issues array - this matches the expected format
                    allIssues.push({
                        deviceId: deviceResult.deviceId,
                        deviceName: deviceResult.deviceName,
                        siteName: deviceResult.siteName,
                        issues: deviceResult.issues // Keep the issues as an array
                    });
                }
            });
        }

        // Use the existing grid view function that includes update options
        createValidationGridView(allIssues, result.totalDevicesChecked, resultsContainer);
    }

    function createDetailedResults(result, resultsContainer) {
        if (result.detailedResults && result.detailedResults.length > 0) {
            let html = '<h4>📋 Detailed Results:</h4>';
            
            result.detailedResults.forEach(device => {
                const hasIssues = device.issues && device.issues.length > 0;
                const hasWarnings = device.warnings && device.warnings.length > 0;
                
                let statusBadge = '✅ All Good';
                let statusColor = '#4caf50';
                let bgColor = '#e8f5e8';
                let borderColor = '#4caf50';
                
                if (hasIssues) {
                    statusBadge = '❌ Issues Found';
                    statusColor = '#d32f2f';
                    bgColor = '#ffebee';
                    borderColor = '#f44336';
                } else if (hasWarnings) {
                    statusBadge = '⚠️ Warnings';
                    statusColor = '#f57c00';
                    bgColor = '#fff3e0';
                    borderColor = '#ff9800';
                }
                
                html += `
                    <div style="background: ${bgColor}; padding: 12px; border-radius: 5px; border: 1px solid ${borderColor}; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${device.displayName || device.displayId}</strong>
                                <div style="font-size: 12px; color: #666; margin-top: 2px;">ID: ${device.displayId}</div>
                            </div>
                            <div style="color: ${statusColor}; font-weight: bold;">${statusBadge}</div>
                        </div>
                `;
                
                if (hasIssues) {
                    html += `
                        <div style="margin-top: 8px;">
                            <strong style="color: #d32f2f;">Issues:</strong>
                            <ul style="margin: 4px 0 0 0; padding-left: 20px; color: #d32f2f;">
                                ${device.issues.map(issue => `<li>${issue}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                }
                
                if (hasWarnings) {
                    html += `
                        <div style="margin-top: 8px;">
                            <strong style="color: #f57c00;">Warnings:</strong>
                            <ul style="margin: 4px 0 0 0; padding-left: 20px; color: #f57c00;">
                                ${device.warnings.map(warning => `<li>${warning}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                }
                
                html += '</div>';
            });
            
            resultsContainer.innerHTML = html;
        }
    }

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
            <div style="background: #fff3cd; padding: 10px; border-radius: 5px; border: 1px solid #ffc107; margin-bottom: 15px;">
                <p style="margin: 0 0 10px 0;">
                    <strong>🔧 Configuration Updates Available:</strong> Select devices below to automatically fix their configurations.
                </p>
                <button onclick="selectAllValidationDevices()" style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                    ✅ Select All
                </button>
                <button onclick="updateSelectedValidationConfigurations()" style="background: #ff9800; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                    🔧 Update Selected Configurations
                </button>
                <button onclick="applyRecommendedSettingsCorrections()" style="background: #9c27b0; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    ⚡ Apply Recommended Settings
                </button>
            </div>
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
        
        // Create table header with checkbox column
        table.innerHTML = `
            <thead>
                <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                    <th style="padding: 12px; text-align: center; font-weight: 600; border-bottom: 1px solid #dee2e6; width: 40px;">
                        <input type="checkbox" id="selectAllValidationCheckbox" onchange="toggleAllValidationDevices(this)">
                    </th>
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
        
        // Add update progress container
        const updateProgressContainer = document.createElement('div');
        updateProgressContainer.id = 'validationUpdateProgress';
        updateProgressContainer.style.cssText = 'display: none; margin-top: 20px;';
        updateProgressContainer.innerHTML = `
            <h4>🔧 Updating Configurations...</h4>
            <div style="width: 100%; height: 12px; background: #eee; border-radius: 6px; overflow: hidden; margin: 10px 0;">
                <div id="validationUpdateProgressBar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #ff9800 40%, #ffcc02 100%); transition: width 0.4s ease; border-radius: 6px;"></div>
            </div>
            <div id="validationUpdateProgressText" style="text-align: center; color: #666; font-size: 13px;"></div>
            <div id="validationUpdateResults" style="margin-top: 15px;"></div>
        `;
        container.appendChild(updateProgressContainer);
        
        // Flatten all issues into table rows with device grouping
        const deviceMap = new Map();
        allIssues.forEach(device => {
            if (!deviceMap.has(device.deviceId)) {
                deviceMap.set(device.deviceId, {
                    deviceId: device.deviceId,
                    deviceName: device.deviceName,
                    siteName: device.siteName,
                    issues: []
                });
            }
            deviceMap.get(device.deviceId).issues.push(...device.issues);
        });
        
        const tableRows = [];
        deviceMap.forEach(device => {
            device.issues.forEach(issue => {
                tableRows.push({
                    deviceId: device.deviceId,
                    siteName: device.siteName,
                    deviceName: device.deviceName,
                    warningType: issue.type,
                    severity: issue.severity,
                    currentValue: issue.currentValue,
                    expectedValue: issue.expectedValue,
                    message: issue.message,
                    deviceIssues: device.issues // Include all issues for this device
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
                
                const checkboxId = `validationDevice_${row.deviceId}_${index}`;
                
                tr.innerHTML = `
                    <td style="padding: 10px; text-align: center; border-bottom: 1px solid #dee2e6;">
                        <input type="checkbox" id="${checkboxId}" class="validation-device-checkbox" 
                               data-device-id="${row.deviceId}" data-device-name="${row.deviceName}" 
                               data-device-issues='${JSON.stringify(row.deviceIssues)}'>
                    </td>
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

    // Global functions for validation grid configuration updates
    window.toggleAllValidationDevices = function(masterCheckbox) {
        const checkboxes = document.querySelectorAll('.validation-device-checkbox');
        checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
    };

    window.selectAllValidationDevices = function() {
        const checkboxes = document.querySelectorAll('.validation-device-checkbox');
        checkboxes.forEach(cb => cb.checked = true);
        const masterCheckbox = document.getElementById('selectAllValidationCheckbox');
        if (masterCheckbox) masterCheckbox.checked = true;
    };

    window.updateSelectedValidationConfigurations = async function() {
        const checkboxes = document.querySelectorAll('.validation-device-checkbox:checked');
        if (checkboxes.length === 0) {
            alert('Please select at least one device to update.');
            return;
        }

        // Group by device ID to avoid duplicates
        const deviceMap = new Map();
        checkboxes.forEach(cb => {
            const deviceId = cb.dataset.deviceId;
            if (!deviceMap.has(deviceId)) {
                deviceMap.set(deviceId, {
                    deviceId,
                    deviceName: cb.dataset.deviceName,
                    issues: JSON.parse(cb.dataset.deviceIssues)
                });
            }
        });

        const selectedDevices = Array.from(deviceMap.values());

        // Show progress
        const progressContainer = document.getElementById('validationUpdateProgress');
        progressContainer.style.display = 'block';
        
        const progressBar = document.getElementById('validationUpdateProgressBar');
        const progressText = document.getElementById('validationUpdateProgressText');
        const resultsContainer = document.getElementById('validationUpdateResults');
        
        progressText.textContent = `Starting updates for ${selectedDevices.length} devices...`;
        resultsContainer.innerHTML = '';

        // Helper function to determine required config updates
        function getRequiredUpdates(issues) {
            const updates = {};
            
            issues.forEach(issue => {
                switch (issue.type) {
                    case 'timeZone':
                        updates.timeZone = 'America/Chicago';
                        break;
                    case 'contentSource':
                        updates.contentSource = 'com.digitaltouchsystems.snap';
                        break;
                    case 'defaultContentSource':
                        updates.defaultContentSource = 'HDMI1';
                        break;
                    case 'powerSettings':
                        updates.powerSettings = { signalDetection: false };
                        break;
                    case 'powerSchedule':
                        updates.powerState = 'ON';
                        break;
                }
            });
            
            return updates;
        }

        // Update each device
        for (let i = 0; i < selectedDevices.length; i++) {
            const device = selectedDevices[i];
            const progressPercent = (i / selectedDevices.length) * 100;
            
            progressBar.style.width = `${progressPercent}%`;
            progressText.textContent = `Updating ${device.deviceName} (${i + 1}/${selectedDevices.length})...`;
            
            try {
                const configUpdates = getRequiredUpdates(device.issues);
                
                const response = await fetch(`/api/clients/${CLIENT_HANDLE}/update-config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deviceId: device.deviceId,
                        configUpdates
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                
                // Display results for this device
                let resultHtml = `
                    <div style="border: 1px solid #4caf50; padding: 10px; margin-bottom: 10px; border-radius: 5px; background: #e8f5e8;">
                        <h5 style="margin: 0 0 8px 0; color: #2e7d32;">✅ ${device.deviceName}</h5>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
                `;
                
                result.results.forEach(updateResult => {
                    if (updateResult.success) {
                        resultHtml += `<li style="color: #2e7d32;">✅ ${updateResult.type} updated successfully</li>`;
                    } else {
                        resultHtml += `<li style="color: #d32f2f;">❌ ${updateResult.type} failed: ${updateResult.error}</li>`;
                    }
                });
                
                resultHtml += `</ul></div>`;
                resultsContainer.innerHTML += resultHtml;
                
            } catch (error) {
                const errorHtml = `
                    <div style="border: 1px solid #d32f2f; padding: 10px; margin-bottom: 10px; border-radius: 5px; background: #ffebee;">
                        <h5 style="margin: 0 0 8px 0; color: #d32f2f;">❌ ${device.deviceName}</h5>
                        <p style="margin: 0; font-size: 13px; color: #d32f2f;">Failed to update: ${error.message}</p>
                    </div>
                `;
                resultsContainer.innerHTML += errorHtml;
            }
        }

        // Complete progress
        progressBar.style.width = '100%';
        progressText.innerHTML = '<span style="color: #4caf50; font-weight: bold;">✅ Configuration Updates Complete!</span>';
        
        // Add option to re-run validation
        resultsContainer.innerHTML += `
            <div style="text-align: center; margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 5px;">
                <p style="margin: 0 0 10px 0;">🔄 Configuration updates complete! You can now re-run the full validation to verify the changes.</p>
                <button onclick="document.getElementById('runConfigCheck').click()" 
                        style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    ⚙️ Re-run Full Validation
                </button>
            </div>
        `;
    };

    // Function to apply recommended settings corrections to selected devices
    window.applyRecommendedSettingsCorrections = async function() {
        const checkboxes = document.querySelectorAll('.validation-device-checkbox:checked');
        if (checkboxes.length === 0) {
            alert('Please select at least one device to apply recommended settings corrections.');
            return;
        }

        // Filter devices that have recommended settings issues
        const deviceMap = new Map();
        checkboxes.forEach(cb => {
            const deviceId = cb.dataset.deviceId;
            const issues = JSON.parse(cb.dataset.deviceIssues);
            
            // Check if this device has recommended settings issues
            const hasRecommendedIssues = issues.some(issue => 
                issue.type === 'recommendedSettings' || issue.type === 'recommendedSettingsWarning'
            );
            
            if (hasRecommendedIssues && !deviceMap.has(deviceId)) {
                deviceMap.set(deviceId, {
                    deviceId,
                    deviceName: cb.dataset.deviceName,
                    issues: issues.filter(issue => 
                        issue.type === 'recommendedSettings' || issue.type === 'recommendedSettingsWarning'
                    )
                });
            }
        });

        const devicesWithRecommendedIssues = Array.from(deviceMap.values());
        
        if (devicesWithRecommendedIssues.length === 0) {
            alert('None of the selected devices have recommended settings issues that can be automatically corrected.');
            return;
        }

        // Confirm the action
        const confirmMessage = `Apply recommended settings corrections to ${devicesWithRecommendedIssues.length} device(s)?\n\n` +
            `This will automatically configure optimal settings like power mode and other recommended optimizations.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        // Show progress
        const progressContainer = document.getElementById('validationUpdateProgress');
        progressContainer.style.display = 'block';
        
        const progressBar = document.getElementById('validationUpdateProgressBar');
        const progressText = document.getElementById('validationUpdateProgressText');
        const resultsContainer = document.getElementById('validationUpdateResults');
        
        progressText.textContent = `Applying recommended settings to ${devicesWithRecommendedIssues.length} devices...`;
        resultsContainer.innerHTML = '';
        progressBar.style.width = '10%';

        try {
            // Prepare device IDs for the bulk mutation
            const deviceIds = devicesWithRecommendedIssues.map(device => device.deviceId);
            
            // Call the recommended settings correction API
            const response = await fetch(`/api/clients/${CLIENT_HANDLE}/apply-recommended-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceIds })
            });

            progressBar.style.width = '70%';

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            progressBar.style.width = '100%';

            if (result.success) {
                progressText.innerHTML = '<span style="color: #4caf50; font-weight: bold;">✅ Recommended Settings Applied Successfully!</span>';
                
                // Display results
                let resultHtml = `
                    <div style="background: #e8f5e8; padding: 15px; margin: 15px 0; border-radius: 5px; border: 1px solid #4caf50;">
                        <h4 style="color: #2e7d32; margin: 0 0 10px 0;">🎉 Recommended Settings Corrections Complete!</h4>
                        <p style="margin: 0 0 10px 0;"><strong>Devices Updated:</strong> ${result.totalDevicesUpdated}</p>
                        <div style="max-height: 200px; overflow-y: auto;">
                `;
                
                result.updatedDevices.forEach(device => {
                    const statusIcon = device.recommendedSettingsCompliant ? '✅' : '⚠️';
                    const statusText = device.recommendedSettingsCompliant ? 'Compliant' : `${device.remainingWarnings} warnings remaining`;
                    
                    resultHtml += `
                        <div style="padding: 8px; margin: 5px 0; background: white; border-radius: 3px; border: 1px solid #ddd;">
                            <strong>${statusIcon} ${device.alias || device.id}</strong><br>
                            <small>Status: ${statusText}</small>
                        </div>
                    `;
                });
                
                resultHtml += `
                        </div>
                        <div style="text-align: center; margin-top: 15px;">
                            <p style="margin: 0 0 10px 0;">🔄 Re-run the full validation to verify all changes have been applied correctly.</p>
                            <button onclick="document.getElementById('runConfigCheck').click()" 
                                    style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                                ⚙️ Re-run Full Validation
                            </button>
                        </div>
                    </div>
                `;
                
                resultsContainer.innerHTML = resultHtml;
                
            } else {
                throw new Error(result.error || 'Unknown error occurred');
            }

        } catch (error) {
            console.error('Error applying recommended settings:', error);
            progressBar.style.width = '100%';
            progressText.innerHTML = '<span style="color: #d32f2f; font-weight: bold;">❌ Error Applying Recommended Settings</span>';
            
            const errorHtml = `
                <div style="background: #ffebee; padding: 15px; margin: 15px 0; border-radius: 5px; border: 1px solid #f44336;">
                    <h4 style="color: #d32f2f; margin: 0 0 10px 0;">❌ Error Occurred</h4>
                    <p style="margin: 0; color: #d32f2f;">Failed to apply recommended settings: ${error.message}</p>
                    <p style="margin: 10px 0 0 0; font-size: 13px; color: #666;">
                        You can try again or check the console for more details.
                    </p>
                </div>
            `;
            resultsContainer.innerHTML = errorHtml;
        }
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

    // Create test results with configuration update options
    function createTestResultsWithUpdateOptions(result, container) {
        let html = `
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; border: 1px solid #ffc107; margin-bottom: 20px;">
                <h4 style="color: #856404; margin: 0 0 10px 0;">🔧 Configuration Issues Found</h4>
                <p style="margin: 0 0 10px 0;">
                    <strong>Test Results:</strong> ${result.devicesWithIssues} of ${result.totalDevicesChecked} devices need configuration updates.
                </p>
                <p style="margin: 0; font-size: 14px; color: #856404;">
                    ⚠️ You can select devices below to automatically fix their configurations.
                </p>
            </div>
            <div style="margin-bottom: 15px;">
                <button onclick="selectAllTestDevices()" style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                    ✅ Select All
                </button>
                <button onclick="updateSelectedConfigurations()" style="background: #ff9800; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    🔧 Update Selected Configurations
                </button>
            </div>
            <div id="testDevicesList">
        `;

        result.issues.forEach((device, index) => {
            const deviceCheckboxId = `testDevice_${device.deviceId}`;
            
            let issuesList = '';
            device.issues.forEach(issue => {
                let severityColor = '#ff9800';
                let severityIcon = '⚠️';
                
                if (issue.severity === 'error') {
                    severityColor = '#d32f2f';
                    severityIcon = '❌';
                }
                
                issuesList += `
                    <li style="margin-bottom: 5px; color: ${severityColor};">
                        ${severityIcon} <strong>${issue.message}</strong><br>
                        <small style="color: #666;">Current: ${issue.currentValue} → Expected: ${issue.expectedValue}</small>
                    </li>
                `;
            });
            
            html += `
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 5px; background: white;" 
                     data-device-id="${device.deviceId}" data-device-issues='${JSON.stringify(device.issues)}'>
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <input type="checkbox" id="${deviceCheckboxId}" class="test-device-checkbox" 
                               style="margin-right: 10px;" data-device-id="${device.deviceId}">
                        <label for="${deviceCheckboxId}" style="font-weight: bold; cursor: pointer;">
                            🖥️ ${device.deviceName} at ${device.siteName}
                        </label>
                    </div>
                    <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
                        ${issuesList}
                    </ul>
                </div>
            `;
        });

        html += `
            </div>
            <div id="updateProgress" style="display: none; margin-top: 20px;">
                <h4>🔧 Updating Configurations...</h4>
                <div style="width: 100%; height: 12px; background: #eee; border-radius: 6px; overflow: hidden; margin: 10px 0;">
                    <div id="updateProgressBar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #ff9800 40%, #ffcc02 100%); transition: width 0.4s ease; border-radius: 6px;"></div>
                </div>
                <div id="updateProgressText" style="text-align: center; color: #666; font-size: 13px;"></div>
                <div id="updateResults" style="margin-top: 15px;"></div>
            </div>
        `;

        container.innerHTML = html;
    }

    // Global functions for configuration updates
    window.selectAllTestDevices = function() {
        const checkboxes = document.querySelectorAll('.test-device-checkbox');
        checkboxes.forEach(cb => cb.checked = true);
    };

    window.updateSelectedConfigurations = async function() {
        const checkboxes = document.querySelectorAll('.test-device-checkbox:checked');
        if (checkboxes.length === 0) {
            alert('Please select at least one device to update.');
            return;
        }

        const selectedDevices = Array.from(checkboxes).map(cb => {
            const deviceId = cb.dataset.deviceId;
            const deviceContainer = document.querySelector(`[data-device-id="${deviceId}"]`);
            const deviceIssues = JSON.parse(deviceContainer.dataset.deviceIssues);
            
            return {
                deviceId,
                deviceName: deviceContainer.querySelector('label').textContent.replace('🖥️ ', ''),
                issues: deviceIssues
            };
        });

        // Show progress
        const progressContainer = document.getElementById('updateProgress');
        progressContainer.style.display = 'block';
        
        const progressBar = document.getElementById('updateProgressBar');
        const progressText = document.getElementById('updateProgressText');
        const resultsContainer = document.getElementById('updateResults');
        
        progressText.textContent = `Starting updates for ${selectedDevices.length} devices...`;
        resultsContainer.innerHTML = '';

        // Helper function to determine required config updates
        function getRequiredUpdates(issues) {
            const updates = {};
            
            issues.forEach(issue => {
                switch (issue.type) {
                    case 'timeZone':
                        updates.timeZone = 'America/Chicago';
                        break;
                    case 'contentSource':
                        updates.contentSource = 'com.digitaltouchsystems.snap';
                        break;
                    case 'defaultContentSource':
                        updates.defaultContentSource = 'HDMI1';
                        break;
                    case 'powerSettings':
                        updates.powerSettings = { signalDetection: false };
                        break;
                    case 'powerSchedule':
                        updates.powerState = 'ON';
                        break;
                }
            });
            
            return updates;
        }

        // Update each device
        for (let i = 0; i < selectedDevices.length; i++) {
            const device = selectedDevices[i];
            const progressPercent = (i / selectedDevices.length) * 100;
            
            progressBar.style.width = `${progressPercent}%`;
            progressText.textContent = `Updating ${device.deviceName} (${i + 1}/${selectedDevices.length})...`;
            
            try {
                const configUpdates = getRequiredUpdates(device.issues);
                
                const response = await fetch(`/api/clients/${CLIENT_HANDLE}/update-config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deviceId: device.deviceId,
                        configUpdates
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                
                // Display results for this device
                let resultHtml = `
                    <div style="border: 1px solid #4caf50; padding: 10px; margin-bottom: 10px; border-radius: 5px; background: #e8f5e8;">
                        <h5 style="margin: 0 0 8px 0; color: #2e7d32;">✅ ${device.deviceName}</h5>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
                `;
                
                result.results.forEach(updateResult => {
                    if (updateResult.success) {
                        resultHtml += `<li style="color: #2e7d32;">✅ ${updateResult.type} updated successfully</li>`;
                    } else {
                        resultHtml += `<li style="color: #d32f2f;">❌ ${updateResult.type} failed: ${updateResult.error}</li>`;
                    }
                });
                
                resultHtml += `</ul></div>`;
                resultsContainer.innerHTML += resultHtml;
                
            } catch (error) {
                const errorHtml = `
                    <div style="border: 1px solid #d32f2f; padding: 10px; margin-bottom: 10px; border-radius: 5px; background: #ffebee;">
                        <h5 style="margin: 0 0 8px 0; color: #d32f2f;">❌ ${device.deviceName}</h5>
                        <p style="margin: 0; font-size: 13px; color: #d32f2f;">Failed to update: ${error.message}</p>
                    </div>
                `;
                resultsContainer.innerHTML += errorHtml;
            }
        }

        // Complete progress
        progressBar.style.width = '100%';
        progressText.innerHTML = '<span style="color: #4caf50; font-weight: bold;">✅ Configuration Updates Complete!</span>';
        
        // Add option to re-test
        resultsContainer.innerHTML += `
            <div style="text-align: center; margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 5px;">
                <p style="margin: 0 0 10px 0;">🔄 Configuration updates complete! You can now re-run the test to verify the changes.</p>
                <button onclick="document.getElementById('runTestConfigCheck').click()" 
                        style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    🧪 Re-run Test Configuration Check
                </button>
            </div>
        `;
    };
});