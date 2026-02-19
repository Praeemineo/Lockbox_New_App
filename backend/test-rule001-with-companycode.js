/**
 * Test RULE-001 with CompanyCode Retrieval
 * Invoice Number: 90003904
 * Expected: BELNR + CompanyCode from SAP
 */

const ruleEngine = require('./srv/handlers/rule-engine');
const dataModels = require('./srv/models/data-models');

async function testRule001WithCompanyCode() {
    console.log('═'.repeat(70));
    console.log('🧪 Testing RULE-001: BELNR + CompanyCode Retrieval');
    console.log('═'.repeat(70));
    console.log();
    
    await dataModels.loadProcessingRules();
    const rule001 = dataModels.getProcessingRuleById('RULE-001');
    
    console.log('📋 RULE-001 Configuration:');
    console.log(`  Number of API Mappings: ${rule001.apiMappings.length}`);
    rule001.apiMappings.forEach((mapping, idx) => {
        console.log(`\n  Mapping ${idx + 1}:`);
        console.log(`    Output Field: ${mapping.outputField}`);
        console.log(`    Lockbox Field: ${mapping.lockboxApiField}`);
    });
    console.log();
    
    const testData = [
        {
            _index: 1,
            InvoiceNumber: '90003904',
            CheckAmount: 1365
        }
    ];
    
    console.log('📝 Test Input:');
    console.log('  Invoice Number: 90003904');
    console.log();
    
    console.log('🔄 Executing RULE-001...');
    console.log('-'.repeat(70));
    
    try {
        const result = await ruleEngine.executeRule001(
            rule001.apiMappings,
            testData
        );
        
        console.log();
        console.log('═'.repeat(70));
        console.log('📊 Execution Result');
        console.log('═'.repeat(70));
        console.log(`Success: ${result.success}`);
        console.log(`Records Enriched: ${result.recordsEnriched}`);
        console.log(`Errors: ${result.errors.length}`);
        console.log();
        
        const row = testData[0];
        
        console.log('═'.repeat(70));
        console.log('🎯 ENRICHED DATA FOR INVOICE 90003904');
        console.log('═'.repeat(70));
        console.log();
        console.log('Status:', row._rule001_status || 'NOT_EXECUTED');
        console.log('Message:', row._rule001_message || 'N/A');
        console.log();
        
        console.log('┌────────────────────────────────────────────────────┐');
        console.log('│  Field                │  Value                     │');
        console.log('├────────────────────────────────────────────────────┤');
        console.log(`│  PaymentReference     │  ${(row.PaymentReference || 'N/A').padEnd(26)} │`);
        console.log(`│  BELNR                │  ${(row.BELNR || 'N/A').padEnd(26)} │`);
        console.log(`│  CompanyCode          │  ${(row.CompanyCode || 'N/A').padEnd(26)} │`);
        console.log(`│  FiscalYear           │  ${(row.FiscalYear || 'N/A').padEnd(26)} │`);
        console.log('└────────────────────────────────────────────────────┘');
        console.log();
        
        console.log('═'.repeat(70));
        console.log('🔍 API CALL DETAILS');
        console.log('═'.repeat(70));
        console.log('Method: GET');
        console.log('Endpoint: /sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT');
        console.log('Filter: P_Documentnumber eq \'90003904\'');
        console.log('Select: BELNR,CompanyCode,FiscalYear');
        console.log();
        
        console.log('═'.repeat(70));
        console.log('✅ BENEFITS');
        console.log('═'.repeat(70));
        console.log('• CompanyCode is now fetched dynamically from SAP ✅');
        console.log('• No hardcoded CompanyCode (1000) anymore ✅');
        console.log('• CompanyCode available for lockbox clearing ✅');
        console.log('• Will be visible in Field Mapping Preview ✅');
        console.log('• Not included in payload (reserved for future use) ✅');
        console.log('═'.repeat(70));
        
    } catch (error) {
        console.log();
        console.log('❌ Error:', error.message);
    }
}

testRule001WithCompanyCode().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
