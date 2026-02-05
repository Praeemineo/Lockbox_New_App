/**
 * Job Service
 * Business logic for job management
 */

const { getPool } = require('./postgresService');

/**
 * Get all jobs
 * TODO: Extract full logic from server.js
 */
async function getAllJobs(req, res) {
    res.status(501).json({ message: 'Implementation pending' });
}

module.exports = {
    getAllJobs
};
