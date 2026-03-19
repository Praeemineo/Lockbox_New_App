/**
 * Posting Service
 * Handles SAP posting operations (simulate, post, production)
 */

const sapClient = require('../srv/integrations/sap-client');

// Dependency injection - initialized from server.js
let pool;
let lockboxProcessingRuns;
let runs;
let buildLockboxPayload;
let DEFAULT_COMPANY_CODE;

/**
 * Initialize service with dependencies
 */
function initialize(dependencies) {
    pool = dependencies.pool;
    lockboxProcessingRuns = dependencies.lockboxProcessingRuns;
    runs = dependencies.runs;
    buildLockboxPayload = dependencies.buildLockboxPayload;
    DEFAULT_COMPANY_CODE = dependencies.DEFAULT_COMPANY_CODE || '1710';
}

/**
 * Simulate posting - Preview only, no SAP commit
 * GET/POST /api/lockbox/simulate/:headerId
 */
async function simulatePosting(req, res) {
    try {
        const { headerId } = req.params;
        
        // Get header
        const headerResult = await pool.query('SELECT * FROM lockbox_header WHERE id = $1', [headerId]);
        if (headerResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Header not found' });
        }
        const header = headerResult.rows[0];
        
        // Check if already posted
        if (header.status === 'POSTED') {
            return res.status(400).json({ 
                success: false, 
                message: 'This lockbox has already been posted to SAP. Cannot simulate again.',
                sap_document_number: header.sap_document_num 
            });
        }
        
        // Build payload from database
        const payload = await buildLockboxPayload(headerId, pool);
        
        console.log('=== SIMULATION (Preview Only - No SAP Commit) ===');
        console.log(JSON.stringify(payload, null, 2));
        
        // Get items and clearing data for preview
        const items = (await pool.query(
            'SELECT * FROM lockbox_item WHERE header_id = $1 ORDER BY lockbox_batch, lockbox_batch_item', 
            [headerId]
        )).rows;
        
        // Calculate totals for preview
        let totalItems = items.length;
        let totalAmount = 0;
        let clearingProposal = [];
        
        for (const item of items) {
            totalAmount += parseFloat(item.amount_in_transaction_currency) || 0;
            
            // Get clearing entries for this item
            const clearings = (await pool.query(
                'SELECT * FROM lockbox_clearing WHERE item_id = $1 ORDER BY payment_reference', 
                [item.id]
            )).rows;
            
            clearingProposal.push({
                lockboxBatch: item.lockbox_batch,
                lockboxBatchItem: item.lockbox_batch_item,
                cheque: item.cheque,
                amount: item.amount_in_transaction_currency,
                currency: item.currency,
                partnerBank: item.partner_bank,
                partnerBankAccount: item.partner_bank_account,
                clearingItems: clearings.map(c => ({
                    paymentReference: c.payment_reference,
                    netAmount: c.net_payment_amount,
                    deductionAmount: c.deduction_amount,
                    reason: c.payment_difference_reason
                }))
            });
        }
        
        // Build clearing proposal text for display
        let clearingProposalText = clearingProposal.map((item, idx) => 
            `  Item ${idx + 1}: Batch ${item.lockboxBatch}, Cheque ${item.cheque}, Amount: ${item.amount} ${item.currency}`
        ).join('\n');
        
        // Build formatted SAP response message
        const currency = items[0]?.currency || 'USD';
        const sapResponseMessage = `
═══════════════════════════════════════════════════════════════
                    SIMULATION PREVIEW
═══════════════════════════════════════════════════════════════

📋 DERIVED PAYMENT ADVICE (Preview)
   Payment Advice: PA-${header.lockbox}-PREVIEW
   Company Code: ${DEFAULT_COMPANY_CODE}
   Lockbox: ${payload.Lockbox}

📊 CLEARING PROPOSAL (from uploaded data)
${clearingProposalText}

💰 EXPECTED GL POSTINGS SUMMARY
   Company Code: ${DEFAULT_COMPANY_CODE}
   Number of Items: ${totalItems}
   Total Amount: ${totalAmount.toFixed(2)} ${currency}

📦 NUMBER OF ITEMS & AMOUNTS
   Total Cheques/Items: ${totalItems}
   Total Amount: ${totalAmount.toFixed(2)} ${currency}

📤 PAYLOAD TO BE SENT TO SAP
   Lockbox: ${payload.Lockbox}
   Deposit DateTime: ${payload.DepositDateTime || 'N/A'}
   Amount: ${payload.AmountInTransactionCurrency}
   Origin: ${payload.LockboxBatchOrigin || 'N/A'}
   Destination: ${payload.LockboxBatchDestination || 'N/A'}
   Items Count: ${payload.to_Item?.results?.length || 0}

═══════════════════════════════════════════════════════════════
⚠️  This is a PREVIEW only. No data has been sent to SAP.
    Click "Production Run" to commit this lockbox to SAP.
═══════════════════════════════════════════════════════════════
`;

        // Build simulation preview response (NO SAP call)
        const simulationPreview = {
            simulation: true,
            status: 'SUCCESS',
            message: 'Simulation preview ready. Click Production Run to commit to SAP.',
            sapResponseMessage: sapResponseMessage,
            derivedPaymentAdvice: `PA-${header.lockbox}-PREVIEW`,
            clearingProposal: clearingProposal,
            expectedGLPostings: {
                companyCode: DEFAULT_COMPANY_CODE,
                lockbox: payload.Lockbox,
                totalItems: totalItems,
                totalAmount: totalAmount.toFixed(2),
                currency: currency
            },
            numberOfItems: totalItems,
            amountInTransactionCurrency: totalAmount.toFixed(2),
            sapPayload: payload
        };
        
        // Store payload temporarily in database (for Production Run to use)
        await pool.query(
            `UPDATE lockbox_header 
             SET status = $1, sap_payload = $2, sap_simulation_response = $3 
             WHERE id = $4`,
            ['SIMULATED', JSON.stringify(payload), JSON.stringify(simulationPreview), headerId]
        );
        
        res.json({
            success: true,
            message: simulationPreview.message,
            lockbox: header.lockbox,
            simulation_result: simulationPreview,
            sap_response_message: sapResponseMessage
        });
        
    } catch (err) {
        console.error('Simulate error:', err);
        res.status(500).json({ success: false, message: 'Simulation failed: ' + err.message });
    }
}

