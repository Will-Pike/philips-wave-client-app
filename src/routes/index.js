const ClientController = require('../controllers/clientController');
const authController = require('../controllers/authController');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { matchSignJetToWave } = require('./matcher');

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

    app.post('/api/clients/:clientHandle/match-signjet', upload.single('csv'), async (req, res) => {
        console.log('POST /api/clients/:clientHandle/match-signjet called');
        const csvPath = req.file.path;
        try {
            let waveDevices = req.body.waveDevices;
            // Defensive: parse if string, validate as array
            if (typeof waveDevices === 'string') {
                waveDevices = JSON.parse(waveDevices);
            }
            if (!Array.isArray(waveDevices)) {
                return res.status(400).json({ error: 'waveDevices must be an array' });
            }
            console.log('typeof waveDevices:', typeof waveDevices, Array.isArray(waveDevices));
            const matched = await matchSignJetToWave(csvPath, waveDevices);
            res.json({ matched });
        } catch (error) {
            res.status(500).json({ error: error.message });
        } finally {
            require('fs').unlink(csvPath, () => {});
        }
    });

    app.post('/api/login', authController.login);
};