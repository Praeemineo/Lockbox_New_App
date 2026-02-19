/**
 * Rule Execution Engine
 * Dynamically executes processing rules based on conditions and API mappings
 * 
 * ⚠️ NEW CODE LOCATION: All rule execution logic goes HERE, not in server.js
 */

const sapClient = require('../integrations/sap-client');
const dataModels = require('../models/data-models');
const logger = require('../utils/logger');

/**
 * Check if rule condition is met
 * @param {object} condition - Rule condition from processing_rules.json
 * @param {array} extractedData - Extracted lockbox data
 * @param {object} patternResult - Pattern detection result
 * @returns {boolean} - True if condition is met
 */
function checkRuleCondition(condition, extractedData, patternResult) {
    const docFormat = (condition.documentFormat || condition.fieldName || '').toLowerCase();
    const conditionValue = (condition.condition || condition.value || '').toLowerCase();
    
    // Check if document format exists in the data
    if (docFormat) {
        const hasField = extractedData.some(row => {
            const keys = Object.keys(row).map(k => k.toLowerCase());
            return keys.some(k => k.includes(docFormat));
        });
        
        if (hasField) return true;
    }
    
    // Check condition value against pattern analysis
    if (conditionValue) {
        if (conditionValue.includes('single') && conditionValue.includes('check')) {
            return patternResult.analysis?.checkUnique === true;
        }
        if (conditionValue.includes('multiple') && conditionValue.includes('check')) {
            return patternResult.analysis?.checkUnique === false;
        }
    }
    
    // Default: condition is met
    return true;
}

/**
 * Execute RULE-001: Fetch Accounting Document (BELNR) - DYNAMIC
 * @param {object} mapping - API mapping configuration from rule
 * @param {array} extractedData - Lockbox data
 * @returns {Promise<object>} - Execution result
 */
async function executeRule001(mapping, extractedData) {
    logger.info('=== Executing RULE-001: Accounting Document Lookup (DYNAMIC) ===');
    logger.info(`API Mapping: ${mapping?.apiReference}`);
    
    let recordsEnriched = 0;
    const errors = [];
    
    for (const row of extractedData) {
        // Step 1: Get Invoice Number from uploaded file (as per mapping.sourceInput)
        const invoiceNumber = row.InvoiceNumber || row.Invoice;
        
        if (!invoiceNumber || invoiceNumber === '' || invoiceNumber === null) {
            errors.push(`Row ${row._index || 'unknown'}: Invoice Number is NULL`);
            continue;
        }
        
        logger.info(`RULE-001: Calling SAP API (DYNAMIC) for Invoice ${invoiceNumber}`);
        
        // Step 2: Fetch BELNR from SAP using DYNAMIC API mapping
        const companyCode = row.CompanyCode || '1000'; // Default company code
        const fiscalYear = row.FiscalYear || new Date().getFullYear().toString();
        
        // ⚡ DYNAMIC: Pass apiMapping as first parameter
        const result = await sapClient.fetchAccountingDocument(
            mapping,
            invoiceNumber,
            companyCode,
            fiscalYear
        );
        
        // Step 3: Update Paymentreference with BELNR
        if (result.success && result.belnr) {
            row.Paymentreference = result.belnr;
            row.BELNR = result.belnr;
            row.CompanyCode = result.companyCode;
            row.FiscalYear = result.fiscalYear;
            row._rule001_status = 'SUCCESS';
            row._rule001_message = `BELNR retrieved: ${result.belnr}`;
            recordsEnriched++;
            
            logger.info(`RULE-001 SUCCESS: Invoice ${invoiceNumber} → BELNR ${result.belnr}`);
        } else {
            // Fallback: Mark as failed
            row._rule001_status = 'FAILED';
            row._rule001_message = result.error || 'BELNR not found';
            errors.push(`Invoice ${invoiceNumber}: ${result.error}`);
            
            logger.warn(`RULE-001 FAILED: Invoice ${invoiceNumber} - ${result.error}`);
        }
    }
    
    return {
        success: true,
        recordsEnriched,
        errors,
        message: `RULE-001: Enriched ${recordsEnriched} records, ${errors.length} errors`
    };
}

/**
 * Execute RULE-002: Fetch Partner Bank Details - DYNAMIC
 * @param {array|object} mappings - API mapping(s) configuration from rule (can be array or single object)
 * @param {array} extractedData - Lockbox data
 * @returns {Promise<object>} - Execution result
 */
