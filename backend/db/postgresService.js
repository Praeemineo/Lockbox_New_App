/**
 * PostgreSQL Database Service
 * Handles database connection, table initialization, and all database operations
 */

const { Pool } = require('pg');

// Database pool instance
let pool = null;
let dbAvailable = false;

/**
 * Initialize database connection
 * Supports BTP PostgreSQL binding (VCAP_SERVICES) and direct connection
 */
function initDatabase() {
    // Check for BTP PostgreSQL binding (VCAP_SERVICES)
    if (process.env.VCAP_SERVICES) {
        try {
            const services = JSON.parse(process.env.VCAP_SERVICES);
            const pg = services["postgresql-db"][0].credentials;
            
            pool = new Pool({
                host: pg.hostname,
                port: pg.port,
                database: pg.dbname,
                user: pg.username,
                password: pg.password,
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 10000,
                idleTimeoutMillis: 30000,
                max: 10
            });
            console.log('Connected to BTP PostgreSQL');
            return;
        } catch (e) {
            console.error('Error parsing VCAP_SERVICES:', e);
        }
    }
    
    // Direct PostgreSQL connection for local/dev
    // Uses credentials from .env file
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = parseInt(process.env.DB_PORT) || 5432;
    const dbName = process.env.DB_NAME || 'lockbox';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || 'postgres';
    const dbSsl = process.env.DB_SSL === 'true';
    
    pool = new Pool({
        host: dbHost,
        port: dbPort,
        database: dbName,
        user: dbUser,
        password: dbPassword,
        ssl: dbSsl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 15000,  // 15 second timeout for initial connection
        idleTimeoutMillis: 30000,
        max: 10
    });
    console.log(`Using direct PostgreSQL connection: ${dbHost}:${dbPort}/${dbName}`);
}

/**
 * Initialize database tables - Create if not exists (non-destructive)
 */
