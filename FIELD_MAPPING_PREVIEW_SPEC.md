# Field Mapping Preview - API-Derived Fields

## Overview
The Field Mapping Preview now clearly distinguishes between:
1. **Source Fields** - Data from uploaded file
2. **API-Derived Fields** - Data enriched from SAP API calls

---

## Implementation Details

### Backend Changes

#### 1. Rule Engine Enhancement
**File:** `/app/backend/srv/handlers/rule-engine.js`

**RULE-001: Accounting Document Lookup**
```javascript
// After successful API call
row.Paymentreference = result.belnr;
row.CompanyCode = result.companyCode;

// Mark as API-derived
row._apiDerivedFields = ['Paymentreference', 'CompanyCode'];
row._apiFieldMappings = {
  Paymentreference: {
    source: 'SAP API',
    apiEndpoint: 'ZFI_I_ACC_DOCUMENT',
    sourceField: 'BELNR (Accounting Document)',
    derivedFrom: 'RULE-001',
    inputField: 'InvoiceNumber',
    inputValue: '90000334'
  },
  CompanyCode: {
    source: 'SAP API',
    apiEndpoint: 'ZFI_I_ACC_DOCUMENT',
    sourceField: 'CompanyCode',
    derivedFrom: 'RULE-001',
    inputField: 'InvoiceNumber',
    inputValue: '90000334'
  }
};
```

**RULE-002: Partner Bank Details**
```javascript
// After successful API call
row.PartnerBank = result.PartnerBank;
row.PartnerBankAccount = result.PartnerBankAccount;
row.PartnerBankCountry = result.PartnerBankCountry;

// Mark as API-derived
row._apiDerivedFields = ['PartnerBank', 'PartnerBankAccount', 'PartnerBankCountry'];
row._apiFieldMappings = {
  PartnerBank: {
    source: 'SAP API',
    apiEndpoint: 'API_BUSINESSPARTNER',
    sourceField: 'BankNumber (BANKS)',
    derivedFrom: 'RULE-002'
  },
  PartnerBankAccount: {
    source: 'SAP API',
    apiEndpoint: 'API_BUSINESSPARTNER',
    sourceField: 'BankAccount (BANKL)',
    derivedFrom: 'RULE-002'
  },
  PartnerBankCountry: {
    source: 'SAP API',
    apiEndpoint: 'API_BUSINESSPARTNER',
    sourceField: 'BankCountryKey (BANKN)',
    derivedFrom: 'RULE-002'
  }
};
```

#### 2. Field Mapping Preview Builder
**File:** `/app/backend/server.js`

**Function:** `buildFieldMappingPreview(extractedData)`

