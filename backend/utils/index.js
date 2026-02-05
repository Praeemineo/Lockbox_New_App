/**
 * Utils Index
 * Exports all utility functions
 */

const { extractSapODataError } = require('./sapErrorExtractor');
const { loadFilePatterns, saveFilePatterns } = require('./filePatterns');

module.exports = {
    extractSapODataError,
    loadFilePatterns,
    saveFilePatterns
};
