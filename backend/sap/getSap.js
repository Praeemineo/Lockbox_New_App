/**
 * SAP GET Operations
 * Handles all SAP GET requests via BTP Destination
 */

const { SAP_CONFIG, executeSapRequest, executeHttpRequest } = require('./sapService');

/**
 * GET LockboxBatch details from SAP
 * Retrieves batch header and accounting documents
 * @param {string} internalKey - LockboxBatchInternalKey
 * @param {string} batch - LockboxBatch number (usually '001')
 * @returns {Promise<Object>} Batch details with items and clearing
 */
async function getLockboxBatchDetails(internalKey, batch) {
    console.log('=== GET LockboxBatch Details ===');
    console.log('InternalKey:', internalKey);
    console.log('Batch:', batch);
    
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
            headers: {
                'Accept': 'application/json'
            }
        }
    );
    
    console.log('LockboxBatch Response Status:', response.status);
    console.log('LockboxBatch Response Data:', JSON.stringify(response.data, null, 2));
    
    return response;
}

/**
 * GET LockboxBatchItem details from SAP
 * Retrieves individual payment/remittance lines
 * @param {string} internalKey - LockboxBatchInternalKey
 * @param {string} batch - LockboxBatch number
 * @param {string} item - LockboxBatchItem number
 * @returns {Promise<Object>} Item details with clearing info
 */
async function getLockboxBatchItemDetails(internalKey, batch, item) {
    console.log('=== GET LockboxBatchItem Details ===');
    
    const url = `${SAP_CONFIG.API_PATH}/LockboxBatchItem(LockboxBatchInternalKey='${internalKey}',LockboxBatchItem='${item}',LockboxBatch='${batch}')`;
    
    const response = await executeHttpRequest(
        { destinationName: SAP_CONFIG.DESTINATION_NAME },
        {
            method: 'GET',
            url: url,
            params: {
                'sap-client': SAP_CONFIG.CLIENT,
                '$expand': 'to_LockboxClearing'
            },
            headers: {
                'Accept': 'application/json'
            }
        }
    );
    
    console.log('LockboxBatchItem Response Status:', response.status);
    console.log('LockboxBatchItem Response Data:', JSON.stringify(response.data, null, 2));
    
    return response;
}

/**
 * GET LockboxClearing from SAP
 * Retrieves clearing results for a payment advice
 * @param {Object} queryParams - Query parameters
 * @param {string} queryParams.paymentAdvice - Payment Advice number (SAP generated)
 * @param {string} queryParams.paymentAdviceItem - Payment Advice Item
 * @param {string} queryParams.paymentAdviceAccount - Customer number (from file)
 * @param {string} queryParams.paymentAdviceAccountType - Account type ('D' constant)
 * @param {string} queryParams.companyCode - Company code ('1710' constant)
 * @returns {Promise<Object>} Clearing details
 */
async function getLockboxClearing(queryParams) {
    const { paymentAdvice, paymentAdviceItem, paymentAdviceAccount, paymentAdviceAccountType, companyCode } = queryParams;
    
    // Build the key for direct entity access
    const entityKey = `LockboxClearing(PaymentAdvice='${paymentAdvice}',PaymentAdviceItem='${paymentAdviceItem || '1'}',PaymentAdviceAccount='${paymentAdviceAccount}',PaymentAdviceAccountType='${paymentAdviceAccountType || 'D'}',CompanyCode='${companyCode || '1710'}')`;
    
    console.log('=== GET LockboxClearing ===');
    console.log('Query params:', queryParams);
    console.log('Entity Key:', entityKey);
    
    try {
        const response = await executeHttpRequest(
            { destinationName: SAP_CONFIG.DESTINATION_NAME },
            {
                method: 'GET',
                url: `/sap/opu/odata/sap/API_LOCKBOXPOST_IN/${entityKey}`,
                params: {
                    'sap-client': SAP_CONFIG.CLIENT
                },
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('SAP Clearing Response Status:', response.status);
        console.log('SAP Clearing Response Data:', JSON.stringify(response.data, null, 2));
        
        return response;
    } catch (error) {
        console.error('Error fetching LockboxClearing with direct key:', error.message);
        
        // Fallback: Try with $filter approach
        console.log('Trying fallback with $filter...');
        let filterParts = [];
        if (paymentAdvice) filterParts.push(`PaymentAdvice eq '${paymentAdvice}'`);
        if (companyCode) filterParts.push(`CompanyCode eq '${companyCode}'`);
        
        const filter = filterParts.join(' and ');
        
        const fallbackResponse = await executeHttpRequest(
            { destinationName: SAP_CONFIG.DESTINATION_NAME },
            {
                method: 'GET',
                url: SAP_CONFIG.CLEARING_PATH,
                params: {
                    'sap-client': SAP_CONFIG.CLIENT,
                    '$filter': filter
                },
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('Fallback Response Status:', fallbackResponse.status);
        return fallbackResponse;
    }
}

/**
 * GET LockboxClearing as raw XML from SAP
 * @param {Object} queryParams - Query parameters
 * @returns {Promise<Object>} Raw XML response
 */
async function getLockboxClearingXml(queryParams) {
    const { paymentAdvice, paymentAdviceItem, paymentAdviceAccount, paymentAdviceAccountType, companyCode } = queryParams;
    
    const entityKey = `LockboxClearing(PaymentAdvice='${paymentAdvice}',PaymentAdviceItem='${paymentAdviceItem || '1'}',PaymentAdviceAccount='${paymentAdviceAccount}',PaymentAdviceAccountType='${paymentAdviceAccountType || 'D'}',CompanyCode='${companyCode || '1710'}')`;
    
    console.log('=== GET LockboxClearing (XML) ===');
    console.log('Entity Key:', entityKey);
    
    try {
        const response = await executeHttpRequest(
            { destinationName: SAP_CONFIG.DESTINATION_NAME },
            {
                method: 'GET',
                url: `/sap/opu/odata/sap/API_LOCKBOXPOST_IN/${entityKey}`,
                params: {
                    'sap-client': SAP_CONFIG.CLIENT
                },
                headers: {
                    'Accept': 'application/atom+xml'
                },
                responseType: 'text'
            }
        );
        
        return response;
    } catch (error) {
        console.error('Error fetching LockboxClearing XML:', error.message);
        throw error;
    }
}

module.exports = {
    getLockboxBatchDetails,
    getLockboxBatchItemDetails,
    getLockboxClearing,
    getLockboxClearingXml
};
