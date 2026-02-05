/**
 * Template Routes
 * Batch template management endpoints
 */

const express = require('express');
const router = express.Router();
const templateService = require('../services/templateService');

/**
 * GET /api/batch-templates
 * Get all batch templates
 */
router.get('/', templateService.getAllTemplates);

/**
 * GET /api/batch-templates/:templateId
 * Get specific template
 */
router.get('/:templateId', templateService.getTemplateById);

/**
 * DELETE /api/batch-templates/:templateId
 * Delete a template
 */
router.delete('/:templateId', templateService.deleteTemplate);

module.exports = router;
