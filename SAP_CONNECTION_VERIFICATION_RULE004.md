# SAP Connection Verification for RULE-004

## Confirmation: RULE-004 Uses Same SAP Connection as RULE-001/002

### Connection Method
All three rules use the **SAME** SAP client connection method: `sapClient.executeSapGetRequest()`

---

## Connection Flow

### 1. RULE-001 & RULE-002 (via rule-engine.js)
```javascript
// File: /app/backend/srv/handlers/rule-engine.js (line 522)
const response = await sapClient.executeSapGetRequest(destination, endpoint, queryParams);
```

### 2. RULE-004 (via server.js)
```javascript
// File: /app/backend/server.js (line 5367)
const response = await sapClient.executeSapGetRequest(
    rule004.destination,
    apiEndpoint,
    queryParams
);
```

**Both call the exact same function!** ✅

---

## SAP Client Connection Logic

### File: `/app/backend/srv/integrations/sap-client.js`

The `executeSapGetRequest()` function uses a **two-step fallback approach**:

#### Step 1: Try BTP Destination Service (for Cloud deployment)
```javascript
const btpDest = await getDestinationViaBTP(destinationName);
// Uses SAP Cloud SDK to resolve destination
```

#### Step 2: Fallback to Direct Connection (uses .env variables)
```javascript
const SAP_URL = process.env.SAP_URL;           // https://44.196.95.84:44301
const SAP_USER = process.env.SAP_USER;         // S4H_FIN
const SAP_PASSWORD = process.env.SAP_PASSWORD; // Welcome1
const SAP_CLIENT = process.env.SAP_CLIENT;     // 100

// Direct HTTPS call with credentials
const response = await axios({
    method: 'GET',
    url: `${SAP_URL}${endpoint}?${queryString}`,
    auth: {
        username: SAP_USER,
        password: SAP_PASSWORD
    },
    httpsAgent: new https.Agent({
        rejectUnauthorized: false  // Handles self-signed certificates
    })
});
```

---

## Environment Variables Used (from /app/backend/.env)

```bash
SAP_URL=https://44.196.95.84:44301
SAP_USER=S4H_FIN
SAP_PASSWORD=Welcome1
SAP_CLIENT=100
SAP_DESTINATION_NAME=S4HANA_SYSTEM_DESTINATION
SAP_API_TIMEOUT=10000
```

**All three rules (RULE-001, RULE-002, RULE-004) use these SAME credentials!** ✅

---

## How Each Rule Uses the Connection

### RULE-001: Accounting Document Lookup
```javascript
// Input: Invoice Number (e.g., "90003904")
// API: /sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='0090003904')/Set
// Connection: sapClient.executeSapGetRequest('S4HANA_SYSTEM_DESTINATION', apiURL, {})
// Credentials: Uses SAP_URL, SAP_USER, SAP_PASSWORD from .env
```

### RULE-002: Partner Bank Details
```javascript
// Input: Customer Number (e.g., "1000")
// API: /sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner(BusinessPartner='0000001000')...
// Connection: sapClient.executeSapGetRequest('S4HANA_SYSTEM_DESTINATION', apiURL, {})
// Credentials: Uses SAP_URL, SAP_USER, SAP_PASSWORD from .env
```

### RULE-004: Get Accounting Documents
```javascript
// Input: LockboxId (e.g., "1000170")
// API: /sap/opu/odata4/.../ZFI_I_ACC_BANK_STMT?$filter=LockBoxId eq '1000170'
// Connection: sapClient.executeSapGetRequest('S4HANA_SYSTEM_DESTINATION', apiURL, queryParams)
// Credentials: Uses SAP_URL, SAP_USER, SAP_PASSWORD from .env
```

---

## Verification Test

To verify RULE-004 is using the correct SAP connection, check the logs:

```bash
# Look for these log messages in BTP:
📋 RULE-004: Fetching accounting document for run {runId}
   Using LockboxId: 1000170
   API Endpoint: /sap/opu/odata4/.../ZFI_I_ACC_BANK_STMT
   Query Params: { '$filter': "LockBoxId eq '1000170'", ... }

# Then SAP client logs:
🚀 SAP GET Request {
  "destination": "S4HANA_SYSTEM_DESTINATION",
  "endpoint": "/sap/opu/odata4/.../ZFI_I_ACC_BANK_STMT",
  "queryParams": { "$filter": "LockBoxId eq '1000170'" }
}

# Connection attempt:
Using direct SAP connection fallback for destination: S4HANA_SYSTEM_DESTINATION
Direct SAP GET { 
  "baseUrl": "https://44.196.95.84:44301",
  "endpoint": "/sap/opu/odata4/.../ZFI_I_ACC_BANK_STMT"
}

# Success:
✅ Direct SAP GET Success via S4HANA_SYSTEM_DESTINATION { "status": 200 }
✅ SAP Response received
📊 Found {count} document(s)
```

---

## Summary

✅ **RULE-004 uses the EXACT same SAP connection as RULE-001 and RULE-002**
✅ **All rules use `sapClient.executeSapGetRequest()` function**
✅ **All rules use the same environment variables:**
   - SAP_URL
   - SAP_USER
   - SAP_PASSWORD
   - SAP_CLIENT
   - SAP_DESTINATION_NAME

✅ **Connection is already properly configured** - no changes needed!

The only difference between the rules is the API endpoint and query parameters they use, but they all share the same underlying SAP connection infrastructure.
