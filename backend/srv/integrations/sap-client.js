/**
 * SAP Cloud SDK Client
 * Handles all SAP S/4HANA API calls via Cloud SDK with DYNAMIC endpoint resolution
 * 
 * ⚠️ IMPORTANT: API endpoints come from rule apiMappings, NOT hardcoded here!
 */

const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
const logger = require('../utils/logger');

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
 * Get SAP Destination Configuration
 * Uses the actual BTP destination configured in cockpit
 */
function getDestination() {
    const destinationName = process.env.SAP_DESTINATION || 'S4HANA_SYSTEM_DESTINATION';
    
    logger.info(`Using SAP Destination: ${destinationName}`);
    
    return {
        name: destinationName,
        // Additional properties for local testing (optional)
        url: process.env.SAP_URL || 'http://s4fnd:443',
        username: process.env.SAP_USERNAME || 'S4H_FIN',
        password: process.env.SAP_PASSWORD || ''
    };
}

/**
 * Execute SAP OData API Call - FULLY DYNAMIC
 * Builds the API request based on rule configuration
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
    
    const destination = getDestination();
    
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
        
        // For OData v4, build URL with query string manually
        const queryString = new URLSearchParams();
        if (params.$filter) queryString.append('$filter', params.$filter);
        if (params.$select) queryString.append('$select', params.$select);
        if (params.$top) queryString.append('$top', params.$top);
        
        const fullUrl = `${endpoint}?${queryString.toString()}`;
        
        logger.info('Full API URL:', { url: fullUrl });
        
        const requestConfig = {
            method: method.toUpperCase(),
            url: fullUrl,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'sap-client': process.env.SAP_CLIENT || '100'
            },
            // Add timeout to prevent hanging indefinitely
            timeout: parseInt(process.env.SAP_API_TIMEOUT) || 5000  // 5 seconds default
        };
        
        // Add body for POST/PUT
        if (inputValues.payload && (method === 'POST' || method === 'PUT')) {
            requestConfig.data = inputValues.payload;
        }
        
        // Execute via Cloud SDK with timeout protection
        const response = await Promise.race([
            executeHttpRequest(destination, requestConfig),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('SAP API timeout after 5 seconds')), 5000)
            )
        ]);
        
        logger.info(`SAP API Success: ${method} ${endpoint}`, { 
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
        logger.error(`SAP API Error: ${apiMapping.httpMethod} ${apiMapping.apiReference}`, {
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
    logger.info('RULE-002: Fetching Partner Bank Details - DYNAMIC', { 
        api: apiMappings?.[0]?.apiReference,
        businessPartner 
    });
    
    try {
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
        
        // For OData, build URL with query string manually  
        const queryString = new URLSearchParams();
        if (params.$filter) queryString.append('$filter', params.$filter);
        if (params.$select) queryString.append('$select', params.$select);
        if (params.$top) queryString.append('$top', params.$top);
        
        const fullUrl = `${firstMapping.apiReference}?${queryString.toString()}`;
        
        // Execute API call with enhanced params
        const requestConfig = {
            method: 'GET',
            url: fullUrl,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'sap-client': process.env.SAP_CLIENT || '100'
            }
        };
        
        const destination = getDestination();
        const response = await executeHttpRequest(destination, requestConfig);
        
        if (!response.data?.d?.results?.length) {
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
        
        const bank = response.data.d.results[0];
        
        logger.info('RULE-002: Bank Details Retrieved', {
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
