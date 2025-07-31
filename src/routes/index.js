const ClientController = require('../controllers/clientController');
const authController = require('../controllers/authController');
const ConfigCheckController = require('../controllers/configCheckController');
const ConfigUpdateController = require('../controllers/configUpdateController');
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

    app.post('/api/clients/:clientHandle/config-check', async (req, res) => {
        const { clientHandle } = req.params;
        const { displayIds, checks } = req.body;
        
        try {
            const configController = new ConfigCheckController();
            const result = await configController.checkDeviceConfiguration(clientHandle, displayIds, checks);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Streaming config check that sends real-time batch results
    app.post('/api/clients/:clientHandle/config-check-streaming', async (req, res) => {
        const { clientHandle } = req.params;
        const { displayIds, checks } = req.body;
        
        try {
            // Set up SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });
            
            const configController = new ConfigCheckController();
            
            // Callback function to send batch results to client
            const onBatchComplete = async (batchResult) => {
                const data = JSON.stringify({
                    type: 'batch-complete',
                    data: batchResult
                });
                res.write(`data: ${data}\n\n`);
            };
            
            // Send initial start message
            res.write(`data: ${JSON.stringify({type: 'start', totalDevices: displayIds.length})}\n\n`);
            
            // Process the streaming config check
            const finalResult = await configController.streamingConfigCheck(
                clientHandle, 
                displayIds, 
                checks, 
                onBatchComplete
            );
            
            // Send final completion message
            res.write(`data: ${JSON.stringify({type: 'complete', data: finalResult})}\n\n`);
            res.end();
            
        } catch (error) {
            // Send error message
            res.write(`data: ${JSON.stringify({type: 'error', error: error.message})}\n\n`);
            res.end();
        }
    });

    // Get test devices from Triggerpoint Media HQ
    app.get('/api/clients/:clientHandle/test-devices', async (req, res) => {
        const { clientHandle } = req.params;
        
        try {
            const configUpdateController = new ConfigUpdateController();
            const testDevices = await configUpdateController.getTestDevices(clientHandle);
            res.json(testDevices);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Update device configuration
    app.post('/api/clients/:clientHandle/update-config', async (req, res) => {
        const { clientHandle } = req.params;
        const { deviceId, configUpdates } = req.body;
        
        try {
            const configUpdateController = new ConfigUpdateController();
            const results = await configUpdateController.updateDeviceConfiguration(clientHandle, deviceId, configUpdates);
            res.json({ success: true, results });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Batch update multiple devices
    app.post('/api/clients/:clientHandle/batch-update-config', async (req, res) => {
        const { clientHandle } = req.params;
        const { updates } = req.body; // Array of { deviceId, configUpdates }
        
        try {
            const configUpdateController = new ConfigUpdateController();
            const allResults = [];
            
            for (const update of updates) {
                const results = await configUpdateController.updateDeviceConfiguration(
                    clientHandle, 
                    update.deviceId, 
                    update.configUpdates
                );
                allResults.push({
                    deviceId: update.deviceId,
                    results
                });
            }
            
            res.json({ success: true, deviceResults: allResults });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Apply recommended settings corrections to devices
    app.post('/api/clients/:clientHandle/apply-recommended-settings', async (req, res) => {
        const { clientHandle } = req.params;
        const { deviceIds } = req.body; // Array of device IDs
        
        try {
            const configCheckController = new ConfigCheckController();
            const results = await configCheckController.applyRecommendedSettingsCorrections(clientHandle, deviceIds);
            
            res.json({
                success: results.success,
                totalDevicesUpdated: results.totalDevicesUpdated,
                updatedDevices: results.updatedDevices,
                error: results.error
            });
        } catch (error) {
            console.error('Error applying recommended settings:', error);
            res.status(500).json({ 
                success: false,
                error: error.message,
                totalDevicesUpdated: 0,
                updatedDevices: []
            });
        }
    });

    app.post('/api/login', authController.login);
};