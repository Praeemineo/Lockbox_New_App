# RULE ENGINE DYNAMIC LOGIC - FULLY DATA-DRIVEN

## 🎯 Core Concept

The rule engine is now **100% dynamic** and **data-driven**. All logic comes from the rule configuration in `processing_rules.json` or PostgreSQL `lb_processing_rules` table.

---

## 📊 Three-Field Mapping Structure

Every field mapping has THREE components:

```json
{
  "sourceField": "Invoice Number",                    // 1️⃣ INPUT: Excel column
  "targetField": "AccountingDocument",                 // 2️⃣ OUTPUT: SAP response field
  "apiField": "PaymentReference"                       // 3️⃣ STORAGE: Lockbox field
}
```

### Explanation:

| Field | Purpose | Example | Where Used |
|-------|---------|---------|------------|
| **sourceField** | Excel column name (INPUT to API) | "Invoice Number" | Used to build API URL parameter |
| **targetField** | SAP API response field path (OUTPUT) | "AccountingDocument" | Used to extract value from API response |
| **apiField** | Lockbox field name (STORAGE) | "PaymentReference" | Used to store enriched value in row |

---

## 🔄 Complete Execution Flow

### **RULE-001: Accounting Document Lookup**

#### Configuration:
```json
{
  "ruleId": "RULE-001",
  "apiMappings": [
    {
      "apiReference": "/sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set",
      "httpMethod": "GET"
    }
  ],
  "fieldMappings": [
    {
      "sourceField": "Invoice Number",
      "targetField": "AccountingDocument",
      "apiField": "PaymentReference"
    },
    {
      "sourceField": "Invoice Number",
      "targetField": "CompanyCode",
      "apiField": "CompanyCode"
    }
  ]
}
```

#### Execution Steps:

**Step 1: Find Source Field in Excel**
```
Excel Row: { "Invoice Number": "123456", "Amount": "1000.00", ... }
sourceField: "Invoice Number"
→ FUZZY MATCH: Find "Invoice Number" in Excel row
→ FOUND: value = "123456"
```

**Step 2: Build API URL**
```
apiReference: ".../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set"
sourceValue: "123456"
→ TRANSFORMATION: Pad invoice to 10 digits → "0000123456"
→ REPLACE: P_DocumentNumber='' → P_DocumentNumber='0000123456'
→ FINAL URL: ".../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='0000123456')/Set"
```

**Step 3: Call SAP API**
```
GET https://sap-system.com/sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='0000123456')/Set
Authorization: Basic [credentials from .env]
```

**Step 4: Extract Fields from Response**
```javascript
SAP Response:
{
  "value": [
    {
      "AccountingDocument": "9876543210",
      "CompanyCode": "1710",
      "FiscalYear": "2025"
    }
  ]
}

// For each fieldMapping:

// Mapping 1:
targetField: "AccountingDocument"
→ extractDynamicField(response.data, "AccountingDocument")
→ FOUND: "9876543210"
→ STORE IN: row["PaymentReference"] = "9876543210"

// Mapping 2:
targetField: "CompanyCode"
→ extractDynamicField(response.data, "CompanyCode")
→ FOUND: "1710"
→ STORE IN: row["CompanyCode"] = "1710"
```

**Step 5: Enriched Row**
```javascript
BEFORE:
{ "Invoice Number": "123456", "Amount": "1000.00" }

AFTER:
{
  "Invoice Number": "123456",
  "Amount": "1000.00",
  "PaymentReference": "9876543210",    // ✅ Enriched from API
  "CompanyCode": "1710"                  // ✅ Enriched from API
}
```

---

### **RULE-002: Partner Bank Details**

#### Configuration:
```json
{
  "ruleId": "RULE-002",
  "apiMappings": [
    {
      "apiReference": "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner(BusinessPartner='')?$expand=to_BusinessPartnerBank&$format=json",
      "httpMethod": "GET"
    }
  ],
  "fieldMappings": [
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
  ]
}
```

#### Execution Steps:

