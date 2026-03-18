# RULE-001 Issue Analysis & Fix

## Problem Statement
User reports: RULE-001 is showing the same invoice number in preview instead of the Belnr (accounting document number) from the SAP API.

## User's API Configuration
- **API Endpoint:** `https://vhcals4hci.dummy.nodomain:44300/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set`
- **Input Parameter:** `P_DocumentNumber` = Invoice Number (e.g., "90003904")
- **Expected Output Fields:** 
  - `Belnr` (accounting document number, e.g., "9400000440")
  - Company code

## Current Configuration Analysis

### Local JSON (/app/backend/data/processing_rules.json)
```json
{
  "ruleId": "RULE-001",
  "fieldMappings": [
    {
      "sourceField": "Invoice Number",
      "targetField": "Belnr",          // ← Looking for "Belnr" in API response
      "apiField": "paymentreference"   // ← Storing as "paymentreference"
    }
  ]
}
```

### PostgreSQL Configuration (User's BTP Database)
Based on previous SQL scripts, the PostgreSQL configuration was:
```json
{
  "targetField": "AccountingDocument",  // ← WRONG! User's API returns "Belnr", not "AccountingDocument"
  "apiField": "PaymentReference"         // ← WRONG CASING! Should be "paymentreference" (lowercase)
}
```

## Root Cause Identified

**The user's actual API returns a field called `"Belnr"` (technical field name), NOT `"AccountingDocument"` (semantic CDS field name).**

The previous agent made assumptions about SAP CDS field naming conventions, but the user's actual OData service implementation uses the technical database field name instead.

### Two Separate Issues:

1. **PostgreSQL has wrong `targetField`:** 
   - Currently: `"AccountingDocument"` 
   - Should be: `"Belnr"` (to match actual API response)

2. **PostgreSQL has wrong `apiField` casing:** 
   - Currently: `"PaymentReference"` (mixed case)
   - Should be: `"paymentreference"` (lowercase) - to match the Reference Document Rule in server.js line 6897

## The Fix Required

User needs to update their PostgreSQL database with this SQL:

```sql
-- Fix RULE-001 targetField and apiField
UPDATE lb_processing_rules
SET 
    field_mappings = '[
        {
            "sourceField": "Invoice Number",
            "targetField": "Belnr",
            "apiField": "paymentreference"
        },
        {
            "sourceField": "Invoice Number",
            "targetField": "CompanyCode",
            "apiField": "companyCode"
        }
    ]'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE rule_id = 'RULE-001';

-- Verify the update
SELECT 
    rule_id,
    rule_name,
    field_mappings
FROM lb_processing_rules
WHERE rule_id = 'RULE-001';
```

## Expected Result After Fix

1. RULE-001 will call the API with the invoice number
2. The API will return: `{ "value": [{ "Belnr": "9400000440", "CompanyCode": "1710", ... }] }`
3. The rule engine will extract `Belnr` from the response
4. It will store the value in the lockbox row as `paymentreference` (lowercase)
5. The Reference Document Rule in server.js will find `inv.paymentreference` and use it correctly
6. The preview will show "9400000440" instead of "90003904"

## Why Previous Fixes Didn't Work

1. **First fix attempt:** Changed `apiField` to lowercase "paymentreference" - this was correct
2. **BUT:** The `targetField` was never verified against the actual API response structure
3. **The agent assumed:** SAP OData V4 services always use semantic CDS field names like "AccountingDocument"
4. **Reality:** The user's specific OData service implementation uses technical database field names like "Belnr"

## Next Steps

1. User must execute the SQL script above in their PostgreSQL database
2. Test file upload in BTP environment
3. Check logs for the `📦 Response structure` message to verify extraction
4. Confirm preview shows "9400000440" instead of "90003904"
