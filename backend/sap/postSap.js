/**
 * SAP POST Operations
 * Handles all SAP POST requests via BTP Destination
 */

const { SAP_CONFIG, executeHttpRequest } = require('./sapService');

/**
 * POST LockboxBatch to SAP
 * Creates a new lockbox batch and triggers SAP processing
 * @param {Object} payload - Lockbox batch payload
 * @returns {Promise<Object>} SAP response with LockboxBatchInternalKey
 */
async function postToSapApi(payload) {
    const url = SAP_CONFIG.API_PATH;
    
    console.log('=== SAP API CALL (BTP Destination) ===');
    console.log('Destination:', SAP_CONFIG.DESTINATION_NAME);
    console.log('URL:', url);
    console.log('sap-client:', SAP_CONFIG.CLIENT);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    try {
        const response = await executeHttpRequest(
            { destinationName: SAP_CONFIG.DESTINATION_NAME },
            {
                method: 'POST',
                url: url,
                params: {
                    'sap-client': SAP_CONFIG.CLIENT
                },
                data: payload,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('SAP Response Status:', response.status);
        console.log('SAP Response Data:', JSON.stringify(response.data, null, 2));
        
        return response;
    } catch (error) {
        console.error('SAP API Error:', error.message);
        
        // Log detailed error response from SAP
        if (error.response) {
            console.error('SAP Response Status:', error.response.status);
            console.error('SAP Response Headers:', JSON.stringify(error.response.headers, null, 2));
            console.error('SAP Response Data:', JSON.stringify(error.response.data, null, 2));
        }
        
        if (error.rootCause) {
            console.error('Root Cause:', error.rootCause.message);
            if (error.rootCause.response) {
                console.error('Root Cause Response Status:', error.rootCause.response.status);
                console.error('Root Cause Response Data:', JSON.stringify(error.rootCause.response.data, null, 2));
            }
        }
        
        throw error;
    }
}

/**
 * Build SAP Lockbox payload from header ID
 * Constructs the complete payload structure from database
 * @param {string} headerId - Lockbox header ID
 * @param {Object} pool - PostgreSQL connection pool
 * @returns {Promise<Object>} Complete SAP payload
 */
async function buildLockboxPayload(headerId, pool) {
    // Get header data
    const header = (await pool.query('SELECT * FROM lockbox_header WHERE id = $1', [headerId])).rows[0];
    if (!header) {
        throw new Error(`Header ${headerId} not found`);
    }
    
    // Get items with their clearings
    const items = (await pool.query('SELECT * FROM lockbox_item WHERE header_id = $1 ORDER BY lockbox_batch, lockbox_batch_item', [headerId])).rows;
    
    // Build items array
    const itemsArray = [];
    for (const item of items) {
        const clearings = (await pool.query('SELECT * FROM lockbox_clearing WHERE item_id = $1 ORDER BY payment_reference', [item.id])).rows;
        
        const itemObj = {
            LockboxBatch: item.lockbox_batch || '001',
            LockboxBatchItem: item.lockbox_batch_item || '001',
            AmountInTransactionCurrency: String(item.amount_in_transaction_currency || 0),
            Currency: item.currency || 'USD',
            Cheque: item.cheque || '',
            PartnerBank: item.partner_bank || '',
            PartnerBankAccount: item.partner_bank_account || '',
            PartnerBankCountry: item.partner_bank_country || ''
        };
        
        if (clearings.length > 0) {
            itemObj.to_LockboxClearing = {
                results: clearings.map(c => ({
                    PaymentReference: c.payment_reference || '',
                    NetPaymentAmountInPaytCurrency: String(c.net_payment_amount_in_payt_currency || 0),
                    DeductionAmountInPaytCurrency: String(c.deduction_amount_in_payt_currency || 0),
                    PaymentDifferenceReason: c.payment_difference_reason || '',
                    Currency: c.currency || 'USD'
                }))
            };
        }
        
        itemsArray.push(itemObj);
    }
    
    // Build complete payload
    const payload = {
        Lockbox: header.lockbox || '1234',
        DepositDateTime: header.deposit_date_time || new Date().toISOString(),
        AmountInTransactionCurrency: String(header.amount_in_transaction_currency || 0),
        LockboxBatchOrigin: header.lockbox_batch_origin || 'EMERGENT',
        LockboxBatchDestination: header.lockbox_batch_destination || 'LOCKBOXDES',
        to_Item: {
            results: itemsArray
        }
    };
    
    return payload;
}

module.exports = {
    postToSapApi,
    buildLockboxPayload
};
