# Default Company Code Updated to 1710

## ✅ Change Applied

**Previous Default:** 1000  
**New Default:** 1710

---

## Files Modified:

### **1. `/app/backend/srv/handlers/rule-engine.js`**

**Changes:**

#### **RULE-001 (Line ~77):**
```javascript
// BEFORE
const companyCode = row.CompanyCode || '1000'; // Default company code

// AFTER
const companyCode = row.CompanyCode || '1710'; // Default company code
```

#### **RULE-001 Fallback (Line ~105):**
```javascript
// BEFORE
row.CompanyCode = companyCode || '1000';

// AFTER
row.CompanyCode = companyCode || '1710';
```

#### **RULE-004 (Line ~242):**
```javascript
// BEFORE
const companyCode = row.CompanyCode || '1000';

// AFTER
const companyCode = row.CompanyCode || '1710';
```

---

## Impact:

### **RULE-001: Accounting Document Lookup**
**When SAP unavailable (fallback mode):**
- Previous: CompanyCode = "1000"
- Now: CompanyCode = "1710"

**When SAP available:**
- Uses CompanyCode from SAP response (no change)

### **RULE-002: Partner Bank Lookup**
**When CompanyCode not provided:**
- Previous: Default = "1000"
- Now: Default = "1710"

### **RULE-004: Open Items Validation**
**When CompanyCode not in file:**
- Previous: Default = "1000"
- Now: Default = "1710"

---

## Test Results:

### **Before Change:**
```json
{
  "InvoiceNumber": "90000334",
  "CompanyCode": "1000",  // ← Old default
  "_rule001_status": "FALLBACK"
}
```

### **After Change:**
```json
{
  "InvoiceNumber": "90000334",
  "CompanyCode": "1710",  // ← New default
  "_rule001_status": "FALLBACK"
}
```

---

## When Default is Used:

### **Scenario 1: SAP Connection Fails**
```
Upload file → RULE-001 executes → SAP timeout
→ Fallback mode → CompanyCode = 1710 (default)
```

### **Scenario 2: CompanyCode Not in File**
```
File has columns: InvoiceNumber, Amount
Missing: CompanyCode column
→ RULE-002/RULE-004 → Uses CompanyCode = 1710 (default)
```

### **Scenario 3: CompanyCode is Empty**
```
File has: InvoiceNumber = "90000334", CompanyCode = ""
→ RULE-001 → Uses CompanyCode = 1710 (default)
```

---

## When Default is NOT Used:

### **Scenario 1: SAP Returns Data**
```
RULE-001 → SAP API success
→ CompanyCode = value from SAP (e.g., "1000", "2000", "1710")
→ Default not used
```

### **Scenario 2: File Has CompanyCode**
```
File has: InvoiceNumber = "90000334", CompanyCode = "2000"
→ RULE-001 → Uses CompanyCode = "2000" from file
→ Default not used
```

---

## Verification:

### **Check Code:**
```bash
grep -n "'1710'" /app/backend/srv/handlers/rule-engine.js
# Should show 3 occurrences (lines ~77, ~105, ~242)

grep -n "'1000'" /app/backend/srv/handlers/rule-engine.js
# Should show 0 occurrences for company code defaults
```

### **Test in BTP:**
1. Upload CSV without CompanyCode column
2. SAP connection fails (or simulate failure)
3. Check result → CompanyCode should be "1710"

---

## Documentation Updated:

✅ `/app/RULE001_TEST_GUIDE.md` - Updated expected results  
✅ `/app/DEFAULT_COMPANY_CODE_1710.md` - This file  

---

## Deployment:

**Changes applied in:**
- Kubernetes: ✅ Backend restarted
- BTP: ⚠️ Requires deployment (`cf push`)

**To deploy to BTP:**
```bash
cd /app
cf push
```

---

**Status:** ✅ Default company code changed to 1710 for all rules (RULE-001, RULE-002, RULE-004).
