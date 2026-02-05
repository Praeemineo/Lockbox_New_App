/**
 * Middleware Index
 * Exports all middleware functions
 */

const errorHandler = require('./errorHandler');
const requestLogger = require('./requestLogger');

module.exports = {
    errorHandler,
    requestLogger
};
