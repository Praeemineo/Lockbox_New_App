/**
 * SAP Cloud SDK Client
 * Handles all SAP S/4HANA API calls via Cloud SDK with DYNAMIC endpoint resolution
 * With fallback to direct HTTP connection using .env credentials
 * 
 * ⚠️ IMPORTANT: API endpoints come from rule apiMappings, NOT hardcoded here!
 */

const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
const axios = require('axios');
const https = require('https');
const logger = require('../utils/logger');

// Import the working getFromSapApi function from server.js
// This uses the same proven connection method as postToSapApi
let getFromSapApi;
try {
    // We'll need to pass this function from server.js
    // For now, we'll implement it here using the same pattern
} catch (e) {
    logger.warn('Could not import getFromSapApi from server.js, will use local implementation');
}

// Circuit breaker to prevent hanging on repeated connection failures
let sapConnectionAvailable = true;
let lastConnectionAttempt = null;
const CONNECTION_RETRY_DELAY = 30000; // 30 seconds before retrying after failure

function checkCircuitBreaker() {
    if (!sapConnectionAvailable) {
        const now = Date.now();
        if (!lastConnectionAttempt || (now - lastConnectionAttempt) > CONNECTION_RETRY_DELAY) {
            // Allow retry after delay
            sapConnectionAvailable = true;
            lastConnectionAttempt = now;
            logger.info('Circuit breaker: Allowing SAP connection retry');
            return true;
        }
        logger.warn('Circuit breaker: SAP connection unavailable, skipping call');
        return false;
    }
    return true;
}

function markConnectionFailed() {
    sapConnectionAvailable = false;
    lastConnectionAttempt = Date.now();
    logger.warn('Circuit breaker: Marking SAP connection as unavailable');
}

/**
 * Get SAP Destination Configuration (Using same method as POST)
 * Uses the BTP Destination Service - same as working postToSapApi
 */
async function getDestinationViaBTP() {
    const { getDestination } = require('@sap-cloud-sdk/connectivity');
    const destinationName = process.env.SAP_DESTINATION_NAME || 'S4HANA_SYSTEM_DESTINATION';
    
    try {
        logger.info(`Resolving SAP Destination: ${destinationName}`);
        const destination = await getDestination(destinationName);
        logger.info('✅ Destination resolved successfully via BTP', {
            url: destination?.url,
            proxyType: destination?.proxyType
        });
        return { destination, destinationName };
    } catch (error) {
        logger.warn(`Failed to resolve BTP destination: ${error.message}`);
        return null;
    }
}

/**
 * Execute SAP GET Request - Using SAME method as working POST
 * Primary: BTP Destination Service (Cloud SDK)
 * Fallback: Direct HTTPS with .env credentials
 */
