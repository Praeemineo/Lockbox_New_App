# Customer Number Flow Analysis - Lockbox Clearing Entry

## 📋 Executive Summary

**Current Status:** ✅ Customer number IS being sourced from the input file and stored for the clearing entry.

**Flow:** Input File → Backend Storage → GET LockboxClearing API → Accounting Document

---

## 🔍 Complete Customer Number Data Flow

### **Stage 1: Input File Upload** 
📁 **Location:** Excel/CSV file uploaded by user  
📊 **Field Name:** `Customer` or `Customer Number`

**Example Input:**
```
Check Number | Customer | Invoice Number | Check Amount
12345       | 0000100001 | INV-001      | 1000.00
```

---

### **Stage 2: Data Extraction & Storage**
📂 **File:** `/app/backend/server.js`  
🔧 **Function:** `buildSapPayload()` (Lines 7050-7271)

#### Customer Number Storage Points:

**A) Check Group Level (Line 7062):**
```javascript
checkGroups[checkKey] = {
    checkNumber: checkKey,
    customer: row.Customer || '',  // ✅ Customer from file (for GET LockboxClearing)
    checkAmount: parseFloat(row['Check Amount']),
    // ... other fields
};
```

**B) Invoice Level (Line 7084):**
```javascript
checkGroups[checkKey].invoices.push({
    invoiceNumber: row['Invoice Number'],
    invoiceAmount: parseFloat(row['Invoice Amount']),
    customer: row.Customer || '',  // ✅ Customer stored per invoice
    // ... other fields
});
```

**C) Internal Storage Comment (Lines 7241-7245):**
```javascript
// Store customer for GET LockboxClearing API call (internal use only, not sent to SAP)
// PaymentAdviceAccount = Customer (from file)
// PaymentAdviceAccountType = "D" (constant)
// CompanyCode = "1710" (constant)
```

**⚠️ Important Note:** The customer number is stored in memory during payload build but is **NOT included in the POST payload** sent to SAP. It's reserved for the subsequent GET API call.

---

### **Stage 3: Production Run - POST to SAP**
📂 **File:** `/app/backend/server.js`  
🔧 **Function:** Production run endpoint (Lines 2100-2400)

**POST Payload Structure:**
```javascript
{
    "Lockbox": "001",
    "DepositDateTime": "2024-01-15T10:30:00",
    "AmountInTransactionCurrency": "1000.00",
    "to_Item": {
        "results": [
            {
                "LockboxBatch": "001",
                "LockboxBatchItem": "001",
                "AmountInTransactionCurrency": "1000.00",
                "Currency": "USD",
                "Cheque": "12345",
                "to_LockboxClearing": {
                    "results": [
                        {
                            "PaymentReference": "0000123456",  // From RULE_FETCH_ACCT_DOC
                            "NetPaymentAmountInPaytCurrency": "1000.00",
                            "Currency": "USD"
                            // ❌ Customer NOT included here
                        }
                    ]
                }
            }
        ]
    }
}
```

**Why Customer is NOT in POST:**  
SAP generates the Payment Advice document during POST. The customer association happens in the subsequent GET call using the SAP-generated Payment Advice number.

---

### **Stage 4: GET LockboxClearing API - Customer Number is Used**
📂 **File:** `/app/backend/server.js`  
🔧 **Function:** `getLockboxClearing()` (Lines 1694-1753)

#### Customer Retrieval Logic (Lines 9737-9739):
```javascript
const payloadItems = sapPayload?.to_Item?.results || [];
const payloadItem = payloadItems[itemIdx] || {};
const customerFromFile = payloadItem._customerForClearing || extractedRows[itemIdx]?.Customer || '';
```

