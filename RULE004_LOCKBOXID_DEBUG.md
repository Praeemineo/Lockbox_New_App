# RULE-004 LockboxID Not Found - Debug Guide

## Error
```
RULE-004 Error: Request failed with status code 400
RULE-004: Fetching accounting document for run RUN-2026-00174
```

## Root Cause
The code was using `run.runId` as a fallback when `run.lockboxId` was not found.
- **Wrong:** `LockBoxId eq 'RUN-2026-00174'` ❌
- **Correct:** `LockBoxId eq '1000174'` ✅

## Fix Applied

### Before (WRONG):
```javascript
let lockboxId = run.lockboxId || run.lockbox || run.runId;  // ❌ BAD FALLBACK!

// If run.lockboxId and run.lockbox are empty:
// lockboxId = "RUN-2026-00174"  // ❌ This is a runId, not a lockboxId!

// API call:
$filter: `LockBoxId eq 'RUN-2026-00174'`  // ❌ SAP returns 400 error
```

### After (CORRECT):
```javascript
// Try multiple possible field names
let lockboxId = run.lockboxId || 
                run.lockbox || 
                run.lockbox_id || 
                run.lockboxBatchOrigin ||
                run.lockbox_batch_origin;

// If STILL no lockboxId found, return error immediately
if (!lockboxId) {
    return res.status(400).json({
        success: false,
        error: 'LockboxID not found in run data',
        availableFields: Object.keys(run)
    });
}

// API call:
$filter: `LockBoxId eq '1000174'`  // ✅ Correct!
```

---

## Debug Steps

### Step 1: Check what fields are in your run data

The error response now includes `availableFields` to help debug:

```json
{
  "success": false,
  "error": "LockboxID not found in run data",
  "runId": "RUN-2026-00174",
  "availableFields": [
    "runId",
    "filename",
    "status",
    "createdAt",
    "lockbox_batch_origin",  // ← Might be here!
    "sapPayload",
    "mappedData"
  ]
}
```

### Step 2: Find where the LockboxID is stored

Check these possible locations in the run object:
1. `run.lockboxId`
2. `run.lockbox`
3. `run.lockbox_id`
4. `run.lockboxBatchOrigin`
5. `run.lockbox_batch_origin`
6. `run.sapPayload.Lockbox`
7. `run.sapPayload.LockboxBatchOrigin`
8. `run.header.lockbox`

### Step 3: Test with curl to see the run data

```bash
# Get the run data
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
curl -X GET "$API_URL/api/lockbox/runs/RUN-2026-00174" | jq .

# This will show you the complete run object structure
```

---

## Common Scenarios

### Scenario 1: LockboxID in sapPayload
```json
{
  "runId": "RUN-2026-00174",
  "lockboxId": null,  // ❌ Empty
  "sapPayload": {
    "Lockbox": "1000174"  // ✅ Here!
  }
}
```

**Solution:** The code needs to also check `run.sapPayload.Lockbox`

### Scenario 2: LockboxID with different field name
```json
{
  "runId": "RUN-2026-00174",
  "lockbox_batch_origin": "1000174"  // ✅ Here with underscore!
}
```

**Solution:** Already handled by checking `run.lockbox_batch_origin`

### Scenario 3: LockboxID from header
```json
{
  "runId": "RUN-2026-00174",
  "header": {
    "lockbox": "1000174"  // ✅ Nested here!
  }
}
```

**Solution:** The code needs to also check `run.header.lockbox`

---

## Updated Code Logic

```javascript
// Enhanced lockboxId extraction with multiple fallbacks
let lockboxId = 
    run.lockboxId ||                    // Try direct field
    run.lockbox ||                      // Try alternate name
    run.lockbox_id ||                   // Try with underscore
    run.lockboxBatchOrigin ||          // Try batch origin
    run.lockbox_batch_origin ||        // Try with underscore
    (run.sapPayload && run.sapPayload.Lockbox) ||           // Try in SAP payload
    (run.sapPayload && run.sapPayload.LockboxBatchOrigin) || // Try batch origin in payload
    (run.header && run.header.lockbox);                      // Try in header

// If STILL not found, return detailed error
if (!lockboxId) {
    console.error('❌ LockboxID not found. Run structure:', {
        runId: run.runId,
        hasLockboxId: !!run.lockboxId,
        hasLockbox: !!run.lockbox,
        hasSapPayload: !!run.sapPayload,
        sapPayloadKeys: run.sapPayload ? Object.keys(run.sapPayload) : [],
        hasHeader: !!run.header,
        headerKeys: run.header ? Object.keys(run.header) : [],
        allRunKeys: Object.keys(run)
    });
    
    return res.status(400).json({
        success: false,
        error: 'LockboxID not found in run data. Please check run structure.',
        runId: run.runId,
        availableFields: Object.keys(run),
        hint: 'LockboxID might be in: sapPayload.Lockbox, header.lockbox, or lockbox_batch_origin'
    });
}

console.log(`✅ Found LockboxId: ${lockboxId}`);
```

---

## How to Fix Your Run Data

### Option 1: Update existing runs with LockboxID
```javascript
// Add missing lockboxId to runs
lockboxProcessingRuns.forEach(run => {
    if (!run.lockboxId && run.sapPayload && run.sapPayload.Lockbox) {
        run.lockboxId = run.sapPayload.Lockbox;
        console.log(`Fixed run ${run.runId}: added lockboxId = ${run.lockboxId}`);
    }
});
saveRunsToFile();
```

### Option 2: Ensure future runs have lockboxId
When creating a new run, make sure to set `lockboxId`:
```javascript
const newRun = {
    runId: runId,
    lockboxId: header.lockbox || header.lockbox_batch_origin,  // ✅ Set this!
    filename: filename,
    status: status,
    // ... other fields
};
```

---

## Testing

### Test 1: Check if error shows available fields
```bash
curl -X GET "$API_URL/api/lockbox/RUN-2026-00174/accounting-document"
```

Expected response:
```json
{
  "success": false,
  "error": "LockboxID not found in run data",
  "runId": "RUN-2026-00174",
  "availableFields": ["runId", "filename", "status", "sapPayload", ...]
}
```

### Test 2: Check run data structure
```bash
curl -X GET "$API_URL/api/lockbox/runs/RUN-2026-00174" | jq '.run | keys'
```

### Test 3: After fix, verify correct LockboxId is used
```bash
# Check backend logs
tail -f /var/log/supervisor/backend.out.log | grep "RULE-004"
```

Should show:
```
📋 RULE-004: Fetching accounting document for run RUN-2026-00174
   ✅ Using LockboxId: 1000174 (NOT runId: RUN-2026-00174)
   API Endpoint: /sap/opu/odata4/.../ZFI_I_ACC_BANK_STMT
   Query Params: { '$filter': "LockBoxId eq '1000174'" }
```

---

## Summary

✅ **Removed bad fallback:** `run.runId` is NO LONGER used as fallback
✅ **Enhanced field search:** Checks multiple possible field names
✅ **Better error messages:** Shows available fields for debugging
✅ **Validation:** Returns 400 error if no LockboxID found (instead of wrong API call)

**Next step:** Share the error response with available fields so we can identify where your LockboxID is stored!