async function executeSapGetRequest(url, queryParams = {}) {
    const SAP_CLIENT = process.env.SAP_CLIENT || '100';
    
    logger.info('SAP GET Request', { url, queryParams });
    
    // STEP 1: Try BTP Destination Service (Same as POST)
    const btpDest = await getDestinationViaBTP();
    
    if (btpDest) {
        try {
            logger.info('Attempting SAP Cloud SDK (BTP) for GET...');
            const response = await executeHttpRequest(
                { destinationName: btpDest.destinationName },
                {
                    method: 'GET',
                    url: url,
                    params: {
                        'sap-client': SAP_CLIENT,
                        ...queryParams
                    },
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: parseInt(process.env.SAP_API_TIMEOUT) || 10000
                }
            );
            
            logger.info('✅ SAP Cloud SDK GET Success', { status: response.status });
            return response;
            
        } catch (error) {
            logger.warn(`SAP Cloud SDK GET failed: ${error.message}, trying fallback...`);
            // Continue to fallback
        }
    }
    
    // STEP 2: Fallback to Direct Connection (Same as POST)
    logger.info('Using direct SAP connection fallback for GET...');
    const SAP_URL = process.env.SAP_URL;
    const SAP_USER = process.env.SAP_USER;
    const SAP_PASSWORD = process.env.SAP_PASSWORD;
    
    if (!SAP_URL || !SAP_USER || !SAP_PASSWORD) {
        throw new Error('SAP connection failed: BTP unavailable and .env credentials missing');
    }
    
    logger.info('Direct SAP GET', { url: SAP_URL, user: SAP_USER });
    
    try {
        const queryString = new URLSearchParams({
            'sap-client': SAP_CLIENT,
            ...queryParams
        }).toString();
        
        const fullUrl = `${SAP_URL}${url}?${queryString}`;
        logger.info('Full GET URL:', { url: fullUrl });
        
        const response = await axios({
            method: 'GET',
            url: fullUrl,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            auth: {
                username: SAP_USER,
                password: SAP_PASSWORD
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false // For self-signed certificates (same as POST)
            }),
            timeout: parseInt(process.env.SAP_API_TIMEOUT) || 10000
        });
        
        logger.info('✅ Direct SAP GET Success', { status: response.status });
        return response;
        
    } catch (error) {
        logger.error('Direct SAP GET Error', {
            status: error.response?.status,
            message: error.message,
            data: error.response?.data
        });
        throw error;
    }
}

/**
 * Execute Direct SAP API Call using axios (Fallback when Cloud SDK fails)
 * Uses credentials from .env file for production/direct connection
 */
async function executeDirectSapApiCall(apiMapping, inputValues) {
    const sapUrl = process.env.SAP_URL;
    const sapUser = process.env.SAP_USER;
    const sapPassword = process.env.SAP_PASSWORD;
    const sapClient = process.env.SAP_CLIENT || '100';
    
    if (!sapUrl || !sapUser || !sapPassword) {
        logger.error('Direct SAP connection failed: Missing SAP credentials in .env');
        return {
            success: false,
            error: 'SAP credentials not configured',
            status: 500,
            data: null,
            outputValue: null
        };
    }
    
    try {
        const method = apiMapping.httpMethod || 'GET';
        const endpoint = apiMapping.apiReference;
        
        logger.info(`Direct SAP API Call: ${method} ${endpoint}`, { 
            inputField: apiMapping.inputField,
            outputField: apiMapping.outputField 
        });
        
        // Build OData query parameters dynamically
        const params = buildODataParams(apiMapping, inputValues);
        
        // Build full URL
        const queryString = new URLSearchParams();
        if (params.$filter) queryString.append('$filter', params.$filter);
        if (params.$select) queryString.append('$select', params.$select);
        if (params.$top) queryString.append('$top', params.$top);
        
        const fullUrl = `${sapUrl}${endpoint}?${queryString.toString()}`;
        
        logger.info('Direct SAP API URL:', { url: fullUrl });
        
        // Create axios instance with timeout and SSL config
        const axiosConfig = {
            method: method.toLowerCase(),
            url: fullUrl,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'sap-client': sapClient
            },
            auth: {
                username: sapUser,
                password: sapPassword
            },
            timeout: parseInt(process.env.SAP_API_TIMEOUT) || 5000,
            httpsAgent: new https.Agent({
                rejectUnauthorized: false // Allow self-signed certificates
            })
        };
        
        // Add body for POST/PUT
        if (inputValues.payload && (method === 'POST' || method === 'PUT')) {
            axiosConfig.data = inputValues.payload;
        }
        
        // Execute with timeout
        const response = await axios(axiosConfig);
        
        logger.info(`Direct SAP API Success: ${method} ${endpoint}`, { 
            status: response.status,
            recordCount: response.data?.d?.results?.length || 1
        });
        
        // Extract output field value from response
        const outputValue = extractOutputValue(response.data, apiMapping.outputField);
        
        return {
            success: true,
            data: response.data,
            outputValue: outputValue,
            status: response.status
        };
        
    } catch (error) {
        logger.error(`Direct SAP API Error: ${apiMapping.httpMethod} ${apiMapping.apiReference}`, {
            error: error.message,
            response: error.response?.data
        });
        
        return {
            success: false,
            error: error.message,
            status: error.response?.status || 500,
            data: null,
            outputValue: null
        };
    }
}

