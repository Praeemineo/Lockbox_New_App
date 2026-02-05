/**
 * Lockbox Run Routes
 * Specific run operations for lockbox processing
 */

const express = require('express');
const router = express.Router();
const lockboxRunService = require('../services/lockboxRunService');

/**
 * GET /api/lockbox/runs
 * Get all lockbox runs
 */
router.get('/', lockboxRunService.getAllRuns);

/**
 * GET /api/lockbox/runs/:runId
 * Get specific run details
 */
router.get('/:runId', lockboxRunService.getRunDetails);

/**
 * GET /api/lockbox/runs/:runId/production-result
 * Get production result for a run
 */
router.get('/:runId/production-result', lockboxRunService.getProductionResult);

/**
 * GET /api/lockbox/runs/:runId/hierarchy
 * Get run hierarchy
 */
router.get('/:runId/hierarchy', lockboxRunService.getRunHierarchy);

/**
 * GET /api/lockbox/runs/:runId/download
 * Download run data
 */
router.get('/:runId/download', lockboxRunService.downloadRun);

/**
 * POST /api/lockbox/runs/:runId/reprocess
 * Reprocess a run
 */
router.post('/:runId/reprocess', lockboxRunService.reprocessRun);

/**
 * POST /api/lockbox/runs/:runId/simulate
 * Simulate production for a run
 */
router.post('/:runId/simulate', lockboxRunService.simulateProduction);

/**
 * POST /api/lockbox/runs/:runId/repost
 * Repost a run to SAP
 */
router.post('/:runId/repost', lockboxRunService.repostRun);

/**
 * POST /api/lockbox/runs/:runId/production
 * Execute production posting to SAP
 */
router.post('/:runId/production', lockboxRunService.executeProduction);

module.exports = router;