async function executeRule002(mappings, extractedData) {
    logger.info('=== Executing RULE-002: Partner Bank Details (DYNAMIC) ===');
    const firstMapping = Array.isArray(mappings) ? mappings[0] : mappings;
    logger.info(`API Mapping: ${firstMapping?.apiReference}`);
    logger.info(`Fetching fields: BankNumber (PartnerBank), BankAccount (PartnerBankAccount), BankCountryKey (PartnerBankCountry)`);
    logger.info(`Filter Condition: BankIdentification = ${firstMapping?.filterConditions?.BankIdentification || 'None'}`);
    
    let recordsEnriched = 0;
    const warnings = [];
    
    for (const row of extractedData) {
        // Check multiple field name variations for customer number
        const businessPartner = row.Customer || 
                                row.CustomerNumber || 
                                row['Customer Number'] ||  // Handle space in field name
                                row.BusinessPartner;
        
        if (!businessPartner) {
            warnings.push(`Row ${row._index || 'unknown'}: No customer/business partner found (checked: Customer, CustomerNumber, Customer Number, BusinessPartner)`);
            continue;
        }
        
        logger.info(`RULE-002: Calling SAP API (DYNAMIC) for Partner ${businessPartner}`);
        
        // ⚡ DYNAMIC: Pass apiMappings array (or single mapping) as first parameter
        const result = await sapClient.fetchPartnerBankDetails(mappings, businessPartner);
        
        // Update bank details with correct field names (uses defaults if API fails)
        row.PartnerBank = result.PartnerBank;
        row.PartnerBankAccount = result.PartnerBankAccount;
        row.PartnerBankCountry = result.PartnerBankCountry;
        row._rule002_status = result.success ? 'SUCCESS' : 'DEFAULTS_USED';
        row._rule002_message = result.usedDefaults ? 'Used default bank details' : 'Bank details retrieved';
        
        recordsEnriched++;
        
        if (result.usedDefaults) {
            warnings.push(`Partner ${businessPartner}: Used default bank details`);
            logger.warn(`RULE-002: Used defaults for Partner ${businessPartner}`);
        } else {
            logger.info(`RULE-002 SUCCESS: Partner ${businessPartner} bank details retrieved`);
            logger.info(`  → PartnerBank (BANKS): ${result.PartnerBank}`);
            logger.info(`  → PartnerBankAccount (BANKL): ${result.PartnerBankAccount}`);
            logger.info(`  → PartnerBankCountry (BANKN): ${result.PartnerBankCountry}`);
        }
    }
    
    return {
        success: true,
        recordsEnriched,
        warnings,
        message: `RULE-002: Enriched ${recordsEnriched} records, ${warnings.length} used defaults`
    };
}

/**
 * Execute RULE-003: Fetch Customer Master Data - DYNAMIC
 * @param {object} mapping - API mapping configuration from rule
 * @param {array} extractedData - Lockbox data
 * @returns {Promise<object>} - Execution result
 */
async function executeRule003(mapping, extractedData) {
    logger.info('=== Executing RULE-003: Customer Master Data (DYNAMIC) ===');
    logger.info(`API Mapping: ${mapping?.apiReference}`);
    
    let recordsEnriched = 0;
    
    for (const row of extractedData) {
        const businessPartner = row.Customer || row.BusinessPartner;
        
        if (!businessPartner || row.CustomerName) {
            continue; // Skip if no customer or already has name
        }
        
        logger.info(`RULE-003: Calling SAP API (DYNAMIC) for Customer ${businessPartner}`);
        
        // ⚡ DYNAMIC: Pass apiMapping as first parameter
        const result = await sapClient.fetchCustomerMasterData(mapping, businessPartner);
        
        row.CustomerName = result.customerName;
        row.CustomerType = result.customerType;
        row.CustomerCategory = result.customerCategory;
        row._rule003_status = result.success ? 'SUCCESS' : 'FAILED';
        
        recordsEnriched++;
        
        logger.info(`RULE-003: Customer ${businessPartner} data ${result.success ? 'retrieved' : 'not found'}`);
    }
    
    return {
        success: true,
        recordsEnriched,
        message: `RULE-003: Enriched ${recordsEnriched} records`
    };
}

/**
 * Execute RULE-004: Open Item Verification - DYNAMIC
 * @param {object} mapping - API mapping configuration from rule
 * @param {array} extractedData - Lockbox data
 * @returns {Promise<object>} - Execution result
 */
async function executeRule004(mapping, extractedData) {
    logger.info('=== Executing RULE-004: Open Item Verification (DYNAMIC) ===');
    logger.info(`API Mapping: ${mapping?.apiReference}`);
    
    let recordsValidated = 0;
    const warnings = [];
    
    for (const row of extractedData) {
        const invoiceNumber = row.PaymentReference || row.BELNR;
        const companyCode = row.CompanyCode || '1000';
        
        if (!invoiceNumber) {
            continue;
        }
        
        logger.info(`RULE-004: Calling SAP API (DYNAMIC) for Open Items ${invoiceNumber}`);
        
        // ⚡ DYNAMIC: Pass apiMapping as first parameter
        const result = await sapClient.fetchOpenItemDetails(mapping, invoiceNumber, companyCode);
        
        row._openItemValidated = result.validated;
        row._rule004_status = result.success ? 'SUCCESS' : 'FAILED';
        
        if (result.success) {
            // Check for amount mismatch
            const invoiceAmount = parseFloat(row.InvoiceAmount || row.Amount || 0);
            const openAmount = parseFloat(result.openAmount || 0);
            const diff = Math.abs(invoiceAmount - openAmount);
            
            if (diff > 0.01) { // Allow 1 cent tolerance
                warnings.push(`Invoice ${invoiceNumber}: Amount mismatch (File: ${invoiceAmount}, SAP: ${openAmount})`);
                row._amountMismatch = true;
                row._expectedAmount = openAmount;
            }
            
            recordsValidated++;
        }
        
        logger.info(`RULE-004: Invoice ${invoiceNumber} ${result.validated ? 'validated' : 'not found'}`);
    }
    
    return {
        success: true,
        recordsValidated,
        warnings,
        message: `RULE-004: Validated ${recordsValidated} records, ${warnings.length} warnings`
    };
}

