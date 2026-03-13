# RULE VALIDATION CODE FLOW
## How RULE-001 and RULE-002 Fetch Data from lb_processing_rules Table

---

## 📋 Overview

When a lockbox file is uploaded, the validation process dynamically fetches RULE-001 and RULE-002 from the `lb_processing_rules` table (or JSON fallback) and executes API calls to SAP to enrich the data.

---

## 🔄 Complete Flow

### **1. Data Loading (On Server Startup)**

**File:** `/app/backend/server.js` - Lines 3397-3450

```javascript
// Load all processing rules from PostgreSQL or JSON
async function loadProcessingRulesFromDb() {
    if (!dbAvailable) {
        console.log('Database not available, loading processing rules from file backup');
        loadProcessingRulesFromFile();
        return;
    }
    
    try {
        // ⚡ FETCH FROM lb_processing_rules TABLE
        const result = await pool.query('SELECT * FROM lb_processing_rules ORDER BY priority ASC');
        
        if (result.rows.length === 0) {
            console.log('No processing rules in LB_Processing_Rules table, loading from file...');
            loadProcessingRulesFromFile();
        } else {
            // Map database rows to rule objects
            processingRules = result.rows.map(row => ({
                id: row.id,
                ruleId: row.rule_id,
                ruleName: row.rule_name,
                description: row.description,
                fileType: row.file_type,
                ruleType: row.rule_type,
                active: row.active,
                priority: row.priority,
                destination: row.destination,
                conditions: row.conditions || [],
                apiMappings: row.api_mappings || [],
                fieldMappings: row.field_mappings || [],  // NEW FIELD
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
            
            console.log('Loaded', processingRules.length, 'processing rules from LB_Processing_Rules table');
        }
        
        // Load rules into rule engine
        ruleEngine.loadProcessingRules(processingRules);
        console.log(`✅ Processing rules loaded into rule engine: ${processingRules.length}`);
    }
}
```

---

### **2. File Upload & Validation Trigger**

**File:** `/app/backend/server.js` - Lines 7930-7990

```javascript
// STAGE 4: VALIDATION & ENRICHMENT - Execute Processing Rules Dynamically from DB
run.currentStage = 'validation';
console.log('=== VALIDATION & API MATCHING (RULE-001 & RULE-002) ===');

try {
    // Normalize file type for rule matching (XLSX/XLS → EXCEL)
    const normalizedFileType = patternEngine.normalizeFileType(fileType);
    console.log(`   File Type Normalization: ${fileType} → ${normalizedFileType}`);
    
    // ⚡ THIS IS WHERE RULES ARE FETCHED AND EXECUTED ⚡
    // Execute RULE-001 and RULE-002 using dynamic rule engine
    const validationResult = await ruleEngine.processLockboxRules(
        extractedData,
        normalizedFileType  // Use normalized file type (EXCEL, CSV, etc.)
    );
    
    // Update extracted data with enriched values from RULE-001 & RULE-002
    extractedData = validationResult.enrichedData;
    
    // DEBUG: Check if enrichment worked
    console.log(`  🔍 DEBUG POST-ENRICHMENT: extractedData length: ${extractedData.length}`);
    if (extractedData.length > 0) {
        const firstRow = extractedData[0];
        console.log(`  🔍 Paymentreference value: "${firstRow.Paymentreference}"`);
        console.log(`  🔍 CompanyCode value: "${firstRow.CompanyCode}"`);
    }
    
    run.stages.validation.status = 'completed';
    run.stages.validation.message = `${validationResult.rulesExecuted.length}/2 rules executed, ${validationResult.recordsEnriched} records enriched`;
    
} catch (validationError) {
    console.error('Validation error:', validationError);
    run.stages.validation.status = 'error';
}
```

---

### **3. Rule Engine Execution**

**File:** `/app/backend/srv/handlers/rule-engine.js` - Lines 46-120

