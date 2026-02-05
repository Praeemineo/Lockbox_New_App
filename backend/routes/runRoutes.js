/**
 * Run Routes
 * Production run management and execution endpoints
 */

const express = require('express');
const router = express.Router();
const runService = require('../services/runService');

/**
 * GET /api/runs
 * Get all processing runs
 */
router.get('/', runService.getAllRuns);

/**
 * GET /api/run/:runId
 * Get a specific run by ID
 */
router.get('/:runId', runService.getRunById);

module.exports = router;
