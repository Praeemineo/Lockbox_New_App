# FIX: PAT-003 Action-Based Split Logic

## 🎯 Issue Summary
Pattern detection and split logic should follow the **conditions** and **actions** defined in the File Pattern configuration, not hardcoded logic.

---

## 📋 Pattern Configuration Analysis

### **PAT-003: File Containing Comma**

**From UI Configuration Images:**

#### **Conditions Tab:**
1. **Check** → `Field contains ","` - 90001, 2, 3
2. **Check Amount** → `Per Check` - 5000, 8000, 10000
3. **Invoice/Document number** → `Field contains ","` - 90000393, 394, 395
4. **Invoice/Document Amount** → `Per Invoice/Document number` - 5000, 8000, 10000

#### **Actions & Field Mappings Tab:**
1. **Split_Check_Line_Item** → `Line1-90001, Line2-90002, Line3-90003`
2. **Split_Amount_Line_Item** → `Line1-5000, Line2-8000, Line3-10000`
3. **Split_Invoice/Document_Number** → `Line1-90000393, Line2-90000394, Line3-90000395`
4. **Split_Invoice/Document_Amount** → `Line1-5000, Line2-8000, Line3-10000`

---

## 🔧 Fixes Applied

### **Fix 1: Added Actions to PAT-003 Pattern**

**File**: `/app/backend/data/file_patterns.json`

**Added**:
```json
{
  "patternId": "PAT0003",
  "actions": [
    {
      "actionType": "Split_Check_Line_Item",
      "relatedApiField": "Line1-90001, Line2-90002, Line3-90003",
      "splitLogic": "Comma delimiter"
    },
    {
      "actionType": "Split_Amount_Line_Item",
      "relatedApiField": "Line1-5000, Line2-8000, Line3-10000",
      "splitLogic": "Equal split or proportional based on invoice count"
    },
    {
      "actionType": "Split_Invoice/Document_Number",
      "relatedApiField": "Line1-90000393, Line2-90000394, Line3-90000395",
      "splitLogic": "Comma delimiter, pad to 10 digits"
    },
    {
      "actionType": "Split_Invoice/Document_Amount",
      "relatedApiField": "Line1-5000, Line2-8000, Line3-10000",
      "splitLogic": "Equal split across invoices"
    }
  ]
}
```

**Result**: Pattern now has actions that define HOW to split data.

---

### **Fix 2: Updated Split Logic to Use Pattern Actions**

**File**: `/app/backend/server.js` (line ~7033)

**Key Changes:**

1. **Read Actions from Pattern**:
```javascript
// Find the action for Invoice/Document Number split
const invoiceSplitAction = matchedPattern.actions?.find(a => 
    a.actionType === 'Split_Invoice/Document_Number' ||
    a.actionType.toLowerCase().includes('invoice')
);
```

2. **Check for 10-Digit Padding Requirement**:
```javascript
// Determine padding from pattern strategy or action splitLogic
const padTo10Digits = matchedPattern.conditions?.some(c => 
    c.strategy?.includes('10 Digit') || c.strategy?.includes('10Digit')
) || invoiceSplitAction?.splitLogic?.includes('10 digits');
```

3. **Apply Padding When Splitting**:
```javascript
let invoiceNumber = invoices[i].trim();
if (padTo10Digits) {
    // Pad to 10 digits with leading zeros
    invoiceNumber = invoiceNumber.padStart(10, '0');
    console.log(`  Padded invoice: ${invoices[i]} → ${invoiceNumber}`);
}
```

4. **Determine Amount Split Mode from Action**:
```javascript
const amountSplitAction = matchedPattern.actions?.find(a => 
    a.actionType === 'Split_Invoice/Document_Amount' ||
    a.actionType === 'Split_Amount_Line_Item'
);

const splitMode = amountSplitAction?.splitLogic?.includes('proportional') 
    ? 'PROPORTIONAL' 
    : 'EQUAL';
```

5. **Include Action Details in Split Metadata**:
```javascript
{
    ...row,
    InvoiceNumber: invoiceNumber,
    PaymentReference: invoiceNumber,
    InvoiceAmount: splitAmounts[i],
    _splitFrom: invoiceField,
    _splitRule: matchedPattern.patternName,
    _splitAction: invoiceSplitAction?.actionType || 'INVOICE_SPLIT',
    _splitIndex: i + 1,
    _splitTotal: invoices.length
}
```

---

## 📊 Expected Behavior with Test File

### **Input File**: "Customer Payments upload 10.xlsx"

**Data**:
```
Customer Check Number | Check Amount | Invoice Number     | Invoice Amount | ...
1365                 | 18.43        | 90003904, 0334     | ...           | ...
```

---

### **Stage 1: Pattern Detection**

