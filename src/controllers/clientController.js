const { waveGraphQL } = require('../utils/waveApi');

class ClientController {
    async getClients(req, res) {
        try {
            const clients = await this.fetchClientsFromAPI();
            res.status(200).json(clients);
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving clients', error });
        }
    }

    async getLocations(req, res) {
        const { clientId } = req.params;
        try {
            const locations = await this.fetchLocationsFromAPI(clientId);
            res.status(200).json(locations);
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving locations', error });
        }
    }

    async getDevices(req, res) {
        const { locationId } = req.params;
        try {
            const devices = await this.fetchDevicesFromAPI(locationId);
            res.status(200).json(devices);
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving devices', error });
        }
    }

    async sendCommand(req, res) {
        const { clientId, locationId, deviceId, command } = req.body;
        try {
            const result = await this.sendCommandToDevice(clientId, locationId, deviceId, command);
            res.status(200).json({ message: 'Command sent successfully', result });
        } catch (error) {
            res.status(500).json({ message: 'Error sending command', error });
        }
    }

    async getDevicesByClient(req, res) {
        const { handle } = req.params;
        const query = `
            query {
                customerByHandle(handle: "${handle}") {
                    displays {
                        id
                        alias
                        platform { name }
                        timeZone { reported }
                        site { id name }
                        contentSource {
                            current {
                                reported {
                                    ... on InputContentSource { source }
                                    ... on AppContentSource { activityList applicationId }
                                }
                            }
                        }
                        powerSettings { reported { signalDetection } }
                        power { reported desired }
                    }
                }
            }
        `;
        try {
            const data = await waveGraphQL(query);
            res.json(data.customerByHandle.displays);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    async fetchClientsFromAPI() {
        const query = `
            query {
                organization {
                    customers {
                        id
                        name
                        handle
                    }
                }
            }
        `;
        try {
            const data = await waveGraphQL(query);
            return data.organization.customers;
        } catch (error) {
            throw new Error('Failed to fetch clients: ' + error.message);
        }
    }

    async fetchLocationsFromAPI(clientHandle) {
        const query = `
            query {
                customerByHandle(handle: "${clientHandle}") {
                    displays {
                        site {
                            id
                            name
                        }
                    }
                }
            }
        `;
        try {
            const data = await waveGraphQL(query);
            const displays = data.customerByHandle?.displays || [];
            const sitesMap = {};
            displays.forEach(display => {
                if (display.site && display.site.id) {
                    sitesMap[display.site.id] = display.site;
                }
            });
            return Object.values(sitesMap);
        } catch (error) {
            throw new Error('Failed to fetch locations: ' + error.message);
        }
    }

    async fetchDevicesFromAPI(locationId) {
        // You need to know the client handle to query displays, so you may want to pass it as a parameter.
        // For now, let's assume you can get all displays and filter by site.
        const query = `
            query {
                organization {
                    customers {
                        handle
                        displays {
                            id
                            alias
                            site {
                                id
                            }
                        }
                    }
                }
            }
        `;
        try {
            const data = await waveGraphQL(query);
            // Flatten all displays from all customers, filter by site id
            const customers = data.organization.customers || [];
            let displays = [];
            customers.forEach(customer => {
                if (customer.displays) {
                    displays = displays.concat(customer.displays);
                }
            });
            // Filter displays by locationId (site id)
            return displays.filter(display => display.site && display.site.id === locationId);
        } catch (error) {
            throw new Error('Failed to fetch devices: ' + error.message);
        }
    }

    async fetchDevicesForClientAndLocation(clientHandle, locationId) {
        const query = `
            query {
                customerByHandle(handle: "${clientHandle}") {
                    displays {
                        id
                        alias
                        site { id }
                        presence { connected }
                    }
                }
            }
        `;
        try {
            const data = await waveGraphQL(query);
            const displays = data.customerByHandle?.displays || [];
            return displays
                .filter(display => display.site && display.site.id === locationId)
                .map(display => ({
                    id: display.id,
                    alias: display.alias,
                    online: display.presence?.connected === true
                }));
        } catch (error) {
            throw new Error('Failed to fetch devices: ' + error.message);
        }
    }

    async sendCommandToDevice(clientId, locationId, deviceId, command) {
        // Placeholder for actual logic to send command to device
        return { clientId, locationId, deviceId, command };
    }

    async rebootDisplays(clientHandle, displayIds) {
        const query = `
            mutation {
                displayBulkReboot(input: {
                    displayIds: [${displayIds.map(id => `"${id}"`).join(',')}]
                }) {
                    displays {
                        id
                        alias
                        site { id name }
                        power { reported desired }
                    }
                }
            }
        `;
        try {
            const data = await waveGraphQL(query);
            return data.displayBulkReboot;
        } catch (error) {
            throw new Error('Failed to reboot displays: ' + error.message);
        }
    }

    async fetchAllDisplaysForClient(clientHandle) {
        const query = `
            query {
                customerByHandle(handle: "${clientHandle}") {
                    displays {
                        id
                        alias
                        site { id name }
                        presence { connected }
                    }
                }
            }
        `;
        try {
            const data = await waveGraphQL(query);
            return data.customerByHandle?.displays || [];
        } catch (error) {
            throw new Error('Failed to fetch displays: ' + error.message);
        }
    }
}

module.exports = ClientController;