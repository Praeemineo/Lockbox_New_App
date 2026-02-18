# Complete Data-Driven Flow: ALL Patterns with Conditions & Actions

## ✅ CONFIRMED: Every File Goes Through Pattern Detection → Conditions → Actions

### 🎯 Universal Processing Flow

**EVERY uploaded file** follows this flow:

```
┌─────────────────────────────────────────────────────────────┐
│                    FILE UPLOAD (ANY FILE)                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 1: PARSE FILE                                          │
│ • Supports: XLSX, XLS, CSV, JSON, XML, TXT, BAI2            │
│ • Extract headers and data rows                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 2: PATTERN DETECTION (Dynamic)                         │
│ • Load ALL 6 active patterns                                 │
│ • Check each pattern's CONDITIONS                            │
│ • Score patterns (0-1000 points)                            │
│ • Select BEST MATCH (highest score)                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 3: APPLY PATTERN ACTIONS                               │
│ • Load matched pattern's ACTIONS array                       │
│ • Execute each action based on actionType                    │
│ • Apply splitLogic, transformations, mappings                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 4: VALIDATION & RULE EXECUTION                         │
│ • Execute processing rules (RULE-001 to RULE-005)           │
│ • Enrich data with SAP API calls                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 5+: MAPPING, SIMULATION, SAP POST                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 All 6 Patterns with Conditions & Actions

### **Pattern 1: PAT-0001 - Single Check, Multiple Invoice**

**Conditions (4)**:
1. Check → "One check" → Strategy: One batch item per check
2. Check Amount → "Amount per Check" → Strategy: Per check item
3. Invoice/Document number → "Per Check" → Strategy: Invoice/Doc number per Check
4. Invoice/Document Amount → "Amount per Invoice/Document"

**Actions (4)**:
1. `Map_Check_Field` → Cheque → Single check - use as batch identifier
2. `Map_Check_Amount` → AmountInTransactionCurrency → Total amount for check
3. `Map_Invoice_Number` → PaymentReference → One invoice per row, grouped under single check
4. `Map_Invoice_Amount` → NetPaymentAmountInPayCurrency → Individual invoice amount per row

**When Detected**: File has one unique check number with multiple invoice rows

**Example**:
```
Input:
  Check: 12345, Invoice: INV-001, Amount: 100
  Check: 12345, Invoice: INV-002, Amount: 200

Output:
  1 Check (12345) with 2 invoices
  Batch item: Check=12345, TotalAmount=300
  Items: [INV-001: 100, INV-002: 200]
```

---

### **Pattern 2: PAT-0002 - Multiple Check, Multiple Invoice**

**Conditions (4)**:
1. Multiple Check → ">1" → Strategy: Multiple Batch item based on Check
2. Check Amount → ">1" → Strategy: Check amount per batch item
3. Invoice/Document number → "Per Check" → Strategy: Invoice/Doc number per Check
4. Invoice/Document Amount → "Amount per Invoice/Document"

**Actions (4)**:
1. `Map_Multiple_Checks` → Cheque → Multiple checks - create separate batch item for each check
2. `Map_Check_Amount_Per_Item` → AmountInTransactionCurrency → Check amount per batch item
3. `Map_Invoice_Per_Check` → PaymentReference → Invoice numbers grouped per check
4. `Map_Invoice_Amount` → NetPaymentAmountInPayCurrency → Individual invoice amount

**When Detected**: File has multiple unique check numbers, each with invoices

**Example**:
```
Input:
  Check: 12345, Invoice: INV-001, Amount: 100
  Check: 67890, Invoice: INV-002, Amount: 200

Output:
  2 Checks, 2 separate batch items
  Batch 1: Check=12345, Amount=100, Invoice=INV-001
  Batch 2: Check=67890, Amount=200, Invoice=INV-002
```

---

### **Pattern 3: PAT-0003 - File Containing Comma (Delimiter)**

**Conditions (4)**:
1. Check → "With Comma Separator" → Strategy: Check Split based on Comma
2. Check Amount → "With Comma Separator" → Strategy: Check Amount split per check
3. Invoice/Document number → "With Comma Separator" → Strategy: Invoice/Doc number split with complete 10 Digit
4. Invoice/Document Amount → "With Comma Separator" → Strategy: Invoice/Document Amount Split

**Actions (4)**:
1. `Split_Check_Line_Item` → Line1-90001, Line2-90002, Line3-90003 → Comma delimiter
2. `Split_Amount_Line_Item` → Line1-5000, Line2-8000, Line3-10000 → Equal split or proportional
3. `Split_Invoice/Document_Number` → Line1-90000393, Line2-90000394, Line3-90000395 → Comma delimiter, **pad to 10 digits**
4. `Split_Invoice/Document_Amount` → Line1-5000, Line2-8000, Line3-10000 → Equal split across invoices

**When Detected**: File has comma-delimited values in invoice fields

**Example**:
```
Input:
  Check: 12345, Invoice: "90003904, 0334", Amount: 18.43

Output (2 records):
  Record 1: Check=12345, Invoice="0090003904", Amount=9.215
  Record 2: Check=12345, Invoice="0000000334", Amount=9.215
