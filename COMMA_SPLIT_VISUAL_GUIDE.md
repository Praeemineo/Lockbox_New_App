# Visual Guide: Comma-Delimited Splitting Logic

## 📊 How It Works

### Input Data (From Excel)
```
┌──────────┬──────────────┬──────────────┬───────────────────┬─────────────────────┐
│ Customer │ Check Number │ Check Amount │ Invoice Number    │ Invoice Amount      │
├──────────┼──────────────┼──────────────┼───────────────────┼─────────────────────┤
│ 17100009 │ 3456687      │ 2940         │ 90003904, 3905    │ 1365.00, 1575.00    │
└──────────┴──────────────┴──────────────┴───────────────────┴─────────────────────┘
```

---

## 🔄 Processing Flow

```
                    Excel Upload
                         │
                         ▼
              ┌──────────────────────┐
              │  Pattern Detection   │
              │  hasDelimitedInvoices│
              │  hasDelimitedAmounts │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Pattern Matching    │
              │  → PAT-003           │
              │  → INVOICE_SPLIT     │
              └──────────┬───────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │ splitInvoiceAndAmounts()      │
         │                               │
         │ 1. Split Invoices:            │
         │    "90003904, 3905"           │
         │    → ["90003904", "90003905"] │
         │                               │
         │ 2. Split Amounts:             │
         │    "1365.00, 1575.00"         │
         │    → [1365, 1575]             │
         │                               │
         │ 3. Pair Together:             │
         │    [                          │
         │      {inv: "90003904", amt: 1365},│
         │      {inv: "90003905", amt: 1575} │
         │    ]                          │
         └───────────────┬───────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Create 2 Rows       │
              └──────────┬───────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │ Row 1:                        │
         │   Customer: 17100009          │
         │   Check: 3456687              │
         │   Invoice: 90003904           │
         │   Amount: 1365                │
         └───────────────────────────────┘
                         +
         ┌───────────────────────────────┐
         │ Row 2:                        │
         │   Customer: 17100009          │
         │   Check: 3456687              │
         │   Invoice: 90003905           │
         │   Amount: 1575                │
         └───────────────┬───────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  SAP Payload Build   │
              └──────────┬───────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │ Clearing Entry 1:             │
         │   PaymentReference: 90003904  │
         │   Amount: 1365.00             │
         └───────────────────────────────┘
                         +
         ┌───────────────────────────────┐
         │ Clearing Entry 2:             │
         │   PaymentReference: 90003905  │
         │   Amount: 1575.00             │
         └───────────────┬───────────────┘
                         │
                         ▼
                   SAP Posting
```

---

## 🎯 Split Scenarios

### Scenario 1: Matching Invoice-Amount Pairs
```
Input:
  Invoices: "A, B, C"
  Amounts:  "100, 200, 300"

Logic: Count matches (3 invoices, 3 amounts)
Action: Pair invoice[i] with amount[i]

Output:
  A → 100
  B → 200
  C → 300
```

---

### Scenario 2: Single Amount, Multiple Invoices (Equal Split)
```
Input:
  Invoices: "A, B, C"
  Amounts:  "300"

Logic: 1 amount, 3 invoices → Divide equally
Action: amount / invoice_count

Output:
  A → 100 (300 ÷ 3)
  B → 100 (300 ÷ 3)
  C → 100 (300 ÷ 3)
```

---

### Scenario 3: More Amounts than Invoices
```
Input:
  Invoices: "A, B"
  Amounts:  "100, 200, 300"

Logic: Use first N amounts where N = invoice count
Action: Ignore extra amounts

Output:
  A → 100
  B → 200
  (300 ignored)
```

---

### Scenario 4: Common Prefix Expansion
```
Input:
  Invoices: "90003904, 3905, 3906"

Detection:
  - First part: "90003904" (length: 8)
  - Other parts: "3905", "3906" (length: 4)
  - All others shorter → Common prefix detected

Expansion:
  Prefix: "900039" (8 - 4 = 4 chars)
  
Output:
  "90003904"
  "900039" + "05" = "90003905"
  "900039" + "06" = "90003906"
```

---

## 🔍 Amount Delimiter Detection

