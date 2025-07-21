// src/controllers/configCheckController.js
const ClientController = require('./clientController');
const { waveGraphQL } = require('../utils/waveApi');

class ConfigCheckController extends ClientController {
    
    // Define expected configuration standards for Kwik Trip based on real device data
    getExpectedConfig() {
        return {
            timeZone: {
                expected: "America/Chicago", // Central Time for Kwik Trip
                description: "Time zone should be set to America/Chicago (Central Time)"
            },
            contentSource: {
                preferredApp: "com.digitaltouchsystems.snap",
                acceptableSource: "CUSTOM",
                description: "Content source should ideally be the SignJet app, or CUSTOM as acceptable fallback"
            },
            powerSettings: {
                expectedSignalDetection: false, // Accept false, null, or undefined
                description: "Signal detection should be disabled or not set"
            },
            powerMode: {
                // We'll need to check recommendedSettings to validate power mode 4
                checkRecommendedSettings: true,
                description: "Power mode should be set to power-save mode 4 (validated via recommendedSettings)"
            }
        };
    }

    async checkDeviceConfiguration(clientHandle, displayIds, checks = {}) {
        try {
            const expectedConfig = this.getExpectedConfig();
            const issues = [];
            
            // Get detailed device information
            const devices = await this.fetchDisplaysWithConfig(clientHandle, displayIds);
            
            for (const device of devices) {
                if (!device || !device.id) {
                    console.warn('Skipping invalid device:', device);
                    continue;
                }
                
                const deviceIssues = [];
                
                // Check Time Zone
                if (checks.timeZone && device.timeZone) {
                    const currentTimeZone = device.timeZone.reported;
                    if (currentTimeZone && currentTimeZone !== expectedConfig.timeZone.expected) {
                        deviceIssues.push({
                            type: 'timeZone',
                            severity: 'error',
                            message: 'Incorrect time zone setting',
                            description: expectedConfig.timeZone.description,
                            currentValue: currentTimeZone,
                            expectedValue: expectedConfig.timeZone.expected
                        });
                    } else if (!currentTimeZone) {
                        deviceIssues.push({
                            type: 'timeZone',
                            severity: 'warning',
                            message: 'Time zone not configured',
                            description: expectedConfig.timeZone.description,
                            currentValue: 'Not set',
                            expectedValue: expectedConfig.timeZone.expected
                        });
                    }
                }
                
                // Check Content Source (based on real requirements)
                if (checks.defaultSource && device.contentSource) {
                    const currentSource = device.contentSource.current?.reported;
                    if (currentSource) {
                        // Check if it's the preferred Snap app
                        const isSnapApp = currentSource.applicationId === expectedConfig.contentSource.preferredApp;
                        // Check if it's acceptable CUSTOM source
                        const isCustomSource = currentSource.source === expectedConfig.contentSource.acceptableSource;
                        
                        if (!isSnapApp && !isCustomSource) {
                            deviceIssues.push({
                                type: 'contentSource',
                                severity: 'error',
                                message: 'Content source not using approved configuration',
                                description: expectedConfig.contentSource.description,
                                currentValue: currentSource.applicationId || currentSource.source || 'Unknown',
                                expectedValue: `${expectedConfig.contentSource.preferredApp} or ${expectedConfig.contentSource.acceptableSource}`
                            });
                        }
                    } else {
                        deviceIssues.push({
                            type: 'contentSource',
                            severity: 'error',
                            message: 'No content source configured',
                            description: expectedConfig.contentSource.description,
                            currentValue: 'Not configured',
                            expectedValue: `${expectedConfig.contentSource.preferredApp} or ${expectedConfig.contentSource.acceptableSource}`
                        });
                    }
                }
                
                // Check Power Settings (Signal Detection)
                if (checks.powerSettings && device.powerSettings) {
                    const signalDetection = device.powerSettings.reported?.signalDetection;
                    // Accept both false and null/undefined as valid (signal detection disabled or not set)
                    const isValidSignalDetection = signalDetection === false || signalDetection === null || signalDetection === undefined;
                    
                    if (!isValidSignalDetection) {
                        deviceIssues.push({
                            type: 'powerSettings',
                            severity: 'warning',
                            message: 'Signal detection should be disabled or not set',
                            description: expectedConfig.powerSettings.description,
                            currentValue: signalDetection !== null && signalDetection !== undefined ? signalDetection.toString() : 'null/undefined',
                            expectedValue: 'false or not set'
                        });
                    }
                }
                
                // Check Power Schedules
                if (checks.powerSchedules && device.power) {
                    const powerReported = device.power.reported;
                    const powerDesired = device.power.desired;
                    
                    // STANDBY is a critical error - device won't display content properly
                    if (powerReported === "STANDBY") {
                        deviceIssues.push({
                            type: 'powerSchedule',
                            severity: 'error',
                            message: 'Device in STANDBY mode - critical issue',
                            description: 'Device in STANDBY will not display content properly',
                            currentValue: powerReported,
                            expectedValue: 'ON'
                        });
                    } else if (powerReported !== "ON") {
                        // Other non-ON states are warnings
                        deviceIssues.push({
                            type: 'powerSchedule',
                            severity: 'warning',
                            message: 'Device power state not optimal',
                            description: 'Device should be in ON state',
                            currentValue: powerReported || 'Not set',
                            expectedValue: 'ON'
                        });
                    }
                }
                
                if (deviceIssues.length > 0) {
                    issues.push({
                        deviceId: device.id,
                        deviceName: device.alias || device.id,
                        siteName: device.site?.name || 'Unknown Site',
                        issues: deviceIssues
                    });
                }
            }
            
            return {
                totalDevicesChecked: devices.length,
                devicesWithIssues: issues.length,
                issues: issues,
                validationMode: true // Switched from discovery to validation
            };
            
        } catch (error) {
            console.error('Error checking device configuration:', error);
            console.error('Error stack:', error.stack);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                clientHandle,
                displayIds
            });
            throw error;
        }
    }
    
    async fetchDisplaysWithConfig(clientHandle, displayIds) {
        // Use the exact same query structure that works in getDevicesByClient, then add only verified fields
        const query = `
            query {
                customerByHandle(handle: "${clientHandle}") {
                    displays {
                        id
                        alias
                        site { id name }
                        timeZone { reported }
                        powerSettings { reported { signalDetection } }
                        contentSource {
                            current {
                                reported {
                                    ... on InputContentSource { source }
                                    ... on AppContentSource { activityList applicationId }
                                }
                            }
                        }
                        power { reported desired }
                    }
                }
            }
        `;
        
        try {
            console.log('Executing GraphQL query for clientHandle:', clientHandle);
            console.log('Display IDs requested:', displayIds);
            const data = await waveGraphQL(query);
            console.log('GraphQL query successful, data received:', !!data);
            
            if (data?.customerByHandle?.displays) {
                console.log('Total displays found:', data.customerByHandle.displays.length);
                // Filter to only the requested device IDs
                const allDevices = data.customerByHandle.displays;
                const filteredDevices = allDevices.filter(device => displayIds.includes(device.id));
                console.log('Filtered devices count:', filteredDevices.length);
                return filteredDevices;
            }
            
            console.log('No displays found in GraphQL response');
            return [];
        } catch (error) {
            console.error('Error fetching device configurations:', error);
            console.error('GraphQL query was:', query);
            console.error('Client handle:', clientHandle);
            console.error('Display IDs:', displayIds);
            throw new Error('Failed to fetch device configurations: ' + error.message);
        }
    }
}

module.exports = ConfigCheckController;
