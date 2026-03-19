/**
 * Lockbox Server - Entry Point
 * Minimal server.js with all logic modularized
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Configuration
const { PORT, PATHS } = require('./config');

// Services (database initialization)
const { initDatabase } = require('./services/postgresService');

// Middleware
const { requestLogger, errorHandler } = require('./middleware');

// Initialize Express
const app = express();

// Apply middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Serve static SAPUI5 files
app.use(express.static(path.join(__dirname, PATHS.APP_DIR), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    },
    index: false
}));

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, PATHS.APP_DIR, 'index.html'));
});

// API Routes
// NOTE: Import all route modules from original server.js
// This requires extracting routes to separate files
// For now, keeping original server.js routes inline until fully extracted

// Import and use the large route handler from original server.js temporarily
const originalRoutes = require('./server.original');
app.use('/api', originalRoutes);

// Error handling (must be last)
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
    try {
        await initDatabase();
        console.log('✓ Database initialized');
        
        app.listen(PORT, () => {
            console.log(`✓ Server running on port ${PORT}`);
            console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('✗ Server startup failed:', error);
        process.exit(1);
    }
}

startServer();
