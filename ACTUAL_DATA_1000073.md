# Actual SAP Data for LockboxId 1000073

## Correct SAP Response for LockboxId 1000073

### SAP API Query
```
GET /sap/opu/odata4/sap/zsb_acc_bank_stmt/.../ZFI_I_ACC_BANK_STMT
?$filter=LockBoxId eq '1000073'
&$select=DocumentNumber,PaymentAdvice,SubledgerDocument,CompanyCode,SubledgerOnaccountDocument
```

### Actual SAP Response
```json
{
  "value": [
    {
      "LockBoxId": "1000073",
      "LineItem": "0001",
      "DocumentNumber": "0100000006",
      "PaymentAdvice": "010003456690",
      "SubledgerDocument": "1400000012",
      "CompanyCode": "1000",
      "SubledgerOnaccountDocument": "1400000011",
      "Amount": "2000"
    },
    {
      "LockBoxId": "1000073",
      "LineItem": "0002",
      "DocumentNumber": "0100000007",
      "PaymentAdvice": "010003456691",
      "SubledgerDocument": "1400000012",
      "CompanyCode": "1000",
      "SubledgerOnaccountDocument": "",
      "Amount": ""
    }
  ]
}
```

## Expected Display in Dialog

### Lockbox Data Table

| Company Code | Lockbox ID | Line Item | Document Number | Payment Advice | Subledger Document | Subledger Onaccount Document | Amount |
|--------------|------------|-----------|-----------------|----------------|--------------------|------------------------------|--------|
| 1000         | 1000073    | 0001      | 0100000006      | 010003456690   | 1400000012         | 1400000011                   | 2000   |
| 1000         | 1000073    | 0002      | 0100000007      | 010003456691   | 1400000012         | -                            | -      |

### Line Item 0001 Details:
- **Document Number**: 0100000006
- **Payment Advice**: 010003456690
- **Subledger Document**: 1400000012
- **Subledger Onaccount Document**: 1400000011
- **Amount**: 2000

### Line Item 0002 Details:
- **Document Number**: 0100000007
- **Payment Advice**: 010003456691
- **Subledger Document**: 1400000012
- **Subledger Onaccount Document**: (empty)
- **Amount**: (empty)

## Backend Response Format

```json
{
  "success": true,
  "message": "Clearing documents retrieved successfully",
  "count": 2,
  "documents": [
    {
      "companyCode": "1000",
      "lockboxId": "1000073",
      "documentNumber": "0100000006",
      "paymentAdvice": "010003456690",
      "subledgerDocument": "1400000012",
      "subledgerOnaccountDocument": "1400000011"
    },
    {
      "companyCode": "1000",
      "lockboxId": "1000073",
      "documentNumber": "0100000007",
      "paymentAdvice": "010003456691",
      "subledgerDocument": "1400000012",
      "subledgerOnaccountDocument": ""
    }
  ]
}
```

## Key Points

1. **Line Item 0001**:
   - Has complete data
   - Includes Subledger Onaccount Document: 1400000011
   - Amount: 2000

2. **Line Item 0002**:
   - Has partial data
   - No Subledger Onaccount Document
   - No Amount

3. **Company Code**:
   - **1000** (from RULE-001, not from RULE-004)
   - Preserved from original enrichment

## How It Works

The implementation is **dynamic** and will display exactly what SAP returns:

```javascript
// Backend extracts from SAP response
const documentNumber = sapDoc.DocumentNumber; // "0100000006"
const paymentAdvice = sapDoc.PaymentAdvice;   // "010003456690"
const subledgerDocument = sapDoc.SubledgerDocument; // "1400000012"
const subledgerOnaccountDoc = sapDoc.SubledgerOnaccountDocument; // "1400000011"

// Returns exactly what SAP provides
```

## Note

The examples shown previously were **dummy/sample data** to illustrate the structure. The actual implementation will display the **correct real data from SAP** as shown above.

When you test with LockboxId 1000073, you will see:
- ✅ Line item 0001: 0100000006, 010003456690, 1400000012, 1400000011
- ✅ Line item 0002: 0100000007, 010003456691, 1400000012, (empty)
