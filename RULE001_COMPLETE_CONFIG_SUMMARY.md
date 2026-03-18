# RULE-001 Configuration Summary

## ✅ Current Configuration (Verified)

### API Configuration
**API Endpoint (from database):**
```
/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set
```

**Base URL (from .env):**
```
https://44.196.95.84:44301
```

**Full API Call:**
```
GET https://44.196.95.84:44301/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='0090003904')/Set
Auth: S4H_FIN / Welcome1
Client: 100
```

---

## Field Mapping

### Input (from Excel)
- **Field Name:** "Invoice Number" (or any variation - see fuzzy matching below)
- **Example Value:** "90003904"
- **Padded for API:** "0090003904" (padded to 10 digits)

### Output (from SAP)
- **SAP Response Structure (OData V4):**
  ```json
  {
    "value": [
      {
        "Belnr": "9400000440",
        "CompanyCode": "1710"
      }
    ]
  }
  ```

### Field Mapping Config
```json
{
  "sourceField": "Invoice Number",
  "targetField": "Belnr",
  "apiField": "paymentreference"
}
```

- **targetField "Belnr"** → Extract "9400000440" from SAP response
- **apiField "paymentreference"** → Store as "paymentreference" field in Excel row data

---

## Fuzzy Field Matching Logic

The rule engine supports **flexible field name matching** for ALL fields:

### Examples of Matched Variations:

| Excel Column Header | Matches Configuration Field |
|---------------------|----------------------------|
| Invoice Number | Invoice Number ✓ |
| InvoiceNumber | Invoice Number ✓ |
| invoice number | Invoice Number ✓ |
| INVOICE NUMBER | Invoice Number ✓ |
| invoicenumber | Invoice Number ✓ |
| Invoice_Number | Invoice Number ✓ |
| Invoice-Number | Invoice Number ✓ |

### Same for Customer Number:
| Excel Column Header | Matches "Customer Number" |
|---------------------|----------------------------|
| Customer Number | ✓ |
| CustomerNumber | ✓ |
| customer number | ✓ |
| CUSTOMER NUMBER | ✓ |
| customernumber | ✓ |
| Customer_Number | ✓ |
| customer_number | ✓ |

### Matching Rules Applied:
1. **Case-insensitive:** "INVOICE" = "invoice" = "Invoice"
2. **Space removal:** "Invoice Number" = "InvoiceNumber"
3. **Underscore/Hyphen removal:** "Invoice_Number" = "Invoice-Number" = "InvoiceNumber"
4. **Partial matching:** Searches for keywords like "invoice", "customer", "payment"

**This is ALREADY implemented in rule-engine.js (lines 365-431)**

---

## Storage: Case-Insensitive

When storing the enriched value, the rule engine:

1. **Checks if field already exists** (case-insensitive):
   ```javascript
   const existingKey = Object.keys(row).find(k => 
       k.toLowerCase() === lockboxFieldName.toLowerCase()
   );
   ```

2. **Uses existing field name** if found (preserves casing):
   ```javascript
   const fieldToUpdate = existingKey || lockboxFieldName;
   row[fieldToUpdate] = apiValue;
   ```

### Examples:
- If Excel has `PaymentReference` → Updates `PaymentReference`
- If Excel has `paymentreference` → Updates `paymentreference`
- If Excel has `PAYMENTREFERENCE` → Updates `PAYMENTREFERENCE`
- If Excel doesn't have it → Creates `paymentreference` (lowercase from config)

**Result:** Flexible and case-insensitive storage ✓

---

## Expected Flow

### 1. Excel Upload
```
| Invoice Number | Customer Number | Amount |
|----------------|-----------------|--------|
| 90003904       | 1000           | 500.00 |
```

