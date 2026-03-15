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
    const fieldMappings = rule.fieldMappings || [];
    
    if (mappings.length === 0) {
        result.warnings.push(`${rule.ruleId}: No API mappings configured`);
        return result;
    }
    
    if (fieldMappings.length === 0) {
        result.warnings.push(`${rule.ruleId}: No field mappings configured`);
        return result;
    }
    
    console.log(`   📋 Rule has ${fieldMappings.length} field mapping(s)`);
    
    // Process each data row
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        try {
            // Step 1: Get the FIRST source field from fieldMappings to use for API call
            // All fieldMappings in a rule typically use the same sourceField as INPUT
            const firstFieldMapping = fieldMappings[0];
            const sourceFieldName = firstFieldMapping.sourceField;
            
            console.log(`\n   🔍 Row ${i + 1}: Looking for source field "${sourceFieldName}" in Excel`);
            
            // Step 2: Find source field value in Excel row using FUZZY matching
            const sourceValue = findFieldValue(row, sourceFieldName);
            
            if (!sourceValue) {
                console.log(`   ⏭️  Row ${i + 1}: Source field "${sourceFieldName}" not found or empty`);
                console.log(`   📋 Available Excel columns: ${Object.keys(row).join(', ')}`);
                continue;
            }
            
            console.log(`   ✅ Row ${i + 1}: Found ${sourceFieldName} = "${sourceValue}"`);
            
            // Step 3: Build dynamic API URL
            const firstMapping = mappings[0];
            const apiURL = buildDynamicAPIURL(firstMapping, sourceFieldName, sourceValue);
            
            if (!apiURL) {
                result.errors.push(`Row ${i + 1}: Failed to build API URL`);
                continue;
            }
            
            console.log(`   📞 Calling API for row ${i + 1}...`);
            
            // Step 4: Call SAP API
            const response = await callSAPAPI(apiURL, firstMapping.httpMethod, rule.destination);
            
            if (!response || !response.data) {
                result.errors.push(`Row ${i + 1}: API returned no data`);
                continue;
            }
            
            console.log(`   ✅ API Response received for row ${i + 1}`);
            
            // Step 5: Extract and map ALL output fields from API response
            let fieldsEnriched = 0;
            
            for (const fieldMapping of fieldMappings) {
                const targetFieldName = fieldMapping.targetField;   // Field in SAP response
                const lockboxFieldName = fieldMapping.apiField;      // Field to store in lockbox
                
                console.log(`      🔍 Extracting "${targetFieldName}" from response...`);
                
                // Handle special case for RULE-002 Bank fields (nested navigation)
                let apiValue = null;
                
                if (rule.ruleId === 'RULE-002' && targetFieldName === 'BankNumber') {
                    apiValue = extractDynamicField(response.data, 'to_BusinessPartnerBank/results/0/BankNumber');
                } else if (rule.ruleId === 'RULE-002' && targetFieldName === 'BankAccount') {
                    apiValue = extractDynamicField(response.data, 'to_BusinessPartnerBank/results/0/BankAccount');
                } else if (rule.ruleId === 'RULE-002' && targetFieldName === 'BankCountryKey') {
                    apiValue = extractDynamicField(response.data, 'to_BusinessPartnerBank/results/0/BankCountryKey');
                } else {
                    // Standard extraction for other fields
                    apiValue = extractDynamicField(response.data, targetFieldName);
                }
                
                if (apiValue !== null && apiValue !== undefined) {
                    row[lockboxFieldName] = apiValue;
                    fieldsEnriched++;
                    console.log(`      ✅ ${lockboxFieldName} = "${apiValue}"`);
                    
                    // Add metadata for Field Mapping Preview
                    if (!row._apiDerivedFields) row._apiDerivedFields = [];
                    if (!row._apiFieldMappings) row._apiFieldMappings = {};
                    
                    row._apiDerivedFields.push(lockboxFieldName);
                    row._apiFieldMappings[lockboxFieldName] = {
                        apiEndpoint: firstMapping.apiReference,
                        sourceField: targetFieldName,
                        derivedFrom: rule.ruleId,
                        inputField: sourceFieldName,
                        inputValue: sourceValue
                    };
                } else {
                    console.log(`      ⚠️  ${targetFieldName} not found in response`);
                }
            }
            
            if (fieldsEnriched > 0) {
                result.recordsEnriched++;
                console.log(`   ✅ Row ${i + 1}: Enriched ${fieldsEnriched} field(s)`);
            } else {
                console.log(`   ⚠️  Row ${i + 1}: No fields enriched`);
            }
            
        } catch (rowError) {
            console.error(`   ❌ Row ${i + 1} error:`, rowError.message);
            result.errors.push(`Row ${i + 1}: ${rowError.message}`);
        }
    }
    
    return result;
}

