/**
 * Data Models Module
 * Centralized access to file patterns, processing rules, and API fields
 * 
 * ⚠️ NEW CODE LOCATION: All data loading logic goes HERE, not in server.js
 */

const { readJsonFile, writeJsonFile, getDataPath } = require('../utils/file-utils');
const logger = require('../utils/logger');

// In-memory cache
let filePatterns = [];
let processingRules = [];
let apiFields = [];

/**
 * Load File Patterns from JSON
 */
async function loadFilePatterns() {
    try {
        const filePath = getDataPath('file_patterns.json');
        filePatterns = await readJsonFile(filePath);
        logger.info(`Loaded ${filePatterns.length} file patterns`);
        return filePatterns;
    } catch (error) {
        logger.error('Error loading file patterns:', error);
        filePatterns = [];
        return [];
    }
}

/**
 * Load Processing Rules from JSON
 */
async function loadProcessingRules() {
    try {
        const filePath = getDataPath('processing_rules.json');
        processingRules = await readJsonFile(filePath);
        logger.info(`Loaded ${processingRules.length} processing rules`);
        return processingRules;
    } catch (error) {
        logger.error('Error loading processing rules:', error);
        processingRules = [];
        return [];
    }
}

/**
 * Load API Fields from JSON
 */
async function loadApiFields() {
    try {
        const filePath = getDataPath('api_fields.json');
        apiFields = await readJsonFile(filePath);
        logger.info(`Loaded ${apiFields.length} API fields`);
        return apiFields;
    } catch (error) {
        logger.error('Error loading API fields:', error);
        apiFields = [];
        return [];
    }
}

/**
 * Get all file patterns (from cache)
 */
function getFilePatterns() {
    return filePatterns;
}

/**
 * Get single file pattern by ID
 */
function getFilePatternById(patternId) {
    return filePatterns.find(p => p.patternId === patternId);
}

/**
 * Get active file patterns
 */
function getActiveFilePatterns() {
    return filePatterns.filter(p => p.active);
}

/**
 * Save file pattern (update or create)
 */
async function saveFilePattern(pattern) {
    const index = filePatterns.findIndex(p => p.patternId === pattern.patternId);
    
    if (index >= 0) {
        filePatterns[index] = pattern;
    } else {
        filePatterns.push(pattern);
    }
    
    const filePath = getDataPath('file_patterns.json');
    await writeJsonFile(filePath, filePatterns);
    logger.info(`Saved pattern: ${pattern.patternId}`);
    
    return pattern;
}

/**
 * Delete file pattern
 */
async function deleteFilePattern(patternId) {
    filePatterns = filePatterns.filter(p => p.patternId !== patternId);
    const filePath = getDataPath('file_patterns.json');
    await writeJsonFile(filePath, filePatterns);
    logger.info(`Deleted pattern: ${patternId}`);
}

/**
 * Get all processing rules (from cache)
 */
function getProcessingRules() {
    return processingRules;
}

/**
 * Get active processing rules
 */
function getActiveProcessingRules() {
    return processingRules.filter(r => r.active);
}

/**
 * Get single processing rule by ID
 */
function getProcessingRuleById(ruleId) {
    return processingRules.find(r => r.ruleId === ruleId);
}

/**
 * Save processing rule (update or create)
 */
async function saveProcessingRule(rule) {
    const index = processingRules.findIndex(r => r.ruleId === rule.ruleId);
    
    if (index >= 0) {
        processingRules[index] = rule;
    } else {
        processingRules.push(rule);
    }
    
    const filePath = getDataPath('processing_rules.json');
    await writeJsonFile(filePath, processingRules);
    logger.info(`Saved rule: ${rule.ruleId}`);
    
    return rule;
}

/**
 * Delete processing rule
 */
async function deleteProcessingRule(ruleId) {
    processingRules = processingRules.filter(r => r.ruleId !== ruleId);
    const filePath = getDataPath('processing_rules.json');
    await writeJsonFile(filePath, processingRules);
    logger.info(`Deleted rule: ${ruleId}`);
}

/**
 * Get all API fields (from cache)
 */
function getApiFields() {
    return apiFields;
}

/**
 * Get API field by name
 */
function getApiFieldByName(fieldName) {
    return apiFields.find(f => f.fieldName === fieldName);
}

/**
 * Initialize all data models
 */
async function initializeDataModels() {
    logger.info('=== Initializing Data Models ===');
    await Promise.all([
        loadFilePatterns(),
        loadProcessingRules(),
        loadApiFields()
    ]);
    logger.info('=== Data Models Loaded Successfully ===');
}

module.exports = {
    // Initialization
    initializeDataModels,
    
    // File Patterns
    loadFilePatterns,
    getFilePatterns,
    getFilePatternById,
    getActiveFilePatterns,
    saveFilePattern,
    deleteFilePattern,
    
    // Processing Rules
    loadProcessingRules,
    getProcessingRules,
    getActiveProcessingRules,
    getProcessingRuleById,
    saveProcessingRule,
    deleteProcessingRule,
    
    // API Fields
    loadApiFields,
    getApiFields,
    getApiFieldByName
};