async function initTables() {
    // Retry connection up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`Database connection attempt ${attempt}/3...`);
            // Test database connection first
            await pool.query('SELECT 1');
            dbAvailable = true;
            console.log('Database connection successful');
            break;
        } catch (err) {
            console.error(`Connection attempt ${attempt} failed:`, err.message);
            if (attempt === 3) {
                dbAvailable = false;
                console.log('Database not available after 3 attempts - using in-memory storage (data will be lost on restart)');
                return;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    try {
        // Header table - Sheet 1
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lockbox_header (
                id UUID PRIMARY KEY,
                lockbox VARCHAR(50) NOT NULL,
                deposit_datetime TIMESTAMP,
                amount_in_transaction_currency DECIMAL(15,2),
                lockbox_batch_origin VARCHAR(50),
                lockbox_batch_destination VARCHAR(50),
                status VARCHAR(20) DEFAULT 'UPLOADED',
                sap_document_num VARCHAR(50),
                sap_fiscal_year VARCHAR(10),
                sap_payload TEXT,
                sap_simulation_response TEXT,
                sap_response TEXT,
                ar_posting_doc VARCHAR(50),
                payment_advice_doc VARCHAR(50),
                on_account_doc VARCHAR(50),
                clearing_doc VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Add columns if they don't exist (migration for existing tables)
        await pool.query(`ALTER TABLE lockbox_header ADD COLUMN IF NOT EXISTS sap_payload TEXT`);
        await pool.query(`ALTER TABLE lockbox_header ADD COLUMN IF NOT EXISTS sap_simulation_response TEXT`);
        await pool.query(`ALTER TABLE lockbox_header ADD COLUMN IF NOT EXISTS ar_posting_doc VARCHAR(50)`);
        await pool.query(`ALTER TABLE lockbox_header ADD COLUMN IF NOT EXISTS payment_advice_doc VARCHAR(50)`);
        await pool.query(`ALTER TABLE lockbox_header ADD COLUMN IF NOT EXISTS on_account_doc VARCHAR(50)`);
        await pool.query(`ALTER TABLE lockbox_header ADD COLUMN IF NOT EXISTS clearing_doc VARCHAR(50)`);
        
        // Cheques/Bank Data table - Sheet 2 (linked to header via header_id)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lockbox_item (
                id UUID PRIMARY KEY,
                header_id UUID REFERENCES lockbox_header(id) ON DELETE CASCADE,
                lockbox_batch VARCHAR(50) NOT NULL,
                lockbox_batch_item VARCHAR(50) NOT NULL,
                amount_in_transaction_currency DECIMAL(15,2) NOT NULL,
                currency VARCHAR(10) NOT NULL,
                cheque VARCHAR(50) NOT NULL,
                partner_bank VARCHAR(50) NOT NULL,
                partner_bank_account VARCHAR(50) NOT NULL,
                partner_bank_country VARCHAR(10) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Payment References table - Sheet 3 (linked to cheque via item_id)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lockbox_clearing (
                id UUID PRIMARY KEY,
                item_id UUID REFERENCES lockbox_item(id) ON DELETE CASCADE,
                payment_reference VARCHAR(50) NOT NULL,
                net_payment_amount DECIMAL(15,2) NOT NULL,
                deduction_amount DECIMAL(15,2),
                payment_difference_reason VARCHAR(100),
                currency VARCHAR(10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // =====================================================================
        // PRODUCTION RUN LOGGING TABLES - Immutable audit trail
        // =====================================================================
        
        // Table A: Load / Run header table (mandatory) - One entry per production run
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lockbox_run_log (
                id UUID PRIMARY KEY,
                run_id VARCHAR(50) NOT NULL UNIQUE,
                header_id UUID REFERENCES lockbox_header(id) ON DELETE SET NULL,
                lockbox VARCHAR(50) NOT NULL,
                company_code VARCHAR(10) NOT NULL,
                mode VARCHAR(20) NOT NULL DEFAULT 'PRODUCTION',
                status VARCHAR(20) NOT NULL,
                amount DECIMAL(15,2),
                currency VARCHAR(10),
                started_at TIMESTAMP NOT NULL,
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Table B: SAP response log - Stores the exact SAP response per run
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sap_response_log (
                id UUID PRIMARY KEY,
                run_id VARCHAR(50) NOT NULL REFERENCES lockbox_run_log(run_id) ON DELETE CASCADE,
                entity VARCHAR(50),
                payment_advice VARCHAR(50),
                payment_advice_item VARCHAR(10),
                accounting_document VARCHAR(50),
                fiscal_year VARCHAR(10),
                lockbox_batch VARCHAR(10),
                lockbox_batch_internal_key VARCHAR(50),
                currency VARCHAR(10),
                amount DECIMAL(15,2),
                raw_sap_response TEXT,
                raw_sap_xml TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Table C: Line-level clearing - Detailed clearing entries per run
        await pool.query(`
            CREATE TABLE IF NOT EXISTS line_level_clearing (
                id UUID PRIMARY KEY,
                run_id VARCHAR(50) NOT NULL REFERENCES lockbox_run_log(run_id) ON DELETE CASCADE,
                payment_reference VARCHAR(50),
                invoice VARCHAR(50),
                cleared_amount DECIMAL(15,2),
                currency VARCHAR(10),
                company_code VARCHAR(10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Processing Runs table - Stores all uploaded file processing runs
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lockbox_processing_run (
                id UUID PRIMARY KEY,
                run_id VARCHAR(50) NOT NULL UNIQUE,
                filename VARCHAR(255),
                file_type VARCHAR(20),
                file_size INTEGER,
                started_at TIMESTAMP NOT NULL,
                completed_at TIMESTAMP,
                current_stage VARCHAR(50),
                overall_status VARCHAR(20),
                last_failed_stage VARCHAR(50),
                stages JSONB,
                sap_payload JSONB,
                hierarchy JSONB,
                mapped_data JSONB,
                extracted_data JSONB,
                production_result JSONB,
                raw_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // File Patterns table - Stores file pattern definitions
        await pool.query(`
            CREATE TABLE IF NOT EXISTS file_pattern (
                id UUID PRIMARY KEY,
                pattern_id VARCHAR(20) NOT NULL UNIQUE,
                pattern_name VARCHAR(100) NOT NULL,
                file_type VARCHAR(30) NOT NULL,
                pattern_type VARCHAR(50) NOT NULL,
                category VARCHAR(30),
                description TEXT,
                delimiter VARCHAR(10),
                active BOOLEAN DEFAULT true,
                priority INTEGER DEFAULT 100,
                field_mappings JSONB,
                detection JSONB,
                conditions JSONB,
                pdf_fields JSONB,
                processing_rules JSONB,
                bank_code VARCHAR(20),
                account_identifier VARCHAR(50),
                transaction_codes VARCHAR(100),
                split_type VARCHAR(30),
                amount_threshold DECIMAL(15,2),
                auto_match_open_items BOOLEAN DEFAULT false,
                create_suspense_entry BOOLEAN DEFAULT false,
                common_prefix_detection BOOLEAN DEFAULT false,
                pad_check_numbers BOOLEAN DEFAULT false,
                sum_invoice_amounts BOOLEAN DEFAULT false,
                header_row INTEGER DEFAULT 1,
                data_start_row INTEGER DEFAULT 2,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Batch Templates table - Stores uploaded file templates with dynamic field detection
        await pool.query(`
            CREATE TABLE IF NOT EXISTS batch_template (
                id UUID PRIMARY KEY,
                template_id VARCHAR(30) NOT NULL UNIQUE,
                template_name VARCHAR(200) NOT NULL,
                original_filename VARCHAR(255) NOT NULL,
                file_type VARCHAR(30) NOT NULL,
                file_size INTEGER,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                detected_headers JSONB,
                field_mappings JSONB,
                sample_data JSONB,
                row_count INTEGER,
                column_count INTEGER,
                header_row INTEGER DEFAULT 1,
                data_start_row INTEGER DEFAULT 2,
                delimiter VARCHAR(10),
                encoding VARCHAR(20) DEFAULT 'UTF-8',
                status VARCHAR(20) DEFAULT 'ACTIVE',
                customer_id VARCHAR(50),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // OData Services table - Stores SAP service configurations
        await pool.query(`
            CREATE TABLE IF NOT EXISTS odata_service (
                id UUID PRIMARY KEY,
                service_id VARCHAR(20) NOT NULL UNIQUE,
                system VARCHAR(50) NOT NULL,
                product_version VARCHAR(10),
                technical_service_name VARCHAR(100),
                external_service_name VARCHAR(100),
                service_description VARCHAR(255),
                service_operations VARCHAR(100),
                https_api_odata VARCHAR(500),
                auth_type VARCHAR(30),
                destination VARCHAR(100),
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Database tables initialized (CREATE IF NOT EXISTS)');
        console.log('Tables created: lockbox_run_log, sap_response_log, line_level_clearing, lockbox_processing_run, file_pattern, odata_service');
    } catch (tableErr) {
        console.error('Error creating tables:', tableErr.message);
        // Tables might already exist, that's ok - db is still available
    }
}

/**
 * Get the database pool instance
 * @returns {Pool} PostgreSQL pool
 */
function getPool() {
    return pool;
}

/**
 * Check if database is available
 * @returns {boolean} Database availability status
 */
function isDatabaseAvailable() {
    return dbAvailable;
}

/**
 * Set database availability status
 * @param {boolean} status - Database availability status
 */
function setDatabaseAvailable(status) {
    dbAvailable = status;
}

/**
 * Execute a database query
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(queryText, params = []) {
    return pool.query(queryText, params);
}

module.exports = {
    initDatabase,
    initTables,
    getPool,
    isDatabaseAvailable,
    setDatabaseAvailable,
    query
};