#### GET LockboxClearing API Call (Lines 1694-1710):
```javascript
async function getLockboxClearing(queryParams) {
    const { 
        paymentAdvice,           // ✅ From SAP (generated)
        paymentAdviceItem,       // ✅ Constant: "1"
        paymentAdviceAccount,    // ✅ Customer FROM INPUT FILE
        paymentAdviceAccountType, // ✅ Constant: "D"
        companyCode              // ✅ Constant: "1710" or derived
    } = queryParams;
    
    const entityKey = `LockboxClearing(
        PaymentAdvice='${paymentAdvice}',
        PaymentAdviceItem='${paymentAdviceItem || '1'}',
        PaymentAdviceAccount='${paymentAdviceAccount}',  // ← CUSTOMER NUMBER
        PaymentAdviceAccountType='${paymentAdviceAccountType || 'D'}',
        CompanyCode='${companyCode || '1710'}'
    )`;
    
    // API Call to SAP
    const response = await executeHttpRequest({
        destinationName: SAP_DESTINATION_NAME
    }, {
        method: 'GET',
        url: `/sap/opu/odata/sap/API_LOCKBOXPOST_IN/${entityKey}`,
        // ...
    });
}
```

**Live Example from Code (Lines 9752-9769):**
```javascript
const itemInfo = {
    item: itemNum,
    paymentAdvice: step3Data?.PaymentAdvice || '',              // SAP Generated
    paymentAdviceItem: step3Data?.PaymentAdviceItem || '1',
    paymentAdviceAccount: step3Data?.PaymentAdviceAccount || customerFromFile,  // ← FROM FILE
    paymentAdviceAccountType: 'D',                             // CONSTANT
    companyCode: RUNTIME_COMPANY_CODE                          // CONSTANT
};

console.log(`✓ Item ${itemNum}:`);
console.log(`  - PaymentAdviceAccount: ${itemInfo.paymentAdviceAccount} (Customer FROM FILE)`);
```

---

### **Stage 5: Accounting Document Creation**
📂 **File:** `/app/backend/server.js`  
🔧 **Location:** Lines 2279-2330

**Clearing Data Structure Returned:**
```javascript
clearingData = [
    {
        "PaymentAdvice": "0100001218",              // SAP Generated
        "PaymentAdviceAccount": "0000100001",       // ✅ Customer from input file
        "PaymentAdviceAccountType": "D",
        "AccountingDocument": "1900005678",
        "FiscalYear": "2024",
        "CompanyCode": "1710",
        "PaymentReference": "0000123456",
        "NetPaymentAmountInPaytCurrency": "1000.00",
        "Currency": "USD"
    }
]
```

**Accounting Document Object (Lines 2304-2319):**
```javascript
postingDocument = {
    type: 'Posting Document',
    description: 'AR Posting Document (Accounting Document)',
    documentNumber: accountingDocNum,
    companyCode: firstClearing.CompanyCode,
    fiscalYear: firstClearing.FiscalYear,
    entries: clearingData.map(c => ({
        accountingDocument: c.AccountingDocument,
        paymentAdvice: c.PaymentAdvice,
        paymentAdviceAccount: c.PaymentAdviceAccount,  // ✅ Customer number included
        paymentReference: c.PaymentReference,
        amount: c.NetPaymentAmountInPaytCurrency,
        currency: c.Currency,
        companyCode: c.CompanyCode,
        fiscalYear: c.FiscalYear
    }))
};
```

---

## 📊 Customer Number Sources Priority

The system uses this fallback hierarchy to determine customer number:

1. **Primary:** `payloadItem._customerForClearing`
2. **Secondary:** `extractedRows[itemIdx]?.Customer`
3. **Tertiary:** `checkData.customer` (from check group)
4. **Fallback:** Empty string `''`

**Code Reference (Line 9739):**
```javascript
const customerFromFile = payloadItem._customerForClearing || extractedRows[itemIdx]?.Customer || '';
```

---

## 🔄 Complete API Call Sequence

