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

module.exports = {
    initDatabase,
    getPool,
    query
};
