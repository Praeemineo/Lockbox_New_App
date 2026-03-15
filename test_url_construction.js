#!/usr/bin/env node

/**
 * Direct API URL Construction Test
 * Test what URLs are being built for the specific values
 */

// Load processing rules
const fs = require('fs');
const rulesData = JSON.parse(fs.readFileSync('/app/backend/data/processing_rules.json', 'utf8'));

console.log('='.repeat(80));
console.log('TESTING API URL CONSTRUCTION');
console.log('='.repeat(80));

// Test values
const invoiceNumber = "90003904";
const customerNumber = "17100009";

// Find RULE-001 and RULE-002
const rule001 = rulesData.find(r => r.ruleId === 'RULE-001');
const rule002 = rulesData.find(r => r.ruleId === 'RULE-002');

console.log('\n📋 RULE-001: Accounting Document Lookup');
console.log('─'.repeat(80));
if (rule001) {
  console.log('Rule Name:', rule001.ruleName);
  console.log('API Reference:', rule001.apiMappings[0].apiReference);
  console.log('Field Mappings:', JSON.stringify(rule001.fieldMappings, null, 2));
  
  // Simulate URL building
  const apiRef = rule001.apiMappings[0].apiReference;
  const paddedInvoice = invoiceNumber.padStart(10, '0');
  const finalURL = apiRef.replace("=''", `='${paddedInvoice}'`);
  
  console.log('\n🔧 URL Construction:');
  console.log('  Input Value:', invoiceNumber);
  console.log('  Padded Value:', paddedInvoice);
  console.log('  Final URL:', finalURL);
} else {
  console.log('❌ RULE-001 not found!');
}

console.log('\n📋 RULE-002: Partner Bank Details');
console.log('─'.repeat(80));
if (rule002) {
  console.log('Rule Name:', rule002.ruleName);
  console.log('API Reference:', rule002.apiMappings[0].apiReference);
  console.log('Field Mappings:', JSON.stringify(rule002.fieldMappings, null, 2));
  
  // Simulate URL building
  const apiRef = rule002.apiMappings[0].apiReference;
  const paddedCustomer = customerNumber.padStart(10, '0');
  const finalURL = apiRef.replace("=''", `='${paddedCustomer}'`);
  
  console.log('\n🔧 URL Construction:');
  console.log('  Input Value:', customerNumber);
  console.log('  Padded Value:', paddedCustomer);
  console.log('  Final URL:', finalURL);
} else {
  console.log('❌ RULE-002 not found!');
}

console.log('\n' + '='.repeat(80));
console.log('✅ URL construction test complete');
console.log('='.repeat(80));