```
=== PATTERN DETECTION ===
Checking PAT-003 conditions:
  ✓ Delimiter found: ","
  ✓ Invoice field has delimiter: "90003904, 0334"
  ✓✓ DELIMITER MATCH: Comma-delimited invoices detected (+300 points)

Pattern Scores:
  PAT-001: 100
  PAT-003: 650 ✓ SELECTED

✓ MATCHED PATTERN: PAT0003 "File Containing Comma"
```

---

### **Stage 2: Invoice Split with Actions**

```
=== Applying INVOICE SPLIT rules ===
Pattern: File Containing Comma
Pattern actions: [4 actions loaded]

Invoice split action: {
  actionType: "Split_Invoice/Document_Number",
  relatedApiField: "Line1-90000393, Line2-90000394, Line3-90000395",
  splitLogic: "Comma delimiter, pad to 10 digits"
}

Amount split action: {
  actionType: "Split_Invoice/Document_Amount",
  relatedApiField: "Line1-5000, Line2-8000, Line3-10000",
  splitLogic: "Equal split across invoices"
}

Pad to 10 digits: TRUE (from condition strategy)

Splitting "90003904, 0334":
  Invoice 1: "90003904" → Padded: "0090003904"
  Invoice 2: "0334" → Padded: "0000000334"

Amount split: 18.43 / 2 = 9.215 per invoice (EQUAL split mode)

✓ Invoice split applied: 1 row → 2 rows
```

---

### **Stage 3: Final Output**

```
Record 1:
  CustomerCheckNumber: 1365
  CheckAmount: 18.43
  InvoiceNumber: "0090003904" (padded to 10 digits)
  InvoiceAmount: 9.215
  _splitFrom: "90003904, 0334"
  _splitRule: "File Containing Comma"
  _splitAction: "Split_Invoice/Document_Number"
  _splitIndex: 1
  _splitTotal: 2

Record 2:
  CustomerCheckNumber: 1365
  CheckAmount: 18.43
  InvoiceNumber: "0000000334" (padded to 10 digits)
  InvoiceAmount: 9.215
  _splitFrom: "90003904, 0334"
  _splitRule: "File Containing Comma"
  _splitAction: "Split_Invoice/Document_Number"
  _splitIndex: 2
  _splitTotal: 2
```

---

## 🔍 Key Improvements

### **1. Data-Driven Split Logic**
- ✅ Split behavior now comes from pattern **actions**, not hardcoded logic
- ✅ Different patterns can have different split strategies
- ✅ Easy to modify split logic without code changes

### **2. Action-Specific Processing**
- ✅ Each action type (`Split_Invoice/Document_Number`, `Split_Amount_Line_Item`, etc.) has specific logic
- ✅ Split logic field defines HOW to split (equal, proportional, padded, etc.)
- ✅ Related API fields show WHERE split data goes

### **3. 10-Digit Padding**
- ✅ Automatically detects padding requirement from condition **strategy**
- ✅ Applies padding: "334" → "0000000334"
- ✅ Configurable via pattern definition

### **4. Comprehensive Logging**
- ✅ Logs pattern actions loaded
- ✅ Logs which action is being applied
- ✅ Logs padding operations
- ✅ Logs split results with metadata

---

## 🧪 Testing

### **To Test:**

1. Upload "Customer Payments upload 10.xlsx" in Lockbox Transaction
2. Check backend logs:
```bash
tail -f /var/log/supervisor/backend.out.log | grep -A 50 "Applying INVOICE SPLIT"
```

3. Look for:
```
=== Applying INVOICE SPLIT rules ===
Pattern: File Containing Comma
Pattern actions: [4 actions loaded]
Invoice split action: {...}
Pad to 10 digits: TRUE
Padded invoice: 334 → 0000000334
Padded invoice: 90003904 → 0090003904
✓ Invoice split applied: 1 row → 2 rows
```

4. Verify output has:
   - 2 records (split from 1)
   - Invoice numbers padded to 10 digits
   - Amounts split equally (9.215 each if total is 18.43)

---

## ✅ Verification

**Files Modified**:
1. `/app/backend/data/file_patterns.json` - Added actions array to PAT-003
2. `/app/backend/server.js` - Updated split logic to use pattern actions

**Backend Status**:
- ✅ Restarted successfully
- ✅ PAT-003 loaded with 4 actions
- ✅ All patterns loaded (6 patterns)
- ✅ All rules loaded (5 rules)

**Pattern Actions Loaded**:
```
PAT-003 Actions: 4
  1. Split_Check_Line_Item
  2. Split_Amount_Line_Item
  3. Split_Invoice/Document_Number
  4. Split_Invoice/Document_Amount
```

---

## 📝 Summary

✅ **Actions Added to Pattern** - PAT-003 now has 4 actions defining split behavior  
✅ **Action-Based Split Logic** - Code now reads and applies pattern actions  
✅ **10-Digit Padding** - Invoice numbers padded as per condition strategy  
✅ **Equal Amount Split** - Amounts split equally across invoices  
✅ **Comprehensive Logging** - Detailed logs for debugging  

**The system now follows pattern actions exactly as configured in the File Pattern table!** 🚀
