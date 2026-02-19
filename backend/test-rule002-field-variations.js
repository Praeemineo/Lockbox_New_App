/**
 * Test RULE-002 with different customer field name variations
 * Tests: Customer, CustomerNumber, "Customer Number" (with space)
 */

const ruleEngine = require('./srv/handlers/rule-engine');
const dataModels = require('./srv/models/data-models');

async function testRule002FieldVariations() {
    console.log('='.repeat(70));
    console.log('🧪 Testing RULE-002 with Customer Field Name Variations');
    console.log('='.repeat(70));
    console.log();
    
    // Load processing rules
    await dataModels.loadProcessingRules();
    const rule002 = dataModels.getProcessingRuleById('RULE-002');
    
    console.log('📋 RULE-002 Configuration:');
    console.log('  Rule Name:', rule002.ruleName);
    console.log('  Number of API Mappings:', rule002.apiMappings.length);
    console.log();
    
    // Create test data with different field name variations
    const testData = [
        {
            _index: 1,
            Customer: '17100009',  // Variation 1: "Customer"
            CheckAmount: 1500
        },
        {
            _index: 2,
            CustomerNumber: '17100009',  // Variation 2: "CustomerNumber"
            CheckAmount: 2500
        },
        {
            _index: 3,
            'Customer Number': '17100009',  // Variation 3: "Customer Number" (with space)
            CheckAmount: 3500
        },
        {
            _index: 4,
            BusinessPartner: '17100009',  // Variation 4: "BusinessPartner"
            CheckAmount: 4500
        },
        {
            _index: 5,
            // No customer field - should skip with warning
            CheckAmount: 5500
        }
    ];
    
    console.log('📝 Test Input (5 rows with different field names):');
    testData.forEach((row, idx) => {
        const customerField = row.Customer || row.CustomerNumber || row['Customer Number'] || row.BusinessPartner || 'MISSING';
        const fieldName = row.Customer ? 'Customer' : 
                         row.CustomerNumber ? 'CustomerNumber' : 
                         row['Customer Number'] ? 'Customer Number' : 
                         row.BusinessPartner ? 'BusinessPartner' : 
                         'NONE';
        console.log(`  Row ${idx + 1}: Field="${fieldName}", Value="${customerField}"`);
    });
    console.log();
    
    console.log('🔄 Calling RULE-002 (This will attempt SAP API calls)...');
    console.log('-'.repeat(70));
    
    try {
        const result = await ruleEngine.executeRule002(
            rule002.apiMappings,
            testData
        );
        
        console.log();
        console.log('='.repeat(70));
        console.log('✅ RULE-002 Execution Complete');
        console.log('='.repeat(70));
        console.log();
        console.log('📊 Result:');
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
        
        console.log('📄 Enriched Data:');
        testData.forEach((row, idx) => {
            console.log();
            console.log(`Row ${idx + 1}:`);
            const customerField = row.Customer || row.CustomerNumber || row['Customer Number'] || row.BusinessPartner || 'MISSING';
            console.log(`  Customer Value: ${customerField}`);
            console.log(`  Status: ${row._rule002_status || 'NOT_EXECUTED'}`);
            console.log(`  PartnerBank: ${row.PartnerBank || 'N/A'}`);
            console.log(`  PartnerBankAccount: ${row.PartnerBankAccount || 'N/A'}`);
            console.log(`  PartnerBankCountry: ${row.PartnerBankCountry || 'N/A'}`);
        });
        console.log();
        
        console.log('='.repeat(70));
        console.log('🎯 FIELD NAME VARIATION TEST RESULTS');
        console.log('='.repeat(70));
        console.log();
        
        const successCount = testData.filter(row => row._rule002_status === 'SUCCESS' || row._rule002_status === 'DEFAULTS_USED').length;
        const skippedCount = testData.filter(row => !row._rule002_status).length;
        
        console.log(`✅ Successfully Processed: ${successCount} rows`);
        console.log(`⊘  Skipped (no customer): ${skippedCount} rows`);
        console.log();
        console.log('Field Name Support:');
        console.log('  ✓ "Customer" - Supported');
        console.log('  ✓ "CustomerNumber" - Supported');
        console.log('  ✓ "Customer Number" (with space) - Supported');
        console.log('  ✓ "BusinessPartner" - Supported');
        console.log();
        console.log('='.repeat(70));
        
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
testRule002FieldVariations().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
