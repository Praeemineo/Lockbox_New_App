# 🚀 LOCKBOX DYNAMIC VALIDATION ENGINE - IMPLEMENTATION GUIDE

## Overview

This document describes the **fully database-driven validation system** for RULE-001 and RULE-002 in the Lockbox Processing application.

---

## 🎯 System Architecture

### **Step-by-Step Process Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│ LOCKBOX_DYNAMIC_PROCESS                                          │
└─────────────────────────────────────────────────────────────────┘

Step-1: Read uploaded file payload as JSON input
        ↓
Step-2: Identify applicable rules from lb_processing_rules 
        where condition_type = 'EXIST'
        and destination = 'S4HANA_SYSTEM_DESTINATION'
        ↓
Step-3: For each rule found:
        - Validate condition dynamically
        - If source fields contain value → proceed
        ↓
Step-4: Construct S4 OData API dynamically:
        api_reference + '?' + api_input_fields=value pairs
        ↓
Step-5: Call S4 using BTP Destination:
        S4HANA_SYSTEM_DESTINATION
        ↓
Step-6: From API response extract:
        api_output_field dynamically
        ↓
Step-7: Map extracted values to:
        lockbox_field dynamically
        ↓
Step-8: Return enriched Lockbox payload
```

---

## 📋 Supported Rules

### **RULE-001: Accounting Document Lookup**

**Purpose:** Fetch accounting document details from SAP using invoice number

**Trigger Condition:**
```
IF file contains InvoiceNumber → Execute RULE-001
```

**API Mapping:**
```
Input:  InvoiceNumber (from file)
API:    /sap/opu/odata4/sap/zsb_acc_document/.../ZFI_I_ACC_DOCUMENT
Filter: P_Documentnumber = '{InvoiceNumber}'
Output: BELNR → PaymentReference
        CompanyCode → CompanyCode
```

**Example:**
```json
Input:
{
  "InvoiceNumber": "1900001234"
}

Output:
{
  "InvoiceNumber": "1900001234",
  "PaymentReference": "1000456789",   ← Derived from SAP
  "CompanyCode": "1710"                ← Derived from SAP
}
```

---

### **RULE-002: Partner Bank Details**

**Purpose:** Retrieve bank account details for partner validation

**Trigger Condition:**
```
IF file contains CustomerNumber AND BankIdentification → Execute RULE-002
```

**API Mapping:**
```
Input:  CustomerNumber + BankIdentification (from file)
API:    /sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartnerBank
Filter: A_BusinessPartner = '{CustomerNumber}' 
        AND BankIdentification = '0001'
Output: BankNumber → PartnerBank
        BankAccount → PartnerBankAccount
        BankCountryKey → PartnerBankCountry
```

**Example:**
```json
Input:
{
  "CustomerNumber": "10000001",
  "BankIdentification": "HDFC001"
}

Output:
{
  "CustomerNumber": "10000001",
  "BankIdentification": "HDFC001",
  "PartnerBankCountry": "IN",          ← Derived from SAP
  "PartnerBank": "HDFC",               ← Derived from SAP
  "PartnerBankAccount": "1234567890"   ← Derived from SAP
}
```

---

## 🏗️ Technical Implementation

### **File Structure**

```
/app/backend/
├── srv/
│   └── handlers/
│       └── rule-engine.js          ← NEW: Dynamic rule engine
├── data/
│   └── processing_rules.json       ← Fallback JSON configuration
└── server.js                        ← Main server file (updated)
```

---

### **Key Functions**

#### 1. `processLockboxRules(extractedData, fileType)`
Main function that orchestrates the entire validation process.

**Parameters:**
- `extractedData`: Array of lockbox records from file
- `fileType`: 'EXCEL', 'CSV', 'PDF', etc.

**Returns:**
```javascript
{
  success: true,
  rulesExecuted: ['RULE-001', 'RULE-002'],
  recordsEnriched: 10,
  errors: [],
  warnings: [],
  enrichedData: [ /* enriched records */ ]
}
```

---

#### 2. `evaluateRuleCondition(conditions, data)`
Dynamically evaluates if rule conditions are met.

**Supports:**
- `EXIST` conditions: Check if field has a value
- Multiple conditions: `CustomerNumber AND BankIdentification EXIST`

---

#### 3. `executeDynamicRule(rule, data)`
Executes a single rule for all data rows.

**Process:**
1. Validate source field exists
2. Build API URL dynamically
3. Call SAP via destination
4. Extract output fields
5. Map to lockbox fields

---

#### 4. `buildDynamicAPIURL(mapping, row)`
Constructs OData API URL with query parameters.

**Example Output:**
```
/sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT?$filter=P_Documentnumber='1900001234'
```

---

#### 5. `extractDynamicField(responseData, fieldPath)`
Extracts values from OData response.

**Handles:**
- OData v2: `{ d: { results: [...] } }`
- OData v4: `{ value: [...] }`
- Direct fields: `{ BELNR: "1000456789" }`

---

## 🗄️ Database Configuration

### **Table: `lb_processing_rules`**

**Key Columns:**
```sql
rule_id                 VARCHAR     -- 'RULE-001', 'RULE-002'
rule_name               VARCHAR     -- 'Accounting Document Lookup'
destination             VARCHAR     -- 'S4HANA_SYSTEM_DESTINATION'
file_type               VARCHAR     -- 'EXCEL', 'CSV'
active                  BOOLEAN     -- true/false
conditions              JSONB       -- Condition configuration
api_mappings            JSONB       -- API mapping configuration
```

**Example Record (RULE-001):**
```json
{
  "ruleId": "RULE-001",
  "ruleName": "Accounting Document Lookup",
  "destination": "S4HANA_SYSTEM_DESTINATION",
  "fileType": "EXCEL",
  "active": true,
  "conditions": [
    {
      "documentFormat": "Invoice number",
      "condition": "Exist"
    }
  ],
  "apiMappings": [
    {
      "httpMethod": "GET",
      "apiReference": "/sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT",
      "inputField": "P_Documentnumber",
      "sourceInput": "InvoiceNumber",
      "outputField": "BELNR",
      "lockboxApiField": "PaymentReference"
    }
  ]
}
```

---

## 🔗 SAP Integration

### **Destination Configuration**

**Environment Variables (backend/.env):**
```bash
SAP_DESTINATION=S4HANA_SYSTEM_DESTINATION
SAP_API_PATH=/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001
```

**MTA Configuration (mta.yaml):**
```yaml
- name: lockbox-destination
  parameters:
    service: destination
    service-plan: lite
  properties:
    SAP_DESTINATION: S4HANA_SYSTEM_DESTINATION
