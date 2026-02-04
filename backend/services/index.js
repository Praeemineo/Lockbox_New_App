/**
 * Services Index
 * Exports all service modules
 */

const sapService = require('./sapService');
const postgresService = require('./postgresService');

module.exports = {
    ...sapService,
    ...postgresService
};
