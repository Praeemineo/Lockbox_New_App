# Extraction Results - Customer Payments Upload 16.xlsx

## File Information
- **File Name:** Customer Payments upload 16.xlsx
- **Sheet Name:** Sheet1
- **Total Rows:** 33 (including headers and empty rows)
- **Data Rows:** 1 row with actual data
- **Pattern Detected:** PAT-004 (DOCUMENT_RANGE - Hyphen-Delimited)

---

## Input Data (Original)

### Column Headers
```
┌──────────┬──────────────┬──────────────┬────────────────┬────────────────┬──────────────────┬─────────────┬──────────────┐
│ Customer │ Check Number │ Check Amount │ Invoice Number │ Invoice Amount │ Deduction Amount │ Reason Code │ Deposit Date │
└──────────┴──────────────┴──────────────┴────────────────┴────────────────┴──────────────────┴─────────────┴──────────────┘
```

### Raw Data Row
```
┌──────────┬──────────────┬──────────────┬────────────────┬────────────────┬──────────────────┬─────────────┬──────────────┐
│ 17100009 │ 3456687      │ 2940         │ 90003904-3905  │ 1365.00-1575.00│ 0                │             │ 46117        │
└──────────┴──────────────┴──────────────┴────────────────┴────────────────┴──────────────────┴─────────────┴──────────────┘
```

**Key Observations:**
- ✓ Invoice Number contains hyphen: `90003904-3905`
- ✓ Invoice Amount contains hyphen: `1365.00-1575.00`
- ✓ Pattern: Hyphen-delimited invoice range with corresponding amounts

---

## Pattern Detection Analysis

### Detection Results
```javascript
{
  hasHyphenDelimitedInvoices: true,
  hasHyphenDelimitedAmounts: true,
  recommendedPattern: "PAT-004",
  patternName: "DOCUMENT_RANGE",
  delimiter: "-"
}
```

### Detection Logic
1. **Invoice Number Analysis:**
   - Contains hyphen: ✓
   - Multiple parts after split: ✓ (2 parts: "90003904", "3905")
   - Pattern: Invoice range with common prefix

2. **Invoice Amount Analysis:**
   - Contains hyphen: ✓
   - Multiple valid amounts: ✓ (2 amounts: 1365.00, 1575.00)
   - Pattern: Delimited amounts corresponding to invoices

---

## Processing with PAT-004 (Hyphen Split)

### Step 1: Invoice Number Split
**Input:** `"90003904-3905"`

**Processing:**
```javascript
splitInvoiceReferencesHyphen("90003904-3905")
  ↓
Split by hyphen: ["90003904", "3905"]
  ↓
Detect common prefix:
  - First part: "90003904" (length: 8)
  - Second part: "3905" (length: 4)
  - Prefix length: 8 - 4 = 4
  - Common prefix: "900039"
  ↓
Expand with prefix:
  - "90003904" (keep as is)
  - "900039" + "05" = "90003905"
  ↓
Result: ["90003904", "90003905"]
```

---

### Step 2: Invoice Amount Split
**Input:** `"1365.00-1575.00"`

**Processing:**
```javascript
Split by hyphen: ["1365.00", "1575.00"]
  ↓
Parse each amount:
  - "1365.00" → 1365
  - "1575.00" → 1575
  ↓
Result: [1365, 1575]
```

---

### Step 3: Invoice-Amount Pairing
**Invoices:** `["90003904", "90003905"]`  
**Amounts:** `[1365, 1575]`

**Pairing Logic:**
```
Count check: 2 invoices, 2 amounts
  ↓
Matching counts detected
  ↓
Apply pairing strategy: invoice[i] with amount[i]
  ↓
Result:
  1. Invoice: "90003904" → Amount: 1365
  2. Invoice: "90003905" → Amount: 1575
```

---

## Extracted Data (Output)

### Summary
- **Original Rows:** 1
- **Extracted Rows:** 2
- **Rows Expanded:** 1 (100% increase)
- **Split Type:** HYPHEN_RANGE

---

### Row 1 (Extracted)
```javascript
{
  Customer: "17100009",
  CheckNumber: "3456687",
  CheckAmount: 2940,
  InvoiceNumber: "90003904",        // ✓ First invoice from range
  InvoiceAmount: 1365,               // ✓ First amount (paired)
  DeductionAmount: 0,
  ReasonCode: "",
  DepositDate: "46117",
  _splitFrom: "90003904-3905",       // Original value
  _splitType: "HYPHEN_RANGE"         // Split method
}
```

---

### Row 2 (Extracted)
```javascript
{
  Customer: "17100009",
  CheckNumber: "3456687",
  CheckAmount: 2940,
  InvoiceNumber: "90003905",        // ✓ Second invoice (prefix expanded)
  InvoiceAmount: 1575,               // ✓ Second amount (paired)
  DeductionAmount: 0,
  ReasonCode: "",
  DepositDate: "46117",
  _splitFrom: "90003904-3905",       // Original value
  _splitType: "HYPHEN_RANGE"         // Split method
}
```

---

## Visual Representation

