# RULE-001 & RULE-002 Field Mapping Reference

This document provides the complete field mapping configuration for validation rules.

---

## 📋 RULE-001: Accounting Document Lookup

### Purpose
Fetch accounting document details from SAP using invoice number from Excel file.

### API Details
- **Endpoint:** `/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set`
- **Method:** GET
- **OData Version:** V4
- **Destination:** S4HANA_SYSTEM_DESTINATION

### Field Mapping Configuration

| sourceField | targetField | apiField | Description |
|-------------|-------------|----------|-------------|
| Invoice Number | AccountingDocument | PaymentReference | Extract AccountingDocument from SAP and store as PaymentReference |
| Invoice Number | CompanyCode | CompanyCode | Extract CompanyCode from SAP |

> **📝 Note:** `AccountingDocument` is the semantic field name in the CDS view. The technical database field name is `BELNR`, but OData V4 services use the semantic names.

### Execution Flow

**Step 1: Input (Excel)**
```
Excel Column: "Invoice Number" = "123456"
```

**Step 2: API Call**
```
URL: .../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='0000123456')/Set
(Invoice number padded to 10 digits)
```

**Step 3: SAP Response (OData V4)**
```json
{
  "value": [
    {
      "AccountingDocument": "9876543210",
      "CompanyCode": "1710",
      "FiscalYear": "2025",
      ...
    }
  ]
}
```
> **💡 SAP Field Naming:** `AccountingDocument` (semantic) = `BELNR` (technical). The OData service uses semantic names.

**Step 4: Field Extraction**
```
targetField "AccountingDocument" → Extract value "9876543210"
→ Store in apiField "PaymentReference"

targetField "CompanyCode" → Extract value "1710"
→ Store in apiField "CompanyCode"
```

**Step 5: Enriched Output**
```javascript
{
  "Invoice Number": "123456",
  "PaymentReference": "9876543210",  // ✅ Enriched
  "CompanyCode": "1710"               // ✅ Enriched
}
```

---

## 📋 RULE-002: Partner Bank Details

### Purpose
Retrieve bank account details for partner validation using customer number from Excel file.

### API Details
- **Endpoint:** `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner(BusinessPartner='')?$expand=to_BusinessPartnerBank&$format=json`
- **Method:** GET
- **OData Version:** V2
- **Destination:** S4HANA_SYSTEM_DESTINATION

### Field Mapping Configuration

| sourceField | targetField | apiField | Description |
|-------------|-------------|----------|-------------|
| Customer Number | to_BusinessPartnerBank/results/0/BankNumber | PartnerBank | Extract BankNumber from nested navigation |
| Customer Number | to_BusinessPartnerBank/results/0/BankAccount | PartnerBankAccount | Extract BankAccount from nested navigation |
| Customer Number | to_BusinessPartnerBank/results/0/BankCountryKey | PartnerBankCountry | Extract BankCountryKey from nested navigation |

### Execution Flow

**Step 1: Input (Excel)**
```
Excel Column: "Customer Number" = "1000"
```

**Step 2: API Call**
```
URL: .../A_BusinessPartner(BusinessPartner='0000001000')?$expand=to_BusinessPartnerBank&$format=json
(Customer number padded to 10 digits)
```

**Step 3: SAP Response (OData V2 with Navigation)**
```json
{
  "d": {
    "BusinessPartner": "0000001000",
    "BusinessPartnerName": "ACME Corporation",
    "to_BusinessPartnerBank": {
      "results": [
        {
          "BankNumber": "12345678",
          "BankAccount": "9876543210",
          "BankCountryKey": "US",
          "BankName": "First National Bank"
        }
      ]
    }
  }
}
```

**Step 4: Field Extraction (Nested Path Navigation)**
```
targetField "to_BusinessPartnerBank/results/0/BankNumber"
→ Navigate: response.d → to_BusinessPartnerBank → results → [0] → BankNumber
→ Extract value "12345678"
→ Store in apiField "PartnerBank"

targetField "to_BusinessPartnerBank/results/0/BankAccount"
→ Navigate: response.d → to_BusinessPartnerBank → results → [0] → BankAccount
→ Extract value "9876543210"
→ Store in apiField "PartnerBankAccount"

targetField "to_BusinessPartnerBank/results/0/BankCountryKey"
→ Navigate: response.d → to_BusinessPartnerBank → results → [0] → BankCountryKey
→ Extract value "US"
→ Store in apiField "PartnerBankCountry"
```

