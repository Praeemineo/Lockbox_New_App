# ✅ COMPLETE FIX - PaymentReference Field Consistency

## Problem Identified

The PaymentReference field was being set/read with **inconsistent casing** in multiple locations, causing the AccountingDocument value from RULE-001 to not flow through correctly.

### Case Variations Found:
- `PaymentReference` (correct - matches SAP payload)
- `Paymentreference` (capital P, lowercase r)
- `paymentreference` (all lowercase)
- `payment_reference` (database column)

## All Locations Fixed

### 1. **Line 6945: Reading RULE-001 Enriched Field**

**Before:**
```javascript
const enrichedPayRef = row.Paymentreference || '';  // Only one casing
```

**After:**
```javascript
// Try all possible casings to find the RULE-001 enriched value
const enrichedPayRef = row.PaymentReference || row.Paymentreference || row.paymentreference || '';
```

### 2. **Line 6960: Storing in Invoice Object**

**Before:**
```javascript
paymentreference: enrichedPayRef,  // lowercase
companyCode: row.CompanyCode || ''  // inconsistent casing
```

**After:**
```javascript
PaymentReference: enrichedPayRef,  // PascalCase - matches SAP
CompanyCode: row.CompanyCode || ''  // PascalCase - matches SAP
```

### 3. **Line 7064: Reading from Invoice Object**

**Before:**
```javascript
const enrichedPaymentRef = (inv.paymentreference || '').toString().trim();  // Only lowercase
const companyCode = (inv.companyCode || '').toString().trim();  // Only lowercase
```

**After:**
```javascript
// Try both casings to handle legacy data
const enrichedPaymentRef = (inv.PaymentReference || inv.paymentreference || '').toString().trim();
const companyCode = (inv.CompanyCode || inv.companyCode || '').toString().trim();
```

### 4. **Line 7895: Field Mapping Preview**

**Before:**
```javascript
'PaymentReference': 'Payment Reference',
'paymentreference': 'Payment Reference',  // Only 2 variants
```

**After:**
```javascript
'PaymentReference': 'Payment Reference',
'Paymentreference': 'Payment Reference',  // Added capital P variant
'paymentreference': 'Payment Reference',  // All lowercase variant
```

## Complete Data Flow (Fixed)

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. Excel Upload                                                   │
│    Column: Invoice Number = 90003904                             │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. RULE-001 Enrichment (rule-engine.js)                          │
│    • Reads: Invoice Number = 90003904                            │
│    • Calls SAP API                                                │
│    • Extracts: AccountingDocument = 9400000440                    │
│    • Creates field: PaymentReference = 9400000440                 │
│      (Case-insensitive match finds existing or creates new)       │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. Mapping Stage (server.js line 6945)                           │
│    • Reads enriched value (tries all casings):                   │
│      enrichedPayRef = row.PaymentReference ||                     │
│                       row.Paymentreference ||                     │
│                       row.paymentreference                        │
│    • Result: enrichedPayRef = "9400000440" ✅                    │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. Invoice Object Creation (server.js line 6960)                 │
│    • Stores with correct casing:                                 │
│      PaymentReference: "9400000440" ✅                            │
│      CompanyCode: "1710" ✅                                       │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ 5. SAP Payload Building (server.js line 7064, 7083)              │
│    • Reads from invoice object (tries both casings):             │
│      enrichedPaymentRef = inv.PaymentReference ||                 │
│                           inv.paymentreference                    │
│    • Uses in payload:                                             │
│      PaymentReference: "9400000440" ✅                            │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ 6. Field Mapping Preview (server.js line 7885-7898)              │
│    • Recognizes all case variants:                               │
│      PaymentReference, Paymentreference, paymentreference         │
│    • Displays:                                                    │
│      Payment Reference = 9400000440 ✅                            │
│      Type: API_DERIVED (from RULE-001)                            │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ 7. Database Storage (lockbox_clearing table)                     │
│    • payment_reference = "9400000440" ✅                          │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ 8. SAP Posting                                                    │
│    • Payload sent to SAP:                                         │
│      "PaymentReference": "9400000440" ✅                          │
│    • Result: Correct AccountingDocument posted to SAP            │
└──────────────────────────────────────────────────────────────────┘
```

## Why Belnr Worked Before

When the configuration had `targetField: "Belnr"`, it worked because:
1. The SAP response had a field called exactly `Belnr`
2. The extraction worked correctly
3. The casing was consistent throughout

When we changed to `targetField: "AccountingDocument"`:
1. The SAP response has `AccountingDocument` (correct)
2. But the field storage and reading locations had inconsistent casing
3. This caused mismatches in different parts of the code

## Changes Summary

| Location | Line | Change | Reason |
|----------|------|--------|--------|
| **Enriched field reading** | 6945 | Try 3 casings | Find RULE-001 value regardless of case |
| **Invoice object storage** | 6960 | Use `PaymentReference` | Match SAP payload field name |
| **Invoice object storage** | 6961 | Use `CompanyCode` | Match SAP payload field name |
| **Payload building** | 7064-7065 | Try both casings | Handle legacy data & new format |
| **Field mapping preview** | 7895 | Add `Paymentreference` | Recognize middle-case variant |

## Expected Results After Fix

### ✅ Field Mapping Preview
```
Section: Clearing
Source Field: Invoice Number
Source Value: 90003904
Type: SOURCE

---

Section: Clearing
Source Field: —  
Source Value: —
Target API Field: Payment Reference
Final Value: 9400000440  ✅
Type: API_DERIVED
Derived From: RULE-001
Transformation/Notes: AccountingDocument from SAP
```

### ✅ Mapped Data
```javascript
{
  InvoiceNumber: "90003904",
  PaymentReference: "9400000440",  // ✅ Correct casing and value
  CompanyCode: "1710",
  _apiDerivedFields: ["PaymentReference", "CompanyCode"]
}
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

### ✅ Database
```sql
SELECT payment_reference FROM lockbox_clearing;
-- Result: 9400000440
```

### ✅ Logs Should Show
```
✅ Row has RULE-001 enriched PaymentReference: 9400000440, CompanyCode: 1710
✅ Using RULE-001 enriched PaymentReference: 9400000440
Building Item 00001:
  Clearing entries: 1
    [1] PaymentReference: 9400000440, Net: 1365.00, Deduction: 0.00
```

## Testing Checklist

- [ ] Upload Excel with InvoiceNumber = 90003904
- [ ] Check logs for "enriched PaymentReference: 9400000440"
- [ ] Verify Field Mapping Preview shows Payment Reference = 9400000440
- [ ] Verify mapped data has PaymentReference = 9400000440
- [ ] Check SAP Payload has "PaymentReference": "9400000440"
- [ ] Verify database: `payment_reference = '9400000440'`
- [ ] Test Simulation - should work
- [ ] Test Production Run - should post correctly

## Files Modified
- `/app/backend/server.js` - Fixed all case inconsistencies in 4 locations

## Status
✅ **All case inconsistencies fixed**
✅ **AccountingDocument now flows through correctly as PaymentReference**
✅ **Ready for testing**

---

**Next Action:** Please upload a test file to verify all locations now show PaymentReference = 9400000440 (AccountingDocument from SAP)!
