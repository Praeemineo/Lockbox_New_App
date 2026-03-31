# Retrieve Accounting Document - API Flow Details

## Button Click: "Retrieve Clearing Doc"

### Step 1: Frontend Request

**Button:** "Retrieve Clearing Doc" (document icon)
**Enabled When:** Status = "POSTED" (after successful Production Run)

**API Call:**
```javascript
POST {{REACT_APP_BACKEND_URL}}/api/lockbox/retrieve-clearing/:headerId
Content-Type: application/json

{
  "lockboxId": "1000172"
}
```

**Example:**
```
POST https://dedup-server.preview.emergentagent.com/api/lockbox/retrieve-clearing/abc-123-def
Content-Type: application/json

{
  "lockboxId": "1000172"
}
```

---

## Step 2: Backend Processing

### 2.1 Read RULE-004 Configuration
**From:** `/app/backend/data/processing_rules.json`

```json
{
  "ruleId": "RULE-004",
  "ruleName": "Get Accounting Document",
  "destination": "S4HANA_SYSTEM_DESTINATION",
  "apiMappings": [
    {
      "httpMethod": "GET",
      "apiReference": "/sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT",
      "destination": "S4HANA_SYSTEM_DESTINATION",
      "inputField": "LockBoxId",
      "outputField": "DocumentNumber,PaymentAdvice,SubledgerDocument,CompanyCode,SubledgerOnaccountDocument"
    }
  ]
}
```

### 2.2 Build SAP OData Query

**Extract LockboxId (6 digits):**
```
Input: "1000172"
Cleaned: "100017" (first 6 digits)
```

**Build Query Parameters:**
```javascript
{
  "$filter": "LockBoxId eq '100017'",
  "$select": "DocumentNumber,PaymentAdvice,SubledgerDocument,CompanyCode,SubledgerOnaccountDocument"
}
```

### 2.3 Call SAP API

**SAP API Endpoint:**
```
GET https://44.196.95.84:44301/sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT
?$filter=LockBoxId eq '100017'
&$select=DocumentNumber,PaymentAdvice,SubledgerDocument,CompanyCode,SubledgerOnaccountDocument
```

**Authentication:** Basic Auth (via BTP Destination: S4HANA_SYSTEM_DESTINATION)
**Headers:**
```
Authorization: Basic <base64_credentials>
Accept: application/json
sap-client: 100
```

---

## Step 3: SAP Response

### Sample SAP Response (OData V4 Format)

```json
{
  "@odata.context": "$metadata#ZFI_I_ACC_BANK_STMT",
  "value": [
    {
      "LockBoxId": "100017",
      "DocumentNumber": "1900000123",
      "PaymentAdvice": "5000000456",
      "SubledgerDocument": "2400000789",
      "CompanyCode": "1000",
      "SubledgerOnaccountDocument": "2400001001"
    },
    {
      "LockBoxId": "100017",
      "DocumentNumber": "1900000124",
      "PaymentAdvice": "5000000457",
      "SubledgerDocument": "2400000790",
      "CompanyCode": "1000",
      "SubledgerOnaccountDocument": "2400001002"
    }
  ]
}
```

**Or OData V2 Format:**
```json
{
  "d": {
    "results": [
      {
        "LockBoxId": "100017",
        "DocumentNumber": "1900000123",
        "PaymentAdvice": "5000000456",
        "SubledgerDocument": "2400000789",
        "CompanyCode": "1000",
        "SubledgerOnaccountDocument": "2400001001"
      }
    ]
  }
}
```

---

## Step 4: Backend Response to Frontend

### Response Format

**Success (Database Available):**
```json
{
  "success": true,
  "message": "Clearing documents retrieved and updated in database successfully",
  "count": 2,
  "updated": true,
  "documents": [
    {
      "companyCode": "1000",
      "lockboxId": "100017",
      "documentNumber": "1900000123",
      "paymentAdvice": "5000000456",
      "subledgerDocument": "2400000789",
      "subledgerOnaccountDocument": "2400001001"
    },
    {
      "companyCode": "1000",
      "lockboxId": "100017",
      "documentNumber": "1900000124",
      "paymentAdvice": "5000000457",
      "subledgerDocument": "2400000790",
      "subledgerOnaccountDocument": "2400001002"
    }
  ]
}
```

**Success (Database Unavailable):**
```json
{
  "success": true,
  "message": "Clearing documents retrieved successfully (database unavailable)",
  "count": 2,
  "updated": false,
  "documents": [
    {
      "companyCode": "1000",
      "lockboxId": "100017",
      "documentNumber": "1900000123",
      "paymentAdvice": "5000000456",
      "subledgerDocument": "2400000789",
      "subledgerOnaccountDocument": "2400001001"
    }
  ]
}
```

**Error:**
```json
{
  "success": false,
  "message": "Failed to retrieve clearing documents: <error details>"
}
```

---

