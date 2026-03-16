# CRITICAL: apiField Must Be Lowercase

## 🚨 Current Issue

Your PostgreSQL entry shows:
```json
"apiField": "PaymentReference"  // ❌ Capital P and R
```

This will cause the Reference Document Rule to NOT find the enriched value!

---

## 🔍 Why It Matters

### JavaScript Object Property Names Are Case-Sensitive

```javascript
const row = {
    PaymentReference: "9400000440",  // Capital P & R
    paymentreference: "90003904"     // All lowercase
};

// These are DIFFERENT properties!
console.log(row.PaymentReference);  // "9400000440"
console.log(row.paymentreference);  // "90003904"
```

### Reference Document Rule Code (line 6897)

```javascript
const enrichedPaymentRef = (inv.paymentreference || '').toString().trim();
//                              ^^^^^^^^^^^^^^^^
//                              Expects LOWERCASE!
```

---

## 📊 What Will Happen

### With Current Config (Capital):

```
Step 1: RULE-001 enriches
  → Writes to: PaymentReference = "9400000440"

Step 2: Reference Document Rule evaluates
  → Looks for: inv.paymentreference (lowercase)
  → Finds: undefined (because PaymentReference ≠ paymentreference)
  → enrichedPaymentRef = '' (empty!)
  → Falls back to: InvoiceNumber "90003904"
  → Overwrites: PaymentReference = "90003904" ❌

Step 3: Final result
  → Display shows: "90003904" ❌ (wrong!)
```

### With Correct Config (Lowercase):

```
Step 1: RULE-001 enriches
  → Writes to: paymentreference = "9400000440"

Step 2: Reference Document Rule evaluates
  → Looks for: inv.paymentreference (lowercase)
  → Finds: "9400000440" ✅
  → enrichedPaymentRef = "9400000440"
  → Uses enriched value (no fallback!)

Step 3: Final result
  → Display shows: "9400000440" ✅ (correct!)
```

---

## ✅ Required Change

**Current PostgreSQL:**
```json
{
  "apiField": "PaymentReference",  // ❌
  "sourceField": "Invoice Number",
  "targetField": "Belnr"
}
```

**Must Be:**
```json
{
  "apiField": "paymentreference",  // ✅ All lowercase!
  "sourceField": "Invoice Number",
  "targetField": "Belnr"
}
```

---

## 📋 SQL to Run

**File:** `/app/fix_apifield_lowercase.sql`

```sql
UPDATE lb_processing_rules
SET field_mappings = '[
    {
        "apiField": "paymentreference",
        "sourceField": "Invoice Number",
        "targetField": "Belnr"
    },
    {
        "apiField": "companyCode",
        "sourceField": "Invoice Number",
        "targetField": "CompanyCode"
    }
]'::jsonb
WHERE rule_id = 'RULE-001';
```

---

## 🧪 How to Verify

After running the SQL:

```sql
-- Check the field
SELECT field_mappings->0->>'apiField' 
FROM lb_processing_rules 
WHERE rule_id = 'RULE-001';

-- Should return: "paymentreference" (all lowercase)
-- NOT: "PaymentReference"
```

---

## ✅ Summary

**Issue:** apiField casing mismatch
- Current: `PaymentReference` (capital)
- Required: `paymentreference` (lowercase)

**Impact:** Reference Document Rule can't find enriched value, falls back to invoice number

**Solution:** Run SQL to change to lowercase

**After Fix:** RULE-001 enrichment will work correctly and display SAP value "9400000440"

---

## 🎯 Complete Correct Configuration

```json
{
  "ruleId": "RULE-001",
  "fieldMappings": [
    {
      "sourceField": "Invoice Number",    // What to read from Excel
      "targetField": "Belnr",             // What SAP API returns
      "apiField": "paymentreference"      // Where to store (LOWERCASE!)
    }
  ]
}
```

**All three must be correct for it to work!**