/**
 * Execute a single rule dynamically
 * @param {object} rule - Processing rule from processing_rules.json
 * @param {array} extractedData - Lockbox data
 * @param {object} patternResult - Pattern detection result
 * @returns {Promise<object>} - Execution result
 */
async function executeRule(rule, extractedData, patternResult) {
    logger.info(`\n--- Executing ${rule.ruleId}: ${rule.ruleName} ---`);
    
    const ruleLog = {
        ruleId: rule.ruleId,
        ruleName: rule.ruleName,
        conditionsChecked: 0,
        conditionsMet: 0,
        apiCallsMade: 0,
        recordsEnriched: 0,
        errors: [],
        warnings: []
    };
    
    // Check rule conditions
    let ruleApplies = true;
    if (rule.conditions && Array.isArray(rule.conditions)) {
        for (const condition of rule.conditions) {
            ruleLog.conditionsChecked++;
            const conditionMet = checkRuleCondition(condition, extractedData, patternResult);
            if (conditionMet) {
                ruleLog.conditionsMet++;
                logger.info(`  ✓ Condition met: ${condition.documentFormat} - ${condition.condition}`);
            } else {
                logger.info(`  ✗ Condition not met: ${condition.documentFormat} - ${condition.condition}`);
            }
        }
        
        const conditionMatchRate = rule.conditions.length > 0 
            ? ruleLog.conditionsMet / rule.conditions.length 
            : 1;
        ruleApplies = conditionMatchRate >= 0.5; // At least 50% conditions must match
    }
    
    if (!ruleApplies) {
        logger.info(`  ⊘ Rule ${rule.ruleId} skipped - conditions not met`);
        ruleLog.warnings.push('Rule skipped - conditions not met');
        return ruleLog;
    }
    
    // Execute rule based on rule ID
    let result;
    
    switch (rule.ruleId) {
        case 'RULE-001':
            result = await executeRule001(rule.apiMappings?.[0], extractedData);
            break;
        case 'RULE-002':
            // Pass all apiMappings for multiple field retrieval (BANKS, BANKL, BANKN)
            result = await executeRule002(rule.apiMappings, extractedData);
            break;
        case 'RULE-003':
            result = await executeRule003(rule.apiMappings?.[0], extractedData);
            break;
        case 'RULE-004':
            result = await executeRule004(rule.apiMappings?.[0], extractedData);
            break;
        default:
            logger.warn(`No execution handler for ${rule.ruleId}`);
            result = { success: false, message: 'No handler found' };
    }
    
    ruleLog.recordsEnriched = result.recordsEnriched || result.recordsValidated || 0;
    ruleLog.errors = result.errors || [];
    ruleLog.warnings = result.warnings || [];
    ruleLog.apiCallsMade = ruleLog.recordsEnriched; // Approximate
    
    logger.info(`  ✓ ${rule.ruleId} complete: ${result.message}`);
    
    return ruleLog;
}

/**
 * Execute all active processing rules
 * @param {array} extractedData - Lockbox data
 * @param {object} patternResult - Pattern detection result
 * @returns {Promise<object>} - Execution summary
 */
async function executeAllRules(extractedData, patternResult) {
    logger.info('=== VALIDATION & RULE EXECUTION (DYNAMIC) ===');
    
    const activeRules = dataModels.getActiveProcessingRules();
    logger.info(`Found ${activeRules.length} active processing rules to execute`);
    
    const ruleExecutionLogs = [];
    
    for (const rule of activeRules) {
        const ruleLog = await executeRule(rule, extractedData, patternResult);
        ruleExecutionLogs.push(ruleLog);
    }
    
    const totalRecordsEnriched = ruleExecutionLogs.reduce((sum, log) => sum + log.recordsEnriched, 0);
    const rulesExecuted = ruleExecutionLogs.filter(log => log.conditionsMet > 0).length;
    const totalWarnings = ruleExecutionLogs.reduce((sum, log) => sum + log.warnings.length, 0);
    const totalErrors = ruleExecutionLogs.reduce((sum, log) => sum + log.errors.length, 0);
    
    logger.info(`\n✓ Validation complete. Rules executed: ${rulesExecuted}/${activeRules.length}, Records enriched: ${totalRecordsEnriched}`);
    
    return {
        success: true,
        rulesExecuted,
        totalRules: activeRules.length,
        recordsEnriched: totalRecordsEnriched,
        warnings: totalWarnings,
        errors: totalErrors,
        ruleExecutionLogs
    };
}

module.exports = {
    checkRuleCondition,
    executeRule,
    executeAllRules,
    executeRule001,
    executeRule002,
    executeRule003,
    executeRule004
};
