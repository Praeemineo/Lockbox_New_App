# RULE-004 Data Mapping to Transaction Dialog - Complete

## Overview
RULE-004 document data is now properly mapped to both Header Data and Item Data tabs in the Transaction Dialog.

---

## RULE-004 Response Structure

```json
{
  "success": true,
  "lockboxId": "1000171",
  "documents": [
    {
      "item": "1",
      "LockBoxId": "1000171",              // → Header Data
      "SendingBank": "SAMPLEDEST 12345",   // → Header Data
      "BankStatement": "60",               // → Header Data
      "StatementId": "1000071 260123",     // → Header Data
      "CompanyCode": "0001",               // → Header Data
      "HeaderStatus": "Processed",         // → Header Data
      "BankStatementItem": "2",            // → Item Data (per row)
      "DocumentNumber": "5100000123",      // → Item Data (per row)
      "PaymentAdvice": "01000000600002",   // → Item Data (per row)
      "SubledgerDocument": "SD001",        // → Item Data (per row)
      "SubledgerOnaccountDocument": "SA001", // → Item Data (per row)
      "Amount": 900.00,                    // → Item Data (per row)
      "TransactionCurrency": "USD",        // → Item Data (per row)
      "DocumentStatus": "Posted"           // → Item Data (per row)
    }
  ]
}
```

---

## Data Mapping

### Header Data Tab (From first document)

These fields are header-level and shared across all items:

| RULE-004 Field | Display As | UI Control | Notes |
|----------------|-----------|------------|-------|
| LockBoxId | Lockbox ID | Text | Primary identifier |
| SendingBank | Sending Bank | Text | Bank name and details |
| BankStatement | Bank Statement | Text | Bank statement number |
| StatementId | Statement ID | Text | Full statement identifier |
| CompanyCode | Company Code | Text | SAP company code |
| HeaderStatus | Header Status | ObjectStatus | Color-coded status |
| - | Processing Status | ObjectStatus | From run data |

**Status Color Coding:**
- Success (green): "Processed", "Completed"
- Error (red): "Error", "Failed"
- Warning (yellow): "Pending", "Processing"
- None (gray): Other values

### Item Data Tab (One row per document)

These fields are item-level and repeated for each document:

| RULE-004 Field | Column Header | Notes |
|----------------|--------------|-------|
| item | Item | Row number (1, 2, 3...) |
| BankStatementItem | Bank Statement Item | Item number in bank statement |
| DocumentNumber | Document Number | Accounting document number |
| PaymentAdvice | Payment Advice | Payment advice number |
| SubledgerDocument | Subledger Document | Subledger document reference |
| SubledgerOnaccountDocument | Subledger On-account | On-account document |
| Amount | Amount | Formatted with 2 decimals + currency |
| TransactionCurrency | (included with Amount) | e.g., "900.00 USD" |
| DocumentStatus | Document Status | Color-coded status |

**Document Status Color Coding:**
- Success (green): "Posted", "Cleared"
- Error (red): "Posting Error", "Failed"
- None (gray): Other values

---

## Implementation Details

### Controller Logic (Main.controller.js)

```javascript
// When RULE-004 data is available:
if (oRule004Data.success && oRule004Data.documents && oRule004Data.documents.length > 0) {
    
    // STEP 1: Extract header-level data from first document
    var firstDoc = oRule004Data.documents[0];
    var lockboxId = firstDoc.LockBoxId || "";
    var sendingBank = firstDoc.SendingBank || "";
    var bankStatement = firstDoc.BankStatement || "";
    var statementId = firstDoc.StatementId || "";
    var companyCode = firstDoc.CompanyCode || "";
    var headerStatus = firstDoc.HeaderStatus || "";
    
    // STEP 2: Update Header Data tab fields
    this.byId("txnLockboxId").setText(lockboxId);
    this.byId("txnSendingBank").setText(sendingBank);
    this.byId("txnBankStatement").setText(bankStatement);
    this.byId("txnStatementId").setText(statementId);
    this.byId("txnCompanyCode").setText(companyCode);
    this.byId("txnHeaderStatus").setText(headerStatus);
    this.byId("txnHeaderStatus").setState(getStatusState(headerStatus));
    
    // STEP 3: Map item-level data (one row per document)
    var itemData = oRule004Data.documents.map(function (doc, index) {
        return {
            item: doc.item || (index + 1),
            bankStatementItem: doc.BankStatementItem || "",
            documentNumber: doc.DocumentNumber || "",
            paymentAdvice: doc.PaymentAdvice || "",
            subledgerDocument: doc.SubledgerDocument || "",
            subledgerOnAccount: doc.SubledgerOnaccountDocument || "",
            amount: parseFloat(doc.Amount || 0).toFixed(2),
            currency: doc.TransactionCurrency || "USD",
            documentStatus: doc.DocumentStatus || "Pending"
        };
    });
    
    // STEP 4: Populate Item Data tab table
    populateItemDataTable(itemData);
}
```

---

## Visual Layout

### Header Data Tab