**Step 1: Find Source Field in Excel**
```
Excel Row: { "Customer Number": "1000", "Invoice": "123", ... }
sourceField: "Customer Number"
→ FUZZY MATCH: Find "Customer Number" in Excel row
→ FOUND: value = "1000"
```

**Step 2: Build API URL**
```
apiReference: ".../A_BusinessPartner(BusinessPartner='')?$expand=to_BusinessPartnerBank..."
sourceValue: "1000"
→ TRANSFORMATION: Pad customer to 10 digits → "0000001000"
→ REPLACE: BusinessPartner='' → BusinessPartner='0000001000'
→ FINAL URL: ".../A_BusinessPartner(BusinessPartner='0000001000')?$expand=to_BusinessPartnerBank..."
```

**Step 3: Call SAP API**
```
GET https://sap-system.com/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner(BusinessPartner='0000001000')?$expand=to_BusinessPartnerBank&$format=json
```

**Step 4: Extract Nested Fields from Response**
```javascript
SAP Response (OData V2):
{
  "d": {
    "BusinessPartner": "0000001000",
    "BusinessPartnerName": "ACME Corp",
    "to_BusinessPartnerBank": {
      "results": [
        {
          "BankNumber": "12345678",
          "BankAccount": "9876543210",
          "BankCountryKey": "US"
        }
      ]
    }
  }
}

// For each fieldMapping with NESTED PATH:

// Mapping 1:
targetField: "to_BusinessPartnerBank/results/0/BankNumber"
→ extractDynamicField(response.data, "to_BusinessPartnerBank/results/0/BankNumber")
→ NAVIGATE: response.d → to_BusinessPartnerBank → results → [0] → BankNumber
→ FOUND: "12345678"
→ STORE IN: row["PartnerBank"] = "12345678"

// Mapping 2:
targetField: "to_BusinessPartnerBank/results/0/BankAccount"
→ FOUND: "9876543210"
→ STORE IN: row["PartnerBankAccount"] = "9876543210"

// Mapping 3:
targetField: "to_BusinessPartnerBank/results/0/BankCountryKey"
→ FOUND: "US"
→ STORE IN: row["PartnerBankCountry"] = "US"
```

**Step 5: Enriched Row**
```javascript
BEFORE:
{ "Customer Number": "1000", "Invoice": "123" }

AFTER:
{
  "Customer Number": "1000",
  "Invoice": "123",
  "PartnerBank": "12345678",           // ✅ Enriched from nested API response
  "PartnerBankAccount": "9876543210",  // ✅ Enriched from nested API response
  "PartnerBankCountry": "US"           // ✅ Enriched from nested API response
}
```

---

## 🔍 Fuzzy Field Matching Logic

The rule engine uses **intelligent fuzzy matching** to find source fields in Excel, handling variations in naming:

### Matching Strategies (in order):

#### 1. **Exact Match** (after normalization)
```
Rule: "Invoice Number"
Excel: "InvoiceNumber"
→ Normalize both: "invoicenumber" === "invoicenumber"
→ ✅ MATCH
```

#### 2. **Contains Match**
```
Rule: "Customer"
Excel: "Customer Number"
→ "customernumber".includes("customer")
→ ✅ MATCH
```

#### 3. **Reverse Contains Match**
```
Rule: "Invoice Number"
Excel: "Invoice"
→ "invoicenumber".includes("invoice") && length >= 5
→ ✅ MATCH
```

#### 4. **Prefix Match** (first 5 characters)
```
Rule: "Customer Number"
Excel: "CustomerNo"
→ "custo" === "custo"
→ ✅ MATCH
```

### Normalization Process:
```javascript
"Invoice Number"  → "invoicenumber"   // Remove spaces, lowercase
"Customer_Number" → "customernumber"  // Remove underscores
"INVOICE-NUMBER"  → "invoicenumber"   // Remove dashes, lowercase
```

---

## 🛠️ Dynamic Field Extraction

The `extractDynamicField` function supports multiple response formats:

### 1. **Direct Field Access**
```javascript
Response: { "AccountingDocument": "12345" }
Path: "AccountingDocument"
→ Result: "12345"
```

