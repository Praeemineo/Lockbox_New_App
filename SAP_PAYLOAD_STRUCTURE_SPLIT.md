# SAP Payload Structure - Hyphen-Delimited Invoice Split

## Input Data

**Excel File Row:**
```
Customer:       17100009
Check Number:   3456687
Check Amount:   2940
Invoice Number: 90003904-3905
Invoice Amount: 1365.00-1575.00
Deduction:      0
Deposit Date:   46117
```

---

## Expected SAP Payload (POST to LockboxBatch)

### Complete JSON Payload

```json
{
  "Lockbox": "1000070",
  "DepositDateTime": "2025-12-31T00:00:00",
  "AmountInTransactionCurrency": "2940.00",
  "LockboxBatchOrigin": "BANK_US",
  "LockboxBatchDestination": "COMP_1710",
  "to_Item": {
    "results": [
      {
        "LockboxBatchItem": "1",
        "Cheque": "3456687",
        "AmountInTransactionCurrency": "2940.00",
        "Currency": "USD",
        "PartnerBank": "",
        "PartnerBankAccount": "",
        "PartnerBankCountry": "",
        "to_LockboxClearing": {
          "results": [
            {
              "PaymentReference": "4900012345",
              "NetPaymentAmountInPaytCurrency": "1365.00",
              "DeductionAmountInPaytCurrency": "0.00",
              "Currency": "USD"
            },
            {
              "PaymentReference": "4900012346",
              "NetPaymentAmountInPaytCurrency": "1575.00",
              "DeductionAmountInPaytCurrency": "0.00",
              "Currency": "USD"
            }
          ]
        }
      }
    ]
  }
}
```

---

## Payload Structure Breakdown

### Level 1: Lockbox Header
```json
{
  "Lockbox": "1000070",                              // From API Fields (constant)
  "DepositDateTime": "2025-12-31T00:00:00",          // From Excel file
  "AmountInTransactionCurrency": "2940.00",          // Total check amount
  "LockboxBatchOrigin": "BANK_US",                   // From API Fields (constant)
  "LockboxBatchDestination": "COMP_1710",            // From API Fields (constant)
  "to_Item": { ... }
}
```

---

### Level 2: Check Item (to_Item)
```json
{
  "results": [
    {
      "LockboxBatchItem": "1",                       // Sequential item number
      "Cheque": "3456687",                           // From Excel: Check Number
      "AmountInTransactionCurrency": "2940.00",      // From Excel: Check Amount
      "Currency": "USD",                             // From API Fields (default)
      "PartnerBank": "",                             // From Excel (optional)
      "PartnerBankAccount": "",                      // From Excel (optional)
      "PartnerBankCountry": "",                      // From Excel (optional)
      "to_LockboxClearing": { ... }
    }
  ]
}
```

**Key Points:**
- ONE check item per check number
- Check 3456687 with total amount 2940
- Contains nested clearing entries

---

### Level 3: Clearing Entries (to_LockboxClearing) - ⭐ THIS IS WHERE SPLIT HAPPENS

```json
{
  "results": [
    {
      // ===== CLEARING ENTRY 1 (Invoice 90003904) =====
      "PaymentReference": "4900012345",              // From RULE_FETCH_ACCT_DOC (Invoice 90003904)
      "NetPaymentAmountInPaytCurrency": "1365.00",   // From split amount (1365)
      "DeductionAmountInPaytCurrency": "0.00",       // From Excel
      "Currency": "USD"                              // From API Fields
    },
    {
      // ===== CLEARING ENTRY 2 (Invoice 90003905) =====
      "PaymentReference": "4900012346",              // From RULE_FETCH_ACCT_DOC (Invoice 90003905)
      "NetPaymentAmountInPaytCurrency": "1575.00",   // From split amount (1575)
      "DeductionAmountInPaytCurrency": "0.00",       // From Excel
      "Currency": "USD"                              // From API Fields
    }
  ]
}
```

