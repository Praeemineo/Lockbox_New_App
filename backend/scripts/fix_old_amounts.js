/**
 * Migration Script: Fix Amount Values in Old Processing Runs
 * 
 * This script recalculates and updates the amount values in the hierarchy
 * for all old processing runs where amounts show as 0 due to the field name
 * mismatch bug (before the fix that handles "Check Amount" vs "CheckAmount").
 * 
 * The bug: Old code looked for row.CheckAmount but data had row["Check Amount"]
 * The fix: Now handles both formats
 * This script: Updates old records to have correct amounts
 */

const fs = require('fs');
const path = require('path');

const RUNS_FILE = path.join(__dirname, '../data/processing_runs.json');
const BACKUP_FILE = path.join(__dirname, '../data/processing_runs_backup_' + Date.now() + '.json');

console.log('='.repeat(80));
console.log('LOCKBOX AMOUNT MIGRATION SCRIPT');
console.log('='.repeat(80));
console.log('');
console.log('This script will:');
console.log('1. Backup the current processing_runs.json');
console.log('2. Recalculate amounts from extractedData for all old runs');
console.log('3. Update hierarchy and sapPayload with correct amounts');
console.log('');

// Load processing runs
let runs;
try {
    const data = fs.readFileSync(RUNS_FILE, 'utf8');
    runs = JSON.parse(data);
    console.log(`✅ Loaded ${runs.length} processing runs`);
} catch (error) {
    console.error('❌ Error loading processing runs:', error.message);
    process.exit(1);
}

// Create backup
try {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(runs, null, 2));
    console.log(`✅ Backup created: ${BACKUP_FILE}`);
} catch (error) {
    console.error('❌ Error creating backup:', error.message);
    process.exit(1);
}

console.log('');
console.log('='.repeat(80));
console.log('PROCESSING RUNS');
console.log('='.repeat(80));

let updatedCount = 0;
let skippedCount = 0;

for (const run of runs) {
    const runId = run.runId || 'Unknown';
    const extractedData = run.extractedData || [];
    
    if (extractedData.length === 0) {
        console.log(`⏭️  ${runId}: No extracted data, skipping`);
        skippedCount++;
        continue;
    }
    
    // Calculate total amount from extractedData
    let totalAmount = 0;
    const itemAmounts = [];
    
    for (const row of extractedData) {
        // Handle both "Check Amount" (with space) and "CheckAmount" (no space)
        const checkAmount = parseFloat(row['Check Amount'] || row.CheckAmount || 0);
        totalAmount += checkAmount;
        
        // Get invoice amount for clearing level
        const invoiceAmount = parseFloat(row['Invoice Amount'] || row.InvoiceAmount || 0);
        
        itemAmounts.push({
            checkAmount,
            invoiceAmount,
            deductionAmount: parseFloat(row['Deduction Amount'] || row.DeductionAmount || 0)
        });
    }
    
    // Check if this run needs updating (has 0 amounts but should have values)
    const currentAmount = run.hierarchy?.[0]?.amount || 0;
    if (currentAmount === 0 && totalAmount > 0) {
        console.log(`🔧 ${runId}: Updating amounts (was 0, should be ${totalAmount.toFixed(2)})`);
        
        // Update hierarchy
        if (run.hierarchy && run.hierarchy.length > 0) {
            run.hierarchy[0].amount = totalAmount;
            
            // Update item amounts
            if (run.hierarchy[0].children) {
                run.hierarchy[0].children.forEach((item, idx) => {
                    if (itemAmounts[idx]) {
                        item.amount = itemAmounts[idx].checkAmount;
                        
                        // Update clearing amounts
                        if (item.children && item.children.length > 0) {
                            item.children.forEach((clearing, clearingIdx) => {
                                if (itemAmounts[idx]) {
                                    clearing.netAmount = itemAmounts[idx].invoiceAmount;
                                    clearing.deductionAmount = itemAmounts[idx].deductionAmount;
                                }
                            });
                        }
                    }
                });
            }
        }
        
        // Update SAP payload
        if (run.sapPayload) {
            run.sapPayload.AmountInTransactionCurrency = totalAmount.toFixed(2);
            
            // Update item amounts in payload
            if (run.sapPayload.to_Item && run.sapPayload.to_Item.results) {
                run.sapPayload.to_Item.results.forEach((item, idx) => {
                    if (itemAmounts[idx]) {
                        item.AmountInTransactionCurrency = itemAmounts[idx].checkAmount.toFixed(2);
                        
                        // Update clearing amounts
                        if (item.to_LockboxClearing && item.to_LockboxClearing.results) {
                            item.to_LockboxClearing.results.forEach((clearing, clearingIdx) => {
                                if (itemAmounts[idx]) {
                                    clearing.NetPaymentAmountInPaytCurrency = itemAmounts[idx].invoiceAmount.toFixed(2);
                                    clearing.DeductionAmountInPaytCurrency = itemAmounts[idx].deductionAmount.toFixed(2);
                                }
                            });
                        }
                    }
                });
            }
        }
        
        // Update mapping stage summary
        if (run.stages && run.stages.mapping) {
            run.stages.mapping.totalAmount = totalAmount.toFixed(2);
        }
        
        updatedCount++;
    } else if (currentAmount > 0) {
        console.log(`✅ ${runId}: Already has correct amount (${currentAmount.toFixed(2)})`);
        skippedCount++;
    } else {
        console.log(`⏭️  ${runId}: Has 0 amount and no extractedData amounts, skipping`);
        skippedCount++;
    }
}

console.log('');
console.log('='.repeat(80));
console.log('MIGRATION COMPLETE');
console.log('='.repeat(80));
console.log(`✅ Updated: ${updatedCount} runs`);
console.log(`⏭️  Skipped: ${skippedCount} runs`);
console.log(`📊 Total: ${runs.length} runs`);

// Save updated runs
try {
    fs.writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2));
    console.log(`✅ Saved updated runs to: ${RUNS_FILE}`);
} catch (error) {
    console.error('❌ Error saving updated runs:', error.message);
    console.log(`⚠️  Backup is available at: ${BACKUP_FILE}`);
    process.exit(1);
}

console.log('');
console.log('🎉 Migration completed successfully!');
console.log(`📁 Backup file: ${BACKUP_FILE}`);
console.log('');
