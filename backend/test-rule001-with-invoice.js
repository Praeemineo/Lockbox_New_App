/**
 * Test RULE-001 with Invoice Number 90003904
 * This will show what BELNR value is returned from SAP
 */

const ruleEngine = require('./srv/handlers/rule-engine');
const dataModels = require('./srv/models/data-models');

async function testRule001() {
    console.log('='.repeat(70));
    console.log('🧪 Testing RULE-001 with InvoiceNumber = 90003904');
    console.log('='.repeat(70));
    console.log();
    
    // Load processing rules
    await dataModels.loadProcessingRules();
    const rule001 = dataModels.getProcessingRuleById('RULE-001');
    
    console.log('📋 RULE-001 Configuration:');
    console.log('  API:', rule001.apiMappings[0].apiReference);
    console.log('  Input Field:', rule001.apiMappings[0].inputField);
    console.log('  Source Input:', rule001.apiMappings[0].sourceInput);
    console.log('  Output Field:', rule001.apiMappings[0].outputField);
    console.log();
    
    // Create test data
    const testData = [
        {
            _index: 1,
            InvoiceNumber: '90003904',
            CheckAmount: 1365,
            CompanyCode: '1000',
            FiscalYear: '2024'
        }
    ];
    
    console.log('📝 Test Input:');
    console.log('  InvoiceNumber: 90003904');
    console.log('  CompanyCode: 1000');
    console.log('  FiscalYear: 2024');
    console.log();
    
    console.log('🔄 Calling RULE-001 (This will make actual SAP API call)...');
    console.log('-'.repeat(70));
    
    try {
        const result = await ruleEngine.executeRule001(
            rule001.apiMappings[0],
            testData
        );
        
        console.log();
        console.log('='.repeat(70));
        console.log('✅ RULE-001 Execution Complete');
        console.log('='.repeat(70));
        console.log();
        console.log('📊 Result:');
        console.log('  Success:', result.success);
        console.log('  Records Enriched:', result.recordsEnriched);
        console.log('  Message:', result.message);
        console.log();
        
        if (result.errors && result.errors.length > 0) {
            console.log('❌ Errors:');
            result.errors.forEach(err => console.log('  -', err));
            console.log();
        }
        
        console.log('📄 Enriched Data:');
        console.log(JSON.stringify(testData[0], null, 2));
        console.log();
        
        if (testData[0].Paymentreference) {
            console.log('='.repeat(70));
            console.log('🎯 ANSWER: BELNR VALUE');
            console.log('='.repeat(70));
            console.log();
            console.log(`  Invoice Number: ${testData[0].InvoiceNumber}`);
            console.log(`  Derived BELNR:  ${testData[0].Paymentreference}`);
            console.log(`  Status:         ${testData[0]._rule001_status}`);
            console.log(`  Message:        ${testData[0]._rule001_message}`);
            console.log();
            console.log('='.repeat(70));
        } else {
            console.log('⚠️  No BELNR value was retrieved from SAP');
        }
        
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
testRule001().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
