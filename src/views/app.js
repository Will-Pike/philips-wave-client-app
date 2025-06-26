document.addEventListener('DOMContentLoaded', () => {
    const clientsSelect = document.getElementById('clients');
    const locationsSelect = document.getElementById('locations');
    const devicesContainer = document.getElementById('devicesContainer');
    const rebootBtn = document.getElementById('rebootDevices');
    const loadingSpinner = document.getElementById('loadingSpinner');

    let allDisplays = [];

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
                allDisplays = displays;
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
});