/**
 * Production posting - Actually commit to SAP
 * POST /api/lockbox/post/:headerId
 */
async function productionPosting(req, res) {
    // TODO: Extract from server.js (lines 2039-2690)
    res.status(501).json({ 
        success: false, 
        message: 'Production posting - Implementation being migrated from server.js' 
    });
}

/**
 * Run-based simulate
 * POST /api/lockbox/runs/:runId/simulate
 */
async function simulateRun(req, res) {
    // TODO: Extract from server.js (lines 8791-9138)
    res.status(501).json({ 
        success: false, 
        message: 'Run simulate - Implementation being migrated from server.js' 
    });
}

/**
 * Run-based repost
 * POST /api/lockbox/runs/:runId/repost
 */
async function repostRun(req, res) {
    // TODO: Extract from server.js (lines 9139-9219)
    res.status(501).json({ 
        success: false, 
        message: 'Run repost - Implementation being migrated from server.js' 
    });
}

/**
 * Run-based production
 * POST /api/lockbox/runs/:runId/production
 */
async function productionRun(req, res) {
    // TODO: Extract from server.js (lines 9220-9942)
    res.status(501).json({ 
        success: false, 
        message: 'Run production - Implementation being migrated from server.js' 
    });
}

/**
 * Get production result
 * GET /api/lockbox/runs/:runId/production-result
 */
async function getProductionResult(req, res) {
    const { runId } = req.params;
    
    // Find run in memory storage
    let run = lockboxProcessingRuns.find(r => r.runId === runId);
    if (!run) {
        run = runs.find(r => r.runId === runId);
    }
    
    if (!run) {
        return res.status(404).json({ success: false, message: 'Run not found' });
    }
    
    res.json({
        success: true,
        runId: run.runId,
        status: run.status,
        productionResult: run.productionResult || null,
        sapResponse: run.sapResponse || null
    });
}

module.exports = {
    initialize,
    simulatePosting,
    productionPosting,
    simulateRun,
    repostRun,
    productionRun,
    getProductionResult
};
