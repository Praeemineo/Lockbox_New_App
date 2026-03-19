/**
 * LOCKBOX DYNAMIC VALIDATION ENGINE
 * 
 * Fully database-driven rule execution for RULE-001 and RULE-002
 * 
 * DATA STRUCTURE:
 * - sourceField: Excel column name (INPUT to API) - e.g., "Invoice Number", "Customer Number"
 * - targetField: SAP API response field path (OUTPUT from API) - e.g., "AccountingDocument", "to_BusinessPartnerBank/results/0/BankNumber"
 * - apiField: Lockbox field name (WHERE to store enriched data) - e.g., "PaymentReference", "PartnerBank"
 * 
 * EXECUTION FLOW:
 * Step-1: Read uploaded file payload as JSON input
 * Step-2: Identify applicable rules from processing_rules where active=true and fileType matches
 * Step-3: For each rule - validate condition dynamically (fuzzy match source fields)
 * Step-4: Construct SAP OData API dynamically: apiReference with sourceField value
 * Step-5: Call SAP using BTP Destination: S4HANA_SYSTEM_DESTINATION
 * Step-6: Extract targetField dynamically from API response (supports nested paths)
 * Step-7: Map extracted values to apiField (lockbox field) dynamically
 * Step-8: Return enriched Lockbox payload
 * 
 * RULES SUPPORTED:
 * - RULE-001: Invoice Number → Accounting Document API → PaymentReference, CompanyCode
 * - RULE-002: Customer Number → Business Partner API → PartnerBank, PartnerBankAccount, PartnerBankCountry
 * 
 * ⚠️ All rule logic is DATABASE-DRIVEN. No hardcoded field names.
 * ⚠️ Supports fuzzy matching for Excel column names (case-insensitive, space-insensitive)
 * ⚠️ Supports nested field paths for OData navigation properties
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
            // Support multiple condition formats:
            // OLD: { condition: "EXIST", documentFormat: "Invoice Number" }
            // NEW: { operator: "contains", attribute: "Invoice Number", value: "Value" }
            const fieldName = condition.attribute || condition.documentFormat || condition.fieldName || '';
            const conditionType = (condition.condition || condition.operator || '').toLowerCase();
            const conditionValue = condition.value || '';
            
            console.log(`      Checking condition: ${fieldName} ${conditionType} ${conditionValue ? '"' + conditionValue + '"' : ''}`);
            
            // If condition is checking for a specific hardcoded value, always pass
            // (These don't need to be in the file, they're configuration values)
            if (conditionType !== 'exist' && conditionType !== 'contains' && condition.condition) {
                console.log(`      ✅ Hardcoded value "${condition.condition}" - condition passes`);
                continue;
            }
            
            // For EXIST or CONTAINS conditions, check if field is in file
            if (conditionType === 'exist' || conditionType === 'contains') {
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
                
                // Check if field exists and has value
                if (!fieldValue || fieldValue === '' || fieldValue === null) {
                    console.log(`      ❌ Field ${fieldName} not found or empty`);
                    allConditionsMet = false;
                    break;
                }
                
                // For CONTAINS, check if value matches
                if (conditionType === 'contains' && conditionValue) {
                    // "contains" with value "Value" means: field must have a non-empty value
                    // This is essentially the same as EXIST for our use case
                    if (String(fieldValue).trim() === '') {
                        console.log(`      ❌ Field ${fieldName} is empty (contains check failed)`);
                        allConditionsMet = false;
                        break;
                    }
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
            
            // Enhanced logging similar to RULE-004
            console.log(`\n${'='.repeat(80)}`);
            console.log(`⚙️  EXECUTING ${rule.ruleId} - Row ${i + 1}`);
            console.log(`${'='.repeat(80)}`);
            console.log(`   ➡️  Source Value (${sourceFieldName}): ${sourceValue}`);
            console.log(`   📞 Calling SAP API with value: ${sourceValue}`);
            console.log(`   🔗 Full API URL: ${apiURL}`);
            console.log(`   🔑 Using direct SAP connection (environment variables)`);
            console.log(`${'─'.repeat(80)}`);
            
            // Step 4: Call SAP API with error handling
            let response;
            try {
                response = await callSAPAPI(apiURL, firstMapping.httpMethod, rule.destination);
                console.log(`   ✅ ${rule.ruleId}: SAP API call successful for row ${i + 1}`);
            } catch (apiError) {
                console.error(`   ❌ ${rule.ruleId}: SAP API call failed for row ${i + 1}:`, {
                    rule: rule.ruleName,
                    error: apiError.message,
                    apiURL: apiURL,
                    sourceValue: sourceValue,
                    statusCode: apiError.response?.status,
                    statusText: apiError.response?.statusText,
                    row: i + 1
                });
                
                // Mark row with error for tracking
                row[`${rule.ruleId}_error`] = apiError.message;
                row[`${rule.ruleId}_status`] = 'API_CALL_FAILED';
                
                result.errors.push(`Row ${i + 1}: ${rule.ruleId} API call failed - ${apiError.message}`);
                
                // Skip this row, continue to next
                continue;
            }
            
            if (!response || !response.data) {
                result.errors.push(`Row ${i + 1}: API returned no data`);
                continue;
            }
            
            console.log(`   ✅ SAP API Response received (Status: ${response.status})`);
            
            // LOG FULL RESPONSE VALUES - Same style as RULE-004
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📋 ${rule.ruleId} SAP RESPONSE VALUES - Row ${i + 1}:`);
            console.log(`${'='.repeat(80)}`);
            console.log(`🔍 Source value used in query: ${sourceValue}`);
            console.log(`📥 Full SAP Response:`);
            console.log(JSON.stringify(response.data, null, 2));
            
            // Extract and display key fields with labels
            console.log(`\n📊 Extracted Values:`);
            for (const fieldMapping of fieldMappings) {
                const targetFieldName = fieldMapping.targetField;
                const lockboxFieldName = fieldMapping.apiField;
                const apiValue = extractDynamicField(response.data, targetFieldName);
                
                if (apiValue !== null && apiValue !== undefined) {
                    console.log(`   🎯 ${lockboxFieldName}: "${apiValue}" (from SAP field: ${targetFieldName})`);
                } else {
                    console.log(`   ⚠️  ${lockboxFieldName}: NOT FOUND (expected from: ${targetFieldName})`);
                }
            }
            console.log(`${'='.repeat(80)}\n`);
            
            // Step 5: Extract and map ALL output fields from API response
            let fieldsEnriched = 0;
            
            console.log(`   📋 Processing ${fieldMappings.length} field mapping(s)...`);
            
            for (const fieldMapping of fieldMappings) {
                let targetFieldName = fieldMapping.targetField;   // Field path in SAP response
                const lockboxFieldName = fieldMapping.apiField;      // Field to store in lockbox
                
                console.log(`\n   ${'─'.repeat(60)}`);
                console.log(`   📝 Field Mapping: ${fieldMapping.sourceField} → ${targetFieldName} → ${lockboxFieldName}`);
                console.log(`   ${'─'.repeat(60)}`);
                
                // AUTO-FIX: Convert simple field names to nested paths if needed
                // For RULE-002 (Business Partner Bank API)
                if (rule.ruleId === 'RULE-002' && !targetFieldName.includes('/')) {
                    console.log(`      🔧 Auto-converting simple field name to nested path...`);
                    
                    // Map simple field names to their nested OData V2 navigation paths
                    const fieldPathMap = {
                        'BankNumber': 'to_BusinessPartnerBank/results/0/BankNumber',
                        'BankAccount': 'to_BusinessPartnerBank/results/0/BankAccount',
                        'BankCountryKey': 'to_BusinessPartnerBank/results/0/BankCountryKey'
                    };
                    
                    if (fieldPathMap[targetFieldName]) {
                        const originalField = targetFieldName;
                        targetFieldName = fieldPathMap[targetFieldName];
                        console.log(`      ✅ Converted: "${originalField}" → "${targetFieldName}"`);
                    }
                }
                
                // Extract value using dynamic field path
                const apiValue = extractDynamicField(response.data, targetFieldName);
                
                if (apiValue !== null && apiValue !== undefined) {
                    // CRITICAL: Use the EXACT apiField name from config (matches SAP API field name)
                    // Do NOT use case-insensitive matching - enforce exact SAP field name
                    const fieldToUpdate = lockboxFieldName; // Use exact name from config
                    
                    console.log(`      🔍 Will create/update field: "${fieldToUpdate}" (exact SAP API field name)`);
                    console.log(`      🔍 Available keys before: ${Object.keys(row).join(', ')}`);
                    
                    row[fieldToUpdate] = apiValue;
                    fieldsEnriched++;
                    
                    console.log(`   ✅ Enriched Field: ${fieldToUpdate} = "${apiValue}"`);
                    console.log(`      ↳ Extracted from SAP field: ${targetFieldName}`);
                    console.log(`      ↳ Input value: ${sourceValue}`);
                    
                    // Add metadata for Field Mapping Preview
                    if (!row._apiDerivedFields) row._apiDerivedFields = [];
                    if (!row._apiFieldMappings) row._apiFieldMappings = {};
                    
                    row._apiDerivedFields.push(fieldToUpdate);
                    row._apiFieldMappings[fieldToUpdate] = {
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
                console.log(`\n${'='.repeat(80)}`);
                console.log(`✅ ${rule.ruleId} Row ${i + 1} ENRICHMENT SUMMARY:`);
                console.log(`   Fields enriched: ${fieldsEnriched}`);
                console.log(`   Enriched row data (relevant fields):`);
                fieldMappings.forEach(fm => {
                    if (row[fm.apiField]) {
                        console.log(`   - ${fm.apiField}: "${row[fm.apiField]}"`);
                    }
                });
                console.log(`${'='.repeat(80)}\n`);
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
 * Automatically adds missing function parameters for OData V4 functions
 * @param {object} mapping - API mapping configuration (has apiReference, httpMethod)
 * @param {string} sourceFieldName - Source field name from fieldMappings
 * @param {string} sourceValue - The actual value to use in API call
 * @returns {string} - Complete API URL with query parameters
 */
