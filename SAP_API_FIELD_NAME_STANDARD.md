# ✅ FINAL FIX - PaymentReference Standardized to SAP API Field Name

## Critical Understanding

**SAP Lockbox API field name:** `PaymentReference` (PascalCase)

**Therefore:** ALL internal code must use **exactly** `PaymentReference` to maintain consistency with the SAP API.

## Problem with Previous Approach

We were trying to handle multiple casings (`PaymentReference`, `Paymentreference`, `paymentreference`) which created confusion and inconsistency.

**Root Cause:** Inconsistent field naming throughout the codebase instead of enforcing the SAP API standard.

## Solution: Enforce SAP API Field Name

**Standard:** Use `PaymentReference` (PascalCase) everywhere - no exceptions, no fallbacks.

## All Changes Made

### 1. **RULE-001 Rule Engine (rule-engine.js line 393-425)**

**Changed:** Removed case-insensitive matching, now uses EXACT field name from config

**Before:**
```javascript
// Case-insensitive match
const existingKey = Object.keys(row).find(k => k.toLowerCase() === lockboxFieldName.toLowerCase());
const fieldToUpdate = existingKey || lockboxFieldName;
```

**After:**
```javascript
// Use EXACT SAP API field name from config
const fieldToUpdate = lockboxFieldName; // PaymentReference
```

**Impact:** RULE-001 will now create/update the exact field `PaymentReference`, not variants.

---

### 2. **Reading Enriched Field (server.js line 6943)**

**Changed:** Only read from `PaymentReference` (no fallback casings)

**Before:**
```javascript
const enrichedPayRef = row.PaymentReference || row.Paymentreference || row.paymentreference || '';
```

**After:**
```javascript
const enrichedPayRef = row.PaymentReference || '';
```

**Impact:** Code now expects exactly `PaymentReference` from RULE-001.

---

### 3. **Storing in Invoice Object (server.js line 6959-6961)**

**Already correct:**
```javascript
PaymentReference: enrichedPayRef,  // Matches SAP API
CompanyCode: row.CompanyCode || ''
```

**Impact:** Invoice object uses SAP API field names.

---

### 4. **Reading for Payload Building (server.js line 7064-7065)**

**Changed:** Only read from exact field names

**Before:**
```javascript
const enrichedPaymentRef = (inv.PaymentReference || inv.paymentreference || '').toString().trim();
const companyCode = (inv.CompanyCode || inv.companyCode || '').toString().trim();
```

**After:**
```javascript
const enrichedPaymentRef = (inv.PaymentReference || '').toString().trim();
const companyCode = (inv.CompanyCode || '').toString().trim();
```

**Impact:** Payload building uses exact SAP API field names.

---

### 5. **Field Mapping Preview (server.js line 7885-7898)**

**Changed:** Only recognize exact SAP API field name

**Before:**
```javascript
'PaymentReference': 'Payment Reference',
'Paymentreference': 'Payment Reference',  // Wrong casing
'paymentreference': 'Payment Reference',  // Wrong casing
```

**After:**
```javascript
'PaymentReference': 'Payment Reference',  // SAP Lockbox API field name
```

**Impact:** Preview only shows the correct SAP API field.

---

