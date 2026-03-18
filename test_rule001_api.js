/**
 * Test script to verify RULE-001 API call and response structure
 */

const sapClient = require('./backend/srv/integrations/sap-client');

async function testRule001API() {
    console.log('='.repeat(80));
    console.log('🧪 Testing RULE-001 API Call');
    console.log('='.repeat(80));
    
    const invoiceNumber = '90003904'; // Test invoice number
    const paddedInvoice = invoiceNumber.padStart(10, '0'); // Should become 0090003904
    
    console.log(`\n📋 Test Parameters:`);
    console.log(`   Original Invoice: ${invoiceNumber}`);
    console.log(`   Padded Invoice: ${paddedInvoice}`);
    
    // API endpoint from user's configuration
    const apiURL = `/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='${paddedInvoice}')/Set`;
    
    console.log(`   API URL: ${apiURL}`);
    
    try {
        console.log(`\n📞 Calling SAP API...`);
        const response = await sapClient.executeSapGetRequest('S4HANA_SYSTEM_DESTINATION', apiURL, {});
        
        console.log(`\n✅ API Response received:`);
        console.log(JSON.stringify(response, null, 2));
        
        // Try to extract Belnr
        console.log(`\n🔍 Analyzing response structure:`);
        
        if (response.data) {
            console.log(`   Response has 'data' property`);
            
            if (response.data.value) {
                console.log(`   Response has 'data.value' (array)`);
                console.log(`   Array length: ${response.data.value.length}`);
                
                if (response.data.value.length > 0) {
                    const firstItem = response.data.value[0];
                    console.log(`\n   First item structure:`);
                    console.log(`   Keys: ${Object.keys(firstItem).join(', ')}`);
                    
                    // Check for Belnr field
                    if (firstItem.Belnr) {
                        console.log(`\n   ✅ Found Belnr: ${firstItem.Belnr}`);
                    } else {
                        console.log(`\n   ❌ Belnr not found in first item`);
                        
                        // Check for similar fields
                        const similarFields = Object.keys(firstItem).filter(k => 
                            k.toLowerCase().includes('belnr') || 
                            k.toLowerCase().includes('document') ||
                            k.toLowerCase().includes('accounting')
                        );
                        
                        if (similarFields.length > 0) {
                            console.log(`   🔍 Similar fields found: ${similarFields.join(', ')}`);
                            similarFields.forEach(field => {
                                console.log(`      ${field}: ${firstItem[field]}`);
                            });
                        }
                    }
                }
            } else if (response.data.Belnr) {
                console.log(`   ✅ Found Belnr directly in data: ${response.data.Belnr}`);
            } else {
                console.log(`   Response data keys: ${Object.keys(response.data).join(', ')}`);
            }
        } else {
            console.log(`   Response structure: ${Object.keys(response).join(', ')}`);
        }
        
    } catch (error) {
        console.error(`\n❌ API Call Failed:`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
    }
}

// Run test
testRule001API().then(() => {
    console.log(`\n${'='.repeat(80)}`);
    console.log('Test completed');
    process.exit(0);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
