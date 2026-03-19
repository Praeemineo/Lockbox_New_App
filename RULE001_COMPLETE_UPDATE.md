# ✅ RULE-001 Complete Configuration Update

## Summary of All Changes

### 1. TargetField Update (SAP Response Field)
**Changed:** `"Belnr"` → `"AccountingDocument"`

This ensures RULE-001 extracts the correct field from the SAP API response.

**Before:**
```json
{
  "targetField": "Belnr"  // Field doesn't exist in SAP response ❌
}
```

**After:**
```json
{
  "targetField": "AccountingDocument"  // Correct field name ✅
}
```

### 2. ApiField Update (Destination Field Name)
**Changed:** `"paymentreference"` → `"PaymentReference"`

This ensures the enriched value is stored in the exact field name used by the Excel sheet and database.

**Before:**
```json
{
  "apiField": "paymentreference"  // lowercase - may cause casing issues
}
```

**After:**
```json
{
  "apiField": "PaymentReference"  // PascalCase - matches Excel column ✅
}
```

## Complete RULE-001 Configuration

```json
{
  "ruleId": "RULE-001",
  "ruleName": "Accounting Document Lookup",
  "active": true,
  "fileType": "EXCEL",
  "ruleType": "API_LOOKUP",
  "destination": "S4HANA_SYSTEM_DESTINATION",
  "apiMappings": [
    {
      "apiReference": "/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set"
    }
  ],
  "fieldMappings": [
    {
      "sourceField": "Invoice Number",
      "targetField": "AccountingDocument",  ← Extracts from SAP response
      "apiField": "PaymentReference"         ← Stores in Excel/DB field
    },
    {
      "sourceField": "Invoice Number",
      "targetField": "CompanyCode",
      "apiField": "companyCode"
    }
  ]
}
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Upload Excel File                                       │
│ PaymentReferences Sheet → PaymentReference: 90003904            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: RULE-001 Enrichment                                     │
│ • Add leading zeros: 90003904 → 0090003904                      │
│ • Call SAP API with P_DocumentNumber='0090003904'               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: SAP API Response                                        │
│ {                                                                │
│   "CompanyCode": "1710",                                         │
│   "FiscalYear": "2021",                                          │
│   "AccountingDocument": "9400000440",  ← targetField extracts   │
│   "DocumentReferenceID": "0090003904"                           │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Field Mapping (rule-engine.js line 403)                 │
│ row["PaymentReference"] = "9400000440"  ← apiField updated      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Store in Database (server.js line 731)                  │
│ INSERT INTO lockbox_clearing                                     │
│   payment_reference = "9400000440"  ← Enriched value stored    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 6: Build SAP Payload (server.js line 1800)                 │
│ PaymentReference: "9400000440"  ← Retrieved from DB            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 7: Post to SAP                                             │
│ Clearing payload contains correct AccountingDocument number      │
└─────────────────────────────────────────────────────────────────┘
```

## Files Updated

1. **Backend Configuration (File)**
   - File: `/app/backend/data/processing_rules.json`
   - Updated: `targetField` and `apiField` for RULE-001
   - Status: ✅ Complete

2. **Database Configuration**
   - Table: `lb_processing_rules`
   - Updated: `field_mappings` JSON for RULE-001
   - Status: ✅ Complete (updated by user)

3. **Backend Service**
   - Status: ✅ Restarted and configuration reloaded

## Expected Behavior After Update

### Upload & Validation Phase

**Console Logs to Expect:**
```
⚙️  Executing RULE-001: Accounting Document Lookup
📝 Processing row 1: Invoice Number = "90003904"
📞 Calling SAP API: .../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='0090003904')/Set
📥 Full SAP Response:
{
  "AccountingDocument": "9400000440",
  "CompanyCode": "1710",
  ...
}
📊 Extracted Values:
   🎯 PaymentReference: "9400000440" (from SAP field: AccountingDocument)
✅ Enriched Field: PaymentReference = "9400000440"
   ↳ Extracted from SAP field: AccountingDocument
   ↳ Input value: 90003904
```

### Field Mapping Preview

```
Section: Clearing
Source Field: InvoiceNumber
Source Value: 90003904
Type: DIRECT → API_DERIVED (via RULE-001)
Target API Field: PaymentReference
Final Value: 9400000440  ← AccountingDocument from SAP ✅
Transformation/Notes: Derived from RULE-001 API lookup
```

