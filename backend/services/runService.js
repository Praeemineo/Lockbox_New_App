/**
 * Run Service
 * Business logic for run management
 */

const { getPool } = require('./postgresService');
const sapClient = require('../srv/integrations/sap-client');

// In-memory storage (should migrate to proper DB queries)
let lockboxProcessingRuns = [];
let runs = [];
let processingRules = [];

/**
 * Initialize service with data from server.js
 * TODO: Remove this once we have proper DB queries
 */
function initialize(data) {
    lockboxProcessingRuns = data.lockboxProcessingRuns || [];
    runs = data.runs || [];
    processingRules = data.processingRules || [];
}

/**
 * Get all processing runs
 * TODO: Extract full logic from server.js
 */
async function getAllRuns(req, res) {
    res.status(501).json({ message: 'Implementation pending - being migrated from server.js' });
}

/**
 * Get run by ID
 * TODO: Extract full logic from server.js
 */
async function getRunById(req, res) {
    res.status(501).json({ message: 'Implementation pending - being migrated from server.js' });
}

/**
 * RULE-004: Get Accounting Document
 * Fetch accounting document details from SAP for a specific lockbox run
 * Architecture: Pure pass-through (no BTP storage)
 */
async function getAccountingDocument(req, res) {
    const { runId } = req.params;
    
    console.log(`📋 RULE-004: Fetching accounting document for run ${runId} (always fresh from SAP)`);
    
    try {
        // STEP 1: Get run data from BTP to extract LockboxId
        let run = lockboxProcessingRuns.find(r => r.runId === runId);
        
        if (!run) {
            run = runs.find(r => r.runId === runId);
        }
        
        if (!run) {
            return res.status(404).json({ 
                success: false, 
                error: 'Run not found in BTP' 
            });
        }
        
        // STEP 2: Extract LockboxID from BTP run data (comprehensive search)
        let lockboxId = 
            run.lockboxId ||
            run.lockbox ||
            run.lockbox_id ||
            run.lockboxBatchOrigin ||
            run.lockbox_batch_origin ||
            (run.sapPayload && run.sapPayload.Lockbox) ||
            (run.sapPayload && run.sapPayload.LockboxBatchOrigin) ||
            (run.header && run.header.lockbox) ||
            (run.header && run.header.lockbox_id) ||
            (run.mappedData && run.mappedData[0] && run.mappedData[0]['Lockbox ID']) ||
            (run.mappedData && run.mappedData[0] && run.mappedData[0]['LockboxId']) ||
            (run.mappedData && run.mappedData[0] && run.mappedData[0]['lockboxId']);
        
        if (!lockboxId) {
            console.error(`   ❌ No LockboxID found in BTP run`);
            return res.status(400).json({
                success: false,
                error: 'LockboxID not found in BTP run data',
                runId: runId
            });
        }
        
        // STEP 3: Strip hyphen and suffix from lockboxId
        if (lockboxId && typeof lockboxId === 'string' && lockboxId.includes('-')) {
            const originalLockboxId = lockboxId;
            lockboxId = lockboxId.split('-')[0];
            console.log(`   📝 Mapped BTP LockboxId to SAP format: "${originalLockboxId}" → "${lockboxId}"`);
        }
        
        console.log(`   ✅ Using LockboxId: ${lockboxId} for SAP query`);
        
        // STEP 4: Get RULE-004 configuration
        const rule004 = processingRules.find(r => r.ruleId === 'RULE-004');
        
        if (!rule004 || !rule004.active) {
            return res.status(404).json({ 
                success: false, 
                error: 'RULE-004 not found or not active' 
            });
        }
        
        // STEP 5: Build SAP API query
        const apiMapping = rule004.apiMappings[0];
        let apiEndpoint = apiMapping.apiReference;
        
        // Clean any hardcoded filters
        if (apiEndpoint.includes('?')) {
            apiEndpoint = apiEndpoint.split('?')[0];
            console.log(`   🔧 Cleaned apiReference (removed hardcoded parameters)`);
        }
        
        const queryParams = {
            '$filter': `LockBoxId eq '${lockboxId}'`
        };
        
        console.log(`   🔄 Fetching fresh data from SAP (no BTP storage)`);
        console.log(`   📍 SAP API Endpoint: ${apiEndpoint}`);
        
        // STEP 6: Call SAP API with direct connection
        let response;
        try {
            console.log(`   📞 Calling SAP API DIRECTLY via environment variables...`);
            response = await sapClient.executeSapGetRequest(
                null,
                apiEndpoint,
                queryParams,
                true  // forceDirect = true
            );
            console.log(`   ✅ SAP Response received successfully`);
        } catch (error) {
            console.error(`   ❌ RULE-004 SAP API call failed:`, {
                error: error.message,
                lockboxId: lockboxId,
                statusCode: error.response?.status
            });
            
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch accounting documents from SAP',
                details: error.message,
                lockboxId: lockboxId
            });
        }
        
        // STEP 7: Format SAP response
        const documents = response.data.value || [];
        console.log(`   📊 SAP returned ${documents.length} document(s)`);
        
        // Log full response for debugging
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📋 RULE-004 SAP RESPONSE VALUES:`);
        console.log(`${'='.repeat(80)}`);
        console.log(`🔍 LockboxId used in query: ${lockboxId}`);
        console.log(`📥 Full SAP Response:`);
        console.log(JSON.stringify(response.data, null, 2));
        console.log(`\n📊 Documents Summary:`);
        documents.forEach((doc, idx) => {
            console.log(`\n   ========== Document ${idx + 1} ==========`);
            console.log(`   🏦 LockBoxId: ${doc.LockBoxId || 'N/A'}`);
            console.log(`   🏢 Sending Bank: ${doc.SendingBank || 'N/A'}`);
            console.log(`   📄 Bank Statement: ${doc.BankStatement || 'N/A'}`);
            console.log(`   🔖 Statement ID: ${doc.StatementId || 'N/A'}`);
            console.log(`   🏛️  Company Code: ${doc.CompanyCode || 'N/A'}`);
            console.log(`   ✅ Header Status: ${doc.HeaderStatus || 'N/A'}`);
            console.log(`   📝 Document Number: ${doc.DocumentNumber || 'N/A'}`);
            console.log(`   💰 Amount: ${doc.Amount || 0}`);
            console.log(`   ==============================`);
        });
        console.log(`${'='.repeat(80)}\n`);
        
        const mappedData = documents.map((doc, index) => {
            console.log(`   📄 Document ${index + 1} field mapping:`);
            console.log(`      SubledgerDocument: "${doc.SubledgerDocument || ''}"`);
            console.log(`      SubledgerOnAccountDocument: "${doc.SubledgerOnAccountDocument || ''}" (capital A)`);
            console.log(`      SubledgerOnaccountDocument: "${doc.SubledgerOnaccountDocument || ''}" (lowercase a)`);
            console.log(`      DocumentNumber: "${doc.DocumentNumber || ''}"`);
            console.log(`      PaymentAdvice: "${doc.PaymentAdvice || ''}"`);
            
            return {
                item: (index + 1).toString(),
                LockBoxId: doc.LockBoxId || '',
                SendingBank: doc.SendingBank || '',
                BankStatement: doc.BankStatement || '',
                StatementId: doc.StatementId || '',
                CompanyCode: doc.CompanyCode || '',
                HeaderStatus: doc.HeaderStatus || '',
                BankStatementItem: doc.BankStatementItem || '',
                DocumentNumber: doc.DocumentNumber || '',
                PaymentAdvice: doc.PaymentAdvice || '',
                SubledgerDocument: doc.SubledgerDocument || '',
                SubledgerOnaccountDocument: doc.SubledgerOnAccountDocument || doc.SubledgerOnaccountDocument || '', // Try both casings
                Amount: doc.Amount || 0,
                TransactionCurrency: doc.TransactionCurrency || 'USD',
                DocumentStatus: doc.DocumentStatus || ''
            };
        });
        
        // STEP 8: Return data to UI (no BTP storage)
        console.log(`   ✅ Returning ${mappedData.length} documents to UI (pass-through architecture)`);
        
        res.json({
            success: true,
            lockboxId: lockboxId,
            documents: mappedData,
            count: mappedData.length,
            source: 'sap',
            fetchedAt: new Date().toISOString(),
            architecture: 'pass-through'
        });
        
    } catch (error) {
        console.error('❌ RULE-004 Error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}

module.exports = {
    initialize,
    getAllRuns,
    getRunById,
    getAccountingDocument
};
