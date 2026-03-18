const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const path = require('path');
const axios = require('axios');
const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
require('dotenv').config();

// ============================================================================
// MODULAR IMPORTS - Dynamic Rule Engine (NEW)
// ============================================================================
const ruleEngine = require('./srv/handlers/rule-engine');
const sapClient = require('./srv/integrations/sap-client');
const dataModels = require('./srv/models/data-models');
const { getRuleById, getApiConfig } = require('./services/rule.service'); // For dynamic API calls

// ============================================================================
// MODULAR IMPORTS - SAP and Database Services
// ============================================================================
// SAP Service Modules (organized by HTTP method)
// - sap/sapService.js: Core SAP connection and configuration
// - sap/getSap.js: SAP GET requests (LockboxBatch, LockboxBatchItem, LockboxClearing)
// - sap/postSap.js: SAP POST requests (create LockboxBatch)
// - sap/updateSap.js: SAP UPDATE requests (placeholder)
// - sap/deleteSap.js: SAP DELETE requests (placeholder)
//
// Database Service Module
// - db/postgresService.js: PostgreSQL connection and queries
//
// Note: Functions are still defined inline in server.js for now
// The modular files provide an alternative import path for future refactoring
// Import usage example:
//   const { postToSapApi, getLockboxClearing } = require('./sap');
//   const { getPool, initTables } = require('./db');
// ============================================================================

const app = express();
const PORT = process.env.PORT || 8001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static UI files - support both Kubernetes and BTP deployments
// In Kubernetes: Use consolidated frontend from ../frontend/public
// In BTP/CF: Use local frontend from ./app (included in deployment package)
let frontendPath;

// Check if we're in Kubernetes environment (consolidated frontend exists)
const consolidatedPath = path.join(__dirname, '../frontend/public');
const localPath = path.join(__dirname, 'app');

if (require('fs').existsSync(consolidatedPath)) {
    frontendPath = consolidatedPath;
    console.log('Using consolidated frontend path:', frontendPath);
} else {
    frontendPath = localPath;
    console.log('Using local frontend path (BTP deployment):', frontendPath);
}

app.use(express.static(frontendPath));
app.use('/webapp', express.static(path.join(frontendPath, 'webapp')));

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// PostgreSQL connection - For BTP, use VCAP_SERVICES
let pool;

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

initDatabase();

// Initialize database tables - Create if not exists (non-destructive)
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
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                pattern_id VARCHAR(20) NOT NULL UNIQUE,
                pattern_name VARCHAR(100) NOT NULL,
                file_type VARCHAR(30) NOT NULL,
                pattern_type VARCHAR(50) NOT NULL,
                category VARCHAR(30),
                description TEXT,
                delimiter VARCHAR(10),
                active BOOLEAN DEFAULT true,
                priority INTEGER DEFAULT 100,
                conditions JSONB,
                actions JSONB,
                field_mappings JSONB,
                detection JSONB,
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
        
        // LB_Processing_Rules table - Stores lockbox processing rules with conditions and API mappings
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lb_processing_rules (
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
                field_mappings JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Database tables initialized (CREATE IF NOT EXISTS)');
        console.log('Tables created: lockbox_run_log, sap_response_log, line_level_clearing, lockbox_processing_run, file_pattern, odata_service, lb_processing_rules');
    } catch (tableErr) {
        console.error('Error creating tables:', tableErr.message);
        // Tables might already exist, that's ok - db is still available
    }
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', service: 'lockbox-srv', timestamp: new Date().toISOString() });
});

// ============================================================================
// LOCKBOX API
// ============================================================================
// Get all lockbox headers
app.get('/api/lockbox/headers', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM lockbox_header ORDER BY created_at DESC'
        );
        res.json({ value: result.rows });
    } catch (err) {
        console.error('Error fetching headers:', err);
        res.status(500).json({ error: 'Failed to fetch headers' });
    }
});

// Download template - Configurable fields based on user selection
// SAP Field Length Limits:
// - Lockbox: Max 7 chars
// - LockboxBatch: Max 3 chars (e.g., '001')
// - LockboxBatchItem: Max 5 chars (e.g., '00001')
// - Cheque: Max 13 chars
// - PartnerBank: Max 15 chars
// - PartnerBankAccount: Max 18 chars
// - PartnerBankCountry: Max 3 chars
// - PaymentReference: Max 30 chars
// - PaymentDifferenceReason: Max 3 chars
app.get('/api/lockbox/template', (req, res) => {
    const wb = XLSX.utils.book_new();
    
    // Default sample values for fields
    const sampleValues = {
        // Header
        'Lockbox': '1234',  // Fixed lockbox number for all batches
        'DepositDateTime': '2024-01-15T10:30:00',
        'AmountInTransactionCurrency': '25000.00',
        'LockboxBatchOrigin': 'LOCKBOXORI',  // Default lockbox origin
        'LockboxBatchDestination': 'LOCKBOXDES',
        'CompanyCode': '1710',
        // Cheques
        'LockboxBatch': '001',
        'LockboxBatchItem': '001',
        'Currency': 'USD',
        'Cheque': '4713',
        'PartnerBank': '88888876',
        'PartnerBankAccount': '8765432195',
        'PartnerBankCountry': 'US',
        // Payment References
        'PaymentReference': '5678',
        'NetPaymentAmountInPaytCurrency': '6000.00',
        'DeductionAmountInPaytCurrency': '80.00',
        'PaymentDifferenceReason': 'XXX'
    };
    
    // Parse configuration from query parameter
    let config = null;
    if (req.query.config) {
        try {
            config = JSON.parse(req.query.config);
        } catch (e) {
            console.log('Error parsing template config:', e.message);
        }
    }
    
    // Build Header sheet
    let headerFields, headerRow;
    if (config && config.header) {
        headerFields = config.header.map(f => f.fieldName);
        headerRow = config.header.map(f => f.constantValue || sampleValues[f.fieldName] || '');
    } else {
        headerFields = ['Lockbox', 'DepositDateTime', 'AmountInTransactionCurrency', 'LockboxBatchOrigin', 'LockboxBatchDestination'];
        headerRow = ['1234', '2024-01-15T10:30:00', '25000.00', 'LOCKBOXORI', 'LOCKBOXDES'];
    }
    const headerData = [headerFields, headerRow];
    const headerWs = XLSX.utils.aoa_to_sheet(headerData);
    headerWs['!cols'] = headerFields.map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(wb, headerWs, 'Header');
    
    // Build Cheques sheet
    let chequesFields, chequesRows;
    if (config && config.cheques) {
        chequesFields = config.cheques.map(f => f.fieldName);
        // Create 3 sample rows with different data
        chequesRows = [
            config.cheques.map((f, idx) => {
                if (f.constantValue) return f.constantValue;
                if (f.fieldName === 'LockboxBatch') return '001';
                if (f.fieldName === 'LockboxBatchItem') return '001';
                if (f.fieldName === 'AmountInTransactionCurrency') return '10000.00';
                return sampleValues[f.fieldName] || '';
            }),
            config.cheques.map((f, idx) => {
                if (f.constantValue) return f.constantValue;
                if (f.fieldName === 'LockboxBatch') return '001';
                if (f.fieldName === 'LockboxBatchItem') return '002';
                if (f.fieldName === 'AmountInTransactionCurrency') return '8000.00';
                if (f.fieldName === 'Cheque') return '5712';
                if (f.fieldName === 'PartnerBank') return '67290000';
                if (f.fieldName === 'PartnerBankAccount') return '0007888';
                if (f.fieldName === 'PartnerBankCountry') return 'US';
                return sampleValues[f.fieldName] || '';
            })
        ];
    } else {
        chequesFields = ['LockboxBatch', 'LockboxBatchItem', 'AmountInTransactionCurrency', 'Currency', 'Cheque', 'PartnerBank', 'PartnerBankAccount', 'PartnerBankCountry'];
        chequesRows = [
            ['001', '001', '10000.00', 'USD', '4713', '88888876', '8765432195', 'US'],
            ['001', '002', '8000.00', 'USD', '5712', '67290000', '0007888', 'US']
        ];
    }
    const chequeData = [chequesFields, ...chequesRows];
    const chequeWs = XLSX.utils.aoa_to_sheet(chequeData);
    chequeWs['!cols'] = chequesFields.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, chequeWs, 'Cheques');
    
    // Build Payment References sheet
    let payRefFields, payRefRows;
    if (config && config.paymentReferences) {
        payRefFields = config.paymentReferences.map(f => f.fieldName);
        payRefRows = [
            config.paymentReferences.map((f, idx) => {
                if (f.constantValue) return f.constantValue;
                if (f.fieldName === 'Cheque') return '4713';
                return sampleValues[f.fieldName] || '';
            }),
            config.paymentReferences.map((f, idx) => {
                if (f.constantValue) return f.constantValue;
                if (f.fieldName === 'Cheque') return '5712';
                if (f.fieldName === 'PaymentReference') return '6780';
                if (f.fieldName === 'NetPaymentAmountInPaytCurrency') return '5000.00';
                if (f.fieldName === 'DeductionAmountInPaytCurrency') return '50.00';
                if (f.fieldName === 'PaymentDifferenceReason') return '03';
                return sampleValues[f.fieldName] || '';
            })
        ];
    } else {
        payRefFields = ['Cheque', 'PaymentReference', 'NetPaymentAmountInPaytCurrency', 'DeductionAmountInPaytCurrency', 'PaymentDifferenceReason', 'Currency'];
        payRefRows = [
            ['4713', '5678', '6000.00', '80.00', 'XXX', 'USD'],
            ['5712', '6780', '5000.00', '50.00', '03', 'USD']
        ];
    }
    const payRefData = [payRefFields, ...payRefRows];
    const payRefWs = XLSX.utils.aoa_to_sheet(payRefData);
    payRefWs['!cols'] = payRefFields.map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(wb, payRefWs, 'PaymentReferences');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=lockbox_template.xlsx');
    res.send(buffer);
});

// Upload Excel file - 3 sheets with SAP fields
app.post('/api/lockbox/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const errors = [];
        
        // ========== Sheet 1: Header ==========
        const headerSheet = workbook.Sheets['Header'];
        if (!headerSheet) {
            return res.status(400).json({ success: false, message: 'Missing Header sheet', errors: [{ code: 'MISSING_SHEET', message: 'Header sheet is required' }] });
        }
        
        const headerData = XLSX.utils.sheet_to_json(headerSheet);
        if (headerData.length === 0) {
            return res.status(400).json({ success: false, message: 'Header sheet is empty', errors: [{ code: 'EMPTY_SHEET', message: 'Header sheet must have data' }] });
        }
        if (headerData.length > 1) {
            errors.push({ code: 'MULTIPLE_HEADERS', message: 'Only one header row is allowed per file' });
        }
        
        const header = headerData[0];
        const headerId = uuidv4();
        const lockboxId = header['Lockbox'];
        
        if (!lockboxId) {
            return res.status(400).json({ success: false, message: 'Lockbox ID is required in Header sheet' });
        }
        
        // Parse deposit datetime
        let depositDatetime = null;
        if (header['DepositDateTime']) {
            depositDatetime = new Date(header['DepositDateTime']);
        }
        
        // Insert header
        await pool.query(
            `INSERT INTO lockbox_header (id, lockbox, deposit_datetime, amount_in_transaction_currency, lockbox_batch_origin, lockbox_batch_destination, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                headerId, 
                lockboxId, 
                depositDatetime, 
                parseFloat(header['AmountInTransactionCurrency']) || 0,
                header['LockboxBatchOrigin'] || null,
                header['LockboxBatchDestination'] || null,
                'UPLOADED'
            ]
        );
        
        // ========== Sheet 2: Cheques/Bank Data ==========
        const chequeSheet = workbook.Sheets['Cheques'];
        if (!chequeSheet) {
            return res.status(400).json({ success: false, message: 'Missing Cheques sheet', errors: [{ code: 'MISSING_SHEET', message: 'Cheques sheet is required' }] });
        }
        
        const chequeData = XLSX.utils.sheet_to_json(chequeSheet);
        const chequeMap = {}; // Map cheque number to item ID
        
        // Validate mandatory fields for cheques
        const chequeMandatoryFields = ['LockboxBatch', 'LockboxBatchItem', 'AmountInTransactionCurrency', 'Currency', 'Cheque', 'PartnerBank', 'PartnerBankAccount', 'PartnerBankCountry'];
        
        for (let i = 0; i < chequeData.length; i++) {
            const cheque = chequeData[i];
            const rowNum = i + 2; // +2 for header row and 0-index
            
            // Check mandatory fields
            for (const field of chequeMandatoryFields) {
                if (!cheque[field] && cheque[field] !== 0) {
                    errors.push({ code: 'MISSING_FIELD', message: `Row ${rowNum} in Cheques: Missing mandatory field '${field}'` });
                }
            }
            
            const itemId = uuidv4();
            const chequeNum = cheque['Cheque'];
            
            await pool.query(
                `INSERT INTO lockbox_item (id, header_id, lockbox_batch, lockbox_batch_item, amount_in_transaction_currency, currency, cheque, partner_bank, partner_bank_account, partner_bank_country)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    itemId, 
                    headerId, 
                    cheque['LockboxBatch'],
                    cheque['LockboxBatchItem'],
                    parseFloat(cheque['AmountInTransactionCurrency']) || 0,
                    cheque['Currency'],
                    chequeNum,
                    cheque['PartnerBank'],
                    cheque['PartnerBankAccount'],
                    cheque['PartnerBankCountry']
                ]
            );
            
            chequeMap[chequeNum] = itemId;
        }
        
        // ========== Sheet 3: Payment References ==========
        const payRefSheet = workbook.Sheets['PaymentReferences'];
        if (!payRefSheet) {
            return res.status(400).json({ success: false, message: 'Missing PaymentReferences sheet', errors: [{ code: 'MISSING_SHEET', message: 'PaymentReferences sheet is required' }] });
        }
        
        const payRefData = XLSX.utils.sheet_to_json(payRefSheet);
        
        // Validate mandatory fields for payment references
        const payRefMandatoryFields = ['Cheque', 'PaymentReference', 'NetPaymentAmountInPaytCurrency'];
        
        for (let i = 0; i < payRefData.length; i++) {
            const payRef = payRefData[i];
            const rowNum = i + 2;
            
            // Check mandatory fields
            for (const field of payRefMandatoryFields) {
                if (!payRef[field] && payRef[field] !== 0) {
                    errors.push({ code: 'MISSING_FIELD', message: `Row ${rowNum} in PaymentReferences: Missing mandatory field '${field}'` });
                }
            }
            
            const chequeNum = payRef['Cheque'];
            const itemId = chequeMap[chequeNum];
            
            if (itemId) {
                await pool.query(
                    `INSERT INTO lockbox_clearing (id, item_id, payment_reference, net_payment_amount, deduction_amount, payment_difference_reason, currency)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        uuidv4(), 
                        itemId, 
                        payRef['PaymentReference'],
                        parseFloat(payRef['NetPaymentAmountInPaytCurrency']) || 0,
                        parseFloat(payRef['DeductionAmountInPaytCurrency']) || 0,
                        payRef['PaymentDifferenceReason'] || null,
                        payRef['Currency'] || null
                    ]
                );
            } else {
                errors.push({ code: 'INVALID_CHEQUE_REF', message: `Row ${rowNum}: Payment reference refers to unknown cheque '${chequeNum}'` });
            }
        }
        
        res.json({
            success: true,
            message: `Lockbox ${lockboxId} uploaded successfully with ${chequeData.length} cheques and ${payRefData.length} payment references`,
            header_id: headerId,
            summary: {
                lockbox: lockboxId,
                cheques_count: chequeData.length,
                payment_refs_count: payRefData.length
            },
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ success: false, message: 'Upload failed: ' + err.message });
    }
});

// Get lockbox hierarchy - 3 Level Structure
app.get('/api/lockbox/hierarchy/:headerId', async (req, res) => {
    try {
        const { headerId } = req.params;
        
        // Get header
        const headerResult = await pool.query('SELECT * FROM lockbox_header WHERE id = $1', [headerId]);
        if (headerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Header not found' });
        }
        const header = headerResult.rows[0];
        
        // Get the currency from the first item (all items should have same currency)
        const currencyResult = await pool.query(
            'SELECT currency FROM lockbox_item WHERE header_id = $1 LIMIT 1',
            [headerId]
        );
        const headerCurrency = currencyResult.rows.length > 0 ? currencyResult.rows[0].currency : '';
        
        // Build hierarchical tree structure
        // Level 1: Header (Lockbox ID)
        // Level 2: Batch/Item/Cheque details
        // Level 3: Payment References
        
        const hierarchy = [];
        
        // Level 1 - Header node (with currency from items)
        const headerNode = {
            nodeId: 'header_' + header.id,
            level: 1,
            type: 'HEADER',
            label: `Lockbox ID: ${header.lockbox}`,
            lockbox: header.lockbox,
            amount: header.amount_in_transaction_currency,
            currency: headerCurrency,
            status: header.status,
            children: []
        };
        
        // Get items (cheques) - Level 2
        const itemsResult = await pool.query(
            'SELECT * FROM lockbox_item WHERE header_id = $1 ORDER BY lockbox_batch, lockbox_batch_item', 
            [headerId]
        );
        
        for (const item of itemsResult.rows) {
            // Level 2 - Cheque/Item node
            const itemNode = {
                nodeId: 'item_' + item.id,
                level: 2,
                type: 'CHEQUE',
                label: `Batch: ${item.lockbox_batch}, Item: ${item.lockbox_batch_item}, Cheque: ${item.cheque}`,
                lockboxBatch: item.lockbox_batch,
                lockboxBatchItem: item.lockbox_batch_item,
                cheque: item.cheque,
                amount: item.amount_in_transaction_currency,
                currency: item.currency,
                partnerBank: item.partner_bank,
                partnerBankAccount: item.partner_bank_account,
                partnerBankCountry: item.partner_bank_country,
                children: []
            };
            
            // Get payment references - Level 3
            const clearingResult = await pool.query(
                'SELECT * FROM lockbox_clearing WHERE item_id = $1 ORDER BY payment_reference', 
                [item.id]
            );
            
            for (const clearing of clearingResult.rows) {
                // Level 3 - Payment Reference node (removed "- Net Amount" from label)
                const payRefNode = {
                    nodeId: 'payref_' + clearing.id,
                    level: 3,
                    type: 'PAYMENT_REF',
                    label: `Payment Ref: ${clearing.payment_reference}`,
                    paymentReference: clearing.payment_reference,
                    netAmount: clearing.net_payment_amount,
                    amount: clearing.net_payment_amount,
                    deductionAmount: clearing.deduction_amount,
                    paymentDifferenceReason: clearing.payment_difference_reason,
                    currency: clearing.currency,
                    children: []
                };
                itemNode.children.push(payRefNode);
            }
            
            headerNode.children.push(itemNode);
        }
        
        hierarchy.push(headerNode);
        
        res.json({ header, hierarchy });
        
    } catch (err) {
        console.error('Error fetching hierarchy:', err);
        res.status(500).json({ error: 'Failed to fetch hierarchy' });
    }
});

// Delete header
app.delete('/api/lockbox/headers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM lockbox_header WHERE id = $1', [id]);
        res.json({ success: true, message: 'Lockbox deleted successfully' });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ error: 'Failed to delete lockbox' });
    }
});

// SAP API Configuration - BTP Destination Service ONLY
// The SAP Cloud SDK's executeHttpRequest with destinationName requires BTP Destination Service
// This will work ONLY when deployed to SAP BTP with proper destination binding
const SAP_API_PATH = '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch';
const SAP_CLEARING_PATH = '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxClearing';
const DEFAULT_COMPANY_CODE = '1710';
const SAP_CLIENT = process.env.SAP_CLIENT || '100';
const SAP_DESTINATION_NAME = 'S4HANA_SYSTEM_DESTINATION';

console.log('SAP Configuration:');
console.log('  Destination:', SAP_DESTINATION_NAME);
console.log('  API Path:', SAP_API_PATH);
console.log('  Clearing Path:', SAP_CLEARING_PATH);
console.log('  Client:', SAP_CLIENT);
console.log('  Company Code:', DEFAULT_COMPANY_CODE);

// ============================================================================
// RUN ID GENERATOR - Creates unique, human-readable run IDs
// Format: LB-RUN-YYYY-NNNNN (e.g., LB-RUN-2025-00054)
// ============================================================================
async function generateRunId() {
    const year = new Date().getFullYear();
    
    // Get the count of runs this year from the database
    try {
        const result = await pool.query(
            `SELECT COUNT(*) as count FROM lockbox_run_log WHERE run_id LIKE $1`,
            [`LB-RUN-${year}-%`]
        );
        const count = parseInt(result.rows[0].count || 0) + 1;
        return `LB-RUN-${year}-${count.toString().padStart(5, '0')}`;
    } catch (err) {
        // Fallback: use timestamp if query fails
        const timestamp = Date.now();
        return `LB-RUN-${year}-${timestamp}`;
    }
}

// ============================================================================
// LOGGING HELPER - Persists immutable run logs to database
// ============================================================================
async function persistRunLog(runId, headerId, lockbox, companyCode, mode, status, amount, currency, startedAt, completedAt = null) {
    const logId = uuidv4();
    await pool.query(
        `INSERT INTO lockbox_run_log (id, run_id, header_id, lockbox, company_code, mode, status, amount, currency, started_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [logId, runId, headerId, lockbox, companyCode, mode, status, amount, currency, startedAt, completedAt]
    );
    return logId;
}

async function persistSapResponseLog(runId, sapClearingData, rawSapResponse, rawXml = null) {
    const entries = Array.isArray(sapClearingData) ? sapClearingData : [sapClearingData];
    
    for (const entry of entries) {
        const logId = uuidv4();
        await pool.query(
            `INSERT INTO sap_response_log (id, run_id, entity, payment_advice, payment_advice_item, accounting_document, 
             fiscal_year, lockbox_batch, lockbox_batch_internal_key, currency, amount, raw_sap_response, raw_sap_xml)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                logId,
                runId,
                'LockboxClearing',
                entry.PaymentAdvice || null,
                entry.PaymentAdviceItem || null,
                entry.AccountingDocument || null,
                entry.FiscalYear || null,
                entry.LockboxBatch || null,
                entry.LockboxBatchInternalKey || null,
                entry.Currency || null,
                entry.NetPaymentAmountInPaytCurrency ? parseFloat(entry.NetPaymentAmountInPaytCurrency) : null,
                JSON.stringify(rawSapResponse),
                rawXml
            ]
        );
    }
}

async function persistLineLevelClearing(runId, clearingEntries, companyCode) {
    const entries = Array.isArray(clearingEntries) ? clearingEntries : [];
    
    for (const entry of entries) {
        const logId = uuidv4();
        await pool.query(
            `INSERT INTO line_level_clearing (id, run_id, payment_reference, invoice, cleared_amount, currency, company_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                logId,
                runId,
                entry.PaymentReference || entry.paymentReference || null,
                entry.PaymentReference || entry.invoice || null,  // Using payment reference as invoice identifier
                entry.NetPaymentAmountInPaytCurrency ? parseFloat(entry.NetPaymentAmountInPaytCurrency) : (entry.clearedAmount || null),
                entry.Currency || entry.currency || null,
                companyCode
            ]
        );
    }
}

// Direct HTTPS functions removed - now using SAP Cloud SDK via BTP Destination

// Helper function to extract structured SAP OData error
// SAP OData errors follow this format:
// { "error": { "code": "...", "message": { "lang": "en", "value": "Actual error message" }, "innererror": {...} } }
function extractSapODataError(error) {
    // ENHANCED DEBUGGING: Log complete raw error object structure
    console.error('=== RAW SAP SDK ERROR OBJECT ===');
    console.error('Error Object Keys:', Object.keys(error));
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('Error Response:', error.response ? 'EXISTS' : 'NULL');
    console.error('Error Cause:', error.cause ? 'EXISTS' : 'NULL');
    console.error('Error Root Cause:', error.rootCause ? 'EXISTS' : 'NULL');
    
    // Try to serialize the entire error object
    try {
        const errorCopy = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        console.error('Full Error Object (JSON):', JSON.stringify(errorCopy, null, 2));
    } catch (serializeError) {
        console.error('Could not serialize error object:', serializeError.message);
    }
    console.error('=== END RAW ERROR ===');
    
    const structuredError = {
        // Basic error info
        errorType: error.name || 'Error',
        errorMessage: error.message,
        
        // HTTP response info
        httpStatus: null,
        httpStatusText: null,
        
        // SAP OData error details
        sapErrorCode: null,
        sapErrorMessage: null,
        sapInnerError: null,
        
        // Raw response data for debugging
        rawResponseData: null
    };
    
    // Extract from error.response (direct)
    if (error.response) {
        structuredError.httpStatus = error.response.status;
        structuredError.httpStatusText = error.response.statusText;
        structuredError.rawResponseData = error.response.data;
        
        // Parse SAP OData error format
        if (error.response.data?.error) {
            const sapError = error.response.data.error;
            structuredError.sapErrorCode = sapError.code;
            structuredError.sapErrorMessage = sapError.message?.value || sapError.message;
            structuredError.sapInnerError = sapError.innererror;
        } else if (typeof error.response.data === 'string') {
            // Sometimes SAP returns error as string
            structuredError.sapErrorMessage = error.response.data;
        }
    }
    
    // Check error.cause (SAP Cloud SDK wraps errors)
    if (error.cause?.response) {
        structuredError.httpStatus = structuredError.httpStatus || error.cause.response.status;
        structuredError.httpStatusText = structuredError.httpStatusText || error.cause.response.statusText;
        structuredError.rawResponseData = structuredError.rawResponseData || error.cause.response.data;
        
        if (error.cause.response.data?.error) {
            const sapError = error.cause.response.data.error;
            structuredError.sapErrorCode = structuredError.sapErrorCode || sapError.code;
            structuredError.sapErrorMessage = structuredError.sapErrorMessage || sapError.message?.value || sapError.message;
            structuredError.sapInnerError = structuredError.sapInnerError || sapError.innererror;
        }
    }
    
    // Check error.rootCause
    if (error.rootCause?.response) {
        structuredError.httpStatus = structuredError.httpStatus || error.rootCause.response.status;
        structuredError.httpStatusText = structuredError.httpStatusText || error.rootCause.response.statusText;
        structuredError.rawResponseData = structuredError.rawResponseData || error.rootCause.response.data;
        
        if (error.rootCause.response.data?.error) {
            const sapError = error.rootCause.response.data.error;
            structuredError.sapErrorCode = structuredError.sapErrorCode || sapError.code;
            structuredError.sapErrorMessage = structuredError.sapErrorMessage || sapError.message?.value || sapError.message;
            structuredError.sapInnerError = structuredError.sapInnerError || sapError.innererror;
        }
    }
    
    return structuredError;
}

// Helper function to GET from SAP using SAP Cloud SDK via BTP Destination
// SAP Cloud SDK handles Cloud Connector routing automatically
// FALLBACK: If destination service fails, use direct axios with env variables
async function getFromSapApi(url, queryParams = {}) {
    console.log('=== SAP API GET CALL (BTP Destination via Cloud SDK) ===');
    console.log('Destination:', SAP_DESTINATION_NAME);
    console.log('URL:', url);
    console.log('sap-client:', SAP_CLIENT);
    console.log('Query Params:', JSON.stringify(queryParams, null, 2));
    
    // ENHANCED DEBUGGING: Check if destination service is accessible
    console.log('=== DESTINATION SERVICE CHECK ===');
    let destinationResolved = false;
    try {
        const { getDestination } = require('@sap-cloud-sdk/connectivity');
        console.log('Attempting to resolve destination:', SAP_DESTINATION_NAME);
        const destination = await getDestination(SAP_DESTINATION_NAME);
        console.log('Destination resolved successfully!');
        console.log('Destination URL:', destination?.url);
        console.log('Destination ProxyType:', destination?.proxyType);
        console.log('Destination Authentication:', destination?.authentication);
        destinationResolved = true;
    } catch (destError) {
        console.error('WARNING: Failed to resolve destination!');
        console.error('Destination Error:', destError.message);
        console.log('Will attempt fallback to direct connection using environment variables...');
    }
    console.log('=== END DESTINATION CHECK ===');
    
    // Try destination service approach first
    if (destinationResolved) {
        try {
            const response = await executeHttpRequest(
                { destinationName: SAP_DESTINATION_NAME },
                {
                    method: 'GET',
                    url: url,
                    params: {
                        'sap-client': SAP_CLIENT,
                        ...queryParams
                    },
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );
            
            console.log('SAP Response Status:', response.status);
            console.log('SAP Response Data:', JSON.stringify(response.data, null, 2));
            
            return response;
            
        } catch (error) {
            console.error('Destination service approach failed, will try fallback...', error.message);
            // Continue to fallback below
        }
    }
    
    // FALLBACK: Use direct axios with environment variables
    console.log('=== FALLBACK: Direct SAP Connection (GET) ===');
    const SAP_URL = process.env.SAP_URL;
    const SAP_USER = process.env.SAP_USER;
    const SAP_PASSWORD = process.env.SAP_PASSWORD;
    
    if (!SAP_URL || !SAP_USER || !SAP_PASSWORD) {
        throw new Error('SAP connection failed: Destination service unavailable and environment variables (SAP_URL, SAP_USER, SAP_PASSWORD) not configured');
    }
    
    console.log('Using direct connection to:', SAP_URL);
    console.log('User:', SAP_USER);
    
    try {
        // Build query string
        const queryString = new URLSearchParams({
            'sap-client': SAP_CLIENT,
            ...queryParams
        }).toString();
        
        const fullUrl = `${SAP_URL}${url}?${queryString}`;
        console.log('Full URL:', fullUrl);
        
        const response = await axios({
            method: 'GET',
            url: fullUrl,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            auth: {
                username: SAP_USER,
                password: SAP_PASSWORD
            },
            httpsAgent: new (require('https').Agent)({
                rejectUnauthorized: false // For self-signed certificates
            }),
            timeout: parseInt(process.env.SAP_API_TIMEOUT) || 10000 // 10 seconds default for GET
        });
        
        console.log('SAP Response Status (Direct):', response.status);
        console.log('SAP Response Data (Direct):', JSON.stringify(response.data, null, 2));
        
        return response;
        
    } catch (error) {
        console.error('=== SAP API GET ERROR ===');
        console.error('HTTP Status:', error.response?.status);
        console.error('HTTP Status Text:', error.response?.statusText);
        console.error('Error Message:', error.message);
        console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('=== END SAP ERROR ===');
        
        throw error;
    }
}

// Helper function to POST to SAP using SAP Cloud SDK via BTP Destination
// SAP Cloud SDK handles Cloud Connector routing automatically
// FALLBACK: If destination service fails, use direct axios with env variables
async function postToSapApi(payload, destinationName = SAP_DESTINATION_NAME, apiPath = SAP_API_PATH) {
    const url = apiPath;
    const destination = destinationName;
    
    console.log('=== SAP API CALL (BTP Destination via Cloud SDK) ===');
    console.log('Destination:', destination);
    console.log('URL:', url);
    console.log('sap-client:', SAP_CLIENT);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    // Extract service base URL for CSRF token fetch
    // e.g., '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch' -> '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/'
    const lastSlash = url.lastIndexOf('/');
    const serviceBaseUrl = lastSlash > 0 ? url.substring(0, lastSlash + 1) : url + '/';
    
    console.log('Service Base URL for CSRF:', serviceBaseUrl);
    
    // ENHANCED DEBUGGING: Check if destination service is accessible
    console.log('=== DESTINATION SERVICE CHECK ===');
    let destinationResolved = false;
    try {
        const { getDestination } = require('@sap-cloud-sdk/connectivity');
        console.log('Attempting to resolve destination:', destination);
        const dest = await getDestination(destination);
        console.log('Destination resolved successfully!');
        console.log('Destination URL:', dest?.url);
        console.log('Destination ProxyType:', dest?.proxyType);
        console.log('Destination Authentication:', dest?.authentication);
        destinationResolved = true;
    } catch (destError) {
        console.error('WARNING: Failed to resolve destination!');
        console.error('Destination Error:', destError.message);
        console.error('Destination Error Details:', JSON.stringify(destError, Object.getOwnPropertyNames(destError), 2));
        console.log('Will attempt fallback to direct connection using environment variables...');
    }
    console.log('=== END DESTINATION CHECK ===');
    
    // Try destination service approach first
    if (destinationResolved) {
        try {
            console.log('=== MAKING POST REQUEST (Cloud SDK with CSRF handling) ===');
            
            // SAP Cloud SDK should handle CSRF tokens automatically
            // But we need to ensure csrf middleware is enabled
            const response = await executeHttpRequest(
                { destinationName: destination },
                {
                    method: 'POST',
                    url: url,
                    params: {
                        'sap-client': SAP_CLIENT
                    },
                    data: payload,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    // Enable CSRF token handling explicitly
                    csrf: true
                }
            );
            
            console.log('SAP Response Status:', response.status);
            console.log('SAP Response Data:', JSON.stringify(response.data, null, 2));
            
            return response;
            
        } catch (error) {
            console.error('Destination service approach failed, will try fallback...');
            console.error('Error:', error.message);
            console.error('Error response:', error.response?.data);
            console.error('Error status:', error.response?.status);
            // Continue to fallback below
        }
    }
    
    // FALLBACK: Use direct axios with environment variables
    console.log('=== FALLBACK: Direct SAP Connection ===');
    const SAP_URL = process.env.SAP_URL;
    const SAP_USER = process.env.SAP_USER;
    const SAP_PASSWORD = process.env.SAP_PASSWORD;
    
    if (!SAP_URL || !SAP_USER || !SAP_PASSWORD) {
        throw new Error('SAP connection failed: Destination service unavailable and environment variables (SAP_URL, SAP_USER, SAP_PASSWORD) not configured');
    }
    
    console.log('Using direct connection to:', SAP_URL);
    console.log('User:', SAP_USER);
    
    try {
        // STEP 1: Fetch CSRF Token via direct connection
        console.log('=== FETCHING CSRF TOKEN (Direct Connection) ===');
        const csrfFetchUrl = `${SAP_URL}${serviceBaseUrl}?sap-client=${SAP_CLIENT}`;
        console.log('CSRF Fetch URL:', csrfFetchUrl);
        
        let csrfToken = null;
        let cookies = [];  // Store cookies from CSRF fetch
        
        try {
            const csrfResponse = await axios({
                method: 'GET',
                url: csrfFetchUrl,
                headers: {
                    'X-CSRF-Token': 'Fetch',
                    'Accept': 'application/json'
                },
                auth: {
                    username: SAP_USER,
                    password: SAP_PASSWORD
                },
                httpsAgent: new (require('https').Agent)({
                    rejectUnauthorized: false
                })
            });
            
            csrfToken = csrfResponse.headers['x-csrf-token'];
            // Extract cookies from response to maintain session
            const setCookieHeader = csrfResponse.headers['set-cookie'];
            if (setCookieHeader) {
                cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
                console.log('✓ Session cookies captured:', cookies.length, 'cookies');
            }
            
            console.log('✓ CSRF Token fetched:', csrfToken ? 'SUCCESS' : 'FAILED');
            console.log('CSRF Token value:', csrfToken);
        } catch (csrfError) {
            console.warn('⚠ CSRF token fetch failed:', csrfError.message);
            console.warn('Proceeding without CSRF token (POST may fail)');
        }
        
        // STEP 2: Make POST request with CSRF token AND session cookies
        console.log('=== MAKING POST REQUEST (Direct Connection) ===');
        const fullUrl = `${SAP_URL}${url}?sap-client=${SAP_CLIENT}`;
        console.log('Full URL:', fullUrl);
        
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
            console.log('✓ Including CSRF token in POST request');
        }
        
        // Include session cookies from CSRF fetch to maintain session
        if (cookies.length > 0) {
            headers['Cookie'] = cookies.map(c => c.split(';')[0]).join('; ');
            console.log('✓ Including session cookies in POST request');
        }
        
        const response = await axios({
            method: 'POST',
            url: fullUrl,
            data: payload,
            headers: headers,
            auth: {
                username: SAP_USER,
                password: SAP_PASSWORD
            },
            httpsAgent: new (require('https').Agent)({
                rejectUnauthorized: false // For self-signed certificates
            })
        });
        
        console.log('SAP Response Status (Direct):', response.status);
        console.log('SAP Response Data (Direct):', JSON.stringify(response.data, null, 2));
        
        return response;
        
    } catch (error) {
        // Extract structured SAP OData error
        const structuredError = extractSapODataError(error);
        
        console.error('=== SAP API ERROR (STEP1_POST) ===');
        console.error('HTTP Status:', structuredError.httpStatus);
        console.error('HTTP Status Text:', structuredError.httpStatusText);
        console.error('SAP Error Code:', structuredError.sapErrorCode);
        console.error('SAP Error Message:', structuredError.sapErrorMessage);
        console.error('SAP Inner Error:', JSON.stringify(structuredError.sapInnerError, null, 2));
        console.error('Raw Response Data:', JSON.stringify(structuredError.rawResponseData, null, 2));
        console.error('=== END SAP ERROR ===');
        
        // Create a detailed error to throw
        const detailedError = new Error(
            structuredError.sapErrorMessage || 
            `SAP returned HTTP ${structuredError.httpStatus}: ${structuredError.httpStatusText || 'Unknown error'}`
        );
        
        // Attach structured error details
        detailedError.sapErrorDetails = {
            httpStatus: structuredError.httpStatus,
            httpStatusText: structuredError.httpStatusText,
            sapErrorCode: structuredError.sapErrorCode,
            sapErrorMessage: structuredError.sapErrorMessage,
            sapInnerError: structuredError.sapInnerError,
            rawResponseData: structuredError.rawResponseData,
            responseData: structuredError.rawResponseData
        };
        
        throw detailedError;
    }
}

// Helper function to fetch SAP API metadata/service document as XML
async function getSapServiceDocument() {
    console.log('=== GET SAP Service Document (XML) ===');
    
    try {
        const response = await executeHttpRequest(
            { destinationName: SAP_DESTINATION_NAME },
            {
                method: 'GET',
                url: '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/',
                params: {
                    'sap-client': SAP_CLIENT
                },
                headers: {
                    'Accept': 'application/xml'
                }
            }
        );
        
        return response.data;
    } catch (error) {
        console.error('Error fetching service document:', error.message);
        return null;
    }
}

// Helper function to fetch SAP API metadata as XML
async function getSapMetadata() {
    console.log('=== GET SAP Metadata (XML) ===');
    
    try {
        const response = await executeHttpRequest(
            { destinationName: SAP_DESTINATION_NAME },
            {
                method: 'GET',
                url: '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/$metadata',
                params: {
                    'sap-client': SAP_CLIENT
                },
                headers: {
                    'Accept': 'application/xml'
                }
            }
        );
        
        return response.data;
    } catch (error) {
        console.error('Error fetching metadata:', error.message);
        return null;
    }
}

// Direct HTTPS GET function removed - now using SAP Cloud SDK via BTP Destination

// Helper function to GET LockboxBatch details from SAP (to retrieve accounting documents)
async function getLockboxBatchDetails(internalKey, batch) {
    console.log('=== GET LockboxBatch Details ===');
    console.log('InternalKey:', internalKey);
    console.log('Batch:', batch);
    
    // Read specific lockbox batch: /LockboxBatch(LockboxBatchInternalKey='xxx',LockboxBatch='001')
    const url = `${SAP_API_PATH}/LockboxBatch(LockboxBatchInternalKey='${internalKey}',LockboxBatch='${batch}')`;
    
    const response = await executeHttpRequest(
        { destinationName: SAP_DESTINATION_NAME },
        {
            method: 'GET',
            url: url,
            params: {
                'sap-client': SAP_CLIENT,
                '$expand': 'to_Item,to_Item/to_LockboxClearing'
            },
            headers: {
                'Accept': 'application/json'
            }
        }
    );
    
    console.log('LockboxBatch Response Status:', response.status);
    console.log('LockboxBatch Response Data:', JSON.stringify(response.data, null, 2));
    
    return response;
}

// Helper function to GET Business Partner Bank Details from SAP
// Uses Business Partner API to fetch payment transaction details
async function getBusinessPartnerBankDetails(customerId) {
    console.log('=== GET Business Partner Bank Details ===');
    console.log('Customer ID:', customerId);
    
    // Default fallback values
    const defaultBankDetails = {
        partnerBank: getApiFieldDefault('PartnerBank') || '15051554',
        partnerBankAccount: getApiFieldDefault('PartnerBankAccount') || '314129119',
        partnerBankCountry: getApiFieldDefault('PartnerBankCountry') || 'US',
        source: 'DEFAULT'
    };
    
    if (!customerId) {
        console.log('No customer ID provided, using default bank details');
        return defaultBankDetails;
    }
    
    try {
        // Try to fetch from Business Partner API
        // API: /sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartnerBank
        // Filter by BusinessPartner = customerId
        const bpApiPath = '/sap/opu/odata/sap/API_BUSINESS_PARTNER';
        const url = `${bpApiPath}/A_BusinessPartnerBank`;
        
        console.log('Fetching bank details from:', url);
        console.log('Filter: BusinessPartner eq', customerId);
        
        const response = await executeHttpRequest(
            { destinationName: SAP_DESTINATION_NAME },
            {
                method: 'GET',
                url: url,
                params: {
                    'sap-client': SAP_CLIENT,
                    '$filter': `BusinessPartner eq '${customerId}'`,
                    '$top': 1
                },
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('Business Partner Bank Response Status:', response.status);
        
        const bankData = response.data?.d?.results?.[0] || response.data?.value?.[0];
        
        if (bankData) {
            console.log('Found bank details from Business Partner API');
            return {
                partnerBank: bankData.BankIdentification || bankData.Bank || defaultBankDetails.partnerBank,
                partnerBankAccount: bankData.BankAccount || defaultBankDetails.partnerBankAccount,
                partnerBankCountry: bankData.BankCountryKey || bankData.BankCountry || defaultBankDetails.partnerBankCountry,
                source: 'BP_API'
            };
        } else {
            console.log('No bank details found in Business Partner API, using defaults');
            return defaultBankDetails;
        }
    } catch (error) {
        console.log('Error fetching Business Partner bank details:', error.message);
        console.log('Using default bank details as fallback');
        return defaultBankDetails;
    }
}

// Helper function to GET LockboxBatchItem details from SAP
async function getLockboxBatchItemDetails(internalKey, batch, item) {
    console.log('=== GET LockboxBatchItem Details ===');
    
    // Read specific item: /LockboxBatchItem(LockboxBatchInternalKey='xxx',LockboxBatchItem='1',LockboxBatch='001')
    const url = `${SAP_API_PATH}/LockboxBatchItem(LockboxBatchInternalKey='${internalKey}',LockboxBatchItem='${item}',LockboxBatch='${batch}')`;
    
    const response = await executeHttpRequest(
        { destinationName: SAP_DESTINATION_NAME },
        {
            method: 'GET',
            url: url,
            params: {
                'sap-client': SAP_CLIENT,
                '$expand': 'to_LockboxClearing'
            },
            headers: {
                'Accept': 'application/json'
            }
        }
    );
    
    console.log('LockboxBatchItem Response Status:', response.status);
    console.log('LockboxBatchItem Response Data:', JSON.stringify(response.data, null, 2));
    
    return response;
}

// ============================================================================
// PRE-CLEARING: Get Belnr (DocumentNumber) and CompanyCode from Invoice Number via OData API
// ============================================================================
// API: GET /sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT
// Input: P_DocumentNumber (Invoice Number)
// Output: { documentNumber: Belnr, companyCode: CompanyCode }
async function getDocumentNumberFromInvoice(invoiceNumber) {
    console.log('=== GET DocumentNumber and CompanyCode from Invoice ===');
    console.log('Invoice Number (P_DocumentNumber):', invoiceNumber);
    
    if (!invoiceNumber || invoiceNumber.trim() === '') {
        console.log('Empty invoice number, skipping API call');
        return null;
    }
    
    const oDataPath = '/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT';
    
    try {
        const response = await executeHttpRequest(
            { destinationName: SAP_DESTINATION_NAME },
            {
                method: 'GET',
                url: oDataPath,
                params: {
                    'sap-client': SAP_CLIENT,
                    'P_DocumentNumber': invoiceNumber
                },
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('DocumentNumber API Response Status:', response.status);
        console.log('DocumentNumber API Response Data:', JSON.stringify(response.data, null, 2));
        
        // Extract DocumentNumber and CompanyCode from response
        // OData v4 typically returns data in "value" array
        const data = response.data?.value?.[0] || response.data?.d?.results?.[0] || response.data?.d || response.data;
        const documentNumber = data?.DocumentNumber || data?.Belnr || null;
        const companyCode = data?.CompanyCode || null;
        
        console.log('Extracted DocumentNumber (Belnr):', documentNumber);
        console.log('Extracted CompanyCode:', companyCode);
        
        return {
            documentNumber: documentNumber,
            companyCode: companyCode
        };
        
    } catch (error) {
        console.error('Error fetching DocumentNumber for invoice', invoiceNumber, ':', error.message);
        return null; // Return null on error, will use PaymentReference as fallback
    }
}

// Helper function to enrich PaymentReferences with DocumentNumbers and CompanyCode (batch processing)
// Tries to call API in batch mode first, falls back to individual calls if needed
async function enrichPaymentReferencesWithBelnr(clearingEntries) {
    console.log('=== ENRICHING PaymentReferences with Belnr (DocumentNumber) and CompanyCode ===');
    console.log('Total clearing entries to process:', clearingEntries.length);
    
    const enrichedEntries = [];
    
    // Extract unique invoice numbers
    const invoiceNumbers = [...new Set(clearingEntries.map(c => c.PaymentReference).filter(ref => ref && ref.trim() !== ''))];
    console.log('Unique invoice numbers:', invoiceNumbers.length);
    
    // Map to store invoice -> {documentNumber, companyCode} mapping
    const invoiceToDataMap = new Map();
    
    // Try batch processing first (if SAP API supports it)
    // For now, we'll process individually as batch support depends on SAP configuration
    console.log('Processing invoices individually...');
    
    for (const invoiceNum of invoiceNumbers) {
        const result = await getDocumentNumberFromInvoice(invoiceNum);
        if (result && result.documentNumber) {
            invoiceToDataMap.set(invoiceNum, result);
            console.log(`✓ Invoice ${invoiceNum} -> DocumentNumber ${result.documentNumber}, CompanyCode ${result.companyCode || 'N/A'}`);
        } else {
            console.log(`✗ Invoice ${invoiceNum} -> No DocumentNumber found (will use PaymentReference as fallback)`);
            // Keep original PaymentReference as fallback
            invoiceToDataMap.set(invoiceNum, { documentNumber: invoiceNum, companyCode: null });
        }
    }
    
    // Apply the mapping to all clearing entries
    for (const entry of clearingEntries) {
        const originalRef = entry.PaymentReference;
        const derivedData = invoiceToDataMap.get(originalRef);
        
        enrichedEntries.push({
            ...entry,
            PaymentReference: derivedData?.documentNumber || originalRef, // Use derived Belnr or fallback to original
            CompanyCode: derivedData?.companyCode || entry.CompanyCode, // Use derived CompanyCode if available
            OriginalInvoiceNumber: originalRef // Keep original for reference
        });
    }
    
    console.log('=== ENRICHMENT COMPLETE ===');
    console.log('Successfully enriched:', enrichedEntries.filter(e => e.PaymentReference !== e.OriginalInvoiceNumber).length, '/', clearingEntries.length);
    
    return enrichedEntries;
}

// Helper function to GET LockboxClearing from SAP using SAP Cloud SDK via BTP Destination
// API: GET /sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxClearing
// Required params: PaymentAdvice, PaymentAdviceItem, PaymentAdviceAccount (Customer), PaymentAdviceAccountType (D), CompanyCode
async function getLockboxClearing(queryParams) {
    const { paymentAdvice, paymentAdviceItem, paymentAdviceAccount, paymentAdviceAccountType, companyCode } = queryParams;
    
    // Build the key for direct entity access
    // Format: LockboxClearing(PaymentAdvice='xxx',PaymentAdviceItem='1',PaymentAdviceAccount='CUST',PaymentAdviceAccountType='D',CompanyCode='1710')
    const entityKey = `LockboxClearing(PaymentAdvice='${paymentAdvice}',PaymentAdviceItem='${paymentAdviceItem || '1'}',PaymentAdviceAccount='${paymentAdviceAccount}',PaymentAdviceAccountType='${paymentAdviceAccountType || 'D'}',CompanyCode='${companyCode || '1710'}')`;
    
    console.log('=== GET LockboxClearing ===');
    console.log('Query params:', queryParams);
    console.log('Entity Key:', entityKey);
    
    try {
        const response = await executeHttpRequest(
            { destinationName: SAP_DESTINATION_NAME },
            {
                method: 'GET',
                url: `/sap/opu/odata/sap/API_LOCKBOXPOST_IN/${entityKey}`,
                params: {
                    'sap-client': SAP_CLIENT
                },
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('SAP Clearing Response Status:', response.status);
        console.log('SAP Clearing Response Data:', JSON.stringify(response.data, null, 2));
        
        return response;
    } catch (error) {
        console.error('Error fetching LockboxClearing with direct key:', error.message);
        
        // Fallback: Try with $filter approach
        console.log('Trying fallback with $filter...');
        let filterParts = [];
        if (paymentAdvice) filterParts.push(`PaymentAdvice eq '${paymentAdvice}'`);
        if (companyCode) filterParts.push(`CompanyCode eq '${companyCode}'`);
        
        const filter = filterParts.join(' and ');
        
        const fallbackResponse = await executeHttpRequest(
            { destinationName: SAP_DESTINATION_NAME },
            {
                method: 'GET',
                url: SAP_CLEARING_PATH,
                params: {
                    'sap-client': SAP_CLIENT,
                    '$filter': filter
                },
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('Fallback Response Status:', fallbackResponse.status);
        return fallbackResponse;
    }
}

// Helper function to GET LockboxClearing as raw XML from SAP
async function getLockboxClearingXml(queryParams) {
    const { internalKey, batch, paymentAdvice, companyCode } = queryParams;
    
    // Build filter based on available parameters
    let filterParts = [];
    if (internalKey) filterParts.push(`LockboxBatchInternalKey eq '${internalKey}'`);
    if (batch) filterParts.push(`LockboxBatch eq '${batch}'`);
    if (paymentAdvice) filterParts.push(`PaymentAdvice eq '${paymentAdvice}'`);
    if (companyCode) filterParts.push(`CompanyCode eq '${companyCode}'`);
    
    const filter = filterParts.join(' and ');
    
    console.log('=== GET LockboxClearing (XML) ===');
    console.log('Filter:', filter);
    
    try {
        const response = await executeHttpRequest(
            { destinationName: SAP_DESTINATION_NAME },
            {
                method: 'GET',
                url: SAP_CLEARING_PATH,
                params: {
                    'sap-client': SAP_CLIENT,
                    '$filter': filter
                },
                headers: {
                    'Accept': 'application/atom+xml'
                },
                responseType: 'text'
            }
        );
        
        console.log('SAP XML Response Status:', response.status);
        return response.data;
    } catch (error) {
        console.error('Error fetching XML:', error.message);
        return null;
    }
}

// Helper function to build SAP Lockbox payload matching exact SAP API structure
async function buildLockboxPayload(headerId, pool) {
    // Fetch header data
    const header = (await pool.query('SELECT * FROM lockbox_header WHERE id = $1', [headerId])).rows[0];
    if (!header) {
        throw new Error('Header not found');
    }
    
    // Fetch all items for this header
    const items = (await pool.query('SELECT * FROM lockbox_item WHERE header_id = $1 ORDER BY lockbox_batch, lockbox_batch_item', [headerId])).rows;
    
    // Build to_Item.results array with nested to_LockboxClearing
    const itemResults = [];
    
    for (const item of items) {
        // Fetch clearings for this item
        const clearings = (await pool.query('SELECT * FROM lockbox_clearing WHERE item_id = $1 ORDER BY payment_reference', [item.id])).rows;
        
        // Build to_LockboxClearing.results for each item
        // SAP Field Limits: PaymentReference(30), PaymentDifferenceReason(3), Currency(5)
        const clearingResults = clearings.map(c => ({
            PaymentReference: (c.payment_reference || "").substring(0, 30),
            NetPaymentAmountInPaytCurrency: c.net_payment_amount ? c.net_payment_amount.toString() : "0",
            DeductionAmountInPaytCurrency: c.deduction_amount ? c.deduction_amount.toString() : "0",
            PaymentDifferenceReason: (c.payment_difference_reason || "").substring(0, 3),
            Currency: (c.currency || item.currency || "USD").substring(0, 5)
        }));
        
        // Build item object with exact SAP field names
        // SAP Field Limits: LockboxBatch(3), LockboxBatchItem(5), Cheque(13), PartnerBank(15), PartnerBankAccount(18), PartnerBankCountry(3)
        // IMPORTANT: Always include PartnerBank fields with defaults to prevent SAP 400 errors
        const itemObj = {
            LockboxBatch: (item.lockbox_batch || "001").substring(0, 3),
            LockboxBatchItem: (item.lockbox_batch_item || "001").substring(0, 5),
            AmountInTransactionCurrency: item.amount_in_transaction_currency ? item.amount_in_transaction_currency.toString() : "0",
            Currency: (item.currency || "USD").substring(0, 5),
            Cheque: (item.cheque || "").substring(0, 13),
            // DEFAULT: Partner bank information (hardcoded defaults as per SAP requirement)
            PartnerBank: (item.partner_bank || "15051554").substring(0, 15),
            PartnerBankAccount: (item.partner_bank_account || "314129119").substring(0, 18),
            PartnerBankCountry: (item.partner_bank_country || "US").substring(0, 3)
        };
        
        // Only add to_LockboxClearing if there are clearing entries
        if (clearingResults.length > 0) {
            itemObj.to_LockboxClearing = {
                results: clearingResults
            };
        }
        
        itemResults.push(itemObj);
    }
    
    // Format deposit datetime for SAP (ISO 8601 format without milliseconds and Z)
    // Format: "2021-05-20T03:34:00"
    let depositDateTime = null;
    if (header.deposit_datetime) {
        const dt = new Date(header.deposit_datetime);
        // Format as YYYY-MM-DDTHH:MM:SS (no milliseconds, no Z)
        depositDateTime = dt.toISOString().replace(/\.\d{3}Z$/, '');
    }
    
    // Build main payload matching exact SAP API structure
    // Based on SAP template - NO CompanyCode at top level
    // SAP Field Limits: Lockbox(7), LockboxBatchOrigin(10), LockboxBatchDestination(10)
    const payload = {
        Lockbox: (header.lockbox || "").substring(0, 7),
        DepositDateTime: depositDateTime,
        AmountInTransactionCurrency: header.amount_in_transaction_currency ? header.amount_in_transaction_currency.toString() : "0",
        LockboxBatchOrigin: (header.lockbox_batch_origin || "").substring(0, 10),
        LockboxBatchDestination: (header.lockbox_batch_destination || "").substring(0, 10),
        to_Item: {
            results: itemResults
        }
    };
    
    return payload;
}

// Preview SAP payload (for debugging)
app.get('/api/lockbox/preview-payload/:headerId', async (req, res) => {
    try {
        const { headerId } = req.params;
        
        // Verify header exists
        const headerResult = await pool.query('SELECT * FROM lockbox_header WHERE id = $1', [headerId]);
        if (headerResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Header not found' });
        }
        
        // Build and return payload
        const payload = await buildLockboxPayload(headerId, pool);
        
        res.json({
            success: true,
            message: 'SAP Payload Preview',
            api_endpoint: SAP_API_PATH,
            destination: SAP_DESTINATION_NAME,
            company_code: DEFAULT_COMPANY_CODE,
            payload: payload
        });
        
    } catch (err) {
        console.error('Preview payload error:', err);
        res.status(500).json({ success: false, message: 'Failed to build payload: ' + err.message });
    }
});

// ============================================================================
// SIMULATION (Preview Mode) - LOCAL ONLY, NO SAP COMMIT
// 1. Build payload from uploaded data
// 2. Store payload temporarily in PostgreSQL
// 3. Return preview data (what WILL be sent to SAP during Production Run)
// 4. NO actual SAP API call - just prepare and preview
// ============================================================================
app.post('/api/lockbox/simulate/:headerId', async (req, res) => {
    try {
        const { headerId } = req.params;
        
        // Get header
        const headerResult = await pool.query('SELECT * FROM lockbox_header WHERE id = $1', [headerId]);
        if (headerResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Header not found' });
        }
        const header = headerResult.rows[0];
        
        // Check if already posted
        if (header.status === 'POSTED') {
            return res.status(400).json({ 
                success: false, 
                message: 'This lockbox has already been posted to SAP. Cannot simulate again.',
                sap_document_number: header.sap_document_num 
            });
        }
        
        // Build payload from database
        const payload = await buildLockboxPayload(headerId, pool);
        
        console.log('=== SIMULATION (Preview Only - No SAP Commit) ===');
        console.log(JSON.stringify(payload, null, 2));
        
        // Get items and clearing data for preview
        const items = (await pool.query(
            'SELECT * FROM lockbox_item WHERE header_id = $1 ORDER BY lockbox_batch, lockbox_batch_item', 
            [headerId]
        )).rows;
        
        // Calculate totals for preview
        let totalItems = items.length;
        let totalAmount = 0;
        let clearingProposal = [];
        
        for (const item of items) {
            totalAmount += parseFloat(item.amount_in_transaction_currency) || 0;
            
            // Get clearing entries for this item
            const clearings = (await pool.query(
                'SELECT * FROM lockbox_clearing WHERE item_id = $1 ORDER BY payment_reference', 
                [item.id]
            )).rows;
            
            clearingProposal.push({
                lockboxBatch: item.lockbox_batch,
                lockboxBatchItem: item.lockbox_batch_item,
                cheque: item.cheque,
                amount: item.amount_in_transaction_currency,
                currency: item.currency,
                partnerBank: item.partner_bank,
                partnerBankAccount: item.partner_bank_account,
                clearingItems: clearings.map(c => ({
                    paymentReference: c.payment_reference,
                    netAmount: c.net_payment_amount,
                    deductionAmount: c.deduction_amount,
                    reason: c.payment_difference_reason
                }))
            });
        }
        
        // Build clearing proposal text for display
        let clearingProposalText = clearingProposal.map((item, idx) => 
            `  Item ${idx + 1}: Batch ${item.lockboxBatch}, Cheque ${item.cheque}, Amount: ${item.amount} ${item.currency}`
        ).join('\n');
        
        // Build formatted SAP response message
        const currency = items[0]?.currency || 'USD';
        const sapResponseMessage = `
═══════════════════════════════════════════════════════════════
                    SIMULATION PREVIEW
═══════════════════════════════════════════════════════════════

📋 DERIVED PAYMENT ADVICE (Preview)
   Payment Advice: PA-${header.lockbox}-PREVIEW
   Company Code: ${DEFAULT_COMPANY_CODE}
   Lockbox: ${payload.Lockbox}

📊 CLEARING PROPOSAL (from uploaded data)
${clearingProposalText}

💰 EXPECTED GL POSTINGS SUMMARY
   Company Code: ${DEFAULT_COMPANY_CODE}
   Number of Items: ${totalItems}
   Total Amount: ${totalAmount.toFixed(2)} ${currency}

📦 NUMBER OF ITEMS & AMOUNTS
   Total Cheques/Items: ${totalItems}
   Total Amount: ${totalAmount.toFixed(2)} ${currency}

📤 PAYLOAD TO BE SENT TO SAP
   Lockbox: ${payload.Lockbox}
   Deposit DateTime: ${payload.DepositDateTime || 'N/A'}
   Amount: ${payload.AmountInTransactionCurrency}
   Origin: ${payload.LockboxBatchOrigin || 'N/A'}
   Destination: ${payload.LockboxBatchDestination || 'N/A'}
   Items Count: ${payload.to_Item?.results?.length || 0}

═══════════════════════════════════════════════════════════════
⚠️  This is a PREVIEW only. No data has been sent to SAP.
    Click "Production Run" to commit this lockbox to SAP.
═══════════════════════════════════════════════════════════════
`;

        // Build simulation preview response (NO SAP call)
        const simulationPreview = {
            simulation: true,
            status: 'SUCCESS',
            message: 'Simulation preview ready. Click Production Run to commit to SAP.',
            // Formatted message for UI display
            sapResponseMessage: sapResponseMessage,
            // Structured data
            derivedPaymentAdvice: `PA-${header.lockbox}-PREVIEW`,
            clearingProposal: clearingProposal,
            expectedGLPostings: {
                companyCode: DEFAULT_COMPANY_CODE,
                lockbox: payload.Lockbox,
                totalItems: totalItems,
                totalAmount: totalAmount.toFixed(2),
                currency: currency
            },
            numberOfItems: totalItems,
            amountInTransactionCurrency: totalAmount.toFixed(2),
            sapPayload: payload
        };
        
        // Store payload temporarily in database (for Production Run to use)
        await pool.query(
            `UPDATE lockbox_header 
             SET status = $1, sap_payload = $2, sap_simulation_response = $3 
             WHERE id = $4`,
            ['SIMULATED', JSON.stringify(payload), JSON.stringify(simulationPreview), headerId]
        );
        
        res.json({
            success: true,
            message: simulationPreview.message,
            lockbox: header.lockbox,
            simulation_result: simulationPreview,
            sap_response_message: sapResponseMessage
        });
        
    } catch (err) {
        console.error('Simulate error:', err);
        res.status(500).json({ success: false, message: 'Simulation failed: ' + err.message });
    }
});

// ============================================================================
// PRODUCTION RUN (Commit to SAP) - ACTUAL SAP POSTING
// 1. Retrieve saved payload from simulation
// 2. POST the payload to SAP (COMMITS to SAP backend)
// 3. SAP creates Payment Advice and posts FI documents
// 4. Read back: Accounting Document Number, Clearing details
// 5. Return results for UI display
// ============================================================================
app.post('/api/lockbox/post/:headerId', async (req, res) => {
    try {
        const { headerId } = req.params;
        
        // Get header with saved payload
        const headerResult = await pool.query('SELECT * FROM lockbox_header WHERE id = $1', [headerId]);
        if (headerResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Header not found' });
        }
        const header = headerResult.rows[0];
        
        // Check if already posted
        if (header.status === 'POSTED') {
            return res.status(400).json({ 
                success: false, 
                message: 'This lockbox has already been posted to SAP',
                sap_document_number: header.sap_document_num 
            });
        }
        
        // Must have simulated first to get the payload
        if (!header.sap_payload) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please run Simulation first before Production Run. No saved payload found.'
            });
        }
        
        // Use the saved payload from simulation
        const payload = JSON.parse(header.sap_payload);
        
        // ========================================================
        // UPDATE DEPOSIT DATE/TIME TO CURRENT TIMESTAMP
        // Each production run must have a unique DepositDateTime
        // This ensures SAP accepts the lockbox file as new/unique
        // ========================================================
        const currentDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, '');
        console.log('=== UPDATING DEPOSIT DATE/TIME ===');
        console.log('Original DepositDateTime:', payload.DepositDateTime);
        console.log('Updated to current time:', currentDateTime);
        
        // Update payload with current timestamp
        payload.DepositDateTime = currentDateTime;
        
        console.log('=== PRODUCTION RUN: Committing to SAP ===');
        console.log('Using saved simulation payload with updated timestamp:');
        console.log(JSON.stringify(payload, null, 2));
        
        // ========================================================
        // FETCH RULE-003 and RULE-004 API CONFIGURATIONS (Using Service)
        // ========================================================
        console.log('=== FETCHING API CONFIGURATIONS FROM RULES ===');
        
        // Use rule service for cleaner code with PostgreSQL → JSON fallback
        const rule003 = await getRuleById('RULE-003');
        const rule004 = await getRuleById('RULE-004');
        
        // Extract API configurations using helper function
        const postLockboxBatchApi = getApiConfig(rule003, 'POST');
        const getLockboxClearingApi = getApiConfig(rule003, 'GET');
        const getAccountingDocApi = getApiConfig(rule004, 'GET');
        
        console.log('API Configurations:');
        console.log('  RULE-003 POST API:', postLockboxBatchApi?.apiReference);
        console.log('  RULE-003 GET API:', getLockboxClearingApi?.apiReference);
        console.log('  RULE-004 GET API:', getAccountingDocApi?.apiReference);
        
        // ========================================================
        // LOGGING: Generate unique Run ID and record start time
        // ========================================================
        const runId = await generateRunId();
        const startedAt = new Date();
        const currency = payload.to_Item?.results?.[0]?.Currency || 'USD';
        
        console.log('=== PRODUCTION RUN LOG ===');
        console.log('Run ID:', runId);
        console.log('Started At:', startedAt.toISOString());
        
        let productionResponse;
        let docNumber = null;
        let fiscalYear = new Date().getFullYear().toString();
        let clearingData = null;
        let clearingXmlResponse = null;
        
        // Document objects for frontend display
        let postingDocument = null;
        let paymentAdviceDoc = null;
        let financialDocument = null;
        
        try {
            // ========================================================
            // STEP 0: EXTRACT COMPANY CODE (No API call needed - already enriched by RULE-001)
            // ========================================================
            console.log('=== STEP 0: EXTRACT COMPANY CODE ===');
            console.log('Note: PaymentReferences are already enriched by RULE-001 during Validation & Mapping stage');
            
            // Extract CompanyCode from the enriched data (RULE-001 already populated this)
            let derivedCompanyCode = DEFAULT_COMPANY_CODE; // Fallback to default
            
            // Check if any clearing entry has CompanyCode from RULE-001
            for (const item of payload.to_Item?.results || []) {
                if (item.to_LockboxClearing?.results) {
                    for (const clearing of item.to_LockboxClearing.results) {
                        // CompanyCode might be in the clearing entry or we can get it from mapped data
                        if (clearing.CompanyCode) {
                            derivedCompanyCode = clearing.CompanyCode;
                            console.log('✓ Found CompanyCode from enriched data (RULE-001):', derivedCompanyCode);
                            break;
                        }
                    }
                }
                if (derivedCompanyCode !== DEFAULT_COMPANY_CODE) break;
            }
            
            // If not found in clearing, try to get from database (RULE-001 stores it in mappedData)
            if (derivedCompanyCode === DEFAULT_COMPANY_CODE) {
                const mappedDataResult = await pool.query(
                    'SELECT mapped_data FROM lockbox_runs WHERE header_id = $1 ORDER BY id DESC LIMIT 1',
                    [headerId]
                );
                if (mappedDataResult.rows.length > 0 && mappedDataResult.rows[0].mapped_data) {
                    const mappedData = mappedDataResult.rows[0].mapped_data;
                    if (Array.isArray(mappedData) && mappedData.length > 0 && mappedData[0].CompanyCode) {
                        derivedCompanyCode = mappedData[0].CompanyCode;
                        console.log('✓ Found CompanyCode from mappedData (RULE-001):', derivedCompanyCode);
                    }
                }
            }
            
            if (derivedCompanyCode === DEFAULT_COMPANY_CODE) {
                console.log('⚠ No CompanyCode found in enriched data, using default:', derivedCompanyCode);
            }
            
            const RUNTIME_COMPANY_CODE = derivedCompanyCode;
            console.log('=== USING COMPANY CODE FOR THIS RUN:', RUNTIME_COMPANY_CODE, '===');
            console.log('Note: PaymentReferences in payload already contain AccountingDocument from RULE-001');
            console.log('Note: Partner Bank details already enriched by RULE-002');
            
            // ========================================================
            // STEP 1: POST /LockboxBatch - Dynamic API from RULE-003
            // ========================================================
            console.log('=== STEP 1: POST /LockboxBatch (Dynamic API from RULE-003) ===');
            console.log('API Endpoint:', postLockboxBatchApi.apiReference);
            console.log('Destination:', postLockboxBatchApi.destination);
            
            // Use dynamic API endpoint from RULE-003
            const postApiEndpoint = postLockboxBatchApi.apiReference || '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch';
            const postApiDestination = postLockboxBatchApi.destination || 'LOCKBOXDES';
            
            console.log('Calling POST API:', postApiEndpoint);
            console.log('Using Destination:', postApiDestination);
            
            const response = await postToSapApi(payload, postApiDestination, postApiEndpoint);
            
            console.log('SAP Production Response Status:', response.status);
            console.log('SAP Production Response Data:', JSON.stringify(response.data, null, 2));
            
            const sapData = response.data?.d || response.data || {};
            
            // Extract response fields
            const lockboxBatchInternalKey = sapData.LockboxBatchInternalKey || '';
            const lockboxBatch = sapData.LockboxBatch || sapData.Lockbox || '';
            const paymentAdvice = sapData.PaymentAdvice || '';
            const accountingDocument = sapData.AccountingDocument || '';
            fiscalYear = sapData.FiscalYear || fiscalYear;
            docNumber = accountingDocument;
            
            console.log('✓ Lockbox posted to SAP');
            console.log('  LockboxBatchInternalKey:', lockboxBatchInternalKey);
            console.log('  LockboxBatch:', lockboxBatch);
            console.log('  PaymentAdvice:', paymentAdvice);
            console.log('  AccountingDocument:', accountingDocument);
            console.log('  FiscalYear:', fiscalYear);
            console.log('  CompanyCode:', RUNTIME_COMPANY_CODE);
            
            productionResponse = response.data;
            
            // ========================================================
            // STEP 2: WAIT - Allow SAP to process posting
            // ========================================================
            console.log('=== STEP 2: WAITING for SAP to process posting ===');
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('✓ Wait complete');
            
            // ========================================================
            // STEP 3: GET /LockboxClearing - Dynamic API from RULE-003
            // ========================================================
            console.log('=== STEP 3: GET /LockboxClearing (Dynamic API from RULE-003) ===');
            console.log('API Endpoint:', getLockboxClearingApi.apiReference);
            console.log('Destination:', getLockboxClearingApi.destination);
            
            if (lockboxBatchInternalKey && lockboxBatch) {
                try {
                    const clearingApiEndpoint = getLockboxClearingApi.apiReference || '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxClearing';
                    const clearingApiDestination = getLockboxClearingApi.destination || 'S4HANA_SYSTEM_DESTINATION';
                    
                    const clearingQueryParams = {
                        LockboxBatchInternalKey: lockboxBatchInternalKey,
                        LockboxBatch: lockboxBatch,
                        PaymentAdvice: paymentAdvice,
                        CompanyCode: RUNTIME_COMPANY_CODE
                    };
                    
                    console.log('Query Parameters:', clearingQueryParams);
                    
                    const clearingResponse = await getLockboxClearing(clearingQueryParams, clearingApiDestination, clearingApiEndpoint);
                    clearingData = clearingResponse.data?.d?.results || [];
                    
                    console.log('✓ Retrieved', clearingData.length, 'clearing entries from SAP');
                    console.log('Clearing Data:', JSON.stringify(clearingData, null, 2));
                    
                    // Parse clearing data to extract document details
                    // Based on actual LockboxClearing API response structure after posting:
                    // - PaymentAdvice = "0100001218"
                    // - AccountingDocument = "1900005678"
                    // - FiscalYear, CompanyCode, PaymentReference, NetPaymentAmountInPaytCurrency
                    
                    if (Array.isArray(clearingData) && clearingData.length > 0) {
                        const firstClearing = clearingData[0];
                        
                        console.log('First clearing entry:', JSON.stringify(firstClearing, null, 2));
                        
                        // Extract fields from LockboxClearing API
                        const paymentAdviceNum = firstClearing.PaymentAdvice || '';
                        const accountingDocNum = firstClearing.AccountingDocument || '';
                        
                        console.log('=== EXTRACTED DOCUMENT NUMBERS ===');
                        console.log('PaymentAdvice:', paymentAdviceNum);
                        console.log('AccountingDocument:', accountingDocNum);
                        
                        // Update fiscal year from clearing data if available
                        if (firstClearing.FiscalYear) {
                            fiscalYear = firstClearing.FiscalYear;
                        }
                        
                        // 1. POSTING DOCUMENT - from AccountingDocument
                        postingDocument = {
                            type: 'Posting Document',
                            description: 'AR Posting Document (Accounting Document)',
                            documentNumber: accountingDocNum || 'N/A',
                            companyCode: firstClearing.CompanyCode || RUNTIME_COMPANY_CODE,
                            fiscalYear: firstClearing.FiscalYear || fiscalYear,
                            entries: clearingData.map(c => ({
                                accountingDocument: c.AccountingDocument,
                                paymentAdvice: c.PaymentAdvice,
                                paymentReference: c.PaymentReference,
                                amount: c.NetPaymentAmountInPaytCurrency,
                                currency: c.Currency,
                                companyCode: c.CompanyCode,
                                fiscalYear: c.FiscalYear
                            }))
                        };
                        
                        // 2. PAYMENT ADVICE - from PaymentAdvice field
                        paymentAdviceDoc = {
                            type: 'Payment Advice',
                            description: 'Payment Advice Document',
                            documentNumber: paymentAdviceNum || 'N/A',
                            companyCode: firstClearing.CompanyCode || RUNTIME_COMPANY_CODE,
                            entries: clearingData.map(c => ({
                                paymentAdvice: c.PaymentAdvice,
                                paymentAdviceItem: c.PaymentAdviceItem,
                                paymentAdviceAccount: c.PaymentAdviceAccount,
                                accountingDocument: c.AccountingDocument,
                                paymentReference: c.PaymentReference,
                                netAmount: c.NetPaymentAmountInPaytCurrency,
                                deductionAmount: c.DeductionAmountInPaytCurrency,
                                currency: c.Currency
                            }))
                        };
                        
                        // 3. CLEARING/FINANCIAL DOCUMENT - same as AccountingDocument
                        financialDocument = {
                            type: 'Clearing Document',
                            description: 'Clearing Document (Accounting Document)',
                            documentNumber: accountingDocNum || 'N/A',
                            companyCode: firstClearing.CompanyCode || RUNTIME_COMPANY_CODE,
                            fiscalYear: firstClearing.FiscalYear || fiscalYear,
                            entries: clearingData.map(c => ({
                                accountingDocument: c.AccountingDocument,
                                paymentAdvice: c.PaymentAdvice,
                                paymentReference: c.PaymentReference,
                                amount: c.NetPaymentAmountInPaytCurrency,
                                currency: c.Currency
                            }))
                        };
                        
                        console.log('Documents created from LockboxClearing:');
                        console.log('  AR Posting Document (AccountingDocument):', accountingDocNum);
                        console.log('  Payment Advice:', paymentAdviceNum);
                        console.log('  Total clearing entries:', clearingData.length);
                    }
                    
                    // Also fetch the raw XML response for display
                    try {
                        const xmlResponse = await getLockboxClearingXml({
                            internalKey: internalKey,
                            batch: batch,
                            paymentAdvice: paymentAdviceFromPost,
                            companyCode: RUNTIME_COMPANY_CODE
                        });
                        if (xmlResponse) {
                            clearingXmlResponse = xmlResponse;
                            console.log('Raw XML response fetched successfully');
                        }
                    } catch (xmlError) {
                        console.log('Could not fetch XML response:', xmlError.message);
                    }
                } catch (clearingError) {
                    console.error('Failed to get clearing data:', clearingError.message);
                    console.error('Clearing error details:', clearingError);
                    clearingData = { note: 'Clearing data fetch failed, but document was posted successfully' };
                }
            } else {
                console.log('Cannot fetch clearing data - no identifiers available from POST response');
            }
            
            // FALLBACK: If clearing data not available, create documents from POST response data
            if (!postingDocument && !paymentAdviceDoc && !financialDocument) {
                console.log('Creating fallback documents from POST response...');
                
                // Use any available data from POST response
                postingDocument = {
                    type: 'Posting Document',
                    description: 'FI Document (Lockbox Posting)',
                    documentNumber: sapData.ClearingAccountingDocument || sapData.AccountingDocument || internalKey || 'Pending',
                    companyCode: RUNTIME_COMPANY_CODE,
                    fiscalYear: fiscalYear,
                    entries: []
                };
                
                paymentAdviceDoc = {
                    type: 'Payment Advice',
                    description: 'Incoming Customer Payment',
                    documentNumber: sapData.PaymentAdvice || internalKey || 'Pending',
                    companyCode: RUNTIME_COMPANY_CODE,
                    entries: []
                };
                
                financialDocument = {
                    type: 'Customer Posting',
                    description: 'Customer Incoming Payment (Posting Area 1)',
                    documentNumber: sapData.AccountingDocument || internalKey || 'Pending',
                    companyCode: RUNTIME_COMPANY_CODE,
                    fiscalYear: fiscalYear,
                    entries: []
                };
                
                console.log('Fallback documents created from POST response');
            }

            productionResponse = {
                posted: true,
                status: 'SUCCESS',
                message: 'Document successfully posted',
                httpStatus: response.status,
                // Lockbox summary
                lockbox: payload.Lockbox,
                amount: payload.AmountInTransactionCurrency,
                postingStatus: 'POSTED',
                // SAP Response data for run logging
                sapResponse: {
                    batch: batch,
                    internalKey: internalKey,
                    fiscalYear: fiscalYear,
                    clearingData: clearingData
                },
                // Documents
                documents: {
                    postingDocument: postingDocument,
                    paymentAdvice: paymentAdviceDoc,
                    financialDocument: financialDocument
                },
                // Raw data
                lockboxBatchInternalKey: internalKey,
                lockboxBatch: batch,
                fiscalYear: fiscalYear,
                clearingData: clearingData
            };
            
        } catch (apiError) {
            console.error('=== SAP PRODUCTION RUN ERROR (STEP1_POST) ===');
            
            // Use structured error details from postToSapApi
            const sapDetails = apiError.sapErrorDetails || {};
            
            console.error('HTTP Status:', sapDetails.httpStatus);
            console.error('SAP Error Code:', sapDetails.sapErrorCode);
            console.error('SAP Error Message:', sapDetails.sapErrorMessage);
            console.error('Raw Response:', JSON.stringify(sapDetails.rawResponseData, null, 2));
            
            // Build the production response with structured error
            productionResponse = {
                posted: false,
                status: 'ERROR',
                message: sapDetails.sapErrorMessage 
                    ? `STEP 1 FAILED: ${sapDetails.sapErrorMessage}`
                    : `STEP 1 FAILED (HTTP ${sapDetails.httpStatus || 'Error'}): ${apiError.message}`,
                error: apiError.message,
                httpStatus: sapDetails.httpStatus,
                sapErrorCode: sapDetails.sapErrorCode,
                sapErrorMessage: sapDetails.sapErrorMessage,
                sapInnerError: sapDetails.sapInnerError,
                details: sapDetails.rawResponseData,
                errorXml: null,
                rawErrorResponse: sapDetails.rawResponseData
            };
            
            console.error('=== END PRODUCTION ERROR ===');
        }
        
        // Update database with results
        const finalStatus = productionResponse.status === 'SUCCESS' ? 'POSTED' : 'POST_FAILED';
        const completedAt = new Date();
        
        console.log('=== PRODUCTION RUN STATUS ===');
        console.log('Status:', finalStatus);
        
        // ========================================================
        // LOGGING: Persist immutable run logs (Tables A, B, C)
        // ========================================================
        try {
            console.log('=== PERSISTING RUN LOGS ===');
            
            // Table A: lockbox_run_log - One entry per production run
            await persistRunLog(
                runId,
                headerId,
                header.lockbox,
                RUNTIME_COMPANY_CODE,
                'PRODUCTION',
                finalStatus,
                parseFloat(payload.AmountInTransactionCurrency) || 0,
                currency,
                startedAt,
                completedAt
            );
            console.log('✅ Run log persisted:', runId);
            
            // Table B: sap_response_log - SAP clearing data
            if (clearingData && Array.isArray(clearingData) && clearingData.length > 0) {
                await persistSapResponseLog(
                    runId,
                    clearingData,
                    productionResponse.sapResponse || productionResponse,
                    clearingXmlResponse
                );
                console.log('✅ SAP response log persisted for', clearingData.length, 'entries');
            }
            
            // Table C: line_level_clearing - Line-item clearing details
            if (clearingData && Array.isArray(clearingData) && clearingData.length > 0) {
                await persistLineLevelClearing(
                    runId,
                    clearingData,
                    RUNTIME_COMPANY_CODE
                );
                console.log('✅ Line-level clearing log persisted');
            }
            
            console.log('=== RUN LOGGING COMPLETE ===');
            console.log('Run ID:', runId);
            console.log('Duration:', (completedAt - startedAt) / 1000, 'seconds');
            
        } catch (logError) {
            console.error('⚠️ Error persisting run logs (non-fatal):', logError.message);
            // Continue with the response - logging failure should not break the main flow
        }
        
        // Update lockbox_header with status only (simplified)
        await pool.query(
            `UPDATE lockbox_header 
             SET status = $1, sap_document_num = $2, sap_fiscal_year = $3, sap_response = $4
             WHERE id = $5`,
            [
                finalStatus, 
                docNumber || '', 
                fiscalYear, 
                JSON.stringify(productionResponse), 
                headerId
            ]
        );
        
        // Build FINAL clean JSON response for frontend
        const finalResponse = {
            success: productionResponse.status === 'SUCCESS',
            message: productionResponse.message,
            // Run ID for audit trail
            run_id: runId,
            // Lockbox summary for header display
            lockbox_summary: {
                lockbox: productionResponse.lockbox || header.lockbox,
                amount: productionResponse.amount || payload.AmountInTransactionCurrency,
                status: productionResponse.postingStatus || (productionResponse.status === 'SUCCESS' ? 'POSTED' : 'POST_FAILED')
            },
            // Key results
            sap_document_number: docNumber,
            sap_fiscal_year: fiscalYear
        };
        
        // Add error details for failed responses
        if (productionResponse.status !== 'SUCCESS') {
            finalResponse.error = {
                message: productionResponse.error,
                httpStatus: productionResponse.httpStatus,
                sapErrorCode: productionResponse.sapErrorCode,
                sapErrorMessage: productionResponse.sapErrorMessage,
                sapInnerError: productionResponse.sapInnerError,
                details: productionResponse.details,
                xmlResponse: productionResponse.errorXml,
                rawResponse: productionResponse.rawErrorResponse
            };
        }
        
        // ========================================================
        // STEP 4: RETRIEVE CLEARING DOCUMENTS (RULE-004)
        // Automatically fetch document details after successful posting
        // ========================================================
        let clearingDocuments = [];
        console.log('=== CHECKING IF RULE-004 SHOULD BE CALLED ===');
        console.log('productionResponse.status:', productionResponse.status);
        console.log('header.lockbox:', header.lockbox);
        console.log('Should call RULE-004:', productionResponse.status === 'SUCCESS' && header.lockbox);
        
        if (productionResponse.status === 'SUCCESS' && header.lockbox) {
            try {
                console.log('=== RETRIEVING CLEARING DOCUMENTS (RULE-004) ===');
                console.log('Lockbox ID:', header.lockbox);
                
                // Fetch RULE-004 configuration
                const rule004 = await getRuleById('RULE-004');
                console.log('RULE-004 found:', !!rule004);
                
                if (rule004) {
                    const getAccountingDocApi = getApiConfig(rule004, 'GET');
                    console.log('API Config found:', !!getAccountingDocApi);
                    console.log('API Reference:', getAccountingDocApi?.apiReference);
                    
                    if (getAccountingDocApi && getAccountingDocApi.apiReference) {
                        const apiEndpoint = getAccountingDocApi.apiReference;
                        const destination = getAccountingDocApi.destination || 'S4HANA_SYSTEM_DESTINATION';
                        const inputFieldName = getAccountingDocApi.inputField || 'LockBoxId';
                        
                        const queryParams = {
                            $filter: `${inputFieldName} eq '${header.lockbox}'`
                        };
                        
                        const outputFields = getAccountingDocApi.outputField ? 
                            getAccountingDocApi.outputField.split(',').map(f => f.trim()) : 
                            ['DocumentNumber', 'PaymentAdvice', 'SubledgerDocument', 'CompanyCode', 'SubledgerOnaccountDocument'];
                        
                        if (outputFields.length > 0) {
                            queryParams.$select = outputFields.join(',');
                        }
                        
                        console.log('Calling RULE-004 API:', apiEndpoint);
                        console.log('Destination:', destination);
                        console.log('Query:', queryParams);
                        
                        // Call SAP API
                        const rule004Response = await sapClient.executeSapGetRequest(
                            destination,
                            apiEndpoint,
                            queryParams
                        );
                        
                        const results = rule004Response.data?.d?.results || rule004Response.data?.value || [];
                        console.log('✓ Retrieved', results.length, 'clearing documents from SAP');
                        console.log('SAP Response:', JSON.stringify(results, null, 2));
                        
                        // Format documents
                        for (let i = 0; i < results.length; i++) {
                            const sapDoc = results[i];
                            clearingDocuments.push({
                                lineItem: sapDoc.LineItem || (i + 1).toString().padStart(4, '0'),
                                documentNumber: sapDoc.DocumentNumber || sapDoc.documentNumber || '',
                                paymentAdvice: sapDoc.PaymentAdvice || sapDoc.paymentAdvice || '',
                                subledgerDocument: sapDoc.SubledgerDocument || sapDoc.subledgerDocument || '',
                                subledgerOnaccountDocument: sapDoc.SubledgerOnaccountDocument || sapDoc.subledgerOnaccountDocument || '',
                                amount: sapDoc.Amount || sapDoc.amount || '',
                                companyCode: RUNTIME_COMPANY_CODE // From RULE-001
                            });
                        }
                        
                        console.log('✓ Formatted', clearingDocuments.length, 'clearing documents for response');
                    } else {
                        console.warn('⚠ RULE-004 API configuration not found or invalid');
                    }
                } else {
                    console.warn('⚠ RULE-004 not found in rules configuration');
                }
            } catch (rule004Error) {
                console.error('❌ RULE-004 retrieval failed (non-fatal):', rule004Error.message);
                console.error('Stack:', rule004Error.stack);
                // Continue - RULE-004 failure should not break production run
            }
        } else {
            console.log('✗ RULE-004 not called - conditions not met');
        }
        
        console.log('=== FINAL RESPONSE TO FRONTEND ===');
        console.log('run_id:', finalResponse.run_id);
        console.log('Success:', finalResponse.success);
        console.log('Clearing Documents:', clearingDocuments.length);
        if (!finalResponse.success) {
            console.log('Error Message:', finalResponse.message);
            console.log('SAP Error Message:', finalResponse.error?.sapErrorMessage);
            console.log('Error Details:', JSON.stringify(finalResponse.error, null, 2));
        }
        
        // Add clearing documents to final response
        if (clearingDocuments.length > 0) {
            finalResponse.clearingDocuments = clearingDocuments;
            
            // ========================================================
            // SAVE CLEARING DOCUMENTS TO PROCESSING RUN
            // So they're available when Transaction Dialog opens
            // ========================================================
            try {
                console.log('=== SAVING CLEARING DOCUMENTS TO RUN ===');
                // Find the run in lockboxProcessingRuns
                const runIndex = lockboxProcessingRuns.findIndex(r => r.runId === runId);
                if (runIndex >= 0) {
                    lockboxProcessingRuns[runIndex].clearingDocuments = clearingDocuments;
                    // Save to JSON file
                    saveRunsToFile();
                    console.log('✓ Clearing documents saved to run:', runId);
                } else {
                    console.warn('⚠ Run not found in lockboxProcessingRuns:', runId);
                }
            } catch (saveError) {
                console.error('❌ Failed to save clearing documents:', saveError.message);
                // Non-fatal - response still sent
            }
        }
        
        res.json(finalResponse);
        
    } catch (err) {
        console.error('Production run error:', err);
        res.status(500).json({ success: false, message: 'Production run failed: ' + err.message });
    }
});

// ============================================================================
// RETRIEVE CLEARING DOCUMENTS - Using RULE-004 (Dynamic SAP API Call)
// Similar pattern to RULE-001 and RULE-002
// Fetches accounting document details from SAP and updates Lockbox Data
// Updates both PostgreSQL (if available) and JSON fallback
// ============================================================================
app.post('/api/lockbox/retrieve-clearing/:headerId', async (req, res) => {
    try {
        const { headerId } = req.params;
        const { lockboxId: providedLockboxId } = req.body; // Optional: lockbox ID from frontend
        
        console.log('=== RETRIEVING CLEARING DOCUMENTS FROM SAP (RULE-004) ===');
        console.log('Header ID:', headerId);
        console.log('Provided Lockbox ID:', providedLockboxId);
        
        // Get header - try database first
        let header = null;
        let lockboxId = providedLockboxId; // Use provided ID if available
        let items = [];
        let useDatabase = true;
        
        if (!lockboxId) {
            // Try to get from database
            try {
                const headerResult = await pool.query('SELECT * FROM lockbox_header WHERE id = $1', [headerId]);
                if (headerResult.rows.length > 0) {
                    header = headerResult.rows[0];
                    lockboxId = header.lockbox;
                    
                    // Get items
                    const itemsResult = await pool.query('SELECT * FROM lockbox_item WHERE header_id = $1', [headerId]);
                    items = itemsResult.rows;
                    
                    console.log('✓ Found header in database');
                    console.log('  Lockbox ID:', lockboxId);
                    console.log('  Status:', header.status);
                } else {
                    return res.status(404).json({ success: false, message: 'Header not found' });
                }
            } catch (dbError) {
                console.warn('⚠ Database query failed:', dbError.message);
                useDatabase = false;
                
                // Check if we have lockbox ID from request body
                if (!providedLockboxId) {
                    return res.status(400).json({
                        success: false,
                        message: 'Database unavailable and no lockbox ID provided. Please provide lockboxId in request body.',
                        error: 'MISSING_LOCKBOX_ID'
                    });
                }
                
                console.log('✓ Using provided Lockbox ID from request:', providedLockboxId);
            }
        } else {
            console.log('✓ Using provided Lockbox ID from request:', lockboxId);
            useDatabase = false; // Skip database operations if ID is provided
        }
        
        // Check status if we have header from database
        if (header && header.status !== 'POSTED') {
            return res.status(400).json({ 
                success: false, 
                message: 'Lockbox must be posted before retrieving clearing documents. Current status: ' + header.status
            });
        }
        
        console.log('Processing with Lockbox ID:', lockboxId);
        
        // ========================================================
        // STEP 1: Fetch RULE-004 Configuration Dynamically
        // ========================================================
        const rule004 = await getRuleById('RULE-004');
        if (!rule004) {
            return res.status(500).json({ success: false, message: 'RULE-004 configuration not found' });
        }
        
        const getAccountingDocApi = getApiConfig(rule004, 'GET');
        if (!getAccountingDocApi || !getAccountingDocApi.apiReference) {
            return res.status(500).json({ success: false, message: 'RULE-004 API configuration not found' });
        }
        
        console.log('RULE-004 Configuration:');
        console.log('  API Endpoint:', getAccountingDocApi.apiReference);
        console.log('  Destination:', getAccountingDocApi.destination);
        console.log('  Input Field:', getAccountingDocApi.inputField);
        console.log('  Output Fields:', getAccountingDocApi.outputField);
        
        // ========================================================
        // STEP 2: Build Dynamic SAP Query (Similar to RULE-001/002)
        // ========================================================
        // Use the complete Lockbox ID as-is (no extraction or modification)
        // Examples:
        //   "1710" -> Query: LockBoxId eq '1710'
        //   "1000172" -> Query: LockBoxId eq '1000172'
        //   "1000172-001" -> Query: LockBoxId eq '1000172-001'
        const cleanLockboxId = lockboxId; // Use as-is
        console.log('Using LockBoxId for query:', cleanLockboxId);
        
        const apiEndpoint = getAccountingDocApi.apiReference;
        const destination = getAccountingDocApi.destination || 'S4HANA_SYSTEM_DESTINATION';
        
        // Build OData query dynamically with exact LockboxId
        const inputFieldName = getAccountingDocApi.inputField || 'LockBoxId';
        const queryParams = {
            $filter: `${inputFieldName} eq '${cleanLockboxId}'`
        };
        
        // Parse output fields from RULE-004 configuration
        const outputFields = getAccountingDocApi.outputField ? 
            getAccountingDocApi.outputField.split(',').map(f => f.trim()) : 
            ['DocumentNumber', 'PaymentAdvice', 'SubledgerDocument', 'CompanyCode', 'SubledgerOnaccountDocument'];
        
        if (outputFields.length > 0) {
            queryParams.$select = outputFields.join(',');
        }
        
        console.log('Dynamic Query Parameters:', queryParams);
        
        // ========================================================
        // STEP 3: Call SAP API using sap-client (Same as RULE-001/002)
        // ========================================================
        console.log('Calling SAP API...');
        const response = await sapClient.executeSapGetRequest(
            destination,
            apiEndpoint,
            queryParams
        );
        
        const results = response.data?.d?.results || response.data?.value || [];
        console.log('✓ Retrieved', results.length, 'clearing document entries from SAP');
        
        if (results.length === 0) {
            return res.json({
                success: true,
                message: 'No clearing documents found for Lockbox ID: ' + cleanLockboxId,
                documents: [],
                updated: false
            });
        }
        
        console.log('SAP Response Data:', JSON.stringify(results, null, 2));
        
        // ========================================================
        // STEP 4: Update Lockbox Data (PostgreSQL if available)
        // NOTE: Company Code is already set by RULE-001, don't overwrite it
        // Only update: DocumentNumber, PaymentAdvice, SubledgerDocument, SubledgerOnaccountDocument
        // ========================================================
        const formattedDocs = [];
        
        for (let i = 0; i < results.length; i++) {
            const sapDoc = results[i];
            
            // Extract values dynamically based on output field configuration
            const documentNumber = sapDoc.DocumentNumber || sapDoc.documentNumber || '';
            const paymentAdvice = sapDoc.PaymentAdvice || sapDoc.paymentAdvice || '';
            const subledgerDocument = sapDoc.SubledgerDocument || sapDoc.subledgerDocument || '';
            const subledgerOnaccountDoc = sapDoc.SubledgerOnaccountDocument || sapDoc.subledgerOnaccountDocument || '';
            
            // Get existing company code from lockbox item (set by RULE-001)
            let existingCompanyCode = '';
            
            // Update database only if available and we have items
            if (useDatabase && items[i]) {
                const item = items[i];
                existingCompanyCode = item.company_code || ''; // Use existing from RULE-001
                
                try {
                    await pool.query(`
                        UPDATE lockbox_item 
                        SET 
                            ar_posting_doc = $1,
                            payment_advice = $2,
                            clearing_doc = $3
                        WHERE id = $4
                    `, [
                        documentNumber,
                        paymentAdvice,
                        subledgerDocument,
                        item.id
                    ]);
                    console.log(`✓ Updated item ${item.id} in database (preserved Company Code from RULE-001: ${existingCompanyCode})`);
                } catch (updateError) {
                    console.warn(`⚠ Failed to update item ${item.id}:`, updateError.message);
                }
            }
            
            // Format for response - use existing company code from item, not from SAP
            formattedDocs.push({
                companyCode: existingCompanyCode, // From RULE-001, not RULE-004
                lockboxId: cleanLockboxId,
                documentNumber: documentNumber,
                paymentAdvice: paymentAdvice,
                subledgerDocument: subledgerDocument,
                subledgerOnaccountDocument: subledgerOnaccountDoc
            });
        }
        
        console.log('✓ Retrieved and formatted', formattedDocs.length, 'clearing documents');
        console.log('✓ Preserved Company Code from RULE-001 (not overwritten by RULE-004)');
        
        // ========================================================
        // STEP 5: Return Response for Dialog Update
        // ========================================================
        res.json({
            success: true,
            message: useDatabase ? 
                'Clearing documents retrieved and updated in database successfully' : 
                'Clearing documents retrieved successfully (database unavailable)',
            documents: formattedDocs,
            count: formattedDocs.length,
            updated: useDatabase
        });
        
    } catch (err) {
        console.error('Retrieve clearing documents error:', err);
        console.error('Stack trace:', err.stack);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to retrieve clearing documents: ' + err.message 
        });
    }
});

// ============================================================================
// LOCKBOX RUN LOG API ENDPOINTS - Fetch immutable audit logs
// ============================================================================

// Get all lockbox runs (Run Log List)
app.get('/api/runs', async (req, res) => {
    try {
        const { lockbox, status, limit = 100 } = req.query;
        
        let query = `
            SELECT 
                lrl.run_id,
                lrl.lockbox,
                lrl.company_code,
                lrl.mode,
                lrl.status,
                lrl.amount,
                lrl.currency,
                lrl.started_at,
                lrl.completed_at,
                lrl.created_at,
                -- Get first SAP response details for display
                (SELECT accounting_document FROM sap_response_log WHERE run_id = lrl.run_id LIMIT 1) as accounting_document,
                (SELECT payment_advice FROM sap_response_log WHERE run_id = lrl.run_id LIMIT 1) as payment_advice
            FROM lockbox_run_log lrl
        `;
        
        const params = [];
        const conditions = [];
        
        if (lockbox) {
            params.push(lockbox);
            conditions.push(`lrl.lockbox = $${params.length}`);
        }
        if (status) {
            params.push(status);
            conditions.push(`lrl.status = $${params.length}`);
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY lrl.started_at DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));
        
        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            count: result.rows.length,
            runs: result.rows.map(row => ({
                runId: row.run_id,
                lockbox: row.lockbox,
                companyCode: row.company_code,
                mode: row.mode,
                status: row.status,
                amount: row.amount,
                currency: row.currency,
                startedAt: row.started_at,
                completedAt: row.completed_at,
                createdAt: row.created_at,
                // Display fields
                accountingDocument: row.accounting_document,
                paymentAdvice: row.payment_advice
            }))
        });
        
    } catch (err) {
        console.error('Error fetching run logs:', err);
        res.status(500).json({ error: 'Failed to fetch run logs', message: err.message });
    }
});

// Get single run details (with SAP response and clearing data)
app.get('/api/run/:runId', async (req, res) => {
    try {
        const { runId } = req.params;
        
        // Get run header
        const runResult = await pool.query(
            'SELECT * FROM lockbox_run_log WHERE run_id = $1',
            [runId]
        );
        
        if (runResult.rows.length === 0) {
            return res.status(404).json({ error: 'Run not found' });
        }
        
        const run = runResult.rows[0];
        
        // Get SAP response logs
        const sapResponseResult = await pool.query(
            'SELECT * FROM sap_response_log WHERE run_id = $1 ORDER BY created_at',
            [runId]
        );
        
        // Get line-level clearing
        const clearingResult = await pool.query(
            'SELECT * FROM line_level_clearing WHERE run_id = $1 ORDER BY created_at',
            [runId]
        );
        
        // Get the associated lockbox header if available
        let lockboxHeader = null;
        if (run.header_id) {
            const headerResult = await pool.query(
                'SELECT sap_payload, sap_simulation_response FROM lockbox_header WHERE id = $1',
                [run.header_id]
            );
            if (headerResult.rows.length > 0) {
                lockboxHeader = {
                    sapPayload: headerResult.rows[0].sap_payload ? JSON.parse(headerResult.rows[0].sap_payload) : null,
                    simulationResponse: headerResult.rows[0].sap_simulation_response ? JSON.parse(headerResult.rows[0].sap_simulation_response) : null
                };
            }
        }
        
        res.json({
            success: true,
            run: {
                runId: run.run_id,
                lockbox: run.lockbox,
                companyCode: run.company_code,
                mode: run.mode,
                status: run.status,
                amount: run.amount,
                currency: run.currency,
                startedAt: run.started_at,
                completedAt: run.completed_at,
                duration: run.completed_at ? (new Date(run.completed_at) - new Date(run.started_at)) / 1000 : null
            },
            sapResponses: sapResponseResult.rows.map(row => ({
                entity: row.entity,
                paymentAdvice: row.payment_advice,
                paymentAdviceItem: row.payment_advice_item,
                accountingDocument: row.accounting_document,
                fiscalYear: row.fiscal_year,
                lockboxBatch: row.lockbox_batch,
                lockboxBatchInternalKey: row.lockbox_batch_internal_key,
                currency: row.currency,
                amount: row.amount,
                rawSapResponse: row.raw_sap_response ? JSON.parse(row.raw_sap_response) : null,
                rawSapXml: row.raw_sap_xml
            })),
            lineLevelClearing: clearingResult.rows.map(row => ({
                paymentReference: row.payment_reference,
                invoice: row.invoice,
                clearedAmount: row.cleared_amount,
                currency: row.currency,
                companyCode: row.company_code
            })),
            inputData: lockboxHeader
        });
        
    } catch (err) {
        console.error('Error fetching run details:', err);
        res.status(500).json({ error: 'Failed to fetch run details', message: err.message });
    }
});

// Get runs for a specific lockbox
app.get('/api/lockbox/:lockboxId/runs', async (req, res) => {
    try {
        const { lockboxId } = req.params;
        
        const result = await pool.query(
            `SELECT 
                lrl.run_id,
                lrl.status,
                lrl.amount,
                lrl.currency,
                lrl.started_at,
                lrl.completed_at,
                (SELECT accounting_document FROM sap_response_log WHERE run_id = lrl.run_id LIMIT 1) as accounting_document,
                (SELECT payment_advice FROM sap_response_log WHERE run_id = lrl.run_id LIMIT 1) as payment_advice
             FROM lockbox_run_log lrl
             WHERE lrl.lockbox = $1
             ORDER BY lrl.started_at DESC`,
            [lockboxId]
        );
        
        res.json({
            success: true,
            lockbox: lockboxId,
            count: result.rows.length,
            runs: result.rows.map(row => ({
                runId: row.run_id,
                status: row.status,
                amount: row.amount,
                currency: row.currency,
                startedAt: row.started_at,
                completedAt: row.completed_at,
                accountingDocument: row.accounting_document,
                paymentAdvice: row.payment_advice
            }))
        });
        
    } catch (err) {
        console.error('Error fetching runs for lockbox:', err);
        res.status(500).json({ error: 'Failed to fetch runs for lockbox', message: err.message });
    }
});

// =============================================================================
// FIELD MAPPING RULES APIs
// In-memory storage for Customer Templates, Field Mapping Rules, API Fields, OData Services
// =============================================================================

// Initialize Field Mapping Rules data
let customerTemplates = [
    { templateId: "TPL-001", name: "Standard Excel Template", fileType: "EXCEL", templateType: "STANDARD", description: "Default Excel lockbox template", fileName: "standard_template.xlsx", active: true, createdAt: new Date().toISOString(), lastModified: new Date().toISOString() },
    { templateId: "TPL-002", name: "Bank of America CSV", fileType: "CSV", templateType: "CUSTOM", description: "BOA specific CSV format", fileName: "boa_template.csv", active: true, createdAt: new Date().toISOString(), lastModified: new Date().toISOString() },
    { templateId: "TPL-003", name: "Chase BAI2 Format", fileType: "BAI2", templateType: "CUSTOM", description: "Chase bank BAI2 lockbox", fileName: "chase_bai2.bai2", active: true, createdAt: new Date().toISOString(), lastModified: new Date().toISOString() },
    { templateId: "TPL-004", name: "Wells Fargo Payment Advice", fileType: "PAYMENT_ADVICE", templateType: "CUSTOM", description: "Wells Fargo payment advice format", fileName: "wf_payment.txt", active: false, createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }
];

// ============ FILE PATTERNS - Replacing Customer Templates ============
// File patterns define the structure of incoming files for automatic detection and processing
// Default patterns - will be seeded to database if not exists
const DEFAULT_FILE_PATTERNS = [
    // ===== EXCEL PATTERNS =====
    {
        patternId: "PAT-001",
        patternName: "Single Check - Single Invoice",
        fileType: "EXCEL",
        patternType: "SINGLE_CHECK_SINGLE_INVOICE",
        category: "CHECK",
        description: "One check pays exactly one invoice. Simple 1:1 relationship.",
        delimiter: "",
        active: true,
        priority: 10,
        fieldMappings: { checkField: "Check Number", amountField: "Check Amount", invoiceField: "Invoice Number", invoiceAmountField: "Invoice Amount", customerField: "Customer", dateField: "Deposit Date" },
        detection: { rowCount: "SINGLE_OR_MULTIPLE", checkUnique: true, invoiceUnique: true },
        conditions: [],
        processingRules: ["PAD_CHECK", "VALIDATE_AMOUNT"]
    },
    {
        patternId: "PAT-002",
        patternName: "Single Check - Multiple Invoices",
        fileType: "EXCEL",
        patternType: "SINGLE_CHECK_MULTI_INVOICE",
        category: "CHECK",
        description: "One check pays multiple invoices. Check info on first row, subsequent rows have empty check fields.",
        delimiter: "",
        active: true,
        priority: 20,
        fieldMappings: { checkField: "Check Number", amountField: "Check Amount", invoiceField: "Invoice Number", invoiceAmountField: "Invoice Amount", customerField: "Customer", dateField: "Deposit Date", deductionField: "Deduction Amount", reasonField: "Reason Code" },
        detection: { rowCount: "MULTIPLE", checkUnique: false, checkFillDownEmpty: true, invoiceUnique: true },
        conditions: [],
        processingRules: ["FILL_DOWN_CHECK", "PAD_CHECK", "SUM_INVOICE_AMOUNTS", "VALIDATE_AMOUNT"]
    },
    {
        patternId: "PAT-003",
        patternName: "Invoice Split (Comma)",
        fileType: "EXCEL",
        patternType: "INVOICE_SPLIT",
        category: "INVOICE",
        description: "Invoice field contains comma-separated values like '90004206, 207, 208'. Common prefix detection enabled.",
        delimiter: ",",
        active: true,
        priority: 100,
        fieldMappings: { checkField: "Check Number", amountField: "Check Amount", invoiceField: "Invoice Number", invoiceAmountField: "Invoice Amount", customerField: "Customer", dateField: "Deposit Date" },
        detection: { invoiceDelimited: true, delimiter: "," },
        conditions: [
            { priority: 1, detectionCondition: 'Invoice contains ","', strategy: "OUTSTANDING_AMOUNT_MATCH", condition: "OPEN_AR_AVAILABLE = YES", fallbackAction: "HOLD_IN_SUSPENSE", externalDependency: "SAP_AR_Data" },
            { priority: 2, detectionCondition: 'Invoice contains ","', strategy: "EQUAL_AMOUNT_SPLIT", condition: "DEFAULT", fallbackAction: "HOLD_IN_SUSPENSE", externalDependency: "" }
        ],
        commonPrefixDetection: true,
        processingRules: ["COMMON_PREFIX_DETECT", "SPLIT_INVOICE", "PAD_CHECK", "SUM_INVOICE_AMOUNTS", "VALIDATE_AMOUNT"]
    },
    {
        patternId: "PAT-004",
        patternName: "Invoice Range Pattern",
        fileType: "EXCEL",
        patternType: "INVOICE_RANGE",
        category: "INVOICE",
        description: "Invoice field contains ranges like '90004206-90004210'. Expands to individual invoices.",
        delimiter: "-",
        active: true,
        priority: 110,
        fieldMappings: { checkField: "Check Number", amountField: "Check Amount", invoiceField: "Invoice Number", invoiceAmountField: "Invoice Amount" },
        detection: { invoiceDelimited: true, delimiter: "-", isRange: true },
        conditions: [
            { priority: 1, detectionCondition: 'Invoice contains "-"', strategy: "RANGE_EXPAND", condition: "VALID_RANGE", fallbackAction: "MANUAL_REVIEW", externalDependency: "" },
            { priority: 2, detectionCondition: 'Range expanded', strategy: "EQUAL_AMOUNT_SPLIT", condition: "DEFAULT", fallbackAction: "HOLD_IN_SUSPENSE", externalDependency: "" }
        ],
        processingRules: ["EXPAND_RANGE", "SPLIT_INVOICE", "PAD_CHECK", "VALIDATE_AMOUNT"]
    },
    {
        patternId: "PAT-005",
        patternName: "Check Split (Comma)",
        fileType: "EXCEL",
        patternType: "CHECK_SPLIT",
        category: "CHECK",
        description: "Check field contains comma-separated check numbers like '1001, 1002, 1003'.",
        delimiter: ",",
        active: true,
        priority: 90,
        fieldMappings: { checkField: "Check Number", amountField: "Check Amount", invoiceField: "Invoice Number" },
        detection: { checkDelimited: true, delimiter: "," },
        conditions: [
            { priority: 1, detectionCondition: 'Check contains ","', strategy: "SPLIT_BY_DELIMITER", condition: "DEFAULT", fallbackAction: "MANUAL_REVIEW", externalDependency: "" }
        ],
        processingRules: ["SPLIT_CHECK", "PAD_CHECK", "VALIDATE_AMOUNT"]
    },
    {
        patternId: "PAT-006",
        patternName: "Multiple Sheets",
        fileType: "EXCEL",
        patternType: "MULTI_SHEET",
        category: "MULTI_SHEET",
        description: "Excel workbook with multiple sheets. Each sheet processed separately.",
        delimiter: "",
        active: true,
        priority: 50,
        fieldMappings: { checkField: "Check Number", amountField: "Check Amount", invoiceField: "Invoice Number" },
        detection: { multiSheet: true },
        conditions: [],
        processingRules: ["PROCESS_ALL_SHEETS", "MERGE_RESULTS"]
    },
    // ===== BAI2 BANK PATTERNS =====
    {
        patternId: "PAT-007",
        patternName: "BAI2 Bank Format",
        fileType: "BAI2",
        patternType: "BAI2_BANK",
        category: "BANK",
        description: "Standard BAI2 bank file format with record types 01, 02, 03, 16, 88, 49.",
        delimiter: "",
        active: true,
        priority: 200,
        bankCode: "CHASE",
        accountIdentifier: "",
        transactionCodes: "115,165,175,275,375",
        fieldMappings: {},
        detection: { recordType01: "File Header", recordType02: "Group Header", recordType03: "Account Identifier", recordType16: "Transaction Detail" },
        conditions: [
            { priority: 1, detectionCondition: "Transaction Code = 115", strategy: "LOCKBOX_DEPOSIT", condition: "AMOUNT > 0", fallbackAction: "LOG_ERROR", externalDependency: "Bank_Master" },
            { priority: 2, detectionCondition: "Transaction Code = 165", strategy: "CHECK_DEPOSIT", condition: "AMOUNT > 0", fallbackAction: "LOG_ERROR", externalDependency: "Bank_Master" },
            { priority: 3, detectionCondition: "Transaction Code = 175", strategy: "ACH_CREDIT", condition: "DEFAULT", fallbackAction: "MANUAL_REVIEW", externalDependency: "" }
        ],
        processingRules: ["PARSE_BAI2", "EXTRACT_TRANSACTIONS"]
    },
    // ===== PDF PATTERNS =====
    {
        patternId: "PAT-008",
        patternName: "PDF Payment Advice",
        fileType: "PDF",
        patternType: "PDF_EXTRACTION",
        category: "EXTRACTION",
        description: "Payment advice in PDF format. Uses OCR and pattern matching to extract payment details.",
        delimiter: "",
        active: true,
        priority: 210,
        fieldMappings: { checkPattern: "Check\\s*#?:\\s*(\\d+)", invoicePattern: "Invoice\\s*#?:\\s*(\\d+)", amountPattern: "\\$([\\d,]+\\.\\d{2})" },
        pdfFields: [
            { fieldName: "Customer Number", extractionPattern: "Customer\\s*#?:\\s*(\\d+)", fieldType: "TEXT", required: true, defaultValue: "" },
            { fieldName: "Invoice Number", extractionPattern: "Invoice\\s*#?:\\s*(\\d+)", fieldType: "TEXT", required: true, defaultValue: "" },
            { fieldName: "Date", extractionPattern: "(\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4})", fieldType: "DATE", required: true, defaultValue: "" },
            { fieldName: "Amount", extractionPattern: "\\$([\\d,]+\\.\\d{2})", fieldType: "AMOUNT", required: true, defaultValue: "" },
            { fieldName: "Payment Reference", extractionPattern: "Ref\\s*#?:\\s*(\\w+)", fieldType: "TEXT", required: false, defaultValue: "" }
        ],
        conditions: [
            { priority: 1, detectionCondition: "Field Pattern Match", strategy: "REGEX_EXTRACT", condition: "FIELD_FOUND = YES", fallbackAction: "USE_DEFAULT", externalDependency: "" },
            { priority: 2, detectionCondition: "OCR Confidence > 80%", strategy: "REGEX_EXTRACT", condition: "CONFIDENCE > 0.8", fallbackAction: "MANUAL_REVIEW", externalDependency: "" }
        ],
        processingRules: ["OCR_EXTRACT", "PATTERN_MATCH"]
    },
    // ===== PAYMENT ADVICE PATTERNS =====
    {
        patternId: "PAT-009",
        patternName: "Payment Advice Split",
        fileType: "PAYMENT_ADVICE",
        patternType: "PAYMENT_ADVICE_SPLIT",
        category: "INVOICE",
        description: "Payment advice with split conditions for invoice matching and amount distribution.",
        delimiter: "",
        active: true,
        priority: 220,
        splitType: "BY_INVOICE",
        amountThreshold: 10000,
        autoMatchOpenItems: true,
        createSuspenseEntry: false,
        fieldMappings: { customerField: "Customer", invoiceField: "Invoice Number", amountField: "Amount", dateField: "Payment Date" },
        conditions: [
            { priority: 1, detectionCondition: "Invoice Count > 1", strategy: "OUTSTANDING_AMOUNT_MATCH", condition: "OPEN_AR_AVAILABLE = YES", fallbackAction: "HOLD_IN_SUSPENSE", externalDependency: "SAP_AR_Data" },
            { priority: 2, detectionCondition: "Amount > Threshold", strategy: "SPLIT_BY_INVOICE", condition: "AMOUNT > 10000", fallbackAction: "MANUAL_REVIEW", externalDependency: "" },
            { priority: 3, detectionCondition: "Single Invoice", strategy: "DIRECT_MATCH", condition: "DEFAULT", fallbackAction: "AUTO_CLEAR", externalDependency: "SAP_AR" }
        ],
        processingRules: ["MATCH_OPEN_ITEMS", "SPLIT_BY_INVOICE"]
    },
    // ===== CSV PATTERNS =====
    {
        patternId: "PAT-010",
        patternName: "CSV Standard Format",
        fileType: "CSV",
        patternType: "SINGLE_CHECK_MULTI_INVOICE",
        category: "CHECK",
        description: "Standard CSV format with comma-separated fields.",
        delimiter: ",",
        active: true,
        priority: 30,
        fieldMappings: { checkField: "Check Number", amountField: "Check Amount", invoiceField: "Invoice Number", invoiceAmountField: "Invoice Amount" },
        detection: { rowCount: "MULTIPLE" },
        conditions: [],
        processingRules: ["PAD_CHECK", "VALIDATE_AMOUNT"]
    }
];

// In-memory cache for file patterns (backed by PostgreSQL)
let filePatterns = [...DEFAULT_FILE_PATTERNS];
let patternIdCounter = 11;

// Processing Rules (API integration rules)
let processingRules = [];
let processingRuleIdCounter = 6;

const PROCESSING_RULES_FILE = path.join(__dirname, 'data', 'processing_rules.json');

// Load processing rules from file
function loadProcessingRulesFromFile() {
    try {
        if (fs.existsSync(PROCESSING_RULES_FILE)) {
            const data = fs.readFileSync(PROCESSING_RULES_FILE, 'utf8');
            processingRules = JSON.parse(data);
            console.log('Loaded', processingRules.length, 'processing rules from file');
            
            // Set counter
            const maxId = processingRules.reduce((max, r) => {
                const num = parseInt(r.ruleId.split('-')[1]);
                return num > max ? num : max;
            }, 0);
            processingRuleIdCounter = maxId + 1;
            
            // Pass rules to rule engine
            const ruleEngine = require('./srv/handlers/rule-engine');
            ruleEngine.loadProcessingRules(processingRules);
            console.log(`✅ Processing rules loaded into rule engine from file: ${processingRules.length}`);
        }
    } catch (err) {
        console.error('Error loading processing rules from file:', err.message);
        processingRules = [];
    }
}

// Save processing rules to file
function saveProcessingRulesToFile() {
    try {
        ensureDataDir();
        fs.writeFileSync(PROCESSING_RULES_FILE, JSON.stringify(processingRules, null, 2));
        console.log('Processing rules saved to file:', processingRules.length, 'rules');
    } catch (err) {
        console.error('Error saving processing rules to file:', err.message);
    }
}

// ============================================================================
// PROCESSING RULES - PostgreSQL Functions
// ============================================================================

// Save processing rule to PostgreSQL
async function saveProcessingRuleToDb(rule) {
    if (!dbAvailable) {
        console.log('⚠️ Database not available, rule saved to file backup only');
        return { success: false, reason: 'Database not available' };
    }
    
    try {
        console.log('💾 Saving processing rule to PostgreSQL (LB_Processing_Rules):', rule.ruleId);
        
        const query = `
            INSERT INTO lb_processing_rules 
            (id, rule_id, rule_name, description, file_type, rule_type, active, priority, 
             destination, conditions, api_mappings, field_mappings, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
            ON CONFLICT (rule_id) DO UPDATE SET
                rule_name = EXCLUDED.rule_name,
                description = EXCLUDED.description,
                file_type = EXCLUDED.file_type,
                rule_type = EXCLUDED.rule_type,
                active = EXCLUDED.active,
                priority = EXCLUDED.priority,
                destination = EXCLUDED.destination,
                conditions = EXCLUDED.conditions,
                api_mappings = EXCLUDED.api_mappings,
                field_mappings = EXCLUDED.field_mappings,
                updated_at = CURRENT_TIMESTAMP
        `;
        
        await pool.query(query, [
            rule.id || uuidv4(),
            rule.ruleId,
            rule.ruleName || rule.rule_name || '',
            rule.description || '',
            rule.fileType || rule.file_type || 'EXCEL',
            rule.ruleType || rule.rule_type || 'VALIDATION',
            rule.active !== false,
            rule.priority || 10,
            rule.destination || '',
            JSON.stringify(rule.conditions || []),
            JSON.stringify(rule.apiMappings || rule.api_mappings || []),
            JSON.stringify(rule.fieldMappings || rule.field_mappings || [])
        ]);
        
        console.log('✅ Processing rule saved to LB_Processing_Rules table:', rule.ruleId);
        return { success: true };
    } catch (err) {
        console.error('❌ Error saving processing rule to LB_Processing_Rules:', err.message);
        console.error('Rule data:', JSON.stringify(rule, null, 2));
        return { success: false, error: err.message };
    }
}

// Load all processing rules from PostgreSQL
async function loadProcessingRulesFromDb() {
    if (!dbAvailable) {
        console.log('Database not available, loading processing rules from file backup');
        loadProcessingRulesFromFile();
        return;
    }
    
    try {
        const result = await pool.query('SELECT * FROM lb_processing_rules ORDER BY priority ASC');
        
        if (result.rows.length === 0) {
            console.log('No processing rules in LB_Processing_Rules table, loading from file...');
            loadProcessingRulesFromFile();
        } else {
            processingRules = result.rows.map(row => ({
                id: row.id,
                ruleId: row.rule_id,
                ruleName: row.rule_name,
                description: row.description,
                fileType: row.file_type,
                ruleType: row.rule_type,
                active: row.active,
                priority: row.priority,
                destination: row.destination,
                conditions: row.conditions || [],
                apiMappings: row.api_mappings || [],
                fieldMappings: row.field_mappings || [],
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
            
            console.log('Loaded', processingRules.length, 'processing rules from LB_Processing_Rules table');
        }
        
        // Update rule counter
        const maxId = processingRules.reduce((max, r) => {
            const match = r.ruleId.match(/RULE-(\d+)/);
            const num = match ? parseInt(match[1], 10) : 0;
            return num > max ? num : max;
        }, 0);
        processingRuleIdCounter = maxId + 1;
        
        // Save to file as backup
        saveProcessingRulesToFile();
        
        // Pass rules to rule engine
        const ruleEngine = require('./srv/handlers/rule-engine');
        ruleEngine.loadProcessingRules(processingRules);
        console.log(`✅ Processing rules loaded into rule engine: ${processingRules.length}`);
        
    } catch (err) {
        console.error('Error loading processing rules from LB_Processing_Rules:', err.message);
        loadProcessingRulesFromFile();
    }
}

// Delete processing rule from PostgreSQL
async function deleteProcessingRuleFromDb(ruleId) {
    if (!dbAvailable) {
        console.log('Database not available, rule deleted from file only');
        return;
    }
    
    try {
        await pool.query('DELETE FROM lb_processing_rules WHERE rule_id = $1', [ruleId]);
        console.log('Processing rule deleted from LB_Processing_Rules table:', ruleId);
    } catch (err) {
        console.error('Error deleting processing rule from LB_Processing_Rules:', err.message);
    }
}

// ================================================================================
// BATCH TEMPLATES - Store uploaded file structures
// Each uploaded file is stored as a template with detected fields
// ================================================================================
let batchTemplates = [];
let batchTemplateIdCounter = 1;

const TEMPLATES_BACKUP_FILE = path.join(__dirname, 'data', 'batch_templates.json');

// Save templates to file backup
function saveTemplatesToFile() {
    try {
        ensureDataDir();
        fs.writeFileSync(TEMPLATES_BACKUP_FILE, JSON.stringify(batchTemplates, null, 2));
        console.log('Templates saved to backup file:', batchTemplates.length, 'templates');
    } catch (err) {
        console.error('Error saving templates to file:', err.message);
    }
}

// Load templates from file backup
function loadTemplatesFromFile() {
    try {
        if (fs.existsSync(TEMPLATES_BACKUP_FILE)) {
            const data = fs.readFileSync(TEMPLATES_BACKUP_FILE, 'utf8');
            batchTemplates = JSON.parse(data);
            console.log('Loaded', batchTemplates.length, 'templates from backup file');
            
            // Update template counter
            const maxId = batchTemplates.reduce((max, t) => {
                const num = parseInt(t.templateId.replace('TPL-', ''), 10);
                return isNaN(num) ? max : (num > max ? num : max);
            }, 0);
            batchTemplateIdCounter = maxId + 1;
        }
    } catch (err) {
        console.error('Error loading templates from file:', err.message);
    }
}

// Create a new batch template from uploaded file
function createBatchTemplate(filename, fileType, headers, sampleData, rowCount) {
    const templateId = `TPL-${String(batchTemplateIdCounter++).padStart(4, '0')}`;
    
    // Generate field mappings based on detected headers
    const fieldMappings = {};
    const sapFieldMap = {
        'Customer': 'Customer',
        'Check Number': 'Cheque',
        'CheckNumber': 'Cheque',
        'Check Amount': 'AmountInTransactionCurrency',
        'CheckAmount': 'AmountInTransactionCurrency',
        'Invoice Number': 'PaymentReference',
        'InvoiceNumber': 'PaymentReference',
        'Invoice Amount': 'NetPaymentAmountInPaytCurrency',
        'InvoiceAmount': 'NetPaymentAmountInPaytCurrency',
        'Deduction Amount': 'DeductionAmountInPaytCurrency',
        'DeductionAmount': 'DeductionAmountInPaytCurrency',
        'Reason Code': 'PaymentDifferenceReason',
        'ReasonCode': 'PaymentDifferenceReason',
        'Deposit Date': 'DepositDateTime',
        'DepositDate': 'DepositDateTime'
    };
    
    headers.forEach((header, index) => {
        const normalizedHeader = header.replace(/\s+/g, '');
        fieldMappings[header] = {
            index: index,
            originalHeader: header,
            normalizedHeader: normalizedHeader,
            sapField: sapFieldMap[header] || sapFieldMap[normalizedHeader] || null,
            dataType: 'String',
            required: ['Customer', 'Check Number', 'Check Amount'].includes(header)
        };
    });
    
    const template = {
        id: require('crypto').randomUUID(),
        templateId: templateId,
        templateName: `Template for ${filename}`,
        originalFilename: filename,
        fileType: fileType,
        fileSize: 0,
        uploadDate: new Date().toISOString(),
        detectedHeaders: headers,
        fieldMappings: fieldMappings,
        sampleData: sampleData.slice(0, 5), // Store first 5 rows as sample
        rowCount: rowCount,
        columnCount: headers.length,
        headerRow: 1,
        dataStartRow: 2,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    batchTemplates.push(template);
    saveTemplatesToFile();
    
    console.log(`Created batch template: ${templateId} for file: ${filename}`);
    console.log(`  - Detected ${headers.length} columns: ${headers.join(', ')}`);
    console.log(`  - ${rowCount} data rows`);
    
    return template;
}

// File-based backup for patterns (when DB not available)
const PATTERNS_BACKUP_FILE = path.join(__dirname, 'data', 'file_patterns.json');

// Save patterns to file backup
function savePatternsToFile() {
    try {
        ensureDataDir();
        fs.writeFileSync(PATTERNS_BACKUP_FILE, JSON.stringify(filePatterns, null, 2));
        console.log('Patterns saved to backup file:', filePatterns.length, 'patterns');
    } catch (err) {
        console.error('Error saving patterns to file:', err.message);
    }
}

// Load patterns from file backup
function loadPatternsFromFile() {
    try {
        if (fs.existsSync(PATTERNS_BACKUP_FILE)) {
            const data = fs.readFileSync(PATTERNS_BACKUP_FILE, 'utf8');
            filePatterns = JSON.parse(data);
            console.log('Loaded', filePatterns.length, 'patterns from backup file');
            
            // Update pattern counter
            const maxId = filePatterns.reduce((max, p) => {
                const num = parseInt(p.patternId.replace('PAT-', ''), 10);
                return num > max ? num : max;
            }, 0);
            patternIdCounter = maxId + 1;
            
            // Pass patterns to pattern engine
            const patternEngine = require('./srv/handlers/pattern-engine');
            patternEngine.loadFilePatterns(filePatterns);
            console.log(`✅ File patterns loaded into pattern engine from file: ${filePatterns.length}`);
        } else {
            // Use defaults and save to file
            filePatterns = [...DEFAULT_FILE_PATTERNS];
            savePatternsToFile();
        }
    } catch (err) {
        console.error('Error loading patterns from file:', err.message);
        filePatterns = [...DEFAULT_FILE_PATTERNS];
    }
}

// Save pattern to PostgreSQL
async function savePatternToDb(pattern) {
    if (!dbAvailable) {
        console.log('Database not available, pattern saved to file backup only');
        return;
    }
    
    try {
        const query = `
            INSERT INTO file_pattern 
            (id, pattern_id, pattern_name, file_type, pattern_type, category, description, 
             delimiter, active, priority, conditions, actions, field_mappings, detection, pdf_fields,
             processing_rules, bank_code, account_identifier, transaction_codes, split_type,
             amount_threshold, auto_match_open_items, create_suspense_entry, 
             common_prefix_detection, pad_check_numbers, sum_invoice_amounts, 
             header_row, data_start_row, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, CURRENT_TIMESTAMP)
            ON CONFLICT (pattern_id) DO UPDATE SET
                pattern_name = EXCLUDED.pattern_name,
                file_type = EXCLUDED.file_type,
                pattern_type = EXCLUDED.pattern_type,
                category = EXCLUDED.category,
                description = EXCLUDED.description,
                delimiter = EXCLUDED.delimiter,
                active = EXCLUDED.active,
                priority = EXCLUDED.priority,
                conditions = EXCLUDED.conditions,
                actions = EXCLUDED.actions,
                field_mappings = EXCLUDED.field_mappings,
                detection = EXCLUDED.detection,
                pdf_fields = EXCLUDED.pdf_fields,
                processing_rules = EXCLUDED.processing_rules,
                bank_code = EXCLUDED.bank_code,
                account_identifier = EXCLUDED.account_identifier,
                transaction_codes = EXCLUDED.transaction_codes,
                split_type = EXCLUDED.split_type,
                amount_threshold = EXCLUDED.amount_threshold,
                auto_match_open_items = EXCLUDED.auto_match_open_items,
                create_suspense_entry = EXCLUDED.create_suspense_entry,
                common_prefix_detection = EXCLUDED.common_prefix_detection,
                pad_check_numbers = EXCLUDED.pad_check_numbers,
                sum_invoice_amounts = EXCLUDED.sum_invoice_amounts,
                header_row = EXCLUDED.header_row,
                data_start_row = EXCLUDED.data_start_row,
                updated_at = CURRENT_TIMESTAMP
        `;
        
        await pool.query(query, [
            pattern.id || uuidv4(),
            pattern.patternId,
            pattern.patternName,
            pattern.fileType,
            pattern.patternType,
            pattern.category,
            pattern.description,
            pattern.delimiter,
            pattern.active,
            pattern.priority,
            JSON.stringify(pattern.conditions || []),
            JSON.stringify(pattern.actions || []),
            JSON.stringify(pattern.fieldMappings || {}),
            JSON.stringify(pattern.detection || {}),
            JSON.stringify(pattern.pdfFields || []),
            JSON.stringify(pattern.processingRules || []),
            pattern.bankCode,
            pattern.accountIdentifier,
            pattern.transactionCodes,
            pattern.splitType,
            pattern.amountThreshold,
            pattern.autoMatchOpenItems,
            pattern.createSuspenseEntry,
            pattern.commonPrefixDetection,
            pattern.padCheckNumbers,
            pattern.sumInvoiceAmounts,
            pattern.headerRow || 1,
            pattern.dataStartRow || 2
        ]);
        
        console.log('Pattern saved to database:', pattern.patternId);
    } catch (err) {
        console.error('Error saving pattern to database:', err.message);
    }
}

// Load all patterns from PostgreSQL
async function loadPatternsFromDb() {
    if (!dbAvailable) {
        console.log('Database not available, loading patterns from file backup');
        loadPatternsFromFile();
        return;
    }
    
    try {
        const result = await pool.query('SELECT * FROM file_pattern ORDER BY priority ASC');
        
        if (result.rows.length === 0) {
            // No patterns in DB, seed with defaults
            console.log('No patterns in database, seeding with defaults...');
            for (const pattern of DEFAULT_FILE_PATTERNS) {
                await savePatternToDb(pattern);
            }
            filePatterns = [...DEFAULT_FILE_PATTERNS];
        } else {
            filePatterns = result.rows.map(row => ({
                id: row.id,
                patternId: row.pattern_id,
                patternName: row.pattern_name,
                fileType: row.file_type,
                patternType: row.pattern_type,
                category: row.category,
                description: row.description,
                delimiter: row.delimiter,
                active: row.active,
                priority: row.priority,
                conditions: row.conditions || [],
                actions: row.actions || [],
                fieldMappings: row.field_mappings || {},
                detection: row.detection || {},
                pdfFields: row.pdf_fields || [],
                processingRules: row.processing_rules || [],
                bankCode: row.bank_code,
                accountIdentifier: row.account_identifier,
                transactionCodes: row.transaction_codes,
                splitType: row.split_type,
                amountThreshold: row.amount_threshold,
                autoMatchOpenItems: row.auto_match_open_items,
                createSuspenseEntry: row.create_suspense_entry,
                commonPrefixDetection: row.common_prefix_detection,
                padCheckNumbers: row.pad_check_numbers,
                sumInvoiceAmounts: row.sum_invoice_amounts,
                headerRow: row.header_row,
                dataStartRow: row.data_start_row,
                createdAt: row.created_at,
                lastModified: row.updated_at
            }));
            
            console.log('Loaded', filePatterns.length, 'patterns from database');
        }
        
        // Update pattern counter
        const maxId = filePatterns.reduce((max, p) => {
            const num = parseInt(p.patternId.replace('PAT-', ''), 10);
            return num > max ? num : max;
        }, 0);
        patternIdCounter = maxId + 1;
        
        // Save to file as backup
        savePatternsToFile();
        
        // Pass patterns to pattern engine
        const patternEngine = require('./srv/handlers/pattern-engine');
        patternEngine.loadFilePatterns(filePatterns);
        console.log(`✅ File patterns loaded into pattern engine: ${filePatterns.length}`);
        
    } catch (err) {
        console.error('Error loading patterns from database:', err.message);
        loadPatternsFromFile();
    }
}

// Delete pattern from PostgreSQL
async function deletePatternFromDb(patternId) {
    if (!dbAvailable) {
        console.log('Database not available, pattern deleted from memory/file only');
        return;
    }
    
    try {
        await pool.query('DELETE FROM file_pattern WHERE pattern_id = $1', [patternId]);
        console.log('Pattern deleted from database:', patternId);
    } catch (err) {
        console.error('Error deleting pattern from database:', err.message);
    }
}
let fieldMappingRules = [
    // ===== Rules for TPL-001 (Standard Excel Template) =====
    { ruleId: "RULE-001", templateId: "TPL-001", ruleName: "Invoice Split Rule", fileFormat: "EXCEL", category: "INVOICE", ruleType: "SPLIT", triggerSummary: "When Invoice field contains comma", active: true, priority: 10, description: "Splits comma-separated invoice numbers like '90004206, 207, 208' into separate records with common prefix detection", triggerConditions: [{ attribute: "CUSTOMER_FIELD", operator: "CONTAINS", value: ",", logic: "AND" }], splitSettings: { delimiter: ",", rangeSeparator: "-", outputMode: "EXPLODE", preserveOriginal: false }, createdAt: new Date().toISOString(), lastChanged: new Date().toISOString() },
    
    { ruleId: "RULE-007", templateId: "TPL-001", ruleName: "Date Format Conversion (US)", fileFormat: "EXCEL", category: "DATE", ruleType: "VALIDATE", triggerSummary: "Convert MM/DD/YYYY to ISO format", active: true, priority: 5, description: "Converts US date format (10/25/2025) to ISO format (2025-10-25) for SAP compatibility", triggerConditions: [], validateSettings: { validationType: "SOFT" }, createdAt: new Date().toISOString(), lastChanged: new Date().toISOString() },
    
    { ruleId: "RULE-008", templateId: "TPL-001", ruleName: "Amount Validation (Positive)", fileFormat: "EXCEL", category: "AMOUNT", ruleType: "VALIDATE", triggerSummary: "Validate amounts are positive", active: true, priority: 8, description: "Validates CheckAmount, InvoiceAmount, DeductionAmount are >= 0 and properly formatted to 2 decimal places", triggerConditions: [], validateSettings: { validationType: "SOFT", minValue: 0, maxValue: 999999999.99, allowNegative: false, decimalPlaces: 2 }, createdAt: new Date().toISOString(), lastChanged: new Date().toISOString() },
    
    { ruleId: "RULE-009", templateId: "TPL-001", ruleName: "Cheque Number Padding", fileFormat: "EXCEL", category: "CHEQUE", ruleType: "TEXT_CONVERSION", triggerSummary: "Pad cheque number to 13 characters", active: true, priority: 12, description: "Ensures cheque number is padded with leading zeros to SAP required length of 13 characters", triggerConditions: [], textConversionSettings: { conversionType: "PAD_LEFT", targetFields: "CheckNumber,Cheque", length: 13, char: "0" }, createdAt: new Date().toISOString(), lastChanged: new Date().toISOString() },
    
    { ruleId: "RULE-010", templateId: "TPL-001", ruleName: "Invoice Number Cleanup", fileFormat: "EXCEL", category: "INVOICE", ruleType: "TEXT_CONVERSION", triggerSummary: "Extract numeric invoice number", active: true, priority: 11, description: "Removes non-numeric characters from invoice numbers and trims whitespace", triggerConditions: [], textConversionSettings: { conversionType: "TRIM", targetFields: "InvoiceNumber,PaymentReference" }, createdAt: new Date().toISOString(), lastChanged: new Date().toISOString() },
    
    // ===== Rules for TPL-002 (Bank of America CSV) =====
    { ruleId: "RULE-002", templateId: "TPL-002", ruleName: "Amount Validation", fileFormat: "CSV", category: "AMOUNT", ruleType: "VALIDATE", triggerSummary: "Validate amount > 0", active: true, priority: 5, description: "Validates payment amounts are greater than zero", triggerConditions: [{ attribute: "AMOUNT", operator: "GREATER_THAN", value: "0", logic: "AND" }], validateSettings: { validationType: "HARD", errorCode: "ERR_INVALID_AMOUNT", errorMessage: "Amount must be greater than zero", stopProcessing: true, minValue: 0.01, maxValue: 999999999.99 }, createdAt: new Date().toISOString(), lastChanged: new Date().toISOString() },
    
    { ruleId: "RULE-011", templateId: "TPL-002", ruleName: "Currency Symbol Removal", fileFormat: "CSV", category: "AMOUNT", ruleType: "TEXT_CONVERSION", triggerSummary: "Remove $ € symbols from amounts", active: true, priority: 3, description: "Strips currency symbols and thousand separators from amount fields", triggerConditions: [], textConversionSettings: { conversionType: "REPLACE", targetFields: "CheckAmount,InvoiceAmount,DeductionAmount", findText: "[$€£¥,\\s]", replaceWith: "" }, createdAt: new Date().toISOString(), lastChanged: new Date().toISOString() },
    
    // ===== Rules for TPL-003 (Chase BAI2 Format) =====
    { ruleId: "RULE-003", templateId: "TPL-003", ruleName: "Date Format Conversion (EU)", fileFormat: "BAI2", category: "DATE", ruleType: "VALIDATE", triggerSummary: "Convert DD-MM-YYYY to ISO format", active: true, priority: 5, description: "Converts European date format to ISO format for SAP", triggerConditions: [], validateSettings: { validationType: "SOFT" }, createdAt: new Date().toISOString(), lastChanged: new Date().toISOString() },
    
    { ruleId: "RULE-004", templateId: "TPL-003", ruleName: "Cheque Number Derive", fileFormat: "BAI2", category: "CHEQUE", ruleType: "DERIVE", triggerSummary: "Derive from transaction code", active: true, priority: 20, description: "Derives cheque number from BAI2 transaction code field", triggerConditions: [{ attribute: "FILE_TYPE", operator: "EQUALS", value: "BAI2", logic: "AND" }], deriveSettings: { formula: "EXTRACT_NUMERIC(Transaction_Code)", sourceFields: "Transaction_Code", defaultValue: "0000000000000" }, createdAt: new Date().toISOString(), lastChanged: new Date().toISOString() },
    
    // ===== Rules for TPL-004 (Wells Fargo Payment Advice) =====
    { ruleId: "RULE-005", templateId: "TPL-004", ruleName: "Payment Allocation FIFO", fileFormat: "PDF", category: "AMOUNT", ruleType: "ALLOCATE", triggerSummary: "Allocate payment to open invoices", active: true, priority: 25, description: "FIFO (First In First Out) allocation of payment amounts across multiple invoices", triggerConditions: [{ attribute: "AMOUNT", operator: "GREATER_THAN", value: "0", logic: "AND" }], allocateSettings: { method: "FIFO", roundingRule: "ADJUST_LAST", tolerance: 0.01, decimalPlaces: 2 }, createdAt: new Date().toISOString(), lastChanged: new Date().toISOString() },
    
    { ruleId: "RULE-006", templateId: "TPL-004", ruleName: "Reference Extraction", fileFormat: "PAYMENT_ADVICE", category: "REFERENCE", ruleType: "DERIVE", triggerSummary: "Extract reference from memo", active: true, priority: 30, description: "Extracts payment reference numbers using pattern matching from memo field", triggerConditions: [{ attribute: "FILE_TYPE", operator: "EQUALS", value: "PAYMENT_ADVICE", logic: "AND" }], deriveSettings: { formula: "REGEX_EXTRACT(Memo_Field, 'REF-\\d{4}-\\d{5}')", sourceFields: "Memo_Field", defaultValue: "" }, createdAt: new Date().toISOString(), lastChanged: new Date().toISOString() },
    
    // ===== Universal Rules (apply to all templates) =====
    { ruleId: "RULE-012", templateId: "TPL-001", ruleName: "Proportional Amount Allocation", fileFormat: "EXCEL", category: "AMOUNT", ruleType: "ALLOCATE", triggerSummary: "Proportional split for multiple invoices", active: false, priority: 30, description: "When check amount differs from sum of invoices, allocate proportionally based on invoice amounts", triggerConditions: [], allocateSettings: { method: "PROPORTIONAL", roundingRule: "ADJUST_LAST", tolerance: 0.01, decimalPlaces: 2 }, createdAt: new Date().toISOString(), lastChanged: new Date().toISOString() },
    
    { ruleId: "RULE-013", templateId: "TPL-001", ruleName: "Reason Code Mapping", fileFormat: "EXCEL", category: "DEDUCTION", ruleType: "TEXT_CONVERSION", triggerSummary: "Map reason codes to SAP values", active: true, priority: 35, description: "Maps customer-specific deduction reason codes to SAP standard codes", triggerConditions: [], textConversionSettings: { conversionType: "TRUNCATE", targetFields: "ReasonCode,PaymentDifferenceReason", length: 3 }, createdAt: new Date().toISOString(), lastChanged: new Date().toISOString() }
];

let apiFields = [
    { fieldId: "FLD-001", fieldName: "Lockbox", necessity: "Mandatory", fieldType: "Constant", dataType: "String", maxLength: 7, defaultValue: "1234", description: "Lockbox identifier (constant for all payloads)", isEditable: true, createdAt: new Date().toISOString() },
    { fieldId: "FLD-002", fieldName: "LockboxBatchDestination", necessity: "Mandatory", fieldType: "Constant", dataType: "String", maxLength: 10, defaultValue: "LOCKBOXDES", description: "Destination for lockbox batch (10 chars max)", isEditable: true, createdAt: new Date().toISOString() },
    { fieldId: "FLD-003", fieldName: "LockboxBatchOrigin", necessity: "Mandatory", fieldType: "Constant", dataType: "String", maxLength: 10, defaultValue: "LOCKBOXORI", description: "Origin of lockbox batch (10 chars max)", isEditable: true, createdAt: new Date().toISOString() },
    { fieldId: "FLD-004", fieldName: "DepositDateTime", necessity: "Mandatory", fieldType: "User Input", dataType: "DateTime", maxLength: 0, description: "Date and time of deposit", isEditable: false, createdAt: new Date().toISOString() },
    { fieldId: "FLD-005", fieldName: "AmountInTransactionCurrency", necessity: "Mandatory", fieldType: "User Input", dataType: "Currency", maxLength: 0, description: "Total batch amount", isEditable: false, createdAt: new Date().toISOString() },
    { fieldId: "FLD-006", fieldName: "LockboxBatch", necessity: "Mandatory", fieldType: "System Generated", dataType: "String", maxLength: 3, defaultValue: "001", description: "Batch identifier (auto-generated)", isEditable: false, createdAt: new Date().toISOString() },
    { fieldId: "FLD-007", fieldName: "LockboxItem", necessity: "Mandatory", fieldType: "System Generated", dataType: "String", maxLength: 5, description: "Item identifier (001, 002...)", isEditable: false, createdAt: new Date().toISOString() },
    { fieldId: "FLD-008", fieldName: "Currency", necessity: "Optional", fieldType: "Default", dataType: "String", maxLength: 3, defaultValue: "USD", description: "Transaction currency", isEditable: true, createdAt: new Date().toISOString() },
    { fieldId: "FLD-009", fieldName: "Cheque", necessity: "Mandatory", fieldType: "User Input", dataType: "String", maxLength: 13, description: "Cheque number (max 13 chars)", isEditable: false, createdAt: new Date().toISOString() },
    { fieldId: "FLD-010", fieldName: "PartnerBank", necessity: "Optional", fieldType: "From BP API", dataType: "String", maxLength: 15, defaultValue: "15051554", description: "Partner bank - fetched from Business Partner API, fallback to default", isEditable: true, createdAt: new Date().toISOString() },
    { fieldId: "FLD-011", fieldName: "PartnerBankAccount", necessity: "Optional", fieldType: "From BP API", dataType: "String", maxLength: 18, defaultValue: "314129119", description: "Partner bank account - fetched from Business Partner API, fallback to default", isEditable: true, createdAt: new Date().toISOString() },
    { fieldId: "FLD-011b", fieldName: "PartnerBankCountry", necessity: "Optional", fieldType: "From BP API", dataType: "String", maxLength: 3, defaultValue: "US", description: "Partner bank country - fetched from Business Partner API, fallback to US", isEditable: true, createdAt: new Date().toISOString() },
    { fieldId: "FLD-013", fieldName: "PaymentReference", necessity: "Optional", fieldType: "User Input", dataType: "String", maxLength: 50, description: "Payment reference/Invoice number - Auto-detects XBLNR (Reference) vs BELNR (Accounting) based on format: 10-digit numeric = BELNR, others = XBLNR. Override with explicit XBLNR/BELNR columns in upload file. Controlled by Reference Document Rules (RULE-001 to RULE-004).", isEditable: false, createdAt: new Date().toISOString() },
    { fieldId: "FLD-014", fieldName: "NetPaymentAmountInPaytCurrency", necessity: "Optional", fieldType: "User Input", dataType: "Currency", maxLength: 0, description: "Net payment amount", isEditable: false, createdAt: new Date().toISOString() },
    { fieldId: "FLD-015", fieldName: "DeductionAmountInPaytCurrency", necessity: "Optional", fieldType: "User Input", dataType: "Currency", maxLength: 0, description: "Deduction amount", isEditable: false, createdAt: new Date().toISOString() },
    { fieldId: "FLD-016", fieldName: "PaymentDifferenceReason", necessity: "Optional", fieldType: "User Input", dataType: "String", maxLength: 3, description: "Reason for payment difference (3 chars)", isEditable: false, createdAt: new Date().toISOString() },
    { fieldId: "FLD-019", fieldName: "Customer", necessity: "Optional", fieldType: "User Input", dataType: "String", maxLength: 10, description: "Customer number (for GET API clearing lookup only - NOT in POST payload)", isEditable: false, createdAt: new Date().toISOString() }
];

// File-based backup for API Fields (to persist default value changes)
const API_FIELDS_BACKUP_FILE = path.join(__dirname, 'data', 'api_fields.json');

// Save API fields to file backup
function saveApiFieldsToFile() {
    try {
        ensureDataDir();
        fs.writeFileSync(API_FIELDS_BACKUP_FILE, JSON.stringify(apiFields, null, 2));
        console.log('API Fields saved to backup file:', apiFields.length, 'fields');
    } catch (err) {
        console.error('Error saving API fields to file:', err.message);
    }
}

// Load API fields from file backup
function loadApiFieldsFromFile() {
    console.log('=== Loading API Fields from File ===');
    try {
        if (fs.existsSync(API_FIELDS_BACKUP_FILE)) {
            const data = fs.readFileSync(API_FIELDS_BACKUP_FILE, 'utf8');
            const loadedFields = JSON.parse(data);
            console.log('Loaded API Fields from backup file:', loadedFields.length, 'fields');
            
            // Merge with defaults (in case new fields were added)
            const defaultFieldIds = apiFields.map(f => f.fieldId);
            const loadedFieldIds = loadedFields.map(f => f.fieldId);
            
            // Update existing fields with saved values (especially defaultValue)
            loadedFields.forEach(loadedField => {
                const idx = apiFields.findIndex(f => f.fieldId === loadedField.fieldId);
                if (idx !== -1) {
                    // Preserve the defaultValue from saved file
                    apiFields[idx] = { ...apiFields[idx], ...loadedField };
                }
            });
            
            console.log('API Fields merged with saved values');
        } else {
            console.log('API Fields backup file does not exist, using defaults');
        }
    } catch (err) {
        console.error('Error loading API fields from file:', err.message);
    }
}

// Get constant field values (Lockbox, LockboxBatchOrigin, LockboxBatchDestination)
function getConstantFieldValues() {
    const constants = {};
    apiFields.forEach(field => {
        if (field.fieldType === 'Constant' || field.fieldType === 'Default') {
            constants[field.fieldName] = field.defaultValue || '';
        }
    });
    return constants;
}

// OData Services - Empty by default, user will create manually
// Persisted to PostgreSQL
let odataServices = [];

// File-based backup for OData services
const SERVICES_BACKUP_FILE = path.join(__dirname, 'data', 'odata_services.json');

// Save services to file backup
function saveServicesToFile() {
    try {
        ensureDataDir();
        fs.writeFileSync(SERVICES_BACKUP_FILE, JSON.stringify(odataServices, null, 2));
        console.log('Services saved to backup file:', odataServices.length, 'services');
    } catch (err) {
        console.error('Error saving services to file:', err.message);
    }
}

// Load services from file backup
function loadServicesFromFile() {
    console.log('=== Loading OData Services from File ===');
    console.log('Backup file path:', SERVICES_BACKUP_FILE);
    try {
        if (fs.existsSync(SERVICES_BACKUP_FILE)) {
            const data = fs.readFileSync(SERVICES_BACKUP_FILE, 'utf8');
            const parsedServices = JSON.parse(data);
            console.log('Parsed services from file:', parsedServices.length);
            
            // Assign to global variable
            odataServices = parsedServices;
            console.log('odataServices array now has:', odataServices.length, 'services');
            
            // Update service counter
            const maxId = odataServices.reduce((max, s) => {
                const num = parseInt(s.serviceId.replace('SVC-', ''), 10);
                return num > max ? num : max;
            }, 0);
            serviceIdCounter = maxId + 1;
            console.log('Service counter set to:', serviceIdCounter);
        } else {
            console.log('Services backup file does not exist');
        }
    } catch (err) {
        console.error('Error loading services from file:', err.message);
        odataServices = [];
    }
}

// ============================================================================
// REFERENCE DOCUMENT RULES - Rules for determining clearing document number
// ============================================================================
// Rule Types:
// 1. BELNR - Use Accounting Document number (lbinvref = belnr)
// 2. XBLNR - Use Invoice Reference number (lbinvref = XBLNR)
// 3. BELNR_THEN_XBLNR - Try BELNR first, if not found use XBLNR
// 4. XBLNR_THEN_BELNR - Try XBLNR first, if not found use BELNR
// ============================================================================

const DEFAULT_REFERENCE_DOC_RULES = [
    {
        id: uuidv4(),
        ruleId: 'RULE-001',
        ruleName: 'Document Number (BELNR)',
        description: 'Use Accounting Document number (BELNR) as reference. IMPORTANT: SAP lockbox must be configured to match LBINVREF against BELNR field (Transaction: FIBP → Define Lockbox → Reference Field = BELNR). Use for SAP internal document numbers.',
        ruleType: 'BELNR',
        logicCondition: 'lbinvref = belnr',
        documentIdType: 'Accounting document (SAP internal)',
        sapConfigRequired: 'Lockbox Reference Field = BELNR',
        priority: 1,
        isDefault: false,
        active: true,
        createdAt: new Date().toISOString()
    },
    {
        id: uuidv4(),
        ruleId: 'RULE-002',
        ruleName: 'Reference Document Number (XBLNR)',
        description: 'Use Invoice Reference number (XBLNR) as reference. IMPORTANT: SAP lockbox must be configured to match LBINVREF against XBLNR field (Transaction: FIBP → Define Lockbox → Reference Field = XBLNR). This is the DEFAULT SAP configuration for customer payments. Use for customer invoice numbers.',
        ruleType: 'XBLNR',
        logicCondition: 'lbinvref = XBLNR',
        documentIdType: 'Invoice reference (External/Customer)',
        sapConfigRequired: 'Lockbox Reference Field = XBLNR (Default)',
        priority: 2,
        isDefault: true, // Default rule
        active: true,
        createdAt: new Date().toISOString()
    },
    {
        id: uuidv4(),
        ruleId: 'RULE-003',
        ruleName: 'Doc Number First - If Not Found Reference Doc',
        description: 'Try Accounting Document first, if not found use Invoice Reference. Requires both BELNR and XBLNR columns in upload file. SAP configuration determines actual matching behavior.',
        ruleType: 'BELNR_THEN_XBLNR',
        logicCondition: 'lbinvref = belnr else XBLNR',
        documentIdType: 'Accounting document exists else Invoice document',
        sapConfigRequired: 'Configure SAP based on primary document type',
        priority: 3,
        isDefault: false,
        active: true,
        createdAt: new Date().toISOString()
    },
    {
        id: uuidv4(),
        ruleId: 'RULE-004',
        ruleName: 'Ref Document First - If Not Found Doc Number',
        description: 'Try Invoice Reference first, if not found use Accounting Document. Requires both XBLNR and BELNR columns in upload file. SAP configuration determines actual matching behavior. Use when prioritizing external invoice references.',
        ruleType: 'XBLNR_THEN_BELNR',
        logicCondition: 'lbinvref = XBLNR else belnr',
        documentIdType: 'Invoice document else Accounting document',
        sapConfigRequired: 'Configure SAP based on primary document type',
        priority: 4,
        isDefault: false,
        active: true,
        createdAt: new Date().toISOString()
    }
];

let referenceDocRules = [...DEFAULT_REFERENCE_DOC_RULES];
let selectedReferenceDocRule = 'RULE-002'; // Default to XBLNR (Invoice Reference)
let refDocRuleIdCounter = 5;

// File-based backup for Reference Document Rules
const REF_DOC_RULES_BACKUP_FILE = path.join(__dirname, 'data', 'reference_doc_rules.json');

// Save Reference Doc Rules to file backup
function saveRefDocRulesToFile() {
    try {
        ensureDataDir();
        const data = {
            rules: referenceDocRules,
            selectedRule: selectedReferenceDocRule
        };
        fs.writeFileSync(REF_DOC_RULES_BACKUP_FILE, JSON.stringify(data, null, 2));
        console.log('Reference Doc Rules saved to backup file:', referenceDocRules.length, 'rules');
    } catch (err) {
        console.error('Error saving reference doc rules to file:', err.message);
    }
}

// Load Reference Doc Rules from file backup
function loadRefDocRulesFromFile() {
    console.log('=== Loading Reference Document Rules from File ===');
    try {
        if (fs.existsSync(REF_DOC_RULES_BACKUP_FILE)) {
            const data = fs.readFileSync(REF_DOC_RULES_BACKUP_FILE, 'utf8');
            const parsed = JSON.parse(data);
            referenceDocRules = parsed.rules || [...DEFAULT_REFERENCE_DOC_RULES];
            selectedReferenceDocRule = parsed.selectedRule || 'RULE-002';
            console.log('Loaded', referenceDocRules.length, 'reference doc rules from backup file');
            console.log('Selected rule:', selectedReferenceDocRule);
            
            // Update counter
            const maxId = referenceDocRules.reduce((max, r) => {
                const num = parseInt(r.ruleId.replace('RULE-', ''), 10);
                return num > max ? num : max;
            }, 0);
            refDocRuleIdCounter = maxId + 1;
        } else {
            console.log('Reference doc rules backup file does not exist, using defaults');
            referenceDocRules = [...DEFAULT_REFERENCE_DOC_RULES];
        }
    } catch (err) {
        console.error('Error loading reference doc rules from file:', err.message);
        referenceDocRules = [...DEFAULT_REFERENCE_DOC_RULES];
    }
}

// Get the active reference document rule
function getActiveReferenceDocRule() {
    const rule = referenceDocRules.find(r => r.ruleId === selectedReferenceDocRule && r.active);
    return rule || referenceDocRules.find(r => r.isDefault) || referenceDocRules[0];
}

// Apply reference document rule to determine PaymentReference
// This is called during file processing to transform the invoice number
function applyReferenceDocRule(invoiceData, rule) {
    if (!rule) rule = getActiveReferenceDocRule();
    
    // invoiceData contains: invoiceNumber, accountingDocument (BELNR), invoiceReference (XBLNR)
    const invoiceNumber = invoiceData.invoiceNumber || '';
    const belnr = invoiceData.accountingDocument || invoiceData.belnr || '';
    const xblnr = invoiceData.invoiceReference || invoiceData.xblnr || '';
    
    console.log(`Applying Reference Doc Rule: ${rule.ruleName} (${rule.ruleType})`);
    console.log(`  Invoice Number: ${invoiceNumber}`);
    console.log(`  BELNR (Accounting Doc): ${belnr}`);
    console.log(`  XBLNR (Invoice Ref): ${xblnr}`);
    
    let paymentReference = '';
    
    switch (rule.ruleType) {
        case 'BELNR':
            // Use Accounting Document number (BELNR)
            paymentReference = belnr || invoiceNumber;
            break;
        case 'XBLNR':
            // Use Invoice Reference number (XBLNR)
            paymentReference = xblnr || invoiceNumber;
            break;
        case 'BELNR_THEN_XBLNR':
            // Try BELNR first, if empty use XBLNR
            paymentReference = belnr || xblnr || invoiceNumber;
            break;
        case 'XBLNR_THEN_BELNR':
            // Logic: lbinvref = XBLNR else belnr
            // If Invoice Number matches XBLNR, use XBLNR; otherwise use BELNR
            if (xblnr && invoiceNumber === xblnr) {
                paymentReference = xblnr;
                console.log(`  -> Invoice matches XBLNR, using XBLNR: ${paymentReference}`);
            } else if (belnr) {
                paymentReference = belnr;
                console.log(`  -> Invoice doesn't match XBLNR, using BELNR: ${paymentReference}`);
            } else {
                paymentReference = invoiceNumber;
                console.log(`  -> Fallback to Invoice Number: ${paymentReference}`);
            }
            break;
        default:
            paymentReference = invoiceNumber;
    }
    
    console.log(`  Result PaymentReference: ${paymentReference}`);
    return paymentReference;
}

// ============================================================================

// Save service to PostgreSQL
async function saveServiceToDb(service) {
    if (!dbAvailable) {
        console.log('Database not available, service saved to file backup only');
        return;
    }
    
    try {
        const query = `
            INSERT INTO odata_service 
            (id, service_id, system, product_version, technical_service_name, external_service_name,
             service_description, service_operations, https_api_odata, auth_type, destination, active, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
            ON CONFLICT (service_id) DO UPDATE SET
                system = EXCLUDED.system,
                product_version = EXCLUDED.product_version,
                technical_service_name = EXCLUDED.technical_service_name,
                external_service_name = EXCLUDED.external_service_name,
                service_description = EXCLUDED.service_description,
                service_operations = EXCLUDED.service_operations,
                https_api_odata = EXCLUDED.https_api_odata,
                auth_type = EXCLUDED.auth_type,
                destination = EXCLUDED.destination,
                active = EXCLUDED.active,
                updated_at = CURRENT_TIMESTAMP
        `;
        
        await pool.query(query, [
            service.id || uuidv4(),
            service.serviceId,
            service.system,
            service.productVersion,
            service.technicalServiceName,
            service.externalServiceName,
            service.serviceDescription,
            service.serviceOperations,
            service.httpsApiOdata,
            service.authType,
            service.destination,
            service.active !== false
        ]);
        
        console.log('Service saved to database:', service.serviceId);
    } catch (err) {
        console.error('Error saving service to database:', err.message);
    }
}

// Load all services from PostgreSQL
async function loadServicesFromDb() {
    if (!dbAvailable) {
        console.log('Database not available, loading services from file backup');
        loadServicesFromFile();
        return;
    }
    
    try {
        const result = await pool.query('SELECT * FROM odata_service ORDER BY created_at ASC');
        
        if (result.rows.length === 0) {
            console.log('No services in database');
            // Try loading from file backup
            loadServicesFromFile();
        } else {
            odataServices = result.rows.map(row => ({
                id: row.id,
                serviceId: row.service_id,
                system: row.system,
                productVersion: row.product_version,
                technicalServiceName: row.technical_service_name,
                externalServiceName: row.external_service_name,
                serviceDescription: row.service_description,
                serviceOperations: row.service_operations,
                httpsApiOdata: row.https_api_odata,
                authType: row.auth_type,
                destination: row.destination,
                active: row.active,
                createdAt: row.created_at,
                lastModified: row.updated_at
            }));
            
            console.log('Loaded', odataServices.length, 'services from database');
        }
        
        // Update service counter
        const maxId = odataServices.reduce((max, s) => {
            const num = parseInt(s.serviceId.replace('SVC-', ''), 10);
            return num > max ? num : max;
        }, 0);
        serviceIdCounter = maxId + 1;
        
        // Save to file as backup
        saveServicesToFile();
        
    } catch (err) {
        console.error('Error loading services from database:', err.message);
        loadServicesFromFile();
    }
}

// Delete service from PostgreSQL
async function deleteServiceFromDb(serviceId) {
    if (!dbAvailable) {
        console.log('Database not available, service deleted from memory/file only');
        return;
    }
    
    try {
        await pool.query('DELETE FROM odata_service WHERE service_id = $1', [serviceId]);
        console.log('Service deleted from database:', serviceId);
    } catch (err) {
        console.error('Error deleting service from database:', err.message);
    }
}

// ID counters for new items
let templateIdCounter = 5;
let ruleIdCounter = 14;
let fieldIdCounter = 18;
let serviceIdCounter = 1;

// ============ Customer Templates APIs ============

// GET all customer templates
app.get('/api/field-mapping/templates', (req, res) => {
    try {
        res.json(customerTemplates);
    } catch (err) {
        console.error('Error fetching templates:', err);
        res.status(500).json({ error: 'Failed to fetch templates', message: err.message });
    }
});

// POST create new template
app.post('/api/field-mapping/templates', (req, res) => {
    try {
        const { name, fileType, templateType, description, fileName, active } = req.body;
        
        const templateId = `TPL-${String(templateIdCounter++).padStart(3, '0')}`;
        
        const newTemplate = {
            templateId,
            name,
            fileType,
            templateType: templateType || 'CUSTOM',
            description: description || '',
            fileName: fileName || '',
            active: active !== false,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
        
        customerTemplates.push(newTemplate);
        res.status(201).json({ success: true, template: newTemplate });
    } catch (err) {
        console.error('Error creating template:', err);
        res.status(500).json({ error: 'Failed to create template', message: err.message });
    }
});

// DELETE template
app.delete('/api/field-mapping/templates/:templateId', (req, res) => {
    try {
        const idx = customerTemplates.findIndex(t => t.templateId === req.params.templateId);
        if (idx === -1) {
            return res.status(404).json({ error: 'Template not found' });
        }
        customerTemplates.splice(idx, 1);
        res.json({ success: true, message: 'Template deleted' });
    } catch (err) {
        console.error('Error deleting template:', err);
        res.status(500).json({ error: 'Failed to delete template', message: err.message });
    }
});

// ============ FILE PATTERNS APIs ============

// GET all file patterns
app.get('/api/field-mapping/patterns', (req, res) => {
    try {
        // Apply filters if provided
        let filtered = [...filePatterns];
        
        if (req.query.fileType) {
            filtered = filtered.filter(p => p.fileType === req.query.fileType);
        }
        if (req.query.category) {
            filtered = filtered.filter(p => p.category === req.query.category);
        }
        if (req.query.patternType) {
            filtered = filtered.filter(p => p.patternType === req.query.patternType);
        }
        if (req.query.active !== undefined) {
            filtered = filtered.filter(p => p.active === (req.query.active === 'true'));
        }
        if (req.query.search) {
            const search = req.query.search.toLowerCase();
            filtered = filtered.filter(p => 
                p.patternName.toLowerCase().includes(search) ||
                p.description.toLowerCase().includes(search)
            );
        }
        
        res.json(filtered);
    } catch (err) {
        console.error('Error fetching patterns:', err);
        res.status(500).json({ error: 'Failed to fetch patterns', message: err.message });
    }
});

// GET single file pattern by ID
app.get('/api/field-mapping/patterns/:patternId', (req, res) => {
    try {
        const pattern = filePatterns.find(p => p.patternId === req.params.patternId);
        if (!pattern) {
            return res.status(404).json({ error: 'Pattern not found' });
        }
        res.json(pattern);
    } catch (err) {
        console.error('Error fetching pattern:', err);
        res.status(500).json({ error: 'Failed to fetch pattern', message: err.message });
    }
});

// POST create new file pattern
app.post('/api/field-mapping/patterns', async (req, res) => {
    try {
        console.log('📝 POST /api/field-mapping/patterns - Creating new pattern');
        const patternData = req.body;
        
        if (!patternData.patternName || !patternData.fileType) {
            return res.status(400).json({ success: false, error: 'Missing required fields: patternName, fileType' });
        }
        
        // Use provided patternId or generate new one in PAT0001 format
        const patternId = patternData.patternId || `PAT${String(patternIdCounter++).padStart(4, '0')}`;
        
        // Check if pattern ID already exists
        const exists = filePatterns.find(p => p.patternId === patternId);
        if (exists) {
            return res.status(400).json({ success: false, error: 'Pattern ID already exists' });
        }
        
        const newPattern = {
            id: uuidv4(),
            patternId,
            patternName: patternData.patternName,
            fileType: patternData.fileType,
            patternType: patternData.patternType || '',
            category: patternData.category || '',
            description: patternData.description || '',
            delimiter: patternData.delimiter || '',
            active: patternData.active !== false,
            priority: patternData.priority || 100,
            conditions: patternData.conditions || [],
            actions: patternData.actions || [],
            fieldMappings: patternData.fieldMappings || {},
            detection: patternData.detection || {},
            pdfFields: patternData.pdfFields || [],
            processingRules: patternData.processingRules || [],
            bankCode: patternData.bankCode || '',
            accountIdentifier: patternData.accountIdentifier || '',
            transactionCodes: patternData.transactionCodes || '',
            splitType: patternData.splitType || '',
            amountThreshold: patternData.amountThreshold || null,
            autoMatchOpenItems: patternData.autoMatchOpenItems || false,
            createSuspenseEntry: patternData.createSuspenseEntry || false,
            commonPrefixDetection: patternData.commonPrefixDetection || false,
            padCheckNumbers: patternData.padCheckNumbers || false,
            sumInvoiceAmounts: patternData.sumInvoiceAmounts || false,
            headerRow: patternData.headerRow || 1,
            dataStartRow: patternData.dataStartRow || 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Add to in-memory array
        filePatterns.push(newPattern);
        
        // Save to PostgreSQL FIRST
        const dbResult = await savePatternToDb(newPattern);
        console.log('💾 PostgreSQL save result:', dbResult);
        
        // Save to JSON backup
        savePatternsToFile();
        console.log('📄 Saved to JSON backup file');
        
        console.log(`✅ Created pattern: ${newPattern.patternId} - ${newPattern.patternName}`);
        
        res.status(201).json({ 
            success: true, 
            pattern: newPattern, 
            message: 'Pattern created successfully',
            dbSaved: dbResult?.success || false
        });
    } catch (err) {
        console.error('❌ Error creating pattern:', err);
        res.status(500).json({ success: false, error: 'Failed to create pattern', message: err.message });
    }
});

// PUT update file pattern
app.put('/api/field-mapping/patterns/:patternId', async (req, res) => {
    try {
        const idx = filePatterns.findIndex(p => p.patternId === req.params.patternId);
        if (idx === -1) {
            return res.status(404).json({ error: 'Pattern not found' });
        }
        
        const updated = {
            ...filePatterns[idx],
            ...req.body,
            patternId: filePatterns[idx].patternId, // Preserve ID
            id: filePatterns[idx].id, // Preserve UUID
            createdAt: filePatterns[idx].createdAt, // Preserve created date
            lastModified: new Date().toISOString()
        };
        
        // Update in memory
        filePatterns[idx] = updated;
        
        // Save to PostgreSQL
        await savePatternToDb(updated);
        
        // Save to file backup
        savePatternsToFile();
        
        console.log(`Updated file pattern: ${updated.patternId}`);
        res.json({ success: true, pattern: updated });
    } catch (err) {
        console.error('Error updating pattern:', err);
        res.status(500).json({ error: 'Failed to update pattern', message: err.message });
    }
});

// DELETE file pattern
app.delete('/api/field-mapping/patterns/:patternId', async (req, res) => {
    try {
        console.log('🗑️  DELETE /api/field-mapping/patterns/:patternId');
        console.log('Pattern ID:', req.params.patternId);
        
        const idx = filePatterns.findIndex(p => p.patternId === req.params.patternId);
        if (idx === -1) {
            console.log('❌ Pattern not found:', req.params.patternId);
            return res.status(404).json({ success: false, error: 'Pattern not found' });
        }
        
        const deleted = filePatterns.splice(idx, 1)[0];
        console.log('📦 Removed from in-memory array:', deleted.patternId);
        
        // Delete from PostgreSQL FIRST
        const dbResult = await deletePatternFromDb(deleted.patternId);
        console.log('💾 PostgreSQL delete result:', dbResult);
        
        // Save to JSON backup
        savePatternsToFile();
        console.log('📄 Saved to JSON backup file');
        
        console.log(`✅ Deleted pattern: ${deleted.patternId} - ${deleted.patternName}`);
        
        res.json({ 
            success: true, 
            message: 'Pattern deleted', 
            patternId: deleted.patternId,
            dbDeleted: dbResult?.success || false
        });
    } catch (err) {
        console.error('❌ Error deleting pattern:', err);
        res.status(500).json({ success: false, error: 'Failed to delete pattern', message: err.message });
    }
});

// SYNC JSON to PostgreSQL - Force sync current JSON data to database
app.post('/api/field-mapping/patterns/sync-to-db', async (req, res) => {
    try {
        console.log('🔄 Starting JSON to PostgreSQL sync...');
        
        if (!dbAvailable) {
            return res.status(503).json({ 
                success: false, 
                error: 'Database not available',
                message: 'Cannot sync - PostgreSQL is not connected'
            });
        }
        
        // Clear existing patterns in database
        console.log('🗑️  Clearing old patterns from database...');
        await pool.query('DELETE FROM file_pattern');
        console.log('✅ Old patterns cleared');
        
        // Insert all patterns from JSON
        console.log(`📝 Inserting ${filePatterns.length} patterns from JSON...`);
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (const pattern of filePatterns) {
            try {
                await savePatternToDb(pattern);
                successCount++;
                console.log(`  ✅ Synced: ${pattern.patternId} - ${pattern.patternName}`);
            } catch (err) {
                errorCount++;
                errors.push({ patternId: pattern.patternId, error: err.message });
                console.error(`  ❌ Failed: ${pattern.patternId} - ${err.message}`);
            }
        }
        
        console.log(`✅ Sync complete: ${successCount} succeeded, ${errorCount} failed`);
        
        res.json({ 
            success: true, 
            message: 'Patterns synced to database',
            synced: successCount,
            failed: errorCount,
            errors: errors,
            total: filePatterns.length
        });
    } catch (err) {
        console.error('❌ Error syncing patterns to database:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to sync patterns', 
            message: err.message 
        });
    }
});

// PATCH toggle pattern active status
app.patch('/api/field-mapping/patterns/:patternId/toggle', async (req, res) => {
    try {
        const pattern = filePatterns.find(p => p.patternId === req.params.patternId);
        if (!pattern) {
            return res.status(404).json({ error: 'Pattern not found' });
        }
        pattern.active = !pattern.active;
        pattern.lastModified = new Date().toISOString();
        
        // Save to PostgreSQL
        await savePatternToDb(pattern);
        
        // Save to file backup
        savePatternsToFile();
        
        console.log(`Toggled pattern ${pattern.patternId} active status to: ${pattern.active}`);
        res.json({ success: true, pattern });
    } catch (err) {
        console.error('Error toggling pattern:', err);
        res.status(500).json({ error: 'Failed to toggle pattern', message: err.message });
    }
});

// POST copy/duplicate a pattern
app.post('/api/field-mapping/patterns/:patternId/copy', async (req, res) => {
    try {
        console.log('📋 POST /api/field-mapping/patterns/:patternId/copy - Copying pattern');
        
        const original = filePatterns.find(p => p.patternId === req.params.patternId);
        if (!original) {
            console.log('❌ Pattern not found:', req.params.patternId);
            return res.status(404).json({ error: 'Pattern not found' });
        }
        
        const patternId = `PAT${String(patternIdCounter++).padStart(4, '0')}`;
        
        const copy = {
            ...JSON.parse(JSON.stringify(original)), // Deep copy
            id: uuidv4(),
            patternId,
            patternName: `${original.patternName} (Copy)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Add to in-memory array
        filePatterns.push(copy);
        
        // Save to PostgreSQL
        const dbResult = await savePatternToDb(copy);
        console.log('💾 PostgreSQL save result:', dbResult);
        
        // Save to JSON backup
        savePatternsToFile();
        console.log('📄 Saved to JSON backup file');
        
        console.log(`✅ Copied pattern ${original.patternId} to ${patternId}`);
        res.status(201).json({ 
            success: true, 
            pattern: copy,
            dbSaved: dbResult?.success || false
        });
    } catch (err) {
        console.error('❌ Error copying pattern:', err);
        res.status(500).json({ error: 'Failed to copy pattern', message: err.message });
    }
});

// GET pattern types (for dropdown)
app.get('/api/field-mapping/pattern-types', (req, res) => {
    try {
        const patternTypes = [
            { key: "SINGLE_CHECK_SINGLE_INVOICE", text: "Single Check - Single Invoice", category: "CHECK" },
            { key: "SINGLE_CHECK_MULTI_INVOICE", text: "Single Check - Multiple Invoices", category: "CHECK" },
            { key: "MULTI_CHECK_SINGLE_INVOICE", text: "Multiple Checks - Single Invoice", category: "CHECK" },
            { key: "MULTI_CHECK_MULTI_INVOICE", text: "Multiple Checks - Multiple Invoices", category: "CHECK" },
            { key: "CHECK_SPLIT", text: "Check Number Split (Delimited)", category: "DELIMITER" },
            { key: "INVOICE_SPLIT", text: "Invoice Number Split (Delimited)", category: "DELIMITER" },
            { key: "AMOUNT_SPLIT", text: "Amount Split (Delimited)", category: "DELIMITER" },
            { key: "SINGLE_CUSTOMER", text: "Single Customer", category: "CUSTOMER" },
            { key: "MULTI_CUSTOMER", text: "Multiple Customers", category: "CUSTOMER" },
            { key: "BANK_FORMAT", text: "Bank Format (BAI2, etc.)", category: "SPECIAL" },
            { key: "PDF_EXTRACT", text: "PDF Extraction", category: "SPECIAL" },
            { key: "CUSTOM_DELIMITER", text: "Custom Delimiter", category: "DELIMITER" }
        ];
        res.json(patternTypes);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch pattern types' });
    }
});

// GET pattern categories (for dropdown)
app.get('/api/field-mapping/pattern-categories', (req, res) => {
    try {
        const categories = [
            { key: "CHECK", text: "Check Patterns", icon: "sap-icon://money-bills" },
            { key: "INVOICE", text: "Invoice Patterns", icon: "sap-icon://sales-order" },
            { key: "AMOUNT", text: "Amount Patterns", icon: "sap-icon://currency" },
            { key: "CUSTOMER", text: "Customer Patterns", icon: "sap-icon://customer" },
            { key: "DELIMITER", text: "Delimiter Patterns", icon: "sap-icon://split" },
            { key: "SPECIAL", text: "Special Formats", icon: "sap-icon://document-text" }
        ];
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// GET common delimiters (for dropdown)
app.get('/api/field-mapping/delimiters', (req, res) => {
    try {
        const delimiters = [
            { key: ",", text: "Comma (,)" },
            { key: ";", text: "Semicolon (;)" },
            { key: "|", text: "Pipe (|)" },
            { key: "-", text: "Hyphen/Range (-)" },
            { key: "/", text: "Slash (/)" },
            { key: "\\t", text: "Tab" },
            { key: " ", text: "Space" },
            { key: "CUSTOM", text: "Custom..." }
        ];
        res.json(delimiters);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch delimiters' });
    }
});

// ============ Field Mapping Rules APIs ============

// GET all rules
app.get('/api/field-mapping/rules', (req, res) => {
    try {
        res.json(fieldMappingRules);
    } catch (err) {
        console.error('Error fetching rules:', err);
        res.status(500).json({ error: 'Failed to fetch rules', message: err.message });
    }
});

// ============ Reference Document Rules APIs ============

// GET all reference document rules
app.get('/api/field-mapping/ref-doc-rules', (req, res) => {
    try {
        res.json({
            rules: referenceDocRules,
            selectedRule: selectedReferenceDocRule,
            activeRule: getActiveReferenceDocRule()
        });
    } catch (err) {
        console.error('Error fetching reference doc rules:', err);
        res.status(500).json({ error: 'Failed to fetch reference document rules', message: err.message });
    }
});

// PUT - Select/Activate a reference document rule
app.put('/api/field-mapping/ref-doc-rules/:ruleId/select', (req, res) => {
    try {
        const { ruleId } = req.params;
        const rule = referenceDocRules.find(r => r.ruleId === ruleId);
        
        if (!rule) {
            return res.status(404).json({ success: false, error: 'Rule not found' });
        }
        
        selectedReferenceDocRule = ruleId;
        console.log('Selected Reference Document Rule:', ruleId, '-', rule.ruleName);
        
        // Save to file
        saveRefDocRulesToFile();
        
        res.json({ 
            success: true, 
            message: `Rule ${rule.ruleName} selected`,
            selectedRule: selectedReferenceDocRule,
            activeRule: getActiveReferenceDocRule()
        });
    } catch (err) {
        console.error('Error selecting reference doc rule:', err);
        res.status(500).json({ success: false, error: 'Failed to select rule', message: err.message });
    }
});

// POST create new rule
app.post('/api/field-mapping/rules', (req, res) => {
    try {
        const ruleData = req.body;
        const ruleId = `RULE-${String(ruleIdCounter++).padStart(3, '0')}`;
        
        const newRule = {
            ruleId,
            ...ruleData,
            createdAt: new Date().toISOString(),
            lastChanged: new Date().toISOString()
        };
        
        fieldMappingRules.push(newRule);
        res.status(201).json({ success: true, rule: newRule });
    } catch (err) {
        console.error('Error creating rule:', err);
        res.status(500).json({ error: 'Failed to create rule', message: err.message });
    }
});

// PUT update rule
app.put('/api/field-mapping/rules/:ruleId', (req, res) => {
    try {
        const ruleData = req.body;
        const idx = fieldMappingRules.findIndex(r => r.ruleId === req.params.ruleId);
        
        if (idx === -1) {
            return res.status(404).json({ error: 'Rule not found' });
        }
        
        fieldMappingRules[idx] = { ...fieldMappingRules[idx], ...ruleData, lastChanged: new Date().toISOString() };
        res.json({ success: true, message: 'Rule updated' });
    } catch (err) {
        console.error('Error updating rule:', err);
        res.status(500).json({ error: 'Failed to update rule', message: err.message });
    }
});

// DELETE rule
app.delete('/api/field-mapping/rules/:ruleId', (req, res) => {
    try {
        const idx = fieldMappingRules.findIndex(r => r.ruleId === req.params.ruleId);
        if (idx === -1) {
            return res.status(404).json({ error: 'Rule not found' });
        }
        fieldMappingRules.splice(idx, 1);
        res.json({ success: true, message: 'Rule deleted' });
    } catch (err) {
        console.error('Error deleting rule:', err);
        res.status(500).json({ error: 'Failed to delete rule', message: err.message });
    }
});

// ============ Processing Rules APIs ============

// GET all processing rules
app.get('/api/field-mapping/processing-rules', (req, res) => {
    try {
        res.json(processingRules);
    } catch (err) {
        console.error('Error fetching processing rules:', err);
        res.status(500).json({ error: 'Failed to fetch processing rules', message: err.message });
    }
});

// GET single processing rule
app.get('/api/field-mapping/processing-rules/:ruleId', (req, res) => {
    try {
        const rule = processingRules.find(r => r.ruleId === req.params.ruleId);
        if (!rule) {
            return res.status(404).json({ error: 'Processing rule not found' });
        }
        res.json(rule);
    } catch (err) {
        console.error('Error fetching processing rule:', err);
        res.status(500).json({ error: 'Failed to fetch processing rule', message: err.message });
    }
});

// POST create new processing rule
app.post('/api/field-mapping/processing-rules', async (req, res) => {
    try {
        const ruleData = req.body;
        const ruleId = ruleData.ruleId || `RULE-${String(processingRuleIdCounter++).padStart(3, '0')}`;
        
        const newRule = {
            id: uuidv4(),
            ruleId,
            ...ruleData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        processingRules.push(newRule);
        
        // Save to PostgreSQL
        await saveProcessingRuleToDb(newRule);
        
        // Save to file backup
        saveProcessingRulesToFile();
        
        console.log(`Created processing rule: ${newRule.ruleId}`);
        res.status(201).json({ success: true, rule: newRule });
    } catch (err) {
        console.error('Error creating processing rule:', err);
        res.status(500).json({ success: false, error: 'Failed to create processing rule', message: err.message });
    }
});

// PUT update processing rule
app.put('/api/field-mapping/processing-rules/:ruleId', async (req, res) => {
    try {
        console.log('📝 PUT /api/field-mapping/processing-rules/:ruleId called');
        console.log('Rule ID:', req.params.ruleId);
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const ruleData = req.body;
        const idx = processingRules.findIndex(r => r.ruleId === req.params.ruleId);
        
        if (idx === -1) {
            console.log('❌ Processing rule not found:', req.params.ruleId);
            return res.status(404).json({ success: false, error: 'Processing rule not found' });
        }
        
        processingRules[idx] = { 
            ...processingRules[idx], 
            ...ruleData, 
            updatedAt: new Date().toISOString() 
        };
        
        console.log('📦 Updated in-memory rule:', processingRules[idx].ruleId);
        
        // Save to PostgreSQL
        const dbResult = await saveProcessingRuleToDb(processingRules[idx]);
        console.log('💾 PostgreSQL save result:', dbResult);
        
        // Save to file backup
        saveProcessingRulesToFile();
        console.log('📄 Saved to JSON backup file');
        
        console.log(`✅ Updated processing rule: ${processingRules[idx].ruleId}`);
        res.json({ 
            success: true, 
            message: 'Processing rule updated', 
            rule: processingRules[idx],
            dbSaved: dbResult?.success || false
        });
    } catch (err) {
        console.error('❌ Error updating processing rule:', err);
        res.status(500).json({ success: false, error: 'Failed to update processing rule', message: err.message });
    }
});

// DELETE processing rule
app.delete('/api/field-mapping/processing-rules/:ruleId', async (req, res) => {
    try {
        const idx = processingRules.findIndex(r => r.ruleId === req.params.ruleId);
        if (idx === -1) {
            return res.status(404).json({ success: false, error: 'Processing rule not found' });
        }
        
        const deleted = processingRules.splice(idx, 1)[0];
        
        // Delete from PostgreSQL
        await deleteProcessingRuleFromDb(deleted.ruleId);
        
        // Save to file backup
        saveProcessingRulesToFile();
        
        console.log(`Deleted processing rule: ${deleted.ruleId}`);
        res.json({ success: true, message: 'Processing rule deleted', rule: deleted });
    } catch (err) {
        console.error('Error deleting processing rule:', err);
        res.status(500).json({ success: false, error: 'Failed to delete processing rule', message: err.message });
    }
});

// SYNC JSON to PostgreSQL - Force sync current JSON data to database
app.post('/api/field-mapping/processing-rules/sync-to-db', async (req, res) => {
    try {
        console.log('🔄 Starting Processing Rules JSON to PostgreSQL (LB_Processing_Rules) sync...');
        
        if (!dbAvailable) {
            return res.status(503).json({ 
                success: false, 
                error: 'Database not available',
                message: 'Cannot sync - PostgreSQL is not connected'
            });
        }
        
        // Clear existing rules in database
        console.log('🗑️  Clearing old processing rules from LB_Processing_Rules table...');
        await pool.query('DELETE FROM lb_processing_rules');
        console.log('✅ Old rules cleared');
        
        // Insert all rules from JSON
        console.log(`📝 Inserting ${processingRules.length} processing rules from JSON...`);
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (const rule of processingRules) {
            try {
                await saveProcessingRuleToDb(rule);
                successCount++;
                console.log(`  ✅ Synced: ${rule.ruleId} - ${rule.ruleName}`);
            } catch (err) {
                errorCount++;
                errors.push({ ruleId: rule.ruleId, error: err.message });
                console.error(`  ❌ Failed: ${rule.ruleId} - ${err.message}`);
            }
        }
        
        console.log(`✅ Sync complete: ${successCount} succeeded, ${errorCount} failed`);
        
        res.json({ 
            success: true, 
            message: 'Processing rules synced to LB_Processing_Rules table',
            synced: successCount,
            failed: errorCount,
            errors: errors,
            total: processingRules.length
        });
    } catch (err) {
        console.error('❌ Error syncing processing rules to LB_Processing_Rules:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to sync processing rules', 
            message: err.message 
        });
    }
});

// ============ API Fields APIs ============

// GET all API fields
app.get('/api/field-mapping/api-fields', (req, res) => {
    try {
        res.json(apiFields);
    } catch (err) {
        console.error('Error fetching API fields:', err);
        res.status(500).json({ error: 'Failed to fetch API fields', message: err.message });
    }
});

// POST create new API field
app.post('/api/field-mapping/api-fields', (req, res) => {
    try {
        const fieldData = req.body;
        
        if (!fieldData.fieldName) {
            return res.status(400).json({ error: 'Field name is required' });
        }
        
        // Check for duplicate
        const existing = apiFields.find(f => f.fieldName.toLowerCase() === fieldData.fieldName.toLowerCase());
        if (existing) {
            return res.status(400).json({ error: 'A field with this name already exists' });
        }
        
        // Generate next field ID
        const maxId = apiFields.reduce((max, f) => {
            const num = parseInt(f.fieldId.replace('FLD-', '').replace(/[a-z]/gi, ''), 10);
            return num > max ? num : max;
        }, 0);
        const fieldId = `FLD-${String(maxId + 1).padStart(3, '0')}`;
        
        const newField = {
            fieldId,
            fieldName: fieldData.fieldName,
            necessity: fieldData.necessity || 'Optional',
            fieldType: fieldData.fieldType || 'User Input',
            dataType: fieldData.dataType || 'String',
            maxLength: fieldData.maxLength || 0,
            defaultValue: fieldData.defaultValue || '',
            description: fieldData.description || '',
            isEditable: fieldData.isEditable !== false,
            createdAt: new Date().toISOString()
        };
        
        apiFields.push(newField);
        saveApiFieldsToFile();
        
        console.log('Created new API field:', newField.fieldId, newField.fieldName);
        res.status(201).json({ success: true, field: newField });
    } catch (err) {
        console.error('Error creating API field:', err);
        res.status(500).json({ error: 'Failed to create API field', message: err.message });
    }
});

// DELETE API field
app.delete('/api/field-mapping/api-fields/:fieldId', (req, res) => {
    try {
        const idx = apiFields.findIndex(f => f.fieldId === req.params.fieldId);
        if (idx === -1) {
            return res.status(404).json({ error: 'API field not found' });
        }
        
        const deleted = apiFields.splice(idx, 1)[0];
        saveApiFieldsToFile();
        
        console.log('Deleted API field:', deleted.fieldId, deleted.fieldName);
        res.json({ success: true, message: 'API field deleted', fieldId: deleted.fieldId });
    } catch (err) {
        console.error('Error deleting API field:', err);
        res.status(500).json({ error: 'Failed to delete API field', message: err.message });
    }
});

// PUT update API field (especially for updating default values)
app.put('/api/field-mapping/api-fields/:fieldId', (req, res) => {
    try {
        const idx = apiFields.findIndex(f => f.fieldId === req.params.fieldId);
        if (idx === -1) {
            return res.status(404).json({ error: 'API field not found' });
        }
        
        const field = apiFields[idx];
        
        // Only allow editing if isEditable is true
        if (!field.isEditable && req.body.defaultValue !== undefined && req.body.defaultValue !== field.defaultValue) {
            return res.status(400).json({ error: 'This field is not editable' });
        }
        
        // Update field properties
        const updatedField = {
            ...field,
            ...req.body,
            fieldId: field.fieldId, // Preserve ID
            createdAt: field.createdAt,
            updatedAt: new Date().toISOString()
        };
        
        // Validate max length for constant fields
        if (updatedField.maxLength && updatedField.defaultValue) {
            if (updatedField.defaultValue.length > updatedField.maxLength) {
                return res.status(400).json({ 
                    error: `Default value exceeds max length of ${updatedField.maxLength} characters` 
                });
            }
        }
        
        apiFields[idx] = updatedField;
        saveApiFieldsToFile();
        
        console.log(`Updated API field ${field.fieldId}: ${field.fieldName} = "${updatedField.defaultValue}"`);
        res.json({ success: true, field: updatedField, message: 'Field updated successfully' });
    } catch (err) {
        console.error('Error updating API field:', err);
        res.status(500).json({ error: 'Failed to update API field', message: err.message });
    }
});

// GET constant field values (quick access to Lockbox, LockboxBatchOrigin, etc.)
app.get('/api/field-mapping/constants', (req, res) => {
    try {
        const constants = getConstantFieldValues();
        res.json({ success: true, constants });
    } catch (err) {
        console.error('Error getting constants:', err);
        res.status(500).json({ error: 'Failed to get constants', message: err.message });
    }
});

// ============ OData Services APIs ============

// GET all OData services
app.get('/api/field-mapping/odata-services', (req, res) => {
    try {
        console.log('GET /api/field-mapping/odata-services called');
        console.log('odataServices array length:', odataServices.length);
        console.log('odataServices content:', JSON.stringify(odataServices));
        res.json(odataServices);
    } catch (err) {
        console.error('Error fetching OData services:', err);
        res.status(500).json({ error: 'Failed to fetch OData services', message: err.message });
    }
});

// POST create new OData service
app.post('/api/field-mapping/odata-services', async (req, res) => {
    try {
        const serviceData = req.body;
        
        if (!serviceData.system || !serviceData.httpsApiOdata) {
            return res.status(400).json({ error: 'Missing required fields: system, httpsApiOdata' });
        }
        
        const serviceId = `SVC-${String(serviceIdCounter++).padStart(3, '0')}`;
        
        const newService = {
            id: uuidv4(),
            serviceId,
            system: serviceData.system,
            productVersion: serviceData.productVersion || 'V2',
            technicalServiceName: serviceData.technicalServiceName || '',
            externalServiceName: serviceData.externalServiceName || '',
            serviceDescription: serviceData.serviceDescription || '',
            serviceOperations: serviceData.serviceOperations || '',
            httpsApiOdata: serviceData.httpsApiOdata,
            authType: serviceData.authType || 'BASIC',
            destination: serviceData.destination || '',
            active: serviceData.active !== false,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
        
        // Add to in-memory array
        odataServices.push(newService);
        
        // Save to PostgreSQL
        await saveServiceToDb(newService);
        
        // Save to file backup
        saveServicesToFile();
        
        console.log(`Created new OData service: ${serviceId}`);
        res.status(201).json({ success: true, service: newService });
    } catch (err) {
        console.error('Error creating OData service:', err);
        res.status(500).json({ error: 'Failed to create OData service', message: err.message });
    }
});

// PUT update OData service
app.put('/api/field-mapping/odata-services/:serviceId', async (req, res) => {
    try {
        const idx = odataServices.findIndex(s => s.serviceId === req.params.serviceId);
        if (idx === -1) {
            return res.status(404).json({ error: 'OData service not found' });
        }
        
        const updated = {
            ...odataServices[idx],
            ...req.body,
            serviceId: odataServices[idx].serviceId, // Preserve ID
            id: odataServices[idx].id, // Preserve UUID
            createdAt: odataServices[idx].createdAt, // Preserve created date
            lastModified: new Date().toISOString()
        };
        
        // Update in memory
        odataServices[idx] = updated;
        
        // Save to PostgreSQL
        await saveServiceToDb(updated);
        
        // Save to file backup
        saveServicesToFile();
        
        console.log(`Updated OData service: ${updated.serviceId}`);
        res.json({ success: true, service: updated });
    } catch (err) {
        console.error('Error updating OData service:', err);
        res.status(500).json({ error: 'Failed to update OData service', message: err.message });
    }
});

// DELETE OData service
app.delete('/api/field-mapping/odata-services/:serviceId', async (req, res) => {
    try {
        const idx = odataServices.findIndex(s => s.serviceId === req.params.serviceId);
        if (idx === -1) {
            return res.status(404).json({ error: 'OData service not found' });
        }
        
        const deleted = odataServices.splice(idx, 1)[0];
        
        // Delete from PostgreSQL
        await deleteServiceFromDb(deleted.serviceId);
        
        // Save to file backup
        saveServicesToFile();
        
        console.log(`Deleted OData service: ${deleted.serviceId}`);
        res.json({ success: true, message: 'OData service deleted', serviceId: deleted.serviceId });
    } catch (err) {
        console.error('Error deleting OData service:', err);
        res.status(500).json({ error: 'Failed to delete OData service', message: err.message });
    }
});

// PATCH toggle service active status
app.patch('/api/field-mapping/odata-services/:serviceId/toggle', async (req, res) => {
    try {
        const service = odataServices.find(s => s.serviceId === req.params.serviceId);
        if (!service) {
            return res.status(404).json({ error: 'OData service not found' });
        }
        
        service.active = !service.active;
        service.lastModified = new Date().toISOString();
        
        // Save to PostgreSQL
        await saveServiceToDb(service);
        
        // Save to file backup
        saveServicesToFile();
        
        console.log(`Toggled service ${service.serviceId} active status to: ${service.active}`);
        res.json({ success: true, service });
    } catch (err) {
        console.error('Error toggling service:', err);
        res.status(500).json({ error: 'Failed to toggle service', message: err.message });
    }
});

// ============================================================================
// API ENDPOINT - Sync Processing Rules from JSON to PostgreSQL
// ============================================================================

/**
 * POST /api/processing-rules/sync-to-db
 * Syncs all processing rules from JSON file to PostgreSQL database
 */
app.post('/api/processing-rules/sync-to-db', async (req, res) => {
    console.log('🔄 Syncing processing rules from JSON to PostgreSQL...');
    
    if (!dbAvailable) {
        return res.status(503).json({
            success: false,
            error: 'Database not available'
        });
    }
    
    try {
        // Load rules from JSON file
        const jsonRules = JSON.parse(fs.readFileSync(PROCESSING_RULES_FILE, 'utf8'));
        
        console.log(`   Found ${jsonRules.length} rules in JSON file`);
        
        let synced = 0;
        let errors = [];
        
        for (const rule of jsonRules) {
            try {
                const result = await saveProcessingRuleToDb(rule);
                if (result.success !== false) {
                    synced++;
                    console.log(`   ✅ Synced ${rule.ruleId}`);
                } else {
                    errors.push(`${rule.ruleId}: ${result.reason}`);
                }
            } catch (err) {
                errors.push(`${rule.ruleId}: ${err.message}`);
            }
        }
        
        // Reload rules from database
        await loadProcessingRulesFromDb();
        
        res.json({
            success: true,
            synced: synced,
            total: jsonRules.length,
            errors: errors
        });
        
    } catch (error) {
        console.error('❌ Error syncing rules:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// API ENDPOINTS - RULE-004: Fetch Accounting Document Details
// ============================================================================

/**
 * GET /api/lockbox/:runId/accounting-document
 * Fetch accounting document details using RULE-004 for a specific lockbox run
 */
app.get('/api/lockbox/:runId/accounting-document', async (req, res) => {
    const { runId } = req.params;
    const { refresh } = req.query; // Allow optional refresh parameter
    
    console.log(`📋 RULE-004: Fetching accounting document for run ${runId} (refresh=${refresh || 'false'})`);
    
    try {
        // STEP 1: Try to get run data from lockboxProcessingRuns (primary storage)
        let run = lockboxProcessingRuns.find(r => r.runId === runId);
        
        // Fallback to legacy runs array if not found
        if (!run) {
            run = runs.find(r => r.runId === runId);
        }
        
        if (!run) {
            return res.status(404).json({ 
                success: false, 
                error: 'Run not found' 
            });
        }
        
        // Get lockbox ID from run
        const lockboxId = run.lockboxId || run.lockbox || run.runId;
        
        console.log(`   Using LockboxId: ${lockboxId}`);
        
        // STEP 2: Check if RULE-004 data is already stored in the run
        if (run.clearingDocuments && run.clearingDocuments.length > 0 && !refresh) {
            console.log(`   ✅ Using stored RULE-004 data (${run.clearingDocuments.length} documents)`);
            console.log(`   💾 Data source: Run storage (no SAP call needed)`);
            
            return res.json({
                success: true,
                lockboxId: lockboxId,
                documents: run.clearingDocuments,
                count: run.clearingDocuments.length,
                source: 'stored',
                storedAt: run.clearingDocumentsTimestamp || run.updated_at
            });
        }
        
        // STEP 3: If not stored or refresh requested, fetch from SAP
        console.log(`   🔄 Fetching fresh data from SAP (stored data not available or refresh requested)`);
        
        // Get RULE-004 configuration
        const rule004 = processingRules.find(r => r.ruleId === 'RULE-004');
        
        if (!rule004 || !rule004.active) {
            return res.status(404).json({ 
                success: false, 
                error: 'RULE-004 not found or not active' 
            });
        }
        
        // Build API URL dynamically
        const apiMapping = rule004.apiMappings[0];
        const apiEndpoint = apiMapping.apiReference;
        
        // Build query filter with lockbox ID
        // Using LockBoxId field as specified in RULE-004 requirements
        const queryParams = {
            '$filter': `LockBoxId eq '${lockboxId}'`,
            '$select': 'LockBoxId,SendingBank,BankStatement,StatementId,CompanyCode,HeaderStatus,BankStatementItem,DocumentNumber,PaymentAdvice,SubledgerDocument,SubledgerOnaccountDocument,Amount,TransactionCurrency,DocumentStatus',
            '$top': '100'
        };
        
        console.log(`   API Endpoint: ${apiEndpoint}`);
        console.log(`   Query Params:`, queryParams);
        
        // Call SAP API using the same connection logic as RULE-001/002
        const response = await sapClient.executeSapGetRequest(
            rule004.destination,
            apiEndpoint,
            queryParams
        );
        
        if (!response || !response.data) {
            return res.status(500).json({ 
                success: false, 
                error: 'No response from SAP API' 
            });
        }
        
        console.log(`   ✅ SAP Response received`);
        
        // Extract data from response
        const documents = response.data.value || [];
        
        console.log(`   📊 Found ${documents.length} document(s)`);
        
        // Map to frontend structure - matching RULE-004 SAP response fields
        const mappedData = documents.map((doc, index) => ({
            item: (index + 1).toString(),
            LockBoxId: doc.LockBoxId || '',
            SendingBank: doc.SendingBank || '',
            BankStatement: doc.BankStatement || '',
            StatementId: doc.StatementId || '',
            CompanyCode: doc.CompanyCode || '',
            HeaderStatus: doc.HeaderStatus || '',
            BankStatementItem: doc.BankStatementItem || '',
            DocumentNumber: doc.DocumentNumber || '',
            PaymentAdvice: doc.PaymentAdvice || '',
            SubledgerDocument: doc.SubledgerDocument || '',
            SubledgerOnaccountDocument: doc.SubledgerOnaccountDocument || '',
            Amount: doc.Amount || 0,
            TransactionCurrency: doc.TransactionCurrency || 'USD',
            DocumentStatus: doc.DocumentStatus || ''
        }));
        
        // STEP 4: Store the fetched data back to the run for future use
        try {
            const runIndex = lockboxProcessingRuns.findIndex(r => r.runId === runId);
            if (runIndex >= 0) {
                lockboxProcessingRuns[runIndex].clearingDocuments = mappedData;
                lockboxProcessingRuns[runIndex].clearingDocumentsTimestamp = new Date().toISOString();
                saveRunsToFile();
                console.log(`   💾 Stored RULE-004 data to run for future use`);
            }
        } catch (saveError) {
            console.error(`   ⚠️  Failed to store RULE-004 data:`, saveError.message);
            // Non-fatal
        }
        
        res.json({
            success: true,
            lockboxId: lockboxId,
            documents: mappedData,
            count: mappedData.length,
            source: 'sap',
            fetchedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ RULE-004 Error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ============================================================================
// PROCESSING RULES API ENDPOINTS
// For managing lockbox processing rules with conditions and G/L account actions
// ============================================================================

// Initialize default processing rules
const defaultProcessingRules = [
    {
        ruleId: "Rule_001",
        fileType: "Excel/CSV",
        ruleType: "Document Type",
        ruleDescription: "Validate and map document type based on input file data before posting to SAP",
        active: true,
        priority: 10,
        conditionLogic: "AND",
        conditions: [{
            attribute: "LockboxDestination",
            operator: "contains",
            value: "LOCKBOXDES",
            value2: ""
        }],
        actions: [{
            actionType: "odata_call",
            target: "/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT",
            configSummary: "GET OData - Fetch Document Number",
            config: {
                method: "GET",
                endpoint: "/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT",
                params: { "sap-client": "100", "P_DocumentNumber": "{{PaymentReference}}" },
                responseMapping: "value[0].DocumentNumber"
            }
        }]
    },
    {
        ruleId: "Rule_002",
        fileType: "Excel/CSV",
        ruleType: "Comma Handling",
        ruleDescription: "Remove comma separators from numeric fields before processing",
        active: true,
        priority: 20,
        conditionLogic: "OR",
        conditions: [{
            attribute: "Amount",
            operator: "contains",
            value: ",",
            value2: ""
        }],
        actions: [{
            actionType: "transformation",
            target: "Amount",
            configSummary: "Replace: Remove commas from amount",
            config: {
                transformType: "replace",
                sourceFields: "Amount",
                targetField: "Amount",
                transformConfig: { "find": ",", "replace": "" }
            }
        }]
    },
    {
        ruleId: "Rule_003",
        fileType: "Excel/CSV",
        ruleType: "Hyphen Handling",
        ruleDescription: "Handle hyphen-separated reference values based on configured pattern",
        active: true,
        priority: 30,
        conditionLogic: "AND",
        conditions: [{
            attribute: "PaymentReference",
            operator: "contains",
            value: "-",
            value2: ""
        }],
        actions: [{
            actionType: "transformation",
            target: "PaymentReference",
            configSummary: "Split: Extract before hyphen",
            config: {
                transformType: "split",
                sourceFields: "PaymentReference",
                targetField: "ProcessedReference",
                transformConfig: { "delimiter": "-", "index": 0 }
            }
        }]
    },
    {
        ruleId: "Rule_004",
        fileType: "Excel (Multi-Sheet)",
        ruleType: "Multiple Sheet Processing",
        ruleDescription: "Process and validate each sheet separately when file contains multiple sheets",
        active: true,
        priority: 40,
        conditionLogic: "AND",
        conditions: [{
            attribute: "FileType",
            operator: "equals",
            value: "xlsx",
            value2: ""
        }],
        actions: [{
            actionType: "validation",
            target: "SheetCount",
            configSummary: "Validate: Check sheet count",
            config: {
                validationType: "range",
                validationField: "SheetCount",
                validationRule: { "min": 1, "max": 10 },
                errorMessage: "File must contain 1-10 sheets"
            }
        }]
    },
    {
        ruleId: "Rule_005",
        fileType: "Excel/CSV",
        ruleType: "Positive/Negative Posting",
        ruleDescription: "Post positive and negative amounts as separate line items during SAP posting",
        active: true,
        priority: 50,
        conditionLogic: "OR",
        conditions: [{
            attribute: "Amount",
            operator: "lessThan",
            value: "0",
            value2: ""
        }],
        actions: [{
            actionType: "post_gl",
            target: "21180000",
            configSummary: "G/L: 21180000 with profit center",
            config: {
                glAccount: "21180000",
                profitCenter: "YB911",
                costCenter: "",
                additionalFields: { "TaxCode": "", "Segment": "" }
            }
        }]
    }
];

// GET all processing rules
app.get('/api/processing-rules', async (req, res) => {
    try {
        if (!dbAvailable) {
            // Return rules loaded from file instead of hardcoded defaults
            return res.json(processingRules);
        }
        
        const result = await pool.query('SELECT * FROM lb_processing_rules ORDER BY priority, rule_id');
        const rules = result.rows.map(row => ({
            ruleId: row.rule_id,
            fileType: row.file_type,
            ruleType: row.rule_type,
            ruleDescription: row.rule_description,
            active: row.active,
            priority: row.priority,
            conditionLogic: row.condition_logic || 'AND',
            conditions: row.conditions || [],
            actions: row.actions || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
        
        // If no rules in DB, return rules from file
        if (rules.length === 0) {
            return res.json(processingRules);
        }
        
        res.json(rules);
    } catch (err) {
        console.error('Error fetching processing rules:', err);
        res.status(500).json({ error: 'Failed to fetch processing rules', message: err.message });
    }
});

// GET single processing rule
app.get('/api/processing-rules/:ruleId', async (req, res) => {
    try {
        if (!dbAvailable) {
            const rule = processingRules.find(r => r.ruleId === req.params.ruleId);
            if (!rule) {
                return res.status(404).json({ error: 'Rule not found' });
            }
            return res.json(rule);
        }
        
        const result = await pool.query('SELECT * FROM lb_processing_rules WHERE rule_id = $1', [req.params.ruleId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Rule not found' });
        }
        
        const row = result.rows[0];
        const rule = {
            ruleId: row.rule_id,
            fileType: row.file_type,
            ruleType: row.rule_type,
            ruleDescription: row.rule_description,
            active: row.active,
            priority: row.priority,
            conditionLogic: row.condition_logic || 'AND',
            conditions: row.conditions || [],
            actions: row.actions || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
        
        res.json(rule);
    } catch (err) {
        console.error('Error fetching processing rule:', err);
        res.status(500).json({ error: 'Failed to fetch processing rule', message: err.message });
    }
});

// POST create new processing rule
app.post('/api/processing-rules', async (req, res) => {
    try {
        const rule = req.body;
        
        if (!dbAvailable) {
            return res.status(503).json({ error: 'Database not available' });
        }
        
        const id = require('crypto').randomUUID();
        await pool.query(`
            INSERT INTO lb_processing_rules 
            (id, rule_id, file_type, rule_type, rule_description, active, priority,
             condition_logic, conditions, actions)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
            id, rule.ruleId, rule.fileType, rule.ruleType, rule.ruleDescription,
            rule.active !== false, rule.priority || 10,
            rule.conditionLogic || 'AND',
            JSON.stringify(rule.conditions || []),
            JSON.stringify(rule.actions || [])
        ]);
        
        res.json({ success: true, ruleId: rule.ruleId });
    } catch (err) {
        console.error('Error creating processing rule:', err);
        res.status(500).json({ error: 'Failed to create processing rule', message: err.message });
    }
});

// PUT update processing rule
app.put('/api/processing-rules/:ruleId', async (req, res) => {
    try {
        const rule = req.body;
        
        if (!dbAvailable) {
            return res.status(503).json({ error: 'Database not available' });
        }
        
        await pool.query(`
            UPDATE lb_processing_rules 
            SET file_type = $1, rule_type = $2, rule_description = $3, active = $4,
                priority = $5, condition_logic = $6, conditions = $7, actions = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE rule_id = $9
        `, [
            rule.fileType, rule.ruleType, rule.ruleDescription, rule.active,
            rule.priority || 10, rule.conditionLogic || 'AND',
            JSON.stringify(rule.conditions || []),
            JSON.stringify(rule.actions || []),
            req.params.ruleId
        ]);
        
        res.json({ success: true, ruleId: req.params.ruleId });
    } catch (err) {
        console.error('Error updating processing rule:', err);
        res.status(500).json({ error: 'Failed to update processing rule', message: err.message });
    }
});

// DELETE processing rule
app.delete('/api/processing-rules/:ruleId', async (req, res) => {
    try {
        if (!dbAvailable) {
            return res.status(503).json({ error: 'Database not available' });
        }
        
        await pool.query('DELETE FROM lb_processing_rules WHERE rule_id = $1', [req.params.ruleId]);
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting processing rule:', err);
        res.status(500).json({ error: 'Failed to delete processing rule', message: err.message });
    }
});

// Initialize processing rules in database on startup
async function initializeProcessingRules() {
    if (!dbAvailable) {
        console.log('Database not available, skipping processing rules initialization');
        return;
    }
    
    try {
        const result = await pool.query('SELECT COUNT(*) FROM lb_processing_rules');
        const count = parseInt(result.rows[0].count);
        
        if (count === 0) {
            console.log('Initializing default processing rules...');
            for (const rule of defaultProcessingRules) {
                const id = require('crypto').randomUUID();
                await pool.query(`
                    INSERT INTO lb_processing_rules 
                    (id, rule_id, file_type, rule_type, rule_description, active, priority,
                     condition_logic, conditions, actions)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    id, rule.ruleId, rule.fileType, rule.ruleType, rule.ruleDescription,
                    rule.active, rule.priority, rule.conditionLogic,
                    JSON.stringify(rule.conditions), JSON.stringify(rule.actions)
                ]);
            }
            console.log('Processing rules initialized in LB_Processing_Rules:', defaultProcessingRules.length);
        }
    } catch (err) {
        console.error('Error initializing processing rules:', err.message);
    }
}

// Call initialization after database is ready
setTimeout(() => initializeProcessingRules(), 3000);

// ============================================================================
// REFERENCE DOCUMENT RULES API ENDPOINTS
// For determining clearing document number during lockbox processing
// ============================================================================

// GET all reference document rules
app.get('/api/field-mapping/reference-doc-rules', (req, res) => {
    res.json({
        rules: referenceDocRules,
        selectedRule: selectedReferenceDocRule,
        activeRule: getActiveReferenceDocRule()
    });
});

// GET single reference document rule
app.get('/api/field-mapping/reference-doc-rules/:ruleId', (req, res) => {
    const rule = referenceDocRules.find(r => r.ruleId === req.params.ruleId);
    if (!rule) {
        return res.status(404).json({ error: 'Reference document rule not found' });
    }
    res.json(rule);
});

// POST create new reference document rule
app.post('/api/field-mapping/reference-doc-rules', (req, res) => {
    try {
        const { ruleName, description, ruleType, logicCondition, documentIdType, priority } = req.body;
        
        if (!ruleName || !ruleType) {
            return res.status(400).json({ error: 'Rule name and type are required' });
        }
        
        const newRule = {
            id: uuidv4(),
            ruleId: `RULE-${String(refDocRuleIdCounter++).padStart(3, '0')}`,
            ruleName,
            description: description || '',
            ruleType,
            logicCondition: logicCondition || '',
            documentIdType: documentIdType || '',
            priority: priority || referenceDocRules.length + 1,
            isDefault: false,
            active: true,
            createdAt: new Date().toISOString()
        };
        
        referenceDocRules.push(newRule);
        saveRefDocRulesToFile();
        
        console.log('Created new reference doc rule:', newRule.ruleId);
        res.status(201).json({ success: true, rule: newRule });
    } catch (err) {
        console.error('Error creating reference doc rule:', err);
        res.status(500).json({ error: 'Failed to create rule', message: err.message });
    }
});

// PUT update reference document rule
app.put('/api/field-mapping/reference-doc-rules/:ruleId', (req, res) => {
    try {
        const idx = referenceDocRules.findIndex(r => r.ruleId === req.params.ruleId);
        if (idx === -1) {
            return res.status(404).json({ error: 'Reference document rule not found' });
        }
        
        const updatedRule = {
            ...referenceDocRules[idx],
            ...req.body,
            ruleId: referenceDocRules[idx].ruleId, // Preserve ID
            id: referenceDocRules[idx].id,
            createdAt: referenceDocRules[idx].createdAt,
            updatedAt: new Date().toISOString()
        };
        
        referenceDocRules[idx] = updatedRule;
        saveRefDocRulesToFile();
        
        console.log('Updated reference doc rule:', updatedRule.ruleId);
        res.json({ success: true, rule: updatedRule });
    } catch (err) {
        console.error('Error updating reference doc rule:', err);
        res.status(500).json({ error: 'Failed to update rule', message: err.message });
    }
});

// DELETE reference document rule
app.delete('/api/field-mapping/reference-doc-rules/:ruleId', (req, res) => {
    try {
        const idx = referenceDocRules.findIndex(r => r.ruleId === req.params.ruleId);
        if (idx === -1) {
            return res.status(404).json({ error: 'Reference document rule not found' });
        }
        
        // Don't allow deleting the currently selected rule
        if (referenceDocRules[idx].ruleId === selectedReferenceDocRule) {
            return res.status(400).json({ error: 'Cannot delete the currently selected rule' });
        }
        
        const deleted = referenceDocRules.splice(idx, 1)[0];
        saveRefDocRulesToFile();
        
        console.log('Deleted reference doc rule:', deleted.ruleId);
        res.json({ success: true, message: 'Rule deleted', ruleId: deleted.ruleId });
    } catch (err) {
        console.error('Error deleting reference doc rule:', err);
        res.status(500).json({ error: 'Failed to delete rule', message: err.message });
    }
});

// POST select/activate a reference document rule
app.post('/api/field-mapping/reference-doc-rules/:ruleId/select', (req, res) => {
    try {
        const rule = referenceDocRules.find(r => r.ruleId === req.params.ruleId);
        if (!rule) {
            return res.status(404).json({ error: 'Reference document rule not found' });
        }
        
        if (!rule.active) {
            return res.status(400).json({ error: 'Cannot select an inactive rule' });
        }
        
        selectedReferenceDocRule = rule.ruleId;
        saveRefDocRulesToFile();
        
        console.log('Selected reference doc rule:', selectedReferenceDocRule);
        res.json({ 
            success: true, 
            message: `Rule "${rule.ruleName}" selected as active`,
            selectedRule: selectedReferenceDocRule,
            rule 
        });
    } catch (err) {
        console.error('Error selecting reference doc rule:', err);
        res.status(500).json({ error: 'Failed to select rule', message: err.message });
    }
});

// PATCH toggle rule active status
app.patch('/api/field-mapping/reference-doc-rules/:ruleId/toggle', (req, res) => {
    try {
        const rule = referenceDocRules.find(r => r.ruleId === req.params.ruleId);
        if (!rule) {
            return res.status(404).json({ error: 'Reference document rule not found' });
        }
        
        // Don't allow deactivating the currently selected rule
        if (rule.ruleId === selectedReferenceDocRule && rule.active) {
            return res.status(400).json({ error: 'Cannot deactivate the currently selected rule' });
        }
        
        rule.active = !rule.active;
        rule.updatedAt = new Date().toISOString();
        saveRefDocRulesToFile();
        
        console.log(`Toggled rule ${rule.ruleId} active status to: ${rule.active}`);
        res.json({ success: true, rule });
    } catch (err) {
        console.error('Error toggling rule:', err);
        res.status(500).json({ error: 'Failed to toggle rule', message: err.message });
    }
});

// ============================================================================
// LOCKBOX PROCESSING ENGINE
// Automated workflow: Upload → Pattern Detection → Extract → Validate → Map
// ============================================================================

// In-memory cache for processing runs (backed by PostgreSQL)
let lockboxProcessingRuns = [];
let runIdCounter = 1;

// Flag to track if database is available
let dbAvailable = false;

// File-based backup storage path (used when DB is not available)
const fs = require('fs');
const RUNS_BACKUP_FILE = path.join(__dirname, 'data', 'processing_runs.json');

// Ensure data directory exists
function ensureDataDir() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

// Save runs to file (backup when DB not available)
function saveRunsToFile() {
    try {
        ensureDataDir();
        fs.writeFileSync(RUNS_BACKUP_FILE, JSON.stringify(lockboxProcessingRuns, null, 2));
        console.log('Runs saved to backup file:', lockboxProcessingRuns.length, 'runs');
    } catch (err) {
        console.error('Error saving runs to file:', err.message);
    }
}

// Load runs from file (backup when DB not available)
function loadRunsFromFile() {
    try {
        if (fs.existsSync(RUNS_BACKUP_FILE)) {
            const data = fs.readFileSync(RUNS_BACKUP_FILE, 'utf8');
            lockboxProcessingRuns = JSON.parse(data);
            console.log('Loaded', lockboxProcessingRuns.length, 'runs from backup file');
            
            // Update run counter
            if (lockboxProcessingRuns.length > 0) {
                const lastRun = lockboxProcessingRuns[0];
                const match = lastRun.runId?.match(/RUN-\d+-(\d+)/);
                if (match) {
                    runIdCounter = parseInt(match[1], 10) + 1;
                }
            }
        }
    } catch (err) {
        console.error('Error loading runs from file:', err.message);
        lockboxProcessingRuns = [];
    }
}

// Initialize run ID counter from database
async function initRunIdCounter() {
    if (!dbAvailable) {
        console.log('Database not available, using file-based backup');
        loadRunsFromFile();
        return;
    }
    try {
        const result = await pool.query(
            "SELECT run_id FROM lockbox_processing_run ORDER BY created_at DESC LIMIT 1"
        );
        if (result.rows.length > 0) {
            const lastRunId = result.rows[0].run_id;
            const match = lastRunId.match(/RUN-\d+-(\d+)/);
            if (match) {
                runIdCounter = parseInt(match[1], 10) + 1;
            }
        }
        console.log('Run ID counter initialized:', runIdCounter);
    } catch (err) {
        console.log('Could not initialize run ID counter:', err.message);
    }
}

// Save processing run to PostgreSQL (or file backup)
async function saveProcessingRun(run) {
    // Always save to file as backup
    const idx = lockboxProcessingRuns.findIndex(r => r.runId === run.runId);
    if (idx >= 0) {
        lockboxProcessingRuns[idx] = run;
    }
    saveRunsToFile();
    
    if (!dbAvailable) {
        console.log('Run saved to backup file:', run.runId);
        return;
    }
    try {
        const query = `
            INSERT INTO lockbox_processing_run 
            (id, run_id, filename, file_type, file_size, started_at, completed_at, 
             current_stage, overall_status, last_failed_stage, stages, sap_payload, 
             hierarchy, mapped_data, extracted_data, production_result, raw_data, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP)
            ON CONFLICT (run_id) DO UPDATE SET
                completed_at = EXCLUDED.completed_at,
                current_stage = EXCLUDED.current_stage,
                overall_status = EXCLUDED.overall_status,
                last_failed_stage = EXCLUDED.last_failed_stage,
                stages = EXCLUDED.stages,
                sap_payload = EXCLUDED.sap_payload,
                hierarchy = EXCLUDED.hierarchy,
                mapped_data = EXCLUDED.mapped_data,
                production_result = EXCLUDED.production_result,
                updated_at = CURRENT_TIMESTAMP
        `;
        
        await pool.query(query, [
            run.id || require('uuid').v4(),
            run.runId,
            run.filename,
            run.fileType,
            run.fileSize,
            run.startedAt,
            run.completedAt,
            run.currentStage,
            run.overallStatus,
            run.lastFailedStage,
            JSON.stringify(run.stages),
            JSON.stringify(run.sapPayload),
            JSON.stringify(run.hierarchy),
            JSON.stringify(run.mappedData),
            JSON.stringify(run.extractedData),
            JSON.stringify(run.productionResult),
            JSON.stringify(run.rawData || [])
        ]);
        
        console.log('Processing run saved to database:', run.runId);
    } catch (err) {
        console.error('Error saving processing run:', err.message);
    }
}

// Load all processing runs from PostgreSQL (or file backup)
async function loadProcessingRuns() {
    if (!dbAvailable) {
        console.log('Database not available, loading from file backup');
        loadRunsFromFile();
        return;
    }
    try {
        const result = await pool.query(
            "SELECT * FROM lockbox_processing_run ORDER BY created_at DESC LIMIT 100"
        );
        
        lockboxProcessingRuns = result.rows.map(row => ({
            id: row.id,
            runId: row.run_id,
            filename: row.filename,
            fileType: row.file_type,
            fileSize: row.file_size,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            currentStage: row.current_stage,
            overallStatus: row.overall_status,
            lastFailedStage: row.last_failed_stage,
            stages: row.stages || {},
            sapPayload: row.sap_payload,
            hierarchy: row.hierarchy,
            mappedData: row.mapped_data,
            extractedData: row.extracted_data,
            productionResult: row.production_result,
            rawData: row.raw_data
        }));
        
        console.log('Loaded', lockboxProcessingRuns.length, 'processing runs from database');
        
        // Also save to file as backup
        saveRunsToFile();
    } catch (err) {
        console.error('Error loading processing runs:', err.message);
        // Try loading from file backup
        loadRunsFromFile();
    }
}

// Generate unique run ID
function generateProcessingRunId() {
    const year = new Date().getFullYear();
    return `RUN-${year}-${String(runIdCounter++).padStart(5, '0')}`;
}

/**
 * Validate and detect document type for reference field
 * Determines if a document number is likely BELNR (Accounting) or XBLNR (Reference)
 * 
 * SAP Logic:
 * - BELNR (Accounting Document): Typically 10 digits, system-generated by SAP FI
 * - XBLNR (Reference Document): External reference, can be any format (invoice, PO, etc.)
 * 
 * Detection Rules:
 * 1. If explicit XBLNR/BELNR columns exist → Use them
 * 2. If number is exactly 10 digits → Likely BELNR
 * 3. If alphanumeric or different length → Likely XBLNR
 * 4. Default: Treat as XBLNR (invoices are typically references)
 */
function detectDocumentType(documentNumber, explicitType = null) {
    // If explicit type is provided, use it
    if (explicitType === 'XBLNR' || explicitType === 'BELNR') {
        return {
            type: explicitType,
            confidence: 'HIGH',
            reason: 'Explicit column mapping'
        };
    }
    
    const docStr = (documentNumber || '').toString().trim();
    
    // Empty value
    if (!docStr) {
        return {
            type: 'UNKNOWN',
            confidence: 'NONE',
            reason: 'Empty document number'
        };
    }
    
    // Check if it's purely numeric and 10 digits (SAP Accounting Document pattern)
    const isNumeric = /^\d+$/.test(docStr);
    const length = docStr.length;
    
    if (isNumeric && length === 10) {
        return {
            type: 'BELNR',
            confidence: 'MEDIUM',
            reason: '10-digit numeric pattern matches SAP Accounting Document (BELNR)'
        };
    }
    
    // If it contains letters or is not 10 digits, likely XBLNR
    if (!isNumeric || length !== 10) {
        return {
            type: 'XBLNR',
            confidence: 'MEDIUM',
            reason: 'Alphanumeric or non-standard length indicates external reference (XBLNR)'
        };
    }
    
    // Default: Treat as XBLNR (invoices are typically external references)
    return {
        type: 'XBLNR',
        confidence: 'LOW',
        reason: 'Default to invoice reference (XBLNR)'
    };
}

// Column header patterns for field detection
const COLUMN_PATTERNS = {
    'Customer': ['customer', 'customer_id', 'cust', 'customer_no', 'customer number'],
    'CheckNumber': ['check number', 'check_number', 'check no', 'cheque', 'cheque number', 'check'],
    'CheckAmount': ['check amount', 'check_amount', 'cheque amount', 'total amount', 'amount'],
    'InvoiceNumber': ['invoice number', 'invoice_number', 'invoice no', 'invoice', 'inv', 'invoice_no', 'payment reference'],
    'InvoiceAmount': ['invoice amount', 'invoice_amount', 'inv amount', 'line amount'],
    'DeductionAmount': ['deduction amount', 'deduction_amount', 'deduction', 'discount'],
    'ReasonCode': ['reason code', 'reason_code', 'reason', 'deduction reason'],
    'DepositDate': ['deposit date', 'deposit_date', 'date', 'payment date', 'deposit'],
    'XBLNR': ['xblnr', 'external reference', 'invoice reference', 'external document'],
    'BELNR': ['belnr', 'accounting document', 'document number', 'accounting doc']
};

// ============================================================================
// PATTERN DETECTION - Detect file pattern from data structure
// ============================================================================
function detectFilePattern(data, headers, fileType) {
    console.log('=== PATTERN DETECTION (DYNAMIC WITH CONDITIONS) ===');
    console.log('File type:', fileType);
    console.log('Headers:', headers);
    console.log('Data rows:', data.length);
    
    // Get header mapping first
    const headerMapping = matchColumnHeaders(headers);
    console.log('Header mapping:', Object.keys(headerMapping).join(', '));
    
    // Analyze the data to determine pattern
    const analysis = analyzeDataStructure(data, headerMapping);
    console.log('Data analysis:', analysis);
    
    // Find best matching pattern from filePatterns array (loaded from file_patterns.json)
    let bestMatch = null;
    let bestScore = 0;
    let matchDetails = [];
    
    for (const pattern of filePatterns) {
        if (!pattern.active) continue;
        
        // File type matching - EXCEL matches XLSX/XLS, CSV matches CSV
        const normalizedPatternType = pattern.fileType?.toUpperCase() || 'ALL';
        const normalizedFileType = fileType?.toUpperCase() || '';
        const fileTypeMatch = normalizedPatternType === 'ALL' ||
                              normalizedPatternType === normalizedFileType ||
                              (normalizedPatternType === 'EXCEL' && (normalizedFileType === 'XLSX' || normalizedFileType === 'XLS'));
        
        if (!fileTypeMatch) continue;
        
        let score = 0;
        let conditionsMatched = 0;
        let conditionDetails = [];
        
        // PHASE 2: Check pattern conditions dynamically from JSON
        if (pattern.conditions && Array.isArray(pattern.conditions)) {
            console.log(`Checking conditions for pattern ${pattern.patternId}:`, pattern.conditions.length, 'conditions');
            
            for (const condition of pattern.conditions) {
                const docFormat = condition.documentFormat || condition.detectionCondition || condition.fieldName;
                const conditionValue = condition.condition || condition.value;
                
                // Match condition against data
                let conditionMet = false;
                
                // Check if document format exists in headers or data
                if (docFormat) {
                    const normalizedDocFormat = docFormat.toLowerCase();
                    
                    // Check header match
                    const headerMatch = headers.some(h => 
                        h && h.toString().toLowerCase().includes(normalizedDocFormat)
                    );
                    
                    if (headerMatch) {
                        conditionMet = true;
                        conditionsMatched++;
                        conditionDetails.push(`✓ ${docFormat} found in headers`);
                    }
                    
                    // Check condition value match in data
                    if (conditionValue) {
                        const condNorm = conditionValue.toLowerCase();
                        
                        // Check for "With Comma Separator" or delimiter patterns
                        if (condNorm.includes('comma') || condNorm.includes('separator')) {
                            // Check if pattern has a delimiter defined
                            if (pattern.delimiter) {
                                // Check if data has delimited values
                                if (pattern.delimiter === ',' && (analysis.hasDelimitedInvoices || analysis.hasDelimitedChecks || analysis.hasDelimitedAmounts)) {
                                    conditionMet = true;
                                    conditionsMatched++;
                                    conditionDetails.push(`✓ Comma delimiter detected in data`);
                                }
                            }
                        }
                        
                        // Check analysis object for common patterns
                        if (condNorm.includes('single') && condNorm.includes('check') && analysis.checkUnique) {
                            conditionMet = true;
                            conditionsMatched++;
                            conditionDetails.push(`✓ ${conditionValue} matches data pattern`);
                        }
                        if (condNorm.includes('multiple') && !analysis.checkUnique) {
                            conditionMet = true;
                            conditionsMatched++;
                            conditionDetails.push(`✓ ${conditionValue} matches data pattern`);
                        }
                    }
                }
            }
            
            // Score based on condition matches
            if (pattern.conditions.length > 0) {
                const conditionMatchRatio = conditionsMatched / pattern.conditions.length;
                score += conditionMatchRatio * 150; // High weight for condition matches
                console.log(`Pattern ${pattern.patternId}: ${conditionsMatched}/${pattern.conditions.length} conditions matched (${(conditionMatchRatio * 100).toFixed(0)}%)`);
            }
        }
        
        // CRITICAL: High priority scoring for delimiter detection
        // This must override other patterns when delimiters are detected
        if (pattern.delimiter && pattern.delimiter === ',') {
            if (analysis.hasDelimitedInvoices) {
                score += 300; // Very high score for invoice delimiter match
                conditionDetails.push(`✓✓ DELIMITER MATCH: Comma-delimited invoices detected`);
                console.log(`  ** CRITICAL: Pattern ${pattern.patternId} has delimiter match - adding 300 points`);
            }
            if (analysis.hasDelimitedChecks) {
                score += 300; // Very high score for check delimiter match
                conditionDetails.push(`✓✓ DELIMITER MATCH: Comma-delimited checks detected`);
                console.log(`  ** CRITICAL: Pattern ${pattern.patternId} has delimiter match - adding 300 points`);
            }
            if (analysis.hasDelimitedAmounts) {
                score += 300; // Very high score for amount delimiter match
                conditionDetails.push(`✓✓ DELIMITER MATCH: Comma-delimited amounts detected`);
                console.log(`  ** CRITICAL: Pattern ${pattern.patternId} has delimiter match - adding 300 points`);
            }
        }
        
        // Legacy scoring for backward compatibility (lower priority now)
        if (pattern.patternType === 'SINGLE_CHECK_SINGLE_INVOICE' && 
            analysis.checkUnique && analysis.invoiceUnique) {
            score += 50; // Reduced from 100
        }
        if (pattern.patternType === 'SINGLE_CHECK_MULTI_INVOICE' && 
            !analysis.checkUnique && analysis.hasEmptyCheckRows) {
            score += 50; // Reduced from 100
        }
        if (pattern.patternType === 'MULTI_CHECK_MULTI_INVOICE' && 
            !analysis.checkUnique && !analysis.invoiceUnique) {
            score += 45; // Reduced from 90
        }
        if (pattern.patternType === 'INVOICE_SPLIT' && analysis.hasDelimitedInvoices) {
            score += 200;
        }
        if (pattern.patternType === 'CHECK_SPLIT' && analysis.hasDelimitedChecks) {
            score += 200;
        }
        if (pattern.patternType === 'AMOUNT_SPLIT' && analysis.hasDelimitedAmounts) {
            score += 200;
        }
        
        // Bonus for priority
        score += (200 - (pattern.priority || 100)) / 10;
        
        matchDetails.push({
            patternId: pattern.patternId,
            patternName: pattern.patternName,
            score: score,
            conditionsMatched: conditionsMatched,
            totalConditions: pattern.conditions?.length || 0,
            conditionDetails: conditionDetails
        });
        
        if (score > bestScore) {
            bestScore = score;
            bestMatch = pattern;
        }
    }
    
    // If no pattern matched, use a default
    if (!bestMatch) {
        console.log('No pattern matched, using default');
        bestMatch = filePatterns.find(p => p.patternType === 'SINGLE_CHECK_MULTI_INVOICE' && p.active) ||
                   filePatterns.find(p => p.active);
    }
    
    console.log('✓ MATCHED PATTERN:', bestMatch?.patternId, bestMatch?.patternName, 'Score:', bestScore);
    console.log('Match details:', JSON.stringify(matchDetails, null, 2));
    
    return {
        pattern: bestMatch,
        score: bestScore,
        analysis: analysis,
        headerMapping: headerMapping,
        matchDetails: matchDetails
    };
}

// ============================================================================
// PHASE 3: DYNAMIC RULE EXECUTION HELPERS
// ============================================================================

// Check if a rule condition is met based on extracted data
function checkRuleCondition(condition, extractedData, patternResult) {
    const docFormat = (condition.documentFormat || condition.fieldName || '').toLowerCase();
    const conditionValue = (condition.condition || condition.value || '').toLowerCase();
    
    // Check if document format exists in the data
    if (docFormat) {
        // Check in headers/fields
        const hasField = extractedData.some(row => {
            const keys = Object.keys(row).map(k => k.toLowerCase());
            return keys.some(k => k.includes(docFormat));
        });
        
        if (hasField) return true;
    }
    
    // Check condition value against pattern analysis
    if (conditionValue) {
        if (conditionValue.includes('single') && conditionValue.includes('check')) {
            return patternResult.analysis?.checkUnique === true;
        }
        if (conditionValue.includes('multiple') && conditionValue.includes('check')) {
            return patternResult.analysis?.checkUnique === false;
        }
        if (conditionValue.includes('single') && conditionValue.includes('invoice')) {
            return patternResult.analysis?.invoiceUnique === true;
        }
        if (conditionValue.includes('multiple') && conditionValue.includes('invoice')) {
            return patternResult.analysis?.invoiceUnique === false;
        }
    }
    
    // Default: condition is met
    return true;
}

// Execute an API mapping and enrich the extracted data
// ⚡ NOW USING DYNAMIC RULE ENGINE FROM /srv/handlers/rule-engine.js
async function executeApiMapping(mapping, extractedData, ruleId) {
    console.log(`    → API Mapping: ${mapping.apiReference}`);
    console.log(`      Input: ${mapping.inputField} from ${mapping.sourceInput}`);
    console.log(`      Output: ${mapping.outputField} → ${mapping.lockboxApiField}`);
    console.log(`    ⚡ CALLING DYNAMIC RULE ENGINE for ${ruleId}`);
    
    try {
        let result;
        
        // Call the appropriate dynamic rule execution function
        switch (ruleId) {
            case 'RULE-001':
                // RULE-001 needs all mappings to fetch both BELNR and CompanyCode
                result = await ruleEngine.executeRule001(mapping, extractedData);
                break;
            case 'RULE-002':
                // RULE-002 needs all mappings, not just one
                // For now, pass the single mapping and let it handle
                result = await ruleEngine.executeRule002(mapping, extractedData);
                break;
            case 'RULE-003':
                result = await ruleEngine.executeRule003(mapping, extractedData);
                break;
            case 'RULE-004':
                result = await ruleEngine.executeRule004(mapping, extractedData);
                break;
            default:
                console.log(`      ⚠ No dynamic handler for ${ruleId}, using fallback`);
                return {
                    success: true,
                    recordsAffected: 0,
                    message: `No handler for ${ruleId}`
                };
        }
        
        console.log(`    ✓ ${ruleId} complete: ${result.message}`);
        
        return {
            success: result.success,
            recordsAffected: result.recordsEnriched || result.recordsValidated || 0,
            message: result.message,
            errors: result.errors || [],
            warnings: result.warnings || []
        };
        
    } catch (error) {
        console.error(`    ✗ Error executing ${ruleId}:`, error.message);
        return {
            success: false,
            recordsAffected: 0,
            message: `Error: ${error.message}`,
            errors: [error.message]
        };
    }
}

// ============================================================================
// ANALYZE DATA STRUCTURE - Analyze data structure to determine pattern characteristics
function analyzeDataStructure(data, headerMapping) {
    const analysis = {
        rowCount: data.length,
        checkUnique: true,
        invoiceUnique: true,
        hasEmptyCheckRows: false,
        customerCount: 0,
        hasDelimitedChecks: false,
        hasDelimitedInvoices: false,
        hasDelimitedAmounts: false,
        uniqueChecks: new Set(),
        uniqueInvoices: new Set(),
        uniqueCustomers: new Set()
    };
    
    const checkIdx = headerMapping.CheckNumber?.index;
    const invoiceIdx = headerMapping.InvoiceNumber?.index;
    const customerIdx = headerMapping.Customer?.index;
    const amountIdx = headerMapping.CheckAmount?.index || headerMapping.InvoiceAmount?.index;
    
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        // Check for empty check number (indicates fill-down pattern)
        if (checkIdx !== undefined) {
            const checkVal = row[checkIdx];
            if (!checkVal || checkVal.toString().trim() === '') {
                analysis.hasEmptyCheckRows = true;
            } else {
                // Check for delimiters
                if (checkVal.toString().includes(',') || checkVal.toString().includes('|')) {
                    analysis.hasDelimitedChecks = true;
                }
                if (analysis.uniqueChecks.has(checkVal)) {
                    analysis.checkUnique = false;
                }
                analysis.uniqueChecks.add(checkVal);
            }
        }
        
        // Check invoice patterns
        if (invoiceIdx !== undefined) {
            const invoiceVal = row[invoiceIdx];
            if (invoiceVal) {
                if (invoiceVal.toString().includes(',') || invoiceVal.toString().includes('|')) {
                    analysis.hasDelimitedInvoices = true;
                }
                if (analysis.uniqueInvoices.has(invoiceVal)) {
                    analysis.invoiceUnique = false;
                }
                analysis.uniqueInvoices.add(invoiceVal);
            }
        }
        
        // Check amount patterns
        if (amountIdx !== undefined) {
            const amountVal = row[amountIdx];
            if (amountVal && (amountVal.toString().includes(',') || amountVal.toString().includes('|'))) {
                // Check if it's a delimiter or decimal separator
                const commaCount = (amountVal.toString().match(/,/g) || []).length;
                if (commaCount > 1) {
                    analysis.hasDelimitedAmounts = true;
                }
            }
        }
        
        // Count unique customers
        if (customerIdx !== undefined && row[customerIdx]) {
            analysis.uniqueCustomers.add(row[customerIdx]);
        }
    }
    
    analysis.customerCount = analysis.uniqueCustomers.size;
    
    return analysis;
}

// ============================================================================
// EXTRACT DATA BY PATTERN - Extract data according to detected pattern
// ============================================================================
function extractDataByPattern(data, headers, pattern, headerMapping) {
    console.log('=== EXTRACTING DATA BY PATTERN ===');
    console.log('Pattern:', pattern.patternId, pattern.patternName);
    console.log('Pattern type:', pattern.patternType);
    
    const extractedRows = [];
    let currentCheck = null;
    let currentCustomer = null;
    let currentCheckAmount = 0;
    
    // Get column indices
    const checkIdx = headerMapping.CheckNumber?.index;
    const invoiceIdx = headerMapping.InvoiceNumber?.index;
    const customerIdx = headerMapping.Customer?.index;
    const checkAmountIdx = headerMapping.CheckAmount?.index;
    const invoiceAmountIdx = headerMapping.InvoiceAmount?.index;
    const deductionIdx = headerMapping.DeductionAmount?.index;
    const reasonIdx = headerMapping.ReasonCode?.index;
    const dateIdx = headerMapping.DepositDate?.index;
    const xblnrIdx = headerMapping.XBLNR?.index;
    const belnrIdx = headerMapping.BELNR?.index;
    
    console.log('Column indices - XBLNR:', xblnrIdx, ', BELNR:', belnrIdx);
    
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || row.every(c => !c)) continue; // Skip empty rows
        
        // Handle fill-down pattern for check and customer
        if (checkIdx !== undefined && row[checkIdx] && row[checkIdx].toString().trim() !== '') {
            currentCheck = row[checkIdx].toString().trim();
            // Pad check number to 10 digits
            currentCheck = currentCheck.replace(/\D/g, '').padStart(10, '0');
        }
        if (customerIdx !== undefined && row[customerIdx] && row[customerIdx].toString().trim() !== '') {
            currentCustomer = row[customerIdx].toString().trim();
        }
        if (checkAmountIdx !== undefined && row[checkAmountIdx] && row[checkAmountIdx].toString().trim() !== '') {
            currentCheckAmount = parseFloat(row[checkAmountIdx].toString().replace(/[^0-9.-]/g, '')) || 0;
        }
        
        // Build extracted row with XBLNR and BELNR for reference document rules
        const invoiceNumber = invoiceIdx !== undefined ? (row[invoiceIdx] || '').toString().trim() : `INV-${i + 1}`;
        
        // Determine XBLNR and BELNR with smart detection
        let xblnrValue = '';
        let belnrValue = '';
        let detectionLog = '';
        
        if (xblnrIdx !== undefined) {
            // Explicit XBLNR column provided
            xblnrValue = (row[xblnrIdx] || '').toString().trim();
            detectionLog = 'XBLNR from explicit column';
        } else if (belnrIdx !== undefined) {
            // Explicit BELNR column provided
            belnrValue = (row[belnrIdx] || '').toString().trim();
            detectionLog = 'BELNR from explicit column';
        } else {
            // No explicit columns - detect document type from InvoiceNumber
            const detection = detectDocumentType(invoiceNumber);
            
            if (detection.type === 'BELNR') {
                belnrValue = invoiceNumber;
                detectionLog = `Auto-detected as BELNR: ${detection.reason}`;
            } else {
                // Default to XBLNR (most common case)
                xblnrValue = invoiceNumber;
                detectionLog = `Auto-detected as XBLNR: ${detection.reason}`;
            }
            
            // Log detection for first few rows
            if (i < 3) {
                console.log(`  Row ${i + 1}: InvoiceNumber="${invoiceNumber}" → ${detection.type} (${detection.confidence} confidence)`);
                console.log(`    Reason: ${detection.reason}`);
            }
        }
        
        const extractedRow = {
            Customer: currentCustomer || '',
            CheckNumber: currentCheck || `CHK-${Date.now()}-${i}`,
            CheckAmount: currentCheckAmount,
            InvoiceNumber: invoiceNumber,
            InvoiceAmount: invoiceAmountIdx !== undefined ? parseFloat((row[invoiceAmountIdx] || '0').toString().replace(/[^0-9.-]/g, '')) || 0 : 0,
            DeductionAmount: deductionIdx !== undefined ? parseFloat((row[deductionIdx] || '0').toString().replace(/[^0-9.-]/g, '')) || 0 : 0,
            ReasonCode: reasonIdx !== undefined ? (row[reasonIdx] || '').toString().trim() : '',
            DepositDate: dateIdx !== undefined ? row[dateIdx] : new Date().toISOString().split('T')[0],
            // Reference Document Rule fields - XBLNR (Invoice Reference) and BELNR (Accounting Document)
            XBLNR: xblnrValue,
            BELNR: belnrValue,
            _documentTypeDetection: detectionLog,  // For debugging
            _rowIndex: i + 1,
            _pattern: pattern.patternType
        };
        
        // Handle delimiter splits (using common prefix detection)
        if (pattern.patternType === 'INVOICE_SPLIT' && pattern.delimiter) {
            // Use the advanced split function with common prefix detection
            const invoices = splitInvoiceReferencesForProcessing(extractedRow.InvoiceNumber);
            if (invoices.length > 1) {
                // Split into multiple rows with distributed amounts
                const amountPerInvoice = extractedRow.InvoiceAmount / invoices.length;
                for (const inv of invoices) {
                    extractedRows.push({
                        ...extractedRow,
                        InvoiceNumber: inv,
                        InvoiceAmount: amountPerInvoice,
                        _splitFrom: extractedRow.InvoiceNumber,
                        _splitRule: pattern.patternName
                    });
                }
                continue;
            }
        }
        
        extractedRows.push(extractedRow);
    }
    
    console.log('Extracted rows:', extractedRows.length);
    return extractedRows;
}

// Format date for SAP (YYYY-MM-DDT00:00:00)
function formatDateForSAP(dateStr) {
    if (!dateStr) return null;
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0] + 'T00:00:00';
    } catch (e) {
        return null;
    }
}

// Generate unique Lockbox ID (max 7 chars for SAP)
// Format: LBXXXXX where XXXXX is a sequential number or timestamp-based
function generateUniqueLockboxId(runId) {
    // Generate unique Lockbox ID - purely numeric, no hyphens (SAP rejects special chars)
    // Format: 7-digit number starting from 1000000 + runNumber
    // This ensures SAP doesn't reject the payload with "lockbox file already exists"
    const match = runId?.match(/(\d+)$/);
    if (match) {
        // Base 1000000 + run number (e.g., run 70 → "1000070")
        const runNum = parseInt(match[1], 10);
        return String(1000000 + runNum);
    }
    // Fallback: Use timestamp-based unique ID
    const now = new Date();
    const timeNum = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) % 99999;
    return String(1000000 + timeNum);
}

// ============================================================================
// BUILD STANDARD PAYLOAD - Generate constants (LockboxID, BatchID, ItemID)
// Uses API Fields from Field Mapping Rules for defaults and constants
// Matches exact SAP API_LOCKBOXPOST_IN/LockboxBatch structure
// ============================================================================
function buildStandardPayload(extractedData, lockboxId, runId) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('          BUILDING SAP LOCKBOX PAYLOAD (API Template)              ');
    console.log('═══════════════════════════════════════════════════════════════════');
    
    // Get defaults from API Fields
    const getApiFieldDefault = (fieldName) => {
        const field = apiFields.find(f => f.fieldName === fieldName || f.fieldId === fieldName);
        return field?.defaultValue || '';
    };
    
    // SAP API REQUIRED DEFAULTS - These fields are mandatory for SAP Lockbox API
    // When not provided in the uploaded file, use defaults to prevent 400 errors
    const DEFAULT_PARTNER_BANK = getApiFieldDefault('PartnerBank') || '88888876';
    const DEFAULT_PARTNER_BANK_ACCOUNT = getApiFieldDefault('PartnerBankAccount') || '8765432195';
    const DEFAULT_PARTNER_BANK_COUNTRY = getApiFieldDefault('PartnerBankCountry') || 'US';
    
    // ═══════════════════════════════════════════════════════════════════
    // FIELD SOURCES:
    // - CONSTANT: LockboxBatch="001", PaymentAdviceAccountType="D"
    // - UNIQUE PER RUN: Lockbox (generated from runId to avoid duplicates in SAP)
    // - FROM FILE: DepositDateTime, AmountInTransactionCurrency, Cheque, PartnerBank, 
    //              PartnerBankAccount, PartnerBankCountry, PaymentReference, Customer, etc.
    // - DEFAULT: Currency="USD", LockboxBatchOrigin, LockboxBatchDestination
    // - GENERATED BY SAP: LockboxBatchInternalKey, PaymentAdvice (NOT hardcoded)
    // ═══════════════════════════════════════════════════════════════════
    
    const currency = getApiFieldDefault('Currency') || 'USD';
    const lockboxBatchDestination = getApiFieldDefault('LockboxBatchDestination') || 'LOCKBOXDES';
    const lockboxBatchOrigin = getApiFieldDefault('LockboxBatchOrigin') || 'LOCKBOXORI';
    
    // Generate UNIQUE Lockbox ID for each run to avoid "lockbox file already exists" error
    // If lockboxId is provided (from previous processing), use it; otherwise generate new
    const lockboxNumber = lockboxId || generateUniqueLockboxId(runId);
    
    console.log('');
    console.log('Field Sources:');
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ CONSTANTS (From API Fields - Editable):                         │');
    console.log('│   Lockbox = "' + lockboxNumber + '"                                              │');
    console.log('│   LockboxBatch = "001"                                          │');
    console.log('│   LockboxBatchOrigin = "' + lockboxBatchOrigin + '"                        │');
    console.log('│   LockboxBatchDestination = "' + lockboxBatchDestination + '"                     │');
    console.log('│   PaymentAdviceAccountType = "D"                                │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    console.log('│ DEFAULTS (Configurable via API Fields):                         │');
    console.log('│   Currency = "' + currency + '"                                          │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    console.log('│ FROM UPLOADED FILE:                                             │');
    console.log('│   DepositDateTime, AmountInTransactionCurrency, Cheque,         │');
    console.log('│   PartnerBank, PartnerBankAccount, PartnerBankCountry,          │');
    console.log('│   PaymentReference, NetPaymentAmountInPaytCurrency,             │');
    console.log('│   DeductionAmountInPaytCurrency, PaymentDifferenceReason,       │');
    console.log('│   Customer (for PaymentAdviceAccount in GET API)                │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    console.log('│ GENERATED BY SAP API (NOT hardcoded):                           │');
    console.log('│   LockboxBatchInternalKey, PaymentAdvice                        │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.log('');
    
    // Group by Check Number (one item per check)
    const checkGroups = {};
    for (const row of extractedData) {
        // DEBUG: Log enriched fields
        if (row.Paymentreference || row.CompanyCode) {
            console.log(`  📊 DEBUG: Row has enriched fields - Paymentreference: ${row.Paymentreference}, CompanyCode: ${row.CompanyCode}`);
        }
        
        // Handle field names with spaces (e.g., "Check Number" vs "CheckNumber")
        const checkKey = row['Check Number'] || row.CheckNumber || row.Cheque || `CHK-${Date.now()}`;
        if (!checkGroups[checkKey]) {
            checkGroups[checkKey] = {
                checkNumber: checkKey,
                customer: row.Customer || '',  // Customer from file (for GET LockboxClearing)
                checkAmount: parseFloat(row['Check Amount'] || row.CheckAmount || row.AmountInTransactionCurrency) || 0,
                depositDate: row['Deposit Date'] || row.DepositDate || row.DepositDateTime || '',
                // Bank information FROM FILE - not hardcoded
                partnerBank: row.PartnerBank || '',
                partnerBankAccount: row.PartnerBankAccount || '',
                partnerBankCountry: row.PartnerBankCountry || '',  // From file, not "DE"
                invoices: []
            };
        }
        // Add invoice/payment reference under this check
        // Include XBLNR and BELNR for reference document rule processing
        // PRIORITY: Use Paymentreference (enriched by RULE-001 with AccountingDocument) if available
        const enrichedPayRef = row.Paymentreference || '';
        if (enrichedPayRef) {
            console.log(`  ✅ Row has RULE-001 enriched Paymentreference: ${enrichedPayRef}, CompanyCode: ${row.CompanyCode}`);
        }
        
        checkGroups[checkKey].invoices.push({
            invoiceNumber: row['Invoice Number'] || row.InvoiceNumber || row.PaymentReference || '',
            invoiceAmount: parseFloat(row['Invoice Amount'] || row.InvoiceAmount || row.NetPaymentAmountInPaytCurrency) || 0,
            deductionAmount: parseFloat(row['Deduction Amount'] || row.DeductionAmount || row.DeductionAmountInPaytCurrency) || 0,
            reasonCode: row['Reason Code'] || row.ReasonCode || row.PaymentDifferenceReason || '',
            customer: row.Customer || '', // Customer for each invoice line
            // Reference Document Rule fields
            xblnr: row.XBLNR || '',  // External reference / Invoice reference
            belnr: row.BELNR || '',   // Accounting document number
            // RULE-001 enriched fields (note: capital P in Paymentreference)
            paymentreference: enrichedPayRef, // AccountingDocument from SAP (RULE-001)
            companyCode: row.CompanyCode || '' // CompanyCode from SAP (RULE-001) - for reporting only
        });
    }
    
    // Calculate total amount from all checks
    let totalAmount = 0;
    for (const checkData of Object.values(checkGroups)) {
        totalAmount += checkData.checkAmount;
    }
    
    // Get deposit date from first check or use current date
    const firstCheck = Object.values(checkGroups)[0];
    let depositDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, '');
    if (firstCheck?.depositDate) {
        try {
            const dt = new Date(firstCheck.depositDate);
            if (!isNaN(dt.getTime())) {
                depositDateTime = dt.toISOString().replace(/\.\d{3}Z$/, '');
            }
        } catch (e) {
            // Use current date if parsing fails
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // BUILD SAP PAYLOAD - Exact structure matching API_LOCKBOXPOST_IN
    // ═══════════════════════════════════════════════════════════════════
    const payload = {
        // CONSTANT (from API Fields): Lockbox number - SAP generates LockboxBatchInternalKey
        Lockbox: lockboxNumber,
        // FROM FILE: Deposit date/time
        DepositDateTime: depositDateTime,
        // FROM FILE: Total amount of all checks - format with 2 decimal places
        AmountInTransactionCurrency: parseFloat(totalAmount || 0).toFixed(2),
        // CONSTANT (from API Fields): Origin identifier (10 chars max)
        LockboxBatchOrigin: lockboxBatchOrigin.substring(0, 10),
        // CONSTANT (from API Fields): Destination identifier (10 chars max)
        LockboxBatchDestination: lockboxBatchDestination.substring(0, 10),
        // Items array
        to_Item: {
            results: []
        }
    };
    
    let itemId = 1;
    
    // Get default bank details from API Fields
    const defaultPartnerBank = getApiFieldDefault('PartnerBank') || '15051554';
    const defaultPartnerBankAccount = getApiFieldDefault('PartnerBankAccount') || '314129119';
    const defaultPartnerBankCountry = getApiFieldDefault('PartnerBankCountry') || 'US';
    
    for (const [checkKey, checkData] of Object.entries(checkGroups)) {
        const itemIdStr = String(itemId).padStart(3, '0');
        
        // Determine bank details - Priority: File Data > Business Partner API > Default
        let partnerBank = checkData.partnerBank || defaultPartnerBank;
        let partnerBankAccount = checkData.partnerBankAccount || defaultPartnerBankAccount;
        let partnerBankCountry = checkData.partnerBankCountry || defaultPartnerBankCountry;
        let bankSource = checkData.partnerBank ? 'FILE' : 'DEFAULT';
        
        // Note: Business Partner API call is done asynchronously during production run
        // For payload building, we use file data or defaults
        // The actual BP API lookup happens in the production run if needed
        
        // Build item (check level) - LockboxBatchItem
        const item = {
            // CONSTANT: LockboxBatch is always "001"
            LockboxBatch: '001',
            // SEQUENTIAL: Item number (001, 002, etc.)
            LockboxBatchItem: itemIdStr,
            // FROM FILE: Check amount - format with 2 decimal places
            AmountInTransactionCurrency: parseFloat(checkData.checkAmount || 0).toFixed(2),
            // DEFAULT: Currency
            Currency: currency,
            // FROM FILE: Check/Cheque number
            Cheque: (checkData.checkNumber || '').toString().substring(0, 13),
            // Partner bank information: From file, or defaults (BP API lookup in production run)
            PartnerBank: partnerBank.substring(0, 15),
            PartnerBankAccount: partnerBankAccount.substring(0, 18),
            PartnerBankCountry: partnerBankCountry.substring(0, 3)
        };
        
        console.log(`Building Item ${itemIdStr}:`);
        console.log(`  Cheque: ${item.Cheque}`);
        console.log(`  Amount: ${item.AmountInTransactionCurrency} ${item.Currency}`);
        console.log(`  PartnerBank: ${item.PartnerBank} (source: ${bankSource})`);
        console.log(`  PartnerBankAccount: ${item.PartnerBankAccount}`);
        console.log(`  PartnerBankCountry: ${item.PartnerBankCountry}`);
        console.log(`  Customer (for GET API): ${checkData.customer}`);
        
        // Build to_LockboxClearing entries for payment references
        if (checkData.invoices && checkData.invoices.length > 0) {
            // Get active reference document rule using the proper getter function
            const activeRule = getActiveReferenceDocRule();
            const ruleType = activeRule?.ruleType || 'XBLNR'; // Default to XBLNR (Invoice Number)
            
            console.log(`  Reference Document Rule: ${activeRule?.ruleName || 'Default'} (${ruleType})`);
            console.log(`  Rule Logic: ${activeRule?.logicCondition || 'default'}`);
            
            const clearingResults = checkData.invoices.map(inv => {
                // Determine PaymentReference based on active reference document rule
                // File fields: invoiceNumber (Invoice Number), xblnr (XBLNR), belnr (BELNR)
                // RULE-001 enriched field: paymentreference (AccountingDocument from SAP)
                let paymentReference = '';
                const invoiceNumber = (inv.invoiceNumber || '').toString().trim();
                const xblnr = (inv.xblnr || '').toString().trim();
                const belnr = (inv.belnr || '').toString().trim();
                const enrichedPaymentRef = (inv.paymentreference || '').toString().trim(); // From RULE-001
                const companyCode = (inv.companyCode || '').toString().trim(); // From RULE-001
                
                console.log(`    Rule evaluation: InvoiceNumber=${invoiceNumber}, XBLNR=${xblnr}, BELNR=${belnr}, EnrichedPaymentRef=${enrichedPaymentRef}, CompanyCode=${companyCode}`);
                
                // PRIORITY 1: Use enriched PaymentReference from RULE-001 (AccountingDocument)
                if (enrichedPaymentRef) {
                    paymentReference = enrichedPaymentRef;
                    console.log(`    ✅ Using RULE-001 enriched PaymentReference (AccountingDocument): ${paymentReference}`);
                }
                // PRIORITY 2: Apply reference document rule
                else {
                    switch (ruleType) {
                        case 'BELNR':
                            // Use Accounting Document number (BELNR)
                            paymentReference = belnr || invoiceNumber;
                            console.log(`    Using BELNR rule: ${paymentReference}`);
                            break;
                            
                        case 'XBLNR':
                            // Use Invoice Reference number (XBLNR)
                            paymentReference = xblnr || invoiceNumber;
                            console.log(`    Using XBLNR rule: ${paymentReference}`);
                            break;
                            
                        case 'BELNR_THEN_XBLNR':
                            // Try BELNR first, if not found use XBLNR
                            paymentReference = belnr || xblnr || invoiceNumber;
                            console.log(`    Using BELNR_THEN_XBLNR rule: ${paymentReference}`);
                            break;
                            
                        case 'XBLNR_THEN_BELNR':
                            // lbinvref = XBLNR else belnr
                            // If Invoice Number matches XBLNR, use XBLNR; otherwise use BELNR
                            if (xblnr && invoiceNumber === xblnr) {
                                paymentReference = xblnr;
                                console.log(`    Using XBLNR_THEN_BELNR rule: Invoice matches XBLNR, using ${paymentReference}`);
                            } else if (belnr) {
                                paymentReference = belnr;
                                console.log(`    Using XBLNR_THEN_BELNR rule: Invoice doesn't match XBLNR, using BELNR ${paymentReference}`);
                            } else {
                                paymentReference = invoiceNumber;
                                console.log(`    Using XBLNR_THEN_BELNR rule: Fallback to InvoiceNumber ${paymentReference}`);
                            }
                            break;
                            
                        default:
                            // Default: Use Invoice Number from file
                            paymentReference = invoiceNumber;
                            console.log(`    Using default (InvoiceNumber): ${paymentReference}`);
                    }
                }
                
                // Build clearing entry - OMIT empty optional fields (don't send empty strings)
                const clearing = {
                    // PaymentReference: RULE-001 enriched value or determined by reference document rule
                    PaymentReference: paymentReference.substring(0, 30),
                    // FROM FILE: Net payment amount - format with 2 decimal places
                    NetPaymentAmountInPaytCurrency: parseFloat(inv.invoiceAmount || 0).toFixed(2),
                    // FROM FILE: Deduction amount - format with 2 decimal places
                    DeductionAmountInPaytCurrency: parseFloat(inv.deductionAmount || 0).toFixed(2),
                    // DEFAULT: Currency
                    Currency: currency
                };
                
                // Note: CompanyCode is stored in mappedData for reporting but NOT sent in SAP payload
                
                // ONLY include PaymentDifferenceReason if it has a value (SAP rejects empty strings)
                const reasonCode = (inv.reasonCode || '').trim().substring(0, 3);
                if (reasonCode && reasonCode.length > 0) {
                    clearing.PaymentDifferenceReason = reasonCode;
                }
                
                return clearing;
            });
            
            item.to_LockboxClearing = {
                results: clearingResults
            };
            
            console.log(`  Clearing entries: ${clearingResults.length}`);
            clearingResults.forEach((c, i) => {
                console.log(`    [${i + 1}] PaymentReference: ${c.PaymentReference}, Net: ${c.NetPaymentAmountInPaytCurrency}, Deduction: ${c.DeductionAmountInPaytCurrency}${c.PaymentDifferenceReason ? ', Reason: ' + c.PaymentDifferenceReason : ''}`);
            });
        }
        
        // Store customer for GET LockboxClearing API call (internal use only, not sent to SAP)
        // PaymentAdviceAccount = Customer (from file)
        // PaymentAdviceAccountType = "D" (constant)
        // CompanyCode = "1710" (constant)
        // Note: We store this in a separate map, not in the payload item
        
        payload.to_Item.results.push(item);
        itemId++;
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('          PAYLOAD SUMMARY                                          ');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`Lockbox: ${payload.Lockbox} (CONSTANT)`);
    console.log(`DepositDateTime: ${payload.DepositDateTime} (FROM FILE)`);
    console.log(`AmountInTransactionCurrency: ${payload.AmountInTransactionCurrency} (FROM FILE)`);
    console.log(`LockboxBatchOrigin: ${payload.LockboxBatchOrigin} (DEFAULT)`);
    console.log(`LockboxBatchDestination: ${payload.LockboxBatchDestination} (DEFAULT)`);
    console.log(`Items: ${payload.to_Item.results.length}`);
    console.log('');
    console.log('GET API Parameters (after POST):');
    console.log('  PaymentAdviceAccount = Customer number (FROM FILE)');
    console.log('  PaymentAdviceAccountType = "D" (CONSTANT)');
    console.log('  CompanyCode = "1710" (CONSTANT)');
    console.log('  PaymentAdvice = (GENERATED BY SAP - NOT hardcoded)');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    
    return payload;
}

// Build hierarchy from standard payload
function buildHierarchyFromPayload(payload, sourceFilename = '') {
    const lockbox = {
        nodeId: `lockbox_${payload.Lockbox}`,
        level: 1,
        type: 'LOCKBOX',
        lockbox: payload.Lockbox,
        displayText: payload.Lockbox,
        sourceFile: sourceFilename, // Store source filename for display
        batchId: '001', // Default batch
        status: 'UPLOADED',
        amount: parseFloat(payload.AmountInTransactionCurrency) || 0,
        currency: 'USD', // Default currency
        deposit_datetime: payload.DepositDateTime,
        customer: '',
        children: []
    };
    
    for (const item of payload.to_Item.results) {
        const chequeNode = {
            nodeId: `cheque_${item.Cheque}_${item.LockboxBatchItem}`,
            level: 2,
            type: 'CHEQUE',
            cheque: item.Cheque,
            displayText: item.Cheque,
            itemId: item.LockboxBatchItem,
            customer: '',
            amount: parseFloat(item.AmountInTransactionCurrency) || 0,
            currency: item.Currency,
            depositDate: payload.DepositDateTime,
            partnerBank: item.PartnerBank,
            partnerBankAccount: item.PartnerBankAccount,
            partnerBankCountry: item.PartnerBankCountry,
            children: []
        };
        
        // Only add clearing children if they exist
        const clearings = item.to_LockboxClearing?.results || [];
        for (const clearing of clearings) {
            chequeNode.children.push({
                nodeId: `payment_${clearing.PaymentReference}_${item.LockboxBatchItem}`,
                level: 3,
                type: 'PAYMENT',
                paymentReference: clearing.PaymentReference,
                displayText: clearing.PaymentReference,
                customer: '',
                netAmount: parseFloat(clearing.NetPaymentAmountInPaytCurrency) || 0,
                deductionAmount: parseFloat(clearing.DeductionAmountInPaytCurrency) || 0,
                reasonCode: clearing.PaymentDifferenceReason,
                currency: clearing.Currency,
                children: []
            });
        }
        
        lockbox.children.push(chequeNode);
    }
    
    return [lockbox];
}

// Match column headers to standardized fields
function matchColumnHeaders(headers) {
    const mapping = {};
    const normalizedHeaders = headers.map(h => (h || '').toString().toLowerCase().trim());
    
    for (const [standardField, patterns] of Object.entries(COLUMN_PATTERNS)) {
        for (let i = 0; i < normalizedHeaders.length; i++) {
            const header = normalizedHeaders[i];
            if (patterns.some(p => header.includes(p) || p.includes(header))) {
                mapping[standardField] = { index: i, originalHeader: headers[i] };
                break;
            }
        }
    }
    return mapping;
}

// Match file to template (legacy - kept for backwards compatibility)
function matchFileToTemplate(fileType, headers) {
    const headerMapping = matchColumnHeaders(headers);
    const matchedFieldCount = Object.keys(headerMapping).length;
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const template of customerTemplates) {
        if (!template.active) continue;
        let score = 0;
        if (template.fileType.toUpperCase() === fileType.toUpperCase()) score += 50;
        score += matchedFieldCount * 10;
        if (template.templateType === 'STANDARD') score += 20;
        if (score > bestScore) { bestScore = score; bestMatch = template; }
    }
    
    return { template: bestMatch, score: bestScore, headerMapping, matchedFields: Object.keys(headerMapping) };
}

// Split invoice references helper
function splitInvoiceReferencesForProcessing(invoiceStr) {
    if (!invoiceStr || !invoiceStr.includes(',')) return [invoiceStr?.trim() || ''];
    const parts = invoiceStr.split(',').map(p => p.trim()).filter(p => p);
    if (parts.length <= 1) return [invoiceStr.trim()];
    const firstPart = parts[0];
    const otherParts = parts.slice(1);
    const hasShortSuffixes = otherParts.every(p => p.length < firstPart.length);
    if (hasShortSuffixes && firstPart.length > 3) {
        const firstSuffix = otherParts[0];
        const prefixLength = firstPart.length - firstSuffix.length;
        if (prefixLength > 0) {
            const commonPrefix = firstPart.substring(0, prefixLength);
            return [firstPart, ...otherParts.map(suffix => commonPrefix + suffix)];
        }
    }
    return parts;
}

// ============================================================================
// TRANSFORMATION RULE HELPERS
// ============================================================================

// DATE CONVERSION: Convert various date formats to ISO (YYYY-MM-DD)
function convertDateFormat(dateStr, fromFormat) {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    
    const str = dateStr.toString().trim();
    let year, month, day;
    
    // Auto-detect format if not specified
    if (!fromFormat) {
        // MM/DD/YYYY or M/D/YYYY
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
            fromFormat = 'MM/DD/YYYY';
        }
        // DD-MM-YYYY or D-M-YYYY
        else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
            fromFormat = 'DD-MM-YYYY';
        }
        // YYYY-MM-DD (already ISO)
        else if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            return str;
        }
        // DD.MM.YYYY
        else if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(str)) {
            fromFormat = 'DD.MM.YYYY';
        }
        // YYYYMMDD
        else if (/^\d{8}$/.test(str)) {
            fromFormat = 'YYYYMMDD';
        }
        else {
            // Try to parse with Date constructor
            const parsed = new Date(str);
            if (!isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0];
            }
            return str; // Return as-is if can't parse
        }
    }
    
    try {
        switch (fromFormat) {
            case 'MM/DD/YYYY':
            case 'M/D/YYYY':
                const parts1 = str.split('/');
                month = parts1[0].padStart(2, '0');
                day = parts1[1].padStart(2, '0');
                year = parts1[2];
                break;
            case 'DD-MM-YYYY':
            case 'D-M-YYYY':
                const parts2 = str.split('-');
                day = parts2[0].padStart(2, '0');
                month = parts2[1].padStart(2, '0');
                year = parts2[2];
                break;
            case 'DD.MM.YYYY':
                const parts3 = str.split('.');
                day = parts3[0].padStart(2, '0');
                month = parts3[1].padStart(2, '0');
                year = parts3[2];
                break;
            case 'YYYYMMDD':
                year = str.substring(0, 4);
                month = str.substring(4, 6);
                day = str.substring(6, 8);
                break;
            default:
                return str;
        }
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error('Date conversion error:', e);
        return str;
    }
}

// AMOUNT VALIDATION: Validate and format amounts
function validateAndFormatAmount(amount, options = {}) {
    const {
        minValue = 0,
        maxValue = Infinity,
        decimalPlaces = 2,
        allowNegative = false,
        currency = 'USD'
    } = options;
    
    const result = {
        isValid: true,
        errors: [],
        originalValue: amount,
        formattedValue: '0.00'
    };
    
    // Parse the amount
    let numericValue;
    if (typeof amount === 'string') {
        // Remove currency symbols and thousands separators
        const cleaned = amount.replace(/[$€£¥,\s]/g, '').trim();
        numericValue = parseFloat(cleaned);
    } else {
        numericValue = parseFloat(amount);
    }
    
    // Check if valid number
    if (isNaN(numericValue)) {
        result.isValid = false;
        result.errors.push('Invalid numeric value');
        return result;
    }
    
    // Check negative
    if (!allowNegative && numericValue < 0) {
        result.isValid = false;
        result.errors.push('Negative values not allowed');
    }
    
    // Check min value
    if (numericValue < minValue) {
        result.isValid = false;
        result.errors.push(`Value must be >= ${minValue}`);
    }
    
    // Check max value
    if (numericValue > maxValue) {
        result.isValid = false;
        result.errors.push(`Value must be <= ${maxValue}`);
    }
    
    // Format the value
    result.formattedValue = numericValue.toFixed(decimalPlaces);
    result.numericValue = numericValue;
    
    return result;
}

// TEXT CONVERSION: Apply text transformations
function applyTextConversion(text, conversionType, options = {}) {
    if (!text) return text;
    const str = text.toString();
    
    switch (conversionType) {
        case 'UPPERCASE':
            return str.toUpperCase();
        case 'LOWERCASE':
            return str.toLowerCase();
        case 'TRIM':
            return str.trim();
        case 'PAD_LEFT':
            return str.padStart(options.length || 10, options.char || '0');
        case 'PAD_RIGHT':
            return str.padEnd(options.length || 10, options.char || ' ');
        case 'TRUNCATE':
            return str.substring(0, options.length || 30);
        case 'REPLACE':
            if (options.findText && options.replaceWith !== undefined) {
                const regex = new RegExp(options.findText, 'g');
                return str.replace(regex, options.replaceWith);
            }
            return str;
        case 'EXTRACT_NUMERIC':
            return str.replace(/[^0-9.-]/g, '');
        case 'EXTRACT_ALPHA':
            return str.replace(/[^a-zA-Z]/g, '');
        default:
            return str;
    }
}

// Apply transformation rules
function applyTransformationRules(data, templateId) {
    const rules = fieldMappingRules.filter(r => r.templateId === templateId && r.active);
    let transformedData = [...data];
    const appliedRules = [];
    const validationErrors = [];
    
    // Sort rules by priority (lower number = higher priority)
    rules.sort((a, b) => (a.priority || 99) - (b.priority || 99));
    
    for (const rule of rules) {
        try {
            switch (rule.ruleType) {
                case 'SPLIT':
                    // Split comma-separated invoice numbers
                    const newData = [];
                    for (const row of transformedData) {
                        const invoiceField = row.InvoiceNumber || row.PaymentReference || '';
                        if (invoiceField.toString().includes(',')) {
                            const invoices = splitInvoiceReferencesForProcessing(invoiceField.toString());
                            const totalAmount = parseFloat(row.InvoiceAmount) || parseFloat(row.CheckAmount) || 0;
                            const splitAmount = totalAmount / invoices.length;
                            for (const inv of invoices) {
                                newData.push({ 
                                    ...row, 
                                    InvoiceNumber: inv, 
                                    PaymentReference: inv, 
                                    InvoiceAmount: splitAmount.toFixed(2), 
                                    _splitFrom: invoiceField,
                                    _splitRule: rule.ruleName
                                });
                            }
                            appliedRules.push({ rule: rule.ruleName, action: 'SPLIT', from: invoiceField, to: invoices });
                        } else { 
                            newData.push(row); 
                        }
                    }
                    transformedData = newData;
                    break;
                    
                case 'VALIDATE':
                    // Apply validation rules
                    for (let i = 0; i < transformedData.length; i++) {
                        const row = transformedData[i];
                        
                        if (rule.category === 'AMOUNT') {
                            // Validate amounts
                            const amountFields = ['CheckAmount', 'InvoiceAmount', 'DeductionAmount'];
                            for (const field of amountFields) {
                                if (row[field] !== undefined && row[field] !== null) {
                                    const validation = validateAndFormatAmount(row[field], {
                                        minValue: rule.validateSettings?.minValue || 0,
                                        maxValue: rule.validateSettings?.maxValue || Infinity,
                                        allowNegative: rule.validateSettings?.allowNegative || false
                                    });
                                    
                                    if (!validation.isValid) {
                                        row._validationErrors = row._validationErrors || [];
                                        row._validationErrors.push(`${rule.ruleName}: ${field} - ${validation.errors.join(', ')}`);
                                        
                                        if (rule.validateSettings?.stopProcessing) {
                                            validationErrors.push({ row: i + 1, field, errors: validation.errors });
                                        }
                                    } else {
                                        // Update with formatted value
                                        row[field] = validation.formattedValue;
                                    }
                                }
                            }
                        }
                        
                        if (rule.category === 'DATE') {
                            // Validate dates
                            const dateFields = ['DepositDate', 'PostingDate', 'ValueDate'];
                            for (const field of dateFields) {
                                if (row[field]) {
                                    const originalDate = row[field];
                                    const isoDate = convertDateFormat(row[field]);
                                    if (isoDate !== originalDate) {
                                        row[field] = isoDate;
                                        row[`_${field}_original`] = originalDate;
                                    }
                                }
                            }
                        }
                    }
                    appliedRules.push({ rule: rule.ruleName, action: 'VALIDATE', category: rule.category });
                    break;
                    
                case 'TEXT_CONVERSION':
                    // Apply text conversions
                    for (const row of transformedData) {
                        if (rule.textConversionSettings) {
                            const settings = rule.textConversionSettings;
                            const targetFields = settings.targetFields?.split(',').map(f => f.trim()) || ['InvoiceNumber', 'PaymentReference'];
                            
                            for (const field of targetFields) {
                                if (row[field]) {
                                    const originalValue = row[field];
                                    row[field] = applyTextConversion(row[field], settings.conversionType, settings);
                                    if (row[field] !== originalValue) {
                                        row[`_${field}_original`] = originalValue;
                                    }
                                }
                            }
                        }
                    }
                    appliedRules.push({ rule: rule.ruleName, action: 'TEXT_CONVERSION' });
                    break;
                    
                case 'DERIVE':
                    // Derive new field values
                    for (const row of transformedData) {
                        if (rule.deriveSettings) {
                            const settings = rule.deriveSettings;
                            
                            // Derive cheque number if missing
                            if (rule.category === 'CHEQUE' && !row.CheckNumber && !row.Cheque) {
                                if (settings.sourceFields && row[settings.sourceFields]) {
                                    row.Cheque = applyTextConversion(row[settings.sourceFields], 'EXTRACT_NUMERIC');
                                } else {
                                    row.Cheque = settings.defaultValue || `CHK-${Date.now().toString().slice(-8)}`;
                                }
                                row._derivedCheque = true;
                            }
                            
                            // Derive lockbox ID if missing
                            if (rule.category === 'LOCKBOX' && !row.Lockbox) {
                                row.Lockbox = row.Customer || settings.defaultValue || 'LB-DEFAULT';
                            }
                        }
                    }
                    appliedRules.push({ rule: rule.ruleName, action: 'DERIVE', category: rule.category });
                    break;
                    
                case 'ALLOCATE':
                    // Allocate amounts across line items
                    if (rule.allocateSettings) {
                        const settings = rule.allocateSettings;
                        
                        // Group by cheque/payment
                        const groups = {};
                        for (const row of transformedData) {
                            const groupKey = row.CheckNumber || row.Cheque || 'DEFAULT';
                            if (!groups[groupKey]) {
                                groups[groupKey] = {
                                    totalCheck: parseFloat(row.CheckAmount) || 0,
                                    rows: []
                                };
                            }
                            groups[groupKey].rows.push(row);
                        }
                        
                        // Apply allocation method
                        for (const [groupKey, group] of Object.entries(groups)) {
                            if (group.rows.length > 1 && group.totalCheck > 0) {
                                const totalInvoice = group.rows.reduce((sum, r) => sum + (parseFloat(r.InvoiceAmount) || 0), 0);
                                
                                if (settings.method === 'PROPORTIONAL' && totalInvoice > 0) {
                                    // Proportional allocation
                                    for (const row of group.rows) {
                                        const invoiceAmt = parseFloat(row.InvoiceAmount) || 0;
                                        const proportion = invoiceAmt / totalInvoice;
                                        row.AllocatedAmount = (group.totalCheck * proportion).toFixed(2);
                                        row._allocationMethod = 'PROPORTIONAL';
                                    }
                                } else if (settings.method === 'EQUAL') {
                                    // Equal allocation
                                    const equalAmount = group.totalCheck / group.rows.length;
                                    for (const row of group.rows) {
                                        row.AllocatedAmount = equalAmount.toFixed(2);
                                        row._allocationMethod = 'EQUAL';
                                    }
                                } else if (settings.method === 'FIFO') {
                                    // FIFO allocation
                                    let remaining = group.totalCheck;
                                    for (const row of group.rows) {
                                        const invoiceAmt = parseFloat(row.InvoiceAmount) || 0;
                                        const allocated = Math.min(remaining, invoiceAmt);
                                        row.AllocatedAmount = allocated.toFixed(2);
                                        row._allocationMethod = 'FIFO';
                                        remaining -= allocated;
                                        if (remaining <= 0) break;
                                    }
                                }
                            }
                        }
                    }
                    appliedRules.push({ rule: rule.ruleName, action: 'ALLOCATE' });
                    break;
            }
        } catch (err) {
            console.error(`Error applying rule ${rule.ruleName}:`, err);
            appliedRules.push({ rule: rule.ruleName, action: rule.ruleType, error: err.message });
        }
    }
    
    return { data: transformedData, appliedRules, validationErrors };
}

// Map to API fields
// Auto-generate Lockbox ID for each file
let lockboxIdCounter = 1000000;
function generateLockboxId() {
    const timestamp = Date.now().toString().slice(-4);
    return `LB-${new Date().getFullYear()}-${String(lockboxIdCounter++).padStart(4, '0')}-${timestamp}`;
}

function mapToApiFields(data, lockboxId) {
    return data.map((row, idx) => ({
        Lockbox: lockboxId, // Single Lockbox ID for entire file
        Customer: row.Customer || 'CUST-' + (idx + 1),
        LockboxBatch: '001',
        LockboxBatchItem: String(idx + 1).padStart(5, '0'),
        Cheque: (row.CheckNumber || row.Cheque || '').toString().padStart(13, '0').substring(0, 13),
        AmountInTransactionCurrency: (parseFloat(row.CheckAmount) || parseFloat(row.InvoiceAmount) || 0).toString(),
        Currency: row.Currency || 'USD',
        PartnerBank: 'BANK', PartnerBankAccount: '', PartnerBankCountry: 'US',
        DepositDateTime: row.DepositDate || new Date().toISOString(),
        PaymentReference: (row.InvoiceNumber || row.PaymentReference || '').toString().substring(0, 30),
        NetPaymentAmountInPaytCurrency: (parseFloat(row.InvoiceAmount) || 0).toString(),
        DeductionAmountInPaytCurrency: (parseFloat(row.DeductionAmount) || 0).toString(),
        PaymentDifferenceReason: row.ReasonCode || '',
        _original: row
    }));
}

// Build hierarchy: Lockbox ID (auto-generated per file) → Cheque → Payment Reference
// Customer is stored as a property on each node for display in a column
function buildHierarchicalStructure(mappedData, lockboxId, sourceFilename = '') {
    if (!mappedData || mappedData.length === 0) return [];
    
    // Generate Lockbox ID if not provided (auto-generate based on timestamp)
    const autoLockboxId = lockboxId || `LB-${Date.now().toString().slice(-8)}`;
    
    // Single Lockbox for entire file (Level 1)
    const lockboxEntry = {
        nodeId: `lockbox_${autoLockboxId}`,
        level: 1,
        type: 'LOCKBOX',
        lockbox: autoLockboxId,
        displayText: autoLockboxId,
        sourceFile: sourceFilename, // Store source filename
        status: 'UPLOADED',
        amount: 0,
        currency: 'USD',
        deposit_datetime: new Date().toISOString(),
        customer: '', // Will show multiple customers at cheque level
        children: []
    };
    
    // Group by Cheque Number (Level 2)
    const chequeGroups = {};
    for (const row of mappedData) {
        // Extract cheque from mapped data
        const chequeKey = row.Cheque || row.CheckNumber || row.cheque || `CHK-${Date.now().toString().slice(-6)}`;
        const customerKey = row.Customer || row.CustomerNumber || row.customer || '';
        
        if (!chequeGroups[chequeKey]) {
            chequeGroups[chequeKey] = {
                cheque: chequeKey,
                customer: customerKey,
                amount: parseFloat(row.AmountInTransactionCurrency) || parseFloat(row.Amount) || 0,
                currency: row.Currency || 'USD',
                depositDate: row.DepositDateTime || row.Date,
                partnerBank: row.PartnerBank || '',
                partnerBankAccount: row.PartnerBankAccount || '',
                payments: []
            };
        } else {
            // Accumulate amount if same cheque appears multiple times
            chequeGroups[chequeKey].amount += parseFloat(row.AmountInTransactionCurrency) || parseFloat(row.Amount) || 0;
        }
        
        // Add Payment Reference under Cheque (Level 3)
        const paymentRef = row.PaymentReference || row.InvoiceNumber || row.Invoice || `PAY-${Date.now()}`;
        chequeGroups[chequeKey].payments.push({
            paymentReference: paymentRef,
            customer: customerKey,
            netAmount: parseFloat(row.NetPaymentAmountInPaytCurrency) || parseFloat(row.InvoiceAmount) || 0,
            deductionAmount: parseFloat(row.DeductionAmountInPaytCurrency) || 0,
            reasonCode: row.PaymentDifferenceReason || '',
            currency: row.Currency || 'USD'
        });
    }
    
    // Build hierarchy tree: Lockbox → Cheque → Payment
    let totalAmount = 0;
    
    for (const [chequeKey, chequeData] of Object.entries(chequeGroups)) {
        // Cheque Node (Level 2)
        const chequeNode = {
            nodeId: `cheque_${chequeKey}_${Date.now()}`,
            level: 2,
            type: 'CHEQUE',
            cheque: chequeKey,
            displayText: chequeKey,
            customer: chequeData.customer, // Customer column
            amount: chequeData.amount,
            currency: chequeData.currency,
            depositDate: chequeData.depositDate,
            partnerBank: chequeData.partnerBank,
            partnerBankAccount: chequeData.partnerBankAccount,
            children: []
        };
        
        totalAmount += chequeData.amount;
        
        // Add Payment nodes under Cheque (Level 3)
        chequeData.payments.forEach((payment, idx) => {
            chequeNode.children.push({
                nodeId: `payment_${chequeKey}_${idx}_${Date.now()}`,
                level: 3,
                type: 'PAYMENT',
                paymentReference: payment.paymentReference,
                displayText: payment.paymentReference,
                customer: payment.customer, // Customer column
                netAmount: payment.netAmount,
                deductionAmount: payment.deductionAmount,
                reasonCode: payment.reasonCode,
                currency: payment.currency,
                children: []
            });
        });
        
        lockboxEntry.children.push(chequeNode);
    }
    
    lockboxEntry.amount = totalAmount;
    
    // Log hierarchy summary
    console.log(`Hierarchy built: Lockbox ${autoLockboxId} → ${Object.keys(chequeGroups).length} Cheque(s)`);
    
    return [lockboxEntry];
}

// Build SAP payload from hierarchy
function buildSapPayloadFromHierarchy(hierarchy) {
    if (!hierarchy || !hierarchy[0]) return null;
    const lockbox = hierarchy[0];
    
    // Get defaults from API Fields
    const getApiFieldDefault = (fieldName) => {
        const field = apiFields.find(f => f.fieldName === fieldName || f.fieldId === fieldName);
        return field?.defaultValue || '';
    };
    
    // SAP API REQUIRED DEFAULTS - These fields are mandatory for SAP Lockbox API
    // When not provided in the uploaded file, use defaults to prevent 400 errors
    const DEFAULT_PARTNER_BANK = getApiFieldDefault('PartnerBank') || '88888876';
    const DEFAULT_PARTNER_BANK_ACCOUNT = getApiFieldDefault('PartnerBankAccount') || '8765432195';
    const DEFAULT_PARTNER_BANK_COUNTRY = getApiFieldDefault('PartnerBankCountry') || 'US';
    
    const currency = getApiFieldDefault('Currency') || 'USD';
    const lockboxBatchDestination = getApiFieldDefault('LockboxBatchDestination') || 'LOCKBOXDES';
    const lockboxBatchOrigin = getApiFieldDefault('LockboxBatchOrigin') || 'LOCKBOXORI';
    
    // Flatten hierarchy to items for SAP
    const items = [];
    let itemIndex = 1;
    
    for (const customer of (lockbox.children || [])) {
        for (const check of (customer.children || [])) {
            const clearings = (check.children || []).map(inv => ({
                PaymentReference: (inv.paymentReference || '').toString().substring(0, 30),
                NetPaymentAmountInPaytCurrency: String(inv.netAmount || 0),
                DeductionAmountInPaytCurrency: String(inv.deductionAmount || 0),
                PaymentDifferenceReason: (inv.reasonCode || '').substring(0, 3),
                Currency: currency
            }));
            
            const item = {
                LockboxBatch: '001',
                LockboxBatchItem: String(itemIndex++).padStart(3, '0'),
                AmountInTransactionCurrency: String(check.amount || 0),
                Currency: currency,
                Cheque: (check.cheque || '').toString().substring(0, 13),
                // Always include bank fields with defaults to prevent SAP 400 errors
                PartnerBank: (check.partnerBank || DEFAULT_PARTNER_BANK).substring(0, 15),
                PartnerBankAccount: (check.partnerBankAccount || DEFAULT_PARTNER_BANK_ACCOUNT).substring(0, 18),
                PartnerBankCountry: (check.partnerBankCountry || DEFAULT_PARTNER_BANK_COUNTRY).substring(0, 3)
            };
            
            // Only add to_LockboxClearing if there are clearing entries
            if (clearings.length > 0) {
                item.to_LockboxClearing = { results: clearings };
            }
            
            items.push(item);
        }
    }
    
    // Build SAP payload matching exact template structure
    // NO CompanyCode, LockboxBatch, Currency, etc. at header level
    return {
        Lockbox: (lockbox.lockbox || '').toString().substring(0, 7),
        DepositDateTime: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
        AmountInTransactionCurrency: String(lockbox.amount || 0),
        LockboxBatchOrigin: lockboxBatchOrigin.substring(0, 10),
        LockboxBatchDestination: lockboxBatchDestination.substring(0, 10),
        to_Item: { results: items }
    };
}

// Process uploaded file - automated workflow
/**
 * Build Field Mapping Preview showing source fields vs API-derived fields
 * Displays in UI-friendly format for the Field Mapping Preview screen
 * @param {array} extractedData - Extracted and enriched data
 * @returns {object} - Field mapping preview with source and final values
 */
function buildFieldMappingPreview(extractedData) {
    const preview = {
        sourceFields: [],
        apiDerivedFields: [],
        fieldMappings: [],
        sections: {
            item: [],
            clearing: []
        }
    };
    
    if (!extractedData || extractedData.length === 0) {
        return preview;
    }
    
    // Get first data row as sample
    const sampleRow = extractedData[0];
    const allFields = Object.keys(sampleRow);
    
    // Get API-derived fields metadata
    const apiDerivedFieldNames = sampleRow._apiDerivedFields || [];
    const apiFieldMappings = sampleRow._apiFieldMappings || {};
    
    console.log('🔍 Building Field Mapping Preview');
    console.log(`   Total fields: ${allFields.length}`);
    console.log(`   API-derived fields: ${apiDerivedFieldNames.length}`);
    
    // Define field mappings for Item and Clearing sections
    const itemFieldMappings = {
        'CheckAmount': 'Check Amount',
        'Check Amount': 'Check Amount',
        'CheckNumber': 'Check Number',
        'Check Number': 'Check Number',
        'PartnerBank': 'Partner Bank',
        'PartnerBankCountry': 'Partner Bank Country',
        'PartnerBankAccount': 'Partner Bank Account'
    };
    
    const clearingFieldMappings = {
        'InvoiceNumber': 'Invoice Number',
        'Invoice Number': 'Invoice Number',
        'InvoiceAmount': 'Invoice Amount',
        'Invoice Amount': 'Invoice Amount',
        'DeductionAmount': 'Deduction Amount',
        'Deduction Amount': 'Deduction Amount',
        'ReasonCode': 'Reason Code',
        'Reason Code': 'Reason Code',
        'PaymentReference': 'Payment Reference',
        'CompanyCode': 'Company Code'
    };
    
    // Classify and build preview for each field
    allFields.forEach(fieldName => {
        // Skip internal metadata fields
        if (fieldName.startsWith('_')) return;
        
        const isApiDerived = apiDerivedFieldNames.includes(fieldName);
        const fieldValue = sampleRow[fieldName] || '—';
        
        // Determine which section this field belongs to
        let section = null;
        let displayName = fieldName;
        
        if (itemFieldMappings[fieldName]) {
            section = 'item';
            displayName = itemFieldMappings[fieldName];
        } else if (clearingFieldMappings[fieldName]) {
            section = 'clearing';
            displayName = clearingFieldMappings[fieldName];
        }
        
        const fieldInfo = {
            fieldName: displayName,
            originalFieldName: fieldName,
            sourceValue: isApiDerived ? '—' : fieldValue,
            finalValue: fieldValue,
            isApiDerived: isApiDerived,
            derivedFrom: isApiDerived ? (apiFieldMappings[fieldName]?.derivedFrom || 'SAP API') : 'File Upload'
        };
        
        // Add to appropriate section
        if (section === 'item') {
            preview.sections.item.push(fieldInfo);
        } else if (section === 'clearing') {
            preview.sections.clearing.push(fieldInfo);
        }
        
        // Add to classification arrays
        if (isApiDerived) {
            const mapping = apiFieldMappings[fieldName] || {};
            preview.apiDerivedFields.push({
                fieldName,
                displayName,
                value: fieldValue,
                source: 'SAP API',
                apiEndpoint: mapping.apiEndpoint,
                sourceApiField: mapping.sourceField,
                derivedFromRule: mapping.derivedFrom,
                inputField: mapping.inputField,
                inputValue: mapping.inputValue
            });
        } else {
            preview.sourceFields.push({
                fieldName,
                displayName,
                value: fieldValue,
                source: 'Uploaded File'
            });
        }
    });
    
    // Build comprehensive field mappings
    preview.fieldMappings = [
        ...preview.sourceFields.map(f => ({
            fieldName: f.displayName,
            sourceType: 'File Upload',
            sourceValue: f.value,
            targetType: 'Lockbox Field',
            finalValue: f.value,
            isApiDerived: false
        })),
        ...preview.apiDerivedFields.map(f => ({
            fieldName: f.displayName,
            sourceType: 'SAP API',
            sourceValue: '—',
            sourceApiField: f.sourceApiField,
            targetType: 'Lockbox API Field (Derived)',
            apiEndpoint: f.apiEndpoint,
            derivedFromRule: f.derivedFromRule,
            inputMapping: f.inputField ? `${f.inputField} = ${f.inputValue}` : '',
            finalValue: f.value,
            isApiDerived: true
        }))
    ];
    
    console.log(`   Item section fields: ${preview.sections.item.length}`);
    console.log(`   Clearing section fields: ${preview.sections.clearing.length}`);
    console.log(`   Source fields: ${preview.sourceFields.length}`);
    console.log(`   API-derived fields: ${preview.apiDerivedFields.length}`);
    
    return preview;
}

// ═══════════════════════════════════════════════════════════════════
// LOCKBOX TRANSACTION PROCESSING
// ═══════════════════════════════════════════════════════════════════

app.post('/api/lockbox/process', upload.single('file'), async (req, res) => {
    // NOTE: Each file upload creates a NEW batch run with unique runId
    // Uploading the same file multiple times is allowed - each is treated as separate batch
    const runId = generateProcessingRunId();
    const run = {
        id: uuidv4(),
        runId, filename: req.file?.originalname || 'unknown', 
        fileType: req.file?.originalname?.split('.').pop()?.toUpperCase() || 'UNKNOWN',
        fileSize: req.file?.size || 0,
        startedAt: new Date().toISOString(),
        uploadedAt: new Date().toISOString(),
        batchNumber: lockboxProcessingRuns.length + 1, // Track batch number
        stages: {
            upload: { status: 'pending', message: '' }, templateMatch: { status: 'pending', message: '', templateId: null },
            extraction: { status: 'pending', message: '', rowCount: 0, appliedRules: [] },
            validation: { status: 'pending', message: '', errors: [], warnings: [] }, mapping: { status: 'pending', message: '' }
        },
        currentStage: 'upload', overallStatus: 'processing', rawData: [], extractedData: [], mappedData: [], hierarchy: [], sapPayload: null, lastFailedStage: null,
        // Store original file for download
        originalFileBuffer: null,
        originalFileMimeType: null
    };
    lockboxProcessingRuns.unshift(run);
    
    try {
        // ═══════════════════════════════════════════════════════════════════
        // STAGE 1: UPLOAD - Parse file based on format
        // ═══════════════════════════════════════════════════════════════════
        console.log('=== PROCESSING START ===');
        console.log('Run ID:', runId);
        
        if (!req.file) { 
            run.stages.upload.status = 'error'; 
            run.stages.upload.message = 'No file uploaded. Please select a file.'; 
            run.overallStatus = 'failed'; 
            run.lastFailedStage = 'upload'; 
            return res.status(400).json({ success: false, run }); 
        }
        
        const fileType = req.file.originalname.split('.').pop().toUpperCase();
        console.log('File:', req.file.originalname, 'Type:', fileType, 'Size:', req.file.size);
        
        // Store original file buffer for download
        run.originalFileBuffer = req.file.buffer.toString('base64'); // Store as base64 for JSON compatibility
        run.originalFileMimeType = req.file.mimetype || 'application/octet-stream';
        
        let jsonData = [];
        
        try {
            // Handle different file formats
            if (['XLSX', 'XLS', 'CSV', 'TSV'].includes(fileType)) {
                // Excel/CSV files - use xlsx library
                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
                console.log('Parsed Excel/CSV - Sheets:', workbook.SheetNames.length, 'Rows:', jsonData.length);
            } else if (['TXT', 'BAI', 'BAI2'].includes(fileType)) {
                // Text/BAI files - parse as delimited text
                const content = req.file.buffer.toString('utf-8');
                const lines = content.split(/\r?\n/).filter(line => line.trim());
                
                // Try to detect delimiter (tab, comma, pipe)
                const firstLine = lines[0] || '';
                let delimiter = ',';
                if (firstLine.includes('\t')) delimiter = '\t';
                else if (firstLine.includes('|')) delimiter = '|';
                
                jsonData = lines.map(line => line.split(delimiter).map(cell => cell.trim()));
                console.log('Parsed Text file - Lines:', jsonData.length, 'Delimiter:', delimiter === '\t' ? 'TAB' : delimiter);
            } else if (fileType === 'JSON') {
                // JSON files
                const content = JSON.parse(req.file.buffer.toString('utf-8'));
                if (Array.isArray(content)) {
                    // Array of objects - convert to rows
                    if (content.length > 0) {
                        const headers = Object.keys(content[0]);
                        jsonData = [headers, ...content.map(row => headers.map(h => row[h]))];
                    }
                } else if (content.data && Array.isArray(content.data)) {
                    const headers = Object.keys(content.data[0] || {});
                    jsonData = [headers, ...content.data.map(row => headers.map(h => row[h]))];
                }
                console.log('Parsed JSON - Rows:', jsonData.length);
            } else if (fileType === 'XML') {
                // XML files - basic parsing
                const content = req.file.buffer.toString('utf-8');
                // Simple XML to rows conversion (handles basic tabular XML)
                const rowMatches = content.match(/<row[^>]*>[\s\S]*?<\/row>/gi) || content.match(/<record[^>]*>[\s\S]*?<\/record>/gi) || [];
                if (rowMatches.length > 0) {
                    const firstRow = rowMatches[0];
                    const headers = [...firstRow.matchAll(/<(\w+)>([^<]*)<\/\1>/g)].map(m => m[1]);
                    jsonData = [headers];
                    rowMatches.forEach(row => {
                        const values = headers.map(h => {
                            const match = row.match(new RegExp(`<${h}>([^<]*)</${h}>`));
                            return match ? match[1] : '';
                        });
                        jsonData.push(values);
                    });
                }
                console.log('Parsed XML - Rows:', jsonData.length);
            } else {
                // Try xlsx as fallback for unknown formats
                console.log('Unknown format, trying xlsx parser as fallback');
                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
            }
        } catch (parseError) {
            console.error('File parsing error:', parseError.message);
            run.stages.upload.status = 'error'; 
            run.stages.upload.message = `Unable to parse file: ${parseError.message}. Please ensure file is in correct format.`; 
            run.overallStatus = 'failed'; 
            run.lastFailedStage = 'upload'; 
            return res.json({ success: false, run }); 
        }
        
        if (jsonData.length < 2) { 
            run.stages.upload.status = 'error'; 
            run.stages.upload.message = 'File is empty or has no data rows. Please check file content.'; 
            run.overallStatus = 'failed'; 
            run.lastFailedStage = 'upload'; 
            return res.json({ success: false, run }); 
        }
        
        run.rawData = jsonData;
        run.fileType = fileType;
        run.stages.upload.status = 'success'; 
        run.stages.upload.message = `Parsed ${jsonData.length - 1} data rows, ${jsonData[0].length} columns from ${fileType} file`;
        console.log('Upload stage complete:', run.stages.upload.message);
        
        // ═══════════════════════════════════════════════════════════════════
        // CREATE BATCH TEMPLATE - Store file structure in PostgreSQL/backup
        // Each uploaded file is stored as a separate batch template
        // ═══════════════════════════════════════════════════════════════════
        console.log('=== CREATING BATCH TEMPLATE ===');
        const headers = jsonData[0];
        const allRows = jsonData.slice(1);
        
        // Filter out empty rows for pattern detection
        // A row is considered empty if all its values are null, undefined, or empty string
        const dataRows = allRows.filter(row => {
            return row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
        });
        
        console.log(`   Total rows from file: ${allRows.length}`);
        console.log(`   Non-empty data rows: ${dataRows.length}`);
        
        // Convert array rows to objects with header names for pattern detection
        const dataObjects = dataRows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index];
            });
            return obj;
        });
        
        const batchTemplate = createBatchTemplate(
            req.file.originalname,
            fileType,
            headers,
            allRows,  // Use all rows for template (including empty for structure reference)
            allRows.length
        );
        
        // Link template to run
        run.templateId = batchTemplate.templateId;
        run.batchTemplate = batchTemplate;
        console.log(`Batch template ${batchTemplate.templateId} created and linked to run ${runId}`);
        
        // ═══════════════════════════════════════════════════════════════════
        // STAGE 2: PATTERN DETECTION - Detect file pattern from data structure (FROM DATABASE)
        // ═══════════════════════════════════════════════════════════════════
        run.currentStage = 'templateMatch';
        console.log('=== PATTERN DETECTION (DYNAMIC FROM file_pattern TABLE) ===');
        console.log('Headers:', jsonData[0]);
        
        // Use pattern engine for dynamic detection
        const patternEngine = require('./srv/handlers/pattern-engine');
        const patternResult = patternEngine.detectPattern(dataObjects, fileType);  // Use dataObjects instead of dataRows
        
        if (!patternResult.matched || !patternResult.pattern) { 
            run.stages.templateMatch.status = 'error'; 
            run.stages.templateMatch.message = `No matching file pattern found. Please create a pattern in Field Mapping Rules → File Patterns.`; 
            run.stages.templateMatch.detectedHeaders = jsonData[0];
            run.stages.templateMatch.error = patternResult.error || 'No pattern matched';
            run.overallStatus = 'failed'; 
            run.lastFailedStage = 'templateMatch'; 
            console.log('❌ Pattern detection failed:', patternResult.error);
            return res.json({ success: false, run }); 
        }
        
        run.stages.templateMatch = { 
            status: 'success', 
            message: `✅ Upload Successful | Pattern ID: ${patternResult.pattern.patternId} | Pattern Type: ${patternResult.pattern.patternType} | ${patternResult.message || 'Successfully determined'}`, 
            patternId: patternResult.pattern.patternId, 
            patternName: patternResult.pattern.patternName,
            patternType: patternResult.pattern.patternType,
            matchScore: patternResult.confidence, 
            analysis: patternResult.analysis,
            completedAt: new Date().toISOString()
        };
        console.log(`✅ Pattern detection success: ${patternResult.pattern.patternId} - ${patternResult.pattern.patternType}`);
        console.log(`   Confidence: ${patternResult.confidence}%`);
        console.log(`   ${patternResult.message}`);
        
        // ═══════════════════════════════════════════════════════════════════
        // STAGE 3: EXTRACTION - Extract data according to detected pattern (DYNAMIC FROM DATABASE)
        // ═══════════════════════════════════════════════════════════════════
        run.currentStage = 'extraction';
        console.log('=== EXTRACTION (PATTERN-BASED FROM DATABASE) ===');
        
        // Use pattern engine for dynamic extraction
        let extractedData = patternEngine.executePatternExtraction(dataObjects, patternResult.pattern);  // Use dataObjects
        
        // Get extraction log
        const extractionLog = extractedData._extractionLog || [];
        delete extractedData._extractionLog;
        
        run.extractedData = extractedData;
        run.stages.extraction = { 
            status: 'success', 
            message: `✅ Extraction Complete | ${extractionLog.join(' | ')}`, 
            rowCount: extractedData.length,
            pattern: patternResult.pattern.patternType,
            extractionLog: extractionLog,
            completedAt: new Date().toISOString()
        };
        console.log(`✅ Extraction complete. Rows: ${extractedData.length}`);
        
        // ═══════════════════════════════════════════════════════════════════
        // STAGE 4: VALIDATION & ENRICHMENT - Execute Processing Rules Dynamically from DB
        // ═══════════════════════════════════════════════════════════════════
        run.currentStage = 'validation';
        console.log('=== VALIDATION & API MATCHING (RULE-001 & RULE-002) ===');
        
        try {
            // Normalize file type for rule matching (XLSX/XLS → EXCEL)
            const normalizedFileType = patternEngine.normalizeFileType(fileType);
            console.log(`   File Type Normalization: ${fileType} → ${normalizedFileType}`);
            
            // Execute RULE-001 and RULE-002 using dynamic rule engine
            const validationResult = await ruleEngine.processLockboxRules(
                extractedData,
                normalizedFileType  // Use normalized file type
            );
            
            // Update extracted data with enriched values
            extractedData = validationResult.enrichedData;
            
            // DEBUG: Check if enrichment worked
            console.log(`  🔍 DEBUG POST-ENRICHMENT: extractedData length: ${extractedData.length}`);
            if (extractedData.length > 0) {
                const firstRow = extractedData[0];
                console.log(`  🔍 First row keys: ${Object.keys(firstRow).join(', ')}`);
                console.log(`  🔍 Paymentreference value: "${firstRow.Paymentreference}"`);
                console.log(`  🔍 CompanyCode value: "${firstRow.CompanyCode}"`);
            }
            
            run.stages.validation.status = 'completed';
            run.stages.validation.message = `${validationResult.rulesExecuted.length}/2 rules executed, ${validationResult.recordsEnriched} records enriched`;
            run.stages.validation.errors = validationResult.errors;
            run.stages.validation.warnings = validationResult.warnings;
            run.stages.validation.completedAt = new Date().toISOString();
            
            // Store rule execution logs
            run.ruleExecutionLogs = validationResult.rulesExecuted.map(ruleId => ({
                ruleId,
                status: 'SUCCESS',
                recordsEnriched: validationResult.recordsEnriched
            }));
            
            // Build Field Mapping Preview with API-derived fields
            const fieldMappingPreview = buildFieldMappingPreview(extractedData);
            run.fieldMappingPreview = fieldMappingPreview;
            
            console.log(`✅ Validation completed: ${validationResult.rulesExecuted}/${validationResult.totalRules} rules`);
            console.log(`   Records enriched: ${validationResult.recordsEnriched}`);
            console.log(`   Rules executed: ${validationResult.rulesExecuted}/${validationResult.totalRules}`);
            console.log(`   Records enriched: ${validationResult.recordsEnriched}`);
            console.log(`   Warnings: ${validationResult.warnings}`);
            console.log(`   Errors: ${validationResult.errors}`);
            
        } catch (validationError) {
            console.error('❌ Validation error:', validationError);
            run.stages.validation.status = 'error';
            run.stages.validation.message = validationError.message;
            run.stages.validation.errors = [validationError.message];
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // STAGE 5: MAPPING - Build standard payload with constants
        // Generate: LockboxID, BatchID=001, ItemID=001,002..., PaymentReference
        // Apply pattern-based splits (invoice split, check split, amount split)
        // ═══════════════════════════════════════════════════════════════════
        run.currentStage = 'mapping';
        console.log('=== BUILDING STANDARD PAYLOAD ===');
        
        // lockboxId will be generated inside buildStandardPayload using runId
        // This ensures unique IDs in format "1234-{runNumber}" to avoid SAP rejection
        const lockboxId = null; // Let generateUniqueLockboxId create a unique ID based on runId
        
        // Apply pattern-based transformations (splits)
        let processedData = extractedData;
        const appliedSplitRules = [];
        
        // Check if the matched pattern has split rules
        const matchedPattern = patternResult.pattern;
        console.log('Matched pattern type:', matchedPattern.patternType);
        console.log('Processing rules:', matchedPattern.processingRules);
        
        // Apply INVOICE_SPLIT if pattern has delimiter or is INVOICE_SPLIT type
        if (matchedPattern.patternType === 'INVOICE_SPLIT' || 
            matchedPattern.patternType === 'File Containing Comma' ||
            (matchedPattern.delimiter === ',') ||
            (matchedPattern.processingRules && matchedPattern.processingRules.includes('SPLIT_INVOICE'))) {
            console.log('=== Applying INVOICE SPLIT rules ===');
            console.log('Pattern:', matchedPattern.patternName);
            console.log('Pattern type:', matchedPattern.patternType, 'Delimiter:', matchedPattern.delimiter);
            console.log('Pattern actions:', JSON.stringify(matchedPattern.actions, null, 2));
            
            const splitDelimiter = matchedPattern.delimiter || ',';
            const splitData = [];
            
            // Find the action for Invoice/Document Number split
            const invoiceSplitAction = matchedPattern.actions?.find(a => 
                a.actionType === 'Split_Invoice/Document_Number' ||
                a.actionType.toLowerCase().includes('invoice')
            );
            
            // Determine padding requirement from pattern strategy or action
            const padTo10Digits = matchedPattern.conditions?.some(c => 
                c.strategy?.includes('10 Digit') || c.strategy?.includes('10Digit')
            ) || invoiceSplitAction?.splitLogic?.includes('10 digits');
            
            console.log('Invoice split action:', invoiceSplitAction);
            console.log('Pad to 10 digits:', padTo10Digits);
            
            for (const row of processedData) {
                const invoiceField = row.InvoiceNumber || row.PaymentReference || '';
                // Check for comma, ampersand, pipe, or "to" range
                if (invoiceField.toString().includes(',') || 
                    invoiceField.toString().includes('&') || 
                    invoiceField.toString().includes('|') ||
                    invoiceField.toString().toLowerCase().includes(' to ')) {
                    
                    // Use the split function
                    const invoices = splitInvoiceReferencesForProcessing(invoiceField.toString());
                    
                    if (invoices.length > 1) {
                        const totalAmount = parseFloat(row.InvoiceAmount) || parseFloat(row.CheckAmount) || 0;
                        
                        // Determine split mode from pattern or action
                        const amountSplitAction = matchedPattern.actions?.find(a => 
                            a.actionType === 'Split_Invoice/Document_Amount' ||
                            a.actionType === 'Split_Amount_Line_Item'
                        );
                        
                        const splitMode = amountSplitAction?.splitLogic?.includes('proportional') ? 'PROPORTIONAL' : 'EQUAL';
                        let splitAmounts = [];
                        
                        if (splitMode === 'EQUAL') {
                            const amountPerInvoice = totalAmount / invoices.length;
                            splitAmounts = invoices.map(() => amountPerInvoice);
                        } else {
                            // Default to equal split
                            const amountPerInvoice = totalAmount / invoices.length;
                            splitAmounts = invoices.map(() => amountPerInvoice);
                        }
                        
                        for (let i = 0; i < invoices.length; i++) {
                            // Apply padding if required by pattern
                            let invoiceNumber = invoices[i].trim();
                            if (padTo10Digits) {
                                // Pad to 10 digits with leading zeros
                                invoiceNumber = invoiceNumber.padStart(10, '0');
                                console.log(`  Padded invoice: ${invoices[i]} → ${invoiceNumber}`);
                            }
                            
                            splitData.push({
                                ...row,
                                InvoiceNumber: invoiceNumber,
                                // PRESERVE values from RULE-001 and RULE-002 if they exist
                                PaymentReference: row.PaymentReference || invoiceNumber,
                                Paymentreference: row.Paymentreference || row.PaymentReference || invoiceNumber,
                                CompanyCode: row.CompanyCode,  // ✅ Preserve CompanyCode from RULE-001
                                PartnerBank: row.PartnerBank,
                                PartnerBankAccount: row.PartnerBankAccount,
                                PartnerBankCountry: row.PartnerBankCountry,
                                InvoiceAmount: splitAmounts[i],
                                _splitFrom: invoiceField,
                                _splitRule: matchedPattern.patternName,
                                _splitIndex: i + 1,
                                _splitTotal: invoices.length,
                                _splitAction: invoiceSplitAction?.actionType || 'INVOICE_SPLIT'
                            });
                        }
                        appliedSplitRules.push({ 
                            rule: matchedPattern.patternName, 
                            action: invoiceSplitAction?.actionType || 'INVOICE_SPLIT', 
                            from: invoiceField, 
                            to: splitData.slice(-invoices.length).map(r => r.InvoiceNumber),
                            originalAmount: totalAmount,
                            splitAmounts: splitAmounts,
                            paddedTo10Digits: padTo10Digits
                        });
                    } else {
                        splitData.push(row);
                    }
                } else {
                    splitData.push(row);
                }
            }
            processedData = splitData;
            console.log(`✓ Invoice split applied: ${extractedData.length} rows → ${processedData.length} rows`);
            console.log(`✓ Split rules applied:`, appliedSplitRules);
        }
        
        // Apply CHECK_SPLIT if pattern has delimiter or is CHECK_SPLIT type
        if (matchedPattern.patternType === 'CHECK_SPLIT' || 
            (matchedPattern.delimiter === ',' && patternResult.analysis?.hasDelimitedChecks) ||
            (matchedPattern.processingRules && matchedPattern.processingRules.includes('SPLIT_CHECK'))) {
            console.log('Applying CHECK SPLIT rules...');
            console.log('Pattern type:', matchedPattern.patternType, 'Delimiter:', matchedPattern.delimiter);
            const splitData = [];
            
            for (const row of processedData) {
                const checkField = row.CheckNumber || '';
                if (checkField.toString().includes(',') || 
                    checkField.toString().includes('&') || 
                    checkField.toString().includes('|')) {
                    
                    const checks = splitInvoiceReferencesForProcessing(checkField.toString());
                    
                    if (checks.length > 1) {
                        const totalAmount = parseFloat(row.CheckAmount) || 0;
                        const amountPerCheck = totalAmount / checks.length;
                        
                        for (let i = 0; i < checks.length; i++) {
                            splitData.push({
                                ...row,
                                CheckNumber: checks[i].padStart(10, '0'),
                                CheckAmount: amountPerCheck,
                                // PRESERVE enriched values from RULE-001 and RULE-002
                                PaymentReference: row.PaymentReference,
                                Paymentreference: row.Paymentreference,
                                CompanyCode: row.CompanyCode,  // ✅ Preserve CompanyCode from RULE-001
                                PartnerBank: row.PartnerBank,
                                PartnerBankAccount: row.PartnerBankAccount,
                                PartnerBankCountry: row.PartnerBankCountry,
                                _splitFrom: checkField,
                                _splitRule: matchedPattern.patternName
                            });
                        }
                        appliedSplitRules.push({ 
                            rule: matchedPattern.patternName, 
                            action: 'CHECK_SPLIT', 
                            from: checkField, 
                            to: checks 
                        });
                    } else {
                        splitData.push(row);
                    }
                } else {
                    splitData.push(row);
                }
            }
            processedData = splitData;
            console.log(`Check split applied: ${extractedData.length} rows → ${processedData.length} rows`);
        }
        
        // Apply AMOUNT_SPLIT if pattern is AMOUNT_SPLIT type
        if (matchedPattern.patternType === 'AMOUNT_SPLIT' || 
            (matchedPattern.processingRules && matchedPattern.processingRules.includes('SPLIT_AMOUNT'))) {
            console.log('Applying AMOUNT SPLIT rules...');
            // Amount split is typically handled by open item matching - placeholder for future
            appliedSplitRules.push({ 
                rule: matchedPattern.patternName, 
                action: 'AMOUNT_SPLIT', 
                mode: matchedPattern.splitMode || 'EQUAL'
            });
        }
        
        // Also apply any transformation rules from fieldMappingRules (RULE-001 Invoice Split Rule, etc.)
        const invoiceSplitRule = fieldMappingRules.find(r => r.ruleType === 'SPLIT' && r.active);
        if (invoiceSplitRule && appliedSplitRules.length === 0) {
            console.log('Applying transformation SPLIT rule:', invoiceSplitRule.ruleName);
            const splitData = [];
            
            for (const row of processedData) {
                const invoiceField = row.InvoiceNumber || row.PaymentReference || '';
                if (invoiceField.toString().includes(',')) {
                    const invoices = splitInvoiceReferencesForProcessing(invoiceField.toString());
                    const totalAmount = parseFloat(row.InvoiceAmount) || parseFloat(row.CheckAmount) || 0;
                    const amountPerInvoice = totalAmount / invoices.length;
                    
                    for (const inv of invoices) {
                        splitData.push({
                            ...row,
                            InvoiceNumber: inv,
                            // PRESERVE values from RULE-001 if PaymentReference already has BELNR
                            PaymentReference: row.PaymentReference || inv,
                            Paymentreference: row.Paymentreference || row.PaymentReference || inv,
                            CompanyCode: row.CompanyCode,  // ✅ Preserve CompanyCode from RULE-001
                            InvoiceAmount: amountPerInvoice,
                            // PRESERVE values from RULE-002
                            PartnerBank: row.PartnerBank,
                            PartnerBankAccount: row.PartnerBankAccount,
                            PartnerBankCountry: row.PartnerBankCountry,
                            _splitFrom: invoiceField,
                            _splitRule: invoiceSplitRule.ruleName
                        });
                    }
                    appliedSplitRules.push({ 
                        rule: invoiceSplitRule.ruleName, 
                        action: 'SPLIT', 
                        from: invoiceField, 
                        to: invoices 
                    });
                } else {
                    splitData.push(row);
                }
            }
            processedData = splitData;
        }
        
        // Update extraction stage with applied rules
        if (appliedSplitRules.length > 0) {
            run.stages.extraction.appliedRules = appliedSplitRules;
            run.stages.extraction.message = `Extracted ${extractedData.length} records, applied ${appliedSplitRules.length} split rule(s) → ${processedData.length} records`;
            run.stages.extraction.rowCount = processedData.length;
        }
        
        // Build standard SAP payload with constants
        // Pass runId to generate unique Lockbox ID for each run
        run.sapPayload = buildStandardPayload(processedData, lockboxId, run.runId);
        run.hierarchy = buildHierarchyFromPayload(run.sapPayload, run.filename);
        run.mappedData = processedData;
        
        // Update lockboxId with the generated one from payload
        const generatedLockboxId = run.sapPayload.Lockbox;
        
        run.stages.mapping = { 
            status: 'success', 
            message: `Generated standard payload: Lockbox=${generatedLockboxId}, Batch=001, ${run.sapPayload.to_Item.results.length} Items`,
            lockboxId: generatedLockboxId,
            batchId: '001',
            itemCount: run.sapPayload.to_Item.results.length,
            totalAmount: run.sapPayload.AmountInTransactionCurrency
        };
        console.log('Mapping complete. Hierarchy entries:', run.hierarchy.length);
        
        // ═══════════════════════════════════════════════════════════════════
        // COMPLETE - Ready for simulation
        // ═══════════════════════════════════════════════════════════════════
        run.currentStage = 'complete'; 
        run.overallStatus = 'validated'; 
        run.completedAt = new Date().toISOString();
        
        // Save to PostgreSQL database
        await saveProcessingRun(run);
        
        console.log('=== PROCESSING COMPLETE ===');
        console.log('Run ID:', runId, 'Status:', run.overallStatus);
        
        res.json({ success: true, run, message: 'Processing complete. Ready for simulation.' });
        
    } catch (err) {
        console.error('Processing error:', err);
        run.overallStatus = 'failed'; 
        run.stages[run.currentStage].status = 'error'; 
        run.stages[run.currentStage].message = `Error: ${err.message}`; 
        run.lastFailedStage = run.currentStage;
        
        // Save failed run to database as well
        await saveProcessingRun(run);
        
        res.json({ success: false, run, error: err.message });
    }
});

// Get all processing runs (loads from DB if cache is empty)
app.get('/api/lockbox/runs', async (req, res) => {
    // Reload from database if cache is empty
    if (lockboxProcessingRuns.length === 0) {
        await loadProcessingRuns();
    }
    
    const summaries = lockboxProcessingRuns.map(r => ({ runId: r.runId, filename: r.filename, startedAt: r.startedAt, completedAt: r.completedAt, currentStage: r.currentStage, overallStatus: r.overallStatus, lastFailedStage: r.lastFailedStage, stages: { upload: { status: r.stages?.upload?.status }, templateMatch: { status: r.stages?.templateMatch?.status, templateId: r.stages?.templateMatch?.templateId }, extraction: { status: r.stages?.extraction?.status, rowCount: r.stages?.extraction?.rowCount }, validation: { status: r.stages?.validation?.status }, mapping: { status: r.stages?.mapping?.status } } }));
    res.json({ runs: summaries });
});

// Jobs API - Alias for lockbox runs (used by frontend dashboard)
app.get('/api/jobs', async (req, res) => {
    // Reload from database if cache is empty
    if (lockboxProcessingRuns.length === 0) {
        await loadProcessingRuns();
    }
    
    // Map runs to jobs format expected by frontend
    const jobs = lockboxProcessingRuns.map(r => ({
        id: r.runId,
        runId: r.runId,
        filename: r.filename,
        fileType: r.fileType || 'XLSX',
        status: (r.overallStatus || 'pending').toUpperCase(),
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        currentStage: r.currentStage,
        rowCount: r.stages?.extraction?.rowCount || 0,
        templateId: r.stages?.templateMatch?.templateId,
        stages: r.stages
    }));
    res.json({ jobs });
});

// Get specific run
app.get('/api/lockbox/runs/:runId', (req, res) => {
    const run = lockboxProcessingRuns.find(r => r.runId === req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json({ run });
});


// Delete a lockbox run (only unprocessed files)
app.delete('/api/lockbox/runs/:runId', (req, res) => {
    const runId = req.params.runId;
    const runIndex = lockboxProcessingRuns.findIndex(r => r.runId === runId);
    
    if (runIndex === -1) {
        return res.status(404).json({ 
            success: false, 
            message: 'Run not found' 
        });
    }
    
    const run = lockboxProcessingRuns[runIndex];
    
    // Prevent deletion of simulated or posted files
    if (run.overallStatus === 'simulated' || run.overallStatus === 'SIMULATED' ||
        run.overallStatus === 'posted' || run.overallStatus === 'POSTED') {
        return res.status(400).json({
            success: false,
            message: 'Cannot delete files that have been simulated or posted'
        });
    }
    
    // Remove from array
    lockboxProcessingRuns.splice(runIndex, 1);
    
    console.log(`Deleted run ${runId}. Status was: ${run.overallStatus}`);
    
    res.json({
        success: true,
        message: 'Run deleted successfully',
        deletedRunId: runId
    });
});


// Get production result with full error details (including XML)
app.get('/api/lockbox/runs/:runId/production-result', (req, res) => {
    const run = lockboxProcessingRuns.find(r => r.runId === req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    
    const result = {
        runId: run.runId,
        status: run.overallStatus,
        productionResult: run.productionResult || null,
        sapPayload: run.sapPayload || null,
        error: run.productionResult?.error || null
    };
    
    // If there's an error with XML response, format it nicely
    if (result.error?.sapErrorXml) {
        result.errorXmlAvailable = true;
    }
    
    res.json(result);
});

// Get SAP API service document (XML)
app.get('/api/sap/service-document', async (req, res) => {
    try {
        const serviceDoc = await getSapServiceDocument();
        if (serviceDoc) {
            res.set('Content-Type', 'application/xml');
            res.send(serviceDoc);
        } else {
            res.status(503).json({ 
                error: 'Unable to fetch SAP service document',
                note: 'SAP BTP Destination Service is only available when deployed to SAP BTP'
            });
        }
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            note: 'Failed to connect to SAP system'
        });
    }
});

// Get SAP API metadata (XML)
app.get('/api/sap/metadata', async (req, res) => {
    try {
        const metadata = await getSapMetadata();
        if (metadata) {
            res.set('Content-Type', 'application/xml');
            res.send(metadata);
        } else {
            res.status(503).json({ 
                error: 'Unable to fetch SAP metadata',
                note: 'SAP BTP Destination Service is only available when deployed to SAP BTP'
            });
        }
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            note: 'Failed to connect to SAP system'
        });
    }
});

// Get SAP connection status and diagnostics
app.get('/api/sap/diagnostics', async (req, res) => {
    const diagnostics = {
        timestamp: new Date().toISOString(),
        configuration: {
            destination: SAP_DESTINATION_NAME,
            apiPath: SAP_API_PATH,
            clearingPath: SAP_CLEARING_PATH,
            sapClient: SAP_CLIENT,
            companyCode: DEFAULT_COMPANY_CODE
        },
        connectionTest: {
            status: 'PENDING',
            message: null,
            serviceDocumentAvailable: false,
            metadataAvailable: false
        }
    };
    
    try {
        // Try to fetch service document
        const serviceDoc = await getSapServiceDocument();
        if (serviceDoc) {
            diagnostics.connectionTest.serviceDocumentAvailable = true;
            diagnostics.connectionTest.status = 'CONNECTED';
            diagnostics.connectionTest.message = 'Successfully connected to SAP API';
        } else {
            diagnostics.connectionTest.status = 'UNAVAILABLE';
            diagnostics.connectionTest.message = 'SAP BTP Destination not available. Deploy to BTP for live SAP connection.';
        }
    } catch (error) {
        diagnostics.connectionTest.status = 'ERROR';
        diagnostics.connectionTest.message = error.message;
        diagnostics.connectionTest.errorDetails = error.sapErrorDetails || null;
    }
    
    res.json(diagnostics);
});

// Get hierarchy for run
app.get('/api/lockbox/runs/:runId/hierarchy', (req, res) => {
    const run = lockboxProcessingRuns.find(r => r.runId === req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json({ hierarchy: run.hierarchy || [], status: run.overallStatus });
});

// Download original source file
app.get('/api/lockbox/runs/:runId/download', (req, res) => {
    const run = lockboxProcessingRuns.find(r => r.runId === req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    
    if (!run.originalFileBuffer) {
        return res.status(404).json({ error: 'Original file not available' });
    }
    
    try {
        // Convert base64 back to buffer
        const fileBuffer = Buffer.from(run.originalFileBuffer, 'base64');
        
        // Set headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${run.filename}"`);
        res.setHeader('Content-Type', run.originalFileMimeType || 'application/octet-stream');
        res.setHeader('Content-Length', fileBuffer.length);
        
        res.send(fileBuffer);
    } catch (err) {
        console.error('Error downloading file:', err);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// Reprocess from failed stage
app.post('/api/lockbox/runs/:runId/reprocess', (req, res) => {
    const run = lockboxProcessingRuns.find(r => r.runId === req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    if (run.overallStatus !== 'failed') return res.status(400).json({ error: 'Can only reprocess failed runs' });
    
    // Re-run from failed stage (simplified - re-runs template match and onwards)
    if (run.lastFailedStage === 'templateMatch') {
        const fileType = run.filename.split('.').pop().toUpperCase();
        const matchResult = matchFileToTemplate(fileType, run.rawData[0]);
        if (matchResult.template) {
            run.stages.templateMatch = { status: 'success', message: `Matched: ${matchResult.template.name}`, templateId: matchResult.template.templateId };
            run.overallStatus = 'pending_continue';
        }
    }
    res.json({ success: true, run });
});

// Simulate
app.post('/api/lockbox/runs/:runId/simulate', async (req, res) => {
    const run = lockboxProcessingRuns.find(r => r.runId === req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    if (run.overallStatus !== 'validated') return res.status(400).json({ error: 'Must be validated first' });
    
    const service = odataServices[0];
    const sapPayload = run.sapPayload;
    const extractedRows = run.extractedData || run.stages?.extraction?.extractedRows || [];
    const customerNumber = extractedRows[0]?.Customer || '17100003';
    const startTime = new Date();
    const lockboxNumber = '1234'; // Fixed Lockbox constant
    
    // Generate mock document numbers for simulation display
    const timestamp = Date.now();
    const mockInternalKey = String(timestamp).slice(-10).padStart(10, '0');
    const mockAccountingDoc = '0100' + String(timestamp).slice(-6);
    const mockPaymentAdvice = '000' + mockInternalKey + '00001';
    const mockClearingDoc = '1400' + String(timestamp).slice(-6);
    const fiscalYear = new Date().getFullYear().toString();
    const itemCount = sapPayload?.to_Item?.results?.length || extractedRows.length || 1;
    const totalAmount = sapPayload?.AmountInTransactionCurrency || '0.00';
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║          SIMULATION RUN (MOCK MODE - No SAP Connection)          ║');
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log('║ Run ID:', run.runId.padEnd(55) + '║');
    console.log('║ Template ID:', (run.templateId || 'N/A').padEnd(51) + '║');
    console.log('║ Lockbox: 1234 (constant)'.padEnd(67) + '║');
    console.log('║ Mode: SIMULATION (No backend connection)'.padEnd(67) + '║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    // ════════════════════════════════════════════════════════════════════
    // STEP 1: MOCK POST LockboxBatch - Creates batch and triggers processing
    // Error Handling: HTTP error → Reject request
    // ════════════════════════════════════════════════════════════════════
    console.log('┌──────────────────────────────────────────────────────────────────┐');
    console.log('│ STEP 1: POST LockboxBatch (MOCK - Simulating SAP Response)      │');
    console.log('└──────────────────────────────────────────────────────────────────┘');
    console.log('API: POST', SAP_API_PATH);
    console.log('Lockbox: 1234 (constant for all batches)');
    console.log('Mock LockboxBatchInternalKey:', mockInternalKey);
    console.log('');
    console.log('Payload Preview:');
    console.log(JSON.stringify(sapPayload, null, 2).substring(0, 1000) + '...');
    
    const step1Result = {
        status: 'SUCCESS',
        httpStatus: 201,
        api: 'POST /LockboxBatch',
        lockboxBatchInternalKey: mockInternalKey,
        lockboxBatch: '001',
        lockboxNumber: lockboxNumber,
        displayLockboxId: `${lockboxNumber}-${mockInternalKey}`,
        errorHandling: {
            rule: 'HTTP error → Reject request',
            condition: 'HTTP Status != 201',
            action: 'REJECT_REQUEST'
        },
        note: 'MOCK - Would create lockbox batch in SAP',
        payloadPreview: sapPayload
    };
    
    // ════════════════════════════════════════════════════════════════════
    // STEP 2: MOCK GET LockboxBatch - Verify batch status
    // Error Handling: Batch Status = Error → Raise exception
    // ════════════════════════════════════════════════════════════════════
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────────┐');
    console.log('│ STEP 2: GET LockboxBatch (MOCK - Verify Batch Status)           │');
    console.log('└──────────────────────────────────────────────────────────────────┘');
    console.log('API: GET /LockboxBatch(LockboxBatchInternalKey=\'' + mockInternalKey + '\',LockboxBatch=\'001\')');
    console.log('Purpose: Verify batch status and get AccountingDocument');
    console.log('Mock AccountingDocument:', mockAccountingDoc);
    
    const step2Result = {
        status: 'SUCCESS',
        httpStatus: 200,
        api: 'GET /LockboxBatch',
        accountingDocument: mockAccountingDoc,
        batchStatus: 'OK',
        errorHandling: {
            rule: 'Batch Status = Error → Raise exception',
            condition: 'Status = Error',
            action: 'RAISE_EXCEPTION'
        },
        note: 'MOCK - Would verify batch status and get AccountingDocument'
    };
    
    // ════════════════════════════════════════════════════════════════════
    // STEP 3: MOCK GET LockboxBatchItem - Retrieve payment details
    // Error Handling: Missing payment advice → Manual queue
    // ════════════════════════════════════════════════════════════════════
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────────┐');
    console.log('│ STEP 3: GET LockboxBatchItem (MOCK - Payment Line Details)      │');
    console.log('└──────────────────────────────────────────────────────────────────┘');
    
    console.log(`Items to process: ${itemCount}`);
    console.log('Will retrieve: PaymentAdvice (SAP Generated), PaymentAdviceAccount (Customer FROM FILE)');
    console.log('');
    console.log('API Parameters for GET LockboxClearing:');
    console.log('  PaymentAdvice = (GENERATED BY SAP - from this step)');
    console.log('  PaymentAdviceAccount = Customer number (FROM UPLOADED FILE)');
    console.log('  PaymentAdviceAccountType = "D" (CONSTANT)');
    console.log('  CompanyCode = "1710" (CONSTANT)');
    
    // Generate mock items with payment advice details
    // Use customer from payload items (from uploaded file)
    const payloadItems = sapPayload?.to_Item?.results || [];
    const mockBatchItems = [];
    for (let i = 1; i <= itemCount; i++) {
        const mockPA = mockPaymentAdvice.slice(0, -1) + i;
        const payloadItem = payloadItems[i - 1] || {};
        // Customer from file (stored in _customerForClearing during payload build)
        const customerFromFile = payloadItem._customerForClearing || extractedRows[i - 1]?.Customer || customerNumber;
        
        mockBatchItems.push({
            item: String(i),
            paymentAdvice: mockPA,           // SAP Generated
            paymentAdviceItem: '1',
            paymentAdviceAccount: customerFromFile, // Customer FROM FILE
            paymentAdviceAccountType: 'D',   // CONSTANT
            companyCode: DEFAULT_COMPANY_CODE // CONSTANT "1710"
        });
        console.log(`✓ Item ${i}:`);
        console.log(`    PaymentAdvice: ${mockPA} (SAP Generated)`);
        console.log(`    PaymentAdviceAccount: ${customerFromFile} (Customer FROM FILE)`);
        console.log(`    PaymentAdviceAccountType: D (CONSTANT)`);
        console.log(`    CompanyCode: ${DEFAULT_COMPANY_CODE} (CONSTANT)`);
    }
    
    const step3Result = {
        status: 'SUCCESS',
        api: 'GET /LockboxBatchItem',
        itemsProcessed: itemCount,
        items: mockBatchItems,
        errorHandling: {
            rule: 'Missing payment advice → Manual queue',
            condition: 'PaymentAdvice = null/empty',
            action: 'MANUAL_QUEUE'
        },
        note: 'MOCK - Would retrieve payment line details. PaymentAdvice is GENERATED by SAP.'
    };
    
    // ════════════════════════════════════════════════════════════════════
    // STEP 4: MOCK GET LockboxClearing - Retrieve clearing result
    // Error Handling: No cleared items → Mark as unapplied
    // 
    // API: GET /LockboxClearing(
    //   PaymentAdvice='...',           // from Step 3 - SAP GENERATED
    //   PaymentAdviceItem='1',
    //   PaymentAdviceAccount='...',    // Customer FROM FILE
    //   PaymentAdviceAccountType='D',  // CONSTANT
    //   CompanyCode='1710'             // CONSTANT
    // )
    // ════════════════════════════════════════════════════════════════════
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────────┐');
    console.log('│ STEP 4: GET LockboxClearing (MOCK - Clearing Result)            │');
    console.log('├──────────────────────────────────────────────────────────────────┤');
    console.log('│ API Parameters:                                                  │');
    console.log('│   PaymentAdvice = (from Step 3 - SAP GENERATED)                 │');
    console.log('│   PaymentAdviceAccount = Customer (FROM FILE)                   │');
    console.log('│   PaymentAdviceAccountType = "D" (CONSTANT)                     │');
    console.log('│   CompanyCode = "1710" (CONSTANT)                               │');
    console.log('└──────────────────────────────────────────────────────────────────┘');
    console.log('Purpose: Get cleared invoices, clearing documents, and residual postings');
    
    // Generate mock clearing details
    const mockClearingDetails = mockBatchItems.map((item, idx) => ({
        paymentAdvice: item.paymentAdvice,
        paymentAdviceAccount: item.paymentAdviceAccount, // Customer FROM FILE
        accountingDocument: mockAccountingDoc,
        clearingDocument: mockClearingDoc,
        fiscalYear: fiscalYear,
        companyCode: DEFAULT_COMPANY_CODE,
        status: 'CLEARED'
    }));
    
    mockClearingDetails.forEach((c, i) => {
        console.log(`✓ Clearing ${i + 1}:`);
        console.log(`    PaymentAdvice: ${c.paymentAdvice}`);
        console.log(`    PaymentAdviceAccount: ${c.paymentAdviceAccount} (Customer FROM FILE)`);
        console.log(`    AccountingDoc: ${c.accountingDocument}`);
        console.log(`    ClearingDoc: ${c.clearingDocument}`);
    });
    
    const step4Result = {
        status: 'SUCCESS',
        api: 'GET /LockboxClearing',
        companyCode: DEFAULT_COMPANY_CODE,
        clearingItemsProcessed: mockClearingDetails.length,
        details: mockClearingDetails,
        errorHandling: {
            rule: 'No cleared items → Mark as unapplied',
            condition: 'ClearingDocument = null/empty',
            action: 'MARK_UNAPPLIED'
        },
        note: 'MOCK - Would retrieve clearing results'
    };
    
    // ════════════════════════════════════════════════════════════════════
    // SIMULATION SUMMARY - Mock accounting data for live popup display
    // ════════════════════════════════════════════════════════════════════
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────────┐');
    console.log('│ SIMULATION SUMMARY (MOCK ACCOUNTING DATA)                       │');
    console.log('└──────────────────────────────────────────────────────────────────┘');
    console.log('✓ Lockbox: 1234 (constant)');
    console.log('✓ LockboxBatchInternalKey:', mockInternalKey);
    console.log('✓ AccountingDocument:', mockAccountingDoc);
    console.log('✓ PaymentAdvice:', mockPaymentAdvice);
    console.log('✓ ClearingDocument:', mockClearingDoc);
    console.log('✓ Template ID:', run.templateId || 'N/A');
    console.log('✓ Items:', itemCount);
    console.log('✓ Total Amount:', totalAmount);
    console.log('✓ Customer:', customerNumber);
    console.log('');
    console.log('→ Ready for Production Run (will connect to SAP and generate real documents)');
    console.log('');
    
    // Build mock accounting data for frontend display
    const mockAccountingData = {
        lockbox: {
            number: lockboxNumber,
            internalKey: mockInternalKey,
            displayId: `${lockboxNumber}-${mockInternalKey}`
        },
        documents: {
            accountingDocument: mockAccountingDoc,
            paymentAdvice: mockPaymentAdvice,
            clearingDocument: mockClearingDoc,
            fiscalYear: fiscalYear,
            companyCode: DEFAULT_COMPANY_CODE,
            postingDate: new Date().toISOString().split('T')[0]
        },
        clearing: {
            status: 'CLEARED',
            itemsCleared: itemCount,
            totalAmount: totalAmount,
            currency: 'USD',
            details: mockClearingDetails
        },
        glPostings: [
            {
                account: '11000000',
                description: 'Bank Account - Lockbox',
                debit: totalAmount,
                credit: '0.00',
                currency: 'USD'
            },
            {
                account: '14000000',
                description: 'Customer Receivables',
                debit: '0.00',
                credit: totalAmount,
                currency: 'USD'
            }
        ]
    };
    
    // Build simulation result
    run.simulationResult = { 
        status: 'SIMULATED',
        mode: 'MOCK',
        note: 'Simulation completed without SAP backend connection. Production Run will execute actual API calls.',
        lockboxNumber: lockboxNumber,
        templateId: run.templateId,
        // Step-by-step process results
        steps: {
            step1: step1Result,
            step2: step2Result,
            step3: step3Result,
            step4: step4Result
        },
        // Error handling rules summary
        errorHandlingRules: [
            { step: 'POST', condition: 'HTTP error', action: 'Reject request' },
            { step: 'Batch', condition: 'Status = Error', action: 'Raise exception' },
            { step: 'Item', condition: 'Missing payment advice', action: 'Manual queue' },
            { step: 'Clearing', condition: 'No cleared items', action: 'Mark as unapplied' }
        ],
        // Mock accounting data for live popup
        mockResponse: {
            lockboxBatchInternalKey: mockInternalKey,
            lockboxBatch: '001',
            lockboxNumber: lockboxNumber,
            displayLockboxId: `${lockboxNumber}-${mockInternalKey}`,
            paymentAdvice: mockPaymentAdvice,
            accountingDocument: mockAccountingDoc,
            clearingDocument: mockClearingDoc,
            fiscalYear: fiscalYear,
            companyCode: DEFAULT_COMPANY_CODE,
            postingDate: new Date().toISOString().split('T')[0],
            itemsPosted: itemCount,
            totalAmount: totalAmount,
            currency: 'USD'
        },
        // Full mock accounting data for detailed popup
        mockAccountingData: mockAccountingData,
        service: { 
            system: service?.system || 'S4HANA On Premise', 
            url: service?.httpsApiOdata || SAP_API_PATH,
            destination: SAP_DESTINATION_NAME,
            companyCode: DEFAULT_COMPANY_CODE
        }, 
        sapPayload: sapPayload,
        summary: { 
            lockbox: lockboxNumber, 
            lockboxBatchDestination: sapPayload?.LockboxBatchDestination,
            lockboxBatchOrigin: sapPayload?.LockboxBatchOrigin,
            companyCode: DEFAULT_COMPANY_CODE,
            currency: 'USD',
            itemCount: itemCount,
            totalAmount: totalAmount,
            customer: customerNumber
        },
        timing: {
            startedAt: startTime.toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime.getTime()
        }
    };
    
    run.overallStatus = 'simulated';
    run.stages.simulate = { 
        status: 'success', 
        message: 'Simulation completed (MOCK) - Ready for production run',
        mockInternalKey: mockInternalKey,
        mockAccountingDoc: mockAccountingDoc,
        mockPaymentAdvice: mockPaymentAdvice
    };
    
    // Update hierarchy with lockbox number and simulated documents
    if (run.hierarchy && run.hierarchy[0]) {
        run.hierarchy[0].status = 'SIMULATED';
        run.hierarchy[0].lockbox = `${lockboxNumber}-${mockInternalKey}`;
    }
    
    // Save updated run to database
    await saveProcessingRun(run);
    
    res.json({ success: true, simulation: run.simulationResult, run });
});

// Repost - Create a new batch run from an existing run's file data
app.post('/api/lockbox/runs/:runId/repost', async (req, res) => {
    try {
        const originalRun = lockboxProcessingRuns.find(r => r.runId === req.params.runId);
        if (!originalRun) {
            return res.status(404).json({ success: false, error: 'Original run not found' });
        }
        
        // Check if original run has been posted or failed
        if (originalRun.overallStatus !== 'posted' && originalRun.overallStatus !== 'post_failed') {
            return res.status(400).json({ 
                success: false, 
                error: 'Only posted or failed runs can be reposted. Current status: ' + originalRun.overallStatus 
            });
        }
        
        console.log('=== REPOST: Creating new batch run ===');
        console.log('Original Run ID:', originalRun.runId);
        console.log('Filename:', originalRun.filename);
        
        // Generate new run ID
        const newRunId = `RUN-${new Date().getFullYear()}-${String(lockboxProcessingRuns.length + 1).padStart(5, '0')}`;
        
        // Create new run by cloning the original run's extracted data
        const newRun = {
            runId: newRunId,
            filename: originalRun.filename,
            sourceFile: originalRun.sourceFile,
            sourceFileType: originalRun.sourceFileType,
            originalRunId: originalRun.runId, // Track the original run
            startedAt: new Date().toISOString(),
            completedAt: null,
            overallStatus: 'validated', // Start from validated state so it can go to simulation
            // Copy extracted data
            extractedData: JSON.parse(JSON.stringify(originalRun.extractedData || [])),
            mappedData: JSON.parse(JSON.stringify(originalRun.mappedData || [])),
            // Copy SAP payload (will be regenerated on simulation)
            sapPayload: JSON.parse(JSON.stringify(originalRun.sapPayload || {})),
            // Copy stages but reset simulation and production
            stages: {
                upload: { status: 'completed', completedAt: new Date().toISOString() },
                templateMatch: originalRun.stages?.templateMatch ? JSON.parse(JSON.stringify(originalRun.stages.templateMatch)) : { status: 'completed' },
                extraction: originalRun.stages?.extraction ? JSON.parse(JSON.stringify(originalRun.stages.extraction)) : { status: 'completed' },
                validation: { status: 'completed', completedAt: new Date().toISOString() },
                mapping: originalRun.stages?.mapping ? JSON.parse(JSON.stringify(originalRun.stages.mapping)) : { status: 'completed' },
                simulation: { status: 'pending' },
                production: { status: 'pending' }
            },
            // Reset results
            simulationResult: null,
            productionResult: null,
            // Metadata
            isRepost: true,
            repostedFrom: originalRun.runId,
            repostedAt: new Date().toISOString()
        };
        
        // Add to runs list
        lockboxProcessingRuns.push(newRun);
        
        // Save to file
        await saveProcessingRun(newRun);
        
        console.log('New Run ID:', newRunId);
        console.log('New Run Status:', newRun.overallStatus);
        console.log('=== REPOST COMPLETE ===');
        
        res.json({ 
            success: true, 
            message: 'New batch run created successfully',
            newRunId: newRunId,
            originalRunId: originalRun.runId,
            newRun: newRun
        });
        
    } catch (err) {
        console.error('Repost error:', err);
        res.status(500).json({ success: false, error: 'Repost failed: ' + err.message });
    }
});

// Production run - Real SAP API Integration with comprehensive error handling
app.post('/api/lockbox/runs/:runId/production', async (req, res) => {
    const run = lockboxProcessingRuns.find(r => r.runId === req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    if (run.overallStatus !== 'simulated') return res.status(400).json({ error: 'Must simulate first' });
    
    const { useMock = false, serviceId } = req.body; // Default to LIVE mode (post to SAP)
    
    // Get the selected OData service configuration (for display purposes)
    // Actual API calls use the constants SAP_API_PATH, SAP_CLEARING_PATH, SAP_DESTINATION_NAME
    const selectedService = serviceId 
        ? odataServices.find(s => s.serviceId === serviceId) 
        : odataServices.find(s => s.system === 'S4HANA On Premise') || odataServices[0];
    
    if (!selectedService) {
        return res.status(400).json({ error: 'No OData service configured' });
    }
    
    const startTime = new Date();
    run.productionStartedAt = startTime.toISOString();
    
    // Initialize detailed step-by-step log for error tracking
    const stepLogs = [];
    const logStep = (step, status, message, details = {}) => {
        const logEntry = {
            step,
            status,
            message,
            timestamp: new Date().toISOString(),
            ...details
        };
        stepLogs.push(logEntry);
        console.log(`[${step}] ${status}: ${message}`);
        if (Object.keys(details).length > 0) {
            console.log('  Details:', JSON.stringify(details, null, 2));
        }
    };
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                     PRODUCTION RUN STARTED                        ');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('Run ID:', run.runId);
    console.log('Use Mock Mode:', useMock);
    console.log('SAP API Path:', SAP_API_PATH);
    console.log('SAP Clearing Path:', SAP_CLEARING_PATH);
    console.log('SAP Destination:', SAP_DESTINATION_NAME);
    console.log('SAP Client:', SAP_CLIENT);
    console.log('Company Code:', DEFAULT_COMPANY_CODE);
    console.log('═══════════════════════════════════════════════════════════════════');
    
    try {
        let productionResult;
        
        if (useMock) {
            // MOCK MODE - Generate simulated SAP response (only if explicitly requested)
            logStep('INIT', 'INFO', 'Production run started in MOCK mode');
            console.log('=== PRODUCTION RUN (MOCK MODE - Explicitly Requested) ===');
            
            const timestamp = Date.now();
            const lockboxNumber = run.sapPayload?.Lockbox || `LB-${timestamp.toString().slice(-8)}`;
            
            // Generate realistic SAP document numbers
            const accountingDoc = `DOC-${timestamp.toString().slice(-8)}`;
            const paymentAdvice = `PA-${lockboxNumber}-${timestamp.toString().slice(-6)}`;
            const clearingDoc = `CLR-${timestamp.toString().slice(-8)}`;
            const itemCount = run.sapPayload?.to_Item?.results?.length || 0;
            
            logStep('STEP1', 'SUCCESS', 'MOCK POST LockboxBatch completed', { lockboxNumber, accountingDoc });
            logStep('STEP2', 'SUCCESS', 'MOCK GET LockboxBatch verified', { batchStatus: 'OK' });
            logStep('STEP3', 'SUCCESS', 'MOCK GET LockboxBatchItem retrieved', { itemCount });
            logStep('STEP4', 'SUCCESS', 'MOCK GET LockboxClearing completed', { clearingDoc });
            
            productionResult = {
                status: 'POSTED',
                mode: 'MOCK',
                stepLogs: stepLogs,
                sapResponse: {
                    accountingDocument: accountingDoc,
                    fiscalYear: new Date().getFullYear().toString(),
                    companyCode: run.sapPayload?.CompanyCode || '1710',
                    postingDate: new Date().toISOString().split('T')[0],
                    paymentAdvice: paymentAdvice,
                    lockboxNumber: lockboxNumber,
                    batchNumber: '001',
                    itemsPosted: itemCount,
                    totalAmount: run.sapPayload?.AmountInTransactionCurrency || '0.00',
                    currency: 'USD',
                    sapMessage: 'Lockbox batch successfully posted to SAP backend (MOCK)',
                    sapMessageType: 'S'
                },
                clearing: {
                    status: 'CLEARED',
                    clearedItems: itemCount,
                    clearingDocument: clearingDoc,
                    clearingDate: new Date().toISOString().split('T')[0],
                    // Simulate clearing details for each item
                    details: (run.sapPayload?.to_Item?.results || []).map((item, idx) => ({
                        PaymentReference: item.to_LockboxClearing?.results?.[0]?.PaymentReference || `REF-${idx + 1}`,
                        NetPaymentAmountInPaytCurrency: item.AmountInTransactionCurrency,
                        Currency: item.Currency || 'USD',
                        ClearingDocument: clearingDoc,
                        AccountingDocument: accountingDoc,
                        FiscalYear: new Date().getFullYear().toString(),
                        CompanyCode: DEFAULT_COMPANY_CODE
                    }))
                },
                service: {
                    system: 'S4HANA On Premise',
                    apiPath: SAP_API_PATH,
                    clearingPath: SAP_CLEARING_PATH,
                    destination: SAP_DESTINATION_NAME,
                    sapClient: SAP_CLIENT,
                    companyCode: RUNTIME_COMPANY_CODE,
                    note: 'MOCK MODE - No actual SAP connection. Deploy to BTP and set useMock=false for live SAP posting.'
                },
                timing: {
                    startedAt: startTime.toISOString(),
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - startTime.getTime()
                }
            };
        } else {
            // ================================================================================
            // LIVE MODE - SAP Lockbox API Step-by-Step Process with Error Handling
            // Error Handling Rules (Mandatory):
            //   POST: HTTP error → Reject request
            //   Batch: Status = Error → Raise exception
            //   Item: Missing payment advice → Manual queue
            //   Clearing: No cleared items → Mark as unapplied
            // ================================================================================
            logStep('INIT', 'INFO', 'Production run started in LIVE mode');
            
            console.log('');
            console.log('╔══════════════════════════════════════════════════════════════════╗');
            console.log('║          PRODUCTION RUN (LIVE MODE - SAP S/4HANA)               ║');
            console.log('╠══════════════════════════════════════════════════════════════════╣');
            console.log('║ Run ID:', run.runId.padEnd(55) + '║');
            console.log('║ SAP Destination:', SAP_DESTINATION_NAME.padEnd(46) + '║');
            console.log('║ Company Code:', DEFAULT_COMPANY_CODE.padEnd(49) + '║');
            console.log('╚══════════════════════════════════════════════════════════════════╝');
            console.log('');
            
            try {
                const sapPayload = run.sapPayload;
                const extractedRows = run.extractedData || run.stages?.extraction?.extractedRows || [];
                const customerNumber = extractedRows[0]?.Customer || '';
                
                // Initialize production result with step logs
                productionResult = {
                    status: 'PROCESSING',
                    mode: 'LIVE',
                    steps: {},
                    stepLogs: stepLogs,
                    sapResponse: {},
                    clearing: { status: 'PENDING', details: [] },
                    // Error handling rules applied
                    errorHandlingRules: [
                        { step: 'POST', condition: 'HTTP error', action: 'Reject request' },
                        { step: 'Batch', condition: 'Status = Error', action: 'Raise exception' },
                        { step: 'Item', condition: 'Missing payment advice', action: 'Manual queue' },
                        { step: 'Clearing', condition: 'No cleared items', action: 'Mark as unapplied' }
                    ],
                    service: {
                        system: 'S4HANA On Premise',
                        apiPath: SAP_API_PATH,
                        clearingPath: SAP_CLEARING_PATH,
                        destination: SAP_DESTINATION_NAME,
                        sapClient: SAP_CLIENT,
                        companyCode: DEFAULT_COMPANY_CODE
                    },
                    timing: {
                        startedAt: startTime.toISOString(),
                        completedAt: null,
                        durationMs: 0
                    }
                };
                
                // ════════════════════════════════════════════════════════════════════
                // STEP 1: POST LockboxBatch (Trigger Backend Processing)
                // Purpose: Creates Lockbox batch, Customer determination, Invoice matching, Posts FI documents
                // Error Handling: HTTP error → Reject request
                // ════════════════════════════════════════════════════════════════════
                logStep('STEP1_START', 'INFO', 'POST LockboxBatch - Starting SAP backend processing');
                
                console.log('');
                console.log('┌──────────────────────────────────────────────────────────────────┐');
                console.log('│ STEP 1: POST LockboxBatch (Trigger SAP Backend Processing)      │');
                console.log('│ Error Rule: HTTP error → Reject request                          │');
                console.log('└──────────────────────────────────────────────────────────────────┘');
                console.log('API: POST', SAP_API_PATH);
                console.log('Payload:', JSON.stringify(sapPayload, null, 2));
                
                let step1Response;
                try {
                    step1Response = await postToSapApi(sapPayload);
                } catch (postError) {
                    // ERROR HANDLING RULE: HTTP error → Reject request
                    const errorMessage = postError.message || 'Unknown error';
                    const isDestinationError = errorMessage.includes('destination') || errorMessage.includes('Destination');
                    
                    // Capture SAP error details including XML response
                    const sapErrorDetails = postError.sapErrorDetails || {};
                    
                    logStep('STEP1_ERROR', 'ERROR', 'POST LockboxBatch failed - HTTP error', {
                        errorMessage: errorMessage,
                        httpStatus: sapErrorDetails.httpStatus || postError.response?.status || 'UNKNOWN',
                        errorData: sapErrorDetails.responseData || postError.response?.data || {},
                        errorXml: sapErrorDetails.responseXml || null,
                        action: 'REJECT_REQUEST',
                        isDestinationError: isDestinationError
                    });
                    
                    // Store error details in production result for UI display
                    productionResult.status = 'FAILED';
                    productionResult.error = {
                        step: 'STEP1_POST',
                        message: errorMessage,
                        httpStatus: sapErrorDetails.httpStatus || postError.response?.status,
                        sapErrorResponse: sapErrorDetails.responseData,
                        sapErrorXml: sapErrorDetails.responseXml,
                        rootCause: sapErrorDetails.rootCause,
                        payloadSent: sapPayload,
                        timestamp: new Date().toISOString()
                    };
                    productionResult.stepLogs = stepLogs;
                    
                    // Provide clear message for destination errors (local dev vs BTP)
                    if (isDestinationError) {
                        productionResult.error.note = 'SAP BTP Destination Service is only available when deployed to SAP BTP. Use useMock=true for local testing.';
                        throw new Error(`STEP 1 FAILED (HTTP Error - Reject Request): ${errorMessage}. NOTE: SAP BTP Destination Service is only available when deployed to SAP BTP. Use useMock=true for local testing.`);
                    }
                    
                    throw new Error(`STEP 1 FAILED (HTTP Error - Reject Request): ${errorMessage}`);
                }
                
                const step1Data = step1Response.data?.d || step1Response.data;
                
                // Capture response fields from STEP 1
                const lockboxBatchInternalKey = step1Data?.LockboxBatchInternalKey || '';
                const lockboxBatch = step1Data?.LockboxBatch || '001';
                const lockboxNumber = step1Data?.Lockbox || sapPayload?.Lockbox || '1234';
                
                logStep('STEP1_SUCCESS', 'SUCCESS', 'POST LockboxBatch completed', {
                    httpStatus: step1Response.status,
                    lockboxBatchInternalKey,
                    lockboxBatch,
                    lockboxNumber
                });
                
                console.log('✓ STEP 1 Response:');
                console.log('  - HTTP Status:', step1Response.status);
                console.log('  - LockboxBatchInternalKey:', lockboxBatchInternalKey);
                console.log('  - LockboxBatch:', lockboxBatch);
                console.log('  - Lockbox:', lockboxNumber);
                
                // Update Run ID with Lockbox-InternalKey format
                const displayLockboxId = `${lockboxNumber}-${lockboxBatchInternalKey}`;
                
                productionResult.steps.step1 = {
                    status: 'SUCCESS',
                    httpStatus: step1Response.status,
                    lockboxBatchInternalKey,
                    lockboxBatch,
                    lockboxNumber,
                    displayLockboxId,
                    errorHandling: { rule: 'HTTP error → Reject request', applied: false },
                    rawResponse: step1Data
                };
                
                productionResult.sapResponse = {
                    lockboxBatchInternalKey,
                    lockboxBatch,
                    lockboxNumber,
                    displayLockboxId,
                    postingDate: new Date().toISOString().split('T')[0],
                    itemsPosted: sapPayload?.to_Item?.results?.length || 0,
                    totalAmount: sapPayload?.AmountInTransactionCurrency,
                    currency: 'USD'
                };
                
                if (!lockboxBatchInternalKey) {
                    logStep('STEP1_ERROR', 'ERROR', 'LockboxBatchInternalKey not returned from SAP', {
                        action: 'REJECT_REQUEST'
                    });
                    throw new Error('STEP 1 FAILED: LockboxBatchInternalKey not returned from SAP');
                }
                
                // ════════════════════════════════════════════════════════════════════
                // STEP 2: GET LockboxBatch (Header Verification)
                // Purpose: Verify batch exists, Check processing status, Get accounting document
                // Error Handling: Batch Status = Error → Raise exception
                // ════════════════════════════════════════════════════════════════════
                logStep('STEP2_START', 'INFO', 'GET LockboxBatch - Verifying batch status');
                
                console.log('');
                console.log('┌──────────────────────────────────────────────────────────────────┐');
                console.log('│ STEP 2: GET LockboxBatch (Header Verification)                  │');
                console.log('│ Error Rule: Batch Status = Error → Raise exception               │');
                console.log('└──────────────────────────────────────────────────────────────────┘');
                console.log('API: GET /LockboxBatch(LockboxBatchInternalKey=\'' + lockboxBatchInternalKey + '\',LockboxBatch=\'' + lockboxBatch + '\')');
                
                // Wait 2 seconds for SAP to process
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                let step2Response, step2Data;
                try {
                    step2Response = await getLockboxBatchDetails(lockboxBatchInternalKey, lockboxBatch);
                    step2Data = step2Response.data?.d || step2Response.data;
                } catch (getError) {
                    logStep('STEP2_ERROR', 'ERROR', 'GET LockboxBatch failed', {
                        errorMessage: getError.message,
                        action: 'CONTINUE_WITH_WARNING'
                    });
                    step2Data = {};
                }
                
                console.log('✓ STEP 2 Response:');
                console.log('  - HTTP Status:', step2Response?.status || 'N/A');
                console.log('  - AccountingDocument:', step2Data?.AccountingDocument || '(pending)');
                console.log('  - Status:', step2Data?.Status || step2Data?.ProcessingStatus || 'OK');
                
                // ERROR HANDLING RULE: Batch Status = Error → Raise exception
                if (step2Data?.Status === 'Error' || step2Data?.ProcessingStatus === 'Error') {
                    logStep('STEP2_ERROR', 'ERROR', 'Batch Status = Error - Raising exception', {
                        batchStatus: step2Data?.Status || step2Data?.ProcessingStatus,
                        action: 'RAISE_EXCEPTION'
                    });
                    throw new Error('STEP 2 FAILED (Batch Status = Error - Raise Exception): SAP returned error status');
                }
                
                logStep('STEP2_SUCCESS', 'SUCCESS', 'GET LockboxBatch completed', {
                    httpStatus: step2Response?.status,
                    accountingDocument: step2Data?.AccountingDocument || '(pending)',
                    batchStatus: step2Data?.Status || step2Data?.ProcessingStatus || 'OK'
                });
                
                productionResult.steps.step2 = {
                    status: 'SUCCESS',
                    httpStatus: step2Response?.status || 200,
                    accountingDocument: step2Data?.AccountingDocument || '',
                    batchStatus: step2Data?.Status || step2Data?.ProcessingStatus || 'OK',
                    errorHandling: { rule: 'Batch Status = Error → Raise exception', applied: false },
                    rawResponse: step2Data
                };
                
                // Update sapResponse with accounting document if available
                if (step2Data?.AccountingDocument) {
                    productionResult.sapResponse.accountingDocument = step2Data.AccountingDocument;
                }
                
                // ════════════════════════════════════════════════════════════════════
                // STEP 3: GET LockboxBatchItem (Payment Line Details)
                // Purpose: Read individual payment/remittance lines, Get PaymentAdvice references
                // Error Handling: Missing payment advice → Manual queue
                // ════════════════════════════════════════════════════════════════════
                logStep('STEP3_START', 'INFO', 'GET LockboxBatchItem - Retrieving payment line details');
                
                console.log('');
                console.log('┌──────────────────────────────────────────────────────────────────┐');
                console.log('│ STEP 3: GET LockboxBatchItem (Payment Line Details)             │');
                console.log('│ Error Rule: Missing payment advice → Manual queue                │');
                console.log('└──────────────────────────────────────────────────────────────────┘');
                
                const batchItems = [];
                const manualQueueItems = [];
                const itemCount = sapPayload?.to_Item?.results?.length || 1;
                
                // Get customer numbers from payload items for GET LockboxClearing
                // PaymentAdviceAccount = Customer number (from uploaded file)
                const payloadItems = sapPayload?.to_Item?.results || [];
                
                for (let i = 1; i <= itemCount; i++) {
                    const itemNum = String(i);
                    const itemIdx = i - 1;
                    // Get customer from payload item (stored during payload build from file)
                    const payloadItem = payloadItems[itemIdx] || {};
                    const customerFromFile = payloadItem._customerForClearing || extractedRows[itemIdx]?.Customer || '';
                    
                    console.log(`API: GET /LockboxBatchItem(LockboxBatchInternalKey='${lockboxBatchInternalKey}',LockboxBatchItem='${itemNum}',LockboxBatch='${lockboxBatch}')`);
                    
                    try {
                        const step3Response = await getLockboxBatchItemDetails(lockboxBatchInternalKey, lockboxBatch, itemNum);
                        const step3Data = step3Response.data?.d || step3Response.data;
                        
                        // PaymentAdvice is GENERATED BY SAP - retrieved from this API response
                        // PaymentAdviceAccount = Customer (from uploaded file, NOT hardcoded)
                        // PaymentAdviceAccountType = "D" (CONSTANT)
                        // CompanyCode = "1710" (CONSTANT)
                        const itemInfo = {
                            item: itemNum,
                            // PaymentAdvice - GENERATED BY SAP (from API response)
                            paymentAdvice: step3Data?.PaymentAdvice || '',
                            paymentAdviceItem: step3Data?.PaymentAdviceItem || '1',
                            // PaymentAdviceAccount = Customer number FROM FILE
                            paymentAdviceAccount: step3Data?.PaymentAdviceAccount || customerFromFile,
                            // PaymentAdviceAccountType = "D" (CONSTANT)
                            paymentAdviceAccountType: 'D',
                            // CompanyCode = "1710" (CONSTANT)
                            companyCode: RUNTIME_COMPANY_CODE,
                            rawResponse: step3Data
                        };
                        
                        console.log(`✓ Item ${itemNum}:`);
                        console.log(`  - PaymentAdvice: ${itemInfo.paymentAdvice} (GENERATED BY SAP)`);
                        console.log(`  - PaymentAdviceAccount: ${itemInfo.paymentAdviceAccount} (Customer FROM FILE)`);
                        console.log(`  - PaymentAdviceAccountType: ${itemInfo.paymentAdviceAccountType} (CONSTANT)`);
                        console.log(`  - CompanyCode: ${itemInfo.companyCode} (CONSTANT)`);
                        
                        // ERROR HANDLING RULE: Missing payment advice → Manual queue
                        if (!itemInfo.paymentAdvice) {
                            logStep('STEP3_MANUAL_QUEUE', 'WARNING', `Item ${itemNum} missing payment advice - Adding to manual queue`, {
                                item: itemNum,
                                action: 'MANUAL_QUEUE'
                            });
                            manualQueueItems.push({
                                item: itemNum,
                                reason: 'Missing payment advice',
                                status: 'MANUAL_QUEUE'
                            });
                        }
                        
                        batchItems.push(itemInfo);
                    } catch (itemErr) {
                        console.log(`⚠ Item ${itemNum} fetch failed:`, itemErr.message);
                        logStep('STEP3_ITEM_ERROR', 'WARNING', `Item ${itemNum} fetch failed - Adding to manual queue`, {
                            item: itemNum,
                            error: itemErr.message,
                            action: 'MANUAL_QUEUE'
                        });
                        // Add to manual queue
                        batchItems.push({
                            item: itemNum,
                            error: itemErr.message,
                            status: 'MANUAL_QUEUE'
                        });
                        manualQueueItems.push({
                            item: itemNum,
                            reason: 'Fetch failed: ' + itemErr.message,
                            status: 'MANUAL_QUEUE'
                        });
                    }
                }
                
                logStep('STEP3_SUCCESS', 'SUCCESS', 'GET LockboxBatchItem completed', {
                    itemsProcessed: batchItems.length,
                    manualQueueCount: manualQueueItems.length
                });
                
                productionResult.steps.step3 = {
                    status: 'SUCCESS',
                    itemsProcessed: batchItems.length,
                    items: batchItems,
                    manualQueue: manualQueueItems,
                    errorHandling: { rule: 'Missing payment advice → Manual queue', appliedCount: manualQueueItems.length }
                };
                
                // Update sapResponse with PaymentAdvice from first item
                if (batchItems.length > 0 && batchItems[0].paymentAdvice) {
                    productionResult.sapResponse.paymentAdvice = batchItems[0].paymentAdvice;
                }
                
                // ════════════════════════════════════════════════════════════════════
                // STEP 4: GET LockboxClearing (Actual Clearing Result)
                // Purpose: Identify cleared invoices, residual/on-account postings, Get clearing documents
                // Error Handling: No cleared items → Mark as unapplied
                // 
                // API Parameters:
                //   PaymentAdvice = (from Step 3 - GENERATED BY SAP)
                //   PaymentAdviceItem = "1" (default)
                //   PaymentAdviceAccount = Customer number (FROM FILE)
                //   PaymentAdviceAccountType = "D" (CONSTANT)
                //   CompanyCode = "1710" (CONSTANT)
                // ════════════════════════════════════════════════════════════════════
                logStep('STEP4_START', 'INFO', 'GET LockboxClearing - Retrieving clearing results');
                
                console.log('');
                console.log('┌──────────────────────────────────────────────────────────────────┐');
                console.log('│ STEP 4: GET LockboxClearing (Clearing Result)                   │');
                console.log('│ Error Rule: No cleared items → Mark as unapplied                 │');
                console.log('├──────────────────────────────────────────────────────────────────┤');
                console.log('│ API Parameters:                                                  │');
                console.log('│   PaymentAdvice = (from Step 3 - GENERATED BY SAP)              │');
                console.log('│   PaymentAdviceAccount = Customer (FROM FILE)                   │');
                console.log('│   PaymentAdviceAccountType = "D" (CONSTANT)                     │');
                console.log('│   CompanyCode = "1710" (CONSTANT)                               │');
                console.log('└──────────────────────────────────────────────────────────────────┘');
                
                const clearingResults = [];
                const unappliedItems = [];
                
                for (const item of batchItems) {
                    if (item.paymentAdvice && !item.error) {
                        // Build the exact GET API call as per SAP spec
                        console.log(`API: GET /LockboxClearing(`);
                        console.log(`      PaymentAdvice='${item.paymentAdvice}',        // SAP Generated`);
                        console.log(`      PaymentAdviceItem='${item.paymentAdviceItem}',`);
                        console.log(`      PaymentAdviceAccount='${item.paymentAdviceAccount}',  // Customer FROM FILE`);
                        console.log(`      PaymentAdviceAccountType='${item.paymentAdviceAccountType}',           // CONSTANT = "D"`);
                        console.log(`      CompanyCode='${item.companyCode}'                     // CONSTANT = "1710"`);
                        console.log(`)`);
                        
                        try {
                            const step4Response = await getLockboxClearing({
                                paymentAdvice: item.paymentAdvice,          // SAP Generated
                                paymentAdviceItem: item.paymentAdviceItem,
                                paymentAdviceAccount: item.paymentAdviceAccount, // Customer FROM FILE
                                paymentAdviceAccountType: item.paymentAdviceAccountType, // "D" CONSTANT
                                companyCode: item.companyCode               // "1710" CONSTANT
                            });
                            
                            const step4Data = step4Response.data?.d || step4Response.data;
                            
                            const clearingInfo = {
                                paymentAdvice: item.paymentAdvice,
                                accountingDocument: step4Data?.AccountingDocument || '',
                                clearingDocument: step4Data?.ClearingDocument || '',
                                fiscalYear: step4Data?.FiscalYear || new Date().getFullYear().toString(),
                                companyCode: step4Data?.CompanyCode || DEFAULT_COMPANY_CODE,
                                netAmount: step4Data?.NetPaymentAmountInPaytCurrency || '',
                                currency: step4Data?.Currency || 'USD',
                                status: step4Data?.AccountingDocument ? 'CLEARED' : 'UNAPPLIED',
                                rawResponse: step4Data
                            };
                            
                            console.log(`✓ Clearing for PaymentAdvice ${item.paymentAdvice}:`);
                            console.log(`  - AccountingDocument: ${clearingInfo.accountingDocument || '(none)'}`);
                            console.log(`  - ClearingDocument: ${clearingInfo.clearingDocument || '(none)'}`);
                            
                            // ERROR HANDLING RULE: No cleared items → Mark as unapplied
                            if (clearingInfo.status === 'UNAPPLIED' || !clearingInfo.clearingDocument) {
                                logStep('STEP4_UNAPPLIED', 'WARNING', `PaymentAdvice ${item.paymentAdvice} has no clearing - Marking as unapplied`, {
                                    paymentAdvice: item.paymentAdvice,
                                    action: 'MARK_UNAPPLIED'
                                });
                                unappliedItems.push({
                                    paymentAdvice: item.paymentAdvice,
                                    reason: 'No clearing document',
                                    status: 'UNAPPLIED'
                                });
                            }
                            console.log(`  - Status: ${clearingInfo.status}`);
                            
                            clearingResults.push(clearingInfo);
                        } catch (clearErr) {
                            console.log(`⚠ Clearing fetch failed for PaymentAdvice ${item.paymentAdvice}:`, clearErr.message);
                            logStep('STEP4_ERROR', 'WARNING', `Clearing fetch failed for PaymentAdvice ${item.paymentAdvice}`, {
                                paymentAdvice: item.paymentAdvice,
                                error: clearErr.message,
                                action: 'MARK_UNAPPLIED'
                            });
                            clearingResults.push({
                                paymentAdvice: item.paymentAdvice,
                                status: 'UNAPPLIED',
                                error: clearErr.message
                            });
                            unappliedItems.push({
                                paymentAdvice: item.paymentAdvice,
                                reason: 'Clearing fetch failed: ' + clearErr.message,
                                status: 'UNAPPLIED'
                            });
                        }
                    }
                }
                
                logStep('STEP4_SUCCESS', 'SUCCESS', 'GET LockboxClearing completed', {
                    clearingItemsProcessed: clearingResults.length,
                    clearedCount: clearingResults.filter(c => c.status === 'CLEARED').length,
                    unappliedCount: unappliedItems.length
                });
                
                productionResult.steps.step4 = {
                    status: 'SUCCESS',
                    clearingItemsProcessed: clearingResults.length,
                    details: clearingResults,
                    unappliedItems: unappliedItems,
                    errorHandling: { rule: 'No cleared items → Mark as unapplied', appliedCount: unappliedItems.length }
                };
                
                // Update clearing info in production result
                const clearedItems = clearingResults.filter(c => c.status === 'CLEARED');
                productionResult.clearing = {
                    status: clearedItems.length > 0 ? 'CLEARED' : 'UNAPPLIED',
                    clearedItems: clearedItems.length,
                    totalItems: clearingResults.length,
                    unappliedCount: unappliedItems.length,
                    clearingDocument: clearedItems[0]?.clearingDocument || '',
                    accountingDocument: clearedItems[0]?.accountingDocument || '',
                    clearingDate: new Date().toISOString().split('T')[0],
                    details: clearingResults
                };
                
                // Update sapResponse with final values from clearing
                if (clearedItems.length > 0) {
                    if (clearedItems[0].accountingDocument) {
                        productionResult.sapResponse.accountingDocument = clearedItems[0].accountingDocument;
                    }
                    if (clearedItems[0].fiscalYear) {
                        productionResult.sapResponse.fiscalYear = clearedItems[0].fiscalYear;
                    }
                    if (clearedItems[0].companyCode) {
                        productionResult.sapResponse.companyCode = clearedItems[0].companyCode;
                    }
                }
                
                // Add paymentAdvice from first batch item
                if (batchItems.length > 0 && batchItems[0].paymentAdvice) {
                    productionResult.sapResponse.paymentAdvice = batchItems[0].paymentAdvice;
                }
                
                // ════════════════════════════════════════════════════════════════════
                // FINAL: Update Production Result Status
                // ════════════════════════════════════════════════════════════════════
                logStep('FINAL', 'SUCCESS', 'Production run completed', {
                    lockboxBatchInternalKey,
                    displayLockboxId,
                    itemsPosted: sapPayload?.to_Item?.results?.length || 0,
                    clearedItems: clearedItems.length,
                    unappliedItems: unappliedItems.length,
                    manualQueueItems: manualQueueItems.length
                });
                
                console.log('');
                console.log('┌──────────────────────────────────────────────────────────────────┐');
                console.log('│ FINAL: Production Run Complete                                   │');
                console.log('└──────────────────────────────────────────────────────────────────┘');
                console.log('✓ Lockbox:', displayLockboxId);
                console.log('✓ LockboxBatchInternalKey:', lockboxBatchInternalKey);
                console.log('✓ PaymentAdvice:', productionResult.sapResponse.paymentAdvice || '(pending)');
                console.log('✓ AccountingDocument:', productionResult.sapResponse.accountingDocument || '(pending)');
                console.log('✓ ClearingDocument:', productionResult.clearing.clearingDocument || '(pending)');
                console.log('✓ Status:', productionResult.clearing.status);
                console.log('');
                
                productionResult.status = 'POSTED';
                productionResult.timing.completedAt = new Date().toISOString();
                productionResult.timing.durationMs = Date.now() - startTime.getTime();
                
            } catch (sapError) {
                console.error('SAP API Error:', sapError.message);
                console.error('SAP Error Details:', sapError.response?.data || sapError);
                
                // Preserve detailed error info if already captured (from step errors)
                const existingError = productionResult?.error || {};
                
                productionResult = {
                    status: 'ERROR',
                    mode: 'LIVE',
                    error: {
                        message: sapError.message,
                        code: sapError.response?.status || existingError.httpStatus || 'UNKNOWN',
                        step: existingError.step || 'UNKNOWN',
                        details: sapError.response?.data || sapError.cause || {},
                        // Include XML error response if captured
                        sapErrorXml: existingError.sapErrorXml || sapError.sapErrorDetails?.responseXml || null,
                        sapErrorResponse: existingError.sapErrorResponse || sapError.sapErrorDetails?.responseData || sapError.response?.data || null,
                        // Include the payload that was sent
                        payloadSent: existingError.payloadSent || sapPayload || null,
                        timestamp: existingError.timestamp || new Date().toISOString()
                    },
                    stepLogs: stepLogs,
                    service: {
                        system: 'S4HANA On Premise',
                        apiPath: SAP_API_PATH,
                        clearingPath: SAP_CLEARING_PATH,
                        destination: SAP_DESTINATION_NAME,
                        sapClient: SAP_CLIENT,
                        companyCode: DEFAULT_COMPANY_CODE
                    },
                    timing: {
                        startedAt: startTime.toISOString(),
                        completedAt: new Date().toISOString(),
                        durationMs: Date.now() - startTime.getTime()
                    }
                };
                
                run.productionResult = productionResult;
                run.overallStatus = 'error';
                return res.json({ success: false, productionResult, run, error: sapError.message });
            }
        }
        
        // Update run with production result
        run.productionResult = productionResult;
        run.overallStatus = 'posted';
        run.completedAt = new Date().toISOString();
        
        // Update hierarchy with SAP document info
        // Format: Lockbox number - Internal Key (e.g., "1234-00001234")
        if (run.hierarchy && run.hierarchy[0]) {
            run.hierarchy[0].status = 'POSTED';
            // Update lockbox display to show Lockbox-InternalKey format
            run.hierarchy[0].lockbox = productionResult.sapResponse?.displayLockboxId || 
                                       `${productionResult.sapResponse?.lockboxNumber || '1234'}-${productionResult.sapResponse?.lockboxBatchInternalKey || ''}`;
            run.hierarchy[0].arPostingDoc = productionResult.clearing?.accountingDocument || 
                                            productionResult.sapResponse?.accountingDocument || '';
            run.hierarchy[0].paymentAdvice = productionResult.sapResponse?.paymentAdvice || '';
            run.hierarchy[0].clearingDocument = productionResult.clearing?.clearingDocument || '';
            run.hierarchy[0].postingDate = productionResult.sapResponse?.postingDate;
            run.hierarchy[0].lockboxBatchInternalKey = productionResult.sapResponse?.lockboxBatchInternalKey || '';
        }
        
        // Save updated run to database
        await saveProcessingRun(run);
        
        res.json({ success: true, production: productionResult, run });
        
    } catch (err) {
        console.error('Production run error:', err);
        run.productionResult = { status: 'ERROR', error: err.message };
        run.overallStatus = 'error';
        
        // Save failed run to database
        await saveProcessingRun(run);
        
        res.status(500).json({ success: false, error: err.message, run });
    }
});

// ================================================================================
// BATCH TEMPLATES API ENDPOINTS
// ================================================================================

// GET all batch templates
app.get('/api/batch-templates', (req, res) => {
    res.json(batchTemplates);
});

// GET single batch template
app.get('/api/batch-templates/:templateId', (req, res) => {
    const template = batchTemplates.find(t => t.templateId === req.params.templateId);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
});

// DELETE batch template
app.delete('/api/batch-templates/:templateId', (req, res) => {
    const index = batchTemplates.findIndex(t => t.templateId === req.params.templateId);
    if (index === -1) return res.status(404).json({ error: 'Template not found' });
    
    const deleted = batchTemplates.splice(index, 1)[0];
    saveTemplatesToFile();
    res.json({ success: true, deleted: deleted.templateId });
});

// Serve index.html for HTML navigation routes only (SPA fallback)
// Do NOT intercept static asset requests (.js, .css, .json, .xml, etc.)
app.get('*', (req, res, next) => {
    // Skip if it's a static asset request
    const staticExtensions = ['.js', '.css', '.json', '.xml', '.html', '.png', '.jpg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.map'];
    const hasExtension = staticExtensions.some(ext => req.path.endsWith(ext));
    
    if (hasExtension) {
        // Let express.static handle it or return 404
        return next();
    }
    
    // For navigation routes, serve index.html
    res.sendFile(path.join(__dirname, 'app', 'index.html'));
});

// Initialize data and start server
async function initializeAndStart() {
    console.log('=== Initializing Lockbox Application ===');
    
    // Load data BEFORE starting the server

    await initTables();
    await initRunIdCounter();
    await loadProcessingRuns();
    await loadPatternsFromDb();
    await loadServicesFromDb();
    loadTemplatesFromFile();
    loadRefDocRulesFromFile(); // Load Reference Document Rules
    await loadProcessingRulesFromDb(); // Load Processing Rules from PostgreSQL
    loadApiFieldsFromFile(); // Load API Fields with saved default values
    
    console.log('');
    console.log('=== Data Loading Complete ===');
    console.log('Processing Runs:', lockboxProcessingRuns.length);
    console.log('File Patterns:', filePatterns.length);
    console.log('OData Services:', odataServices.length);
    console.log('Batch Templates:', batchTemplates.length);
    console.log('Reference Doc Rules:', referenceDocRules.length);
    console.log('Selected Reference Doc Rule:', selectedReferenceDocRule);
    console.log('Processing Rules:', processingRules.length);
    console.log('API Fields:', apiFields.length);
    
    // Log constant values
    const constants = getConstantFieldValues();
    console.log('Constant Values:', JSON.stringify({ 
        Lockbox: constants.Lockbox, 
        LockboxBatchOrigin: constants.LockboxBatchOrigin,
        LockboxBatchDestination: constants.LockboxBatchDestination 
    }));
    console.log('');
    
    // Now start the server
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Lockbox backend running on port ${PORT}`);
    });
}

// Start the application
initializeAndStart().catch(err => {
    console.error('Failed to initialize application:', err);
    process.exit(1);
});
