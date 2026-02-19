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
 * Execute RULE-001: Fetch Accounting Document (BELNR)
 * @param {object} mapping - API mapping configuration
 * @param {array} extractedData - Lockbox data
 * @returns {Promise<object>} - Execution result
 */
async function executeRule001(mapping, extractedData) {
    logger.info('=== Executing RULE-001: Accounting Document Lookup ===');
    
    let recordsEnriched = 0;
    const errors = [];
    
    for (const row of extractedData) {
        // Step 1: Validate Invoice Number
        const invoiceNumber = row.InvoiceNumber || row.PaymentReference;
        
        if (!invoiceNumber || invoiceNumber === '' || invoiceNumber === null) {
            errors.push(`Row ${row._index || 'unknown'}: Invoice Number is NULL`);
            continue;
        }
        
        // Step 2: Check if it's an integer (accounting document format)
        const isInteger = /^\d+$/.test(invoiceNumber.toString());
        if (!isInteger) {
            logger.debug(`Row: InvoiceNumber ${invoiceNumber} is not an integer, skipping BELNR lookup`);
            row.PaymentReference = invoiceNumber; // Use as-is
            recordsEnriched++;
            continue;
        }
        
        // Step 3: Fetch BELNR from SAP
        const companyCode = row.CompanyCode || '1000'; // Default company code
        const fiscalYear = row.FiscalYear || new Date().getFullYear().toString();
        
        logger.info(`RULE-001: Calling SAP API for Invoice ${invoiceNumber}`);
        
        const result = await sapClient.fetchAccountingDocument(
            invoiceNumber,
            companyCode,
            fiscalYear
        );
        
        // Step 4: Update PaymentReference with BELNR
        if (result.success && result.belnr) {
            row.PaymentReference = result.belnr;
            row.BELNR = result.belnr;
            row.CompanyCode = result.companyCode;
            row.FiscalYear = result.fiscalYear;
            row._rule001_status = 'SUCCESS';
            row._rule001_message = `BELNR retrieved: ${result.belnr}`;
            recordsEnriched++;
            
            logger.info(`RULE-001 SUCCESS: Invoice ${invoiceNumber} → BELNR ${result.belnr}`);
        } else {
            // Fallback: Use invoice number as payment reference
            row.PaymentReference = invoiceNumber;
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
 * Execute RULE-002: Fetch Partner Bank Details
 * @param {object} mapping - API mapping configuration
 * @param {array} extractedData - Lockbox data
 * @returns {Promise<object>} - Execution result
 */
async function executeRule002(mapping, extractedData) {
    logger.info('=== Executing RULE-002: Partner Bank Details ===');
    
    let recordsEnriched = 0;
    const warnings = [];
    
    for (const row of extractedData) {
        const businessPartner = row.Customer || row.BusinessPartner;
        
        if (!businessPartner) {
            warnings.push(`Row ${row._index || 'unknown'}: No customer/business partner`);
            continue;
        }
        
        logger.info(`RULE-002: Calling SAP API for Partner ${businessPartner}`);
        
        const result = await sapClient.fetchPartnerBankDetails(businessPartner);
        
        // Update bank details (uses defaults if API fails)
        row.PartnerBank = result.bankCode;
        row.PartnerBankAccount = result.bankAccount;
        row.PartnerBankCountry = result.bankCountry;
        row._rule002_status = result.success ? 'SUCCESS' : 'DEFAULTS_USED';
        row._rule002_message = result.usedDefaults ? 'Used default bank details' : 'Bank details retrieved';
        
        recordsEnriched++;
        
        if (result.usedDefaults) {
            warnings.push(`Partner ${businessPartner}: Used default bank details`);
            logger.warn(`RULE-002: Used defaults for Partner ${businessPartner}`);
        } else {
            logger.info(`RULE-002 SUCCESS: Partner ${businessPartner} bank details retrieved`);
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
 * Execute RULE-003: Fetch Customer Master Data
 * @param {object} mapping - API mapping configuration
 * @param {array} extractedData - Lockbox data
 * @returns {Promise<object>} - Execution result
 */
async function executeRule003(mapping, extractedData) {
    logger.info('=== Executing RULE-003: Customer Master Data ===');
    
    let recordsEnriched = 0;
    
    for (const row of extractedData) {
        const businessPartner = row.Customer || row.BusinessPartner;
        
        if (!businessPartner || row.CustomerName) {
            continue; // Skip if no customer or already has name
        }
        
        logger.info(`RULE-003: Calling SAP API for Customer ${businessPartner}`);
        
        const result = await sapClient.fetchCustomerMasterData(businessPartner);
        
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
 * Execute RULE-004: Open Item Verification
 * @param {object} mapping - API mapping configuration
 * @param {array} extractedData - Lockbox data
 * @returns {Promise<object>} - Execution result
 */
async function executeRule004(mapping, extractedData) {
    logger.info('=== Executing RULE-004: Open Item Verification ===');
    
    let recordsValidated = 0;
    const warnings = [];
    
    for (const row of extractedData) {
        const invoiceNumber = row.PaymentReference || row.BELNR;
        const companyCode = row.CompanyCode || '1000';
        
        if (!invoiceNumber) {
            continue;
        }
        
        logger.info(`RULE-004: Calling SAP API for Open Items ${invoiceNumber}`);
        
        const result = await sapClient.fetchOpenItemDetails(invoiceNumber, companyCode);
        
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
            result = await executeRule002(rule.apiMappings?.[0], extractedData);
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
