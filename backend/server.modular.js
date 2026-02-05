/**
 * SAP Lockbox Application - Backend Server
 * Modular Architecture Entry Point
 * 
 * This is a minimal entry point that:
 * - Initializes Express app
 * - Configures middleware
 * - Mounts all route modules
 * - Starts the server
 * 
 * All business logic is in /services
 * All route handlers are in /routes
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import configuration
const config = require('./config');

// Import middleware
const { requestLogger, errorHandler } = require('./middleware');

// Import database service
const { initializeDatabase, getPool } = require('./services/postgresService');

// Import all routes
const routes = require('./routes');

// ============================================================================
// EXPRESS APP INITIALIZATION
// ============================================================================

const app = express();
const PORT = config.PORT;

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// CORS Configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
}));

// Body Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request Logging
app.use(requestLogger);

// Static Files
app.use('/app', express.static(path.join(__dirname, 'app')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================================
// ROUTES
// ============================================================================

// Mount all API routes
app.use(routes);

// Serve frontend (for production)
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'app', 'index.html'));
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use(errorHandler);

// ============================================================================
// DATABASE & SERVER STARTUP
// ============================================================================

async function startServer() {
    try {
        // Initialize database
        console.log('Initializing database connection...');
        await initializeDatabase();
        console.log('✅ Database connection established');
        
        // Start server
        app.listen(PORT, '0.0.0.0', () => {
            console.log('');
            console.log('========================================');
            console.log('SAP Lockbox Application - Backend Server');
            console.log('========================================');
            console.log(`🚀 Server running on: http://0.0.0.0:${PORT}`);
            console.log(`📊 Environment: ${config.NODE_ENV}`);
            console.log(`🗄️  Database: ${config.DB_CONFIG.HOST}:${config.DB_CONFIG.PORT}`);
            console.log(`🔗 SAP Destination: ${config.SAP_CONFIG.DESTINATION_NAME}`);
            console.log(`📁 Upload Directory: ${config.UPLOAD_CONFIG.UPLOAD_DIR}`);
            console.log('========================================');
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing server gracefully...');
    const pool = getPool();
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, closing server gracefully...');
    const pool = getPool();
    await pool.end();
    process.exit(0);
});

// Start the server
startServer();
