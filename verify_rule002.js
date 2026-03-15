#!/usr/bin/env node

/**
 * Verify RULE-002 configuration is loaded correctly
 */

const fs = require('fs');

// Load processing rules
const rulesData = JSON.parse(fs.readFileSync('/app/backend/data/processing_rules.json', 'utf8'));

console.log('='.repeat(80));
console.log('VERIFYING RULE-002 CONFIGURATION');
console.log('='.repeat(80));

// Find RULE-002
const rule002 = rulesData.find(r => r.ruleId === 'RULE-002');

if (rule002) {
    console.log('\n✅ RULE-002 Found');
    console.log('\nField Mappings:');
    rule002.fieldMappings.forEach((fm, idx) => {
        console.log(`\n  Mapping ${idx + 1}:`);
        console.log(`    sourceField: "${fm.sourceField}"`);
        console.log(`    targetField: "${fm.targetField}"`);
        console.log(`    apiField: "${fm.apiField}"`);
    });
} else {
    console.log('\n❌ RULE-002 Not Found!');
}

console.log('\n' + '='.repeat(80));
