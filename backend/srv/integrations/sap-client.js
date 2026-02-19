/**
 * SAP Cloud SDK Client
 * Handles all SAP S/4HANA API calls via Cloud SDK with DYNAMIC endpoint resolution
 * 
 * ⚠️ IMPORTANT: API endpoints come from rule apiMappings, NOT hardcoded here!
 */

const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
const logger = require('../utils/logger');

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
        
        const requestConfig = {
            method: method.toUpperCase(),
            url: endpoint,
            params: params,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'sap-client': process.env.SAP_CLIENT || '100'
            }
        };
        
        // Add body for POST/PUT
        if (inputValues.payload && (method === 'POST' || method === 'PUT')) {
            requestConfig.data = inputValues.payload;
        }
        
        logger.info('Request config:', { 
            endpoint, 
            method, 
            filter: params.$filter,
            select: params.$select 
        });
        
        // Execute via Cloud SDK
        const response = await executeHttpRequest(destination, requestConfig);
        
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
 * @returns {object} - OData query parameters
 */
function buildODataParams(apiMapping, inputValues) {
    const params = {};
    
    // Build $filter dynamically
    const filterParts = [];
    
    // Input field becomes the filter condition
    if (apiMapping.inputField && inputValues[apiMapping.sourceInput]) {
        const inputValue = inputValues[apiMapping.sourceInput];
        filterParts.push(`${apiMapping.inputField} eq '${inputValue}'`);
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
    // Add common fields
    selectFields.push('CompanyCode', 'FiscalYear');
    
    params.$select = selectFields.join(',');
    
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
 * @param {string} invoiceNumber - Invoice/Document Number
 * @param {string} companyCode - Company Code (optional)
 * @param {string} fiscalYear - Fiscal Year (optional)
 * @returns {Promise<object>} - { success, belnr, companyCode, fiscalYear, error }
 */
async function fetchAccountingDocument(apiMapping, invoiceNumber, companyCode = null, fiscalYear = null) {
    logger.info('RULE-001: Fetching Accounting Document (BELNR) - DYNAMIC', { 
        api: apiMapping?.apiReference,
        invoiceNumber, 
        companyCode, 
        fiscalYear 
    });
    
    try {
        // Build input values dynamically
        const inputValues = {
            [apiMapping.sourceInput]: invoiceNumber,
            companyCode: companyCode,
            fiscalYear: fiscalYear
        };
        
        // Execute dynamic API call
        const result = await executeDynamicApiCall(apiMapping, inputValues);
        
        if (!result.success || !result.outputValue) {
            logger.warn('RULE-001: No accounting document found', { invoiceNumber });
            return {
                success: false,
                error: result.error || `No accounting document found for invoice ${invoiceNumber}`,
                belnr: null
            };
        }
        
        // Extract full result
        const entry = result.data?.d?.results?.[0] || {};
        
        logger.info('RULE-001: Accounting Document Retrieved', {
            invoiceNumber,
            belnr: result.outputValue,
            companyCode: entry.CompanyCode,
            fiscalYear: entry.FiscalYear
        });
        
        return {
            success: true,
            belnr: result.outputValue,
            companyCode: entry.CompanyCode || companyCode,
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
 * @param {object} apiMapping - API mapping from RULE-002
 * @param {string} businessPartner - Business Partner Number
 * @returns {Promise<object>} - Bank details or defaults
 */
async function fetchPartnerBankDetails(apiMapping, businessPartner) {
    logger.info('RULE-002: Fetching Partner Bank Details - DYNAMIC', { 
        api: apiMapping?.apiReference,
        businessPartner 
    });
    
    try {
        const inputValues = {
            [apiMapping.sourceInput]: businessPartner
        };
        
        const result = await executeDynamicApiCall(apiMapping, inputValues);
        
        if (!result.success || !result.data?.d?.results?.length) {
            logger.warn('RULE-002: No bank details found, using defaults', { businessPartner });
            return {
                success: false,
                usedDefaults: true,
                bankCode: '88888876',
                bankAccount: '8765432195',
                bankCountry: 'US',
                error: result.error || 'No bank details found'
            };
        }
        
        const bank = result.data.d.results[0];
        
        logger.info('RULE-002: Bank Details Retrieved', {
            businessPartner,
            bankCode: bank.BankInternalID
        });
        
        return {
            success: true,
            usedDefaults: false,
            bankCode: bank.BankInternalID,
            bankAccount: bank.BankAccount,
            bankCountry: bank.BankCountry,
            error: null
        };
        
    } catch (error) {
        logger.error('RULE-002: Error fetching bank details', { error: error.message });
        return {
            success: false,
            usedDefaults: true,
            bankCode: '88888876',
            bankAccount: '8765432195',
            bankCountry: 'US',
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

module.exports = {
    getDestination,
    executeDynamicApiCall,
    buildODataParams,
    extractOutputValue,
    fetchAccountingDocument,
    fetchPartnerBankDetails,
    // Deprecated
    callSapApi
};


/**
 * RULE-002: Fetch Partner Bank Details
 * API: /sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartnerBank
 * @param {string} businessPartner - Business Partner Number (Customer)
 * @returns {Promise<object>} - { success, bankCode, bankAccount, bankCountry, error }
 */
async function fetchPartnerBankDetails(businessPartner) {
    logger.info('RULE-002: Fetching Partner Bank Details', { businessPartner });
    
    try {
        const params = {
            $filter: `BusinessPartner eq '${businessPartner}'`,
            $select: 'BankInternalID,BankCountry,BankAccount,BankControlKey',
            $top: 1
        };
        
        const result = await callSapApi(
            '/sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartnerBank',
            'GET',
            params
        );
        
        if (!result.success) {
            logger.warn('RULE-002: API call failed, using defaults', { error: result.error });
            // Return default bank details
            return {
                success: false,
                usedDefaults: true,
                bankCode: '88888876',
                bankAccount: '8765432195',
                bankCountry: 'US',
                error: result.error
            };
        }
        
        const banks = result.data?.d?.results || [];
        
        if (banks.length === 0) {
            logger.warn('RULE-002: No bank details found, using defaults', { businessPartner });
            return {
                success: false,
                usedDefaults: true,
                bankCode: '88888876',
                bankAccount: '8765432195',
                bankCountry: 'US',
                error: 'No bank details found'
            };
        }
        
        const bank = banks[0];
        
        logger.info('RULE-002: Bank Details Retrieved', {
            businessPartner,
            bankCode: bank.BankInternalID,
            bankCountry: bank.BankCountry
        });
        
        return {
            success: true,
            usedDefaults: false,
            bankCode: bank.BankInternalID,
            bankAccount: bank.BankAccount,
            bankCountry: bank.BankCountry,
            bankControlKey: bank.BankControlKey,
            error: null
        };
        
    } catch (error) {
        logger.error('RULE-002: Error fetching bank details', { error: error.message });
        // Return defaults on error
        return {
            success: false,
            usedDefaults: true,
            bankCode: '88888876',
            bankAccount: '8765432195',
            bankCountry: 'US',
            error: error.message
        };
    }
}

/**
 * RULE-003: Fetch Customer Master Data
 * API: /sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartner
 * @param {string} businessPartner - Business Partner Number
 * @returns {Promise<object>} - { success, customerName, customerType, customerCategory, error }
 */
async function fetchCustomerMasterData(businessPartner) {
    logger.info('RULE-003: Fetching Customer Master Data', { businessPartner });
    
    try {
        const params = {
            $filter: `BusinessPartner eq '${businessPartner}'`,
            $select: 'BusinessPartner,BusinessPartnerName,BusinessPartnerCategory,BusinessPartnerGrouping',
            $top: 1
        };
        
        const result = await callSapApi(
            '/sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartner',
            'GET',
            params
        );
        
        if (!result.success) {
            return {
                success: false,
                error: `Failed to fetch customer data: ${result.error}`,
                customerName: businessPartner,
                customerType: 'CUSTOMER',
                customerCategory: 'UNKNOWN'
            };
        }
        
        const customers = result.data?.d?.results || [];
        
        if (customers.length === 0) {
            logger.warn('RULE-003: Customer not found', { businessPartner });
            return {
                success: false,
                error: 'Customer not found',
                customerName: businessPartner,
                customerType: 'CUSTOMER',
                customerCategory: 'UNKNOWN'
            };
        }
        
        const customer = customers[0];
        
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
 * RULE-004: Fetch Open Item Details
 * API: /sap/opu/odata/sap/API_ODATA_FI_OPEN_ITEMS/OpenItems
 * @param {string} invoiceNumber - Invoice/Document Number
 * @param {string} companyCode - Company Code
 * @returns {Promise<object>} - { success, openAmount, dueDate, error }
 */
async function fetchOpenItemDetails(invoiceNumber, companyCode) {
    logger.info('RULE-004: Fetching Open Item Details', { invoiceNumber, companyCode });
    
    try {
        const params = {
            $filter: `AccountingDocument eq '${invoiceNumber}' and CompanyCode eq '${companyCode}'`,
            $select: 'AccountingDocument,AmountInCompanyCodeCurrency,NetDueDate',
            $top: 1
        };
        
        const result = await callSapApi(
            '/sap/opu/odata/sap/YY1_OPENITEMS_CDS',
            'GET',
            params
        );
        
        if (!result.success) {
            return {
                success: false,
                error: `Failed to fetch open items: ${result.error}`,
                openAmount: 0,
                validated: false
            };
        }
        
        const items = result.data?.d?.results || [];
        
        if (items.length === 0) {
            logger.warn('RULE-004: No open items found', { invoiceNumber });
            return {
                success: false,
                error: 'No open items found',
                openAmount: 0,
                validated: false
            };
        }
        
        const item = items[0];
        
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
    callSapApi,
    getDestination,
    fetchAccountingDocument,
    fetchPartnerBankDetails,
    fetchCustomerMasterData,
    fetchOpenItemDetails
};
