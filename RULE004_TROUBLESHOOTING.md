# RULE-004 Troubleshooting Guide

## Current Issue: SAP 400 Error with Clean URL

The URL is now properly formatted, but SAP is rejecting the query with a 400 error.

### Possible Causes:

1. **Field Name is Wrong**: `LockBoxId` might not be the correct field name
   - Try: `Lockbox`, `LockboxId`, `LOCKBOXID`, `LockBoxID`
   
2. **OData V4 Syntax Issue**: The filter or select syntax might be incorrect for this SAP service

3. **SAP Service Doesn't Support These Fields**: The fields in $select might not exist or might have different names

---

## Testing Steps for User (in BTP):

### **Test 1: Minimal Query** (DEPLOYED NOW)

The code now uses only the filter, no $select or $top:

```javascript
queryParams = {
  '$filter': "LockBoxId eq '1000189'"
}
```

**Deploy and test**. Check BTP logs:
- ✅ If it works: The issue is with $select or $top
- ❌ If still 400: The issue is with the field name `LockBoxId`

---

### **Test 2: Try Different Field Names**

If Test 1 fails, try these alternatives one by one:

```javascript
// Option A: All lowercase
'$filter': "Lockbox eq '1000189'"

// Option B: Camel case
'$filter': "lockboxId eq '1000189'"

// Option C: All uppercase
'$filter': "LOCKBOXID eq '1000189'"

// Option D: Different mixed case
'$filter': "LockBoxID eq '1000189'"
```

---

### **Test 3: Check SAP OData Metadata**

Call the SAP metadata endpoint to see the actual field names:

```bash
curl -X GET "https://44.196.95.84:44301/sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/$metadata" \
  -H "Authorization: Basic <your-base64-credentials>" \
  -H "Accept: application/xml"
```

This will return the schema showing:
- Correct field names
- Field types
- Available properties

---

### **Test 4: Test in SAP Gateway (If Accessible)**

If you have access to SAP Gateway Client (transaction `/IWFND/GW_CLIENT`):

1. Open transaction `/IWFND/GW_CLIENT`
2. Enter the URI: `/sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT?$filter=LockBoxId eq '1000189'`
3. Execute
4. Check the error message - it will tell you exactly what's wrong

---

## Comparison with RULE-002 (Working)

RULE-002 works and uses:
- **OData V2** (not V4)
- **Function import style**: `A_BusinessPartner(BusinessPartner='')`
- **Different endpoint**: `/sap/opu/odata/sap/API_BUSINESS_PARTNER/...`

**Key difference**: RULE-002 uses **OData V2**, RULE-004 uses **OData V4**

---

## Quick Fix Options:

### **Option A: Ask SAP Team**

Contact your SAP BASIS/ABAP team and ask:
1. "What is the correct field name to filter by Lockbox ID in service `ZFI_I_ACC_BANK_STMT`?"
2. "Can you provide a working OData V4 query example for this service?"
3. "Is the service name correct: `zsb_acc_bank_stmt` and entity `ZFI_I_ACC_BANK_STMT`?"

### **Option B: Check Existing Working Call**

If RULE-004 worked before (with the hardcoded `1000073`), check:
- What was the EXACT URL that worked?
- Copy that URL format exactly

---

## Current Code Status:

✅ **Deployed**: Minimal query (filter only, no $select/$top)
⏳ **Waiting**: BTP test results with minimal query

**Next steps depend on Test 1 results.**