/**
 * Execute SAP OData API Call - FULLY DYNAMIC
 * Builds the API request based on rule configuration
 * 
 * @param {object} apiMapping - API mapping from rule configuration
 * @param {object} inputValues - Input values for the API call
 * @returns {Promise<object>} - API response
 */
/**
 * Execute SAP OData API Call - FULLY DYNAMIC
 * Uses SAME connection method as working POST operation
 * 
 * @param {object} apiMapping - API mapping from rule configuration
 * @param {object} inputValues - Input values for the API call
 * @returns {Promise<object>} - API response
 */
async function executeDynamicApiCall(apiMapping, inputValues) {
    // Check circuit breaker before attempting connection
    if (!checkCircuitBreaker()) {
        return {
            success: false,
            error: 'SAP connection unavailable (circuit breaker open)',
            status: 503,
            data: null,
            outputValue: null
        };
    }
    
    try {
        const method = apiMapping.httpMethod || 'GET';
        const endpoint = apiMapping.apiReference;
        
        logger.info(`Dynamic SAP API Call: ${method} ${endpoint}`, { 
            inputField: apiMapping.inputField,
            outputField: apiMapping.outputField 
        });
        
        // Build OData query parameters dynamically
        const params = buildODataParams(apiMapping, inputValues);
        
        logger.info('Request config:', { 
            endpoint, 
            method, 
            filter: params.$filter,
            select: params.$select 
        });
        
        // Build query parameters object
        const queryParams = {};
        if (params.$filter) queryParams.$filter = params.$filter;
        if (params.$select) queryParams.$select = params.$select;
        if (params.$top) queryParams.$top = params.$top;
        
        logger.info('Query parameters:', queryParams);
        
        // Use the SAME method as working POST operation
        const response = await executeSapGetRequest(endpoint, queryParams);
        
        logger.info(`✅ SAP API Success: ${method} ${endpoint}`, { 
            status: response.status,
            recordCount: response.data?.d?.results?.length || response.data?.value?.length || 1
        });
        
        // Extract output field value from response
        const outputValue = extractOutputValue(response.data, apiMapping.outputField);
        
        return {
            success: true,
            data: response.data,
            outputValue: outputValue,
            status: response.status
        };
        
    } catch (error) {
        logger.error(`❌ SAP API Error: ${apiMapping.httpMethod} ${apiMapping.apiReference}`, {
            error: error.message,
            response: error.response?.data
        });
        
        // Mark connection as failed if it's a network/timeout error
        if (error.message.includes('timeout') || 
            error.message.includes('ENOTFOUND') || 
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ETIMEDOUT')) {
            markConnectionFailed();
        }
        
        return {
            success: false,
            error: error.message,
            status: error.response?.status || 500,
            data: null,
            outputValue: null
        };
    }
}

/**
 * Build OData query parameters dynamically from mapping
 * @param {object} apiMapping - API mapping configuration
 * @param {object} inputValues - Input values
 * @param {array} additionalSelectFields - Additional fields to select (optional)
 * @returns {object} - OData query parameters
 */
