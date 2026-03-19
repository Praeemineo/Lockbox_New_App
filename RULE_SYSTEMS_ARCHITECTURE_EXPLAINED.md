# Lockbox Application Rule Systems Architecture

## 📊 Overview: Two Separate Rule Systems

The application has **TWO different rule systems** that serve different purposes:

---

## 🎯 System 1: Processing Rules (Dynamic, Database-Driven)

### **Location**: `/app/backend/srv/handlers/rule-engine.js`

### **Purpose**: 
Dynamic data enrichment and SAP operations based on database configuration.

### **Rules**:
- **RULE-001**: Accounting Document Lookup (Validation enrichment)
- **RULE-002**: Partner Bank Details (Validation enrichment)
- **RULE-003**: SAP Production Run (Posting to SAP)
- **RULE-004**: Get Accounting Document (View details after posting)

### **Stored In**: 
PostgreSQL table `lb_processing_rules`

### **Configuration**:
```json
{
  "rule_id": "RULE-001",
  "rule_name": "Accounting Document Lookup",
  "conditions": [...],
  "apiMappings": [...],
  "fieldMappings": [...]
}
```

### **When Executed**:
1. **RULE-001 & RULE-002**: During file upload validation
2. **RULE-003**: During posting to SAP
3. **RULE-004**: On-demand when viewing transaction details

### **Key Functions in rule-engine.js**:
```javascript
// Main entry point
executeProcessingRules(fileType, destination, data)

// Execute individual rule
executeDynamicRule(rule, data)

// Evaluate conditions
evaluateRuleCondition(conditions, data)

// Build API URL
buildDynamicAPIURL(mapping, sourceFieldName, sourceValue)

// Call SAP API
callSAPAPI(apiURL, httpMethod, destination)

// Extract fields from response
extractDynamicField(data, fieldPath)
```

---

## 🔄 System 2: Reference Document Rules (Static, Code-Defined)

### **Location**: `/app/backend/server.js` (lines 3964-4021, 7010-7050)

### **Purpose**: 
**[DEPRECATED]** Determine which field to use for payment reference when posting to SAP Lockbox.

### **Rules**:
- **Rule 1**: Use BELNR (Accounting Document)
- **Rule 2**: Use XBLNR (Invoice Reference) - Default
- **Rule 3**: Try BELNR first, then XBLNR
- **Rule 4**: Try XBLNR first, then BELNR

### **Stored In**: 
In-memory JavaScript array (can be saved to JSON file)

### **Configuration**:
```javascript
{
  ruleId: 'RULE-001',  // NOTE: Confusing! Different from Processing RULE-001
  ruleName: 'Document Number (BELNR)',
  ruleType: 'BELNR',
  logicCondition: 'lbinvref = belnr'
}
```

### **When Executed**:
During posting to SAP - determines which field value to use for `PaymentReference`

### **Current Status**: 
**⚠️ DEPRECATED** - We removed this logic and now only use Processing RULE-001 enriched values.

---

## 🔍 Key Differences:

| Aspect | Processing Rules | Reference Document Rules |
|--------|------------------|--------------------------|
| **Location** | `rule-engine.js` | `server.js` |
| **Storage** | PostgreSQL database | In-memory JavaScript |
| **Configuration** | Dynamic (database-driven) | Static (code-defined) |
| **Purpose** | Data enrichment, SAP operations | Payment reference field selection |
| **When Used** | Validation, Posting, Viewing | Posting only |
| **Count** | 4 rules (RULE-001 to RULE-004) | 4 rules (confusingly also numbered 1-4) |
| **Complexity** | High (API calls, field mapping) | Low (simple field selection) |
| **Status** | ✅ Active | ❌ **DEPRECATED** |

---

## 🔄 How They Work Together:

### **Original Design** (Before Our Fixes):

```
1. VALIDATION (File Upload)
   ↓
   Processing RULE-001 & RULE-002 (rule-engine.js)
   - Try to enrich data with SAP API calls
   - If fails, data not enriched
   ↓
2. POSTING
   ↓
   Check enriched paymentreference from RULE-001
   ↓
   If EMPTY → Use Reference Document Rules (server.js)
                ↓
                Apply XBLNR_THEN_BELNR logic
                ↓
                Fallback to Invoice Number
   ↓
   POST to SAP
```