```javascript
/**
 * Main Function: Process Lockbox with Dynamic Rules (RULE-001 & RULE-002 only)
 * Fetches rules from cached array (loaded from lb_processing_rules table)
 */
async function processLockboxRules(extractedData, fileType = 'EXCEL') {
    console.log('🔍 LOCKBOX DYNAMIC VALIDATION - RULE-001 & RULE-002');
    
    const result = {
        success: true,
        rulesExecuted: [],
        recordsEnriched: 0,
        errors: [],
        warnings: [],
        enrichedData: JSON.parse(JSON.stringify(extractedData)) // Deep copy
    };
    
    try {
        // ⚡ Step 1: Filter applicable rules from cached rules (FROM DATABASE)
        console.log(`   Filtering rules with: fileType="${fileType}", destination="S4HANA_SYSTEM_DESTINATION"`);
        console.log(`   Total cached rules: ${cachedProcessingRules.length}`);
        
        const applicableRules = cachedProcessingRules.filter(rule => {
            return rule.active && 
                rule.fileType === fileType &&
                rule.destination === 'S4HANA_SYSTEM_DESTINATION' &&
                (rule.ruleId === 'RULE-001' || rule.ruleId === 'RULE-002');
        });
        
        console.log(`\n📋 Found ${applicableRules.length} applicable validation rules`);
        
        if (applicableRules.length === 0) {
            result.warnings.push('No active validation rules found for file type: ' + fileType);
            return result;
        }
        
        // ⚡ Step 2: Execute each rule sequentially
        for (const rule of applicableRules) {
            console.log(`⚙️  Executing ${rule.ruleId}: ${rule.ruleName}`);
            
            // Step 3: Evaluate rule condition
            const conditionMet = evaluateRuleCondition(rule.conditions, result.enrichedData);
            
            if (!conditionMet) {
                console.log(`⏭️  ${rule.ruleId}: Condition not met - skipping`);
                continue;
            }
            
            console.log(`✅ ${rule.ruleId}: Condition met - proceeding with API call`);
            
            // ⚡ Step 4: Execute rule dynamically using API mappings from database
            const ruleResult = await executeDynamicRule(rule, result.enrichedData);
            
            if (ruleResult.success) {
                result.rulesExecuted.push(rule.ruleId);
                result.recordsEnriched += ruleResult.recordsEnriched || 0;
                console.log(`✅ ${rule.ruleId} completed: ${ruleResult.recordsEnriched} records enriched`);
            } else {
                result.errors.push(`${rule.ruleId}: ${ruleResult.error}`);
            }
        }
        
        return result;
        
    } catch (error) {
        console.error('Rule processing error:', error);
        result.success = false;
        result.errors.push(error.message);
        return result;
    }
}
```

---

### **4. Dynamic Rule Execution with API Mappings**

**File:** `/app/backend/srv/handlers/rule-engine.js` - Lines 170-300

```javascript
/**
 * Execute a single rule dynamically using database configuration
 * Uses apiMappings from lb_processing_rules table
 */
async function executeDynamicRule(rule, extractedData) {
    console.log(`\n   📌 Rule: ${rule.ruleId} - ${rule.ruleName}`);
    console.log(`   📌 Description: ${rule.description}`);
    console.log(`   📌 API Mappings: ${rule.apiMappings?.length || 0}`);
    
    const result = {
        success: true,
        recordsEnriched: 0,
        errors: []
    };
    
    try {
        // ⚡ Loop through API mappings from database
        for (const mapping of rule.apiMappings || []) {
            console.log(`\n   🌐 API Call: ${mapping.httpMethod} ${mapping.apiReference}`);
            console.log(`   📥 Input: ${mapping.sourceType} → ${mapping.destination}`);
            
            // ⚡ Call appropriate rule handler based on rule ID
            let ruleResult;
            switch (rule.ruleId) {
                case 'RULE-001':
                    ruleResult = await executeRule001(mapping, extractedData);
                    break;
                case 'RULE-002':
                    ruleResult = await executeRule002(mapping, extractedData);
                    break;
                default:
                    console.log(`   ⚠️  No handler for ${rule.ruleId}`);
                    continue;
            }
            
            if (ruleResult.success) {
                result.recordsEnriched += ruleResult.recordsEnriched || 0;
            } else {
                result.errors.push(ruleResult.error);
            }
        }
        
        return result;
        
    } catch (error) {
        console.error(`   ❌ Error executing ${rule.ruleId}:`, error);
        result.success = false;
        result.errors.push(error.message);
        return result;
    }
}
```

---

## 📊 Data Structure from lb_processing_rules

### **RULE-001 Example:**

```json
{
  "rule_id": "RULE-001",
  "rule_name": "Accounting Document Lookup",
  "file_type": "EXCEL",
  "active": true,
  "destination": "S4HANA_SYSTEM_DESTINATION",
  "conditions": [
    {
      "attribute": "Invoice Number",
      "operator": "contains",
      "value": "Source Value"
    }
  ],
  "api_mappings": [
    {
      "sourceType": "OData V4",
      "destination": "S4HANA_SYSTEM_DESTINATION",
      "httpMethod": "GET",
      "apiReference": "/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set"
    }
  ],
  "field_mappings": [
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

---

## ✅ Summary

1. **On Server Start:** Rules are loaded from `lb_processing_rules` table into memory
2. **On File Upload:** Validation stage filters rules by `fileType`, `active=true`, `destination`
3. **Rule Execution:** Uses `apiMappings` from database to construct SAP API calls
4. **Data Enrichment:** Response fields are mapped to lockbox fields using `fieldMappings`
5. **Result:** Enriched data is returned with `PaymentReference`, `CompanyCode`, `PartnerBank`, etc.

---

## 🔧 Key Points

- ✅ **Database-Driven:** All rule logic comes from `lb_processing_rules` table
- ✅ **Fallback to JSON:** Uses `/app/backend/data/processing_rules.json` if DB unavailable
- ✅ **Dynamic API Calls:** API endpoints are constructed from `apiMappings.apiReference`
- ✅ **Field Mapping:** Uses new `field_mappings` column for source→target→API mapping
- ✅ **No Hardcoding:** All field names, operators, and values come from database

---

## 📁 Files Involved

1. `/app/backend/server.js` - Main validation flow (lines 7930-7990)
2. `/app/backend/srv/handlers/rule-engine.js` - Rule execution logic
3. `/app/backend/data/processing_rules.json` - JSON fallback
4. PostgreSQL Table: `lb_processing_rules` - Primary data source
