/**
 * Database Module Index
 * Exports all database-related functions for easy importing
 */

const { 
    initDatabase, 
    initTables, 
    getPool, 
    isDatabaseAvailable, 
    setDatabaseAvailable,
    query 
} = require('./postgresService');

module.exports = {
    initDatabase,
    initTables,
    getPool,
    isDatabaseAvailable,
    setDatabaseAvailable,
    query
};
