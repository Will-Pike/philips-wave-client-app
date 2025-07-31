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
                description: "Content source should ideally be the SignJet app (com.digitaltouchsystems.snap), or CUSTOM as fallback only if SignJet is not available"
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
                
                const deviceIssues = await this.checkSingleDeviceConfig(device, checks, expectedConfig);
                
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

    // New streaming method that processes batches and returns results incrementally
    async streamingConfigCheck(clientHandle, displayIds, checks = {}, onBatchComplete = null) {
        const BATCH_SIZE = 500;
        const MAX_RETRIES = 3;
        const expectedConfig = this.getExpectedConfig();
        
        let totalDevicesChecked = 0;
        let totalIssues = [];
        let batchResults = [];
        
        console.log(`🚀 STREAMING CONFIG CHECK STARTED: ${new Date().toISOString()}`);
        console.log(`Processing ${displayIds.length} devices in batches of ${BATCH_SIZE} with real-time results`);
        
        // Split displayIds into batches
        for (let i = 0; i < displayIds.length; i += BATCH_SIZE) {
            const batch = displayIds.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i/BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(displayIds.length/BATCH_SIZE);
            
            console.log(`🔥 Processing batch ${batchNumber}/${totalBatches} (${batch.length} devices)`);
            
            try {
                // Fetch devices for this batch
                const batchDevices = await this.fetchBatchDisplaysWithConfig(clientHandle, batch, batchNumber, totalBatches);
                
                // Process configuration check for this batch
                const batchIssues = [];
                for (const device of batchDevices) {
                    const deviceIssues = await this.checkSingleDeviceConfig(device, checks, expectedConfig);
                    if (deviceIssues.length > 0) {
                        batchIssues.push({
                            deviceId: device.id,
                            deviceName: device.alias || device.id,
                            siteName: device.site?.name || 'Unknown Site',
                            issues: deviceIssues
                        });
                    }
                }
                
                // Create batch result
                const batchResult = {
                    batchNumber,
                    totalBatches,
                    devicesProcessed: batchDevices.length,
                    devicesWithIssues: batchIssues.length,
                    issues: batchIssues,
                    progress: Math.round((batchNumber / totalBatches) * 100)
                };
                
                totalDevicesChecked += batchDevices.length;
                totalIssues.push(...batchIssues);
                batchResults.push(batchResult);
                
                console.log(`✅ Batch ${batchNumber} complete: ${batchDevices.length} devices processed, ${batchIssues.length} with issues`);
                
                // Call the callback if provided (for real-time UI updates)
                if (onBatchComplete) {
                    await onBatchComplete(batchResult);
                }
                
            } catch (error) {
                console.error(`❌ Batch ${batchNumber} failed:`, error.message);
                // Continue with next batch even if this one fails
            }
        }
        
        console.log(`🏁 STREAMING CONFIG CHECK COMPLETED: ${new Date().toISOString()}`);
        
        return {
            totalDevicesChecked,
            devicesWithIssues: totalIssues.length,
            issues: totalIssues,
            batchResults,
            validationMode: true
        };
    }

    // Helper method to check a single device's configuration
    async checkSingleDeviceConfig(device, checks, expectedConfig) {
        const deviceIssues = [];
        
        if (!device || !device.id) {
            return deviceIssues;
        }
        
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
        
        // Check Content Source
        if (checks.defaultSource && device.contentSource) {
            const currentSource = device.contentSource.current?.reported;
            
            if (currentSource) {
                const isSnapApp = currentSource.applicationId === expectedConfig.contentSource.preferredApp;
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
                } else if (!isSnapApp && isCustomSource) {
                    deviceIssues.push({
                        type: 'contentSource',
                        severity: 'warning',
                        message: 'Content source using CUSTOM instead of preferred SignJet app',
                        description: 'Consider switching to SignJet app if available for better content management',
                        currentValue: currentSource.source,
                        expectedValue: expectedConfig.contentSource.preferredApp
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
            
            // Check Default Content Source (fallback when app isn't running)
            const defaultSource = device.contentSource.default?.reported;
            if (defaultSource) {
                // For default source, we prefer Signjet app as primary, CUSTOM as acceptable fallback
                const preferredDefaultApp = 'com.digitaltouchsystems.snap';
                const acceptableDefaultSource = 'CUSTOM';
                const currentDefaultSource = defaultSource.source || defaultSource.applicationId;
                
                // Check if it's the preferred Signjet app
                const isSignjetDefault = defaultSource.applicationId === preferredDefaultApp;
                // Check if it's using acceptable CUSTOM source
                const isCustomDefault = defaultSource.source === acceptableDefaultSource;
                
                if (!isSignjetDefault && !isCustomDefault) {
                    // Not ideal - suggest Signjet first, CUSTOM as fallback
                    deviceIssues.push({
                        type: 'defaultContentSource',
                        severity: 'warning',
                        message: 'Default content source not using preferred Signjet app or CUSTOM',
                        description: `Default content source should preferably be Signjet app (${preferredDefaultApp}) or CUSTOM as fallback`,
                        currentValue: currentDefaultSource,
                        expectedValue: `${preferredDefaultApp} (preferred) or ${acceptableDefaultSource} (acceptable)`
                    });
                } else if (isCustomDefault && !isSignjetDefault) {
                    // Using CUSTOM but could potentially use Signjet
                    deviceIssues.push({
                        type: 'defaultContentSource',
                        severity: 'info',
                        message: 'Default content source using CUSTOM instead of preferred Signjet app',
                        description: 'Consider switching default to Signjet app if available for better consistency',
                        currentValue: defaultSource.source,
                        expectedValue: preferredDefaultApp
                    });
                }
            } else {
                deviceIssues.push({
                    type: 'defaultContentSource',
                    severity: 'warning',
                    message: 'No default content source configured',
                    description: 'Default content source should be configured as fallback when apps are not running',
                    currentValue: 'Not configured',
                    expectedValue: 'com.digitaltouchsystems.snap (preferred) or CUSTOM (acceptable)'
                });
            }
        }
        
        // Check Power Settings
        if (checks.powerSettings && device.powerSettings) {
            const signalDetection = device.powerSettings.reported?.signalDetection;
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
        
        // Check Recommended Settings
        if (checks.recommendedSettings && device.recommendedSettings) {
            const reportedSettings = device.recommendedSettings.reported;
            
            if (reportedSettings) {
                // Check if recommended settings indicate issues
                if (reportedSettings.recommended === false) {
                    deviceIssues.push({
                        type: 'recommendedSettings',
                        severity: 'error',
                        message: 'Device has recommended settings violations',
                        description: 'Device configuration does not meet recommended standards',
                        currentValue: 'Non-compliant',
                        expectedValue: 'Compliant with recommended settings'
                    });
                }
                
                // Process any warnings from recommended settings
                if (reportedSettings.warnings && reportedSettings.warnings.length > 0) {
                    reportedSettings.warnings.forEach(warning => {
                        const severity = warning.severity === 'HIGH' ? 'error' : 'warning';
                        deviceIssues.push({
                            type: 'recommendedSettingsWarning',
                            severity: severity,
                            message: `Recommended Settings Warning: ${warning.code}`,
                            description: warning.description,
                            currentValue: 'Configuration issue detected',
                            expectedValue: 'Resolve recommended settings warning'
                        });
                    });
                }
            }
        }
        
        return deviceIssues;
    }

    // Method to apply recommended settings corrections
    async applyRecommendedSettingsCorrections(clientHandle, displayIds) {
        try {
            console.log(`🔧 Applying recommended settings corrections to ${displayIds.length} devices...`);
            
            const mutation = `
                mutation ApplyRecommendedSettings($input: DisplayBulkApplyRecommendedSettingsInput!) {
                    displayBulkApplyRecommendedSettings(input: $input) {
                        displays {
                            id
                            alias
                            recommendedSettings {
                                reported {
                                    recommended
                                    warnings {
                                        code
                                        severity
                                        description
                                    }
                                }
                            }
                        }
                    }
                }
            `;

            const variables = {
                input: {
                    displayIds: displayIds
                }
            };

            console.log('🚀 Executing recommended settings correction mutation...');
            const result = await waveGraphQL(mutation, variables);

            if (result?.displayBulkApplyRecommendedSettings?.displays) {
                const updatedDisplays = result.displayBulkApplyRecommendedSettings.displays;
                console.log(`✅ Successfully applied recommended settings to ${updatedDisplays.length} devices`);
                
                // Return summary of results
                return {
                    success: true,
                    totalDevicesUpdated: updatedDisplays.length,
                    updatedDevices: updatedDisplays.map(device => ({
                        id: device.id,
                        alias: device.alias,
                        recommendedSettingsCompliant: device.recommendedSettings?.reported?.recommended || false,
                        remainingWarnings: device.recommendedSettings?.reported?.warnings?.length || 0
                    }))
                };
            } else {
                throw new Error('No displays returned from mutation');
            }

        } catch (error) {
            console.error('❌ Error applying recommended settings corrections:', error.message);
            return {
                success: false,
                error: error.message,
                totalDevicesUpdated: 0,
                updatedDevices: []
            };
        }
    }

    async fetchDisplaysWithConfig(clientHandle, displayIds) {
        const BATCH_SIZE = 500; // Large batches for maximum efficiency
        const MAX_RETRIES = 3;
        const allDevices = [];
        
        const startTime = new Date();
        console.log(`🚀 CONFIG CHECK STARTED: ${startTime.toISOString()}`);
        console.log(`Processing ${displayIds.length} devices in batches of ${BATCH_SIZE} with streaming results`);
        console.log(`Estimated time: ${Math.ceil(displayIds.length / BATCH_SIZE)} batches × 60s = ~${Math.ceil(displayIds.length / BATCH_SIZE)} minutes`);
        
        // Split displayIds into batches
        for (let i = 0; i < displayIds.length; i += BATCH_SIZE) {
            const batch = displayIds.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i/BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(displayIds.length/BATCH_SIZE);
            
            const batchStartTime = new Date();
            console.log(`🔥 Processing batch ${batchNumber}/${totalBatches} (${batch.length} devices) - Started: ${batchStartTime.toISOString()}`);
            
            let batchDevices = [];
            let retryCount = 0;
            
            // Retry logic for this batch
            while (retryCount <= MAX_RETRIES) {
                try {
                    batchDevices = await this.fetchBatchDisplaysWithConfig(clientHandle, batch, batchNumber, totalBatches);
                    const batchEndTime = new Date();
                    const batchDuration = (batchEndTime - batchStartTime) / 1000;
                    console.log(`✅ Batch ${batchNumber} successful: ${batchDevices.length} devices retrieved in ${batchDuration.toFixed(1)}s - Completed: ${batchEndTime.toISOString()}`);
                    break; // Success, exit retry loop
                } catch (error) {
                    retryCount++;
                    const retryTime = new Date();
                    console.error(`❌ Batch ${batchNumber} attempt ${retryCount} failed at ${retryTime.toISOString()}:`, error.message);
                    
                    if (retryCount <= MAX_RETRIES) {
                        const delayMs = Math.min(2000 * Math.pow(2, retryCount - 1), 10000); // Conservative backoff
                        console.log(`⏳ Retrying batch ${batchNumber} in ${delayMs}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    } else {
                        console.error(`💥 Batch ${batchNumber} failed after ${MAX_RETRIES} retries. Continuing with remaining batches.`);
                    }
                }
            }
            
            allDevices.push(...batchDevices);
            
            // Brief pause between batches
            if (i + BATCH_SIZE < displayIds.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        const endTime = new Date();
        const totalDuration = (endTime - startTime) / 1000;
        console.log(`🏁 CONFIG CHECK COMPLETED: ${endTime.toISOString()}`);
        console.log(`📊 PERFORMANCE SUMMARY:`);
        console.log(`   Total Time: ${totalDuration.toFixed(1)} seconds (${(totalDuration/60).toFixed(1)} minutes)`);
        console.log(`   Devices Processed: ${allDevices.length} out of ${displayIds.length} requested`);
        if (allDevices.length > 0) {
            console.log(`   Average Time per Device: ${(totalDuration/allDevices.length).toFixed(2)} seconds`);
        }
        console.log(`   Batches Used: ${Math.ceil(displayIds.length/BATCH_SIZE)} batches of ${BATCH_SIZE} devices each`);
        
        return allDevices;
    }
    
    async fetchBatchDisplaysWithConfig(clientHandle, displayIds, batchNumber = 1, totalBatches = 1) {
        // Use simpler query structure but only fetch essential fields for speed
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
                            default {
                                reported {
                                    ... on InputContentSource { source }
                                    ... on AppContentSource { activityList applicationId }
                                }
                                desired {
                                    ... on InputContentSource { source }
                                    ... on AppContentSource { activityList applicationId }
                                }
                            }
                        }
                        power { reported desired }
                        recommendedSettings {
                            reported {
                                recommended
                                warnings {
                                    code
                                    severity
                                    description
                                }
                            }
                            desired {
                                recommended
                                warnings {
                                    code
                                    severity
                                    description
                                }
                            }
                        }
                    }
                }
            }
        `;
        
        try {
            console.log(`[Batch ${batchNumber}/${totalBatches}] Executing GraphQL query for ${displayIds.length} devices (will filter client-side)...`);
            const startTime = Date.now();
            
            const data = await waveGraphQL(query);
            
            const endTime = Date.now();
            console.log(`[Batch ${batchNumber}/${totalBatches}] Query completed in ${endTime - startTime}ms`);
            
            if (data?.customerByHandle?.displays) {
                // Filter to only the requested device IDs for this batch
                const allDevices = data.customerByHandle.displays;
                const filteredDevices = allDevices.filter(device => displayIds.includes(device.id));
                console.log(`[Batch ${batchNumber}/${totalBatches}] Found ${filteredDevices.length}/${displayIds.length} requested devices out of ${allDevices.length} total`);
                return filteredDevices;
            }
            
            console.log(`[Batch ${batchNumber}/${totalBatches}] No displays found in GraphQL response`);
            return [];
        } catch (error) {
            console.error(`[Batch ${batchNumber}/${totalBatches}] Error fetching device configurations:`, error.message);
            throw new Error('Failed to fetch device configurations: ' + error.message);
        }
    }
}

module.exports = ConfigCheckController;
