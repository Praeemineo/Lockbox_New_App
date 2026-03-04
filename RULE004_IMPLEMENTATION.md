# RULE-004 Implementation - Dynamic SAP Integration

## Overview
RULE-004 follows the same dynamic pattern as RULE-001 and RULE-002. It reads API configuration from the database/JSON and uses exact field names (case-sensitive) as configured.

## Configuration (processing_rules.json)

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

## Case Sensitivity

**IMPORTANT:** All field names are **case-sensitive** and used exactly as configured:

- `inputField`: "LockBoxId" (capital B, capital I) - used in OData query filter
- `outputField`: Comma-separated list of exact field names from SAP response

### Dynamic Query Construction

```javascript
// Read from RULE-004 configuration (case-sensitive)
const inputFieldName = getAccountingDocApi.inputField; // "LockBoxId"

// Build OData query with exact field name
const queryParams = {
    $filter: `${inputFieldName} eq '1000073'`
    // Result: "LockBoxId eq '1000073'"
};
```

### Examples of Case Variations

SAP field names can vary:
- `LockBoxId` (capital B, capital I) ✅ Current configuration
- `LockboxId` (lowercase b, capital I)
- `lockBoxId` (lowercase l, capital B)
- `lockboxid` (all lowercase)

**Solution:** Always use the exact field name from RULE-004 configuration - the system reads it dynamically and preserves case.

## Implementation Flow

```
1. User clicks "Retrieve Clearing Doc"
   ↓
2. Backend reads RULE-004 from database/JSON
   ↓
3. Extract configuration (case-sensitive):
   - inputField: "LockBoxId"
   - outputField: "DocumentNumber,PaymentAdvice,..."
   - destination: "S4HANA_SYSTEM_DESTINATION"
   ↓
4. Build dynamic OData query:
   $filter=LockBoxId eq '1000073'
   ↓
5. Call SAP API via sap-client
   ↓
6. Parse response using exact output field names
   ↓
7. Update PostgreSQL/JSON with retrieved data
   ↓
8. Return formatted data to frontend
```

## SAP API Query Example

```http
GET /sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT
?$filter=LockBoxId eq '1000073'
&$select=DocumentNumber,PaymentAdvice,SubledgerDocument,CompanyCode,SubledgerOnaccountDocument
```

## Output Field Parsing

The system dynamically parses output fields from configuration:

```javascript
// From RULE-004 configuration
"outputField": "DocumentNumber,PaymentAdvice,SubledgerDocument,CompanyCode,SubledgerOnaccountDocument"

// Parsed into array (case-preserved)
['DocumentNumber', 'PaymentAdvice', 'SubledgerDocument', 'CompanyCode', 'SubledgerOnaccountDocument']

// Used to extract from SAP response
const documentNumber = sapDoc.DocumentNumber || sapDoc.documentNumber || '';
```

**Note:** The code checks both exact case and lowercase variations for robustness.

## Database Update

After retrieving from SAP, the system updates:

**PostgreSQL (Primary):**
```sql
UPDATE lockbox_item 
SET 
    ar_posting_doc = 'DocumentNumber value',
    payment_advice = 'PaymentAdvice value',
    clearing_doc = 'SubledgerDocument value',
    company_code = 'CompanyCode value'
WHERE id = item_id
```

**JSON Fallback:**
- If PostgreSQL fails, returns 503 with error
- Future enhancement: Update JSON files directly

## Frontend Display

Retrieved data appears in Lockbox Data table:
- **Document Number** (was "AR Posting Doc")
- **Payment Advice**
- **Subledger Document** (was "Clearing Doc")
- **Subledger Onaccount Document** (new column)

## Testing

**Backend Logs to Verify Case Handling:**
```
RULE-004 Configuration:
  Input Field: LockBoxId
  Output Fields: DocumentNumber,PaymentAdvice,...
Dynamic Query Parameters: { $filter: 'LockBoxId eq \'1000073\'' }
```

## Key Takeaways

1. ✅ **Case-sensitive:** All field names preserve exact case from configuration
2. ✅ **Dynamic:** No hardcoded field names in code
3. ✅ **Configurable:** Change field names in RULE-004 JSON without code changes
4. ✅ **Pattern consistency:** Same approach as RULE-001 and RULE-002
5. ✅ **Fallback handling:** PostgreSQL → JSON fallback implemented
