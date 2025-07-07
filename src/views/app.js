document.addEventListener('DOMContentLoaded', () => {
    const clientsSelect = document.getElementById('clients');
    const locationsSelect = document.getElementById('locations');
    const devicesContainer = document.getElementById('devicesContainer');
    const rebootBtn = document.getElementById('rebootDevices');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const signjetCsvInput = document.getElementById('signjetCsv');
    const matchResults = document.getElementById('matchResults');
    const matchAndRebootBtn = document.getElementById('matchAndReboot');

    let allDisplays = []; // Store all fetched displays

    // Populate clients
    fetch('/api/clients')
        .then(res => res.json())
        .then(clients => {
            clientsSelect.innerHTML = '<option value="">Select a client</option>';
            clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client.handle;
                option.textContent = client.name;
                clientsSelect.appendChild(option);
            });
        });

    // When client changes, populate locations
    clientsSelect.addEventListener('change', () => {
        const clientHandle = clientsSelect.value;
        locationsSelect.innerHTML = '';
        devicesContainer.innerHTML = '';
        if (!clientHandle) return;

        // Show loading indicator
        devicesContainer.innerHTML = '<p>Loading displays...</p>';
        loadingSpinner.style.display = 'block';
        fetch(`/api/clients/${clientHandle}/displays`)
            .then(res => res.json())
            .then(displays => {
                allDisplays = displays; // Save for later use
                // Populate locations dropdown
                const sitesMap = {};
                displays.forEach(display => {
                    if (display.site && display.site.id) {
                        sitesMap[display.site.id] = display.site;
                    }
                });
                locationsSelect.innerHTML = '<option value="">Select a location</option>';
                Object.values(sitesMap).forEach(site => {
                    const option = document.createElement('option');
                    option.value = site.id;
                    option.textContent = site.name;
                    locationsSelect.appendChild(option);
                });
                devicesContainer.innerHTML = '';
                loadingSpinner.style.display = 'none';
            })
            .catch(() => {
                loadingSpinner.style.display = 'none';
            });
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
        const clientHandle = clientsSelect.value;
        const checked = devicesContainer.querySelectorAll('input[type="checkbox"]:checked');
        const displayIds = Array.from(checked).map(cb => cb.value);
        if (!clientHandle || displayIds.length === 0) {
            alert('Please select at least one device.');
            return;
        }
        fetch(`/api/clients/${clientHandle}/reboot`, {
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
        const clientHandle = clientsSelect.value;
        const file = signjetCsvInput.files[0];
        matchResults.style.display = 'none';
        matchResults.innerHTML = '';
        if (!clientHandle || !file) {
            alert('Please select a client and upload a SignJet CSV.');
            return;
        }
        const formData = new FormData();
        formData.append('csv', file);
        formData.append('waveDevices', JSON.stringify(allDisplays)); // Send displays

        console.log('Sending match-signjet request', formData);

        fetch(`/api/clients/${clientHandle}/match-signjet`, {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(result => {
            if (result.matched && result.matched.length > 0) {
                // Show count and list
                matchResults.style.display = 'block';
                matchResults.innerHTML = `
                    <div>
                        <strong>Matched ${result.matched.length} devices:</strong>
                        <ul>
                            ${result.matched.map(d => `<li>${d.waveName} (ID: ${d.waveID})</li>`).join('')}
                        </ul>
                        <button id="rebootMatchedBtn">Reboot All Matched Devices</button>
                    </div>
                `;
                document.getElementById('rebootMatchedBtn').onclick = function() {
                    const displayIds = result.matched.map(d => d.waveID);
                    fetch(`/api/clients/${clientHandle}/reboot`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ displayIds })
                    })
                    .then(res => res.json())
                    .then(() => alert('Reboot command sent!'))
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
});