/**
 * Run Service
 * Business logic for run management
 */

const { getPool } = require('./postgresService');

/**
 * Get all processing runs
 * TODO: Extract full logic from server.js
 */
async function getAllRuns(req, res) {
    res.status(501).json({ message: 'Implementation pending - being migrated from server.js' });
}

/**
 * Get run by ID
 * TODO: Extract full logic from server.js
 */
async function getRunById(req, res) {
    res.status(501).json({ message: 'Implementation pending - being migrated from server.js' });
}

module.exports = {
    getAllRuns,
    getRunById
};
