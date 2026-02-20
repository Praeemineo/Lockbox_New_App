# API-Level Destination Support - COMPLETE ✅

## Summary
Successfully added SAP Destination column at the API Mapping level, enabling each individual API call within a rule to use different destinations. This provides maximum flexibility for enterprise SAP integrations.

## Architecture Hierarchy

```
Rule (RULE-001)
  ├─ destination: "S4_FINANCE" (rule-level default)
  └─ apiMappings:
      ├─ mapping 1: { destination: "S4_FINANCE", ... }     ← Finance system
      ├─ mapping 2: { destination: "S4_SALES", ... }       ← Sales system
      └─ mapping 3: { destination: "BTP_WORKFLOW", ... }   ← BTP service
```

**Fallback Chain:**
1. **API Mapping destination** (most specific) ← NEW!
2. Rule destination (fallback)
3. Environment variable: `SAP_DESTINATION_NAME`
4. Hardcoded default: `S4HANA_SYSTEM_DESTINATION`

## Changes Implemented

### 1. ✅ Schema Update - processing_rules.json

Added `destination` field to EVERY API mapping in all rules:

```json
{
  "ruleId": "RULE-001",
  "ruleName": "Accounting Document Lookup",
  "destination": "S4HANA_SYSTEM_DESTINATION",  ← Rule-level
  "apiMappings": [
    {
      "httpMethod": "GET",
      "destination": "S4HANA_SYSTEM_DESTINATION",  ← API-level (NEW!)
      "apiReference": "/sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT",
      "inputField": "P_Documentnumber",
      "sourceInput": "InvoiceNumber",
      "outputField": "BELNR"
    },
    {
      "httpMethod": "GET",
      "destination": "S4HANA_SYSTEM_DESTINATION",  ← API-level (NEW!)
      "apiReference": "/sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT",
      "inputField": "P_Documentnumber",
      "sourceInput": "InvoiceNumber",
      "outputField": "CompanyCode"
    }
  ]
}
```

**All API Mappings Updated:**
- RULE-001: 2 mappings → added destination
- RULE-002: 3 mappings → added destination
- RULE-003: 2 mappings → added destination
- RULE-004: 1 mapping → added destination
- RULE-005: 1 mapping → added destination
- **Total: 9 API mappings with destination field**

### 2. ✅ Backend Code Update - sap-client.js

Updated `executeDynamicApiCall()` to use API-level destination with fallback:

```javascript
// BEFORE
async function executeDynamicApiCall(apiMapping, inputValues, ruleDestination) {
    const destinationName = ruleDestination || 
                           process.env.SAP_DESTINATION_NAME || 
                           'S4HANA_SYSTEM_DESTINATION';
}

// AFTER
async function executeDynamicApiCall(apiMapping, inputValues, ruleDestination) {
    // Fallback chain: API → Rule → Env → Default
    const destinationName = apiMapping.destination ||      // ← API-level (MOST SPECIFIC)
                           ruleDestination ||              // ← Rule-level
                           process.env.SAP_DESTINATION_NAME ||  // ← Environment
                           'S4HANA_SYSTEM_DESTINATION';    // ← Default
    
    logger.info(`Dynamic SAP API Call via ${destinationName}`, { 
        apiDestination: apiMapping.destination || 'not specified',
        ruleDestination: ruleDestination || 'not specified',
        finalDestination: destinationName
    });
}
```

Updated `fetchPartnerBankDetails()` to extract destination from API mapping:

```javascript
// Extract destination from API mapping (most specific) OR rule (fallback)
const destinationToUse = firstMapping.destination || 
                        ruleDestination || 
                        process.env.SAP_DESTINATION_NAME || 
                        'S4HANA_SYSTEM_DESTINATION';

logger.info('RULE-002: Using destination:', {
    apiMappingDestination: firstMapping.destination,
    ruleDestination: ruleDestination,
    finalDestination: destinationToUse
});
```

### 3. ✅ Frontend UI Update - ProcessingRuleDialog.fragment.xml

Added "SAP Destination" column in API Mapping table:

**Before (6 columns):**
```xml
<columns>
    <Column width="15%"><Text text="HTTP Method" /></Column>
    <Column width="20%"><Text text="API Reference" /></Column>
    <Column width="20%"><Text text="Input Field" /></Column>
    <Column width="15%"><Text text="Source/Input" /></Column>
    <Column width="15%"><Text text="Output Field" /></Column>
    <Column width="10%"><Text text="Lockbox API Field" /></Column>
    <Column width="5%"><Text text="" /></Column>
</columns>
```