**Key Points:**
- TWO clearing entries (one per split invoice)
- Entry 1: Invoice 90003904 → Amount 1365
- Entry 2: Invoice 90003905 → Amount 1575
- Total: 1365 + 1575 = 2940 ✓ (matches check amount)

---

## Field Mapping Details

### PaymentReference (Most Critical Field)

**Source:** RULE_FETCH_ACCT_DOC enrichment

**Logic:**
```javascript
// For each split invoice:
// 1. Call SAP API to get accounting document
// 2. Use AccountingDocument number as PaymentReference

Invoice 90003904 → RULE_FETCH_ACCT_DOC → AccountingDocument: 4900012345
Invoice 90003905 → RULE_FETCH_ACCT_DOC → AccountingDocument: 4900012346
```

**SAP API Call (for each invoice):**
```
GET /sap/opu/odata/sap/API_LOCKBOXPOST_IN/AccountingDocument
Parameters:
  Customer: 17100009
  CompanyCode: 1710
  InvoiceNumber: 90003904  (then 90003905)
```

**Response:**
```json
{
  "AccountingDocument": "4900012345",
  "CompanyCode": "1710"
}
```

---

### NetPaymentAmountInPaytCurrency

**Source:** Split invoice amount from Excel

**Logic:**
```javascript
// After hyphen split:
Row 1: InvoiceAmount = 1365  → "1365.00"
Row 2: InvoiceAmount = 1575  → "1575.00"
```

**Format:** Always 2 decimal places (e.g., "1365.00")

---

## Comparison: Wrong vs Correct Payload

### ❌ WRONG (What's Currently Happening)

```json
{
  "to_LockboxClearing": {
    "results": [
      {
        "PaymentReference": "100000161",            // Wrong: Single reference
        "NetPaymentAmountInPaytCurrency": "2940.00", // Wrong: Total amount
        "Currency": "USD"
      }
    ]
  }
}
```

**Issues:**
- Only ONE clearing entry
- Uses TOTAL amount (2940) instead of split amounts
- Missing second invoice (90003905)

---

### ✅ CORRECT (Expected Payload)

```json
{
  "to_LockboxClearing": {
    "results": [
      {
        "PaymentReference": "4900012345",           // Correct: Invoice 90003904
        "NetPaymentAmountInPaytCurrency": "1365.00", // Correct: Split amount 1
        "Currency": "USD"
      },
      {
        "PaymentReference": "4900012346",           // Correct: Invoice 90003905
        "NetPaymentAmountInPaytCurrency": "1575.00", // Correct: Split amount 2
        "Currency": "USD"
      }
    ]
  }
}
```

**Correct:**
- TWO clearing entries (one per invoice)
- Individual amounts (1365, 1575)
- Unique PaymentReference for each

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ INPUT: Excel File                                               │
├─────────────────────────────────────────────────────────────────┤
│ Invoice Number: 90003904-3905                                   │
│ Invoice Amount: 1365.00-1575.00                                 │
│ Check Number:   3456687                                         │
│ Check Amount:   2940                                            │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 3: Pattern Split (PAT-004: HYPHEN_RANGE)                 │
├─────────────────────────────────────────────────────────────────┤
│ Row 1: Invoice 90003904, Amount 1365                            │
│ Row 2: Invoice 90003905, Amount 1575                            │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 4: Enrichment (RULE_FETCH_ACCT_DOC)                      │
├─────────────────────────────────────────────────────────────────┤
│ Row 1: PaymentReference = "4900012345"                          │
│ Row 2: PaymentReference = "4900012346"                          │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 5: Payload Building                                      │
├─────────────────────────────────────────────────────────────────┤
│ Check Item 1: Cheque "3456687", Amount 2940                     │
│   ├─ Clearing Entry 1: PaymentRef "4900012345", Amount 1365    │
│   └─ Clearing Entry 2: PaymentRef "4900012346", Amount 1575    │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ OUTPUT: SAP Payload (POST to LockboxBatch)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## SAP Response After POST

### Expected Response Structure

