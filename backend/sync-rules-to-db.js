/**
 * Manual Database Sync Script
 * 
 * This script manually syncs processing rules from JSON to PostgreSQL
 * Run with: node sync-rules-to-db.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database credentials
const pool = new Pool({
    host: 'postgres-aee790df-b48b-48cc-96b3-db432a62390e.czuelothxj0h.ap-southeast-2.rds.amazonaws.com',
    port: 2477,
    database: 'CAmqjnIfEdIX',
    user: 'be5b0599008b',
    password: 'bb43fccdcb53a968ffdd9c7ec',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 10
});

async function syncRulesToDatabase() {
    try {
        console.log('🔌 Connecting to PostgreSQL...');
        
        // Test connection
        await pool.query('SELECT 1');
        console.log('✅ Database connection successful');
        
        // Load rules from JSON
        const jsonPath = path.join(__dirname, 'data', 'processing_rules.json');
        console.log('📖 Reading rules from:', jsonPath);
        
        const jsonData = fs.readFileSync(jsonPath, 'utf8');
        const rules = JSON.parse(jsonData);
        console.log(`📝 Found ${rules.length} rules in JSON file`);
        
        // Check if table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'lb_processing_rules'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            console.log('❌ Table lb_processing_rules does not exist!');
            console.log('Creating table...');
            
            await pool.query(`
                CREATE TABLE lb_processing_rules (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    rule_id VARCHAR(30) NOT NULL UNIQUE,
                    rule_name VARCHAR(200) NOT NULL,
                    description TEXT,
                    file_type VARCHAR(50) NOT NULL,
                    rule_type VARCHAR(50) NOT NULL,
                    active BOOLEAN DEFAULT true,
                    priority INTEGER DEFAULT 10,
                    destination VARCHAR(100),
                    conditions JSONB,
                    api_mappings JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ Table created successfully');
        }
        
        // Clear existing data
        console.log('🗑️  Clearing existing data...');
        await pool.query('DELETE FROM lb_processing_rules');
        
        // Insert rules
        console.log('💾 Inserting rules into database...');
        let successCount = 0;
        let errorCount = 0;
        
        for (const rule of rules) {
            try {
                await pool.query(`
                    INSERT INTO lb_processing_rules 
                    (rule_id, rule_name, description, file_type, rule_type, active, priority, 
                     destination, conditions, api_mappings, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                `, [
                    rule.ruleId,
                    rule.ruleName,
                    rule.description || '',
                    rule.fileType,
                    rule.ruleType,
                    rule.active !== false,
                    rule.priority || 10,
                    rule.destination || '',
                    JSON.stringify(rule.conditions || []),
                    JSON.stringify(rule.apiMappings || []),
                    rule.createdAt || new Date().toISOString(),
                    new Date().toISOString()
                ]);
                
                successCount++;
                console.log(`  ✅ ${rule.ruleId}: ${rule.ruleName}`);
            } catch (err) {
                errorCount++;
                console.error(`  ❌ ${rule.ruleId}: ${err.message}`);
            }
        }
        
        // Verify
        const result = await pool.query('SELECT rule_id, rule_name FROM lb_processing_rules ORDER BY rule_id');
        
        console.log('\n✅ Sync Complete!');
        console.log(`   Success: ${successCount}`);
        console.log(`   Failed: ${errorCount}`);
        console.log(`   Total in DB: ${result.rows.length}`);
        
        console.log('\n📋 Rules in database:');
        result.rows.forEach(row => {
            console.log(`   - ${row.rule_id}: ${row.rule_name}`);
        });
        
    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error('Stack:', err.stack);
    } finally {
        await pool.end();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the sync
syncRulesToDatabase();
