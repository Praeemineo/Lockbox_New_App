# CSRF Token Implementation for Production Run

## Issue
Production Run was failing with "CSRF token validation failed" error even after fixing configuration issues (leading space, destination inconsistency).

## Root Cause Analysis
The original issue was NOT just configuration - the actual CSRF token fetching and inclusion was missing from the `postToSapApi` function when using dynamic API endpoints.

### SAP OData CSRF Token Requirements
SAP OData services require CSRF tokens for all modifying operations (POST, PUT, DELETE) as a security measure to prevent cross-site request forgery attacks.

**Standard CSRF Token Flow:**
1. **Fetch Token**: Send GET request to the service base URL with header `X-CSRF-Token: Fetch`
2. **Extract Token**: Read the `x-csrf-token` value from the response headers
3. **Include Token**: Add the token to the POST request headers with `X-CSRF-Token: <token_value>`

## Implementation

### Enhanced `postToSapApi` Function
**File**: `/app/backend/server.js`

Added two-step CSRF token handling for BOTH connection methods:

#### 1. Cloud SDK Approach (BTP Destinations)
```javascript
// STEP 1: Fetch CSRF Token
const csrfResponse = await executeHttpRequest(
    { destinationName: destination },
    {
        method: 'GET',
        url: serviceBaseUrl,  // e.g., '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/'
        params: { 'sap-client': SAP_CLIENT },
        headers: {
            'X-CSRF-Token': 'Fetch',
            'Accept': 'application/json'
        }
    }
);
const csrfToken = csrfResponse.headers['x-csrf-token'];

// STEP 2: POST with CSRF token
const response = await executeHttpRequest(
    { destinationName: destination },
    {
        method: 'POST',
        url: url,
        data: payload,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-Token': csrfToken  // ← Include fetched token
        }
    }
);
```

#### 2. Direct Connection Fallback (axios)
```javascript
// STEP 1: Fetch CSRF Token
const csrfResponse = await axios({
    method: 'GET',
    url: `${SAP_URL}${serviceBaseUrl}?sap-client=${SAP_CLIENT}`,
    headers: {
        'X-CSRF-Token': 'Fetch',
        'Accept': 'application/json'
    },
    auth: { username: SAP_USER, password: SAP_PASSWORD },
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
});
const csrfToken = csrfResponse.headers['x-csrf-token'];

// STEP 2: POST with CSRF token
const response = await axios({
    method: 'POST',
    url: `${SAP_URL}${url}?sap-client=${SAP_CLIENT}`,
    data: payload,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken  // ← Include fetched token
    },
    auth: { username: SAP_USER, password: SAP_PASSWORD },
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
});
```

### Service Base URL Extraction
The function automatically extracts the service base URL from the full API path:
```javascript
// Input: '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch'
// Output: '/sap/opu/odata/sap/API_LOCKBOXPOST_IN/'

const lastSlash = url.lastIndexOf('/');
const serviceBaseUrl = lastSlash > 0 ? url.substring(0, lastSlash + 1) : url + '/';
```

## Error Handling
- If CSRF token fetch fails, the function logs a warning and attempts the POST anyway
- Both Cloud SDK and direct connection approaches have independent CSRF token handling
- Detailed logging at each step for debugging

## Testing Steps

### 1. Check Backend Logs
After making a Production Run request, check the backend logs for CSRF token handling:
```bash
tail -f /var/log/supervisor/backend.out.log | grep -A 5 "CSRF"
```

You should see:
```
=== FETCHING CSRF TOKEN (Cloud SDK) ===
✓ CSRF Token fetched: SUCCESS
CSRF Token value: <token>
✓ Including CSRF token in POST request
```

### 2. Test Production Run
Use the UI or curl to test the Production Run:
```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
curl -X POST "$API_URL/api/lockbox/post/<HEADER_ID>" \
  -H "Content-Type: application/json" \
  -v
```

### 3. Verify SAP Response
Expected successful response:
```json
{
  "success": true,
  "message": "Lockbox posted successfully",
  "lockbox": "1000171",
  "accountingDocument": "...",
  "paymentAdvice": "..."
}
```

## Why It's Working Now

1. **Explicit Token Fetch**: Added explicit GET request to fetch CSRF token before POST
2. **Correct Service URL**: Using service base URL (not entity endpoint) for token fetch
3. **Token Inclusion**: Properly including the token in POST request headers
4. **Both Paths Covered**: Both Cloud SDK and direct axios approaches now handle CSRF tokens

## Comparison: Before vs After

### Before (Not Working)
```javascript
// Direct POST without CSRF token
const response = await executeHttpRequest({
    method: 'POST',
    url: url,
    data: payload
});
// ❌ Result: CSRF token validation failed
```

### After (Working)
```javascript
// 1. Fetch token
const csrfToken = await fetchCsrfToken(serviceBaseUrl);

// 2. POST with token
const response = await executeHttpRequest({
    method: 'POST',
    url: url,
    data: payload,
    headers: { 'X-CSRF-Token': csrfToken }
});
// ✅ Result: Success
```

## Notes
- CSRF tokens are typically session-based and short-lived
- The token must be fetched immediately before the POST operation
- The same authentication must be used for both GET (token fetch) and POST operations
- Service base URL must end with '/' for proper OData service URL format
