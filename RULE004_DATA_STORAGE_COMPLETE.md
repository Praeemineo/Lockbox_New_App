# RULE-004 Data Storage with Run ID - Implementation Complete

## Overview
RULE-004 document details are now stored with the Run ID, so the Transaction Dialog can display data immediately without fetching from SAP each time.

---

## Implementation Flow

### 1. Production Run (RULE-003) → Auto-fetch and Store RULE-004 Data

**Location:** `/app/backend/server.js` lines 2533-2650

```javascript
// After successful RULE-003 production run
if (productionResponse.status === 'SUCCESS' && header.lockbox) {
    // STEP 1: Fetch RULE-004 data from SAP
    const rule004Response = await sapClient.executeSapGetRequest(...);
    const clearingDocuments = formatDocuments(rule004Response);
    
    // STEP 2: Store in run object
    const runIndex = lockboxProcessingRuns.findIndex(r => r.runId === runId);
    if (runIndex >= 0) {
        lockboxProcessingRuns[runIndex].clearingDocuments = clearingDocuments;
        lockboxProcessingRuns[runIndex].clearingDocumentsTimestamp = new Date().toISOString();
        saveRunsToFile();
    }
    
    // STEP 3: Include in response
    finalResponse.clearingDocuments = clearingDocuments;
}
```

### 2. Transaction Dialog Opens → Use Stored Data First

**Location:** `/app/backend/server.js` lines 5321-5455

```javascript
app.get('/api/lockbox/:runId/accounting-document', async (req, res) => {
    const { runId } = req.params;
    const { refresh } = req.query; // Optional refresh=true parameter
    
    // Get run data
    let run = lockboxProcessingRuns.find(r => r.runId === runId);
    
    // CHECK 1: If data is already stored and refresh not requested
    if (run.clearingDocuments && run.clearingDocuments.length > 0 && !refresh) {
        console.log('✅ Using stored RULE-004 data (no SAP call needed)');
        return res.json({
            success: true,
            documents: run.clearingDocuments,
            source: 'stored',  // Indicates data is from storage
            storedAt: run.clearingDocumentsTimestamp
        });
    }
    
    // CHECK 2: If not stored or refresh requested, fetch from SAP
    console.log('🔄 Fetching fresh data from SAP');
    const response = await sapClient.executeSapGetRequest(...);
    const mappedData = formatDocuments(response.data.value);
    
    // Store for future use
    run.clearingDocuments = mappedData;
    run.clearingDocumentsTimestamp = new Date().toISOString();
    saveRunsToFile();
    
    return res.json({
        success: true,
        documents: mappedData,
        source: 'sap',  // Indicates data is freshly fetched
        fetchedAt: new Date().toISOString()
    });
});
```

---

## Data Structure

### Run Object with RULE-004 Data

```json
{
  "runId": "RUN-2026-00123",
  "filename": "Customer Payments upload 11.xlsx",
  "overallStatus": "posted",
  "lockboxId": "1000170",
  "lockbox": "1000170",
  "clearingDocuments": [
    {
      "item": "1",
      "LockBoxId": "1000170",
      "SendingBank": "SAMPLEDEST 1234567890",
      "BankStatement": "60",
      "StatementId": "1000170 260123 0000",
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
  "clearingDocumentsTimestamp": "2026-03-18T10:30:45.123Z",
  "createdAt": "2026-03-18T10:25:00.000Z",
  "completedAt": "2026-03-18T10:30:45.123Z"
}
```

---

## Frontend Integration

### Transaction Dialog - Automatic Data Loading

**Location:** `/app/frontend/public/webapp/controller/Main.controller.js` (already implemented)

```javascript
onShowTransactionDetails: function (oEvent) {
    // Fetch run details AND RULE-004 data in parallel
    Promise.all([
        fetch(API_BASE + "/lockbox/runs/" + runId).then(res => res.json()),
        fetch(API_BASE + "/lockbox/" + runId + "/accounting-document").then(res => res.json())
    ]).then(function (results) {
        var runData = results[0];
        var rule004Data = results[1];
        
        // Check data source
        if (rule004Data.source === 'stored') {
            console.log('Using stored RULE-004 data - instant load!');
        } else {
            console.log('Fetched fresh data from SAP');
        }
        
        // Display in Transaction Dialog
        populateTransactionDialog(rule004Data.documents);
    });
}
```

### Refresh Button - Force Fetch from SAP

```javascript
onRefreshTransactionData: function () {
    var runId = this.selectedRunId;
    
    // Add ?refresh=true to force SAP fetch
    fetch(API_BASE + "/lockbox/" + runId + "/accounting-document?refresh=true")
        .then(res => res.json())
        .then(data => {
            console.log('Refreshed data from SAP:', data.fetchedAt);
            populateTransactionDialog(data.documents);
        });
}
```

---

## Benefits

### 1. **Instant Load**
- Transaction Dialog opens immediately with stored data
- No waiting for SAP API call (5-10 seconds saved)

### 2. **Reduced SAP Load**
- SAP API called only once during production run
- Subsequent dialog opens use stored data
- Manual refresh available if needed

