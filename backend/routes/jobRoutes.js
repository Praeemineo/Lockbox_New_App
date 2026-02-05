/**
 * Job Routes
 * Job management endpoints
 */

const express = require('express');
const router = express.Router();
const jobService = require('../services/jobService');

/**
 * GET /api/jobs
 * Get all jobs
 */
router.get('/', jobService.getAllJobs);

module.exports = router;
