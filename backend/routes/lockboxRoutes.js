/**
 * Lockbox Routes
 * Main lockbox upload, processing, and management endpoints
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Import services (will be populated)
const lockboxService = require('../services/lockboxService');

/**
 * GET /api/lockbox/headers
 * Get all lockbox headers
 */
router.get('/headers', lockboxService.getLockboxHeaders);

/**
 * GET /api/lockbox/template
 * Download Excel template
 */
router.get('/template', lockboxService.downloadTemplate);

/**
 * POST /api/lockbox/upload
 * Upload and parse Excel file
 */
router.post('/upload', upload.single('file'), lockboxService.uploadFile);

/**
 * GET /api/lockbox/hierarchy/:headerId
 * Get lockbox hierarchy (header + items)
 */
router.get('/hierarchy/:headerId', lockboxService.getHierarchy);

/**
 * DELETE /api/lockbox/headers/:id
 * Delete a lockbox header and its items
 */
router.delete('/headers/:id', lockboxService.deleteHeader);

/**
 * GET /api/lockbox/preview-payload/:headerId
 * Preview SAP payload for a header
 */
router.get('/preview-payload/:headerId', lockboxService.previewPayload);

/**
 * POST /api/lockbox/simulate/:headerId
 * Simulate SAP posting
 */
router.post('/simulate/:headerId', lockboxService.simulatePost);

/**
 * POST /api/lockbox/post/:headerId
 * Post to SAP
 */
router.post('/post/:headerId', lockboxService.postToSap);

/**
 * POST /api/lockbox/process
 * Process uploaded file with mapping rules
 */
router.post('/process', upload.single('file'), lockboxService.processFile);

/**
 * GET /api/lockbox/:lockboxId/runs
 * Get runs for a specific lockbox
 */
router.get('/:lockboxId/runs', lockboxService.getLockboxRuns);

module.exports = router;