### 3. **Offline Capability**
- Data available even if SAP is temporarily unavailable
- Displays last known state with timestamp

### 4. **Data Persistence**
- RULE-004 data saved to JSON file backup
- Survives server restarts
- Can be exported/analyzed later

---

## API Endpoints

### 1. GET /api/lockbox/runs/:runId
**Returns:** Full run object including `clearingDocuments` if available

```json
{
  "run": {
    "runId": "RUN-2026-00123",
    "clearingDocuments": [...],  // RULE-004 data
    "clearingDocumentsTimestamp": "2026-03-18T10:30:45.123Z"
  }
}
```

### 2. GET /api/lockbox/:runId/accounting-document
**Returns:** RULE-004 documents (from storage or SAP)

**Without refresh:**
```json
{
  "success": true,
  "documents": [...],
  "source": "stored",  // Data from run storage
  "storedAt": "2026-03-18T10:30:45.123Z"
}
```

**With refresh=true:**
```json
{
  "success": true,
  "documents": [...],
  "source": "sap",  // Fresh data from SAP
  "fetchedAt": "2026-03-18T11:00:00.000Z"
}
```

---

## Storage Locations

### 1. In-Memory (Runtime)
```javascript
lockboxProcessingRuns = [
  {
    runId: "RUN-2026-00123",
    clearingDocuments: [...],
    clearingDocumentsTimestamp: "..."
  }
]
```

### 2. File System (Persistent)
**File:** `/app/backend/data/lockbox_runs_backup.json`
```json
[
  {
    "runId": "RUN-2026-00123",
    "clearingDocuments": [...],
    "clearingDocumentsTimestamp": "..."
  }
]
```

### 3. PostgreSQL (Production)
**Table:** `lockbox_processing_run`
**Column:** `clearing_documents` (JSONB)

---

## Testing Guide

### Test 1: Verify Data is Stored During Production Run

1. Upload a file and complete production run (RULE-003)
2. Check backend logs:
   ```
   === RETRIEVING CLEARING DOCUMENTS (RULE-004) ===
   ✓ Retrieved X clearing documents from SAP
   === SAVING CLEARING DOCUMENTS TO RUN ===
   ✓ Clearing documents saved to run: RUN-2026-00123
   ```

### Test 2: Verify Transaction Dialog Uses Stored Data

1. Click "Show Transaction Details" on a posted run
2. Check backend logs:
   ```
   📋 RULE-004: Fetching accounting document for run RUN-2026-00123
   ✅ Using stored RULE-004 data (X documents)
   💾 Data source: Run storage (no SAP call needed)
   ```
3. Dialog should open instantly with data

### Test 3: Verify Refresh Button Fetches Fresh Data

1. In Transaction Dialog, click "Refresh Data" button
2. Check backend logs:
   ```
   📋 RULE-004: Fetching accounting document for run RUN-2026-00123 (refresh=true)
   🔄 Fetching fresh data from SAP
   ✅ SAP Response received
   💾 Stored RULE-004 data to run for future use
   ```

### Test 4: Verify Data Persists After Server Restart

1. Complete production run (data stored)
2. Restart backend: `sudo supervisorctl restart backend`
3. Open Transaction Dialog
4. Should still load instantly from stored data

---

## Logs to Monitor

### Production Run (RULE-004 Auto-fetch):
```
=== CHECKING IF RULE-004 SHOULD BE CALLED ===
Should call RULE-004: true
=== RETRIEVING CLEARING DOCUMENTS (RULE-004) ===
Lockbox ID: 1000170
Calling RULE-004 API: /sap/opu/odata4/.../ZFI_I_ACC_BANK_STMT
✓ Retrieved 3 clearing documents from SAP
✓ Formatted 3 clearing documents for response
=== SAVING CLEARING DOCUMENTS TO RUN ===
✓ Clearing documents saved to run: RUN-2026-00123
```

### Transaction Dialog (Using Stored Data):
```
📋 RULE-004: Fetching accounting document for run RUN-2026-00123 (refresh=false)
   Using LockboxId: 1000170
   ✅ Using stored RULE-004 data (3 documents)
   💾 Data source: Run storage (no SAP call needed)
```

### Transaction Dialog (Refresh - Fetch from SAP):
```
📋 RULE-004: Fetching accounting document for run RUN-2026-00123 (refresh=true)
   Using LockboxId: 1000170
   🔄 Fetching fresh data from SAP (stored data not available or refresh requested)
   API Endpoint: /sap/opu/odata4/.../ZFI_I_ACC_BANK_STMT
   Query Params: { '$filter': "LockBoxId eq '1000170'" }
   ✅ SAP Response received
   📊 Found 3 document(s)
   💾 Stored RULE-004 data to run for future use
```

---

## Summary

✅ **RULE-004 data is automatically fetched and stored during production run**  
✅ **Transaction Dialog uses stored data first (instant load)**  
✅ **Manual refresh available to fetch fresh data from SAP**  
✅ **Data persists across server restarts**  
✅ **Reduced SAP API calls (better performance)**  
✅ **Clear source indicator ('stored' vs 'sap') in API response**

The implementation is complete and ready for testing in your BTP environment!
