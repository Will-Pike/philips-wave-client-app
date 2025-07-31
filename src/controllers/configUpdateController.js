// src/controllers/configUpdateController.js
const ClientController = require('./clientController');
const { waveGraphQL } = require('../utils/waveApi');

class ConfigUpdateController extends ClientController {
    
    // Test with Triggerpoint Media HQ devices only
    async getTestDevices(clientHandle) {
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
            
            if (data?.customerByHandle?.displays) {
                // Filter to only Triggerpoint Media HQ devices that are online
                const allDevices = data.customerByHandle.displays;
                const hqDevices = allDevices.filter(device => 
                    device.site?.name?.toLowerCase().includes('triggerpoint') ||
                    device.site?.name?.toLowerCase().includes('hq') ||
                    device.site?.name?.toLowerCase().includes('media')
                );
                
                // Only return online devices for testing
                return hqDevices.filter(device => device.presence?.connected);
            }
            
            return [];
        } catch (error) {
            console.error('Error fetching test devices:', error);
            throw new Error('Failed to fetch test devices: ' + error.message);
        }
    }
    
    async updateDeviceConfiguration(clientHandle, deviceId, configUpdates) {
        const mutations = [];
        
        // Time Zone Update - using bulk update for single device
        if (configUpdates.timeZone) {
            mutations.push({
                mutation: `
                    mutation {
                        displayBulkUpdateTimeZone(input: {
                            displayIds: ["${deviceId}"]
                            timeZone: "${configUpdates.timeZone}"
                        }) {
                            displays {
                                id
                                alias
                            }
                        }
                    }
                `,
                variables: {},
                type: 'timeZone'
            });
        }
        
        // Content Source Update - using app content source update
        if (configUpdates.contentSource) {
            mutations.push({
                mutation: `
                    mutation {
                        displayBulkUpdateAppContentSource(input: {
                            displayIds: ["${deviceId}"]
                            applicationId: "${configUpdates.contentSource}"
                        }) {
                            displays {
                                id
                                alias
                            }
                        }
                    }
                `,
                variables: {},
                type: 'contentSource'
            });
        }
        
        // Default Content Source Update - for fallback when app isn't running
        if (configUpdates.defaultContentSource) {
            // Check if it's an app (Signjet) or input source (HDMI, CUSTOM)
            const isAppSource = configUpdates.defaultContentSource.includes('.');
            
            if (isAppSource) {
                // Use app content source mutation for Signjet
                mutations.push({
                    mutation: `
                        mutation {
                            displayBulkUpdateDefaultAppContentSource(input: {
                                displayIds: ["${deviceId}"]
                                applicationId: "${configUpdates.defaultContentSource}"
                            }) {
                                displays {
                                    id
                                    alias
                                }
                            }
                        }
                    `,
                    variables: {},
                    type: 'defaultContentSource'
                });
            } else {
                // Use input content source mutation for HDMI, CUSTOM, etc.
                mutations.push({
                    mutation: `
                        mutation {
                            displayBulkUpdateDefaultInputContentSource(input: {
                                displayIds: ["${deviceId}"]
                                source: "${configUpdates.defaultContentSource}"
                            }) {
                                displays {
                                    id
                                    alias
                                }
                            }
                        }
                    `,
                    variables: {},
                    type: 'defaultContentSource'
                });
            }
        }
        
        // Power Settings Update - signal detection (corrected field name)
        if (configUpdates.powerSettings !== undefined) {
            mutations.push({
                mutation: `
                    mutation {
                        displayBulkUpdateSignalDetection(input: {
                            displayIds: ["${deviceId}"]
                            enable: ${configUpdates.powerSettings.signalDetection}
                        }) {
                            displays {
                                id
                                alias
                            }
                        }
                    }
                `,
                variables: {},
                type: 'powerSettings'
            });
        }
        
        // Power State Update
        if (configUpdates.powerState) {
            mutations.push({
                mutation: `
                    mutation {
                        displayBulkUpdatePower(input: {
                            displayIds: ["${deviceId}"]
                            power: ${configUpdates.powerState}
                        }) {
                            displays {
                                id
                                alias
                            }
                        }
                    }
                `,
                variables: {},
                type: 'powerState'
            });
        }
        
        // Execute all mutations
        const results = [];
        for (const { mutation, variables, type } of mutations) {
            try {
                console.log(`Executing ${type} mutation for device ${deviceId}:`);
                console.log('Mutation query:', mutation);
                const result = await waveGraphQL(mutation, variables);
                console.log(`${type} mutation result:`, result);
                results.push({
                    type,
                    success: true,
                    result
                });
            } catch (error) {
                console.error(`Failed to update ${type} for device ${deviceId}:`, error);
                
                // Special fallback handling for default content source
                if (type === 'defaultContentSource' && configUpdates.fallbackDefaultContentSource) {
                    console.log(`Attempting fallback to ${configUpdates.fallbackDefaultContentSource} for default content source...`);
                    
                    try {
                        const fallbackMutation = `
                            mutation {
                                displayBulkUpdateDefaultInputContentSource(input: {
                                    displayIds: ["${deviceId}"]
                                    source: "${configUpdates.fallbackDefaultContentSource}"
                                }) {
                                    displays {
                                        id
                                        alias
                                    }
                                }
                            }
                        `;
                        
                        const fallbackResult = await waveGraphQL(fallbackMutation);
                        console.log(`Fallback to ${configUpdates.fallbackDefaultContentSource} successful:`, fallbackResult);
                        
                        results.push({
                            type,
                            success: true,
                            result: fallbackResult,
                            fallbackUsed: configUpdates.fallbackDefaultContentSource
                        });
                    } catch (fallbackError) {
                        console.error(`Fallback also failed for ${type}:`, fallbackError);
                        results.push({
                            type,
                            success: false,
                            error: error.message,
                            fallbackError: fallbackError.message
                        });
                    }
                } else {
                    results.push({
                        type,
                        success: false,
                        error: error.message
                    });
                }
            }
        }
        
        return results;
    }
    
    // Get the standard Kwik Trip configuration
    getStandardConfig() {
        return {
            timeZone: "America/Chicago",
            contentSource: "com.digitaltouchsystems.snap", // SignJet app
            defaultContentSource: "com.digitaltouchsystems.snap", // Signjet preferred for default too
            fallbackContentSource: "CUSTOM", // CUSTOM as fallback if Signjet not available
            powerSettings: {
                signalDetection: false
            },
            powerState: "ON"
        };
    }
    
    // Determine what needs to be updated for a device based on its current config and issues
    getRequiredUpdates(deviceIssues) {
        const standardConfig = this.getStandardConfig();
        const updates = {};
        
        deviceIssues.forEach(issue => {
            switch (issue.type) {
                case 'timeZone':
                    updates.timeZone = standardConfig.timeZone;
                    break;
                case 'contentSource':
                    updates.contentSource = standardConfig.contentSource;
                    break;
                case 'defaultContentSource':
                    // Try Signjet first, but have fallback logic for when it's not available
                    updates.defaultContentSource = standardConfig.defaultContentSource; // Signjet preferred
                    updates.fallbackDefaultContentSource = standardConfig.fallbackContentSource; // CUSTOM if Signjet fails
                    break;
                case 'powerSettings':
                    updates.powerSettings = standardConfig.powerSettings;
                    break;
                case 'powerSchedule':
                    updates.powerState = standardConfig.powerState;
                    break;
            }
        });
        
        return updates;
    }
}

module.exports = ConfigUpdateController;
