# RULE-004 Pure Pass-Through Architecture - Implementation Complete

## Architecture Change

**Before:** BTP stored RULE-004 data in database for caching  
**After:** Pure pass-through - BTP fetches fresh data from SAP every time

---

## Process Flow

```
┌─────────────┐
│  1. Lockbox │
│   Created   │
│  in BTP     │
└──────┬──────┘
       │
       │ LockboxId: "1000173-0"
       │
┌──────▼──────┐
│  2. Posted  │
│  to SAP     │
│  (RULE-003) │
└──────┬──────┘
       │
       │ SAP stores all accounting data
       │
┌──────▼──────┐
│ 3. User     │
│ Opens       │
│ Dialog      │
└──────┬──────┘
       │
       │ Click navigation arrow →
       │
┌──────▼──────────────────────────────────┐
│ 4. UI → BTP (GET /api/lockbox/:runId/   │
│            accounting-document)          │
└──────┬───────────────────────────────────┘
       │
       │ runId: "RUN-2026-00175"
       │
┌──────▼────────────────────────────────────┐
│ 5. BTP: Extract LockboxId from Run       │
│    - Try: run.lockboxId                  │
│    - Try: run.lockbox                    │
│    - Try: run.lockbox_batch_origin       │
└──────┬────────────────────────────────────┘
       │
       │ Found: "1000173-0"
       │
┌──────▼────────────────────────────────────┐
│ 6. BTP: Map to SAP Format                │
│    Strip hyphen: "1000173-0" → "1000173" │
└──────┬────────────────────────────────────┘
       │
       │ SAP LockboxId: "1000173"
       │
┌──────▼────────────────────────────────────┐
│ 7. BTP → SAP: Call RULE-004 API          │
│    GET /ZFI_I_ACC_BANK_STMT               │
│    $filter=LockBoxId eq '1000173'         │
└──────┬────────────────────────────────────┘
       │
       │ Fresh data from SAP
       │
┌──────▼────────────────────────────────────┐
│ 8. BTP: Format Response                  │
│    - Map SAP fields to UI format         │
│    - NO STORAGE in BTP database          │
└──────┬────────────────────────────────────┘
       │
       │ JSON response
       │
┌──────▼────────────────────────────────────┐
│ 9. UI: Display in Dialog                 │
│    - Header Data: LockboxId, etc.        │
│    - Item Data: Documents table          │
└───────────────────────────────────────────┘
```

---

## Key Changes

### 1. No BTP Storage
**Removed:**
```javascript
// OLD CODE (removed):
if (run.clearingDocuments) {
    return res.json({
        documents: run.clearingDocuments,
        source: 'stored'  // ❌ No more caching
    });
}

// Store for future use (removed):
run.clearingDocuments = documents;
saveRunsToFile();
```

**New:**
```javascript
// Always fetch fresh from SAP
console.log('🔄 Fetching fresh data from SAP (no BTP storage)');
const response = await sapClient.executeSapGetRequest(...);

// Return directly without storing
res.json({
    success: true,
    documents: mappedData,
    source: 'sap',
    architecture: 'pass-through'  // ✅ Pure pass-through
});
```

### 2. Removed refresh Parameter
**Before:** `GET /api/lockbox/:runId/accounting-document?refresh=true`  
**After:** No parameter needed - always fetches fresh data

### 3. Removed Fallback Logic
**Before:** If SAP fails, fallback to stored data  
**After:** If SAP fails, return error (no fallback)

---

## Updated Process Steps

### GET /api/lockbox/:runId/accounting-document

