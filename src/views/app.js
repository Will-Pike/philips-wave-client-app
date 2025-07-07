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
    const locationTabContent = document.getElementById('locationTabContent');
    const signjetTabContent = document.getElementById('signjetTabContent');

    // Add references for enabling/disabling UI
    const tabsContainer = document.getElementById('tabsContainer');

    // Function to enable UI after devices are loaded
    function enableUI() {
        tabsContainer.classList.remove('disabled');
        locationTabContent.classList.remove('disabled');
        signjetTabContent.classList.remove('disabled');
        locationsSelect.disabled = false;
        locationSearch.disabled = false;
        rebootBtn.disabled = false;
        signjetCsvInput.disabled = false;
        matchAndRebootBtn.disabled = false;
    }

    locationTab.addEventListener('click', () => {
        locationTab.classList.add('active');
        signjetTab.classList.remove('active');
        locationTabContent.classList.add('active');
        signjetTabContent.classList.remove('active');
    });

    signjetTab.addEventListener('click', () => {
        signjetTab.classList.add('active');
        locationTab.classList.remove('active');
        signjetTabContent.classList.add('active');
        locationTabContent.classList.remove('active');
    });

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
                            ${result.matched.map(d => `
                                <label style="display: block; margin-bottom: 5px;">
                                    <input type="checkbox" class="matched-device" value="${d.waveID}" style="margin-right: 8px;" />
                                    ${d.waveName} at ${d.waveSite || 'Unknown Location'}
                                </label>
                            `).join('')}
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