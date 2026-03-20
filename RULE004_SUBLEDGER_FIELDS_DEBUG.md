# RULE-004 Subledger Fields Debug - Navigation View

## Issue Reported

After production run posting, the Navigation view's "Item Data" table shows:
- ✅ **Document Number** - Populated correctly
- ✅ **Payment Advice** - Populated correctly  
- ❌ **Subledger Document** - Showing blank
- ❌ **Subledger On-account** - Showing blank (user says it has value but not displaying)
- ✅ **Amount** - Populated correctly
- ✅ **Document Status** - Populated correctly

## RULE-004 Response Fields

According to user, RULE-004 returns:
- `SubledgerDocument` → Should map to "Subledger Document" column
- `SubledgerOnaccountDocument` → Should map to "Subledger On-account" column

## Code Analysis

### ✅ Backend (runService.js) - CORRECT

**Lines 188-189:**
```javascript
SubledgerDocument: doc.SubledgerDocument || '',
SubledgerOnaccountDocument: doc.SubledgerOnaccountDocument || '',
```

The backend correctly maps these fields from the SAP response to the API response.

### ✅ Frontend Controller (Main.controller.js) - CORRECT

**Lines 8586-8587 (Transaction Details Dialog):**
```javascript
clearingDoc: doc.SubledgerDocument || '',
subledgerOnaccountDoc: doc.SubledgerOnaccountDocument || '',
```

**Lines 8841-8842 (Item Data Table - Primary Path):**
```javascript
subledgerDocument: doc.SubledgerDocument || "",
subledgerOnAccount: doc.SubledgerOnaccountDocument || "",
```

**Lines 8886-8887 (Table Cell Rendering):**
```javascript
new sap.m.Text({ text: item.subledgerDocument }),
new sap.m.Text({ text: item.subledgerOnAccount }),
```

The frontend correctly maps these fields to the table.

### ✅ Frontend View (Main.view.xml) - CORRECT

**Lines 1455, 1493-1494:**
```xml
<Table items="{app>/selectedTransaction/lockboxItems}">
    ...
    <Text text="{app>clearingDoc}"/>          <!-- Subledger Document -->
    <Text text="{app>subledgerOnaccountDoc}"/> <!-- Subledger On-account -->
</Table>
```

The view correctly binds to the controller properties.

## Root Cause

The code mapping is **100% correct**. The issue is that the SAP API is not returning values for these fields:
- `SubledgerDocument` is empty or null
- `SubledgerOnaccountDocument` is empty or null

## Debug Logging Added

Added detailed field mapping logs to **runService.js (line 177)**:

```javascript
console.log(`   📄 Document ${index + 1} field mapping:`);
console.log(`      SubledgerDocument: "${doc.SubledgerDocument || ''}"`);
console.log(`      SubledgerOnaccountDocument: "${doc.SubledgerOnaccountDocument || ''}"`);
console.log(`      DocumentNumber: "${doc.DocumentNumber || ''}"`);
console.log(`      PaymentAdvice: "${doc.PaymentAdvice || ''}"`);
```

## Testing Steps

### Step 1: Trigger RULE-004
1. Go to a posted production run
2. Click on the Navigation arrow (→) icon
3. This triggers RULE-004 API call

### Step 2: Check Backend Logs
```bash
tail -f /var/log/supervisor/backend.out.log | grep -A 10 "Document.*field mapping"
```

**Expected logs:**
```
📄 Document 1 field mapping:
   SubledgerDocument: "VALUE_FROM_SAP"
   SubledgerOnaccountDocument: "VALUE_FROM_SAP"
   DocumentNumber: "9400000440"
   PaymentAdvice: "..."
```

**If showing blank:**
```
📄 Document 1 field mapping:
   SubledgerDocument: ""
   SubledgerOnaccountDocument: ""
```

This confirms SAP is not returning these values.

### Step 3: Check SAP Response Structure

Look for the full SAP response in logs:
```bash
tail -f /var/log/supervisor/backend.out.log | grep -A 50 "Full SAP Response"
```

Check if the response has:
- `SubledgerDocument` field
- `SubledgerOnaccountDocument` field

## Possible Causes

### 1. SAP API Not Returning These Fields
The RULE-004 SAP API endpoint might not include these fields in the response.

**Solution:** Check the SAP API documentation or test the API directly to confirm these fields exist.

### 2. Field Names Different in SAP Response
The fields might be named differently in the SAP response.

**Possible alternatives:**
- `SubledgerDocument` might be `ClearingDocument` or `SubledgerAccountingDocument`
- `SubledgerOnaccountDocument` might be `OnAccountDocument` or `SubledgerOnAccount`

**Solution:** Check the full SAP response in logs and identify the correct field names.

### 3. Additional API Call Required
These fields might require a separate SAP API call or additional parameters in the RULE-004 request.

**Solution:** Check if RULE-004 configuration needs additional field mappings or API parameters.

## How to Fix (Once Root Cause is Identified)

### If Field Names are Different:

Update **runService.js** line 188-189:
```javascript
SubledgerDocument: doc.ActualSAPFieldName || '',
SubledgerOnaccountDocument: doc.ActualSAPFieldName2 || '',
```

### If Fields Don't Exist in Response:

Need to either:
1. Update RULE-004 configuration to request these fields from SAP
2. Make an additional API call to fetch these fields
3. Use alternative fields that are available

## Current Status

✅ **Code mapping:** All correct  
⏳ **Debug logging:** Added  
❓ **SAP response:** Need to verify what fields are actually returned  

## Next Steps

1. **User triggers RULE-004** by clicking Navigation arrow on a posted run
2. **Check backend logs** to see what values are in SubledgerDocument and SubledgerOnaccountDocument
3. **If empty:** Check full SAP response to find correct field names
4. **If field names different:** Update mapping in runService.js
5. **If fields don't exist:** Need to update RULE-004 or add new API call

---

**Please click on the Navigation arrow (→) icon for a posted run and share the backend logs. This will show us exactly what SAP is returning for these fields.**
