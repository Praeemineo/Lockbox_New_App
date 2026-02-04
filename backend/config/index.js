/**
 * Configuration
 * All environment variables and constants
 */

module.exports = {
    // Server Configuration
    PORT: process.env.PORT || 8001,
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Database Configuration
    DB_CONFIG: {
        HOST: process.env.DB_HOST || 'localhost',
        PORT: process.env.DB_PORT || 5432,
        NAME: process.env.DB_NAME || 'lockbox',
        USER: process.env.DB_USER || 'postgres',
        PASSWORD: process.env.DB_PASSWORD || 'postgres',
        SSL: process.env.DB_SSL === 'true'
    },
    
    // SAP Configuration
    SAP_CONFIG: {
        API_PATH: '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch',
        CLEARING_PATH: '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxClearing',
        BP_API_PATH: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartnerBank',
        DESTINATION_NAME: 'S4HANA_SYSTEM_DESTINATION',
        CLIENT: process.env.SAP_CLIENT || '100',
        COMPANY_CODE: '1710'
    },
    
    // File Upload Configuration
    UPLOAD_CONFIG: {
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_EXTENSIONS: ['.xlsx', '.xls'],
        UPLOAD_DIR: './uploads'
    },
    
    // Paths
    PATHS: {
        DATA_DIR: './data',
        UPLOADS_DIR: './uploads',
        APP_DIR: './app'
    }
};
