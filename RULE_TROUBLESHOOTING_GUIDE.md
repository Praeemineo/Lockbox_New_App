# RULE-001 & RULE-002 Troubleshooting Guide

## 🔍 Issue Description

User reports that RULE-001 and RULE-002 are not working in BTP deployment. The logs show:
- API calls are succeeding
- But field extraction is failing with "Field not found in response"
- Specifically for RULE-002: BankNumber, BankAccount, BankCountryKey not found

## ✅ What We've Verified

### 1. Rule Configuration is Correct
```bash
# Verified with:
node /app/verify_rule002.js
```

**RULE-002 Field Mappings:**
- sourceField: "Customer Number"
- targetField: "to_BusinessPartnerBank/results/0/BankNumber"
- apiField: "PartnerBank"

The full nested path is correctly configured in `/app/backend/data/processing_rules.json`

### 2. API Calls Are Working
Based on standalone tests:
- RULE-001 with Invoice 90003904 → Returns data ✅
- RULE-002 with Customer 17100009 → Returns data ✅

### 3. extractDynamicField Function Supports Nested Paths
The function in `/app/backend/srv/handlers/rule-engine.js` correctly handles:
- Simple paths: "AccountingDocument"
- Nested paths: "to_BusinessPartnerBank/results/0/BankNumber"

## 🐛 Possible Root Causes

### Cause 1: Response Structure Mismatch
**Problem:** The actual SAP response structure doesn't match what we expect

**Debug Steps:**
1. Check the logs for "📦 Response structure:" - this will show first 500 chars of response
2. Compare with expected OData V2 structure:
   ```json
   {
     "d": {
       "BusinessPartner": "...",
       "to_BusinessPartnerBank": {
         "results": [
           {
             "BankNumber": "...",
             "BankAccount": "...",
             "BankCountryKey": "..."
           }
         ]
       }
     }
   }
   ```

**Solution:** If structure is different, update the targetField paths in processing_rules.json

### Cause 2: $expand Parameter Not Working
**Problem:** The `$expand=to_BusinessPartnerBank` in the API URL might not be applied correctly

**Debug Steps:**
1. Check logs for "Final URL:" to see if $expand is in the URL
2. Verify the actual API response contains `to_BusinessPartnerBank`

**Solution:**
- If $expand is missing, check how query parameters are being added in callSAPAPI
- Might need to pass $expand as a separate query param object

### Cause 3: OData V2 vs V4 Response Format
**Problem:** RULE-002 uses OData V2, RULE-001 uses OData V4. Different response wrapping.

**Expected Formats:**
- OData V2: `{ d: { ... } }`
- OData V4: `{ value: [...] }`

**Solution:** Ensure extractDynamicField handles both formats (it currently does)

### Cause 4: Caching in BTP Deployment
**Problem:** BTP might be using a cached version of the code or rules

**Debug Steps:**
1. Check if there are multiple copies of processing_rules.json
2. Verify the rule engine code being executed is the latest

**Solution:**
```bash
# Force clear any caches
cf restage <app-name>
# or
cf restart <app-name>
```

## 🔧 Enhanced Logging Added

We've added additional logging to help diagnose:

```javascript
// In executeDynamicRule function:
console.log(`   📦 Response structure:`, JSON.stringify(response.data).substring(0, 500));
console.log(`      📋 Full fieldMapping:`, JSON.stringify(fieldMapping));
```

## 📋 Next Steps for User

### Step 1: Upload Test File
Upload an Excel file with:
- Column: "Invoice Number" with value "90003904"
- Column: "Customer Number" with value "17100009"

### Step 2: Check BTP Logs
Look for these log entries:
```
📦 Response structure: {...}
📋 Full fieldMapping: {...}
```

### Step 3: Share Response Structure
Copy the "📦 Response structure" log entry and share it. This will show us:
- Is the API returning data?
- What is the actual structure?
- Does it match our expectations?

### Step 4: Verify Field Mappings Being Used
Check the "📋 Full fieldMapping" log entries. They should show:
```json
{
  "sourceField": "Customer Number",
  "targetField": "to_BusinessPartnerBank/results/0/BankNumber",
  "apiField": "PartnerBank"
}
```

If targetField shows just "BankNumber" instead of the full path, then the rules are not being loaded correctly from the file.

## 🎯 Quick Fixes to Try

### Fix 1: Restart Backend Service
```bash
sudo supervisorctl restart backend
```

### Fix 2: Clear Rule Cache
The rule engine loads rules on startup. Restart ensures fresh load:
```bash
sudo supervisorctl restart backend
# Wait 5 seconds
sudo supervisorctl status backend
```

### Fix 3: Verify Rule Engine is Using Latest Code
```bash
# Check if rule-engine.js has the latest changes
grep "Response structure" /app/backend/srv/handlers/rule-engine.js
# Should show the new logging line
```

### Fix 4: Test API Directly
```bash
# Test RULE-002 API call directly
node /app/test_sap_api.js
# Should return bank details
```

## 📊 Expected vs Actual

### Expected Behavior:
1. Upload file with Customer Number "17100009"
2. RULE-002 executes
3. Calls API: `/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner(BusinessPartner='0017100009')?$expand=to_BusinessPartnerBank&$format=json`
4. Receives response with `to_BusinessPartnerBank.results[0]`
5. Extracts BankNumber, BankAccount, BankCountryKey
6. Stores in PartnerBank, PartnerBankAccount, PartnerBankCountry
7. Log shows: "✅ PartnerBank = '011000390'"

### Actual Behavior (from user logs):
1. Upload file ✅
2. RULE-002 executes ✅
3. API call succeeds ✅
4. Response received ✅
5. Field extraction fails ❌
   - Log shows: "⚠️ BankNumber not found in response"
   - Should be looking for "to_BusinessPartnerBank/results/0/BankNumber"
   - But seems to be looking for just "BankNumber"

## 🚨 Critical Question

**Is the targetField being passed correctly to extractDynamicField?**

The new logging will answer this:
```
📋 Full fieldMapping: {"sourceField":"Customer Number","targetField":"to_BusinessPartnerBank/results/0/BankNumber","apiField":"PartnerBank"}
```

If this shows the full path, then the issue is in extractDynamicField logic or response structure.
If this shows just "BankNumber", then the rules are not being loaded correctly.

## 📞 Support

If issue persists after checking all above:
1. Share the complete BTP logs showing:
   - Response structure
   - Full fieldMapping objects
   - extractDynamicField navigation logs
2. Confirm which environment (local vs BTP)
3. Confirm if the same file works in local environment

---

**Status:** Enhanced logging deployed and backend restarted.
**Next:** Wait for user to upload file and share new logs with additional debug information.