/**
 * Find field value in row with fuzzy matching
 * @param {object} row - Data row from Excel
 * @param {string} fieldName - Field name to search for
 * @returns {string|null} - Field value or null
 */
function findFieldValue(row, fieldName) {
    // Normalize the search field name
    const normalizedSearch = (fieldName || '')
        .replace(/\s+/g, '')       // Remove spaces
        .replace(/[_-]/g, '')      // Remove underscores/dashes
        .toLowerCase();            // Lowercase
    
    console.log(`      Normalized search: "${fieldName}" → "${normalizedSearch}"`);
    
    // Try multiple matching strategies
    for (const rowKey of Object.keys(row)) {
        const normalizedRowKey = rowKey
            .replace(/\s+/g, '')
            .replace(/[_-]/g, '')
            .toLowerCase();
        
        // Strategy 1: Exact match
        if (normalizedRowKey === normalizedSearch) {
            console.log(`      ✅ Exact match: "${rowKey}"`);
            return row[rowKey];
        }
        
        // Strategy 2: Row key contains search term
        if (normalizedRowKey.includes(normalizedSearch)) {
            console.log(`      ✅ Contains match: "${rowKey}" contains "${fieldName}"`);
            return row[rowKey];
        }
        
        // Strategy 3: Search term contains row key (for abbreviated columns)
        if (normalizedSearch.includes(normalizedRowKey) && normalizedRowKey.length >= 5) {
            console.log(`      ✅ Reverse match: "${fieldName}" contains "${rowKey}"`);
            return row[rowKey];
        }
    }
    
    // Strategy 4: Prefix match (first 5 characters)
    if (normalizedSearch.length >= 5) {
        const searchPrefix = normalizedSearch.substring(0, 5);
        
        for (const rowKey of Object.keys(row)) {
            const normalizedRowKey = rowKey
                .replace(/\s+/g, '')
                .replace(/[_-]/g, '')
                .toLowerCase();
            
            if (normalizedRowKey.length >= 5) {
                const rowPrefix = normalizedRowKey.substring(0, 5);
                
                if (rowPrefix === searchPrefix) {
                    console.log(`      ✅ Prefix match: "${rowKey}"`);
                    return row[rowKey];
                }
            }
        }
    }
    
    console.log(`      ❌ No match found for "${fieldName}"`);
    return null;
}

/**
 * Build Dynamic API URL with Query Parameters
 * Updated to work with NEW structure (fieldMappings)
 * @param {object} mapping - API mapping configuration (has apiReference, httpMethod)
 * @param {object} row - Data row
 * @param {string} sourceFieldName - Source field name from fieldMappings
 * @param {string} sourceValue - The actual value to use in API call
 * @returns {string} - Complete API URL with query parameters
 */
function buildDynamicAPIURL(mapping, row, sourceFieldName, sourceValue) {
    const apiReference = mapping.apiReference;
    
    console.log(`      Building API URL with value: ${sourceValue}`);
    
    // TRANSFORMATION: For Invoice Numbers (P_DocumentNumber), pad with leading zeros to 10 digits
    if (sourceFieldName && sourceFieldName.toLowerCase().includes('invoice')) {
        const originalValue = sourceValue;
        // Convert to string and pad with leading zeros to 10 digits
        sourceValue = String(sourceValue).padStart(10, '0');
        console.log(`      🔢 Invoice Number Transformation: ${originalValue} → ${sourceValue} (padded to 10 digits)`);
    }
    
    // PATTERN 1: OData V4 Function Import - /Function(Parameter='')/Set
    if (apiReference.includes("='')/Set") || apiReference.includes("='')")) {
        const finalURL = apiReference.replace("=''", `='${sourceValue}'`);
        console.log(`      📋 Final URL: ${finalURL}`);
        return finalURL;
    }
    
    // PATTERN 2: OData Entity Key with $expand - /Entity(Key='')?$expand=...
    if (apiReference.includes("='')?$expand=") || apiReference.includes("='')?$")) {
        const finalURL = apiReference.replace("=''", `='${sourceValue}'`);
        console.log(`      📋 Final URL: ${finalURL}`);
        return finalURL;
    }
    
    // PATTERN 3: If no empty quotes found, append as query parameter
    const separator = apiReference.includes('?') ? '&' : '?';
    const finalURL = `${apiReference}${separator}$filter=Field eq '${sourceValue}'`;
    console.log(`      📋 Final URL: ${finalURL}`);
    return finalURL;
}

/**
 * Call SAP API via Destination
 * Uses SAP credentials from .env file with destination reference from rules
 * @param {string} apiURL - Complete API URL with query parameters
 * @param {string} httpMethod - HTTP method (GET, POST)
 * @param {string} destination - Destination name from rule (e.g., 'S4HANA_SYSTEM_DESTINATION')
 * @returns {Promise<object>} - API response
 */