**Step 5: Enriched Output**
```javascript
{
  "Customer Number": "1000",
  "PartnerBank": "12345678",          // ✅ Enriched
  "PartnerBankAccount": "9876543210", // ✅ Enriched
  "PartnerBankCountry": "US"          // ✅ Enriched
}
```

---

## 🔑 Key Differences

| Aspect | RULE-001 | RULE-002 |
|--------|----------|----------|
| **OData Version** | V4 | V2 |
| **Response Format** | `{ value: [...] }` | `{ d: { ... } }` |
| **Field Location** | Direct in value array | Nested in navigation property |
| **Target Field Format** | Semantic name (e.g., `AccountingDocument`) | Slash-separated path |
| **Example targetField** | `AccountingDocument` (BELNR in database) | `to_BusinessPartnerBank/results/0/BankNumber` |
| **Navigation Required** | No | Yes (to_BusinessPartnerBank) |

---

## 🎯 How the Engine Handles Both

The `extractDynamicField()` function automatically detects and handles both formats:

### For RULE-001 (OData V4):
```javascript
// Response has "value" array
if (data.value && Array.isArray(data.value)) {
  return data.value[0][fieldPath];  // fieldPath = "AccountingDocument" (semantic name for BELNR)
}
```

### For RULE-002 (OData V2 with Navigation):
```javascript
// Response has nested path
if (fieldPath.includes('/')) {
  const parts = fieldPath.split('/');  // ["to_BusinessPartnerBank", "results", "0", "BankNumber"]
  let current = data.d;  // Start from "d" wrapper
  
  // Navigate through each part
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      current = current[parseInt(part)];  // Array index
    } else {
      current = current[part];  // Object property
    }
  }
  return current;
}
```

---

## ✅ Configuration Checklist

When configuring a new rule, ensure:

1. **sourceField**: Matches Excel column name (fuzzy matching will handle variations)
2. **targetField**: Matches actual SAP response field name or path
   - For OData V4: Direct field name (e.g., `BELNR`)
   - For OData V2 with navigation: Full path (e.g., `to_BusinessPartnerBank/results/0/BankNumber`)
3. **apiField**: The lockbox field name where you want to store the enriched value
4. **apiReference**: Must have `=''` placeholder for dynamic value substitution

---

## 🐛 Common Issues

### Issue 1: Field Not Found in Response
**Symptom:** `⚠️ TargetField not found in response`  
**Cause:** targetField name doesn't match actual SAP response field  
**Fix:** Verify actual API response structure and update targetField

### Issue 2: Nested Field Returns Null
**Symptom:** RULE-002 returns null for bank fields  
**Cause:** Incorrect path in targetField  
**Fix:** Use full path: `to_BusinessPartnerBank/results/0/FieldName`

### Issue 3: Source Field Not Found in Excel
**Symptom:** `⏭️ Source field not found in Excel`  
**Cause:** Excel column name variation not matched by fuzzy logic  
**Fix:** Check Excel column names and adjust sourceField if needed

---

## 📝 Testing Commands

### Test RULE-001
```bash
# Check if BELNR field is in the rule
cat /app/backend/data/processing_rules.json | grep -A 10 "RULE-001" | grep targetField
```

### Test RULE-002
```bash
# Check if nested paths are correct
cat /app/backend/data/processing_rules.json | grep -A 15 "RULE-002" | grep targetField
```

### Check Backend Logs
```bash
# See what fields are being extracted
tail -n 100 /var/log/supervisor/backend.out.log | grep "Extracting"
```

---

## 🚀 Summary

**RULE-001:**
- Uses **AccountingDocument** (semantic name, BELNR in database) from SAP response
- Stores as **PaymentReference** in lockbox
- OData V4 format with direct field access
- Note: OData V4 services use semantic field names from CDS views, not technical database field names

**RULE-002:**
- Uses **nested navigation path** for bank fields
- Stores as **PartnerBank**, **PartnerBankAccount**, **PartnerBankCountry**
- OData V2 format with to_BusinessPartnerBank expansion

**Both rules are now 100% data-driven and work dynamically!** ✅
