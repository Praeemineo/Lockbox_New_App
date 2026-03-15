#!/usr/bin/env node

/**
 * Test actual SAP API calls with real credentials
 */

const sapClient = require('/app/backend/srv/integrations/sap-client.js');

console.log('='.repeat(80));
console.log('TESTING SAP API CALLS WITH REAL CREDENTIALS');
console.log('='.repeat(80));

(async () => {
    // Test RULE-001: Accounting Document Lookup
    console.log('\n📋 TEST 1: RULE-001 - Accounting Document Lookup');
    console.log('─'.repeat(80));
    
    const rule001Endpoint = "/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='0090003904')/Set";
    
    console.log('Endpoint:', rule001Endpoint);
    console.log('Destination: S4HANA_SYSTEM_DESTINATION');
    
    try {
        const response001 = await sapClient.executeSapGetRequest(
            'S4HANA_SYSTEM_DESTINATION',
            rule001Endpoint,
            {} // No additional query params
        );
        
        console.log('\n✅ RULE-001 Response:');
        console.log('Status:', response001.status);
        console.log('Data:', JSON.stringify(response001.data, null, 2));
        
        // Extract AccountingDocument field
        if (response001.data && response001.data.value) {
            const accountingDoc = response001.data.value[0]?.AccountingDocument;
            const companyCode = response001.data.value[0]?.CompanyCode;
            console.log('\n🎯 Extracted Values:');
            console.log('  AccountingDocument:', accountingDoc);
            console.log('  CompanyCode:', companyCode);
        }
        
    } catch (error) {
        console.error('\n❌ RULE-001 Error:', error.message);
        console.error('Response:', error.response?.data);
    }
    
    // Test RULE-002: Partner Bank Details
    console.log('\n\n📋 TEST 2: RULE-002 - Partner Bank Details');
    console.log('─'.repeat(80));
    
    const rule002Endpoint = "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner(BusinessPartner='0017100009')";
    const rule002Params = {
        '$expand': 'to_BusinessPartnerBank',
        '$format': 'json'
    };
    
    console.log('Endpoint:', rule002Endpoint);
    console.log('Query Params:', rule002Params);
    console.log('Destination: S4HANA_SYSTEM_DESTINATION');
    
    try {
        const response002 = await sapClient.executeSapGetRequest(
            'S4HANA_SYSTEM_DESTINATION',
            rule002Endpoint,
            rule002Params
        );
        
        console.log('\n✅ RULE-002 Response:');
        console.log('Status:', response002.status);
        console.log('Data:', JSON.stringify(response002.data, null, 2).substring(0, 1000) + '...');
        
        // Extract bank details
        if (response002.data && response002.data.d) {
            const bankData = response002.data.d.to_BusinessPartnerBank?.results?.[0];
            console.log('\n🎯 Extracted Bank Values:');
            console.log('  BankNumber:', bankData?.BankNumber);
            console.log('  BankAccount:', bankData?.BankAccount);
            console.log('  BankCountryKey:', bankData?.BankCountryKey);
        }
        
    } catch (error) {
        console.error('\n❌ RULE-002 Error:', error.message);
        console.error('Response:', error.response?.data);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('TEST COMPLETE');
    console.log('='.repeat(80));
})();
