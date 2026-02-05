/**
 * PostgreSQL Service
 * Handles all database operations
 */

const { Pool } = require('pg');
const { DB_CONFIG } = require('../config');

let pool;

/**
 * Initialize database connection pool
 */
function initDatabase() {
    // Check for BTP PostgreSQL binding
    if (process.env.VCAP_SERVICES) {
        const vcapServices = JSON.parse(process.env.VCAP_SERVICES);
        const postgresService = vcapServices['postgresql-db'] || vcapServices.postgres || vcapServices.postgresql;
        
        if (postgresService && postgresService[0]) {
            const credentials = postgresService[0].credentials;
            pool = new Pool({
                host: credentials.hostname || credentials.host,
                port: credentials.port,
                database: credentials.dbname || credentials.database,
                user: credentials.username || credentials.user,
                password: credentials.password,
                ssl: credentials.sslRequired ? { rejectUnauthorized: false } : false
            });
            console.log('PostgreSQL connected (BTP binding)');
        }
    } else {
        // Local development
        pool = new Pool({
            host: DB_CONFIG.HOST,
            port: DB_CONFIG.PORT,
            database: DB_CONFIG.NAME,
            user: DB_CONFIG.USER,
            password: DB_CONFIG.PASSWORD,
            ssl: DB_CONFIG.SSL
        });
        console.log('PostgreSQL connected (local)');
    }
    
    return pool;
}

/**
 * Get database pool
 */
function getPool() {
    if (!pool) {
        initDatabase();
    }
    return pool;
}

/**
 * Execute query
 */
async function query(text, params) {
    const dbPool = getPool();
    return await dbPool.query(text, params);
}

/**
 * Initialize database connection pool and create tables
 */
async function initializeDatabase() {
    // Initialize pool first
    initDatabase();
    
    // Create tables if they don't exist
    const createTablesQuery = `
        CREATE TABLE IF NOT EXISTS lockbox_headers (
            id TEXT PRIMARY KEY,
            lockbox_number TEXT,
            bank_key TEXT,
            account_number TEXT,
            statement_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS lockbox_items (
            id TEXT PRIMARY KEY,
            header_id TEXT REFERENCES lockbox_headers(id) ON DELETE CASCADE,
            item_number INTEGER,
            customer_id TEXT,
            amount DECIMAL(15,2),
            reference TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS processing_runs (
            run_id TEXT PRIMARY KEY,
            status TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            result JSONB
        );
    `;
    
    try {
        await query(createTablesQuery);
        console.log('✅ Database tables initialized');
    } catch (error) {
        console.warn('⚠️ Table creation warning (tables may already exist):', error.message);
    }
}

module.exports = {
    initDatabase,
    initializeDatabase,
    getPool,
    query
};