function buildODataParams(apiMapping, inputValues, additionalSelectFields = []) {
    const params = {};
    
    // Build $filter dynamically
    const filterParts = [];
    
    // Input field becomes the filter condition
    if (apiMapping.inputField && inputValues[apiMapping.sourceInput]) {
        const inputValue = inputValues[apiMapping.sourceInput];
        filterParts.push(`${apiMapping.inputField} eq '${inputValue}'`);
    }
    
    // Add filter conditions from mapping (e.g., BankIdentification = 0001)
    if (apiMapping.filterConditions) {
        Object.keys(apiMapping.filterConditions).forEach(key => {
            const value = apiMapping.filterConditions[key];
            filterParts.push(`${key} eq '${value}'`);
        });
    }
    
    // Add additional filters from inputValues
    if (inputValues.companyCode) {
        filterParts.push(`CompanyCode eq '${inputValues.companyCode}'`);
    }
    if (inputValues.fiscalYear) {
        filterParts.push(`FiscalYear eq '${inputValues.fiscalYear}'`);
    }
    
    if (filterParts.length > 0) {
        params.$filter = filterParts.join(' and ');
    }
    
    // Build $select for output fields
    const selectFields = [];
    if (apiMapping.outputField) {
        selectFields.push(apiMapping.outputField);
    }
    
    // Add additional select fields (for multi-field rules like RULE-002)
    if (additionalSelectFields && additionalSelectFields.length > 0) {
        selectFields.push(...additionalSelectFields);
    }
    
    // Add common fields
    selectFields.push('CompanyCode', 'FiscalYear');
    
    // Remove duplicates
    params.$select = [...new Set(selectFields)].join(',');
    
    // Limit to 1 result for lookups
    params.$top = 1;
    
    return params;
}

/**
 * Extract output value from SAP response
 * @param {object} responseData - SAP OData response
 * @param {string} outputField - Field name to extract
 * @returns {any} - Extracted value
 */
function extractOutputValue(responseData, outputField) {
    try {
        // Handle OData v2 response format
        const results = responseData?.d?.results || [];
        
        if (results.length === 0) {
            return null;
        }
        
        const firstResult = results[0];
        return firstResult[outputField] || null;
        
    } catch (error) {
        logger.error('Error extracting output value:', error);
        return null;
    }
}

/**
 * RULE-001: Fetch Accounting Document (BELNR) - DYNAMIC VERSION
 * Uses apiMappings from rule configuration
 * 
 * @param {object} apiMapping - API mapping from RULE-001
 * @param {string} documentNumber - Customer Number or Document Number (based on mapping.sourceInput)
 * @param {string} companyCode - Company Code (optional)
 * @param {string} fiscalYear - Fiscal Year (optional)
 * @returns {Promise<object>} - { success, belnr, companyCode, fiscalYear, error }
 */
async function fetchAccountingDocument(apiMapping, documentNumber, companyCode = null, fiscalYear = null) {
    logger.info('RULE-001: Fetching Accounting Document (BELNR) - DYNAMIC', { 
        api: apiMapping?.apiReference,
        inputField: apiMapping?.inputField,
        documentNumber, 
        companyCode, 
        fiscalYear 
    });
    
    try {
        // Build input values dynamically based on mapping.sourceInput
        const inputValues = {
            [apiMapping.sourceInput]: documentNumber,
            companyCode: companyCode,
            fiscalYear: fiscalYear
        };
        
        logger.info('RULE-001: Input values:', inputValues);
        
        // Execute dynamic API call
        const result = await executeDynamicApiCall(apiMapping, inputValues);
        
        if (!result.success || !result.outputValue) {
            logger.warn('RULE-001: No accounting document found', { documentNumber });
            return {
                success: false,
                error: result.error || `No accounting document found for ${documentNumber}`,
                belnr: null
            };
        }
        
        // Extract full result
        const entry = result.data?.d?.results?.[0] || {};
        
        logger.info('RULE-001: Accounting Document Retrieved', {
            documentNumber,
            belnr: result.outputValue,
            companyCode: entry.CompanyCode,
            fiscalYear: entry.FiscalYear
        });
        
        return {
            success: true,
            belnr: result.outputValue,
            companyCode: entry.CompanyCode || companyCode,  // Use from API or fallback to input
            fiscalYear: entry.FiscalYear || fiscalYear,
            documentDate: entry.DocumentDate,
            postingDate: entry.PostingDate,
            error: null
        };
        
    } catch (error) {
        logger.error('RULE-001: Error fetching accounting document', { error: error.message });
        return {
            success: false,
            error: error.message,
            belnr: null
        };
    }
}

