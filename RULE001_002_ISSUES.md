# CRITICAL: Both RULE-001 and RULE-002 Have Issues in PostgreSQL

## 🚨 Issue Summary

Both rules have configuration problems in the PostgreSQL database:

---

## ❌ RULE-001: Missing Function Parameter in API Reference

### Current (PostgreSQL) - WRONG:
```
/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT
```

### Required (JSON) - CORRECT:
```
/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set
```

### What's Missing:
1. `(P_DocumentNumber='')` - Function parameter placeholder
2. `/Set` - Entity set endpoint

### Why It Fails:
The OData V4 function `ZFI_I_ACC_DOCUMENT` requires a parameter `P_DocumentNumber`. Without it, the API call is malformed.

**Example of what should happen:**
```
Invoice Number: "90003904"
↓ (padded to 10 digits)
"0090003904"
↓ (replace '' with value)
/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='0090003904')/Set
```

**What's happening now:**
```
/ZFI_I_ACC_DOCUMENT
↓ (No parameter!)
API returns error or empty result
```

---

## ❌ RULE-002: Missing Nested Paths in Field Mappings

### Current (PostgreSQL) - WRONG:
```json
{
  "targetField": "BankNumber"
}
```

### Required (JSON) - CORRECT:
```json
{
  "targetField": "to_BusinessPartnerBank/results/0/BankNumber"
}
```

### Why It Fails:
OData V2 navigation properties return nested data. The response looks like:
```json
{
  "d": {
    "BusinessPartner": "17100009",
    "to_BusinessPartnerBank": {
      "results": [
        {
          "BankNumber": "011000390",
          "BankAccount": "415391",
          "BankCountryKey": "US"
        }
      ]
    }
  }
}
```

The extractor needs the full path to navigate: `to_BusinessPartnerBank/results/0/BankNumber`

---

## 📊 Complete Comparison

### RULE-001

| Component | PostgreSQL | JSON File | Status |
|-----------|------------|-----------|---------|
| **apiReference** | `/ZFI_I_ACC_DOCUMENT` | `/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set` | ❌ Missing parameter |
| **field_mappings** | `"AccountingDocument"` | `"AccountingDocument"` | ✅ Correct |

### RULE-002

| Component | PostgreSQL | JSON File | Status |
|-----------|------------|-----------|---------|
| **apiReference** | Correct with $expand | Correct with $expand | ✅ Correct |
| **field_mappings** | `"BankNumber"` | `"to_BusinessPartnerBank/results/0/BankNumber"` | ❌ Missing path |

---

## ✅ Complete SQL Fix

**File:** `/app/fix_both_rules_postgres.sql`

```sql
-- Fix RULE-001: Add function parameter
UPDATE lb_processing_rules
SET 
    api_mappings = '[
        {
            "sourceType": "OData V4",
            "destination": "S4HANA_SYSTEM_DESTINATION",
            "httpMethod": "GET",
            "apiReference": "/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='''')/Set"
        }
    ]'::jsonb
WHERE rule_id = 'RULE-001';

-- Fix RULE-002: Add nested paths
UPDATE lb_processing_rules
SET 
    field_mappings = '[
        {
            "sourceField": "Customer Number",
            "targetField": "to_BusinessPartnerBank/results/0/BankNumber",
            "apiField": "PartnerBank"
        },
        {
            "sourceField": "Customer Number",
            "targetField": "to_BusinessPartnerBank/results/0/BankAccount",
            "apiField": "PartnerBankAccount"
        },
        {
            "sourceField": "Customer Number",
            "targetField": "to_BusinessPartnerBank/results/0/BankCountryKey",
            "apiField": "PartnerBankCountry"
        }
    ]'::jsonb
WHERE rule_id = 'RULE-002';
```

---

## 🧪 Testing After Fix

### RULE-001 Test:
```
Upload Excel with: Invoice Number = "90003904"
Expected logs:
   📝 Building URL with Invoice Number = "90003904"
   🔢 Invoice Number padded: 90003904 → 0090003904
   ✅ Final URL: .../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='0090003904')/Set
   ✅ API Response received
   ✅ PaymentReference = "9400000440"
   ✅ CompanyCode = "1710"
   ✅ Row 1: Enriched 2 field(s)
```

### RULE-002 Test:
```
Upload Excel with: Customer Number = "17100009"
Expected logs:
   📝 Building URL with Customer Number = "17100009"
   🔢 Customer Number padded: 17100009 → 0017100009
   ✅ Final URL: .../A_BusinessPartner(BusinessPartner='0017100009')?$expand=...
   ✅ API Response received
   ✅ PartnerBank = "011000390"
   ✅ PartnerBankAccount = "415391"
   ✅ PartnerBankCountry = "US"
   ✅ Row 1: Enriched 3 field(s)
```

---

## 🎯 Root Cause Analysis

### Why These Issues Exist:

1. **RULE-001:** The UI or API that saved the rule to PostgreSQL didn't include the function parameter in the apiReference
2. **RULE-002:** The field mappings were saved with simple field names instead of full nested paths
3. **JSON File:** Was manually updated with correct values (that's why standalone tests worked)
4. **BTP Production:** Uses PostgreSQL (that's why both rules fail there)

### How This Happened:

The rules were likely created/edited through the UI, which may not have properly formatted:
- OData V4 function parameters
- OData V2 navigation property paths

---

## 📋 Files Available

1. **`/app/fix_both_rules_postgres.sql`** - Complete fix for both rules ⭐
2. **`/app/fix_rule001_postgres.sql`** - RULE-001 fix only
3. **`/app/fix_rule002_postgres.sql`** - RULE-002 fix only
4. **`/app/RULE001_002_ISSUES.md`** - This detailed explanation

---

## ✅ Immediate Actions

### Step 1: Connect to PostgreSQL
```bash
# Get connection details from BTP
cf env your-app-name | grep postgres
```

### Step 2: Run SQL Fix
```bash
psql -h <host> -U <user> -d <database> -f /app/fix_both_rules_postgres.sql
```

### Step 3: Verify
```sql
-- Check RULE-001 apiReference
SELECT api_mappings->0->>'apiReference' 
FROM lb_processing_rules 
WHERE rule_id = 'RULE-001';
-- Should include: (P_DocumentNumber='')

-- Check RULE-002 field_mappings
SELECT field_mappings->0->>'targetField' 
FROM lb_processing_rules 
WHERE rule_id = 'RULE-002';
-- Should be: to_BusinessPartnerBank/results/0/BankNumber
```

### Step 4: Restart BTP App
```bash
cf restart your-app-name
```

### Step 5: Test
Upload file with both Invoice Number (90003904) and Customer Number (17100009)

---

## 🎯 Summary

**Both rules need fixes:**
- **RULE-001:** API reference missing function parameter
- **RULE-002:** Field mappings missing nested paths

**Single SQL script fixes both:** `/app/fix_both_rules_postgres.sql`

**After fix, both rules will work correctly in BTP!** ✅