```
┌────────────────────────────────────────────────┐
│ Transaction Details                            │
├────────────────────────────────────────────────┤
│ ┏━━━━━━━━━━━━━┓────────────┐                  │
│ ┃ Header Data ┃ Item Data  │                  │
│ ┗━━━━━━━━━━━━━┛────────────┘                  │
│                                                │
│  Lockbox ID:              Processing Status:  │
│  1000171                  ● VALIDATED          │
│                                                │
│  Bank Statement:                              │
│  60                                            │
│                                                │
│  Company Code:            Sending Bank:       │
│  0001                     SAMPLEDEST 12345    │
│                                                │
│  Statement ID:                                │
│  1000071 260123 0000                          │
│                                                │
│  Header Status:                               │
│  ● Processed                                   │
│                                                │
└────────────────────────────────────────────────┘
```

### Item Data Tab

```
┌────────────────────────────────────────────────┐
│ Transaction Details                            │
├────────────────────────────────────────────────┤
│ ─────────────┏━━━━━━━━━━━┓                    │
│  Header Data ┃ Item Data ┃                    │
│ ─────────────┗━━━━━━━━━━━┛                    │
│                                                │
│ ┌──────────────────────────────────────────┐  │
│ │ Item │ BankSt │ Doc#   │ PmtAdv │ Amt    │  │
│ ├──────┼────────┼────────┼────────┼────────┤  │
│ │  1   │   2    │ 5100.. │ 0100.. │900 USD │  │
│ │  2   │   3    │        │ 0100.. │500 USD │  │
│ └──────────────────────────────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Production Run Completes (RULE-003)
```
POST /api/lockbox
  ↓
RULE-003 posts to SAP
  ↓
RULE-004 auto-fetches documents
  ↓
Documents stored in run.clearingDocuments
```

### 2. User Opens Transaction Dialog
```
Click "Show Transaction Details"
  ↓
Fetch: GET /api/lockbox/runs/:runId (gets run data)
Fetch: GET /api/lockbox/:runId/accounting-document (gets RULE-004 data)
  ↓
RULE-004 returns stored documents (instant load)
  ↓
Controller processes response:
  - Header fields from documents[0]
  - Item table from all documents[]
  ↓
Dialog displays with populated data
```

### 3. User Switches Tabs
```
Header Data tab:
  - Shows: LockboxID, SendingBank, BankStatement, StatementId, 
           CompanyCode, HeaderStatus, ProcessingStatus

Item Data tab:
  - Shows: Table with all document items
  - Columns: Item, BankStatementItem, DocumentNumber, PaymentAdvice,
             SubledgerDocument, SubledgerOnaccount, Amount, Status
```

---

## Example: Multiple Documents

When RULE-004 returns multiple documents:

### RULE-004 Response:
```json
{
  "documents": [
    {
      "LockBoxId": "1000171",          // Header (from first)
      "SendingBank": "Bank of America", // Header (from first)
      "BankStatementItem": "1",        // Item row 1
      "Amount": 500.00,                // Item row 1
      "DocumentStatus": "Posted"       // Item row 1
    },
    {
      "LockBoxId": "1000171",          // Same header data
      "SendingBank": "Bank of America", // Same header data
      "BankStatementItem": "2",        // Item row 2
      "Amount": 900.00,                // Item row 2
      "DocumentStatus": "Posting Error" // Item row 2
    }
  ]
}
```

### Result:
- **Header Data tab:** Shows shared data (LockboxID: 1000171, SendingBank: Bank of America)
- **Item Data tab:** Shows 2 rows (one for each document)

---

## Benefits

1. **Clear Separation**
   - Header-level data (shared) vs Item-level data (per document)
   - No duplicate display of header fields

2. **Complete RULE-004 Data**
   - All fields from SAP response are displayed
   - Nothing is lost or hidden

3. **Proper Hierarchy**
   - Matches SAP data structure
   - One header → Many items

4. **Easy to Read**
   - Header tab: Quick summary
   - Item tab: Detailed line items

---

## Files Modified

1. **Frontend View:**
   - `/app/frontend/public/webapp/view/Main.view.xml`
   - Added: txnBankStatement, txnStatementId fields
   - Layout: 3 columns × 3 rows in Header Data tab

2. **Frontend Controller:**
   - `/app/frontend/public/webapp/controller/Main.controller.js`
   - Enhanced RULE-004 data extraction
   - Separate logic for header vs item data
   - Added console logging for debugging

3. **Deployment:**
   - Synced to `/app/backend/app/webapp/`
   - Services restarted

---

## Testing Checklist

- [x] Header Data tab shows all 7 fields
- [x] LockBoxId populated from RULE-004
- [x] SendingBank populated from RULE-004
- [x] BankStatement populated from RULE-004
- [x] StatementId populated from RULE-004
- [x] CompanyCode populated from RULE-004
- [x] HeaderStatus populated with color coding
- [x] Item Data tab shows table with all documents
- [x] Each document becomes one table row
- [x] Amount displays with currency
- [x] DocumentStatus shows with color coding
- [x] Multiple documents handled correctly
- [x] Console logging shows extracted data

---

## Summary

✅ **Header Data:** Shows 7 fields from RULE-004 (LockboxID, SendingBank, BankStatement, StatementId, CompanyCode, HeaderStatus, ProcessingStatus)  
✅ **Item Data:** Shows table with all document items (8 columns per row)  
✅ **Data Source:** RULE-004 response from stored run data  
✅ **Proper Mapping:** Header fields from first document, item rows from all documents  
✅ **Color Coding:** Status indicators for HeaderStatus and DocumentStatus  
✅ **Complete Display:** All RULE-004 fields are shown in appropriate sections

The Transaction Dialog now properly displays all RULE-004 data in their respective Header and Item sections!
