# RULE-002: Single Customer Number Input for All Bank Fields

## ✅ Configuration Confirmed

### 🎯 Single Input Source

**ALL THREE bank fields** are fetched using the **SAME Customer Number** from the uploaded file:

```
Input File Field: CustomerNumber (e.g., "0000100001")
          ↓
      (Used for ALL 3 fields)
          ↓
    ┌─────┴─────┬─────────┐
    ↓           ↓         ↓
  BANKS      BANKL      BANKN
    ↓           ↓         ↓
PartnerBank  PartnerBankAccount  PartnerBankCountry
```

---

## 📋 Detailed Flow

### Step 1: Read from File
```
Uploaded File Row:
{
  "CustomerNumber": "0000100001",
  "InvoiceAmount": 1500.00,
  ...
}
```

### Step 2: RULE-002 Triggered
All 3 mappings use the **same input**:

| Mapping | Input Source | API Input Field | Output Field | Lockbox Field |
|---------|--------------|-----------------|--------------|---------------|
| 1 | `CustomerNumber` | `BusinessPartner` | `BANKS` | `PartnerBank` |
| 2 | `CustomerNumber` | `BusinessPartner` | `BANKL` | `PartnerBankAccount` |
| 3 | `CustomerNumber` | `BusinessPartner` | `BANKN` | `PartnerBankCountry` |

### Step 3: Single SAP API Call
```http
GET /sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartnerBank?
    $filter=BusinessPartner eq '0000100001'
    &$select=BANKS,BANKL,BANKN,CompanyCode,FiscalYear
    &$top=1
```

**Key Points**:
- ✅ Only **ONE** CustomerNumber value is used
- ✅ Only **ONE** API call is made
- ✅ **THREE** fields are retrieved in that single call

### Step 4: SAP Response
```json
{
  "d": {
    "results": [
      {
        "BusinessPartner": "0000100001",
        "BANKS": "12345678",
        "BANKL": "8765432195",
        "BANKN": "US"
      }
    ]
  }
}
```

### Step 5: Data Enrichment
```javascript
row.PartnerBank = "12345678"         // from BANKS
row.PartnerBankAccount = "8765432195" // from BANKL
row.PartnerBankCountry = "US"         // from BANKN
```

---

## 🔍 Code Verification

### In `sap-client.js` (fetchPartnerBankDetails):

```javascript
// Takes CustomerNumber ONCE
const inputValues = {
    [firstMapping.sourceInput]: businessPartner  // sourceInput = "CustomerNumber"
};

// Builds filter with that single value
$filter: BusinessPartner eq '0000100001'

// Selects all 3 output fields
$select: BANKS,BANKL,BANKN,CompanyCode,FiscalYear
```

### In `rule-engine.js` (executeRule002):

```javascript
// Reads CustomerNumber from row ONCE
const businessPartner = row.Customer || row.CustomerNumber || row.BusinessPartner;

// Passes to SAP client ONCE
const result = await sapClient.fetchPartnerBankDetails(mappings, businessPartner);

// Populates all 3 lockbox fields from single API response
row.PartnerBank = result.PartnerBank;           // from BANKS
row.PartnerBankAccount = result.PartnerBankAccount;  // from BANKL
row.PartnerBankCountry = result.PartnerBankCountry;  // from BANKN
```

---

## 💡 Why This Approach?

### Efficiency:
- **1 Input** → **1 API Call** → **3 Outputs**
- No redundant API calls
- Optimal performance

### Consistency:
- All bank fields guaranteed to come from same customer record
- No risk of data mismatch between fields

### Simplicity:
- Configuration clearly shows all fields use same input
- Easy to understand and maintain

---

## 📊 Example Scenarios

### Scenario 1: Customer Exists in SAP
```
Input: CustomerNumber = "0000100001"
API Call: 1 call to A_BusinessPartnerBank
Result:
  ✅ PartnerBank = "12345678" (from BANKS)
  ✅ PartnerBankAccount = "8765432195" (from BANKL)
  ✅ PartnerBankCountry = "US" (from BANKN)
```

### Scenario 2: Customer NOT Found in SAP
```
Input: CustomerNumber = "9999999999"
API Call: 1 call to A_BusinessPartnerBank
Result: No records found
Fallback:
  ⚠️  PartnerBank = "88888876" (default)
  ⚠️  PartnerBankAccount = "8765432195" (default)
  ⚠️  PartnerBankCountry = "US" (default)
```

### Scenario 3: Multiple Rows in File
```
Row 1: CustomerNumber = "0000100001"
  → API Call 1: Fetch bank details for 0000100001
Row 2: CustomerNumber = "0000100002"
  → API Call 2: Fetch bank details for 0000100002
Row 3: CustomerNumber = "0000100001" (same as Row 1)
  → API Call 3: Fetch bank details for 0000100001 again
```

**Note**: Each row triggers its own API call. Future optimization could cache results.

---

## ✅ Configuration Summary

```json
{
  "ruleId": "RULE-002",
  "ruleName": "Partner Bank Details",
  "apiMappings": [
    {
      "sourceInput": "CustomerNumber",  ← SAME for all 3
      "inputField": "BusinessPartner",  ← SAME for all 3
      "outputField": "BANKS"            ← Different output
    },
    {
      "sourceInput": "CustomerNumber",  ← SAME for all 3
      "inputField": "BusinessPartner",  ← SAME for all 3
      "outputField": "BANKL"            ← Different output
    },
    {
      "sourceInput": "CustomerNumber",  ← SAME for all 3
      "inputField": "BusinessPartner",  ← SAME for all 3
      "outputField": "BANKN"            ← Different output
    }
  ]
}
```

---

## 🎯 Confirmation Checklist

- [x] All 3 mappings have `"sourceInput": "CustomerNumber"`
- [x] All 3 mappings have `"inputField": "BusinessPartner"`
- [x] All 3 mappings use same API endpoint
- [x] Single API call fetches all 3 fields
- [x] Code reads CustomerNumber ONCE per row
- [x] Code makes API call ONCE per row
- [x] Code populates 3 lockbox fields from single response

---

**Status**: ✅ **CONFIRMED - Configuration is correct!**

All three bank fields (BANKS, BANKL, BANKN) are fetched using the **SAME CustomerNumber** from the input file, with a **SINGLE API call** per customer.