### Database Storage

**lockbox_clearing table:**
```sql
SELECT payment_reference FROM lockbox_clearing;
-- Result: 9400000440 (not 90003904)
```

### SAP Payload

```json
{
  "Lockbox": "1234",
  "to_Item": {
    "results": [
      {
        "to_LockboxClearing": {
          "results": [
            {
              "PaymentReference": "9400000440",  ← Correct!
              "NetPaymentAmountInPaytCurrency": "1365.00"
            }
          ]
        }
      }
    ]
  }
}
```

## Testing Instructions

### 1. Upload Test File

Create an Excel file with two sheets:

**Sheet 1: Cheques**
| CheckNumber | BankCode | BankAccount | Currency | CheckAmount | DepositDate |
|-------------|----------|-------------|----------|-------------|-------------|
| 3456694     | 011000390| 415391      | USD      | 1365        | 2024-01-15  |

**Sheet 2: PaymentReferences**
| Cheque   | PaymentReference | NetPaymentAmountInPaytCurrency | DeductionAmountInPaytCurrency | PaymentDifferenceReason | Currency |
|----------|------------------|--------------------------------|-------------------------------|-------------------------|----------|
| 3456694  | 90003904         | 1365                           | 0                             |                         | USD      |

### 2. Monitor Upload Logs

```bash
tail -f /var/log/supervisor/backend.out.log
```

Look for RULE-001 execution and verify:
- ✅ SAP API called with `P_DocumentNumber='0090003904'`
- ✅ Response contains `"AccountingDocument": "9400000440"`
- ✅ Enriched field shows `PaymentReference = "9400000440"`

### 3. Check Field Mapping Preview

In the UI, after upload, click "Preview Payload" and verify:
- PaymentReference Final Value: **9400000440** (not 90003904)

### 4. Verify Database

```sql
SELECT h.lockbox, c.payment_reference 
FROM lockbox_clearing c
JOIN lockbox_item i ON c.item_id = i.id
JOIN lockbox_header h ON i.header_id = h.id
ORDER BY h.created_at DESC
LIMIT 5;
```

Expected: `payment_reference = 9400000440`

### 5. Check SAP Payload

Click "Simulate" and check the payload:
```json
"PaymentReference": "9400000440"  // Should be the AccountingDocument
```

## Troubleshooting

### Issue: PaymentReference still shows invoice number

**Solution 1:** Clear database and re-upload
```sql
DELETE FROM lockbox_clearing WHERE payment_reference = '90003904';
DELETE FROM lockbox_item WHERE header_id IN (SELECT id FROM lockbox_header WHERE lockbox = 'YOUR_LOCKBOX_ID');
DELETE FROM lockbox_header WHERE lockbox = 'YOUR_LOCKBOX_ID';
```

**Solution 2:** Check rule execution
```bash
# Verify rule is active
cat /app/backend/data/processing_rules.json | jq '.[] | select(.ruleId == "RULE-001") | .active'
# Should return: true
```

**Solution 3:** Verify SAP API connectivity
- Check that SAP credentials in `.env` are correct
- Verify invoice number 90003904 exists in SAP

### Issue: "AccountingDocument not found in response"

**Possible Causes:**
1. Invoice number doesn't exist in SAP
2. SAP API URL is incorrect
3. Leading zeros not being added correctly

**Solution:** Check SAP API response in logs and verify the JSON structure

## Database Update SQL (For Reference)

If you need to update the database configuration again:

```sql
UPDATE lb_processing_rules
SET field_mappings = jsonb_set(
    jsonb_set(
        field_mappings,
        '{0,targetField}',
        '"AccountingDocument"'
    ),
    '{0,apiField}',
    '"PaymentReference"'
),
updated_at = NOW()
WHERE rule_id = 'RULE-001';
```

## Status

✅ **Configuration Complete**
- targetField: Updated to `AccountingDocument`
- apiField: Updated to `PaymentReference`
- Backend: Restarted and configuration loaded
- Ready for testing

## Next Steps

1. **Test with real upload** → Upload Excel file with invoice 90003904
2. **Verify enrichment** → Check logs for RULE-001 execution
3. **Validate payload** → Confirm PaymentReference = 9400000440
4. **Post to SAP** → Test production run

---

**Last Updated:** Backend restarted with updated configuration  
**Status:** ✅ Ready for User Testing
