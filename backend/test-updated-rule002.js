/**
 * Test RULE-002 with Updated Configuration
 * Customer Number: 17100009
 * BankIdentification: 0001
 * Output: BankNumber, BankAccount, BankCountryKey
 */

const ruleEngine = require('./srv/handlers/rule-engine');
const dataModels = require('./srv/models/data-models');

async function testUpdatedRule002() {
    console.log('='.repeat(70));
    console.log('🧪 Testing RULE-002 with Updated Configuration');
    console.log('='.repeat(70));
    console.log();
    
    await dataModels.loadProcessingRules();
    const rule002 = dataModels.getProcessingRuleById('RULE-002');
    
    console.log('📋 API Identified:');
    console.log(`  ${rule002.apiMappings[0].apiReference}`);
    console.log();
    
    console.log('🎯 Conditions:');
    rule002.conditions.forEach(c => {
        console.log(`  • ${c.documentFormat}: ${c.condition}`);
    });
    console.log();
    
    console.log('📤 Input:');
    console.log('  • Customer Number: 17100009');
    console.log('  • BankIdentification Filter: 0001');
    console.log();
    
    console.log('📥 Expected Output Fields:');
    rule002.apiMappings.forEach(m => {
        console.log(`  • ${m.outputField} → ${m.lockboxApiField}`);
    });
    console.log();
    
    const testData = [{ _index: 1, CustomerNumber: '17100009', CheckAmount: 1365 }];
    
    console.log('🔄 Executing RULE-002...');
    console.log('-'.repeat(70));
    
    try {
        const result = await ruleEngine.executeRule002(rule002.apiMappings, testData);
        
        console.log();
        console.log('='.repeat(70));
        console.log('📊 Result Summary');
        console.log('='.repeat(70));
        console.log(`Success: ${result.success}`);
        console.log(`Records Enriched: ${result.recordsEnriched}`);
        console.log(`Warnings: ${result.warnings.length}`);
        console.log();
        
        const row = testData[0];
        console.log('📄 Enriched Data for Customer 17100009:');
        console.log(`  PartnerBank: ${row.PartnerBank || 'N/A'}`);
        console.log(`  PartnerBankAccount: ${row.PartnerBankAccount || 'N/A'}`);
        console.log(`  PartnerBankCountry: ${row.PartnerBankCountry || 'N/A'}`);
        console.log(`  Status: ${row._rule002_status || 'N/A'}`);
        console.log();
        
        console.log('='.repeat(70));
        console.log('🎯 API Call Details');
        console.log('='.repeat(70));
        console.log('Method: GET');
        console.log('Endpoint: /sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartnerBank');
        console.log('Filter: A_BusinessPartner eq \'17100009\' and BankIdentification eq \'0001\'');
        console.log('Select: BankNumber,BankAccount,BankCountryKey');
        console.log('='.repeat(70));
        
    } catch (error) {
        console.log();
        console.log('❌ Error:', error.message);
    }
}

testUpdatedRule002().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