**After (7 columns):**
```xml
<columns>
    <Column width="10%"><Text text="HTTP Method" /></Column>
    <Column width="15%"><Text text="SAP Destination" /></Column>  ← NEW COLUMN!
    <Column width="20%"><Text text="API Reference" /></Column>
    <Column width="15%"><Text text="Input Field" /></Column>
    <Column width="13%"><Text text="Source/Input" /></Column>
    <Column width="13%"><Text text="Output Field" /></Column>
    <Column width="10%"><Text text="Lockbox API Field" /></Column>
    <Column width="4%"><Text text="" /></Column>
</columns>
```

**Input Field Added:**
```xml
<Input 
    value="{processingRuleDialog>destination}" 
    placeholder="S4HANA_SYSTEM_DESTINATION"
    tooltip="BTP Destination for this API" />
```

## Use Cases Enabled

### Use Case 1: Multi-System Lookup in Single Rule
```json
{
  "ruleId": "RULE-001",
  "apiMappings": [
    {
      "destination": "S4_FINANCE",  ← Fetch BELNR from Finance
      "apiReference": "/sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT",
      "outputField": "BELNR"
    },
    {
      "destination": "BTP_WORKFLOW",  ← Validate with BTP Workflow
      "apiReference": "/btp/api/workflow/v1/validate",
      "outputField": "ValidationStatus"
    }
  ]
}
```

### Use Case 2: Different Regions/Systems per API
```json
{
  "ruleId": "RULE-002",
  "apiMappings": [
    {
      "destination": "S4_US",  ← US region
      "apiReference": "/sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartnerBank"
    },
    {
      "destination": "S4_EU",  ← EU region
      "apiReference": "/sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartnerBank"
    }
  ]
}
```

### Use Case 3: Hybrid Integration
```json
{
  "ruleId": "RULE-003",
  "apiMappings": [
    {
      "destination": "S4_ONPREM",  ← On-premise S/4HANA
      "apiReference": "/sap/opu/odata/sap/API_CUSTOMER/A_Customer"
    },
    {
      "destination": "ARIBA_CLOUD",  ← SAP Ariba Cloud
      "apiReference": "/ariba/api/procurement/v1/supplier"
    },
    {
      "destination": "CONCUR_CLOUD",  ← SAP Concur Cloud
      "apiReference": "/concur/api/expense/v1/validate"
    }
  ]
}
```

## UI Screenshot Description

**Processing Rules → API Mappings Tab:**

| HTTP Method | SAP Destination | API Reference | Input Field | Source/Input | Output Field | Lockbox Field | Actions |
|-------------|-----------------|---------------|-------------|--------------|--------------|---------------|---------|
| GET | S4HANA_SYSTEM_DESTINATION | /sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT | P_Documentnumber | InvoiceNumber | BELNR | Paymentreference | 🗑️ |
| GET | S4HANA_SYSTEM_DESTINATION | /sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT | P_Documentnumber | InvoiceNumber | CompanyCode | CompanyCode | 🗑️ |

**User Can Now:**
1. ✅ Click in "SAP Destination" column
2. ✅ Enter destination name (e.g., "S4_FINANCE", "S4_SALES")
3. ✅ Save rule with API-specific destinations
4. ✅ Each API can target different systems

## Benefits

### 1. Maximum Flexibility
- ✅ Rule-level destination for default
- ✅ API-level destination for specific calls
- ✅ Mix on-premise and cloud in same rule
- ✅ Different regions per API

### 2. Enterprise-Ready
- ✅ Finance APIs → S4_FINANCE destination
- ✅ Sales APIs → S4_SALES destination
- ✅ BTP Services → BTP_WORKFLOW destination
- ✅ Legacy systems → LEGACY_SYSTEM destination

### 3. Backward Compatible
- ✅ If API destination not specified → uses rule destination
- ✅ If rule destination not specified → uses environment variable
- ✅ If env not set → uses default
- ✅ No breaking changes

### 4. Clear Logging
```
[INFO] Dynamic SAP API Call via S4_FINANCE
  apiDestination: S4_FINANCE
  ruleDestination: S4HANA_SYSTEM_DESTINATION
  finalDestination: S4_FINANCE  ← API-level wins
```

## Configuration Examples

### Example 1: Same Destination (Current Setup)
```json
{
  "ruleId": "RULE-001",
  "destination": "S4HANA_SYSTEM_DESTINATION",
  "apiMappings": [
    {
      "destination": "S4HANA_SYSTEM_DESTINATION",  ← Same as rule
      "apiReference": "/sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT"
    }
  ]
}
```

