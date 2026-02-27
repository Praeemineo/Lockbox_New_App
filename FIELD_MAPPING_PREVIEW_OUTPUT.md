# 📊 Field Mapping Preview - Expected Output

## Current Status (Preview Environment)

### ✅ What's Working:
The Field Mapping Preview now correctly shows:

**Source Values** (from uploaded file):
```json
{
  "Customer": 17100009,
  "Check Number": 3456693,
  "Check Amount": 18.43,
  "Invoice Number": 90000334,
  "Invoice Amount": 18.43,
  "Deduction Amount": "—",
  "Deposit Date": "2026-02-05"
}
```

**Sections Structure:**
- ✅ Item Section: Check Amount, Check Number, Partner Bank fields
- ✅ Clearing Section: Invoice Number, Invoice Amount, Deduction Amount, Payment Reference

---

## Expected Output (Production with SAP)

### 📋 Field Mapping Preview Display:

#### **ITEM Section:**

| Field Name | Source Value | Final Value | Derived From |
|------------|--------------|-------------|--------------|
| Check Amount | 18.43 | 18.43 | File Upload |
| Check Number | 3456693 | 3456693 | File Upload |
| Partner Bank Country | — | **US** | **RULE-002** |
| Partner Bank | — | **CHASE** | **RULE-002** |
| Partner Bank Account | — | **123456789** | **RULE-002** |

#### **CLEARING Section:**

| Field Name | Source Value | Final Value | Derived From |
|------------|--------------|-------------|--------------|
| Invoice Number | 90000334 | 90000334 | File Upload |
| Invoice Amount | 18.43 | 18.43 | File Upload |
| Deduction Amount | — | — | File Upload |
| Payment Reference | — | **5300000456** | **RULE-001** |
| Company Code | — | **1710** | **RULE-001** |

---

## JSON Structure (Production):

```json
{
  "fieldMappingPreview": {
    "sourceFields": [
      {
        "fieldName": "Customer",
        "displayName": "Customer",
        "value": 17100009,
        "source": "Uploaded File"
      },
      {
        "fieldName": "Check Number",
        "displayName": "Check Number",
        "value": 3456693,
        "source": "Uploaded File"
      },
      {
        "fieldName": "Invoice Number",
        "displayName": "Invoice Number",
        "value": 90000334,
        "source": "Uploaded File"
      }
    ],
    "apiDerivedFields": [
      {
        "fieldName": "PaymentReference",
        "displayName": "Payment Reference",
        "value": "5300000456",
        "source": "SAP API",
        "derivedFromRule": "RULE-001",
        "inputField": "P_Documentnumber",
        "inputValue": "90000334"
      },
      {
        "fieldName": "CompanyCode",
        "displayName": "Company Code",
        "value": "1710",
        "source": "SAP API",
        "derivedFromRule": "RULE-001",
        "inputField": "P_Documentnumber",
        "inputValue": "90000334"
      },
      {
        "fieldName": "PartnerBankCountry",
        "displayName": "Partner Bank Country",
        "value": "US",
        "source": "SAP API",
        "derivedFromRule": "RULE-002",
        "inputField": "BusinessPartner",
        "inputValue": "17100009"
      },
      {
        "fieldName": "PartnerBank",
        "displayName": "Partner Bank",
        "value": "CHASE",
        "source": "SAP API",
        "derivedFromRule": "RULE-002",
        "inputField": "BusinessPartner",
        "inputValue": "17100009"
      },
      {
        "fieldName": "PartnerBankAccount",
        "displayName": "Partner Bank Account",
        "value": "123456789",
        "source": "SAP API",
        "derivedFromRule": "RULE-002",
        "inputField": "BusinessPartner",
        "inputValue": "17100009"
      }
    ],
    "sections": {
      "item": [
        {
          "fieldName": "Check Amount",
          "sourceValue": 18.43,
          "finalValue": 18.43,
          "isApiDerived": false,
          "derivedFrom": "File Upload"
        },
        {
          "fieldName": "Check Number",
          "sourceValue": 3456693,
          "finalValue": 3456693,
          "isApiDerived": false,
          "derivedFrom": "File Upload"
        },
        {
          "fieldName": "Partner Bank Country",
          "sourceValue": "—",
          "finalValue": "US",
          "isApiDerived": true,
          "derivedFrom": "RULE-002"
        },
        {
          "fieldName": "Partner Bank",
          "sourceValue": "—",
          "finalValue": "CHASE",
          "isApiDerived": true,
          "derivedFrom": "RULE-002"
        },
        {
          "fieldName": "Partner Bank Account",
          "sourceValue": "—",
          "finalValue": "123456789",
          "isApiDerived": true,
          "derivedFrom": "RULE-002"
        }
      ],
      "clearing": [
        {
          "fieldName": "Invoice Number",
          "sourceValue": 90000334,
          "finalValue": 90000334,
          "isApiDerived": false,
          "derivedFrom": "File Upload"
        },
        {
          "fieldName": "Invoice Amount",
          "sourceValue": 18.43,
          "finalValue": 18.43,
          "isApiDerived": false,
          "derivedFrom": "File Upload"
        },
        {
          "fieldName": "Payment Reference",
          "sourceValue": "—",
          "finalValue": "5300000456",
          "isApiDerived": true,
          "derivedFrom": "RULE-001"
        },
        {
          "fieldName": "Company Code",
          "sourceValue": "—",
          "finalValue": "1710",
          "isApiDerived": true,
          "derivedFrom": "RULE-001"
        }
      ]
    }
  }
}
```

---

## UI Display Guide:

### Visual Indicators:
- **File Upload fields**: Show actual values in both Source and Final columns
- **API-Derived fields**: 
  - Source Value: "—" (empty, because not in original file)
  - Final Value: Derived value from SAP
  - Badge/Tag: Show "From RULE-001" or "From RULE-002"

### Color Coding (Suggested):
- 🔵 Blue: File upload fields
- 🟢 Green: API-derived fields (successfully enriched)
- 🔴 Red: API-derived fields (failed to enrich)

---

## Backend Logging:

When SAP is connected, you'll see:
```
🔍 Building Field Mapping Preview
   Total fields: 12
   API-derived fields: 5
   Item section fields: 5
   Clearing section fields: 4
   Source fields: 7
   API-derived fields: 5
```

---

## Key Points:

1. **Source Value Column**:
   - Shows values from uploaded file
   - Shows "—" for API-derived fields (they don't exist in upload)

2. **Final Value Column**:
   - Shows all values after validation
   - Includes both uploaded fields and API-derived fields

3. **Derived From Column**:
   - "File Upload" for original fields
   - "RULE-001" for PaymentReference, CompanyCode
   - "RULE-002" for PartnerBankCountry, PartnerBank, PartnerBankAccount

4. **API Metadata**:
   - Each API-derived field includes:
     - `apiEndpoint`: Which SAP API was called
     - `inputField`: What parameter was used
     - `inputValue`: What value was sent to SAP
     - `derivedFromRule`: Which rule derived this field

---

**Status:** ✅ Implementation Complete, Ready for Production Testing
