/**
 * SAP Service - Core Connection and Configuration
 * Handles SAP Cloud SDK connection via BTP Destination Service
 */

const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');

// SAP Configuration Constants
const SAP_CONFIG = {
    API_PATH: '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch',
    CLEARING_PATH: '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxClearing',
    COMPANY_CODE: '1710',
    CLIENT: process.env.SAP_CLIENT || '100',
    DESTINATION_NAME: 'S4HANA_SYSTEM_DESTINATION'
};

/**
 * Log SAP Configuration on startup
 */
function logSapConfig() {
    console.log('SAP Configuration:');
    console.log('  Destination:', SAP_CONFIG.DESTINATION_NAME);
    console.log('  API Path:', SAP_CONFIG.API_PATH);
    console.log('  Clearing Path:', SAP_CONFIG.CLEARING_PATH);
    console.log('  Client:', SAP_CONFIG.CLIENT);
    console.log('  Company Code:', SAP_CONFIG.COMPANY_CODE);
}

/**
 * Execute HTTP request to SAP via BTP Destination
 * @param {Object} options - Request options
 * @param {string} options.method - HTTP method (GET, POST, PUT, DELETE)
 * @param {string} options.url - API endpoint URL
 * @param {Object} options.params - Query parameters
 * @param {Object} options.data - Request body (for POST/PUT)
 * @param {Object} options.headers - Additional headers
 * @returns {Promise<Object>} SAP response
 */
async function executeSapRequest(options) {
    const { method, url, params = {}, data = null, headers = {} } = options;
    
    console.log(`=== SAP ${method} Request ===`);
    console.log('Destination:', SAP_CONFIG.DESTINATION_NAME);
    console.log('URL:', url);
    
    const requestConfig = {
        method,
        url,
        params: {
            'sap-client': SAP_CONFIG.CLIENT,
            ...params
        },
        headers: {
            'Accept': 'application/json',
            ...headers
        }
    };
    
    if (data) {
        requestConfig.data = data;
        requestConfig.headers['Content-Type'] = 'application/json';
    }
    
    try {
        const response = await executeHttpRequest(
            { destinationName: SAP_CONFIG.DESTINATION_NAME },
            requestConfig
        );
        
        console.log('SAP Response Status:', response.status);
        return response;
    } catch (error) {
        console.error('SAP Request Error:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

module.exports = {
    SAP_CONFIG,
    logSapConfig,
    executeSapRequest,
    executeHttpRequest
};
