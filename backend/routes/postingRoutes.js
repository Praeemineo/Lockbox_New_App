/**
 * Posting Routes
 * SAP posting operations (simulate, post, production)
 */

const express = require('express');
const router = express.Router();
const postingService = require('../services/postingService');

/**
 * POST /api/posting/simulate/:headerId
 * Simulate posting - Preview only, no SAP commit
 */
router.post('/simulate/:headerId', postingService.simulatePosting);

/**
 * POST /api/posting/post/:headerId
 * Production posting - Actually commit to SAP
 */
router.post('/post/:headerId', postingService.productionPosting);

/**
 * POST /api/posting/runs/:runId/simulate
 * Simulate posting for a specific run
 */
router.post('/runs/:runId/simulate', postingService.simulateRun);

/**
 * POST /api/posting/runs/:runId/repost
 * Repost a run to SAP
 */
router.post('/runs/:runId/repost', postingService.repostRun);

/**
 * POST /api/posting/runs/:runId/production
 * Production run posting
 */
router.post('/runs/:runId/production', postingService.productionRun);

/**
 * GET /api/posting/runs/:runId/result
 * Get production result for a run
 */
router.get('/runs/:runId/result', postingService.getProductionResult);

module.exports = router;
