/**
 * Routes Index
 * Central router that combines all route modules
 */

const express = require('express');
const router = express.Router();

// Import all route modules
const healthRoutes = require('./healthRoutes');
const lockboxRoutes = require('./lockboxRoutes');
const runRoutes = require('./runRoutes');
const lockboxRunRoutes = require('./lockboxRunRoutes');
const fieldMappingRoutes = require('./fieldMappingRoutes');
const sapRoutes = require('./sapRoutes');
const templateRoutes = require('./templateRoutes');
const jobRoutes = require('./jobRoutes');

// Mount routes
router.use('/api', healthRoutes);
router.use('/api/lockbox', lockboxRoutes);
router.use('/api/runs', runRoutes);
router.use('/api/run', runRoutes);  // Alternative path
router.use('/api/lockbox/runs', lockboxRunRoutes);
router.use('/api/field-mapping', fieldMappingRoutes);
router.use('/api/sap', sapRoutes);
router.use('/api/batch-templates', templateRoutes);
router.use('/api/jobs', jobRoutes);

module.exports = router;