```json
{
  "d": {
    "LockboxBatchInternalKey": "00001234",
    "Lockbox": "1000070",
    "DepositDateTime": "2025-12-31T00:00:00",
    "AmountInTransactionCurrency": "2940.00",
    "to_Item": {
      "results": [
        {
          "LockboxBatchInternalKey": "00001234",
          "LockboxBatchItem": "1",
          "PaymentAdvice": "010000121800001",          // Generated by SAP
          "Cheque": "3456687",
          "to_LockboxClearing": {
            "results": [
              {
                "PaymentAdvice": "010000121800001",
                "PaymentAdviceItem": "1",
                "PaymentReference": "4900012345",       // Invoice 90003904
                "NetPaymentAmountInPaytCurrency": "1365.00"
              },
              {
                "PaymentAdvice": "010000121800001",
                "PaymentAdviceItem": "2",
                "PaymentReference": "4900012346",       // Invoice 90003905
                "NetPaymentAmountInPaytCurrency": "1575.00"
              }
            ]
          }
        }
      ]
    }
  }
}
```

---

## GET LockboxClearing Calls (After POST)

After successful POST, the system should make GET calls for EACH clearing entry:

### Call 1: Get Clearing Details for Invoice 90003904
```
GET /sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxClearing(
  PaymentAdvice='010000121800001',
  PaymentAdviceItem='1',
  PaymentAdviceAccount='17100009',
  PaymentAdviceAccountType='D',
  CompanyCode='1710'
)
```

**Response:**
```json
{
  "PaymentAdvice": "010000121800001",
  "PaymentAdviceItem": "1",
  "AccountingDocument": "140000077",              // Clearing document
  "NetPaymentAmountInPaytCurrency": "1365.00",
  "Currency": "USD"
}
```

---

### Call 2: Get Clearing Details for Invoice 90003905
```
GET /sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxClearing(
  PaymentAdvice='010000121800001',
  PaymentAdviceItem='2',
  PaymentAdviceAccount='17100009',
  PaymentAdviceAccountType='D',
  CompanyCode='1710'
)
```

**Response:**
```json
{
  "PaymentAdvice": "010000121800001",
  "PaymentAdviceItem": "2",
  "AccountingDocument": "140000078",              // Clearing document
  "NetPaymentAmountInPaytCurrency": "1575.00",
  "Currency": "USD"
}
```

---

## Validation Checks

### Amount Validation
```javascript
// Check amount must equal sum of clearing amounts
Check Amount: 2940
Clearing Entry 1: 1365
Clearing Entry 2: 1575
Sum: 1365 + 1575 = 2940 ✓ PASS
```

### Count Validation
```javascript
// Number of clearing entries must match number of split invoices
Split Invoices: 2 (90003904, 90003905)
Clearing Entries: 2
Match: ✓ PASS
```

### PaymentReference Validation
```javascript
// Each clearing entry must have unique PaymentReference
Entry 1: "4900012345" ✓ Unique
Entry 2: "4900012346" ✓ Unique
Validation: ✓ PASS
```

---

## Code Location

**Payload Building Function:**
```
File: /app/backend/server.js
Function: buildStandardPayload()
Lines: 7062-7400
```

**Clearing Entry Creation:**
```
File: /app/backend/server.js
Lines: 7263-7308

const clearingResults = checkData.invoices.map(inv => {
  // Creates one clearing entry per invoice
  return {
    PaymentReference: inv.PaymentReference,
    NetPaymentAmountInPaytCurrency: parseFloat(inv.invoiceAmount).toFixed(2),
    Currency: currency
  };
});
```

---

## Summary

**Expected Payload Structure:**
- ✅ ONE Lockbox header (total amount: 2940)
- ✅ ONE Check item (check 3456687, amount: 2940)
- ✅ TWO Clearing entries:
  - Entry 1: PaymentRef "4900012345", Amount 1365
  - Entry 2: PaymentRef "4900012346", Amount 1575

**Key Field:** `to_LockboxClearing.results[]` array must have 2 entries

---

**This is the CORRECT payload structure that should be sent to SAP!** 🎯