/**
 * RULE-002: Fetch Partner Bank Details - DYNAMIC VERSION
 * @param {array} apiMappings - Array of API mappings from RULE-002 (for multiple fields)
 * @param {string} businessPartner - Business Partner Number
 * @returns {Promise<object>} - Bank details or defaults
 */
async function fetchPartnerBankDetails(apiMappings, businessPartner) {
    logger.info('RULE-002: Fetching Partner Bank Details - DYNAMIC (Using same method as POST)', { 
        api: apiMappings?.[0]?.apiReference,
        businessPartner 
    });
    
    try {
        // Check circuit breaker before attempting connection
        if (!checkCircuitBreaker()) {
            logger.warn('RULE-002: Circuit breaker open, using defaults');
            return {
                success: false,
                usedDefaults: true,
                PartnerBank: '88888876',
                PartnerBankAccount: '8765432195',
                PartnerBankCountry: 'US',
                error: 'SAP connection unavailable (circuit breaker open)'
            };
        }
        
        // Use the first mapping to get the API reference (all mappings use same API)
        const firstMapping = Array.isArray(apiMappings) ? apiMappings[0] : apiMappings;
        
        const inputValues = {
            [firstMapping.sourceInput]: businessPartner
        };
        
        // Collect all output fields from the mappings (BANKS, BANKL, BANKN)
        const additionalFields = Array.isArray(apiMappings) 
            ? apiMappings.slice(1).map(m => m.outputField).filter(Boolean)
            : [];
        
        // Build params with all output fields
        const params = buildODataParams(firstMapping, inputValues, additionalFields);
        
        logger.info('RULE-002: Query parameters:', { 
            filter: params.$filter, 
            select: params.$select 
        });
        
        // Build query parameters object
        const queryParams = {};
        if (params.$filter) queryParams.$filter = params.$filter;
        if (params.$select) queryParams.$select = params.$select;
        if (params.$top) queryParams.$top = params.$top;
        
        // Use the SAME method as working POST operation
        const response = await executeSapGetRequest(firstMapping.apiReference, queryParams);
        
        if (!response.data?.d?.results?.length && !response.data?.value?.length) {
            logger.warn('RULE-002: No bank details found, using defaults', { businessPartner });
            return {
                success: false,
                usedDefaults: true,
                PartnerBank: '88888876',
                PartnerBankAccount: '8765432195',
                PartnerBankCountry: 'US',
                error: 'No bank details found'
            };
        }
        
        const bank = response.data.d?.results?.[0] || response.data.value?.[0];
        
        logger.info('✅ RULE-002: Bank Details Retrieved', {
            businessPartner,
            BankNumber: bank.BankNumber,
            BankAccount: bank.BankAccount,
            BankCountryKey: bank.BankCountryKey
        });
        
        return {
            success: true,
            usedDefaults: false,
            PartnerBank: bank.BankNumber || bank.BankInternalID || '88888876',
            PartnerBankAccount: bank.BankAccount || '8765432195',
            PartnerBankCountry: bank.BankCountryKey || bank.BankCountry || 'US',
            error: null
        };
        
    } catch (error) {
        logger.error('RULE-002: Error fetching bank details', { error: error.message });
        
        // Mark connection as failed if it's a network/timeout error
        if (error.message.includes('timeout') || 
            error.message.includes('ENOTFOUND') || 
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ETIMEDOUT')) {
            markConnectionFailed();
        }
        
        return {
            success: false,
            usedDefaults: true,
            PartnerBank: '88888876',
            PartnerBankAccount: '8765432195',
            PartnerBankCountry: 'US',
            error: error.message
        };
    }
}

/**
 * Generic SAP API call (backward compatibility)
 * @deprecated Use executeDynamicApiCall instead
 */