```

---

### **Pattern 4: PAT-0004 - File Containing Hyphen Range**

**Conditions (5)**:
1. Check → "Hyphen Range" → Strategy: Check Split based on Range
2. Check Amount → "Hyphen Range" → Strategy: Check Amount split per check
3. Invoice/Document number → "Hyphen Range" → Strategy: Invoice/Doc number split base on Range
4. Invoice/Document Amount → "Hyphen Range" → Strategy: Invoice/Document Amount Split
5. API Standard

**Actions (4)**:
1. `Split_Check_Range` → Cheque → Hyphen range split (e.g., 90001-90003)
2. `Split_Amount_By_Range` → AmountInTransactionCurrency → Equal split across range
3. `Split_Invoice_Range` → PaymentReference → Expand range to individual invoices, **pad to 10 digits**
4. `Split_Invoice_Amount_Range` → NetPaymentAmountInPayCurrency → Equal split across invoice range

**When Detected**: File has hyphen-delimited range values (e.g., "90001-90003")

**Example**:
```
Input:
  Check: 12345, Invoice: "90000393-90000395", Amount: 15000

Output (3 records):
  Record 1: Invoice="0090000393", Amount=5000
  Record 2: Invoice="0090000394", Amount=5000
  Record 3: Invoice="0090000395", Amount=5000
```

---

### **Pattern 5: PAT-0005 - Date Pattern**

**Conditions (6)**:
1. MMDDYYYY → "Comma, Dot, Hyphen, Slash" → Strategy: YYYY-MM-DD
2. DDMMYYYY → "Comma, Dot, Hyphen, Slash" → Strategy: YYYY-MM-DD
3. YYYYMMDD → "Comma, Dot, Hyphen, Slash" → Strategy: YYYY-MM-DD
4. MMDDYY → "Comma, Dot, Hyphen, Slash" → Strategy: YYYY-MM-DD
5. DDMMYY → "Comma, Dot, Hyphen, Slash" → Strategy: YYYY-MM-DD
6. YYMMDD → "Comma, Dot, Hyphen, Slash" → Strategy: YYYY-MM-DD

**Actions (2)**:
1. `Transform_Date_Format` → DepositDateTime → Convert any date format to YYYY-MM-DD ISO format
2. `Map_Standard_Fields` → StandardFields → Standard field mapping with date transformation

**When Detected**: File has various date formats that need standardization

**Example**:
```
Input:
  Date: "02/05/2026" (MMDDYYYY)
  Date: "05-02-2026" (DDMMYYYY)
  Date: "2026.02.05" (YYYYMMDD)

Output:
  All dates → "2026-02-05" (ISO format)
```

---

### **Pattern 6: PAT-0006 - File Containing Multiple Sheets**

**Conditions (2)**:
1. Header, Item data split Check Data → "Multiple Sheet" → Strategy: Build Heirarchy of 50 Items per Batch
2. Invoice/Document data → "Multiple Sheet" → Strategy: Build Heirarchy of 50 Items per Batch

**Actions (2)**:
1. `Process_Multiple_Sheets` → WorksheetName → Extract and process each sheet individually, create hierarchy
2. `Build_Batch_Hierarchy` → BatchStructure → Build hierarchy of 50 items per batch from multiple sheets

**When Detected**: Excel file has multiple worksheets with different data types

**Example**:
```
Input:
  Sheet1: Check Data (100 rows)
  Sheet2: Invoice Data (150 rows)

Output:
  Process each sheet separately
  Create hierarchy: 2 batches (50 items each) from Sheet1, 3 batches from Sheet2
```

---

## 🔄 Pattern Scoring System

**Every pattern is scored based on**:
1. **Condition Matches**: +150 points per condition matched
2. **Delimiter Detection**: +300 points if delimiter found in data
3. **File Type Match**: Must match EXCEL, CSV, etc.
4. **Legacy Pattern Match**: +50-200 points for backward compatibility

**Example Scoring**:
```
File uploaded: customer_payments.xlsx with "90003904, 0334"

PAT-0001 Score: 75 (2/4 conditions matched)
PAT-0002 Score: 50 (1/4 conditions matched)
PAT-0003 Score: 750 (4/4 conditions + 300 delimiter bonus) ✓ WINNER
PAT-0004 Score: 0 (no hyphen range detected)
PAT-0005 Score: 100 (date pattern detected)
PAT-0006 Score: 0 (single sheet)

→ PAT-0003 selected
```

---

## ✅ Verification: All Patterns Ready

```json
{
  "PAT-0001": { "conditions": 4, "actions": 4, "status": "✓ Ready" },
  "PAT-0002": { "conditions": 4, "actions": 4, "status": "✓ Ready" },
  "PAT-0003": { "conditions": 4, "actions": 4, "status": "✓ Ready" },
  "PAT-0004": { "conditions": 5, "actions": 4, "status": "✓ Ready" },
  "PAT-0005": { "conditions": 6, "actions": 2, "status": "✓ Ready" },
  "PAT-0006": { "conditions": 2, "actions": 2, "status": "✓ Ready" }
}
```

**Total**: 6 patterns, 25 conditions, 20 actions

---

## 🎯 Key Benefits

### **1. Complete Data-Driven System**
- ✅ No hardcoded logic for ANY pattern
- ✅ All processing defined in JSON configuration
- ✅ Easy to add new patterns without code changes

### **2. Universal Processing Flow**
- ✅ EVERY file goes through pattern detection
- ✅ EVERY pattern has conditions checked
- ✅ EVERY pattern has actions applied

### **3. Flexible & Scalable**
- ✅ Add unlimited patterns
- ✅ Modify conditions without code
- ✅ Update actions without deployment

### **4. Transparent & Debuggable**
- ✅ Detailed logs show pattern scoring
- ✅ Logs show which conditions matched
- ✅ Logs show which actions executed

---

## 🎊 Summary

✅ **All 6 Patterns** have conditions and actions defined  
✅ **Every uploaded file** goes through pattern detection  
✅ **Conditions checked** for all patterns  
✅ **Actions applied** based on matched pattern  
✅ **100% data-driven** - no hardcoded processing logic  

**The system is now a complete, universal, data-driven file processing engine!** 🚀