### **New Design** (After Our Fixes):

```
1. VALIDATION (File Upload)
   ↓
   Processing RULE-001 & RULE-002 (rule-engine.js)
   - Call SAP API with direct connection
   - Enrich paymentreference and CompanyCode
   ↓
2. POSTING
   ↓
   Check enriched paymentreference from RULE-001
   ↓
   If EXISTS → Use it ✅
   If EMPTY → Use Invoice Number (simple fallback)
   ↓
   POST to SAP

   ❌ Reference Document Rules SKIPPED (deprecated)
```

---

## 📂 Code Architecture:

### **File Structure**:

```
/app/backend/
├── server.js                          # Main Express server
│   ├── Reference Document Rules       # ❌ DEPRECATED (lines 3964-4021)
│   ├── Field Definitions              # Schema definitions
│   ├── API Endpoints                  # REST endpoints
│   └── Posting Logic                  # SAP posting (uses enriched data)
│
├── srv/
│   ├── handlers/
│   │   └── rule-engine.js             # ✅ ACTIVE Processing Rules
│   │       ├── executeProcessingRules()     # Main entry
│   │       ├── executeDynamicRule()         # Execute one rule
│   │       ├── evaluateRuleCondition()      # Check if rule applies
│   │       ├── buildDynamicAPIURL()         # Build API URL
│   │       ├── callSAPAPI()                 # Call SAP API
│   │       └── extractDynamicField()        # Extract response fields
│   │
│   └── integrations/
│       └── sap-client.js              # SAP API client
│           ├── executeSapGetRequest()       # GET requests
│           ├── executeSapPostRequest()      # POST requests
│           └── executeDirectConnection()    # Direct .env connection
│
└── data/
    ├── processing_rules.json          # Processing Rules backup
    └── reference_doc_rules.json       # Reference Rules backup (deprecated)
```

---

## 🎯 Processing Rules Flow (rule-engine.js):

### **1. Entry Point**:
```javascript
// Called from server.js during validation
const result = await ruleEngine.executeProcessingRules(
    fileType,      // "EXCEL"
    destination,   // "S4HANA_SYSTEM_DESTINATION"
    uploadedData   // Array of rows from Excel
);
```

### **2. Load Rules from Database**:
```javascript
// Query PostgreSQL for rules matching fileType + destination
SELECT * FROM lb_processing_rules 
WHERE file_type = 'EXCEL' 
AND destination = 'S4HANA_SYSTEM_DESTINATION';
```

### **3. For Each Rule**:
```javascript
// Step 1: Check conditions
if (evaluateRuleCondition(rule.conditions, data)) {
    
    // Step 2: For each data row
    for (let row of data) {
        
        // Step 3: Get source value (e.g., Invoice Number)
        const sourceValue = findFieldValue(row, 'Invoice Number');
        
        // Step 4: Build API URL
        const apiURL = buildDynamicAPIURL(
            rule.apiMappings[0], 
            'Invoice Number', 
            sourceValue
        );
        // Result: /ZFI_I_ACC_DOCUMENT(P_DocumentNumber='0090003904')/Set
        
        // Step 5: Call SAP API
        const response = await callSAPAPI(apiURL, 'GET', destination);
        
        // Step 6: Extract fields from response
        for (let fieldMapping of rule.fieldMappings) {
            const value = extractDynamicField(
                response.data, 
                fieldMapping.targetField  // "Belnr"
            );
            
            // Step 7: Enrich row data
            row[fieldMapping.apiField] = value;  // "paymentreference"
        }
    }
}
```

### **4. Return Result**:
```javascript
return {
    success: true,
    enrichedData: data,          // Modified data with new fields
    rulesExecuted: ['RULE-001', 'RULE-002'],
    recordsEnriched: 10,
    errors: [],
    warnings: []
};
```

---

## 🔄 Reference Document Rules Flow (server.js) - DEPRECATED:

