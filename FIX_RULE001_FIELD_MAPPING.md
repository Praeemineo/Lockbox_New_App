# RULE-001 Field Mapping Fix

## Problem Identified
The PaymentReference field is showing the invoice number (90003904) instead of the AccountingDocument number (9400000440).

## Root Cause
RULE-001 configuration in PostgreSQL has `targetField: "Belnr"` but the SAP API actually returns `AccountingDocument`.

### SAP API Response Structure
```json
{
  "CompanyCode": "1710",
  "FiscalYear": "2021",
  "AccountingDocument": "9400000440",  ← THIS is the Belnr value we need!
  "DocumentReferenceID": "0090003904"
}
```

### Current Configuration (WRONG)
```json
{
  "targetField": "Belnr",  ← Field doesn't exist in response
  "apiField": "PaymentReference"
}
```

### Correct Configuration (FIX)
```json
{
  "targetField": "AccountingDocument",  ← Correct field name from SAP
  "apiField": "PaymentReference"
}
```

## SQL Fix Required

You need to update the `lb_processing_rules` table in PostgreSQL:

```sql
-- Step 1: View current configuration
SELECT rule_id, rule_name, field_mappings 
FROM lb_processing_rules 
WHERE rule_id = 'RULE-001';

-- Step 2: Update the targetField from "Belnr" to "AccountingDocument"
UPDATE lb_processing_rules
SET field_mappings = jsonb_set(
    field_mappings,
    '{0,targetField}',
    '"AccountingDocument"'
),
updated_at = NOW()
WHERE rule_id = 'RULE-001';

-- Step 3: Verify the change
SELECT rule_id, rule_name, field_mappings 
FROM lb_processing_rules 
WHERE rule_id = 'RULE-001';
```

## Alternative: Quick Fix via API/UI

If you have access to your Processing Rules management UI, you can:

1. Navigate to Processing Rules
2. Find RULE-001
3. Edit the field mapping
4. Change `targetField` from "Belnr" to "AccountingDocument"
5. Save

## After Fix

Once updated:
1. Restart the backend: `sudo supervisorctl restart backend`
2. Upload a test file
3. The PaymentReference should now show "9400000440" (AccountingDocument) instead of "90003904" (invoice number)

## Expected Result in Field Mapping Preview
```
PaymentReference: 9400000440  (from SAP field: AccountingDocument)
```

---

**Can you please execute this SQL update in your PostgreSQL database?** Or let me know if you'd like me to help create an admin endpoint to update this configuration.