## Standardized Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. Excel Upload                                                   │
│    Column: Invoice Number = 90003904                             │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. RULE-001 Enrichment                                            │
│    Config:                                                        │
│      sourceField: "Invoice Number"                               │
│      targetField: "AccountingDocument"                           │
│      apiField: "PaymentReference"  ← EXACT SAP API field name   │
│                                                                   │
│    Creates:                                                       │
│      row["PaymentReference"] = "9400000440"  ✅                  │
│      (Exact field name, no case variants)                        │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. Mapping Stage                                                  │
│    Reads:                                                         │
│      enrichedPayRef = row.PaymentReference  ✅                   │
│      (No fallback casings)                                        │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. Invoice Object                                                 │
│    Stores:                                                        │
│      PaymentReference: "9400000440"  ✅                           │
│      CompanyCode: "1710"  ✅                                      │
│      (Exact SAP API field names)                                  │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ 5. SAP Payload Building                                           │
│    Reads:                                                         │
│      enrichedPaymentRef = inv.PaymentReference  ✅               │
│      (No fallback casings)                                        │
│                                                                   │
│    Builds:                                                        │
│      PaymentReference: "9400000440"  ✅                           │
│      (Exact SAP API field name)                                   │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ 6. Field Mapping Preview                                          │
│    Recognizes:                                                    │
│      "PaymentReference" only  ✅                                  │
│      (No case variants)                                           │
│                                                                   │
│    Displays:                                                      │
│      Payment Reference = 9400000440  ✅                           │
│      Type: API_DERIVED (from RULE-001)                            │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ 7. Database Storage                                               │
│    lockbox_clearing.payment_reference = "9400000440"  ✅         │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ 8. SAP API POST                                                   │
│    Payload:                                                       │
│      {                                                            │
│        "PaymentReference": "9400000440"  ✅                       │
│      }                                                            │
│    (Exact SAP Lockbox API field name)                             │
└──────────────────────────────────────────────────────────────────┘
```

## Configuration Standard

### RULE-001 Configuration (PostgreSQL & File)
```json
{
  "ruleId": "RULE-001",
  "fieldMappings": [
    {
      "sourceField": "Invoice Number",
      "targetField": "AccountingDocument",
      "apiField": "PaymentReference"  ← MUST match SAP Lockbox API exactly
    },
    {
      "sourceField": "Invoice Number",
      "targetField": "CompanyCode",
      "apiField": "CompanyCode"  ← MUST match SAP Lockbox API exactly
    }
  ]
}
```

**Rule:** `apiField` MUST always match the exact SAP Lockbox API field name (PascalCase).

## Expected Results

### ✅ Logs
```
⚙️  Executing RULE-001: Accounting Document Lookup
🔍 Will create/update field: "PaymentReference" (exact SAP API field name)
📞 Calling SAP API: .../AccountingDocument...
✅ Enriched Field: PaymentReference = "9400000440"
✅ Row has RULE-001 enriched PaymentReference: 9400000440, CompanyCode: 1710
✅ Using RULE-001 enriched PaymentReference: 9400000440
PaymentReference: 9400000440, Net: 1365.00
```

### ✅ Mapped Data
```javascript
{
  "Invoice Number": "90003904",
  "PaymentReference": "9400000440",  // ✅ Exact SAP API field name
  "CompanyCode": "1710",
  "_apiDerivedFields": ["PaymentReference", "CompanyCode"]
}
```

### ✅ Field Mapping Preview
```
Section: Clearing
Source Field: Invoice Number
Source Value: 90003904
Type: SOURCE

---

Source Field: —
Source Value: —
Target API Field: Payment Reference
Final Value: 9400000440  ✅
Type: API_DERIVED
Derived From: RULE-001
Transformation: AccountingDocument from SAP
```

### ✅ SAP Payload
```json
{
  "Lockbox": "1234",
  "to_Item": {
    "results": [
      {
        "to_LockboxClearing": {
          "results": [
            {
              "PaymentReference": "9400000440",  ✅
              "NetPaymentAmountInPaytCurrency": "1365.00",
              "Currency": "USD"
            }
          ]
        }
      }
    ]
  }
}
```

## Why This Approach is Correct

1. **Consistency:** All code uses the exact SAP API field name
2. **No Confusion:** No need to handle multiple casings
3. **Maintainable:** Easy to understand and debug
4. **Standard:** Follows SAP API naming convention
5. **Reliable:** No case-matching logic that could fail

## Testing Checklist

- [ ] Upload Excel with InvoiceNumber = 90003904
- [ ] Verify logs show: `Enriched Field: PaymentReference = "9400000440"`
- [ ] Verify mapped data has: `"PaymentReference": "9400000440"`
- [ ] Verify no fields like `Paymentreference` or `paymentreference` exist
- [ ] Verify Field Mapping Preview shows: Payment Reference = 9400000440
- [ ] Verify SAP Payload has: `"PaymentReference": "9400000440"`
- [ ] Verify database: `payment_reference = '9400000440'`
- [ ] Test Production Run successfully posts to SAP

## Summary of Changes

| File | Lines | Change |
|------|-------|--------|
| `rule-engine.js` | 393-425 | Remove case-insensitive matching, use exact apiField name |
| `server.js` | 6943 | Read only from `PaymentReference` |
| `server.js` | 6959-6961 | Already correct (use exact names) |
| `server.js` | 7064-7065 | Read only from exact field names |
| `server.js` | 7885-7898 | Recognize only exact SAP API field name |

## Status

✅ **All code now enforces SAP API field name standard**
✅ **PaymentReference used consistently throughout**
✅ **No case variants or fallbacks**
✅ **Ready for testing**

---

**Principle:** When integrating with external APIs (SAP), always use their EXACT field names throughout your codebase. No variations, no casings, no shortcuts.
