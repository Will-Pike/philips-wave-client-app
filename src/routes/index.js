const ClientController = require('../controllers/clientController');

module.exports = function(app) {
    const controller = new ClientController();

    app.get('/api/clients', async (req, res) => {
        try {
            const clients = await controller.fetchClientsFromAPI();
            res.json(clients);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/clients/:clientHandle/locations', async (req, res) => {
        try {
            const locations = await controller.fetchLocationsFromAPI(req.params.clientHandle);
            res.json(locations);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/clients/:clientHandle/locations/:locationId/devices', async (req, res) => {
        try {
            const devices = await controller.fetchDevicesForClientAndLocation(
                req.params.clientHandle,
                req.params.locationId
            );
            res.json(devices);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/clients/:clientHandle/reboot', async (req, res) => {
        const { clientHandle } = req.params;
        const { displayIds } = req.body;
        try {
            const result = await controller.rebootDisplays(clientHandle, displayIds);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/clients/:clientHandle/displays', async (req, res) => {
        try {
            const displays = await controller.fetchAllDisplaysForClient(req.params.clientHandle);
            res.json(displays);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
};