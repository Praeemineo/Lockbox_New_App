/**
 * Field Mapping Routes
 * Configuration endpoints for field mapping rules and patterns
 */

const express = require('express');
const router = express.Router();
const fieldMappingService = require('../services/fieldMappingService');

// Templates
router.get('/templates', fieldMappingService.getTemplates);
router.post('/templates', fieldMappingService.createTemplate);
router.delete('/templates/:templateId', fieldMappingService.deleteTemplate);

// Patterns
router.get('/patterns', fieldMappingService.getPatterns);
router.get('/patterns/:patternId', fieldMappingService.getPatternById);
router.post('/patterns', fieldMappingService.createPattern);
router.put('/patterns/:patternId', fieldMappingService.updatePattern);
router.delete('/patterns/:patternId', fieldMappingService.deletePattern);
router.patch('/patterns/:patternId/toggle', fieldMappingService.togglePattern);
router.post('/patterns/:patternId/copy', fieldMappingService.copyPattern);

// Pattern metadata
router.get('/pattern-types', fieldMappingService.getPatternTypes);
router.get('/pattern-categories', fieldMappingService.getPatternCategories);
router.get('/delimiters', fieldMappingService.getDelimiters);

// Rules
router.get('/rules', fieldMappingService.getRules);
router.post('/rules', fieldMappingService.createRule);
router.put('/rules/:ruleId', fieldMappingService.updateRule);
router.delete('/rules/:ruleId', fieldMappingService.deleteRule);

// Reference document rules
router.get('/ref-doc-rules', fieldMappingService.getRefDocRules);
router.put('/ref-doc-rules/:ruleId/select', fieldMappingService.selectRefDocRule);
router.get('/reference-doc-rules', fieldMappingService.getReferenceDocRules);
router.get('/reference-doc-rules/:ruleId', fieldMappingService.getReferenceDocRuleById);
router.post('/reference-doc-rules', fieldMappingService.createReferenceDocRule);
router.put('/reference-doc-rules/:ruleId', fieldMappingService.updateReferenceDocRule);
router.delete('/reference-doc-rules/:ruleId', fieldMappingService.deleteReferenceDocRule);
router.post('/reference-doc-rules/:ruleId/select', fieldMappingService.selectReferenceDocRule);
router.patch('/reference-doc-rules/:ruleId/toggle', fieldMappingService.toggleReferenceDocRule);

// API Fields
router.get('/api-fields', fieldMappingService.getApiFields);
router.post('/api-fields', fieldMappingService.createApiField);
router.put('/api-fields/:fieldId', fieldMappingService.updateApiField);
router.delete('/api-fields/:fieldId', fieldMappingService.deleteApiField);

// Constants
router.get('/constants', fieldMappingService.getConstants);

// OData Services
router.get('/odata-services', fieldMappingService.getODataServices);
router.post('/odata-services', fieldMappingService.createODataService);
router.put('/odata-services/:serviceId', fieldMappingService.updateODataService);
router.delete('/odata-services/:serviceId', fieldMappingService.deleteODataService);
router.patch('/odata-services/:serviceId/toggle', fieldMappingService.toggleODataService);

module.exports = router;