### Example 2: Different Destinations per API
```json
{
  "ruleId": "RULE-001",
  "destination": "S4_FINANCE",  ← Rule default
  "apiMappings": [
    {
      "destination": "S4_FINANCE",  ← Uses rule default
      "apiReference": "/sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT"
    },
    {
      "destination": "S4_SALES",  ← OVERRIDES rule default!
      "apiReference": "/sap/opu/odata/sap/API_SALES_ORDER/A_SalesOrder"
    }
  ]
}
```

### Example 3: API Destination Only (No Rule Destination)
```json
{
  "ruleId": "RULE-001",
  // No destination field at rule level
  "apiMappings": [
    {
      "destination": "S4_FINANCE",  ← Specified at API level
      "apiReference": "/sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT"
    }
  ]
}
```

## Testing

### Test 1: Current Setup (All Same Destination)
```bash
# All APIs use S4HANA_SYSTEM_DESTINATION
curl -X POST .../api/lockbox/process -F "file=@test.csv"
```

**Expected Log:**
```
[INFO] RULE-001 using destination: S4HANA_SYSTEM_DESTINATION
[INFO] Dynamic SAP API Call via S4HANA_SYSTEM_DESTINATION
  apiDestination: S4HANA_SYSTEM_DESTINATION
  finalDestination: S4HANA_SYSTEM_DESTINATION
```

### Test 2: Different Destinations per API
Update `processing_rules.json`:
```json
{
  "ruleId": "RULE-001",
  "destination": "S4_FINANCE",
  "apiMappings": [
    { "destination": "S4_FINANCE", ... },
    { "destination": "S4_SALES", ... }
  ]
}
```

**Expected Log:**
```
[INFO] Dynamic SAP API Call via S4_FINANCE (first mapping)
[INFO] Dynamic SAP API Call via S4_SALES (second mapping)
```

### Test 3: Fallback Behavior
Remove destination from API mapping:
```json
{
  "destination": "S4_FINANCE",
  "apiMappings": [
    {
      // No destination field
      "apiReference": "..."
    }
  ]
}
```

**Expected Log:**
```
[INFO] Dynamic SAP API Call via S4_FINANCE
  apiDestination: not specified
  ruleDestination: S4_FINANCE
  finalDestination: S4_FINANCE  ← Falls back to rule destination
```

## Files Modified

1. **Schema:**
   - `/app/backend/data/processing_rules.json` - Added destination to 9 API mappings

2. **Backend:**
   - `/app/backend/srv/integrations/sap-client.js`
     - Updated `executeDynamicApiCall()` - API-level destination with fallback
     - Updated `fetchPartnerBankDetails()` - Extract API-level destination

3. **Frontend:**
   - `/app/frontend/public/webapp/view/ProcessingRuleDialog.fragment.xml`
     - Added "SAP Destination" column (7 columns total)
     - Added Input field for destination with placeholder

## Migration Path

**Phase 1: Deploy (No Breaking Changes)**
- ✅ Code deployed with API-level destination support
- ✅ Existing rules work (use rule-level destination)
- ✅ Backward compatible

**Phase 2: Add API Destinations (Gradual)**
- Configure specific destinations in BTP Cockpit
- Update `processing_rules.json` API mappings
- Test with different destinations per API

**Phase 3: Optimize (Optional)**
- Remove rule-level destination if all APIs specify their own
- Or keep rule-level as default fallback

## Comparison with Previous Implementation

| Feature | Rule-Level Only | Rule + API Level (NEW) |
|---------|----------------|------------------------|
| Granularity | Coarse (all APIs use same dest) | Fine (each API has own dest) |
| Flexibility | Low | High ✅ |
| Multi-System | Limited | Full Support ✅ |
| Hybrid Integration | No | Yes ✅ |
| Backward Compatible | N/A | Yes ✅ |
| UI Column | No | Yes ✅ |

## Summary

✅ **API-Level Destination Support Fully Implemented**
✅ **UI Column Added** - "SAP Destination" visible in API Mapping table
✅ **Backend Logic Updated** - Fallback chain: API → Rule → Env → Default
✅ **Schema Updated** - All 9 API mappings have destination field
✅ **Backward Compatible** - Existing rules continue to work
✅ **Enterprise-Ready** - Maximum flexibility for complex integrations

The implementation provides the finest level of destination control, enabling true multi-system, multi-region, hybrid cloud/on-premise SAP integrations!
