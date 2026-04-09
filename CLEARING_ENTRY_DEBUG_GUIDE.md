# Debugging Guide: Clearing Entry Split Issue

## Issue Observed

**Problem:** After splitting invoices (comma or hyphen), only ONE clearing entry is created with the TOTAL amount instead of MULTIPLE entries with individual amounts.

**Expected:**
```json
{
  "to_LockboxClearing": {
    "results": [
      {
        "PaymentReference": "4900012345",
        "NetPaymentAmountInPaytCurrency": "1365.00",
        "Currency": "USD"
      },
      {
        "PaymentReference": "4900012346",
        "NetPaymentAmountInPaytCurrency": "1575.00",
        "Currency": "USD"
      }
    ]
  }
}
```

**Actual (from screenshot):**
```
Only 1 clearing entry with amount 2940 USD (total)
```

---

## Debug Steps

### Step 1: Check if Split is Working (STAGE 3)
**After file upload, check the extractedData:**

```javascript
// In server.js around line 8619
console.log('=== DEBUG: EXTRACTED DATA (AFTER SPLIT) ===');
console.log('Total rows:', extractedData.length);
extractedData.forEach((row, i) => {
  console.log(`Row ${i+1}:`, {
    InvoiceNumber: row.InvoiceNumber,
    InvoiceAmount: row.InvoiceAmount,
    _splitType: row._splitType
  });
});
```

**Expected Output:**
```
Total rows: 2
Row 1: { InvoiceNumber: '90003904', InvoiceAmount: 1365, _splitType: 'HYPHEN_RANGE' }
Row 2: { InvoiceNumber: '90003905', InvoiceAmount: 1575, _splitType: 'HYPHEN_RANGE' }
```

**If you see only 1 row:** Split is NOT working ❌
**If you see 2 rows:** Split IS working ✅

---

### Step 2: Check if Enrichment is Working (STAGE 4)
**After enrichment, check if PaymentReference is added to each row:**

```javascript
// In server.js around line 8639
console.log('=== DEBUG: ENRICHED DATA ===');
extractedData.forEach((row, i) => {
  console.log(`Row ${i+1}:`, {
    InvoiceNumber: row.InvoiceNumber,
    InvoiceAmount: row.InvoiceAmount,
    PaymentReference: row.PaymentReference,  // From RULE_FETCH_ACCT_DOC
    CompanyCode: row.CompanyCode
  });
});
```

**Expected Output:**
```
Row 1: { InvoiceNumber: '90003904', InvoiceAmount: 1365, PaymentReference: '4900012345', CompanyCode: '1710' }
Row 2: { InvoiceNumber: '90003905', InvoiceAmount: 1575, PaymentReference: '4900012346', CompanyCode: '1710' }
```

**If PaymentReference is empty:** Enrichment is NOT working ❌
**If PaymentReference has values:** Enrichment IS working ✅

---

### Step 3: Check Payload Building (STAGE 5)
**Check how many invoices are grouped under each check:**

```javascript
// In server.js around line 7166
console.log('=== DEBUG: CHECK GROUPS ===');
Object.entries(checkGroups).forEach(([checkKey, checkData]) => {
  console.log(`Check: ${checkKey}`);
  console.log(`  Invoice count: ${checkData.invoices.length}`);
  checkData.invoices.forEach((inv, i) => {
    console.log(`  Invoice ${i+1}:`, {
      invoiceNumber: inv.invoiceNumber,
      invoiceAmount: inv.invoiceAmount,
      PaymentReference: inv.PaymentReference
    });
  });
});
```

**Expected Output:**
```
Check: 3456687
  Invoice count: 2
  Invoice 1: { invoiceNumber: '90003904', invoiceAmount: 1365, PaymentReference: '4900012345' }
  Invoice 2: { invoiceNumber: '90003905', invoiceAmount: 1575, PaymentReference: '4900012346' }
```

**If invoice count is 1:** Invoices are NOT being grouped correctly ❌
**If invoice count is 2:** Invoices ARE grouped correctly ✅

---

### Step 4: Check Clearing Entry Creation
**Check the clearing entries being created:**

```javascript
// In server.js around line 7314
console.log('=== DEBUG: CLEARING ENTRIES ===');
console.log('Clearing entries count:', clearingResults.length);
clearingResults.forEach((c, i) => {
  console.log(`Entry ${i+1}:`, {
    PaymentReference: c.PaymentReference,
    NetPaymentAmountInPaytCurrency: c.NetPaymentAmountInPaytCurrency
  });
});
```

**Expected Output:**
```
Clearing entries count: 2
Entry 1: { PaymentReference: '4900012345', NetPaymentAmountInPaytCurrency: '1365.00' }
Entry 2: { PaymentReference: '4900012346', NetPaymentAmountInPaytCurrency: '1575.00' }
```

**If count is 1:** Clearing logic is NOT working ❌
**If count is 2:** Clearing logic IS working ✅

---

## Common Issues & Fixes

### Issue 1: Split Not Working
**Symptom:** Only 1 row in extractedData after STAGE 3
**Cause:** Pattern not detected or split function not called
**Fix:** Check pattern detection in pattern-engine.js

### Issue 2: Enrichment Not Working
**Symptom:** PaymentReference is empty in STAGE 4
**Cause:** RULE_FETCH_ACCT_DOC not executing or SAP API failing
**Fix:** Check rule-engine.js logs and SAP API connectivity

### Issue 3: Invoices Not Grouped Correctly
**Symptom:** Only 1 invoice in checkGroups
**Cause:** extractedData not passed correctly to buildStandardPayload
**Fix:** Ensure enrichedData from STAGE 4 is used in STAGE 5

### Issue 4: Clearing Entries Using Total Amount
**Symptom:** clearingResults.length is correct but amounts are wrong
**Cause:** invoiceAmount field not populated correctly
**Fix:** Check field mapping in lines 7155-7156

---

## Where to Add Debug Logs

Add these console.log statements:

**1. After Split (server.js line 8619):**
```javascript
console.log('DEBUG: extractedData after split:', extractedData.map(r => ({ 
  InvoiceNumber: r.InvoiceNumber, 
  InvoiceAmount: r.InvoiceAmount 
})));
```

**2. After Enrichment (server.js line 8639):**
```javascript
console.log('DEBUG: enrichedData:', extractedData.map(r => ({ 
  InvoiceNumber: r.InvoiceNumber, 
  PaymentReference: r.PaymentReference 
})));
```

**3. In Payload Building (server.js line 7166):**
```javascript
console.log('DEBUG: checkGroups:', JSON.stringify(checkGroups, null, 2));
```

**4. Before Creating Clearing (server.js line 7263):**
```javascript
console.log('DEBUG: Creating clearing entries for', checkData.invoices.length, 'invoices');
```

---

## Test File

Create a test file with:
```
Customer  | Check Number | Check Amount | Invoice Number  | Invoice Amount
17100009  | 3456687      | 2940         | 90003904-3905   | 1365.00-1575.00
```

Upload and check logs at each stage.

---

## Expected vs Actual

### Expected Flow:
1. Upload file → 1 row
2. Pattern detection → PAT-004 detected
3. Split → 2 rows (90003904, 90003905)
4. Enrichment → Each gets PaymentReference
5. Payload → 2 clearing entries

### If Actual is Different:
- Check which STAGE is failing
- Add debug logs at that stage
- Verify data structure

---

**Next Action:** Add debug logs and share the console output so we can pinpoint exactly where the issue is occurring.