### Decimal Separator vs Delimiter

```javascript
// Decimal separator (NOT a delimiter)
"1,365.00"  
  ↓
Cleaned: "1365" (remove periods)
Commas: 1
  ↓
Single amount: 1365

// Amount delimiter
"1365.00, 1575.00"
  ↓
Cleaned: "136500, 157500" (remove periods)
Commas: 1
  ↓
Split: [1365, 1575]
```

**Rule:** Comma is treated as delimiter only if it appears in the cleaned string (after removing decimal points).

---

## 📋 Extraction Metadata

Each split row includes metadata for tracking:

```javascript
{
  Customer: "17100009",
  CheckNumber: "3456687",
  CheckAmount: 2940,
  InvoiceNumber: "90003905",       // Split result
  InvoiceAmount: 1575,              // Paired amount
  _splitFrom: "90003904, 3905",     // Original combined value
  _splitRule: "PAT-003",            // Pattern that triggered split
  _splitType: "COMMA_DELIMITED",    // Split method
  _pattern: "INVOICE_SPLIT",        // Pattern type
  _rowIndex: 2                      // Original row number
}
```

---

## 🧪 Test Examples

### Example 1: User's File Data
```
INPUT:
  Invoice Number: "90003904, 3905"
  Invoice Amount: "1365.00, 1575.00"

PROCESSING:
  1. Split invoices: [90003904, 90003905]
  2. Split amounts: [1365, 1575]
  3. Pair: [(90003904,1365), (90003905,1575)]

OUTPUT:
  ✓ 90003904 → $1365.00
  ✓ 90003905 → $1575.00
```

### Example 2: Equal Distribution
```
INPUT:
  Invoice Number: "INV001, INV002, INV003"
  Invoice Amount: "3000"

PROCESSING:
  1. Split invoices: [INV001, INV002, INV003]
  2. Single amount: [3000]
  3. Distribute: 3000 / 3 = 1000

OUTPUT:
  ✓ INV001 → $1000.00
  ✓ INV002 → $1000.00
  ✓ INV003 → $1000.00
```

---

## ⚙️ Configuration

### Pattern Setup (Database)
```sql
INSERT INTO lb_processing_rules (
  rule_id,
  rule_name,
  rule_type,
  conditions,
  active
) VALUES (
  'PAT-003',
  'DOCUMENT_SPLIT_COMMA',
  'INVOICE_SPLIT',
  '{"delimiter": ",", "splitAmounts": true}',
  true
);
```

### Frontend Display
The UI will show split rows with visual indicators:
- 🔀 Split icon next to invoice numbers
- Original value in tooltip
- Split count badge

---

## 🎬 End-to-End Example

### 1. Upload File
```
Customer Payments upload 14.xlsx
  └─ Row 2: "90003904, 3905" | "1365.00, 1575.00"
```

### 2. Pattern Detection
```
✓ Detected: INVOICE_SPLIT pattern
✓ Delimiter: comma (,)
✓ Split amounts: enabled
```

### 3. Extraction
```
Original: 1 row
After split: 2 rows
  Row 1: Invoice 90003904, Amount $1365.00
  Row 2: Invoice 90003905, Amount $1575.00
```

### 4. Validation
```
✓ Check amount sum: $1365 + $1575 = $2940 ✓
✓ Matches original check amount
```

### 5. SAP Payload
```json
{
  "Cheque": "3456687",
  "AmountInTransactionCurrency": "2940.00",
  "to_LockboxClearing": {
    "results": [
      {
        "PaymentReference": "90003904",
        "NetPaymentAmountInPaytCurrency": "1365.00",
        "Currency": "USD"
      },
      {
        "PaymentReference": "90003905",
        "NetPaymentAmountInPaytCurrency": "1575.00",
        "Currency": "USD"
      }
    ]
  }
}
```

### 6. SAP Posting
```
✓ Lockbox Batch Posted
  └─ Payment Advice: 010000121800001
      ├─ Clearing Entry 1: Invoice 90003904, $1365.00
      └─ Clearing Entry 2: Invoice 90003905, $1575.00
```

---

**Visual Guide Complete!** 🎉
