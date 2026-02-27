/**
 * LOCKBOX DYNAMIC VALIDATION ENGINE
 * 
 * Fully database-driven rule execution for RULE-001 and RULE-002
 * 
 * Step-1: Read uploaded file payload as JSON input
 * Step-2: Identify applicable rules from lb_processing_rules where condition_type = 'EXIST' and destination = 'S4HANA_SYSTEM_DESTINATION'
 * Step-3: For each rule - validate condition dynamically (if source fields contain value → proceed)
 * Step-4: Construct S4 OData API dynamically: api_reference + '?' + api_input_fields=value pairs
 * Step-5: Call S4 using BTP Destination: S4HANA_SYSTEM_DESTINATION
 * Step-6: Extract api_output_field dynamically from response
 * Step-7: Map extracted values to lockbox_field dynamically
 * Step-8: Return enriched Lockbox payload
 * 
 * Rules Supported:
 * - RULE-001: InvoiceNumber → BELNR → PaymentReference
 * - RULE-002: CustomerNumber + BankIdentification → BankCountryKey, BankNumber, BankAccount → Partner fields
 * 
 * ⚠️ All rule logic is DATABASE-DRIVEN. No hardcoded field names.
 */

const sapClient = require('../integrations/sap-client');

// Global variable to store loaded processing rules
let cachedProcessingRules = [];

/**
 * Load processing rules from parent process (server.js provides this)
 * @param {array} rules - Array of processing rules
 */
function loadProcessingRules(rules) {
    cachedProcessingRules = rules || [];
    console.log(`✅ Rule Engine: Loaded ${cachedProcessingRules.length} processing rules`);
    
    // Log active RULE-001 and RULE-002
    const activeRules = cachedProcessingRules.filter(r => r.active && (r.ruleId === 'RULE-001' || r.ruleId === 'RULE-002'));
    console.log(`   Active Validation Rules: ${activeRules.map(r => r.ruleId).join(', ')}`);
}

/**
 * Main Function: Process Lockbox with Dynamic Rules (RULE-001 & RULE-002 only)
 * @param {array} extractedData - Lockbox data from file
 * @param {string} fileType - File type (EXCEL, CSV, PDF)
 * @returns {Promise<object>} - Validation result with enriched data
 */