### 2. **OData V4 Format** (value array)
```javascript
Response: { "value": [{ "AccountingDocument": "12345" }] }
Path: "AccountingDocument"
→ Navigate: response.value[0].AccountingDocument
→ Result: "12345"
```

### 3. **OData V2 Format** (d.results array)
```javascript
Response: { "d": { "results": [{ "CompanyCode": "1710" }] } }
Path: "CompanyCode"
→ Navigate: response.d.results[0].CompanyCode
→ Result: "1710"
```

### 4. **Nested Navigation Properties** (slash-separated paths)
```javascript
Response: {
  "d": {
    "to_BusinessPartnerBank": {
      "results": [
        { "BankNumber": "12345678" }
      ]
    }
  }
}
Path: "to_BusinessPartnerBank/results/0/BankNumber"
→ Navigate: response.d → to_BusinessPartnerBank → results → [0] → BankNumber
→ Result: "12345678"
```

---

## 🎯 Why This Is Dynamic

### ❌ OLD WAY (Hardcoded):
```javascript
// Hardcoded logic for RULE-001
if (rule.ruleId === 'RULE-001') {
  url = `/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='${invoiceNumber}')/Set`;
  paymentRef = response.data.value[0].BELNR;
  row.PaymentReference = paymentRef;
}
```

### ✅ NEW WAY (Dynamic):
```javascript
// Works for ANY rule based on configuration
const sourceValue = findFieldValue(row, fieldMapping.sourceField);
const url = buildDynamicAPIURL(mapping, sourceField, sourceValue);
const response = await callSAPAPI(url, mapping.httpMethod, rule.destination);
const apiValue = extractDynamicField(response.data, fieldMapping.targetField);
row[fieldMapping.apiField] = apiValue;
```

---

## 📊 Comparison: Old vs New Structure

| Aspect | OLD Structure | NEW Structure |
|--------|--------------|---------------|
| **Field Mapping** | Embedded in `api_mappings` | Separate `fieldMappings` array |
| **Input Field** | Hardcoded in code | `sourceField` in config |
| **Output Field** | Hardcoded in code | `targetField` with path support |
| **Storage Field** | Hardcoded in code | `apiField` in config |
| **API URL** | Hardcoded logic per rule | Dynamic replacement of `=''` |
| **Field Matching** | Exact name only | Fuzzy matching (4 strategies) |
| **Nested Fields** | Hardcoded navigation | Path-based extraction |
| **Maintainability** | Requires code changes | Config-only changes |
| **Scalability** | New rule = new code | New rule = new config entry |

---

## ✅ Benefits of Dynamic Approach

1. **No Code Changes Needed:** Add new rules by just updating the JSON/database
2. **Flexible Field Mapping:** Support any Excel column name variation
3. **Nested Field Support:** Handle complex OData navigation properties
4. **Reusable Logic:** Same engine works for all rules
5. **Easy Testing:** Test rules by changing config, not code
6. **Better Maintainability:** Single source of truth in database

---

## 🔧 Key Functions

| Function | Purpose | Input | Output |
|----------|---------|-------|--------|
| `findFieldValue()` | Find Excel column with fuzzy matching | `row`, `fieldName` | Field value or null |
| `buildDynamicAPIURL()` | Build API URL with parameter substitution | `mapping`, `sourceField`, `sourceValue` | Complete URL |
| `callSAPAPI()` | Execute SAP OData API call | `url`, `method`, `destination` | API response |
| `extractDynamicField()` | Extract field from response with path | `response`, `fieldPath` | Extracted value |
| `executeDynamicRule()` | Execute complete rule flow | `rule`, `data` | Enrichment result |

---

## 📝 Summary

**The rule engine logic remains the same conceptually:**
1. Find source field in Excel → Build API URL → Call SAP → Extract response → Store in lockbox

**But now it's 100% data-driven:**
- No hardcoded field names
- No hardcoded API URLs
- No hardcoded response parsing
- All logic comes from `fieldMappings` configuration

**Result:** Same functionality, much more flexible and maintainable! 🚀
