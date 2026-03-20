# ✅ RULE-004 Subledger Field Name Case Fix

## Issue Found

The Navigation view's "Subledger On-account" column was showing blank even though SAP API returned a value.

### Root Cause: Field Name Case Mismatch

**SAP API Returns:**
```json
{
  "SubledgerDocument": "",
  "SubledgerOnAccountDocument": "1400000054"  ← Capital 'A' in Account
}
```

**Backend Code Was Looking For:**
```javascript
SubledgerOnaccountDocument: doc.SubledgerOnaccountDocument  ← Lowercase 'a' in account ❌
```

**Result:** Field not found, showing as blank in UI

---

## Fix Applied

### File: `/app/backend/services/runService.js` (Line 196)

**Before:**
```javascript
SubledgerOnaccountDocument: doc.SubledgerOnaccountDocument || '',
```

**After:**
```javascript
SubledgerOnaccountDocument: doc.SubledgerOnAccountDocument || doc.SubledgerOnaccountDocument || '',
```

**Change:** Try both casings:
1. First: `SubledgerOnAccountDocument` (capital 'A' - SAP standard) ✅
2. Fallback: `SubledgerOnaccountDocument` (lowercase 'a' - if format changes)

---

## Enhanced Debug Logging

**Added (Line 180-181):**
```javascript
console.log(`      SubledgerOnAccountDocument: "${doc.SubledgerOnAccountDocument || ''}" (capital A)`);
console.log(`      SubledgerOnaccountDocument: "${doc.SubledgerOnaccountDocument || ''}" (lowercase a)`);
```

**Purpose:** Shows both field variations in logs to identify which one SAP returns

---

## Expected Results After Fix

### Before Fix:
```
📄 Document 1 field mapping:
   SubledgerDocument: ""
   SubledgerOnaccountDocument: ""  ← Wrong field name, no value found
   DocumentNumber: "100000126"
```

**UI Display:**
```
Subledger Document: N/A
Subledger On-account: N/A  ← Blank even though data exists!
```

---

### After Fix:
```
📄 Document 1 field mapping:
   SubledgerDocument: ""
   SubledgerOnAccountDocument: "1400000054"  ← Correct! (capital A)
   SubledgerOnaccountDocument: ""  ← Not found (lowercase a)
   DocumentNumber: "100000126"
```

**UI Display:**
```
Subledger Document: (empty)
Subledger On-account: 1400000054  ✅ Now showing the value!
```

---

## SAP API Field Names (Confirmed)

From SAP response for Lockbox ID 1000203:

| Field Name (SAP API) | Our Mapping | Value | Status |
|---------------------|-------------|-------|--------|
| `SubledgerDocument` | SubledgerDocument | "" | ✅ Correct |
| `SubledgerOnAccountDocument` | SubledgerOnaccountDocument | "1400000054" | ✅ Fixed |
| `DocumentNumber` | DocumentNumber | "100000126" | ✅ Correct |
| `PaymentAdvice` | PaymentAdvice | "010000017500001" | ✅ Correct |

**Note:** SAP uses **`SubledgerOnAccountDocument`** (capital 'A') not `SubledgerOnaccountDocument`

---

## Complete SAP Response Example

```json
{
  "value": [
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
      "SubledgerOnAccountDocument": "1400000054",  ← This is the field!
      "Amount": 1365.00,
      "TransactionCurrency": "USD",
      "DocumentStatus": "Unknown"
    }
  ]
}
```

---

## Testing Instructions

### Step 1: Click Navigation Arrow
- Go to a posted production run
- Click the Navigation arrow (→) icon

### Step 2: View Item Data Table
- Click "Item Data" tab
- Check the table columns

### Step 3: Expected Display

**Table should show:**
| Item | Document Number | Payment Advice | **Subledger Document** | **Subledger On-account** | Amount |
|------|-----------------|----------------|------------------------|--------------------------|--------|
| 1 | 100000126 | 010000017500001 | (empty) | **1400000054** ✅ | 1365.00 |

### Step 4: Check Backend Logs

```bash
tail -f /var/log/supervisor/backend.out.log | grep -A 5 "Document.*field mapping"
```

**Expected Log Output:**
```
📄 Document 1 field mapping:
   SubledgerDocument: ""
   SubledgerOnAccountDocument: "1400000054" (capital A)
   SubledgerOnaccountDocument: "" (lowercase a)
   DocumentNumber: "100000126"
   PaymentAdvice: "010000017500001"
```

---

## Why This Happened

SAP field names follow **PascalCase** convention:
- ✅ `SubledgerOnAccountDocument` (correct)
- ❌ `SubledgerOnaccountDocument` (wrong)

The initial implementation assumed lowercase 'a', but SAP uses capital 'A'.

---

## Similar Issues to Check

If other fields are also showing blank, check for case mismatches:

| Our Code | SAP API Might Use |
|----------|-------------------|
| `DocumentNumber` | `DocumentNumber` ✅ |
| `PaymentAdvice` | `PaymentAdvice` ✅ |
| `CompanyCode` | `CompanyCode` ✅ |
| `BankStatement` | `BankStatement` ✅ |

**General Rule:** SAP OData APIs use **PascalCase** - always match the exact casing from SAP response.

---

## Files Modified

| File | Line | Change |
|------|------|--------|
| `runService.js` | 196 | Try `SubledgerOnAccountDocument` first (capital A) |
| `runService.js` | 180-181 | Added debug logs for both field name variations |

---

## Status

✅ **Fix Applied**
✅ **Backend Restarted**
✅ **Enhanced Logging Added**
✅ **Ready for Testing**

---

**Please click the Navigation arrow on a posted run and verify the "Subledger On-account" column now shows: 1400000054** ✅