async function processLockboxRules(extractedData, fileType = 'EXCEL') {
    console.log('='.repeat(80));
    console.log('🔍 LOCKBOX DYNAMIC VALIDATION - RULE-001 & RULE-002');
    console.log('='.repeat(80));
    
    const result = {
        success: true,
        rulesExecuted: [],
        recordsEnriched: 0,
        errors: [],
        warnings: [],
        enrichedData: JSON.parse(JSON.stringify(extractedData)) // Deep copy
    };
    
    try {
        // Step 1: Fetch applicable rules (RULE-001 and RULE-002 only)
        console.log(`   Filtering rules with: fileType="${fileType}", destination="S4HANA_SYSTEM_DESTINATION"`);
        console.log(`   Total cached rules: ${cachedProcessingRules.length}`);
        
        const applicableRules = cachedProcessingRules.filter(rule => {
            console.log(`   Checking rule ${rule.ruleId}: active=${rule.active}, fileType=${rule.fileType}, destination=${rule.destination}`);
            return rule.active && 
                rule.fileType === fileType &&
                rule.destination === 'S4HANA_SYSTEM_DESTINATION' &&
                (rule.ruleId === 'RULE-001' || rule.ruleId === 'RULE-002');
        });
        
        console.log(`\n📋 Found ${applicableRules.length} applicable validation rules`);
        
        if (applicableRules.length === 0) {
            result.warnings.push('No active validation rules found for file type: ' + fileType);
            return result;
        }
        
        // Step 2: Execute each rule sequentially
        for (const rule of applicableRules) {
            console.log(`\n${'─'.repeat(80)}`);
            console.log(`⚙️  Executing ${rule.ruleId}: ${rule.ruleName}`);
            console.log(`${'─'.repeat(80)}`);
            
            try {
                // Step 3: Evaluate rule condition
                const conditionMet = evaluateRuleCondition(rule.conditions, result.enrichedData);
                
                if (!conditionMet) {
                    console.log(`⏭️  ${rule.ruleId}: Condition not met - skipping`);
                    result.warnings.push(`${rule.ruleId}: Condition not met`);
                    continue;
                }
                
                console.log(`✅ ${rule.ruleId}: Condition met - proceeding with API call`);
                
                // Step 4: Execute rule dynamically
                const ruleResult = await executeDynamicRule(rule, result.enrichedData);
                
                result.rulesExecuted.push(rule.ruleId);
                result.recordsEnriched += ruleResult.recordsEnriched;
                result.errors.push(...ruleResult.errors);
                result.warnings.push(...ruleResult.warnings);
                
                console.log(`✅ ${rule.ruleId}: Completed - ${ruleResult.recordsEnriched} records enriched`);
                
            } catch (ruleError) {
                console.error(`❌ ${rule.ruleId}: Execution failed:`, ruleError.message);
                result.errors.push(`${rule.ruleId}: ${ruleError.message}`);
            }
        }
        
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📊 VALIDATION SUMMARY`);
        console.log(`${'='.repeat(80)}`);
        console.log(`   Rules Executed: ${result.rulesExecuted.join(', ') || 'None'}`);
        console.log(`   Records Enriched: ${result.recordsEnriched}`);
        console.log(`   Errors: ${result.errors.length}`);
        console.log(`   Warnings: ${result.warnings.length}`);
        console.log(`${'='.repeat(80)}\n`);
        
    } catch (error) {
        console.error('❌ Fatal error in rule processing:', error);
        result.success = false;
        result.errors.push(`Fatal error: ${error.message}`);
    }
    
    return result;
}

/**
 * Evaluate Rule Condition Dynamically
 * Supports: 
 * - InvoiceNumber EXIST (field must exist in file)
 * - BankIdentification = "0001" (hardcoded value, doesn't need to be in file)
 * @param {array} conditions - Rule conditions
 * @param {array} data - Extracted data
 * @returns {boolean} - True if condition is met
 */
function evaluateRuleCondition(conditions, data) {
    if (!conditions || conditions.length === 0) return false;
    
    console.log(`   🔍 Evaluating conditions for ${conditions.length} condition(s)`);
    
    // Check if at least one data row meets all conditions
    for (const row of data) {
        let allConditionsMet = true;
        const matchedFields = new Set(); // Track which row fields have been used
        
        for (const condition of conditions) {
            const fieldName = condition.documentFormat || condition.fieldName || '';
            const conditionType = (condition.condition || '').toLowerCase();
            
            console.log(`      Checking condition: ${fieldName} ${condition.condition}`);
            
            // If condition is a specific value (e.g., "0001"), it's hardcoded - always pass
            if (conditionType !== 'exist' && condition.condition) {
                console.log(`      ✅ Hardcoded value "${condition.condition}" - condition passes`);
                continue; // Hardcoded values don't need to be in the file
            }
            
            // For EXIST conditions, check if field is in file
            if (conditionType === 'exist') {
                // Check if field exists in row with smart matching
                let fieldValue = null;
                let foundField = null;
                
                // Extract the main keyword from field name (first word before space)
                const fieldParts = fieldName.split(' ');
                const mainKeyword = fieldParts[0].toLowerCase(); // e.g., "Customer", "Invoice"
                
                // Find matching field that hasn't been used yet
                for (const rowKey of Object.keys(row)) {
                    if (matchedFields.has(rowKey)) continue; // Skip already matched fields
                    
                    const normalizedRowKey = rowKey.replace(/\s+/g, '').toLowerCase();
                    
                    // Match if the row key starts with the main keyword
                    if (normalizedRowKey.startsWith(mainKeyword)) {
                        fieldValue = row[rowKey];
                        foundField = rowKey;
                        matchedFields.add(rowKey); // Mark this field as used
                        console.log(`      ✅ Found field "${foundField}" (matches "${fieldName}") with value: ${fieldValue}`);
                        break;
                    }
                }
                
                if (!fieldValue || fieldValue === '' || fieldValue === null) {
                    console.log(`      ❌ Field ${fieldName} not found or empty`);
                    allConditionsMet = false;
                    break;
                }
            }
        }
        
        if (allConditionsMet) {
            console.log(`   ✅ All conditions met for this row`);
            return true;
        }
    }
    
    console.log(`   ❌ No rows matched all conditions`);
    return false;
}

/**
 * Execute Rule Dynamically (Database-Driven)
 * @param {object} rule - Rule configuration
 * @param {array} data - Lockbox data
 * @returns {Promise<object>} - Execution result
 */
async function executeDynamicRule(rule, data) {
    const result = {
        recordsEnriched: 0,
        errors: [],
        warnings: []
    };
    
    const mappings = rule.apiMappings || [];
    
    if (mappings.length === 0) {
        result.warnings.push(`${rule.ruleId}: No API mappings configured`);
        return result;
    }
    
    // Process each data row
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        try {
            // Step 1: Check if required source fields exist
            const firstMapping = mappings[0];
            const sourceField = firstMapping.sourceInput || firstMapping.sourceField;
            
            console.log(`   🔍 Looking for source field: "${sourceField}"`);
            
            // Smart field matching: Look for Customer, CustomerNumber, Invoice Number, etc.
            let sourceValue = null;
            let actualSourceField = null;
            
            const normalizedSource = (sourceField || '').replace(/\s+/g, '').toLowerCase();
            
            for (const rowKey of Object.keys(row)) {
                const normalizedRowKey = rowKey.replace(/\s+/g, '').toLowerCase();
                
                // Match if normalized keys match or contain each other
                if (normalizedRowKey === normalizedSource ||
                    normalizedSource.startsWith(normalizedRowKey) ||
                    (normalizedRowKey.length >= 5 && normalizedSource.includes(normalizedRowKey))) {
                    sourceValue = row[rowKey];
                    actualSourceField = rowKey;
                    break;
                }
            }
            
            if (!sourceValue) {
                console.log(`   ⏭️  Row ${i + 1}: Source field "${sourceField}" not found - skipping`);
                continue; // Skip row if source field is missing
            }
            
            console.log(`   📝 Row ${i + 1}: Found ${actualSourceField}=${sourceValue}`);
            
            // Step 2: Build dynamic API URL
            const apiURL = buildDynamicAPIURL(firstMapping, row);
            
            console.log(`   📞 API Call for row ${i + 1}`);
            
            // Step 3: Call SAP API via destination
            const response = await callSAPAPI(apiURL, firstMapping.httpMethod, rule.destination);
            
            if (!response || !response.data) {
                result.errors.push(`Row ${i + 1}: API returned no data`);
                continue;
            }
            
            // Step 4: Extract and map output fields dynamically
            let fieldsEnriched = 0;
            for (const mapping of mappings) {
                const apiValue = extractDynamicField(response.data, mapping.outputField);
                
                if (apiValue !== null && apiValue !== undefined) {
                    const lockboxField = mapping.lockboxApiField || mapping.lockboxField;
                    row[lockboxField] = apiValue;
                    fieldsEnriched++;
                    console.log(`   ✅ ${lockboxField}: ${apiValue}`);
                    
                    // Add metadata for Field Mapping Preview
                    if (!row._apiDerivedFields) row._apiDerivedFields = [];
                    if (!row._apiFieldMappings) row._apiFieldMappings = {};
                    
                    row._apiDerivedFields.push(lockboxField);
                    row._apiFieldMappings[lockboxField] = {
                        apiEndpoint: mapping.apiReference,
                        sourceField: mapping.outputField,
                        derivedFrom: rule.ruleId,
                        inputField: mapping.inputField,
                        inputValue: sourceValue
                    };
                }
            }
            
            if (fieldsEnriched > 0) {
                result.recordsEnriched++;
            }
            
        } catch (rowError) {
            console.error(`   ❌ Row ${i + 1} error:`, rowError.message);
            result.errors.push(`Row ${i + 1}: ${rowError.message}`);
        }
    }
    
    return result;
}

/**
 * Build Dynamic API URL with Query Parameters
 * Supports multi-input mapping (e.g., CustomerNumber + BankIdentification)
 * @param {object} mapping - API mapping configuration
 * @param {object} row - Data row
 * @returns {string} - Complete API URL with query parameters
 */
function buildDynamicAPIURL(mapping, row) {
    const apiReference = mapping.apiReference;
    const inputField = mapping.inputField;
    const sourceField = mapping.sourceInput || mapping.sourceField;
    
    console.log(`      Building API URL: sourceField="${sourceField}"`);
    
    // Smart field matching: Look for Customer, CustomerNumber, Customer Number
    let sourceValue = null;
    let foundKey = null;
    
    // Normalize the source field name for comparison
    const normalizedSource = (sourceField || '').replace(/\s+/g, '').toLowerCase();
    
    // Search for matching field in row
    for (const rowKey of Object.keys(row)) {
        const normalizedRowKey = rowKey.replace(/\s+/g, '').toLowerCase();
        
        // Match if:
        // 1. Exact match (customerumber === customernumber)
        // 2. Row key starts with source (customer === customernumber)
        // 3. Source contains row key (customernumber contains customer)
        if (normalizedRowKey === normalizedSource ||
            normalizedSource.startsWith(normalizedRowKey) ||
            (normalizedRowKey.length >= 5 && normalizedSource.includes(normalizedRowKey))) {
            sourceValue = row[rowKey];
            foundKey = rowKey;
            console.log(`      ✅ Matched "${rowKey}" for source "${sourceField}": ${sourceValue}`);
            break;
        }
    }
    
    if (!sourceValue) {
        console.log(`      ⚠️  Source field "${sourceField}" not found in row`);
        throw new Error(`Source field "${sourceField}" not found in data`);
    }
    
    // Build base query
    let params = [`${inputField}='${sourceValue}'`];
    
    // Add filter conditions if present (for RULE-002: BankIdentification='0001')
    if (mapping.filterConditions) {
        for (const [filterKey, filterValue] of Object.entries(mapping.filterConditions)) {
            params.push(`${filterKey}='${filterValue}'`);
            console.log(`      ➕ Added filter: ${filterKey}='${filterValue}'`);
        }
    }
    
    const finalURL = `${apiReference}?$filter=${params.join(' and ')}`;
    console.log(`      📋 Final URL: ${finalURL}`);
    
    return finalURL;
}

/**
 * Call SAP API via Destination
 * @param {string} apiURL - Complete API URL
 * @param {string} httpMethod - HTTP method (GET, POST)
 * @param {string} destination - Destination name
 * @returns {Promise<object>} - API response
 */
async function callSAPAPI(apiURL, httpMethod, destination) {
    try {
        // Use SAP client's executeDynamicApiCall function
        const response = await sapClient.executeDynamicApiCall(apiURL, httpMethod || 'GET', destination);
        return response;
    } catch (error) {
        console.error(`   ❌ SAP API call failed:`, error.message);
        throw new Error(`SAP API Error: ${error.message}`);
    }
}

/**
 * Extract Field from OData Response Dynamically
 * Handles nested paths like: d.results[0].BELNR, value[0].BankNumber
 * @param {object} responseData - API response
 * @param {string} fieldPath - Path to extract (e.g., "BELNR", "results[0].BankNumber")
 * @returns {any} - Extracted value or null
 */
function extractDynamicField(responseData, fieldPath) {
    try {
        // Handle direct field access
        if (responseData[fieldPath]) {
            return responseData[fieldPath];
        }
        
        // Handle OData v4 format: { value: [...] }
        if (responseData.value && Array.isArray(responseData.value) && responseData.value.length > 0) {
            return responseData.value[0][fieldPath];
        }
        
        // Handle OData v2 format: { d: { results: [...] } }
        if (responseData.d && responseData.d.results && Array.isArray(responseData.d.results) && responseData.d.results.length > 0) {
            return responseData.d.results[0][fieldPath];
        }
        
        // Handle nested path extraction
        return fieldPath.split('.').reduce((obj, key) => {
            if (key.includes('[')) {
                const arrKey = key.substring(0, key.indexOf('['));
                const index = parseInt(key.match(/\[(\d+)\]/)[1]);
                return obj[arrKey][index];
            }
            return obj[key];
        }, responseData);
        
    } catch (e) {
        console.log(`   ⚠️  Could not extract field "${fieldPath}":`, e.message);
        return null;
    }
}

// Export main functions
module.exports = {
    loadProcessingRules,
    processLockboxRules,
    evaluateRuleCondition,
    buildDynamicAPIURL,
    extractDynamicField
};
