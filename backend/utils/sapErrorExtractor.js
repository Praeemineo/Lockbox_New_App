/**
 * SAP OData Error Extractor
 * Extracts structured error information from SAP API errors
 */

function extractSapODataError(error) {
    const structuredError = {
        errorType: error.name || 'Error',
        errorMessage: error.message,
        httpStatus: null,
        httpStatusText: null,
        sapErrorCode: null,
        sapErrorMessage: null,
        sapInnerError: null,
        rawResponseData: null
    };
    
    // Extract from error.response
    if (error.response) {
        structuredError.httpStatus = error.response.status;
        structuredError.httpStatusText = error.response.statusText;
        structuredError.rawResponseData = error.response.data;
        
        if (error.response.data?.error) {
            const sapError = error.response.data.error;
            structuredError.sapErrorCode = sapError.code;
            structuredError.sapErrorMessage = sapError.message?.value || sapError.message;
            structuredError.sapInnerError = sapError.innererror;
        }
    }
    
    // Check error.cause
    if (error.cause?.response) {
        structuredError.httpStatus = structuredError.httpStatus || error.cause.response.status;
        structuredError.rawResponseData = structuredError.rawResponseData || error.cause.response.data;
    }
    
    // Check error.rootCause
    if (error.rootCause?.response) {
        structuredError.httpStatus = structuredError.httpStatus || error.rootCause.response.status;
        structuredError.rawResponseData = structuredError.rawResponseData || error.rootCause.response.data;
    }
    
    return structuredError;
}

module.exports = { extractSapODataError };
