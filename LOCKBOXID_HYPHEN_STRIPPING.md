# LockboxID Hyphen Stripping - Implementation Complete

## Problem
LockboxID format: "1000173-0"  
API expects: "1000173" (without hyphen and suffix)

## Solution
Strip everything after and including the hyphen before calling RULE-004 API.

---

## Code Changes

### 1. GET /api/lockbox/:runId/accounting-document (lines 5343-5353)

**Before:**
```javascript
const lockboxId = run.lockboxId || run.lockbox || run.runId;
console.log(`Using LockboxId: ${lockboxId}`);

// API call with: "1000173-0"
$filter: `LockBoxId eq '1000173-0'`  // ❌ Wrong!
```

**After:**
```javascript
let lockboxId = run.lockboxId || run.lockbox || run.runId;

// Strip hyphen and suffix
if (lockboxId && typeof lockboxId === 'string' && lockboxId.includes('-')) {
    const originalLockboxId = lockboxId;
    lockboxId = lockboxId.split('-')[0];
    console.log(`📝 Stripped lockboxId: "${originalLockboxId}" → "${lockboxId}"`);
}

console.log(`Using LockboxId: ${lockboxId}`);

// API call with: "1000173"
$filter: `LockBoxId eq '1000173'`  // ✅ Correct!
```

### 2. Production Run RULE-004 Auto-fetch (lines 2542-2555)

**Before:**
```javascript
console.log('Lockbox ID:', header.lockbox);

const queryParams = {
    $filter: `${inputFieldName} eq '${header.lockbox}'`  // Uses "1000173-0" ❌
};
```

**After:**
```javascript
// Strip hyphen and suffix from lockbox ID
let lockboxIdForRule004 = header.lockbox;
if (lockboxIdForRule004 && typeof lockboxIdForRule004 === 'string' && lockboxIdForRule004.includes('-')) {
    const originalLockboxId = lockboxIdForRule004;
    lockboxIdForRule004 = lockboxIdForRule004.split('-')[0];
    console.log(`📝 Stripped lockboxId for RULE-004: "${originalLockboxId}" → "${lockboxIdForRule004}"`);
}

console.log('Lockbox ID:', lockboxIdForRule004);

const queryParams = {
    $filter: `${inputFieldName} eq '${lockboxIdForRule004}'`  // Uses "1000173" ✅
};
```

---

## Example: LockboxID "1000173-0"

### Input:
```
run.lockboxId = "1000173-0"
```

### Processing:
```javascript
// Step 1: Check if hyphen exists
"1000173-0".includes('-')  // true

// Step 2: Split at hyphen
"1000173-0".split('-')  // ["1000173", "0"]

// Step 3: Take first part
lockboxId = "1000173"
```

### Output API Call:
```
GET https://44.196.95.84:44301/sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT
    ?sap-client=100
    &$filter=LockBoxId eq '1000173'
    &$select=LockBoxId,SendingBank,BankStatement,...
```

### Expected SAP Response:
```json
{
  "value": [
    {
      "LockBoxId": "1000173",
      "SendingBank": "SAMPLEDEST 1234567890",
      "BankStatement": "60",
      "StatementId": "1000173 260318 0000",
      "CompanyCode": "0001",
      "HeaderStatus": "Processed",
      "BankStatementItem": "1",
      "DocumentNumber": "5100000456",
      "PaymentAdvice": "01000000600005",
      "SubledgerDocument": "SD005",
      "SubledgerOnaccountDocument": "SA005",
      "Amount": 1250.00,
      "TransactionCurrency": "USD",
      "DocumentStatus": "Posted"
    }
  ]
}
```

---

## Test Cases

### Test Case 1: LockboxID with hyphen
**Input:** "1000173-0"  
**Expected:** API calls with "1000173"  
**Log:** `📝 Stripped lockboxId: "1000173-0" → "1000173"`

### Test Case 2: LockboxID without hyphen
**Input:** "1000173"  
**Expected:** API calls with "1000173" (no change)  
**Log:** `Using LockboxId: 1000173`

### Test Case 3: LockboxID with multiple hyphens
**Input:** "1000173-0-BATCH"  
**Expected:** API calls with "1000173" (takes first part only)  
**Log:** `📝 Stripped lockboxId: "1000173-0-BATCH" → "1000173"`

### Test Case 4: Empty or null
**Input:** null or undefined  
**Expected:** API call skipped (error handling)  
**Log:** `Run not found` or `Using LockboxId: undefined`

---

## Logs to Monitor

### During Transaction Dialog Open:
```
📋 RULE-004: Fetching accounting document for run RUN-2026-00173
   📝 Stripped lockboxId: "1000173-0" → "1000173"
   Using LockboxId: 1000173
   API Endpoint: /sap/opu/odata4/.../ZFI_I_ACC_BANK_STMT
   Query Params: { '$filter': "LockBoxId eq '1000173'" }
   ✅ SAP Response received
   📊 Found X document(s)
```

### During Production Run:
```
=== RETRIEVING CLEARING DOCUMENTS (RULE-004) ===
📝 Stripped lockboxId for RULE-004: "1000173-0" → "1000173"
Lockbox ID: 1000173
API Config found: true
Calling RULE-004 API: /sap/opu/odata4/.../ZFI_I_ACC_BANK_STMT
Query: $filter=LockBoxId eq '1000173'
✅ SAP Response received
✓ Retrieved X clearing documents from SAP
```

---

## Testing Instructions

### 1. Test via Navigation Arrow
1. Go to "Lockbox Transaction" page
2. Find run with LockboxID "1000173-0"
3. Click navigation arrow (→)
4. Check backend logs for stripped lockbox message
5. Verify dialog shows data for lockbox "1000173"

### 2. Test via Production Run
1. Upload file that creates lockbox "1000173-0"
2. Run production (RULE-003)
3. Check logs for RULE-004 auto-fetch
4. Verify it calls API with "1000173" (not "1000173-0")
5. Check that clearingDocuments are stored correctly

### 3. Verify API Call in Logs
Search logs for:
```bash
grep "Stripped lockboxId" /var/log/supervisor/backend.out.log
grep "LockBoxId eq" /var/log/supervisor/backend.out.log
```

Should show:
```
📝 Stripped lockboxId: "1000173-0" → "1000173"
$filter=LockBoxId eq '1000173'
```

---

## Files Modified
- `/app/backend/server.js` (lines 2542-2555, 5343-5353)
- Backend service restarted

---

## Summary

✅ **Hyphen stripping implemented in 2 places:**
1. GET endpoint (Transaction Dialog)
2. Production run (RULE-004 auto-fetch)

✅ **Handles multiple formats:**
- "1000173-0" → "1000173"
- "1000173-0-BATCH" → "1000173"
- "1000173" → "1000173" (no change)

✅ **Clear logging:**
- Shows original and stripped values
- Easy to debug if issues occur

✅ **API calls corrected:**
- Before: `LockBoxId eq '1000173-0'` ❌
- After: `LockBoxId eq '1000173'` ✅

The API will now correctly use "1000173" when the LockboxID is "1000173-0"!
