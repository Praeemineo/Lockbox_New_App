# Data Persistence Summary - Patterns & Rules

## ✅ Current Status (As of Feb 17, 2026)

### Data Files Secured
1. **File Patterns**: `/app/backend/data/file_patterns.json`
   - Contains **6 patterns**: PAT0001 through PAT0006
   - Git tracked and committed ✓
   - Automatically loaded on server startup ✓

2. **Processing Rules**: `/app/backend/data/processing_rules.json`
   - Contains **5 rules**: RULE-001 through RULE-005
   - Git tracked and committed ✓
   - Automatically loaded on server startup ✓

### Data Loading Mechanism
- **Function**: `loadPatternsFromFile()` at line 2917 in server.js
- **Function**: `loadProcessingRulesFromFile()` at line 2765 in server.js
- **Trigger**: Called during server initialization
- **Backend logs confirm**: "Loaded 6 patterns from backup file" and "Loaded 5 processing rules from file"

### Database Migration Ready
- **Created**: `/app/backend/migrations/001_create_patterns_and_rules.sql`
- **Tables**: `file_patterns` and `processing_rules`
- **Status**: Ready to execute when PostgreSQL connection is established
- **Purpose**: Will preserve data even if JSON files are modified

---

## 📊 Data Structure

### File Patterns (6 total)
| Pattern ID | Pattern Name | File Type | Pattern Type |
|-----------|--------------|-----------|--------------|
| PAT0001 | Single Check, Multiple Invoice | EXCEL | Single Check Multi Invoice |
| PAT0002 | Multiple Check, Multiple Invoice | EXCEL | Multiple Check Multi Invoice |
| PAT0003 | File Containing Comma | EXCEL | File Containing Comma |
| PAT0004 | File Containing Comma, Date Pattern | EXCEL | File Containing Comma |
| PAT0005 | Date Pattern | EXCEL | Date Pattern |
| PAT0006 | Five column Worksheet | EXCEL | Five column Worksheet |

### Processing Rules (5 total)
| Rule ID | Rule Name | File Type | Rule Type | Active |
|---------|-----------|-----------|-----------|--------|
| RULE-001 | Accounting Document Lookup | EXCEL | API_LOOKUP | ✓ |
| RULE-002 | Partner Bank Details | EXCEL | BANK_VALIDATION | ✓ |
| RULE-003 | Customer Master Data | EXCEL | MASTER_DATA | ✓ |
| RULE-004 | Open Item Verification | EXCEL | VALIDATION | ✓ |
| RULE-005 | Payment Terms Lookup | EXCEL | ENRICHMENT | ✓ |

---

## 🔄 Rule Conditions Structure (Updated)

### RULE-001: Accounting Document Lookup
**Conditions** (New 2-column format):
```json
[
  { "documentFormat": "Check", "condition": "Single Check" },
  { "documentFormat": "Check Amount", "condition": "Amount per Check" },
  { "documentFormat": "Invoice/document number", "condition": "Single/Multiple for Check" },
  { "documentFormat": "Invoice/Document Amount", "condition": "Invoice/Document Amount per Invoice" }
]
```

**API Mappings**:
- Fetch `Belnr` (Payment Reference) from `/sap/opu/odata/sap/API_JOURNALENTRY_SRV/JournalEntry`
- Fetch `Company Code` from same API
- Input: Invoice Reference, Fiscal Year
- Output: AccountingDocument, CompanyCode

### RULE-002: Partner Bank Details
**Conditions**:
```json
[
  { "documentFormat": "Bank Account", "condition": "Validate Bank Account" },
  { "documentFormat": "Partner Number", "condition": "Business Partner Lookup" }
]
```

**API Mappings**:
- Fetch Bank Code from `/sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartnerBank`
- Input: Business Partner (Customer Number)
- Output: BankCode
- **Fallback**: Use default bank details if API returns nothing

### RULE-003: Customer Master Data
**Conditions**:
```json
[
  { "documentFormat": "Customer Number", "condition": "Master Data Verification" },
  { "documentFormat": "Customer Name", "condition": "Name Matching" },
  { "documentFormat": "Customer Category", "condition": "Category Validation" }
]
```

**API Mappings**:
- Fetch Customer data from `/sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartner`
- Validate customer exists and enrich data

### RULE-004: Open Item Verification
**Conditions**:
```json
[
  { "documentFormat": "Invoice Number", "condition": "Open Item Check" },
  { "documentFormat": "Document Amount", "condition": "Amount Verification" }
]
```

**API Mappings**:
- Check open items from `/sap/opu/odata/sap/API_ODATA_FI_OPEN_ITEMS/OpenItems`
- Validate amounts before clearing

### RULE-005: Payment Terms Lookup
**Conditions**:
```json
[
  { "documentFormat": "Customer Number", "condition": "Payment Terms Lookup" },
  { "documentFormat": "Due Date", "condition": "Calculate Due Date" }
]
```

**API Mappings**:
- Fetch payment terms from `/sap/opu/odata/sap/API_PAYMENTTERMS/PaymentTerms`
- Calculate due dates

---

## 🛡️ Protection Against Data Loss

### On GitHub Code Updates:
1. ✅ JSON files are in git repository
2. ✅ Changes are committed automatically by Emergent platform
3. ✅ Server reloads data from files on restart
4. ✅ No hardcoded data in code - all dynamic from JSON

### Future PostgreSQL Migration:
1. ✅ Migration script ready in `/app/backend/migrations/`
2. ✅ When DB becomes available, data will be loaded from JSON to PostgreSQL
3. ✅ Application will automatically switch from file-based to DB-based storage
4. ✅ Indexing in place for performance

---

## ✅ Verification

### Backend Logs Show:
```
Database not available, loading patterns from file backup
Loaded 6 patterns from backup file
Loaded 5 processing rules from file
```

### API Endpoints Verified:
- `GET /api/field-mapping/patterns` ✓ Returns 6 patterns
- `GET /api/processing-rules` ✓ Returns 5 rules with new conditions structure
- All data matches JSON files ✓

### UI Verified:
- **File Patterns Tab**: Shows all 6 patterns (PAT0001-PAT0006) ✓
- **Rules Tab**: Shows all 5 rules with correct counts ✓
- **Conditions Tab**: Updated to new 2-column layout ✓

---

## 📝 Next Steps

1. **Phase 2**: Implement dynamic pattern matching logic in Lockbox Transaction
2. **Phase 3**: Implement rule execution engine for data enrichment
3. **Phase 4**: SAP integration with dynamic API calls based on rules
4. **Phase 5**: Post-processing status updates

**Data is now secure and won't be lost on code updates!** ✅
