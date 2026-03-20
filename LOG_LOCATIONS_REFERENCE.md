# 📋 Complete Log Locations Reference - RULE-001, RULE-002, RULE-004

## Summary

This document shows exactly where logs were added for each rule during this debugging session.

---

## 1️⃣ RULE-001 Logs (Invoice Number → Accounting Document)

### File: `/app/backend/srv/handlers/rule-engine.js`

### Log Locations:

#### **Line 398-399: Field Creation Debug**
```javascript
console.log(`      🔍 Will create/update field: "${fieldToUpdate}" (exact SAP API field name)`);
console.log(`      🔍 Available keys before: ${Object.keys(row).join(', ')}`);
```

**Purpose:** Shows which field will be created/updated and what fields already exist in the row.

**Example Output:**
```
🔍 Will create/update field: "PaymentReference" (exact SAP API field name)
🔍 Available keys before: Invoice Number, InvoiceAmount, Cheque, ...
```

---

#### **Line 404-406: Enrichment Success**
```javascript
console.log(`   ✅ Enriched Field: ${fieldToUpdate} = "${apiValue}"`);
console.log(`      ↳ Extracted from SAP field: ${targetFieldName}`);
console.log(`      ↳ Input value: ${sourceValue}`);
```

**Purpose:** Confirms successful enrichment and shows the complete data flow.

**Example Output:**
```
✅ Enriched Field: PaymentReference = "9400000440"
   ↳ Extracted from SAP field: AccountingDocument
   ↳ Input value: 90003904
```

---

#### **Additional RULE-001 Logs (Already Existing):**

- **Line 56:** `console.log('🔍 LOCKBOX DYNAMIC VALIDATION - RULE-001 & RULE-002');`
- **Line 43-45:** Logs active rules at startup
- Throughout execution: SAP API calls, response data, condition evaluation

### How to View RULE-001 Logs:

```bash
# Watch all RULE-001 activity
tail -f /var/log/supervisor/backend.out.log | grep -i "RULE-001\|Enriched Field\|PaymentReference"

# See field creation details
tail -f /var/log/supervisor/backend.out.log | grep "Will create/update field"

# See enrichment results
tail -f /var/log/supervisor/backend.out.log | grep "✅ Enriched Field"
```

---

## 2️⃣ RULE-002 Logs (Customer Number → Business Partner)

### File: `/app/backend/srv/handlers/rule-engine.js`

### Log Locations:

**Same as RULE-001** - Both rules use the shared rule-engine logic, so the same log statements apply.

#### **Line 398-406: Same enrichment logs as RULE-001**

**Purpose:** Shows enrichment for fields like:
- `PartnerBank`
- `PartnerBankAccount`
- `PartnerBankCountry`

**Example Output:**
```
✅ Enriched Field: PartnerBank = "CITIUS33"
   ↳ Extracted from SAP field: BankID
   ↳ Input value: CUST-12345
```

### How to View RULE-002 Logs:

```bash
# Watch all RULE-002 activity
tail -f /var/log/supervisor/backend.out.log | grep -i "RULE-002\|PartnerBank"

# See enrichment results
tail -f /var/log/supervisor/backend.out.log | grep "✅ Enriched Field.*Partner"
```

---

## 3️⃣ RULE-004 Logs (Accounting Document Details Lookup)

### File: `/app/backend/services/runService.js`

### Log Locations:

#### **Line 178-183: Document Field Mapping Debug**

```javascript
console.log(`   📄 Document ${index + 1} field mapping:`);
console.log(`      SubledgerDocument: "${doc.SubledgerDocument || ''}"`);
console.log(`      SubledgerOnaccountDocument: "${doc.SubledgerOnaccountDocument || ''}"`);
console.log(`      DocumentNumber: "${doc.DocumentNumber || ''}"`);
console.log(`      PaymentAdvice: "${doc.PaymentAdvice || ''}"`);
```

**Purpose:** Shows what values RULE-004 received from SAP for each document.

**Example Output:**
```
📄 Document 1 field mapping:
   SubledgerDocument: "5000000123"
   SubledgerOnaccountDocument: "5000000124"
   DocumentNumber: "9400000440"
   PaymentAdvice: "PAYT-001"
```

**If fields are empty:**
```
📄 Document 1 field mapping:
   SubledgerDocument: ""
   SubledgerOnaccountDocument: ""
   DocumentNumber: "9400000440"
   PaymentAdvice: "PAYT-001"
```

---

#### **Additional RULE-004 Logs (Already Existing):**

Throughout the `runService.js` file, there are extensive logs showing:
- SAP API call execution
- Response parsing
- Document count
- Pass-through architecture

### How to View RULE-004 Logs:

