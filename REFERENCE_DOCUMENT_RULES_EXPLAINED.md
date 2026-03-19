# Reference Document Rules Explanation

## 🔍 What Are Reference Document Rules?

**Reference Document Rules** are a separate configuration system in the application (different from RULE-001 to RULE-004 that we've been working on). They determine **how to map payment references** when posting to SAP Lockbox.

---

## 📊 The Two Rule Systems (Don't Confuse Them!):

### **System 1: Processing Rules (RULE-001 to RULE-004)** - What we've been fixing
- **RULE-001**: Accounting Document Lookup (enriches data during validation)
- **RULE-002**: Partner Bank Details (enriches data during validation)
- **RULE-003**: SAP Production Run (posting to SAP)
- **RULE-004**: Get Accounting Document (view details after posting)

### **System 2: Reference Document Rules** - What you're seeing in the logs
- These are **NOT** the same as RULE-001 to RULE-004 above!
- They have confusingly similar names but serve a different purpose
- Located in `/app/backend/server.js` (lines 3964-4021)

---

## 🎯 Reference Document Rules Explained:

These rules determine which field to use for SAP Lockbox matching:

### **Rule 1: "Document Number (BELNR)"**
```
Logic: lbinvref = belnr
Use: Accounting Document number (SAP internal)
Example: 5100000123
```

### **Rule 2: "Reference Document Number (XBLNR)"** ⭐ DEFAULT
```
Logic: lbinvref = XBLNR
Use: Invoice Reference number (External/Customer)
Example: 90003904
```

### **Rule 3: "Doc Number First - If Not Found Reference Doc"**
```
Logic: lbinvref = belnr else XBLNR
Try: BELNR first → if empty, use XBLNR → if both empty, use Invoice Number
```

### **Rule 4: "Ref Document First - If Not Found Doc Number"** ← YOU ARE USING THIS
```
Logic: lbinvref = XBLNR else belnr
Try: XBLNR first → if empty, use BELNR → if both empty, use Invoice Number
```

---

## 📍 Your Current Configuration:

Based on the logs you shared:
```
Reference Document Rule: Ref Document First - If Not Found Doc Number (XBLNR_THEN_BELNR)
Rule Logic: lbinvref = XBLNR else belnr
Rule evaluation: InvoiceNumber=90003904, XBLNR=, BELNR=, EnrichedPaymentRef=, CompanyCode=1710
Using XBLNR_THEN_BELNR rule: Fallback to InvoiceNumber 90003904
```

**What's happening**:
1. ✅ Active Rule: **Rule 4 (XBLNR_THEN_BELNR)**
2. ❌ XBLNR field in file: **Empty**
3. ❌ BELNR field in file: **Empty**
4. ❌ Enriched PaymentReference (from RULE-001): **Empty** (not working yet)
5. ✅ Fallback: Using **Invoice Number** = 90003904

---

## 🔄 How It Works During Posting:

**Priority Order**:
```
1. PRIORITY 1: Use enriched PaymentReference from RULE-001
   ↓ (if empty)
2. PRIORITY 2: Apply Reference Document Rule
   ↓
3. Determine final PaymentReference value
```

**In your case** (with Rule 4 - XBLNR_THEN_BELNR):
```
Step 1: Check enriched PaymentReference from RULE-001
        → Empty (because RULE-001 API enrichment not working yet)

Step 2: Apply XBLNR_THEN_BELNR rule
        → Check XBLNR column: Empty
        → Check BELNR column: Empty
        → Fallback to Invoice Number: 90003904

Step 3: Use 90003904 for SAP Lockbox posting
```

---

## 🎯 The Relationship with RULE-001:

**When RULE-001 is working properly**, it will:
1. Read **Invoice Number** from Excel (e.g., 90003904)
2. Call SAP API `/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='90003904')/Set`
3. Extract **Belnr** (Accounting Document Number) from response (e.g., 5100000123)
4. Store it as **paymentreference** field in the row

**Then, during posting**:
```
Step 1: Check enriched PaymentReference
        → Found: 5100000123 (from RULE-001)
        ✅ Use this value (skip Reference Document Rule)

Step 2: Reference Document Rule is SKIPPED
        (because enriched PaymentReference exists)

Step 3: Use 5100000123 for SAP Lockbox posting
```

---

## 📋 Where to Configure Reference Document Rules:

### **In Code** (`/app/backend/server.js`):
```javascript
// Line 4024
let selectedReferenceDocRule = 'RULE-002'; // Default to XBLNR
```

### **Change the Active Rule**:
You can change which rule is active by updating the `selectedReferenceDocRule` variable:
- `'RULE-001'` → Use BELNR only
- `'RULE-002'` → Use XBLNR only (Default)
- `'RULE-003'` → Try BELNR first, then XBLNR
- `'RULE-004'` → Try XBLNR first, then BELNR (Currently active)

### **Via API** (if available):
There might be a UI or API endpoint to select the active rule. Check the application's admin settings.

---

## 🚨 Current Issue Analysis:

From your log:
```
EnrichedPaymentRef=,
```

This shows **RULE-001 (Processing Rule) is NOT enriching the data**.

**Why?**
- RULE-001 API call might be failing
- Field extraction might not be working
- SAP response structure might be different than expected

**Solution**:
1. ✅ Deploy the enhanced logging we just added
2. ✅ Upload a test file with invoice number
3. ✅ Check BTP logs to see:
   - Is RULE-001 API being called?
   - Is SAP returning data?
   - Are fields being extracted correctly?

---

## 📝 Summary:

| Concept | What It Is | Location |
|---------|-----------|----------|
| **Processing Rules** (RULE-001 to RULE-004) | Data enrichment & posting rules | `/app/backend/data/processing_rules.json` (PostgreSQL) |
| **Reference Document Rules** | Payment reference mapping rules | `/app/backend/server.js` (lines 3964-4021) |
| **Current Issue** | RULE-001 not enriching `paymentreference` | Need to check validation logs |
| **Current Fallback** | Using Invoice Number (90003904) | Because enrichment failed |

---

## 🎯 What You Should Do:

1. **Deploy** the updated rule-engine.js with enhanced logging
2. **Upload** a test file
3. **Check** if RULE-001 enriches the `paymentreference` field
4. **Share** the logs showing:
   - RULE-001 execution
   - SAP API response
   - Field extraction results

Once RULE-001 works, the enriched `paymentreference` will be used automatically, and the Reference Document Rule will be skipped!

---

## 📄 Code Location:

- **Reference Document Rules Definition**: `/app/backend/server.js` (lines 3964-4021)
- **Reference Document Rule Application**: `/app/backend/server.js` (lines 7016-7078)
- **Processing Rules (RULE-001, etc.)**: `/app/backend/srv/handlers/rule-engine.js`

The logs you're seeing are from the **posting process**, not the validation process. That's why you see the Reference Document Rule being applied.
