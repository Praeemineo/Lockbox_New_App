/**
 * Health Routes
 * System health check endpoints
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'lockbox-srv',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