```

---

## 📊 Validation Status Output

### **Console Output Example:**

```
================================================================================
🔍 LOCKBOX DYNAMIC VALIDATION - RULE-001 & RULE-002
================================================================================

📋 Found 2 applicable validation rules

────────────────────────────────────────────────────────────────────────────────
⚙️  Executing RULE-001: Accounting Document Lookup
────────────────────────────────────────────────────────────────────────────────
✅ RULE-001: Condition met - proceeding with API call
   📞 API Call for row 1: /sap/opu/.../ZFI_I_ACC_DOCUMENT?$filter=P_Documentnumber='1900001234'
   ✅ PaymentReference: 1000456789
   ✅ CompanyCode: 1710
✅ RULE-001: Completed - 1 records enriched

────────────────────────────────────────────────────────────────────────────────
⚙️  Executing RULE-002: Partner Bank Details
────────────────────────────────────────────────────────────────────────────────
⏭️  RULE-002: Condition not met - skipping

================================================================================
📊 VALIDATION SUMMARY
================================================================================
   Rules Executed: RULE-001
   Records Enriched: 1
   Errors: 0
   Warnings: 1
================================================================================
```

---

## 🧪 Testing

### **Test File Example:**

**File: customer_payments_with_invoice.xlsx**
```
Customer    | Check Number | Invoice Number | Amount
17100009    | 3456694      | 1900001234     | 1365
```

**Expected Result:**
```json
{
  "Customer": 17100009,
  "Check Number": 3456694,
  "Invoice Number": "1900001234",
  "Amount": 1365,
  "PaymentReference": "1000456789",  ← Added by RULE-001
  "CompanyCode": "1710"              ← Added by RULE-001
}
```

---

## ✅ Key Features

1. **✅ Fully Database-Driven:** No hardcoded field names or API paths
2. **✅ Dynamic Condition Evaluation:** Supports complex conditions
3. **✅ Multi-Input/Multi-Output:** Single rule can map multiple fields
4. **✅ SAP BTP Destination:** Secure API calls via Cloud Connector
5. **✅ Fallback to JSON:** Works without database connection
6. **✅ Error Handling:** Row-level error tracking
7. **✅ Extensible:** Add RULE-003, RULE-004 without code changes

---

## 🚨 Important Notes

1. **PostgreSQL Required:** Primary data source is `lb_processing_rules` table
2. **Fallback to JSON:** If DB connection fails, uses `/app/backend/data/processing_rules.json`
3. **Destination Required:** SAP calls require `S4HANA_SYSTEM_DESTINATION` configured
4. **Only RULE-001 & RULE-002:** All other rules are disabled in this version
5. **API Response Format:** Handles both OData v2 and v4 formats

---

## 📝 Future Enhancements

- [ ] Parallel API calls for high-volume files (batch size: 20)
- [ ] API response caching (same CustomerNumber + BankID)
- [ ] Support for RULE-003, RULE-004, RULE-005
- [ ] Retry logic for failed API calls
- [ ] Performance metrics and logging

---

## 📚 References

- **Rule Engine Code:** `/app/backend/srv/handlers/rule-engine.js`
- **SAP Client:** `/app/backend/srv/integrations/sap-client.js`
- **Server Integration:** `/app/backend/server.js` (Line ~7426)
- **Data Models:** `/app/backend/data/processing_rules.json`

---

**Last Updated:** 2026-02-27  
**Version:** 1.0  
**Author:** Emergent AI Agent
