# Multiple Line Items Display - LockboxId 1000073

## SAP Response for LockboxId 1000073

When querying SAP with LockboxId 1000073, the API returns multiple line items:

### SAP API Call
```
GET /sap/opu/odata4/sap/zsb_acc_bank_stmt/.../ZFI_I_ACC_BANK_STMT
?$filter=LockBoxId eq '1000073'
&$select=DocumentNumber,PaymentAdvice,SubledgerDocument,CompanyCode,SubledgerOnaccountDocument
```

### SAP Response (Multiple Line Items)
```json
{
  "value": [
    {
      "LockBoxId": "1000073",
      "LineItem": "0001",
      "DocumentNumber": "1900000123",
      "PaymentAdvice": "5000000456",
      "SubledgerDocument": "2400000789",
      "CompanyCode": "1000",
      "SubledgerOnaccountDocument": "2400001001"
    },
    {
      "LockBoxId": "1000073",
      "LineItem": "0002",
      "DocumentNumber": "1900000124",
      "PaymentAdvice": "5000000457",
      "SubledgerDocument": "2400000790",
      "CompanyCode": "1000",
      "SubledgerOnaccountDocument": "2400001002"
    }
  ]
}
```

## Backend Processing

The backend already handles this correctly:
```javascript
// Loop through ALL results
for (let i = 0; i < results.length; i++) {
    const sapDoc = results[i];
    
    // Format each line item
    formattedDocs.push({
        companyCode: sapDoc.CompanyCode,
        lockboxId: cleanLockboxId,
        lineItem: sapDoc.LineItem || (i + 1).toString().padStart(4, '0'),
        documentNumber: sapDoc.DocumentNumber,
        paymentAdvice: sapDoc.PaymentAdvice,
        subledgerDocument: sapDoc.SubledgerDocument,
        subledgerOnaccountDocument: sapDoc.SubledgerOnaccountDocument
    });
}
```

## Backend Response
```json
{
  "success": true,
  "message": "Clearing documents retrieved successfully",
  "count": 2,
  "documents": [
    {
      "companyCode": "1000",
      "lockboxId": "1000073",
      "lineItem": "0001",
      "documentNumber": "1900000123",
      "paymentAdvice": "5000000456",
      "subledgerDocument": "2400000789",
      "subledgerOnaccountDocument": "2400001001"
    },
    {
      "companyCode": "1000",
      "lockboxId": "1000073",
      "lineItem": "0002",
      "documentNumber": "1900000124",
      "paymentAdvice": "5000000457",
      "subledgerDocument": "2400000790",
      "subledgerOnaccountDocument": "2400001002"
    }
  ]
}
```

## Dialog Display (Lockbox Data Table)

Each line item should be displayed as a separate row:

| Company Code | Lockbox ID | Line Item | Document Number | Payment Advice | Subledger Document | Subledger Onaccount Document |
|--------------|------------|-----------|-----------------|----------------|--------------------|------------------------------|
| 1000         | 1000073    | 0001      | 1900000123      | 5000000456     | 2400000789         | 2400001001                   |
| 1000         | 1000073    | 0002      | 1900000124      | 5000000457     | 2400000790         | 2400001002                   |

## Current Implementation Status

✅ **Backend**: Already handles multiple line items correctly
- Loops through all SAP results
- Returns all line items in response

✅ **Frontend**: Displays all items returned
- Table binds to `documents` array
- Each item in array = one table row
- Multiple line items display one below another

## Testing with LockboxId 1000073

**Expected Behavior:**
1. User completes Production Run
2. LockboxId generated: 1000073
3. User clicks "Retrieve Clearing Doc"
4. Backend queries: `LockBoxId eq '1000073'`
5. SAP returns 2 line items (0001 and 0002)
6. Frontend displays 2 rows in table
7. Each row shows its respective line item data

**Backend Logs:**
```
=== RETRIEVING CLEARING DOCUMENTS FROM SAP (RULE-004) ===
Using LockBoxId for query: 1000073
✓ Retrieved 2 clearing document entries from SAP
SAP Response Data: [
  { LineItem: '0001', DocumentNumber: '1900000123', ... },
  { LineItem: '0002', DocumentNumber: '1900000124', ... }
]
✓ Retrieved and formatted 2 clearing documents
```

**Success Message:**
```
"Clearing documents retrieved successfully: 2 documents"
```

## Key Points

- ✅ Each SAP line item = one row in dialog table
- ✅ All line items for LockboxId 1000073 displayed
- ✅ Line items shown one below another
- ✅ No limit on number of line items
- ✅ Complete document details for each line item

The implementation is already correct and will display multiple line items properly!