## Step 5: Frontend Dialog Update

### Lockbox Data Table Display

| Company Code | Lockbox ID | Document Number | Payment Advice | Subledger Document | Subledger Onaccount Document |
|--------------|------------|-----------------|----------------|--------------------|------------------------------|
| 1000         | 100017     | 1900000123      | 5000000456     | 2400000789         | 2400001001                   |
| 1000         | 100017     | 1900000124      | 5000000457     | 2400000790         | 2400001002                   |

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER ACTION                                              │
│    Click "Retrieve Clearing Doc" button                    │
│    (for LockboxId = 1000172)                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. FRONTEND REQUEST                                         │
│    POST /api/lockbox/retrieve-clearing/:headerId            │
│    Body: { "lockboxId": "1000172" }                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. BACKEND PROCESSING                                       │
│    ┌─────────────────────────────────────────┐            │
│    │ 3.1 Load RULE-004 Configuration         │            │
│    │     - API: /ZFI_I_ACC_BANK_STMT        │            │
│    │     - Input: LockBoxId                  │            │
│    │     - Destination: S4HANA_SYSTEM        │            │
│    └────────────┬────────────────────────────┘            │
│                 │                                           │
│    ┌────────────▼────────────────────────────┐            │
│    │ 3.2 Extract 6-digit ID: "100017"        │            │
│    └────────────┬────────────────────────────┘            │
│                 │                                           │
│    ┌────────────▼────────────────────────────┐            │
│    │ 3.3 Build OData Query:                  │            │
│    │     $filter=LockBoxId eq '100017'       │            │
│    └────────────┬────────────────────────────┘            │
└─────────────────┼────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. SAP API CALL                                             │
│    GET /sap/opu/odata4/sap/.../ZFI_I_ACC_BANK_STMT         │
│    ?$filter=LockBoxId eq '100017'                          │
│    &$select=DocumentNumber,PaymentAdvice,...               │
│                                                             │
│    Via: BTP Destination (S4HANA_SYSTEM_DESTINATION)        │
│    Auth: Basic (S4H_FIN / Welcome1)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. SAP RESPONSE                                             │
│    {                                                        │
│      "value": [{                                            │
│        "LockBoxId": "100017",                              │
│        "DocumentNumber": "1900000123",                     │
│        "PaymentAdvice": "5000000456",                      │
│        "SubledgerDocument": "2400000789",                  │
│        "CompanyCode": "1000",                              │
│        "SubledgerOnaccountDocument": "2400001001"          │
│      }]                                                     │
│    }                                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. BACKEND UPDATE (if PostgreSQL available)                │
│    UPDATE lockbox_item SET                                  │
│      ar_posting_doc = '1900000123',                        │
│      payment_advice = '5000000456',                        │
│      clearing_doc = '2400000789',                          │
│      company_code = '1000'                                 │
│    WHERE id = item_id                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. RESPONSE TO FRONTEND                                     │
│    {                                                        │
│      "success": true,                                       │
│      "count": 1,                                           │
│      "documents": [{ ... }]                                │
│    }                                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. DIALOG TABLE UPDATED                                     │
│    Shows retrieved document details                         │
│    Message: "Clearing documents retrieved: 1 document"      │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend Logs (Example)

```
=== RETRIEVING CLEARING DOCUMENTS FROM SAP (RULE-004) ===
Header ID: abc-123-def
Provided Lockbox ID: 1000172
✓ Using provided Lockbox ID from request: 1000172

RULE-004 Configuration:
  API Endpoint: /sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT
  Destination: S4HANA_SYSTEM_DESTINATION
  Input Field: LockBoxId
  Output Fields: DocumentNumber,PaymentAdvice,SubledgerDocument,CompanyCode,SubledgerOnaccountDocument

Using LockBoxId for query: 100017
Dynamic Query Parameters: {
  "$filter": "LockBoxId eq '100017'",
  "$select": "DocumentNumber,PaymentAdvice,SubledgerDocument,CompanyCode,SubledgerOnaccountDocument"
}

Calling SAP API...
✓ Retrieved 1 clearing document entries from SAP

SAP Response Data: [
  {
    "LockBoxId": "100017",
    "DocumentNumber": "1900000123",
    "PaymentAdvice": "5000000456",
    "SubledgerDocument": "2400000789",
    "CompanyCode": "1000",
    "SubledgerOnaccountDocument": "2400001001"
  }
]

✓ Retrieved and formatted 1 clearing documents
```

---

## Summary

**API Endpoint:** `POST /api/lockbox/retrieve-clearing/:headerId`

**SAP API Called:** 
```
GET /sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT
?$filter=LockBoxId eq '100017'
```

**For LockboxId = 1000172:**
- Extracted 6 digits: `100017`
- Query: `LockBoxId eq '100017'`
- Returns: Document details (DocumentNumber, PaymentAdvice, etc.)
- Updates: Dialog table with retrieved values
