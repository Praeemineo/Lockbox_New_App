#!/usr/bin/env node

/**
 * Sync Processing Rules from JSON to PostgreSQL
 * Run this script in BTP environment to update database with latest rules
 */

const http = require('http');

console.log('='.repeat(80));
console.log('SYNCING PROCESSING RULES TO POSTGRESQL');
console.log('='.repeat(80));

// Determine the API URL
const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const url = new URL('/api/processing-rules/sync-to-db', API_URL);

console.log('\n📡 Calling sync endpoint:', url.href);

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = http.request(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('\n📥 Response received:');
        console.log('-'.repeat(80));
        
        try {
            const result = JSON.parse(data);
            console.log(JSON.stringify(result, null, 2));
            
            if (result.success) {
                console.log('\n✅ SUCCESS!');
                console.log(`   Synced: ${result.synced}/${result.total} rules`);
                
                if (result.errors && result.errors.length > 0) {
                    console.log('\n⚠️  Errors:');
                    result.errors.forEach(err => console.log(`   - ${err}`));
                }
            } else {
                console.log('\n❌ FAILED!');
                console.log(`   Error: ${result.error}`);
            }
        } catch (err) {
            console.log('Raw response:', data);
            console.log('\n❌ Failed to parse response');
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('NEXT STEPS:');
        console.log('1. Restart your application: cf restart <app-name>');
        console.log('2. Test file upload with Invoice & Customer numbers');
        console.log('3. Check logs for successful enrichment');
        console.log('='.repeat(80));
    });
});

req.on('error', (error) => {
    console.error('\n❌ Request failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('- Ensure the app is running');
    console.log('- Check if API_URL is correct:', API_URL);
    console.log('- Try manually: curl -X POST', url.href);
});

req.end();
