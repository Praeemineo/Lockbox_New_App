# RULE-004 SAP API Implementation Details

## ✅ Current Implementation Summary

### 1. **API Endpoint Configuration**
- **Rule Definition**: Stored in `/app/backend/data/processing_rules.json` (RULE-004)
- **API Base Path**: `/sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT`
- **Complete API Call Example**:
  ```
  /sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT?$filter=LockBoxId eq '1000186'&$select=LockBoxId,SendingBank,BankStatement,StatementId,CompanyCode,HeaderStatus,BankStatementItem,DocumentNumber,PaymentAdvice,SubledgerDocument,SubledgerOnaccountDocument,Amount,TransactionCurrency,DocumentStatus&$top=100
  ```

### 2. **Pass-Through Architecture** ✅
- **NO BTP STORAGE**: Data is fetched fresh from SAP every time
- **Real-time Updates**: Any changes in SAP backend will reflect immediately in BTP UI
- **Direct Connection**: Uses environment variables (`SAP_URL`, `SAP_USER`, `SAP_PASSWORD`) not BTP Destination Service

### 3. **Current SAP Response Logging** ✅

The backend already logs all SAP response fields with clear labels. Here's what's logged:

```javascript
📋 RULE-004 SAP RESPONSE VALUES:
================================================================================
🔍 LockboxId used in query: 1000186
📥 Full SAP Response: [Complete JSON response]

📊 Documents Summary with Field Labels:
   ========== Document 1 ==========
   🏦 LockBoxId: 1000186
   🏢 Sending Bank Field: LOCKBOXDES LOCKBOXORI
   📄 Bank Statement: 161
   🔖 Statement ID: 1000186 260220 0000
   🏛️  Company Code: 1710
   ✅ Header Status: Posting Error
   📌 Bank Statement Item: 1
   📝 Document Number: 100000112
   💳 Payment Advice: 010000016100001
   📊 Subledger Document: 
   📋 Subledger on-account: 
   💰 Amount: 1365.00
   💱 Transaction Currency: USD
   📈 Document Status: Not Cleared
   ==============================
================================================================================
```

### 4. **Fields Mapped from SAP to BTP UI**

#### **Header Data Tab** (from first document in response):
- **LockBox ID**: `LockBoxId` from SAP → displayed in "txnLockboxId"
- **Sending Bank**: `SendingBank` from SAP → displayed in "txnSendingBank"
- **Company Code**: `CompanyCode` from SAP → displayed in "txnCompanyCode"
- **Bank Statement**: `BankStatement` from SAP → displayed in "txnBankStatement"
- **Statement ID**: `StatementId` from SAP → displayed in "txnStatementId"
- **Header Status**: `HeaderStatus` from SAP → displayed in "txnHeaderStatus"

#### **Item Data Tab** (one row per document):
- **Item**: Sequential number
- **Bank Statement Item**: `BankStatementItem` from SAP
- **Document Number**: `DocumentNumber` from SAP
- **Payment Advice**: `PaymentAdvice` from SAP
- **Subledger Document**: `SubledgerDocument` from SAP
- **Subledger On-Account**: `SubledgerOnaccountDocument` from SAP
- **Amount**: `Amount` from SAP (formatted with 2 decimals)
- **Currency**: `TransactionCurrency` from SAP
- **Document Status**: `DocumentStatus` from SAP

### 5. **LockboxID Handling** ✅
- Automatically parses LockboxID from multiple possible fields in BTP run data:
  - `run.lockboxId`
  - `run.sapPayload.Lockbox`
  - `run.header.lockbox`
  - `run.mappedData[0]['Lockbox ID']`
- **Hyphen Stripping**: Automatically converts `"1000173-0"` → `"1000173"` for SAP query

### 6. **API Connection Method** ✅
- **Direct Connection**: Uses `destination: null` to force direct connection via environment variables
- **Same as RULE-002**: Uses the same connection method that user confirmed works perfectly

### 7. **Error Handling** ✅
- Comprehensive `try-catch` blocks around all SAP API calls
- Detailed error logging with:
  - Error message
  - LockboxId used
  - API endpoint called
  - Status code and text
  - Helpful hints for debugging

---

## 📝 **What You Need to Verify**

### Test Checklist:
1. **Deploy to BTP** and test the "View Accounting Document" feature
2. **Check BTP logs** (`cf logs <app-name>`) to verify:
   - ✅ API endpoint is correct
   - ✅ All SAP response fields are logged with labels
   - ✅ Connection method is direct (not destination service)
3. **Verify UI Display**:
   - Run `sync_frontend.sh` and hard refresh browser (Ctrl+F5)
   - Open transaction dialog for a POSTED run
   - Verify "Header Data" tab shows: LockboxId, SendingBank, CompanyCode, BankStatement, StatementId, HeaderStatus
   - Verify "Item Data" tab shows table with all item-level fields

### Expected Behavior:
- ✅ RULE-004 API should be called ONLY for POSTED runs
- ✅ Data should come fresh from SAP every time (no caching)
- ✅ Changes in SAP should reflect immediately in BTP UI
- ✅ BTP logs should show all field values with clear labels

---

## 🔍 **Debugging If Issues Occur**

### If 400 Error Persists:
1. Check BTP logs for the line: `📞 Calling RULE-004 SAP API`
2. Verify the `apiEndpoint` and `queryParams` logged
3. Confirm LockboxID is being correctly extracted and stripped

### If UI Not Showing Data:
1. Run `/app/sync_frontend.sh`
2. Delete `/app/backend/app/webapp/Component-preload.js`
3. Hard refresh browser (Ctrl+F5 or Shift+F5)
4. Check browser console for any JavaScript errors

### If Fields Not Displaying:
1. Check BTP logs to confirm SAP is returning data
2. Verify field names match exactly (case-sensitive)
3. Check both `transactionDialog` and `transactionDetailsDialog` if using arrow navigation

---

## 🎯 **Next Steps After Testing**

Once you test in BTP:
1. Share the complete BTP logs with both RULE-001 and RULE-004 outputs
2. Confirm if RULE-004 is working or if 400 error persists
3. Confirm if UI is displaying all fields correctly
4. Report any missing or incorrect field mappings
