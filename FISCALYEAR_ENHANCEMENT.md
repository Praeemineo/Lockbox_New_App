# FiscalYear Enhancement - RULE_FETCH_ACCT_DOC (FOR REPORTING ONLY)

## ⚠️ IMPORTANT UPDATE

**FiscalYear is fetched and stored for reporting purposes ONLY.**  
**It is NOT sent to SAP in the clearing entry payload** (SAP API rejects it).

---

## Overview
Enhanced `RULE_FETCH_ACCT_DOC` to fetch and store `FiscalYear` from SAP API for reporting and audit purposes. The FiscalYear is stored in the enriched data but is NOT included in the SAP production run payload.

---

## SAP API Error (Resolved)

**Error Received:**
```
Property 'FiscalYear' is invalid
```

**Root Cause:** SAP Lockbox API (`API_LOCKBOXPOST_IN`) does not accept `FiscalYear` field in the `to_LockboxClearing` entry structure.

**Resolution:** FiscalYear is still fetched and stored for internal use but is NOT sent to SAP.

---

## Changes Made

### 1. Rule Configuration Updated ✅

**File:** `/app/backend/data/processing_rules.json`

**Added Field Mapping:**
```json
{
  "sourceField": "Invoice Number",
  "targetField": "FiscalYear",
  "apiField": "FiscalYear"
}
```

**Complete Field Mappings (RULE_FETCH_ACCT_DOC):**
```json
{
  "ruleId": "RULE_FETCH_ACCT_DOC",
  "ruleName": "Accounting Document Lookup",
  "fieldMappings": [
    {
      "sourceField": "Invoice Number",
      "targetField": "AccountingDocument",
      "apiField": "PaymentReference"
    },
    {
      "sourceField": "Invoice Number",
      "targetField": "CompanyCode",
      "apiField": "CompanyCode"
    },
    {
      "sourceField": "Invoice Number",
      "targetField": "FiscalYear",
      "apiField": "FiscalYear"
    }
  ]
}
```

---

### 2. Enriched Data Storage ✅

**File:** `/app/backend/server.js` (Lines 7155-7167)

**Invoice Grouping Updated:**
```javascript
checkGroups[checkKey].invoices.push({
    invoiceNumber: row['Invoice Number'] || row.InvoiceNumber,
    invoiceAmount: parseFloat(row['Invoice Amount'] || row.InvoiceAmount),
    // ... other fields ...
    PaymentReference: enrichedPayRef,     // From RULE_FETCH_ACCT_DOC
    CompanyCode: row.CompanyCode || '',   // From RULE_FETCH_ACCT_DOC
    FiscalYear: row.FiscalYear || ''      // ✅ NEW: From RULE_FETCH_ACCT_DOC
});
```

---

### 3. SAP Payload Updated ✅

**File:** `/app/backend/server.js` (Lines 7298-7320)

**Clearing Entry Building:**
```javascript
const clearing = {
    PaymentReference: paymentReference.substring(0, 30),
    NetPaymentAmountInPaytCurrency: parseFloat(inv.invoiceAmount).toFixed(2),
    DeductionAmountInPaytCurrency: parseFloat(inv.deductionAmount).toFixed(2),
    Currency: currency
};

// ✅ NEW: Add FiscalYear if available from RULE_FETCH_ACCT_DOC
if (fiscalYear) {
    clearing.FiscalYear = fiscalYear;
    console.log(`    ✅ Adding FiscalYear to clearing entry: ${fiscalYear}`);
}
```

---

### 4. Debug Logging Enhanced ✅

**Added FiscalYear to debug logs:**

**Post-Enrichment Log:**
```javascript
console.log(`Row ${i+1}: ..., FiscalYear="${row.FiscalYear || 'EMPTY'}"`);
```

**Check Groups Log:**
```javascript
console.log(`Invoice ${i+1}: ..., FiscalYear="${inv.FiscalYear || 'EMPTY'}"`);
```

