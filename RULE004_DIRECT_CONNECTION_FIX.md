# RULE-004 Direct Connection Fix - Like RULE-002

## ✅ Changes Made

RULE-004 now uses **direct SAP connection via environment variables**, exactly like RULE-002, bypassing the BTP Destination Service completely.

---

## 🔧 Technical Changes:

### 1. **Updated `sap-client.js`** - Added Force Direct Connection

**File**: `/app/backend/srv/integrations/sap-client.js`

Added new parameter `forceDirect` to `executeSapGetRequest()`:

```javascript
async function executeSapGetRequest(destinationName, url, queryParams = {}, forceDirect = false) {
    
    // NEW: Force Direct Connection Option
    if (forceDirect || destinationName === null || destinationName === 'null') {
        logger.info('⚡ Using DIRECT SAP connection (bypassing BTP Destination Service)');
        return await executeDirectConnection(url, queryParams);
    }
    
    // OLD: Try BTP Destination Service first
    const btpDest = await getDestinationViaBTP(destinationName);
    // ...
}
```

**Extracted reusable function**:
```javascript
async function executeDirectConnection(url, queryParams = {}) {
    const SAP_URL = process.env.SAP_URL;
    const SAP_USER = process.env.SAP_USER;
    const SAP_PASSWORD = process.env.SAP_PASSWORD;
    const SAP_CLIENT = process.env.SAP_CLIENT || '100';
    
    // Direct axios call with .env credentials
    const fullUrl = `${SAP_URL}${url}?${queryString}`;
    const response = await axios({
        method: 'GET',
        url: fullUrl,
        auth: { username: SAP_USER, password: SAP_PASSWORD },
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    
    return response;
}
```

### 2. **Updated RULE-004 Call in `server.js`**

**File**: `/app/backend/server.js` (Line ~5444)

```javascript
// OLD:
response = await sapClient.executeSapGetRequest(
    null,  // destination
    apiEndpoint,
    queryParams
);

// NEW:
response = await sapClient.executeSapGetRequest(
    null,           // destination = null
    apiEndpoint,    // clean endpoint URL
    queryParams,    // dynamic query params
    true            // forceDirect = true ✅ NEW: skip BTP, use .env directly
);
```

---

## 🎯 How It Works Now:

### **Before** (Broken):
```
RULE-004 Call
    ↓
Try BTP Destination Service
    ↓ (fails/delays)
Fallback to Direct Connection
    ↓
SAP API (with potential issues)
```

### **After** (Fixed - Like RULE-002):
```
RULE-004 Call
    ↓
SKIP BTP Destination ⚡
    ↓
DIRECT Connection via .env
    ↓
SAP API (clean and fast)
```

---

## 📊 Expected BTP Logs After Fix:

```
📋 RULE-004: Fetching accounting document for run RUN-2026-00189
   ✅ Using LockboxId: 1000189 for SAP query
   🔄 Fetching fresh data from SAP (no BTP storage)
   📍 SAP API Endpoint: /sap/opu/odata4/.../ZFI_I_ACC_BANK_STMT
   🔍 SAP Query Params: { '$filter': "LockBoxId eq '1000189'" }
   🔑 Using direct SAP connection (environment variables)
   📞 Calling SAP API DIRECTLY via environment variables (not BTP destination)...
   ⚡ Using DIRECT SAP connection (bypassing BTP Destination Service)
   🔐 Direct SAP Connection { baseUrl: 'https://44.196.95.84:44301', endpoint: '...' }
   📍 Full GET URL: https://44.196.95.84:44301/sap/opu/odata4/.../ZFI_I_ACC_BANK_STMT?sap-client=100&$filter=LockBoxId+eq+'1000189'
   ✅ Direct SAP GET Success { status: 200 }
   ✅ SAP Response received successfully
   📊 SAP returned 1 document(s)
```

**Key differences**:
- ✅ No more "Resolving SAP Destination: S4HANA_SYSTEM_DESTINATION"
- ✅ No more "Attempting SAP Cloud SDK with destination"
- ✅ No more "failed: Request path contains unescaped characters"
- ✅ Direct "⚡ Using DIRECT SAP connection" message
- ✅ Faster response (no BTP destination lookup)

---

## 🚀 Deployment Checklist:

### **Files to Deploy**:
1. ✅ `/app/backend/srv/integrations/sap-client.js` (force direct connection)
2. ✅ `/app/backend/server.js` (pass `forceDirect=true` parameter)

### **Environment Variables Required** (must be in BTP):
```bash
SAP_URL=https://44.196.95.84:44301
SAP_USER=<your-sap-username>
SAP_PASSWORD=<your-sap-password>
SAP_CLIENT=100
```

### **Test Steps**:
1. Deploy updated files to BTP
2. Restart application
3. Click navigation arrow (➡️) on a POSTED run
4. Check BTP logs - should see "⚡ Using DIRECT SAP connection"
5. Verify response is 200 (not 400)
6. Check UI - Header Data and Item Data should be populated

---

## 🔍 If Still Getting 400 Error:

The issue would then be with the **SAP OData service itself**, not the connection method.

### **Troubleshooting**:
1. **Test the URL directly** in a browser or Postman:
   ```
   https://44.196.95.84:44301/sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT?sap-client=100&$filter=LockBoxId eq '1000189'
   ```
   
2. **Check SAP Gateway logs** (transaction `/IWFND/ERROR_LOG`)

3. **Verify field name** - `LockBoxId` might need to be:
   - `Lockbox`
   - `lockboxId`
   - `LOCKBOXID`
   - Or a different field entirely

4. **Ask SAP ABAP team** for the correct OData V4 query syntax for this service

---

## ✅ Summary:

| Component | Before | After |
|-----------|--------|-------|
| Connection Method | BTP Destination → Fallback | ✅ Direct .env (like RULE-002) |
| BTP Destination Lookup | ❌ Always attempted | ✅ Completely bypassed |
| Speed | Slower (multiple attempts) | ✅ Faster (single direct call) |
| Reliability | Depends on BTP service | ✅ Direct to SAP |
| Logs | Complex multi-step | ✅ Clear single-step |

**RULE-004 now works exactly like RULE-002** - using direct environment variable connection!

Deploy to BTP and test. If the 400 error persists, it's a SAP service/query issue, not a connection issue.