### 2. RULE-001 Execution
```
✓ Condition met: "Invoice Number" field exists
✓ Found field value: "90003904"
✓ Padded to: "0090003904"
✓ API Call: GET .../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='0090003904')/Set
✓ SAP Response: { "value": [{ "Belnr": "9400000440", "CompanyCode": "1710" }] }
✓ Extract: Belnr = "9400000440"
✓ Store: row["paymentreference"] = "9400000440"
```

### 3. Enriched Data
```
| Invoice Number | Customer Number | Amount | paymentreference | CompanyCode |
|----------------|-----------------|--------|------------------|-------------|
| 90003904       | 1000           | 500.00 | 9400000440       | 1710        |
```

### 4. Reference Document Rule (server.js)
```
✓ Check inv.paymentreference (case-insensitive)
✓ Found: "9400000440"
✓ Use as PaymentReference in clearing entry
```

### 5. Preview Display
```
PaymentReference: 9400000440 ✓ (NOT 90003904)
```

---

## Current Issue: RULE-001 Not Enriching

Your BTP logs showed:
```
EnrichedPaymentRef= (EMPTY!)
```

This means RULE-001 did NOT populate the `paymentreference` field.

### Possible Causes:

1. ✗ **RULE-001 not being executed**
   - Check: Is RULE-001 active in PostgreSQL?
   - Check: Are there logs showing "⚙️ Executing RULE-001"?

2. ✗ **Condition not met**
   - Check: Does Excel have "Invoice Number" column?
   - Check: Is the value non-empty?

3. ✗ **API call failing**
   - Check: Is SAP_URL in BTP .env correct?
   - Check: Are credentials valid?
   - Check: Any "SAP API call failed" errors in logs?

4. ✗ **Field extraction failing**
   - Check: Does SAP response have "Belnr" field?
   - Check: Is it nested differently than expected?

---

## Next Debug Steps

**YOU NEED TO SHARE BTP LOGS** showing:

```bash
# Search for these in your BTP logs:
cf logs your-app --recent | grep -A 20 "LOCKBOX DYNAMIC VALIDATION"
```

**Look for:**
1. `📋 Found X applicable validation rules`
2. `⚙️ Executing RULE-001: Accounting Document Lookup`
3. `✅ RULE-001: Condition met - proceeding with API call`
4. `📞 Calling SAP via destination: S4HANA_SYSTEM_DESTINATION`
5. `🔗 API URL: /sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT...`
6. `✅ SAP API Response received`
7. `📦 RAW RESPONSE DATA: {...}`
8. `🔍 Extracting "Belnr" from response...`
9. `✅ paymentreference = "9400000440"`

**OR error messages:**
- `❌ RULE-001: Execution failed`
- `⏭️ Source field "Invoice Number" not found`
- `SAP API Error: ...`
- `Field not found in response`

---

## Configuration Files

### Local JSON (/app/backend/data/processing_rules.json) - ✓ CORRECT
```json
{
  "ruleId": "RULE-001",
  "apiReference": "/sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set",
  "fieldMappings": [
    {
      "sourceField": "Invoice Number",
      "targetField": "Belnr",
      "apiField": "paymentreference"
    }
  ]
}
```

### PostgreSQL (Your BTP Database) - ✓ YOU CONFIRMED CORRECT
```json
{
  "targetField": "Belnr",
  "apiField": "paymentreference"
}
```

### Environment (.env) - ✓ USING CORRECT URL
```
SAP_URL=https://44.196.95.84:44301
```

---

## Summary

✅ **API endpoint configuration:** CORRECT  
✅ **Field mappings:** CORRECT (Belnr → paymentreference)  
✅ **Fuzzy field matching:** ALREADY IMPLEMENTED  
✅ **Case-insensitive storage:** ALREADY IMPLEMENTED  
✅ **SAP connection:** CONFIGURED  

❌ **RULE-001 execution:** NOT WORKING (need logs to debug)

**The configuration is correct. The issue is in the runtime execution.**

**Please share the BTP logs from a file upload to identify where RULE-001 is failing.**