**Output Structure:**
```json
{
  "sourceFields": [
    {
      "fieldName": "InvoiceNumber",
      "value": "90000334",
      "source": "Uploaded File"
    },
    {
      "fieldName": "CustomerNumber",
      "value": "1000",
      "source": "Uploaded File"
    },
    {
      "fieldName": "CheckAmount",
      "value": 1000.00,
      "source": "Uploaded File"
    }
  ],
  "apiDerivedFields": [
    {
      "fieldName": "Paymentreference",
      "value": "1400000123",
      "source": "SAP API",
      "apiEndpoint": "ZFI_I_ACC_DOCUMENT",
      "sourceApiField": "BELNR (Accounting Document)",
      "derivedFromRule": "RULE-001",
      "inputField": "InvoiceNumber",
      "inputValue": "90000334"
    },
    {
      "fieldName": "CompanyCode",
      "value": "1710",
      "source": "SAP API",
      "apiEndpoint": "ZFI_I_ACC_DOCUMENT",
      "sourceApiField": "CompanyCode",
      "derivedFromRule": "RULE-001",
      "inputField": "InvoiceNumber",
      "inputValue": "90000334"
    },
    {
      "fieldName": "PartnerBank",
      "value": "DE",
      "source": "SAP API",
      "apiEndpoint": "API_BUSINESSPARTNER",
      "sourceApiField": "BankNumber (BANKS)",
      "derivedFromRule": "RULE-002"
    },
    {
      "fieldName": "PartnerBankAccount",
      "value": "50010200",
      "source": "SAP API",
      "apiEndpoint": "API_BUSINESSPARTNER",
      "sourceApiField": "BankAccount (BANKL)",
      "derivedFromRule": "RULE-002"
    },
    {
      "fieldName": "PartnerBankCountry",
      "value": "12345678",
      "source": "SAP API",
      "apiEndpoint": "API_BUSINESSPARTNER",
      "sourceApiField": "BankCountryKey (BANKN)",
      "derivedFromRule": "RULE-002"
    }
  ],
  "fieldMappings": [
    {
      "fieldName": "InvoiceNumber",
      "sourceType": "File Upload",
      "targetType": "Lockbox Field",
      "value": "90000334"
    },
    {
      "fieldName": "Paymentreference",
      "sourceType": "SAP API",
      "sourceApiField": "BELNR (Accounting Document)",
      "targetType": "Lockbox API Field (Derived)",
      "apiEndpoint": "ZFI_I_ACC_DOCUMENT",
      "derivedFromRule": "RULE-001",
      "inputMapping": "InvoiceNumber = 90000334",
      "value": "1400000123"
    },
    {
      "fieldName": "PartnerBank",
      "sourceType": "SAP API",
      "sourceApiField": "BankNumber (BANKS)",
      "targetType": "Lockbox API Field (Derived)",
      "apiEndpoint": "API_BUSINESSPARTNER",
      "derivedFromRule": "RULE-002",
      "inputMapping": "",
      "value": "DE"
    }
  ]
}
```

---

## API Response Structure

### POST `/api/lockbox/process`

**Response (after validation):**
```json
{
  "success": true,
  "run": {
    "runId": "RUN-20260225-001",
    "stages": {
      "validation": {
        "status": "completed",
        "message": "2/5 rules executed, 6 records enriched"
      }
    },
    "fieldMappingPreview": {
      "sourceFields": [...],
      "apiDerivedFields": [...],
      "fieldMappings": [...]
    },
    "extractedData": [
      {
        "InvoiceNumber": "90000334",
        "CustomerNumber": "1000",
        "Paymentreference": "1400000123",
        "CompanyCode": "1710",
        "PartnerBank": "DE",
        "PartnerBankAccount": "50010200",
        "PartnerBankCountry": "12345678",
        "_apiDerivedFields": [
          "Paymentreference", "CompanyCode",
          "PartnerBank", "PartnerBankAccount", "PartnerBankCountry"
        ],
        "_apiFieldMappings": {...}
      }
    ]
  }
}
```

---

## Frontend Display Recommendation

### Field Mapping Preview Table

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         FIELD MAPPING PREVIEW                              │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  SOURCE FIELDS (From Uploaded File)                                       │
│  ════════════════════════════════════════                                 │
│                                                                            │
│  Field Name              Value                    Target Type             │
│  ─────────────────────────────────────────────────────────────────────   │
│  InvoiceNumber           90000334                 Lockbox Field           │
│  CustomerNumber          1000                     Lockbox Field           │
│  CheckNumber             12345                    Lockbox Field           │
│  CheckAmount             1000.00                  Lockbox Field           │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  API-DERIVED FIELDS (From SAP)                    🔗                      │
│  ═════════════════════════════════                                        │
│                                                                            │
│  Field Name              Value         Source API Field    Rule           │
│  ─────────────────────────────────────────────────────────────────────   │
│  Paymentreference        1400000123    BELNR (Doc Number)  RULE-001      │
│  │ Input: InvoiceNumber = 90000334                                       │
│  │ API: ZFI_I_ACC_DOCUMENT                                               │
│                                                                            │
│  CompanyCode             1710           CompanyCode         RULE-001      │
│  │ Input: InvoiceNumber = 90000334                                       │
│  │ API: ZFI_I_ACC_DOCUMENT                                               │
│                                                                            │
│  PartnerBank             DE             BankNumber (BANKS)  RULE-002      │
│  │ Input: CustomerNumber = 1000                                          │
│  │ API: API_BUSINESSPARTNER                                              │
│                                                                            │
│  PartnerBankAccount      50010200       BankAccount (BANKL) RULE-002      │
│  │ Input: CustomerNumber = 1000                                          │
│  │ API: API_BUSINESSPARTNER                                              │
│                                                                            │
│  PartnerBankCountry      12345678       BankCountryKey      RULE-002      │
│  │ Input: CustomerNumber = 1000                                          │
│  │ API: API_BUSINESSPARTNER                                              │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Visual Indicators