**Clearing Entry Log:**
```javascript
console.log(`✅ Adding FiscalYear to clearing entry: ${fiscalYear}`);
```

---

## Data Flow

### STAGE 4: Enrichment (RULE_FETCH_ACCT_DOC)

**For each split invoice:**

```
Input Row:
  InvoiceNumber: "90003904"

  ↓

SAP API Call:
  GET /sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/
      ZFI_I_ACC_DOCUMENT(P_DocumentNumber='90003904')/Set

  ↓

SAP Response:
  {
    "PaymentReference": "4900012345",
    "CompanyCode": "1710",
    "FiscalYear": "2025"              ← ✅ NEW: Fiscal Year
  }

  ↓

Enriched Row:
  {
    InvoiceNumber: "90003904",
    InvoiceAmount: 1365,
    PaymentReference: "4900012345",
    CompanyCode: "1710",
    FiscalYear: "2025"                ← ✅ Stored in enriched data
  }
```

---

### STAGE 5: Payload Building (FiscalYear NOT Included)

**Clearing Entry Creation:**

```javascript
// From enriched data (for reporting)
const fiscalYear = inv.FiscalYear;  // "2025" - stored but NOT sent to SAP

// Build clearing entry (FiscalYear excluded)
const clearing = {
    PaymentReference: "4900012345",
    NetPaymentAmountInPaytCurrency: "1365.00",
    DeductionAmountInPaytCurrency: "0.00",
    Currency: "USD"
    // FiscalYear: NOT included (SAP API rejects it)
};
```

---

## SAP Payload Example (FiscalYear EXCLUDED)

### Complete Payload WITHOUT FiscalYear

```json
{
  "Lockbox": "1000070",
  "DepositDateTime": "2025-12-31T00:00:00",
  "AmountInTransactionCurrency": "2940.00",
  "to_Item": {
    "results": [
      {
        "LockboxBatchItem": "1",
        "Cheque": "3456687",
        "AmountInTransactionCurrency": "2940.00",
        "Currency": "USD",
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

**Note:** FiscalYear is NOT included in the payload sent to SAP.

---

## Expected Console Logs

### After Enrichment (STAGE 4)
```
🔍 DEBUG: POST-ENRICHMENT DATA
   Total rows: 2
   Row 1: InvoiceNumber="90003904", InvoiceAmount=1365, PaymentReference="4900012345", CompanyCode="1710", FiscalYear="2025"
   Row 2: InvoiceNumber="90003905", InvoiceAmount=1575, PaymentReference="4900012346", CompanyCode="1710", FiscalYear="2025"
```

### During Payload Building (STAGE 5)
```
🔍 DEBUG: CHECK GROUPS AFTER GROUPING
   Check: 3456687, Invoices: 2
      Invoice 1: Number="90003904", Amount=1365, PaymentRef="4900012345", FiscalYear="2025"
      Invoice 2: Number="90003905", Amount=1575, PaymentRef="4900012346", FiscalYear="2025"

    Rule evaluation: InvoiceNumber=90003904, EnrichedPaymentRef=4900012345, CompanyCode=1710, FiscalYear=2025
    ✅ Using RULE_FETCH_ACCT_DOC enriched PaymentReference: 4900012345
    ✅ Adding FiscalYear to clearing entry: 2025