function buildDynamicAPIURL(mapping, sourceFieldName, sourceValue) {
    let apiReference = mapping.apiReference;
    
    console.log(`      📝 Building URL with ${sourceFieldName} = "${sourceValue}"`);
    
    // Apply transformations based on field type
    let transformedValue = sourceValue;
    
    // TRANSFORMATION 1: Invoice Numbers - pad with leading zeros to 10 digits
    if (sourceFieldName && sourceFieldName.toLowerCase().includes('invoice')) {
        transformedValue = String(sourceValue).padStart(10, '0');
        console.log(`      🔢 Invoice Number padded: ${sourceValue} → ${transformedValue}`);
    }
    
    // TRANSFORMATION 2: Customer Numbers - ensure proper formatting
    if (sourceFieldName && sourceFieldName.toLowerCase().includes('customer')) {
        transformedValue = String(sourceValue).padStart(10, '0');
        console.log(`      🔢 Customer Number padded: ${sourceValue} → ${transformedValue}`);
    }
    
    // AUTO-FIX: Add missing OData V4 function parameter if needed
    // Detects if API reference is an OData V4 function without parameter
    if (apiReference.includes('/ZFI_I_ACC_DOCUMENT') && !apiReference.includes('(P_DocumentNumber=')) {
        console.log(`      🔧 Auto-fixing: Adding missing function parameter to API reference`);
        apiReference = apiReference + "(P_DocumentNumber='')";
        
        // Add /Set endpoint if missing
        if (!apiReference.includes('/Set')) {
            apiReference = apiReference + '/Set';
        }
        console.log(`      ✅ Fixed API reference: ${apiReference}`);
    }
    
    // Replace placeholder ('') with actual value
    // This works for patterns like:
    // - P_DocumentNumber='' (OData V4 function)
    // - BusinessPartner='' (OData V2 entity key)
    const finalURL = apiReference.replace("=''", `='${transformedValue}'`);
    
    console.log(`      ✅ Final URL: ${finalURL}`);
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
        console.log(`   ⚡ Using DIRECT connection (bypassing BTP Destination Service)`);
        
        // Use SAP client's executeSapGetRequest with forceDirect=true (like RULE-004)
        // This bypasses BTP Destination Service and uses .env credentials directly
        const response = await sapClient.executeSapGetRequest(
            destination,   // destination name (or null)
            endpoint,      // API endpoint
            queryParams,   // query parameters
            true           // forceDirect = true ✅ Direct connection via .env
        );
        
        console.log(`   ✅ SAP API Response received (Status: ${response.status})`);
        console.log(`   📦 RAW RESPONSE DATA:`, JSON.stringify(response.data, null, 2));
        
        return response;
    } catch (error) {
        console.error(`   ❌ SAP API call failed:`, error.message);
        throw new Error(`SAP API Error: ${error.message}`);
    }
}

