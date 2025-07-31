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

    // NEW: Verify that configuration changes were actually applied
    async verifyDeviceConfiguration(clientHandle, deviceId, expectedUpdates) {
        const query = `
            query {
                display(id: "${deviceId}") {
                    id
                    alias
                    timeZone { 
                        reported 
                    }
                    powerSettings { 
                        reported { 
                            signalDetection 
                        } 
                    }
                    contentSource {
                        current {
                            reported {
                                ... on InputContentSource { source }
                                ... on AppContentSource { applicationId }
                            }
                        }
                        default {
                            reported {
                                ... on InputContentSource { source }
                                ... on AppContentSource { applicationId }
                            }
                            desired {
                                ... on InputContentSource { source }
                                ... on AppContentSource { applicationId }
                            }
                        }
                    }
                    power {
                        reported
                        desired
                    }
                }
            }
        `;

        try {
            const data = await waveGraphQL(query);
            const device = data?.display;
            
            if (!device) {
                throw new Error(`Device ${deviceId} not found`);
            }

            const verification = {
                deviceId,
                deviceName: device.alias || deviceId,
                verificationResults: [],
                allVerified: true
            };

            // Verify time zone
            if (expectedUpdates.timeZone) {
                const currentTimeZone = device.timeZone?.reported;
                const isCorrect = currentTimeZone === expectedUpdates.timeZone;
                verification.verificationResults.push({
                    type: 'timeZone',
                    expected: expectedUpdates.timeZone,
                    actual: currentTimeZone || 'Not Set',
                    verified: isCorrect
                });
                if (!isCorrect) verification.allVerified = false;
            }

            // Verify content source (current)
            if (expectedUpdates.contentSource) {
                const contentSource = device.contentSource?.current?.reported;
                let currentContentSource = 'Not Set';
                
                if (contentSource?.applicationId) {
                    currentContentSource = contentSource.applicationId;
                } else if (contentSource?.source) {
                    currentContentSource = contentSource.source;
                }
                
                const isCorrect = currentContentSource === expectedUpdates.contentSource;
                verification.verificationResults.push({
                    type: 'contentSource',
                    expected: expectedUpdates.contentSource,
                    actual: currentContentSource,
                    verified: isCorrect
                });
                if (!isCorrect) verification.allVerified = false;
            }

            // Verify default content source
            if (expectedUpdates.defaultContentSource) {
                // Check both reported and desired default content sources
                const defaultReported = device.contentSource?.default?.reported;
                const defaultDesired = device.contentSource?.default?.desired;
                
                let currentDefaultSource = 'Not Set';
                
                // Prefer desired over reported if available
                const defaultSource = defaultDesired || defaultReported;
                
                if (defaultSource?.applicationId) {
                    currentDefaultSource = defaultSource.applicationId;
                } else if (defaultSource?.source) {
                    currentDefaultSource = defaultSource.source;
                }
                
                // Check if it matches expected or fallback
                const isCorrect = currentDefaultSource === expectedUpdates.defaultContentSource || 
                                 currentDefaultSource === expectedUpdates.fallbackDefaultContentSource;
                
                verification.verificationResults.push({
                    type: 'defaultContentSource',
                    expected: expectedUpdates.defaultContentSource,
                    actual: currentDefaultSource,
                    verified: isCorrect
                });
                if (!isCorrect) verification.allVerified = false;
            }

            // Verify signal detection (power settings)
            if (expectedUpdates.powerSettings?.signalDetection !== undefined) {
                const currentSignalDetection = device.powerSettings?.reported?.signalDetection;
                const expectedSignalDetection = expectedUpdates.powerSettings.signalDetection;
                const isCorrect = currentSignalDetection === expectedSignalDetection;
                
                verification.verificationResults.push({
                    type: 'signalDetection',
                    expected: expectedSignalDetection,
                    actual: currentSignalDetection !== undefined ? currentSignalDetection : 'Not Set',
                    verified: isCorrect
                });
                if (!isCorrect) verification.allVerified = false;
            }

            // Verify power state
            if (expectedUpdates.powerState) {
                const currentPowerState = device.power?.desired || device.power?.reported;
                const isCorrect = currentPowerState === expectedUpdates.powerState;
                verification.verificationResults.push({
                    type: 'powerState',
                    expected: expectedUpdates.powerState,
                    actual: currentPowerState || 'Not Set',
                    verified: isCorrect
                });
                if (!isCorrect) verification.allVerified = false;
            }

            return verification;

        } catch (error) {
            console.error(`Error verifying device configuration for ${deviceId}:`, error);
            return {
                deviceId,
                deviceName: deviceId,
                verificationResults: [],
                allVerified: false,
                error: error.message
            };
        }
    }

    // NEW: Enhanced update with verification and longer wait time
    async updateAndVerifyDeviceConfiguration(clientHandle, deviceId, configUpdates) {
        console.log(`Starting update and verification for device ${deviceId}`);
        
        // Step 1: Apply the configuration updates
        const updateResults = await this.updateDeviceConfiguration(clientHandle, deviceId, configUpdates);
        
        // Step 2: Wait longer for changes to propagate (especially for default content source)
        console.log('Waiting 5 seconds for changes to propagate...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Step 3: Verify the changes were applied
        const verification = await this.verifyDeviceConfiguration(clientHandle, deviceId, configUpdates);
        
        // Step 4: If default content source failed and we were trying SignJet, try CUSTOM as fallback
        if (!verification.allVerified && configUpdates.defaultContentSource === 'com.digitaltouchsystems.snap') {
            console.log('SignJet app default failed, trying CUSTOM as fallback...');
            
            const fallbackUpdates = { ...configUpdates, defaultContentSource: 'CUSTOM' };
            delete fallbackUpdates.fallbackDefaultContentSource;
            
            const fallbackResults = await this.updateDeviceConfiguration(clientHandle, deviceId, fallbackUpdates);
            await new Promise(resolve => setTimeout(resolve, 3000));
            const fallbackVerification = await this.verifyDeviceConfiguration(clientHandle, deviceId, fallbackUpdates);
            
            return {
                updateResults: [...updateResults, ...fallbackResults],
                verification: fallbackVerification,
                deviceId,
                success: fallbackResults.every(r => r.success) && fallbackVerification.allVerified,
                fallbackUsed: 'CUSTOM'
            };
        }
        
        return {
            updateResults,
            verification,
            deviceId,
            success: updateResults.every(r => r.success) && verification.allVerified
        };
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