```

---

## Field Details

### FiscalYear

**Source:** SAP Accounting Document API  
**Data Type:** String (4 characters, e.g., "2025")  
**Usage:** Sent in clearing entry for SAP processing  
**Required:** No (optional field, only added if available)

**Logic:**
```javascript
// Only add if FiscalYear exists
if (fiscalYear) {
    clearing.FiscalYear = fiscalYear;
}
```

---

## Files Modified

### 1. `/app/backend/data/processing_rules.json`
- Added FiscalYear to RULE_FETCH_ACCT_DOC field mappings

### 2. `/app/backend/server.js`
- **Line 7167:** Store FiscalYear in invoice object during grouping
- **Line 7283:** Extract FiscalYear from enriched data
- **Line 7313-7316:** Add FiscalYear to clearing entry if available
- **Line 8651:** Add FiscalYear to post-enrichment debug log
- **Line 7178:** Add FiscalYear to check groups debug log

---

## Validation

### Field Validation
```javascript
// Check if FiscalYear is populated after enrichment
if (row.FiscalYear) {
    console.log(`✅ FiscalYear enriched: ${row.FiscalYear}`);
} else {
    console.log(`⚠️ FiscalYear not enriched (SAP API may not return this field)`);
}
```

### Payload Validation
```javascript
// Check if FiscalYear is included in clearing entry
if (clearing.FiscalYear) {
    console.log(`✅ FiscalYear included in payload: ${clearing.FiscalYear}`);
}
```

---

## Benefits

### 1. Complete Document Information ✅
- SAP receives full document context (AccountingDocument + CompanyCode + FiscalYear)
- Easier reconciliation and reporting

### 2. Fiscal Period Accuracy ✅
- Correct fiscal year associated with each clearing entry
- Important for year-end processing and audits

### 3. Better SAP Integration ✅
- More complete data sent to SAP
- Reduces need for manual corrections

### 4. Audit Trail ✅
- FiscalYear stored with each transaction
- Clear link to source accounting document

---

## Testing

### Test Case 1: Single Invoice
**Input:**
- Invoice: 90003904
- Amount: 1365

**Expected SAP API Response:**
```json
{
  "PaymentReference": "4900012345",
  "CompanyCode": "1710",
  "FiscalYear": "2025"
}
```

**Expected Clearing Entry:**
```json
{
  "PaymentReference": "4900012345",
  "NetPaymentAmountInPaytCurrency": "1365.00",
  "Currency": "USD",
  "FiscalYear": "2025"
}
```

---

### Test Case 2: Split Invoices (Hyphen)
**Input:**
- Invoice: 90003904-3905
- Amount: 1365.00-1575.00

**Expected Enrichment:**
- Row 1: FiscalYear = "2025" (from API for invoice 90003904)
- Row 2: FiscalYear = "2025" (from API for invoice 90003905)

**Expected Clearing Entries:**
```json
[
  {
    "PaymentReference": "4900012345",
    "NetPaymentAmountInPaytCurrency": "1365.00",
    "FiscalYear": "2025"
  },
  {
    "PaymentReference": "4900012346",
    "NetPaymentAmountInPaytCurrency": "1575.00",
    "FiscalYear": "2025"
  }
]
```

---

## Error Handling

### If SAP API Doesn't Return FiscalYear
```javascript
// FiscalYear is optional - no error if missing
if (fiscalYear) {
    clearing.FiscalYear = fiscalYear;  // Added
} else {
    // Not added to clearing entry, SAP will use default
}
```

### If Enrichment Fails
```javascript
// FiscalYear will be empty string
FiscalYear: inv.FiscalYear || ''  // Empty string if not enriched

// Empty strings are not added to payload
if (fiscalYear) {  // This check prevents empty strings
    clearing.FiscalYear = fiscalYear;
}
```

---

## Summary

**Enhancement:** ✅ **COMPLETE**

**What Changed:**
1. ✅ RULE_FETCH_ACCT_DOC now fetches FiscalYear from SAP
2. ✅ FiscalYear stored in enriched data for reporting
3. ❌ FiscalYear is NOT sent to SAP clearing entries (API rejects it)
4. ✅ Debug logging includes FiscalYear (for internal tracking)
5. ✅ Works with both single and split invoices

**FiscalYear Usage:**
- **Stored:** Yes (in enrichedData, for reporting and audit)
- **Sent to SAP:** No (SAP Lockbox API does not accept this field)
- **Purpose:** Internal reporting, audit trail, fiscal period tracking

**Status:** ✅ Ready for production (without FiscalYear in SAP payload)

---

**Last Updated:** April 9, 2025  
**Rule:** RULE_FETCH_ACCT_DOC  
**New Field:** FiscalYear
