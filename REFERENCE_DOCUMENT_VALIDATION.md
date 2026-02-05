# Reference Document Validation - XBLNR vs BELNR

## Problem Statement

When users upload payment files with an "Invoice Number" column, the system needs to determine whether these are:
- **XBLNR** (Reference Document Number - External invoice/reference)
- **BELNR** (Accounting Document Number - SAP internal document)

SAP Lockbox API requires the correct field type for successful posting to accounting.

## SAP Field Definitions

### XBLNR (Reference Document Number)
- **Purpose**: External reference number (customer invoice, PO number, etc.)
- **Format**: Any alphanumeric format
- **Length**: Variable
- **Example**: `INV-2024-001`, `90000334`, `PO12345`
- **SAP Table**: BSEG-XBLNR
- **Usage**: Most common for customer payments - the invoice number they're paying

### BELNR (Accounting Document Number)
- **Purpose**: SAP internal accounting document number
- **Format**: Typically 10-digit numeric, system-generated
- **Length**: Exactly 10 digits (with leading zeros)
- **Example**: `1900005678`, `0000123456`
- **SAP Table**: BKPF-BELNR
- **Usage**: Internal SAP FI document, used when clearing against SAP-posted invoices

## Validation Logic

### Auto-Detection Algorithm

The system now includes smart detection logic in `/app/backend/server.js`:

```javascript
function detectDocumentType(documentNumber, explicitType = null) {
    // Priority 1: Explicit column mapping
    if (explicitType === 'XBLNR' || explicitType === 'BELNR') {
        return { type: explicitType, confidence: 'HIGH' };
    }
    
    const docStr = documentNumber.toString().trim();
    
    // Empty value
    if (!docStr) {
        return { type: 'UNKNOWN', confidence: 'NONE' };
    }
    
    // Check pattern
    const isNumeric = /^\d+$/.test(docStr);
    const length = docStr.length;
    
    // Rule 1: 10-digit numeric → BELNR (SAP Accounting Document)
    if (isNumeric && length === 10) {
        return { 
            type: 'BELNR', 
            confidence: 'MEDIUM',
            reason: '10-digit numeric matches SAP Accounting Document pattern'
        };
    }
    
    // Rule 2: Alphanumeric or non-10-digit → XBLNR (Reference)
    if (!isNumeric || length !== 10) {
        return { 
            type: 'XBLNR', 
            confidence: 'MEDIUM',
            reason: 'Alphanumeric or non-standard length indicates external reference'
        };
    }
    
    // Default: XBLNR (most common case)
    return { 
        type: 'XBLNR', 
        confidence: 'LOW',
        reason: 'Default to invoice reference'
    };
}
```

### Detection Priority (Highest to Lowest)

1. **Explicit Columns in Upload File**
   - If file has "XBLNR" column → Use it
   - If file has "BELNR" column → Use it
   - **Confidence**: HIGH

2. **Pattern-Based Detection**
   - 10-digit numeric (e.g., `1900005678`) → BELNR
   - **Confidence**: MEDIUM
   
3. **Format-Based Detection**
   - Alphanumeric (e.g., `INV-001`) → XBLNR
   - Non-10-digit numeric (e.g., `90000334` - 8 digits) → XBLNR
   - **Confidence**: MEDIUM

4. **Default Behavior**
   - When unclear → XBLNR
   - **Confidence**: LOW
   - **Reason**: Invoice numbers in payment files are typically external references

## Usage Examples

### Example 1: User File Without Explicit Columns

**Upload File:**
```csv
Customer,Check Number,Check Amount,Invoice Number,Invoice Amount
17100009,3456693,18.43,90000334,18.43
```

**System Processing:**
```
Row 1: InvoiceNumber="90000334" → XBLNR (MEDIUM confidence)
  Reason: 8-digit numeric (not 10) indicates external reference
  Result: XBLNR = "90000334", BELNR = ""
```

**SAP Posting:**
- Uses Reference Document Rule (e.g., RULE-002: XBLNR)
- PaymentReference = "90000334"
- SAP clears against invoice with XBLNR = "90000334"

### Example 2: SAP Accounting Document

**Upload File:**
```csv
Customer,Check Number,Check Amount,Invoice Number,Invoice Amount
17100009,3456693,100.00,1900005678,100.00
```

**System Processing:**
```
Row 1: InvoiceNumber="1900005678" → BELNR (MEDIUM confidence)
  Reason: 10-digit numeric pattern matches SAP Accounting Document
  Result: XBLNR = "", BELNR = "1900005678"
```

**SAP Posting:**
- Uses Reference Document Rule (e.g., RULE-001: BELNR)
- PaymentReference = "1900005678"
- SAP clears against document with BELNR = "1900005678"

### Example 3: Explicit Column Mapping (Recommended)

**Upload File:**
```csv
Customer,Check Number,Check Amount,XBLNR,Invoice Amount
17100009,3456693,18.43,90000334,18.43
```

**System Processing:**
```
Row 1: Explicit XBLNR column detected (HIGH confidence)
  Result: XBLNR = "90000334", BELNR = ""
```

**Benefits:**
- ✅ No ambiguity
- ✅ Highest confidence
- ✅ Clear intent
- ✅ Recommended approach

## Reference Document Rules (RULE-001 to RULE-004)

The system uses configurable rules to determine which field to use:

### RULE-001: Document Number (BELNR)
- **Logic**: `lbinvref = belnr`
- **Use Case**: When invoice numbers are SAP accounting documents
- **Example**: Clearing against internally posted SAP invoices

