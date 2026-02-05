/**
 * SAP Routes
 * SAP diagnostic and testing endpoints
 */

const express = require('express');
const router = express.Router();
const sapService = require('../services/sapService');

/**
 * GET /api/sap/service-document
 * Get SAP OData service document
 */
router.get('/service-document', sapService.getServiceDocument);

/**
 * GET /api/sap/metadata
 * Get SAP OData metadata
 */
router.get('/metadata', sapService.getMetadata);

/**
 * GET /api/sap/diagnostics
 * Run SAP connection diagnostics
 */
router.get('/diagnostics', sapService.runDiagnostics);

module.exports = router;