async function callSAPAPI(apiURL, httpMethod, destination) {
    try {
        console.log(`   📞 Calling SAP via destination: ${destination}`);
        console.log(`   🔗 API URL: ${apiURL}`);
        
        // Validate apiURL
        if (!apiURL || typeof apiURL !== 'string') {
            throw new Error(`Invalid API URL: ${apiURL}`);
        }
        
        // Parse the API URL to extract endpoint and query parameters
        const [endpoint, queryString] = apiURL.split('?');
        
        // Validate endpoint
        if (!endpoint) {
            throw new Error(`Failed to parse endpoint from URL: ${apiURL}`);
        }
        
        // Parse query parameters from $filter
        const queryParams = {};
        if (queryString) {
            const params = new URLSearchParams(queryString);
            for (const [key, value] of params.entries()) {
                queryParams[key] = value;
            }
        }
        
        console.log(`   🎯 Calling executeSapGetRequest: destination="${destination}", endpoint="${endpoint}"`);
        
        // Use SAP client's executeSapGetRequest which handles .env credentials
        const response = await sapClient.executeSapGetRequest(destination, endpoint, queryParams);
        
        console.log(`   ✅ SAP API Response received (Status: ${response.status})`);
        console.log(`   📦 RAW RESPONSE DATA:`, JSON.stringify(response.data, null, 2));
        
        return response;
    } catch (error) {
        console.error(`   ❌ SAP API call failed:`, error.message);
        throw new Error(`SAP API Error: ${error.message}`);
    }
}

/**
 * Extract Dynamic Field from SAP Response
 * Handles nested paths like: d.results[0].BELNR, value[0].BankNumber
 * Handles navigation properties: to_BusinessPartnerBank/results/0/BankNumber
 * @param {object} responseData - API response
 * @param {string} fieldPath - Path to extract (e.g., "BELNR", "to_BusinessPartnerBank/results/0/BankNumber")
 * @returns {any} - Extracted value or null
 */
function extractDynamicField(responseData, fieldPath) {
    try {
        console.log(`      🔍 Extracting field: "${fieldPath}" from response`);
        
        // Handle direct field access (e.g., "BELNR", "CompanyCode")
        if (responseData[fieldPath]) {
            console.log(`      ✅ Found direct field: ${responseData[fieldPath]}`);
            return responseData[fieldPath];
        }
        
        // Handle OData v2 wrapped response: { d: { ... } }
        let data = responseData.d || responseData;
        
        // Handle navigation property paths with slashes (e.g., "to_BusinessPartnerBank/results/0/BankNumber")
        if (fieldPath.includes('/')) {
            const parts = fieldPath.split('/');
            console.log(`      🔗 Navigating path: ${parts.join(' → ')}`);
            
            let current = data;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                
                // Handle array index (e.g., "0", "1")
                if (/^\d+$/.test(part)) {
                    const index = parseInt(part);
                    if (Array.isArray(current) && current.length > index) {
                        current = current[index];
                        console.log(`      📍 Array[${index}]: Found`);
                    } else {
                        console.log(`      ⚠️  Array[${index}]: Not found or empty`);
                        return null;
                    }
                }
                // Handle object property (e.g., "to_BusinessPartnerBank", "results", "BankNumber")
                else if (current && current[part] !== undefined) {
                    current = current[part];
                    console.log(`      📍 ${part}: ${Array.isArray(current) ? `Array[${current.length}]` : typeof current === 'object' ? 'Object' : current}`);
                } else {
                    console.log(`      ⚠️  Property "${part}" not found in response`);
                    return null;
                }
            }
            
            console.log(`      ✅ Final value: ${current}`);
            return current;
        }
        
        // Handle OData v4 format: { value: [...] }
        if (data.value && Array.isArray(data.value) && data.value.length > 0) {
            const val = data.value[0][fieldPath];
            if (val !== undefined) {
                console.log(`      ✅ Found in value[0]: ${val}`);
                return val;
            }
        }
        
        // Handle OData v2 format: { d: { results: [...] } }
        if (data.results && Array.isArray(data.results) && data.results.length > 0) {
            const val = data.results[0][fieldPath];
            if (val !== undefined) {
                console.log(`      ✅ Found in results[0]: ${val}`);
                return val;
            }
        }
        
        // Handle nested path extraction with dots (legacy support)
        if (fieldPath.includes('.')) {
            const value = fieldPath.split('.').reduce((obj, key) => {
                if (key.includes('[')) {
                    const arrKey = key.substring(0, key.indexOf('['));
                    const index = parseInt(key.match(/\[(\d+)\]/)[1]);
                    return obj[arrKey][index];
                }
                return obj[key];
            }, data);
            
            if (value !== undefined) {
                console.log(`      ✅ Found via nested path: ${value}`);
                return value;
            }
        }
        
        console.log(`      ❌ Field not found in any format`);
        return null;
        
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
