# RULE-001 Field Mapping Preview Issue - Investigation

## Current Status

### ✅ What's Working:
1. **RULE-001 Enrichment:** Successfully extracting AccountingDocument from SAP
   - Logs confirm: `paymentreference = "9400000440"`
   - SAP API call successful
   - Field enriched in memory

### ❌ What's Not Working:
2. **Field Mapping Preview Display:** Still showing original invoice number
   - Preview shows: `PaymentReference = 90003904` (original value)
   - Should show: `PaymentReference = 9400000440` (enriched value)

## Root Cause Analysis

### The Problem:
The enriched data has a **case-sensitivity issue** causing two separate fields:

1. **Original Field (from Excel):**
   - Field name: `PaymentReference` (PascalCase)
   - Value: `90003904` (invoice number from file)

2. **Enriched Field (from RULE-001):**
   - Field name: `paymentreference` (lowercase)
   - Value: `9400000440` (AccountingDocument from SAP)

### Why This Happens:
The rule-engine should perform case-insensitive matching to find and overwrite the existing `PaymentReference` field, but it appears to be creating a new lowercase field instead.

**Expected Behavior:**
```javascript
// Before RULE-001
row = { PaymentReference: "90003904", ... }

// After RULE-001 (Expected)
row = { PaymentReference: "9400000440", ... }  // ✅ Overwritten
```

**Actual Behavior:**
```javascript
// Before RULE-001
row = { PaymentReference: "90003904", ... }

// After RULE-001 (Actual)
row = { 
  PaymentReference: "90003904",    // ❌ Original remains
  paymentreference: "9400000440"   // ❌ New field added
}
```

### Why Field Mapping Preview Shows Wrong Value:
The `buildFieldMappingPreview` function looks for `PaymentReference` (PascalCase) and finds the original value. It doesn't recognize that `paymentreference` (lowercase) is the enriched version.

## Changes Made

### 1. Added Debug Logging (rule-engine.js)
Added detailed logs to trace the case-insensitive field lookup:
```javascript
console.log(`🔍 Looking for existing field matching: "${lockboxFieldName}"`);
console.log(`🔍 Available keys in row: ${Object.keys(row).join(', ')}`);
console.log(`🔍 Existing key found: "${existingKey}"`);
console.log(`🔍 Will update field: "${fieldToUpdate}"`);
```

### 2. Updated Field Mapping Definitions (server.js)
Added case-insensitive mappings to the preview function:
```javascript
const clearingFieldMappings = {
    'PaymentReference': 'Payment Reference',
    'paymentreference': 'Payment Reference',  // Case-insensitive
    'CompanyCode': 'Company Code',
    'companyCode': 'Company Code'  // Case-insensitive
};
```

This ensures both `PaymentReference` and `paymentreference` map to the same display name.

## Next Steps - Action Required

### Step 1: Upload Test File Again
Please upload your Excel file again so we can see the new debug logs.

**Watch for these logs:**
```bash
tail -f /var/log/supervisor/backend.out.log
```

Look for:
```
🔍 Looking for existing field matching: "PaymentReference"
🔍 Available keys in row: Cheque, PaymentReference, InvoiceNumber, ...
🔍 Existing key found: "PaymentReference"
🔍 Will update field: "PaymentReference"
✅ Enriched Field: PaymentReference = "9400000440"
```

### Step 2: Share the Debug Logs
Please share the logs showing:
1. What keys are available in the row before enrichment
2. What existing key was found (if any)
3. What field name was actually updated

This will tell us if the case-insensitive match is working correctly.

## Possible Issues & Solutions

### Issue 1: PaymentReference Field Not in Row During Enrichment
**Symptom:** Logs show `Existing key found: "undefined"`
**Cause:** RULE-001 runs before PaymentReferences data is merged with the row
**Solution:** Adjust the order of operations or ensure PaymentReference field exists

### Issue 2: Excel Column Name is Different
**Symptom:** Logs show different field name like `Invoice Number` or `InvoiceNumber`
**Cause:** Excel uses different column name than expected
**Solution:** Update RULE-001 `apiField` config to match actual Excel column name

### Issue 3: Data Structure is Array Not Object
**Symptom:** enrichment seems to work but preview doesn't show it
**Cause:** PaymentReferences might be in a nested structure
**Solution:** Adjust how we access and update the payment reference data

## Temporary Workaround

Until we fix the preview, you can verify the enrichment is working by:

### 1. Check Database
```sql
SELECT payment_reference FROM lockbox_clearing 
ORDER BY created_at DESC LIMIT 5;
```
Should show: `9400000440` (not `90003904`)

### 2. Check SAP Payload
Click "Simulate" and look at the JSON payload:
```json
{
  "to_LockboxClearing": {
    "results": [
      {
        "PaymentReference": "9400000440"  // ← Should be enriched value
      }
    ]
  }
}
```

### 3. Check Production Run
If you post to SAP, the correct AccountingDocument should be sent because the database has the enriched value.

## Files Modified
- `/app/backend/srv/handlers/rule-engine.js` - Added debug logging
- `/app/backend/server.js` - Updated field mapping definitions

## Status
🔧 **Debugging in Progress**
- Enrichment: ✅ Working (confirmed in logs)
- Database Storage: ⏳ Need to verify
- Preview Display: ❌ Not working
- Debug Logs: ✅ Added, waiting for user upload

---

**Next Action:** Please upload a test file and share the debug logs so we can see exactly what's happening with the field matching.