```bash
# Watch all RULE-004 activity
tail -f /var/log/supervisor/backend.out.log | grep -i "RULE-004\|Accounting Document"

# See document field mapping (NEW)
tail -f /var/log/supervisor/backend.out.log | grep -A 5 "Document.*field mapping"

# See SubledgerDocument values specifically
tail -f /var/log/supervisor/backend.out.log | grep "SubledgerDocument\|SubledgerOnaccount"
```

---

## 📊 Complete Log Flow Summary

### File Upload with RULE-001 & RULE-002:

```
1. 🔍 LOCKBOX DYNAMIC VALIDATION - RULE-001 & RULE-002
2. ⚙️  Executing RULE-001: Invoice Number to Accounting Document
3. 📝 Processing row 1: Invoice Number = "90003904"
4. 🔍 Will create/update field: "PaymentReference"
5. 📞 Calling SAP API: .../AccountingDocument...
6. ✅ Enriched Field: PaymentReference = "9400000440"
7. ⚙️  Executing RULE-002: Customer Number to Business Partner
8. 🔍 Will create/update field: "PartnerBank"
9. ✅ Enriched Field: PartnerBank = "CITIUS33"
```

### Production Run Navigation with RULE-004:

```
1. 📡 RULE-004: Fetching accounting documents for lockbox...
2. 📞 Calling SAP API: .../LockboxAccountingDocuments...
3. 📄 Document 1 field mapping:
      SubledgerDocument: "5000000123"
      SubledgerOnaccountDocument: "5000000124"
      DocumentNumber: "9400000440"
4. ✅ Returning 3 documents to UI
```

---

## 🔍 Quick Debug Commands

### Check if RULE-001 is working:
```bash
tail -n 500 /var/log/supervisor/backend.out.log | grep -A 3 "Enriched Field: PaymentReference"
```

### Check if RULE-002 is working:
```bash
tail -n 500 /var/log/supervisor/backend.out.log | grep -A 3 "Enriched Field: PartnerBank"
```

### Check if RULE-004 is returning Subledger fields:
```bash
tail -n 200 /var/log/supervisor/backend.out.log | grep -A 10 "Document.*field mapping"
```

### Check all rules at once:
```bash
tail -f /var/log/supervisor/backend.out.log | grep -E "RULE-001|RULE-002|RULE-004|Enriched Field|field mapping"
```

---

## 📂 Files Modified for Logging

| Rule | File | Lines Modified | Purpose |
|------|------|----------------|---------|
| **RULE-001** | `/app/backend/srv/handlers/rule-engine.js` | 398-406 | Field creation & enrichment debug |
| **RULE-002** | `/app/backend/srv/handlers/rule-engine.js` | 398-406 | Field creation & enrichment debug (shared) |
| **RULE-004** | `/app/backend/services/runService.js` | 178-183 | Document field mapping debug |

---

## 🎯 Why These Logs Were Added

### RULE-001 Issue:
- **Problem:** PaymentReference was showing invoice number instead of AccountingDocument
- **Logs Added:** Show exact field being created and value being set
- **Result:** Can trace the complete enrichment flow

### RULE-002:
- **Status:** Uses same rule-engine as RULE-001, benefits from same logging
- **Logs:** Show partner bank enrichment if active

### RULE-004 Issue:
- **Problem:** SubledgerDocument and SubledgerOnaccount showing blank in UI
- **Logs Added:** Show what values SAP actually returns for these fields
- **Result:** Can verify if SAP is returning empty values or if it's a mapping issue

---

## 📝 Log Output Examples

### Successful RULE-001 Enrichment:
```
⚙️  Executing RULE-001: Accounting Document Lookup
📝 Processing row 1: Invoice Number = "90003904"
🔍 Will create/update field: "PaymentReference" (exact SAP API field name)
🔍 Available keys before: Invoice Number, InvoiceAmount, Currency, ...
📞 Calling SAP API: /sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='0090003904')/Set
📥 Full SAP Response: { "AccountingDocument": "9400000440", "CompanyCode": "1710", ... }
✅ Enriched Field: PaymentReference = "9400000440"
   ↳ Extracted from SAP field: AccountingDocument
   ↳ Input value: 90003904
```

### RULE-004 Document Mapping:
```
📡 RULE-004: Fetching accounting documents for Lockbox-RUN-2026-00199
📞 Calling SAP API: .../ZSD_LOCKBOX_ACC_DOCUMENT_CDS...
📥 SAP Response received: 3 documents
📄 Document 1 field mapping:
   SubledgerDocument: "5000000123"
   SubledgerOnaccountDocument: "5000000124"
   DocumentNumber: "9400000440"
   PaymentAdvice: "PAYT-001"
✅ Returning 3 documents to UI (pass-through architecture)
```

---

**This document provides a complete reference for finding and understanding all rule-related logs in the application.**
