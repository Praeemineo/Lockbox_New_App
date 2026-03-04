# CSRF Token Validation Error Fix

## Issue
Production Run (`POST /api/lockbox/post/:headerId`) was failing with "CSRF token validation failed" error after switching from hardcoded API endpoints to dynamic API calls from RULE-003 and RULE-004.

## Root Cause
The issue was NOT a missing CSRF token implementation (which was already working with hardcoded endpoints). The problems were in the **rule configurations**:

1. **Leading Space in API Path**: The `apiReference` field in RULE-003 POST mapping had a leading space:
   ```json
   "apiReference": " /sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch"
   ```
   This extra space would cause URL construction issues.

2. **Inconsistent Destination Names**: RULE-004 was using a different destination (`LockBox`) instead of the same destination as RULE-003 (`S4HANA_SYSTEM_DESTINATION`), causing authentication and routing issues.

## Changes Made

### 1. Fixed RULE-003: Removed Leading Space
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

### 2. Fixed RULE-004: Unified Destination Name
**File**: `/app/backend/data/processing_rules.json`

**Before**:
```json
{
  "httpMethod": "GET",
  "apiReference": "/sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT",
  "destination": "LockBox",
  ...
}
```

**After**:
```json
{
  "httpMethod": "GET",
  "apiReference": "/sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT",
  "destination": "S4HANA_SYSTEM_DESTINATION",
  ...
}
```

### 3. Reverted server.js
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
   Call postToSapApi(payload, "S4HANA_SYSTEM_DESTINATION", "/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch")
   ↓
   POST to SAP with correct URL and authentication
   ```

2. **Why these issues caused the CSRF error**:
   - **Leading space**: Malformed URLs when concatenated with base URL, causing 403/CSRF errors
   - **Wrong destination**: Different authentication credentials/configuration, SAP rejecting requests
   - Both issues made SAP think the request was invalid/unauthorized, triggering CSRF validation failure

## Verification

All rules now use consistent configuration:

```
✓ RULE-003 (Rule Level): S4HANA_SYSTEM_DESTINATION
✓ RULE-003 POST API: S4HANA_SYSTEM_DESTINATION
✓ RULE-003 GET API: S4HANA_SYSTEM_DESTINATION
✓ RULE-004 (Rule Level): S4HANA_SYSTEM_DESTINATION
✓ RULE-004 GET API: S4HANA_SYSTEM_DESTINATION
```

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
   console.log('Destination:', postApi.destination);
   "
   ```

2. **Test Production Run** (requires valid test data):
   ```bash
   API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
   curl -X POST "$API_URL/api/lockbox/post/<HEADER_ID>" \
     -H "Content-Type: application/json"
   ```

## Additional Notes

- The PostgreSQL database also needs to be updated with the corrected RULE-003 and RULE-004 configurations
- CSRF token handling is managed by the SAP Cloud SDK when using BTP destinations
- The direct connection fallback (using .env credentials) may not include CSRF token handling, but BTP destinations handle it automatically
- All rules now consistently use `S4HANA_SYSTEM_DESTINATION` for unified authentication and routing

## Status
✅ **Fixed**: Leading space removed from RULE-003 POST API configuration
✅ **Fixed**: RULE-004 destination changed from "LockBox" to "S4HANA_SYSTEM_DESTINATION"
✅ **Reverted**: Unnecessary CSRF token code removed from server.js
⏳ **Pending**: Testing with actual SAP system to verify Production Run works
⏳ **Pending**: Update PostgreSQL database with corrected rule configurations