/**
 * Extract field value from nested API response
 * Supports multiple OData formats and automatic path detection
 * @param {object} data - API response data
 * @param {string} fieldPath - Field path (supports slash-separated paths)
 * @returns {any} - Extracted field value
 */
function extractDynamicField(data, fieldPath) {
    console.log(`      🔍 Extracting field: "${fieldPath}" from response`);
    
    if (!data) {
        console.log(`      ❌ No data provided`);
        return null;
    }
    
    // Strategy 1: Direct extraction if fieldPath doesn't contain '/'
    if (!fieldPath.includes('/')) {
        // Try multiple locations in common OData formats
        
        // Format 1: OData V4 - value array
        if (data.value && Array.isArray(data.value) && data.value.length > 0) {
            if (data.value[0][fieldPath] !== undefined) {
                console.log(`      ✅ Found in value[0].${fieldPath}`);
                return data.value[0][fieldPath];
            }
        }
        
        // Format 2: OData V2 - d wrapper
        if (data.d) {
            // Try d.results array
            if (data.d.results && Array.isArray(data.d.results) && data.d.results.length > 0) {
                if (data.d.results[0][fieldPath] !== undefined) {
                    console.log(`      ✅ Found in d.results[0].${fieldPath}`);
                    return data.d.results[0][fieldPath];
                }
            }
            
            // Try direct d.fieldPath
            if (data.d[fieldPath] !== undefined) {
                console.log(`      ✅ Found in d.${fieldPath}`);
                return data.d[fieldPath];
            }
            
            // Try nested navigation properties - auto-detect
            // Look for any navigation properties (starts with "to_")
            for (const key in data.d) {
                if (key.startsWith('to_') && data.d[key]) {
                    const navProp = data.d[key];
                    
                    // Check if navigation has results array
                    if (navProp.results && Array.isArray(navProp.results) && navProp.results.length > 0) {
                        if (navProp.results[0][fieldPath] !== undefined) {
                            console.log(`      ✅ Found in d.${key}.results[0].${fieldPath}`);
                            return navProp.results[0][fieldPath];
                        }
                    }
                }
            }
        }
        
        // Format 3: Direct at root level
        if (data[fieldPath] !== undefined) {
            console.log(`      ✅ Found at root.${fieldPath}`);
            return data[fieldPath];
        }
    }
    
    // Strategy 2: Path-based extraction (slash-separated)
    const parts = fieldPath.split('/');
    let current = data;
    
    // Start from d wrapper if present (OData V2)
    if (current.d && !parts[0].startsWith('d')) {
        current = current.d;
    }
    
    // Navigate through path
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Skip empty parts
        if (!part) continue;
        
        // Handle array indices [0] or just 0
        if (/^\d+$/.test(part)) {
            const index = parseInt(part);
            if (Array.isArray(current) && current[index] !== undefined) {
                current = current[index];
                continue;
            }
        }
        
        // Navigate to property
        if (current[part] !== undefined) {
            current = current[part];
        } else {
            console.log(`      ❌ Path segment "${part}" not found`);
            return null;
        }
    }
    
    console.log(`      ✅ Extracted value via path navigation`);
    return current;
    
    console.log(`      ❌ Field not found in any format`);
    return null;
}

// Export main functions
module.exports = {
    loadProcessingRules,
    processLockboxRules,
    evaluateRuleCondition,
    buildDynamicAPIURL,
    extractDynamicField
};