async function callSapApi(endpoint, method = 'GET', params = {}, payload = null) {
    const apiMapping = {
        httpMethod: method,
        apiReference: endpoint,
        inputField: '',
        sourceInput: '',
        outputField: ''
    };
    
    const result = await executeDynamicApiCall(apiMapping, { params, payload });
    return result;
}

/**
 * RULE-003: Fetch Customer Master Data - DYNAMIC VERSION
 * @param {object} apiMapping - API mapping from RULE-003
 * @param {string} businessPartner - Business Partner Number
 * @returns {Promise<object>} - Customer details or defaults
 */
async function fetchCustomerMasterData(apiMapping, businessPartner) {
    logger.info('RULE-003: Fetching Customer Master Data - DYNAMIC', { 
        api: apiMapping?.apiReference,
        businessPartner 
    });
    
    try {
        const inputValues = {
            [apiMapping.sourceInput]: businessPartner
        };
        
        const result = await executeDynamicApiCall(apiMapping, inputValues);
        
        if (!result.success || !result.data?.d?.results?.length) {
            logger.warn('RULE-003: No customer data found', { businessPartner });
            return {
                success: false,
                error: result.error || 'Customer not found',
                customerName: businessPartner,
                customerType: 'CUSTOMER',
                customerCategory: 'UNKNOWN'
            };
        }
        
        const customer = result.data.d.results[0];
        
        logger.info('RULE-003: Customer Data Retrieved', {
            businessPartner,
            customerName: customer.BusinessPartnerName
        });
        
        return {
            success: true,
            customerName: customer.BusinessPartnerName,
            customerType: 'CUSTOMER',
            customerCategory: customer.BusinessPartnerCategory || 'STANDARD',
            customerGrouping: customer.BusinessPartnerGrouping,
            error: null
        };
        
    } catch (error) {
        logger.error('RULE-003: Error fetching customer data', { error: error.message });
        return {
            success: false,
            error: error.message,
            customerName: businessPartner,
            customerType: 'CUSTOMER',
            customerCategory: 'UNKNOWN'
        };
    }
}

/**
 * RULE-004: Fetch Open Item Details - DYNAMIC VERSION
 * @param {object} apiMapping - API mapping from RULE-004
 * @param {string} invoiceNumber - Invoice/Document Number
 * @param {string} companyCode - Company Code
 * @returns {Promise<object>} - Open item details or defaults
 */
async function fetchOpenItemDetails(apiMapping, invoiceNumber, companyCode) {
    logger.info('RULE-004: Fetching Open Item Details - DYNAMIC', { 
        api: apiMapping?.apiReference,
        invoiceNumber, 
        companyCode 
    });
    
    try {
        const inputValues = {
            [apiMapping.sourceInput]: invoiceNumber,
            companyCode: companyCode
        };
        
        const result = await executeDynamicApiCall(apiMapping, inputValues);
        
        if (!result.success || !result.data?.d?.results?.length) {
            logger.warn('RULE-004: No open items found', { invoiceNumber });
            return {
                success: false,
                error: result.error || 'No open items found',
                openAmount: 0,
                validated: false
            };
        }
        
        const item = result.data.d.results[0];
        
        logger.info('RULE-004: Open Item Retrieved', {
            invoiceNumber,
            openAmount: item.AmountInCompanyCodeCurrency,
            dueDate: item.NetDueDate
        });
        
        return {
            success: true,
            openAmount: item.AmountInCompanyCodeCurrency,
            dueDate: item.NetDueDate,
            validated: true,
            error: null
        };
        
    } catch (error) {
        logger.error('RULE-004: Error fetching open items', { error: error.message });
        return {
            success: false,
            error: error.message,
            openAmount: 0,
            validated: false
        };
    }
}

module.exports = {
    getDestination,
    executeDynamicApiCall,
    buildODataParams,
    extractOutputValue,
    fetchAccountingDocument,
    fetchPartnerBankDetails,
    fetchCustomerMasterData,
    fetchOpenItemDetails,
    // Deprecated
    callSapApi
};