### Original Data → Split Data

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ORIGINAL ROW                                 │
├──────────┬──────────────┬────────────────┬────────────────────────┤
│ Customer │ Check Number │ Invoice Number │ Invoice Amount         │
│ 17100009 │ 3456687      │ 90003904-3905  │ 1365.00-1575.00        │
└──────────┴──────────────┴────────────────┴────────────────────────┘
                              ↓
                    PAT-004 HYPHEN SPLIT
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         SPLIT INTO 2 ROWS                           │
├──────────┬──────────────┬────────────────┬────────────────────────┤
│ Customer │ Check Number │ Invoice Number │ Invoice Amount         │
├──────────┼──────────────┼────────────────┼────────────────────────┤
│ 17100009 │ 3456687      │ 90003904       │ 1365.00               │ ← Row 1
│ 17100009 │ 3456687      │ 90003905       │ 1575.00               │ ← Row 2
└──────────┴──────────────┴────────────────┴────────────────────────┘
```

---

## Validation

### Amount Validation
```
Original Check Amount: $2940
Split Invoice Amounts: $1365 + $1575 = $2940
Validation: ✓ PASS (amounts match)
```

### Invoice Number Validation
```
Original: "90003904-3905"
Split: ["90003904", "90003905"]
Prefix Expansion: ✓ PASS (common prefix "900039" correctly applied)
Sequential: ✓ PASS (90003905 = 90003904 + 1)
```

### Pairing Validation
```
Invoice-Amount Pairs:
  1. 90003904 → 1365 ✓
  2. 90003905 → 1575 ✓
Pairing: ✓ PASS (correct 1:1 mapping)
```

---

## SAP Payload Preview

### Check Entry
```json
{
  "Lockbox": "1000070",
  "Cheque": "3456687",
  "AmountInTransactionCurrency": "2940.00",
  "Currency": "USD",
  "to_LockboxClearing": {
    "results": [
      {
        "LockboxBatchItem": "1",
        "PaymentReference": "90003904",
        "NetPaymentAmountInPaytCurrency": "1365.00",
        "Currency": "USD"
      },
      {
        "LockboxBatchItem": "2",
        "PaymentReference": "90003905",
        "NetPaymentAmountInPaytCurrency": "1575.00",
        "Currency": "USD"
      }
    ]
  }
}
```

---

## Processing Statistics

| Metric | Value |
|--------|-------|
| **Input Rows** | 1 |
| **Output Rows** | 2 |
| **Expansion Rate** | 100% |
| **Split Type** | HYPHEN_RANGE |
| **Pattern ID** | PAT-004 |
| **Invoices Expanded** | 2 |
| **Amounts Paired** | 2 |
| **Common Prefix Detected** | ✓ Yes ("900039") |
| **Validation Status** | ✓ All Passed |

---

## Feature Highlights

### ✅ What Worked
1. **Common Prefix Expansion**
   - Detected "900039" as common prefix
   - Expanded "3905" to "90003905"

2. **Amount Pairing**
   - Correctly split "1365.00-1575.00" into [1365, 1575]
   - Paired invoice[0] with amount[0], invoice[1] with amount[1]

3. **Metadata Tracking**
   - Added `_splitFrom` to track original value
   - Added `_splitType` to identify split method

4. **Validation**
   - Check amount matches sum of invoice amounts
   - Invoice numbers sequential and valid

---

## Next Steps

### For Production Run:
1. ✅ **Upload Complete** - File processed successfully
2. ✅ **Pattern Detected** - PAT-004 (DOCUMENT_RANGE)
3. ✅ **Data Extracted** - 2 rows with paired invoice-amount
4. ⏳ **Ready for Simulation** - Preview SAP payload
5. ⏳ **Execute Production** - Post to SAP S/4HANA

### Expected SAP Result:
```
✓ Lockbox Batch Posted
  └─ Payment Advice: 010000121800001
      └─ Check 3456687 ($2940)
          ├─ Clearing Entry 1: Invoice 90003904, Amount $1365.00
          └─ Clearing Entry 2: Invoice 90003905, Amount $1575.00
```

---

## Comparison: Before vs After

### BEFORE (Old Logic)
```
Input: "90003904-3905"
  ↓
Regex: /(\d+)-(\d+)/
  ↓
Match: ["90003904", "3905"]
  ↓
Result: 90003904, 3905 ❌ (Wrong - missing prefix on second invoice)
Amount: $1470 each (equal split) ❌ (Wrong - should be different amounts)
```

### AFTER (New Logic)
```
Input: "90003904-3905" + "1365.00-1575.00"
  ↓
Smart Split: Common prefix detected
  ↓
Result: 90003904, 90003905 ✓ (Correct)
Amount: $1365, $1575 ✓ (Correct - paired amounts)
```

---

**Extraction Status:** ✅ **COMPLETE & VALIDATED**  
**Pattern:** PAT-004 (DOCUMENT_RANGE)  
**Split Type:** HYPHEN_RANGE  
**Ready for:** SAP Production Run

---

**File:** Customer Payments upload 16.xlsx  
**Processed:** April 9, 2025  
**Pattern Engine:** Advanced Hyphen Splitting v3.0