### RULE-002: Reference Document Number (XBLNR) - DEFAULT ⭐
- **Logic**: `lbinvref = XBLNR`
- **Use Case**: When invoice numbers are external references
- **Example**: Customer invoice numbers, PO numbers
- **Default**: Most common scenario

### RULE-003: Doc Number First (BELNR_THEN_XBLNR)
- **Logic**: `lbinvref = belnr else XBLNR`
- **Use Case**: Try accounting document first, fallback to reference
- **Example**: Mixed scenarios

### RULE-004: Ref Document First (XBLNR_THEN_BELNR)
- **Logic**: `lbinvref = XBLNR else belnr`
- **Use Case**: Try reference first, fallback to accounting document
- **Example**: Prefer external references when both available

## Integration with SAP Lockbox API

### Payload Building (buildStandardPayload)

```javascript
// Extract fields from uploaded data
const invoiceNumber = row.InvoiceNumber;  // From "Invoice Number" column
const xblnr = row.XBLNR;  // From "XBLNR" column (if exists)
const belnr = row.BELNR;  // From "BELNR" column (if exists)

// Apply active Reference Document Rule
const activeRule = getActiveReferenceDocRule();

// Determine PaymentReference based on rule
switch (activeRule.ruleType) {
    case 'BELNR':
        paymentReference = belnr || invoiceNumber;
        break;
    case 'XBLNR':
        paymentReference = xblnr || invoiceNumber;
        break;
    case 'BELNR_THEN_XBLNR':
        paymentReference = belnr || xblnr || invoiceNumber;
        break;
    case 'XBLNR_THEN_BELNR':
        paymentReference = xblnr || belnr || invoiceNumber;
        break;
}

// Build SAP payload
{
    to_LockboxClearing: {
        results: [
            {
                PaymentReference: paymentReference,
                NetPaymentAmountInPaytCurrency: "18.43",
                Currency: "USD"
            }
        ]
    }
}
```

### SAP API Behavior

**When XBLNR is used:**
```
SAP searches for open items where:
- BSEG-XBLNR = PaymentReference
- Customer match
- Open item exists
```

**When BELNR is used:**
```
SAP searches for documents where:
- BKPF-BELNR = PaymentReference
- Company code match
- Document exists
```

## Troubleshooting

### Issue: "Open item not found in SAP"

**Symptoms:**
- Payment uploads successfully to lockbox
- Clearing fails with "No open items found"
- Invoice definitely exists in SAP

**Root Cause:**
Likely using wrong field type (BELNR vs XBLNR)

**Diagnosis:**
1. Check uploaded invoice number format
2. Verify which field is populated in SAP:
   - SE16 → BSEG → Check XBLNR field
   - SE16 → BKPF → Check BELNR field
3. Review detection log in system console

**Solution:**

**Option A: Add Explicit Column (Recommended)**
```csv
Customer,Check Number,Check Amount,XBLNR,Invoice Amount
17100009,3456693,18.43,90000334,18.43
```

**Option B: Change Reference Document Rule**
- Go to Field Mapping Rules → Reference Document Rules
- Select appropriate rule (RULE-001, RULE-002, RULE-003, or RULE-004)
- Reprocess the file

**Option C: Verify SAP Data**
```sql
-- Check if it's in XBLNR
SELECT * FROM BSEG WHERE XBLNR = '90000334'

-- Check if it's in BELNR
SELECT * FROM BKPF WHERE BELNR = '1900005678'
```

## API Field Documentation Update

The `PaymentReference` field in API Fields now includes:

**Description:**
```
Payment reference/Invoice number - Auto-detects XBLNR (Reference) vs BELNR (Accounting) 
based on format: 10-digit numeric = BELNR, others = XBLNR. Override with explicit 
XBLNR/BELNR columns in upload file. Controlled by Reference Document Rules 
(RULE-001 to RULE-004).
```

## Best Practices

### 1. Use Explicit Columns (Highest Confidence)
```csv
Customer,Check Number,Check Amount,XBLNR,BELNR,Invoice Amount
17100009,3456693,18.43,90000334,,18.43
17100010,3456694,50.00,,1900005678,50.00
```

### 2. Understand Your Invoice Format
- External customer invoices → Use XBLNR
- SAP-posted invoices → Use BELNR
- Mixed scenarios → Use appropriate rule

### 3. Configure Reference Document Rule
- Default (RULE-002: XBLNR) works for 90% of cases
- Change if your specific scenario requires different logic

### 4. Validate in SAP First
Before uploading, verify in SAP:
```
Transaction: FBL5N (Customer Line Items)
Check XBLNR field on open items
```

### 5. Monitor Detection Logs
First 3 rows show detection logic in console:
```
Row 1: InvoiceNumber="90000334" → XBLNR (MEDIUM confidence)
  Reason: 8-digit numeric indicates external reference
```

## Code Locations

### Detection Function
**File**: `/app/backend/server.js`
**Line**: ~4433
**Function**: `detectDocumentType()`

### Data Extraction
**File**: `/app/backend/server.js`
**Line**: ~4735-4785
**Function**: `extractDataByPattern()` → Row building logic

### Payload Building
**File**: `/app/backend/server.js`
**Line**: ~4959-5007
**Function**: `buildStandardPayload()` → Reference rule application

### Reference Document Rules
**File**: `/app/backend/server.js`
**Line**: ~3051-3104
**Constant**: `DEFAULT_REFERENCE_DOC_RULES`

## Summary

**Problem**: Invoice numbers could be XBLNR or BELNR, causing posting failures
**Solution**: Smart auto-detection + explicit column override + configurable rules
**Result**: System correctly identifies document type and posts to SAP successfully

**Key Takeaway**: For maximum reliability, use explicit XBLNR/BELNR columns in your upload files.
