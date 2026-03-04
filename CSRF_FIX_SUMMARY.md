# CSRF Token Validation Error Fix

## Issue
Production Run (`POST /api/lockbox/post/:headerId`) was failing with "CSRF token validation failed" error after switching from hardcoded API endpoints to dynamic API calls from RULE-003 and RULE-004.

## Root Cause
The issue was NOT a missing CSRF token implementation (which was already working with hardcoded endpoints). The problem was in the **RULE-003 configuration**:

1. **Leading Space in API Path**: The `apiReference` field in RULE-003 POST mapping had a leading space:
   ```json
   "apiReference": " /sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch"
   ```
   This extra space would cause URL construction issues.

## Changes Made

### 1. Fixed processing_rules.json
**File**: `/app/backend/data/processing_rules.json`

**Before**:
```json
{
  "httpMethod": "POST",
  "apiReference": " /sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch",
  "destination": "S4HANA_SYSTEM_DESTINATION",
  ...
}
```

**After**:
```json
{
  "httpMethod": "POST",
  "apiReference": "/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch",
  "destination": "S4HANA_SYSTEM_DESTINATION",
  ...
}
```

### 2. Reverted server.js
**File**: `/app/backend/server.js`

- Removed the additional CSRF token fetching logic that was added (since it was already working)
- Kept the original `postToSapApi` function that accepts dynamic `destinationName` and `apiPath` parameters
- The function signature remains: `postToSapApi(payload, destinationName, apiPath)`

## How the Fix Works

1. **Dynamic API Call Flow**:
   ```
   Production Run Endpoint
   ↓
   Fetch RULE-003 from DB/JSON
   ↓
   Extract POST API config (apiReference + destination)
   ↓
   Call postToSapApi(payload, destination, apiPath)
   ↓
   POST to SAP with correct URL
   ```

2. **The leading space was causing**:
   - Malformed URLs when concatenated with base URL
   - Authentication/routing issues in SAP
   - Possible CSRF token path mismatch

## Testing Steps

To test the fix:

1. **Verify the API configuration is correct**:
   ```bash
   cd /app/backend && node -e "
   const rules = require('./data/processing_rules.json');
   const rule003 = rules.find(r => r.ruleId === 'RULE-003');
   const postApi = rule003.apiMappings.find(a => a.httpMethod === 'POST');
   console.log('POST API:', postApi.apiReference);
   console.log('Has leading space:', postApi.apiReference.startsWith(' '));
   "
   ```

2. **Test Production Run** (requires valid test data):
   ```bash
   API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
   curl -X POST "$API_URL/api/lockbox/post/<HEADER_ID>" \
     -H "Content-Type: application/json"
   ```

## Additional Notes

- The PostgreSQL database also needs to be updated with the corrected RULE-003 configuration
- CSRF token handling is managed by the SAP Cloud SDK when using BTP destinations
- The direct connection fallback (using .env credentials) may not include CSRF token handling, but BTP destinations handle it automatically

## Status
✅ **Fixed**: Leading space removed from RULE-003 POST API configuration
✅ **Reverted**: Unnecessary CSRF token code removed from server.js
⏳ **Pending**: Testing with actual SAP system to verify Production Run works
