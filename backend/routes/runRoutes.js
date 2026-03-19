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

/**
 * GET /api/lockbox/run/:runId/accounting-document
 * RULE-004: Get accounting document details from SAP (pass-through)
 */
router.get('/:runId/accounting-document', runService.getAccountingDocument);

module.exports = router;
