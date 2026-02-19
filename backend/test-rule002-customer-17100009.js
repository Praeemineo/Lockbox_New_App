/**
 * Test RULE-002 with Customer Number 17100009
 * This will retrieve actual partner bank details from SAP
 */

const ruleEngine = require('./srv/handlers/rule-engine');
const dataModels = require('./srv/models/data-models');

async function testRule002WithCustomer() {
    console.log('='.repeat(70));
    console.log('🧪 Testing RULE-002: Partner Bank Details Retrieval');
    console.log('='.repeat(70));
    console.log();
    
    // Load processing rules
    await dataModels.loadProcessingRules();
    const rule002 = dataModels.getProcessingRuleById('RULE-002');
    
    console.log('📋 RULE-002 Configuration:');
    console.log('  Rule Name:', rule002.ruleName);
    console.log('  API:', rule002.apiMappings[0].apiReference);
    console.log('  Input Field:', rule002.apiMappings[0].inputField);
    console.log('  Number of Output Fields:', rule002.apiMappings.length);
    console.log();
    
    rule002.apiMappings.forEach((mapping, idx) => {
        console.log(`  Output Field ${idx + 1}:`);
        console.log(`    - SAP Field: ${mapping.outputField}`);
        console.log(`    - Lockbox Field: ${mapping.lockboxApiField}`);
    });
    console.log();
    
    // Create test data with customer 17100009
    const testData = [
        {
            _index: 1,
            CustomerNumber: '17100009',  // Target customer
            InvoiceNumber: '90003904',
            CheckAmount: 1365
        }
    ];
    
    console.log('📝 Test Input:');
    console.log('  Customer Number: 17100009');
    console.log();
    
    console.log('🔄 Calling RULE-002 to retrieve bank details from SAP...');
    console.log('-'.repeat(70));
    
    try {
        const result = await ruleEngine.executeRule002(
            rule002.apiMappings,  // Pass all 3 mappings
            testData
        );
        
        console.log();
        console.log('='.repeat(70));
        console.log('✅ RULE-002 Execution Complete');
        console.log('='.repeat(70));
        console.log();
        console.log('📊 Execution Result:');
        console.log('  Success:', result.success);
        console.log('  Records Enriched:', result.recordsEnriched);
        console.log('  Warnings:', result.warnings.length);
        console.log('  Message:', result.message);
        console.log();
        
        if (result.warnings && result.warnings.length > 0) {
            console.log('⚠️  Warnings:');
            result.warnings.forEach(warn => console.log('  -', warn));
            console.log();
        }
        
        console.log('='.repeat(70));
        console.log('🎯 PARTNER BANK DETAILS FOR CUSTOMER 17100009');
        console.log('='.repeat(70));
        console.log();
        
        const row = testData[0];
        
        console.log('Customer Number:', row.CustomerNumber);
        console.log('Status:', row._rule002_status || 'NOT_EXECUTED');
        console.log('Message:', row._rule002_message || 'N/A');
        console.log();
        
        if (row._rule002_status === 'SUCCESS') {
            console.log('✅ BANK DETAILS RETRIEVED FROM SAP:');
            console.log();
            console.log('┌─────────────────────────────────────────────────┐');
            console.log('│  Field Name          │  SAP Field  │  Value    │');
            console.log('├─────────────────────────────────────────────────┤');
            console.log(`│  PartnerBank         │  BANKS      │  ${(row.PartnerBank || 'N/A').padEnd(9)} │`);
            console.log(`│  PartnerBankAccount  │  BANKL      │  ${(row.PartnerBankAccount || 'N/A').padEnd(9)} │`);
            console.log(`│  PartnerBankCountry  │  BANKN      │  ${(row.PartnerBankCountry || 'N/A').padEnd(9)} │`);
            console.log('└─────────────────────────────────────────────────┘');
            console.log();
            console.log('These values were fetched from SAP S/4HANA system.');
            
        } else if (row._rule002_status === 'DEFAULTS_USED') {
            console.log('⚠️  DEFAULT VALUES USED (SAP API Failed or No Data Found):');
            console.log();
            console.log('┌─────────────────────────────────────────────────┐');
            console.log('│  Field Name          │  Default Value          │');
            console.log('├─────────────────────────────────────────────────┤');
            console.log(`│  PartnerBank         │  ${(row.PartnerBank || 'N/A').padEnd(23)} │`);
            console.log(`│  PartnerBankAccount  │  ${(row.PartnerBankAccount || 'N/A').padEnd(23)} │`);
            console.log(`│  PartnerBankCountry  │  ${(row.PartnerBankCountry || 'N/A').padEnd(23)} │`);
            console.log('└─────────────────────────────────────────────────┘');
            console.log();
            console.log('⚠️  Reason: Could not reach SAP or customer not found.');
            
        } else {
            console.log('❌ RULE NOT EXECUTED');
            console.log();
            console.log('No bank details available.');
        }
        
        console.log();
        console.log('='.repeat(70));
        console.log('📄 Complete Row Data:');
        console.log('='.repeat(70));
        console.log(JSON.stringify(row, null, 2));
        console.log();
        
    } catch (error) {
        console.log();
        console.log('='.repeat(70));
        console.log('❌ ERROR');
        console.log('='.repeat(70));
        console.log();
        console.log('Error:', error.message);
        console.log();
        console.log('Stack:', error.stack);
    }
}

// Run the test
testRule002WithCustomer().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
