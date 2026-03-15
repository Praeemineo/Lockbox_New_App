# PostgreSQL vs JSON - Field Mapping Comparison

## 🎯 Issue Confirmed!

The PostgreSQL database has **incorrect field mappings** for RULE-002. The `targetField` is missing the nested path required for OData V2 navigation properties.

---

## 📊 Current State (PostgreSQL Database)

### RULE-001: Accounting Document Lookup ✅ CORRECT
```json
{
  "sourceField": "Invoice Number",
  "targetField": "AccountingDocument",  // ✅ Correct - OData V4 direct field
  "apiField": "PaymentReference"
}
```
**Status:** This is correct. OData V4 returns fields directly in the `value` array.

---

### RULE-002: Partner Bank Details ❌ INCORRECT
```json
{
  "sourceField": "Customer Number",
  "targetField": "BankNumber",  // ❌ WRONG! Missing nested path
  "apiField": "PartnerBank"
}
```

**Problem:** The `targetField` is just `"BankNumber"` but it should be the full nested path!

**Why it fails:**
1. OData V2 API returns: `{ d: { to_BusinessPartnerBank: { results: [{ BankNumber: "..." }] } } }`
2. Rule engine tries to extract `"BankNumber"` from response
3. Can't find it because it's nested inside `to_BusinessPartnerBank/results/0/`

---

### RULE-004: Get Accounting Document ❌ INCORRECT API Reference
```json
{
  "apiReference": "/sap/opu/odata4/.../ZFI_I_ACC_BANK_STMT?$filter=LockBoxId eq '1000073'"
}
```

**Problem:** The API reference has a hardcoded filter value `'1000073'`. Should use placeholder for dynamic filtering.

---

## ✅ Required State (JSON File - Already Correct)

### RULE-002: Partner Bank Details
```json
[
  {
    "sourceField": "Customer Number",
    "targetField": "to_BusinessPartnerBank/results/0/BankNumber",  // ✅ Full path
    "apiField": "PartnerBank"
  },
  {
    "sourceField": "Customer Number",
    "targetField": "to_BusinessPartnerBank/results/0/BankAccount",  // ✅ Full path
    "apiField": "PartnerBankAccount"
  },
  {
    "sourceField": "Customer Number",
    "targetField": "to_BusinessPartnerBank/results/0/BankCountryKey",  // ✅ Full path
    "apiField": "PartnerBankCountry"
  }
]
```

---

## 🔧 SQL Fix Required

### Execute this SQL on your PostgreSQL database:

```sql
-- Fix RULE-002: Update field_mappings with nested paths
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
    ]'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE rule_id = 'RULE-002';
```

### Verify the fix:
```sql
SELECT 
    rule_id,
    rule_name,
    field_mappings->0->>'targetField' as first_target_field
FROM lb_processing_rules
WHERE rule_id = 'RULE-002';
```

**Expected output:**
```
rule_id  | rule_name           | first_target_field
---------|---------------------|--------------------------------------------
RULE-002 | Partner Bank Details| to_BusinessPartnerBank/results/0/BankNumber
```

---

## 🧪 How to Test After Fix

### Step 1: Run SQL Update
Execute the SQL fix in your PostgreSQL database.

### Step 2: Restart BTP Application
```bash
cf restart your-app-name
```

### Step 3: Upload Test File
Upload Excel with:
- Column: "Customer Number" with value "17100009"

### Step 4: Check Logs
Look for:
```
✅ PartnerBank = "011000390"
✅ PartnerBankAccount = "415391"
✅ PartnerBankCountry = "US"
✅ Row 1: Enriched 3 field(s)
```

Instead of:
```
⚠️ BankNumber not found in response
⚠️ Row 1: No fields enriched
```

---

## 📋 Comparison Table

| Rule | Field | PostgreSQL (Current) | JSON File (Correct) | Status |
|------|-------|---------------------|---------------------|---------|
| RULE-001 | targetField | `"AccountingDocument"` | `"AccountingDocument"` | ✅ Match |
| RULE-002 | targetField | `"BankNumber"` | `"to_BusinessPartnerBank/results/0/BankNumber"` | ❌ Mismatch |
| RULE-002 | targetField | `"BankAccount"` | `"to_BusinessPartnerBank/results/0/BankAccount"` | ❌ Mismatch |
| RULE-002 | targetField | `"BankCountryKey"` | `"to_BusinessPartnerBank/results/0/BankCountryKey"` | ❌ Mismatch |

---

## 🎯 Root Cause Summary

1. **PostgreSQL has OLD structure** - Just field names without paths
2. **JSON file has NEW structure** - Full nested paths
3. **BTP uses PostgreSQL** - That's why rules fail in production
4. **Local uses JSON** - That's why our standalone tests worked

**Solution:** Update PostgreSQL database with the correct field mapping structure from JSON file.

---

## 📁 Files Available

1. **`/app/fix_rule002_postgres.sql`** - SQL script to fix RULE-002 only
2. **`/app/update_processing_rules_postgres.sql`** - SQL script to fix all rules
3. **`/tmp/lb_processing_rules.csv`** - Your current PostgreSQL export
4. **`/tmp/analyze_rules.py`** - Script to analyze rule differences

---

## ✅ Next Steps

1. **Connect to PostgreSQL database**
2. **Run:** `/app/fix_rule002_postgres.sql`
3. **Restart BTP app**
4. **Test file upload**
5. **Verify enrichment works**

**This is the final piece needed to make RULE-002 work in BTP!** 🎯