```javascript
// STEP 1: Get run from BTP (to extract LockboxId)
let run = lockboxProcessingRuns.find(r => r.runId === runId);

// STEP 2: Extract LockboxID (BTP → SAP mapping)
let lockboxId = run.lockboxId || run.lockbox || run.lockbox_batch_origin;

// STEP 3: Strip hyphen (BTP format → SAP format)
if (lockboxId.includes('-')) {
    lockboxId = lockboxId.split('-')[0];  // "1000173-0" → "1000173"
}

// STEP 4: Get RULE-004 config from BTP
const rule004 = processingRules.find(r => r.ruleId === 'RULE-004');

// STEP 5: Build SAP query
const queryParams = {
    '$filter': `LockBoxId eq '${lockboxId}'`,
    '$select': 'LockBoxId,SendingBank,...'
};

// STEP 6: Call SAP (pure pass-through)
const response = await sapClient.executeSapGetRequest(...);

// STEP 7: Format response
const mappedData = response.data.value.map(...);

// STEP 8: Return to UI (NO BTP STORAGE)
res.json({
    success: true,
    documents: mappedData,
    source: 'sap',
    architecture: 'pass-through'
});
```

---

## BTP's Role

BTP acts as:
1. ✅ **Identifier Mapper:** Maps BTP LockboxId format to SAP format
2. ✅ **Configuration Store:** Stores RULE-004 API endpoint config
3. ✅ **Connection Proxy:** Manages SAP credentials and connection
4. ✅ **Data Formatter:** Transforms SAP response to UI-friendly format
5. ❌ **NOT a data cache:** Does not store RULE-004 data

---

## Logs

### Successful Fetch:
```
📋 RULE-004: Fetching accounting document for run RUN-2026-00175 (always fresh from SAP)
   📝 Mapped BTP LockboxId to SAP format: "1000173-0" → "1000173"
   ✅ Using LockboxId: 1000173 for SAP query
   🔄 Fetching fresh data from SAP (no BTP storage)
   📍 SAP API Endpoint: /sap/opu/odata4/.../ZFI_I_ACC_BANK_STMT
   🔍 SAP Query Params: { '$filter': "LockBoxId eq '1000173'" }
   📞 Calling SAP API...
   ✅ SAP Response received successfully
   📊 SAP returned 3 document(s)
   ✅ Returning 3 documents to UI (no BTP storage)
```

### Failed Fetch:
```
📋 RULE-004: Fetching accounting document for run RUN-2026-00175
   ❌ RULE-004 SAP API call failed: {
     error: 'Request failed with status code 500',
     lockboxId: '1000173',
     statusCode: 500
   }
❌ Error returned to UI (no fallback - no BTP storage exists)
```

---

## Benefits

### ✅ Always Fresh Data
- Every dialog open fetches latest data from SAP
- No stale data issues
- Real-time accuracy

### ✅ No BTP Database Bloat
- BTP doesn't store RULE-004 data
- Reduced storage requirements
- Cleaner database

### ✅ Single Source of Truth
- SAP is the only source of accounting data
- No data synchronization issues
- No consistency problems

### ✅ Simpler Architecture
- No caching logic
- No storage management
- No fallback complexity

---

## Response Format

```json
{
  "success": true,
  "lockboxId": "1000173",
  "documents": [
    {
      "item": "1",
      "LockBoxId": "1000173",
      "SendingBank": "SAMPLEDEST 1234567890",
      "BankStatement": "60",
      "StatementId": "1000173 260318 0000",
      "CompanyCode": "0001",
      "HeaderStatus": "Processed",
      "BankStatementItem": "1",
      "DocumentNumber": "5100000123",
      "PaymentAdvice": "01000000600002",
      "SubledgerDocument": "SD001",
      "SubledgerOnaccountDocument": "SA001",
      "Amount": 900.00,
      "TransactionCurrency": "USD",
      "DocumentStatus": "Posted"
    }
  ],
  "count": 1,
  "source": "sap",
  "fetchedAt": "2026-03-18T10:30:45.123Z",
  "architecture": "pass-through"
}
```

---

## Production Run Behavior

During production run (RULE-003):
1. RULE-004 is still called automatically
2. Data is included in the immediate response
3. **BUT:** Data is NOT stored in BTP database
4. User must fetch again when opening dialog

---

## Summary

✅ **Pure pass-through architecture implemented**  
✅ **No BTP database storage for RULE-004 data**  
✅ **Always fetches fresh data from SAP**  
✅ **BTP only maps LockboxId and proxies requests**  
✅ **SAP is single source of truth for accounting data**

**Data Flow:** UI → BTP (mapper/proxy) → SAP (data source) → UI