### **Old Logic** (No longer used):
```javascript
// During posting (server.js line 7010-7078)

// Get active rule
const activeRule = getActiveReferenceDocRule();  // e.g., Rule 4 (XBLNR_THEN_BELNR)

// For each invoice
for (let invoice of invoices) {
    let paymentReference;
    
    // PRIORITY 1: Use enriched value from RULE-001
    if (invoice.paymentreference) {
        paymentReference = invoice.paymentreference;
    }
    // PRIORITY 2: Apply Reference Document Rule
    else {
        switch (activeRule.ruleType) {
            case 'XBLNR_THEN_BELNR':
                paymentReference = invoice.xblnr || invoice.belnr || invoice.invoiceNumber;
                break;
            // ... other cases
        }
    }
}
```

### **New Logic** (Current):
```javascript
// Simplified - only use RULE-001 enriched value

for (let invoice of invoices) {
    let paymentReference;
    
    if (invoice.paymentreference) {
        paymentReference = invoice.paymentreference;  // From RULE-001
    } else {
        paymentReference = invoice.invoiceNumber;     // Simple fallback
    }
}

// ❌ Reference Document Rules logic removed
```

---

## 📊 Database Schema:

### **Processing Rules Table** (PostgreSQL):
```sql
CREATE TABLE lb_processing_rules (
    rule_id VARCHAR PRIMARY KEY,           -- "RULE-001", "RULE-002", etc.
    rule_name VARCHAR,                     -- "Accounting Document Lookup"
    description TEXT,
    file_type VARCHAR,                     -- "EXCEL", "CSV", etc.
    destination VARCHAR,                   -- "S4HANA_SYSTEM_DESTINATION"
    conditions JSONB,                      -- When to execute rule
    api_mappings JSONB,                    -- SAP API configuration
    field_mappings JSONB,                  -- Field extraction mapping
    priority INTEGER,
    active BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### **Example RULE-001 Record**:
```json
{
  "rule_id": "RULE-001",
  "rule_name": "Accounting Document Lookup",
  "file_type": "EXCEL",
  "destination": "S4HANA_SYSTEM_DESTINATION",
  "conditions": [
    {
      "operator": "contains",
      "attribute": "Invoice Number",
      "value": "Value"
    }
  ],
  "api_mappings": [
    {
      "httpMethod": "GET",
      "sourceType": "OData V4",
      "destination": "S4HANA_SYSTEM_DESTINATION",
      "apiReference": "/sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set"
    }
  ],
  "field_mappings": [
    {
      "sourceField": "Invoice Number",
      "targetField": "Belnr",
      "apiField": "paymentreference"
    },
    {
      "sourceField": "Invoice Number",
      "targetField": "CompanyCode",
      "apiField": "CompanyCode"
    }
  ]
}
```

---

## 🎯 Summary:

### **Processing Rules (rule-engine.js)** ✅ ACTIVE:
- **What**: Dynamic, database-driven rules for SAP operations
- **When**: Validation, Posting, Viewing
- **How**: Configurable via PostgreSQL
- **Purpose**: Enrich data with SAP API calls
- **Status**: Active and working

### **Reference Document Rules (server.js)** ❌ DEPRECATED:
- **What**: Static field selection rules
- **When**: Posting only
- **How**: Hardcoded in JavaScript
- **Purpose**: Choose which field to use for payment reference
- **Status**: Deprecated (we removed the logic)

### **Why Two Systems?**
The Reference Document Rules were an **older, simpler approach** before the dynamic Processing Rules system was built. They should have been removed when Processing Rules were added, but they remained as a fallback. We've now deprecated them to simplify the architecture.

---

## 📝 Recommendations:

### **Short Term**:
- ✅ Keep using Processing Rules (rule-engine.js)
- ✅ Reference Document Rules deprecated but code remains (doesn't hurt)

### **Long Term** (Future Cleanup):
- Remove Reference Document Rules code from server.js (lines 3964-4021, 7010-7078)
- Remove `reference_doc_rules.json` file
- Remove related API endpoints
- Simplify posting logic

---

**In essence**: 
- **rule-engine.js** = The real, powerful, dynamic rule system ✅
- **server.js Reference Rules** = Old legacy system that's now deprecated ❌
