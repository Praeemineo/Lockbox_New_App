#!/usr/bin/env node

/**
 * Test RULE-001 and RULE-002 API Calls
 * Tests with Invoice Number: 90003904 and Customer Number: 17100009
 */

const ruleEngine = require('/app/backend/srv/handlers/rule-engine.js');

// Test data simulating Excel upload
const testData = [
  {
    "Invoice Number": "90003904",
    "Customer Number": "17100009",
    "Amount": "1000.00"
  }
];

console.log('='.repeat(80));
console.log('TESTING RULE-001 and RULE-002 with Specific Values');
console.log('='.repeat(80));
console.log('Invoice Number: 90003904');
console.log('Customer Number: 17100009');
console.log('='.repeat(80));

// Test the rule engine
(async () => {
  try {
    const result = await ruleEngine.processLockboxRules(testData, 'EXCEL');
    
    console.log('\n' + '='.repeat(80));
    console.log('TEST RESULTS');
    console.log('='.repeat(80));
    console.log('Rules Executed:', result.rulesExecuted.join(', '));
    console.log('Records Enriched:', result.recordsEnriched);
    console.log('Errors:', result.errors.length);
    console.log('Warnings:', result.warnings.length);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(err => console.log('  -', err));
    }
    
    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach(warn => console.log('  -', warn));
    }
    
    console.log('\nEnriched Data:');
    console.log(JSON.stringify(result.enrichedData, null, 2));
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('Test failed:', error);
    console.error(error.stack);
  }
})();
