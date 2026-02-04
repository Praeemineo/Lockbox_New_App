/**
 * SAP Module Index
 * Exports all SAP-related functions for easy importing
 */

// Core SAP service and configuration
const { SAP_CONFIG, logSapConfig, executeSapRequest, executeHttpRequest } = require('./sapService');

// SAP GET operations
const { 
    getLockboxBatchDetails, 
    getLockboxBatchItemDetails, 
    getLockboxClearing, 
    getLockboxClearingXml 
} = require('./getSap');

// SAP POST operations
const { postToSapApi, buildLockboxPayload } = require('./postSap');

// SAP UPDATE operations (placeholder)
const { updateLockboxBatch, updateLockboxBatchItem } = require('./updateSap');

// SAP DELETE operations (placeholder)
const { deleteLockboxBatch, deleteLockboxBatchItem, reverseLockboxBatch } = require('./deleteSap');

module.exports = {
    // Configuration
    SAP_CONFIG,
    logSapConfig,
    
    // Core request function
    executeSapRequest,
    executeHttpRequest,
    
    // GET operations
    getLockboxBatchDetails,
    getLockboxBatchItemDetails,
    getLockboxClearing,
    getLockboxClearingXml,
    
    // POST operations
    postToSapApi,
    buildLockboxPayload,
    
    // UPDATE operations
    updateLockboxBatch,
    updateLockboxBatchItem,
    
    // DELETE operations
    deleteLockboxBatch,
    deleteLockboxBatchItem,
    reverseLockboxBatch
};