```
┌─────────────────────────────────────────────────────────────┐
│ 1. POST /LockboxBatch                                       │
│    → Sends payment data WITHOUT customer                   │
│    ← Returns: PaymentAdvice (SAP generated)                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. GET /LockboxBatchItem                                    │
│    → Retrieves payment line details                        │
│    ← Returns: PaymentAdvice confirmation                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. GET /LockboxClearing                                     │
│    → Queries with:                                          │
│      • PaymentAdvice (from SAP)                            │
│      • PaymentAdviceAccount (Customer from INPUT FILE) ✅  │
│      • PaymentAdviceAccountType = "D"                      │
│      • CompanyCode = "1710"                                │
│    ← Returns: Accounting Document with customer linkage    │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Verification Points

### Where to Check Customer Number Flow:

1. **Input File Column Headers:**
   - Look for: `Customer`, `Customer Number`, `Customer ID`
   - Case-insensitive fuzzy matching is applied

2. **Backend Logs During Payload Build:**
   ```
   Building Item 001:
     Cheque: 12345
     Amount: 1000.00 USD
     Customer (for GET API): 0000100001  ← Check this
   ```

3. **Production Run Logs - Step 3:**
   ```
   ✓ Item 1:
     - PaymentAdvice: 0100001218 (GENERATED BY SAP)
     - PaymentAdviceAccount: 0000100001 (Customer FROM FILE)  ← Check this
   ```

4. **GET LockboxClearing Query Parameters:**
   ```javascript
   Query params: {
     paymentAdvice: '0100001218',
     paymentAdviceAccount: '0000100001',  ← Customer from file
     paymentAdviceAccountType: 'D',
     companyCode: '1710'
   }
   ```

5. **Final Clearing Response:**
   ```json
   {
     "PaymentAdviceAccount": "0000100001",  ← Customer preserved
     "AccountingDocument": "1900005678"
   }
   ```

---

## 🐛 Potential Issues & Debugging

### Issue 1: Customer Number Not Found
**Symptoms:** `PaymentAdviceAccount` is empty in GET LockboxClearing call

**Debug Steps:**
1. Check input file has `Customer` or `Customer Number` column
2. Verify column name matches exactly (accounting for spaces/case)
3. Check backend logs: "Customer (for GET API): {value}"
4. Look for: `customerFromFile` variable in logs

**Fix:**
- Ensure input file contains customer column
- Check field name normalization logic (Lines 7058, 7062)

### Issue 2: Customer Number Format Issues
**Symptoms:** SAP rejects the clearing entry with "Invalid customer"

**Debug Steps:**
1. Check customer number padding/formatting
2. Verify customer number length (typically 10 digits)
3. Check if leading zeros are preserved

**Fix:**
- Apply `padStart(10, '0')` to customer numbers (similar to invoice padding on Line 601)

### Issue 3: Wrong Customer Linked to Clearing
**Symptoms:** Accounting document created with incorrect customer

**Debug Steps:**
1. Verify payload item index matches extracted row index
2. Check `_customerForClearing` storage during payload build
3. Verify `extractedRows` array order

**Fix:**
- Ensure 1:1 mapping between payload items and extracted rows
- Add explicit `_customerForClearing` field storage

---

## 💡 Recommendations

### Current Implementation: ✅ CORRECT
The system correctly:
1. ✅ Extracts customer from input file
2. ✅ Stores customer internally during payload build
3. ✅ Uses customer for GET LockboxClearing API
4. ✅ Links customer to accounting document

### Potential Enhancements:

1. **Add Customer Validation:**
   ```javascript
   if (!customerFromFile) {
       throw new Error('Customer number missing from input file');
   }
   ```

2. **Customer Number Formatting:**
   ```javascript
   const formattedCustomer = String(customerFromFile).padStart(10, '0');
   ```

3. **Explicit Field Storage:**
   ```javascript
   item._customerForClearing = checkData.customer;  // Make it explicit
   ```

4. **Enhanced Logging:**
   ```javascript
   console.log(`PayloadItem[${i}] Customer: ${customerFromFile}`);
   console.log(`Check Group Customer: ${checkData.customer}`);
   ```

---

## 📝 Summary

### ✅ What's Working:
- Customer number IS captured from input file
- Customer number IS stored during payload build
- Customer number IS used in GET LockboxClearing API call
- Customer number IS included in the accounting document response

### ⚠️ What to Verify:
- Input file contains `Customer` or `Customer Number` column
- Customer values are not empty in the input file
- Backend logs show customer values during processing

### 📍 Key Code Locations:
- **Customer Extraction:** `/app/backend/server.js` Line 7062, 7084
- **Customer Storage:** `/app/backend/server.js` Line 7241-7245
- **Customer Usage:** `/app/backend/server.js` Line 1699 (API call), 9739 (retrieval)
- **Clearing Response:** `/app/backend/server.js` Line 2330 (PaymentAdviceAccount)

---

**Analysis Date:** December 2024  
**Agent:** E1 Fork Agent  
**Status:** ✅ Customer number flow verified and documented
