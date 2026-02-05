/**
 * SAP Service
 * Handles all SAP OData API calls via BTP Destination Service
 */

const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
const { SAP_CONFIG } = require('../config');
const { extractSapODataError } = require('../utils');

/**
 * POST LockboxBatch to SAP
 */
async function postToSapApi(payload) {
    const url = SAP_CONFIG.API_PATH;
    
    console.log('=== SAP API CALL (POST LockboxBatch) ===');
    console.log('Destination:', SAP_CONFIG.DESTINATION_NAME);
    console.log('URL:', url);
    
    try {
        const response = await executeHttpRequest(
            { destinationName: SAP_CONFIG.DESTINATION_NAME },
            {
                method: 'POST',
                url: url,
                params: { 'sap-client': SAP_CONFIG.CLIENT },
                data: payload,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('SAP Response Status:', response.status);
        return response;
        
    } catch (error) {
        const structuredError = extractSapODataError(error);
        console.error('SAP API Error:', structuredError);
        
        const detailedError = new Error(error.message);
        detailedError.sapErrorDetails = structuredError;
        throw detailedError;
    }
}

/**
 * GET LockboxBatch details from SAP
 */
async function getLockboxBatchDetails(internalKey, batch) {
    console.log('=== GET LockboxBatch Details ===');
    console.log('InternalKey:', internalKey, 'Batch:', batch);
    
    const url = `${SAP_CONFIG.API_PATH}/LockboxBatch(LockboxBatchInternalKey='${internalKey}',LockboxBatch='${batch}')`;
    
    const response = await executeHttpRequest(
        { destinationName: SAP_CONFIG.DESTINATION_NAME },
        {
            method: 'GET',
            url: url,
            params: {
                'sap-client': SAP_CONFIG.CLIENT,
                '$expand': 'to_Item,to_Item/to_LockboxClearing'
            },
            headers: { 'Accept': 'application/json' }
        }
    );
    
    return response;
}

/**
 * GET Business Partner Bank Details
 */
async function getCustomerBankDetails(customerId) {
    console.log('=== GET Business Partner Bank Details ===');
    console.log('Customer ID:', customerId);
    
    const url = SAP_CONFIG.BP_API_PATH;
    
    try {
        const response = await executeHttpRequest(
            { destinationName: SAP_CONFIG.DESTINATION_NAME },
            {
                method: 'GET',
                url: url,
                params: {
                    'sap-client': SAP_CONFIG.CLIENT,
                    '$filter': `BusinessPartner eq '${customerId}'`,
                    '$top': 1
                },
                headers: { 'Accept': 'application/json' }
            }
        );
        
        return response;
    } catch (error) {
        console.warn('Business Partner API not available or no data found');
        return null;
    }
}

module.exports = {
    postToSapApi,
    getLockboxBatchDetails,
    getCustomerBankDetails
};
