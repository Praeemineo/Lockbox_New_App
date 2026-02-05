/**
 * Error Handler Middleware
 * Centralized error handling for all routes
 */

function errorHandler(err, req, res, next) {
    console.error('Error:', err);
    
    // SAP-specific errors
    if (err.sapErrorDetails) {
        return res.status(err.sapErrorDetails.httpStatus || 500).json({
            success: false,
            error: err.message,
            sapError: err.sapErrorDetails
        });
    }
    
    // Database errors
    if (err.code && err.code.startsWith('P')) {
        return res.status(500).json({
            success: false,
            error: 'Database error',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
    
    // Generic errors
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
}

module.exports = errorHandler;
