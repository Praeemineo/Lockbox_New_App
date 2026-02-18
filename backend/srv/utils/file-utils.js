/**
 * File Utilities
 * Helper functions for file operations
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Read JSON file with error handling
 */
async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        logger.error(`Error reading JSON file ${filePath}:`, error);
        throw error;
    }
}

/**
 * Write JSON file with error handling
 */
async function writeJsonFile(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        logger.info(`Successfully wrote to ${filePath}`);
    } catch (error) {
        logger.error(`Error writing JSON file ${filePath}:`, error);
        throw error;
    }
}

/**
 * Check if file exists
 */
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get data directory path
 */
function getDataPath(filename) {
    return path.join(__dirname, '../../data', filename);
}

module.exports = {
    readJsonFile,
    writeJsonFile,
    fileExists,
    getDataPath
};
