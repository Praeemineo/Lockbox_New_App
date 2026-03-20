# ✅ COMPLETE FIX - All SubledgerOnAccountDocument References Updated

## Issue Summary

The "Subledger On-account" column was showing blank because the backend code was looking for `SubledgerOnaccountDocument` (lowercase 'a') but SAP returns `SubledgerOnAccountDocument` (capital 'A').

## Root Cause

**SAP API Field Name:** `SubledgerOnAccountDocument` (capital 'A' in Account)  
**Our Code Was Using:** `SubledgerOnaccountDocument` (lowercase 'a' in account)

**Result:** Field not found → UI shows blank

---

## All Locations Fixed

### 1. **server.js Line 5535** - Debug Logging ✅
**Before:**
```javascript
console.log(`📋 Subledger on-account: ${doc.SubledgerOnaccountDocument || 'N/A'}`);
```

**After:**
```javascript
console.log(`📋 Subledger on-account (capital A): ${doc.SubledgerOnAccountDocument || 'N/A'}`);
console.log(`📋 Subledger on-account (lowercase a): ${doc.SubledgerOnaccountDocument || 'N/A'}`);
```

---

### 2. **server.js Line 5555** - Data Mapping ✅
**Before:**
```javascript
SubledgerOnaccountDocument: doc.SubledgerOnaccountDocument || '',
```

**After:**
```javascript
SubledgerOnaccountDocument: doc.SubledgerOnAccountDocument || doc.SubledgerOnaccountDocument || '',
```

---

### 3. **server.js Line 2639** - Clearing Documents Formatting ✅
**Before:**
```javascript
subledgerOnaccountDocument: sapDoc.SubledgerOnaccountDocument || sapDoc.subledgerOnaccountDocument || '',
```

**After:**
```javascript
subledgerOnaccountDocument: sapDoc.SubledgerOnAccountDocument || sapDoc.SubledgerOnaccountDocument || sapDoc.subledgerOnaccountDocument || '',
```

---

### 4. **server.js Line 2853** - Update Lockbox Items ✅
**Before:**
```javascript
const subledgerOnaccountDoc = sapDoc.SubledgerOnaccountDocument || sapDoc.subledgerOnaccountDocument || '';
```

**After:**
```javascript
const subledgerOnaccountDoc = sapDoc.SubledgerOnAccountDocument || sapDoc.SubledgerOnaccountDocument || sapDoc.subledgerOnaccountDocument || '';
```

---

### 5. **runService.js Line 197** - RULE-004 Service ✅
**Already Fixed Earlier:**
```javascript
SubledgerOnaccountDocument: doc.SubledgerOnAccountDocument || doc.SubledgerOnaccountDocument || '',
```

---

## Priority Order

All updated code now checks in this order:
1. ✅ `SubledgerOnAccountDocument` (capital 'A' - SAP standard)
2. Fallback: `SubledgerOnaccountDocument` (lowercase 'a' - legacy)
3. Fallback: `subledgerOnaccountDocument` (all lowercase - legacy)

This ensures compatibility with any casing SAP might return.

---

## Expected Results After Fix

### Backend Logs (Line 5535-5536):
```
📊 Subledger Document: 
📋 Subledger on-account (capital A): 1400000054  ✅
📋 Subledger on-account (lowercase a): N/A
```

### UI Display:
```
Item | Document Number | Payment Advice     | Subledger Document | Subledger On-account | Amount
-----|-----------------|--------------------|--------------------|---------------------|--------
1    | 100000127       | 010000017600001    | (empty)            | 1400000054 ✅       | 1365
```

---

## SAP API Response Structure (Confirmed)

**From your example:**
```json
{
  "LockBoxId": "1000203",
  "SendingBank": "LOCKBOXDES LOCKBOXORI",
  "BankStatement": "175",
  "StatementId": "1000203 260220 0000",
  "CompanyCode": "1710",
  "HeaderStatus": "Posted",
  "BankStatementItem": "1",
  "DocumentNumber": "100000126",
  "PaymentAdvice": "010000017500001",
  "SubledgerDocument": "",
  "SubledgerOnAccountDocument": "1400000054",  ← Capital 'A' ✅
  "Amount": 1365.00,
  "TransactionCurrency": "USD",
  "DocumentStatus": "Unknown"
}
```

---

## Complete Field Mapping Table

| UI Column | Backend Variable | SAP API Field | Status |
|-----------|------------------|---------------|--------|
| Document Number | DocumentNumber | DocumentNumber | ✅ |
| Payment Advice | PaymentAdvice | PaymentAdvice | ✅ |
| Subledger Document | SubledgerDocument | SubledgerDocument | ✅ |
| **Subledger On-account** | SubledgerOnaccountDocument | **SubledgerOnAccountDocument** | ✅ **FIXED** |
| Amount | Amount | Amount | ✅ |
| Document Status | DocumentStatus | DocumentStatus | ✅ |

---

## Files Modified

| File | Lines | Changes |
|------|-------|---------|
| `server.js` | 5535-5536 | Updated debug logging to check both casings |
| `server.js` | 5555 | Try capital 'A' first in data mapping |
| `server.js` | 2639 | Try capital 'A' first in clearing docs |
| `server.js` | 2853 | Try capital 'A' first in item updates |
| `runService.js` | 197 | Try capital 'A' first in RULE-004 (already fixed) |

---

## Testing Instructions

### Step 1: Click Navigation Arrow
Go to run: **Lockbox-RUN-2026-00204** and click the Navigation arrow (→)

### Step 2: Go to Item Data Tab
Click on "Item Data" tab in the dialog

### Step 3: Check Logs
```bash
tail -f /var/log/supervisor/backend.out.log | grep -A 10 "Subledger on-account"
```

**Expected:**
```
📋 Subledger on-account (capital A): 1400000054  ✅
📋 Subledger on-account (lowercase a): N/A
```

### Step 4: Verify UI
The table should show:
- **Subledger Document:** (empty or value if SAP has it)
- **Subledger On-account:** 1400000054 ✅

---

## Why This Was Missed Initially

There are **multiple endpoints** that handle lockbox accounting documents:

1. **RULE-004 Service** (`runService.js`) - Fixed first ✅
2. **Main Server Endpoint** (`server.js` line 5400+) - Just fixed now ✅
3. **Clearing Documents Formatting** (`server.js` line 2600+) - Just fixed now ✅
4. **Item Updates** (`server.js` line 2850+) - Just fixed now ✅

Each endpoint independently maps the SAP response fields, so **all** needed to be updated.

---

## Status

✅ **All 5 locations updated**
✅ **Backend restarted**
✅ **Enhanced logging added**
✅ **Ready for testing**

---

**Please test now by clicking the Navigation arrow on run Lockbox-RUN-2026-00204. The "Subledger On-account" column should now display: 1400000054** ✅
