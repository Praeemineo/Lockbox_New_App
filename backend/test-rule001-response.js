const sapClient = require('./srv/integrations/sap-client');

async function testRule001() {
    try {
        console.log('Testing RULE-001 SAP Response Structure...\n');
        
        const endpoint = "/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='0090000334')/Set";
        const destination = 'S4HANA_SYSTEM_DESTINATION';
        
        const response = await sapClient.executeSapGetRequest(destination, endpoint, {});
        
        console.log('='.repeat(80));
        console.log('RAW RESPONSE STRUCTURE:');
        console.log('='.repeat(80));
        console.log(JSON.stringify(response.data, null, 2));
        console.log('\n' + '='.repeat(80));
        console.log('ANALYSIS:');
        console.log('='.repeat(80));
        
        // Check different possible locations
        console.log('response.data.value?', response.data.value ? 'YES' : 'NO');
        console.log('response.data.d?', response.data.d ? 'YES' : 'NO');
        
        if (response.data.value && Array.isArray(response.data.value)) {
            console.log('\nvalue array length:', response.data.value.length);
            if (response.data.value.length > 0) {
                console.log('First item keys:', Object.keys(response.data.value[0]));
                console.log('\nLooking for BELNR in value[0]:', response.data.value[0].BELNR || response.data.value[0].Belnr || 'NOT FOUND');
            }
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testRule001();