**Source Fields:**
- Icon: 📄 (Document icon)
- Color: Blue
- Badge: "File Upload"

**API-Derived Fields:**
- Icon: 🔗 (Link icon) or 🌐 (Globe icon)
- Color: Green
- Badge: "SAP API"
- Show expandable detail with:
  - Input field mapping
  - SAP API endpoint
  - Source API field name
  - Derived from rule

---

## Testing

### Test Case 1: RULE-001 (Invoice Validation)

**Input File:**
```csv
InvoiceNumber,CheckAmount
90000334,1000.00
```

**Expected Field Mapping Preview:**
```
Source Fields:
- InvoiceNumber: 90000334 (File Upload)
- CheckAmount: 1000.00 (File Upload)

API-Derived Fields:
- Paymentreference: 1400000123 (SAP API ← BELNR)
  • Derived from: RULE-001
  • API: ZFI_I_ACC_DOCUMENT
  • Input: InvoiceNumber = 90000334

- CompanyCode: 1710 (SAP API ← CompanyCode)
  • Derived from: RULE-001
  • API: ZFI_I_ACC_DOCUMENT
  • Input: InvoiceNumber = 90000334
```

### Test Case 2: RULE-002 (Partner Bank Details)

**Input File:**
```csv
CustomerNumber,CheckAmount
1000,1000.00
```

**Expected Field Mapping Preview:**
```
Source Fields:
- CustomerNumber: 1000 (File Upload)
- CheckAmount: 1000.00 (File Upload)

API-Derived Fields:
- PartnerBank: DE (SAP API ← BankNumber)
  • Derived from: RULE-002
  • API: API_BUSINESSPARTNER
  • Filter: BankIdentification = 0001

- PartnerBankAccount: 50010200 (SAP API ← BankAccount)
  • Derived from: RULE-002
  • API: API_BUSINESSPARTNER

- PartnerBankCountry: 12345678 (SAP API ← BankCountryKey)
  • Derived from: RULE-002
  • API: API_BUSINESSPARTNER
```

---

## Benefits

1. **Transparency:** Users can clearly see which fields came from the file vs SAP API
2. **Traceability:** Each API-derived field shows the input mapping and source
3. **Debugging:** Easy to identify if API enrichment worked correctly
4. **Compliance:** Clear audit trail of data sources

---

## Next Steps (Frontend Implementation)

1. Create Field Mapping Preview component
2. Display source fields and API-derived fields separately
3. Add visual indicators (icons, colors, badges)
4. Show expandable details for API-derived fields
5. Display in validation results screen

**Recommended UI Location:**
- After file upload and validation
- Before the mapping stage
- As a separate tab or section: "Field Mapping Preview"

---

## Summary

✅ **Backend Complete:**
- Rule engine marks API-derived fields with metadata
- Field Mapping Preview builder creates structured output
- Clear distinction between source and derived fields

⚠️ **Frontend Needed:**
- Display Field Mapping Preview in UI
- Visual differentiation (icons, colors)
- Expandable details for API fields

The backend now provides all necessary data for the Field Mapping Preview! 🎉
