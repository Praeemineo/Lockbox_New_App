/**
 * SAP Cloud SDK Client
 * Handles all SAP S/4HANA API calls via Cloud SDK
 * 
 * ⚠️ NEW CODE LOCATION: All SAP API integration logic goes HERE
 */

const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
const logger = require('../utils/logger');

/**
 * Get SAP Destination Configuration
 */
function getDestination() {
    // BTP Destination name configured in cockpit
    return {
        name: process.env.SAP_DESTINATION || 'LOCKBOXDES',
        url: process.env.SAP_URL || '',
        username: process.env.SAP_USERNAME || '',
        password: process.env.SAP_PASSWORD || ''
    };
}

/**
 * Execute SAP OData API Call
 * @param {string} endpoint - API endpoint (e.g., '/sap/opu/odata/sap/API_JOURNALENTRY_SRV/JournalEntry')
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {object} params - Query parameters
 * @param {object} payload - Request body (for POST/PUT)
 * @returns {Promise<object>} - API response
 */
async function callSapApi(endpoint, method = 'GET', params = {}, payload = null) {
    const destination = getDestination();
    
    try {
        logger.info(`SAP API Call: ${method} ${endpoint}`, { params });
        
        const requestConfig = {
            method: method.toUpperCase(),
            url: endpoint,
            params: params,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };
        
        if (payload && (method === 'POST' || method === 'PUT')) {
            requestConfig.data = payload;
        }
        
        // Execute via Cloud SDK
        const response = await executeHttpRequest(destination, requestConfig);
        
        logger.info(`SAP API Success: ${method} ${endpoint}`, { 
            status: response.status,
            recordCount: response.data?.d?.results?.length || 1
        });
        
        return {
            success: true,
            data: response.data,
            status: response.status
        };
        
    } catch (error) {
        logger.error(`SAP API Error: ${method} ${endpoint}`, {
            error: error.message,
            response: error.response?.data
        });
        
        return {
            success: false,
            error: error.message,
            status: error.response?.status || 500,
            data: null
        };
    }
}

/**
 * RULE-001: Fetch Accounting Document (BELNR) by Invoice Number
 * API: /sap/opu/odata/sap/API_JOURNALENTRY_SRV/JournalEntry
 * @param {string} invoiceNumber - Invoice/Document Number (PaymentReference)
 * @param {string} companyCode - Company Code (optional)
 * @param {string} fiscalYear - Fiscal Year (optional)
 * @returns {Promise<object>} - { success, belnr, companyCode, fiscalYear, error }
 */
async function fetchAccountingDocument(invoiceNumber, companyCode = null, fiscalYear = null) {
    logger.info('RULE-001: Fetching Accounting Document (BELNR)', { invoiceNumber, companyCode, fiscalYear });
    
    try {
        // Build OData filter query
        let filter = `Reference3 eq '${invoiceNumber}'`;
        if (companyCode) {
            filter += ` and CompanyCode eq '${companyCode}'`;
        }
        if (fiscalYear) {
            filter += ` and FiscalYear eq '${fiscalYear}'`;
        }
        
        const params = {
            $filter: filter,
            $select: 'AccountingDocument,CompanyCode,FiscalYear,DocumentDate,PostingDate',
            $top: 1
        };
        
        const result = await callSapApi(
            '/sap/opu/odata/sap/API_JOURNALENTRY_SRV/A_JournalEntry',
            'GET',
            params
        );
        
        if (!result.success) {
            return {
                success: false,
                error: `SAP API call failed: ${result.error}`,
                belnr: null
            };
        }
        
        const entries = result.data?.d?.results || [];
        
        if (entries.length === 0) {
            logger.warn('RULE-001: No accounting document found', { invoiceNumber });
            return {
                success: false,
                error: `No accounting document found for invoice ${invoiceNumber}`,
                belnr: null
            };
        }
        
        const entry = entries[0];
        
        logger.info('RULE-001: Accounting Document Retrieved', {
            invoiceNumber,
            belnr: entry.AccountingDocument,
            companyCode: entry.CompanyCode,
            fiscalYear: entry.FiscalYear
        });
        
        return {
            success: true,
            belnr: entry.AccountingDocument,
            companyCode: entry.CompanyCode,
            fiscalYear: entry.FiscalYear,
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
