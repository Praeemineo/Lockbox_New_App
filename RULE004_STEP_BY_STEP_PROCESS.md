# RULE-004 Complete Process - Step by Step

## Overview
RULE-004 fetches accounting document details from SAP using the LockboxID. It's called in **2 scenarios**.

---

## SCENARIO 1: Automatic Call After Production Run (RULE-003)

### Step 1: Production Run Completes Successfully
**Location:** `/app/backend/server.js` lines 2540-2650

**Trigger:**
```javascript
POST /api/lockbox
Body: {
  header: { lockbox: "1000073-0", ... },
  invoices: [...]
}
```

**Flow:**
```
1. User uploads Excel file
2. Backend validates data
3. RULE-003 posts to SAP (Production Run)
4. SAP returns: { status: "SUCCESS", lockbox_id: "1000073" }
5. Check: if (productionResponse.status === 'SUCCESS' && header.lockbox)
6. → RULE-004 is triggered automatically
```

### Step 2: Extract and Clean LockboxID
**Code:** Lines 2542-2555

```javascript
console.log('=== RETRIEVING CLEARING DOCUMENTS (RULE-004) ===');

// Get lockbox ID from header
let lockboxIdForRule004 = header.lockbox;  // "1000073-0"

// Strip hyphen and suffix
if (lockboxIdForRule004 && lockboxIdForRule004.includes('-')) {
    const originalLockboxId = lockboxIdForRule004;
    lockboxIdForRule004 = lockboxIdForRule004.split('-')[0];  // "1000073"
    console.log(`📝 Stripped lockboxId: "${originalLockboxId}" → "${lockboxIdForRule004}"`);
}

console.log('Lockbox ID:', lockboxIdForRule004);  // "1000073"
```

**Result:** `lockboxIdForRule004 = "1000073"`

### Step 3: Fetch RULE-004 Configuration from Database
**Code:** Lines 2547-2550

```javascript
// Get RULE-004 rule definition
const rule004 = await getRuleById('RULE-004');
console.log('RULE-004 found:', !!rule004);

// Extract API configuration
const getAccountingDocApi = getApiConfig(rule004, 'GET');
console.log('API Config found:', !!getAccountingDocApi);
```

**RULE-004 Configuration (from database):**
```json
{
  "ruleId": "RULE-004",
  "ruleName": "Get Accounting Document",
  "destination": "S4HANA_SYSTEM_DESTINATION",
  "apiMappings": [{
    "httpMethod": "GET",
    "apiReference": "/sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT",
    "inputField": "LockBoxId",
    "outputField": "LockBoxId,SendingBank,BankStatement,StatementId,CompanyCode,HeaderStatus,BankStatementItem,DocumentNumber,PaymentAdvice,SubledgerDocument,SubledgerOnaccountDocument,Amount,TransactionCurrency,DocumentStatus"
  }]
}
```

### Step 4: Build API Query Parameters
**Code:** Lines 2557-2570

```javascript
const apiEndpoint = getAccountingDocApi.apiReference;
const destination = getAccountingDocApi.destination || 'S4HANA_SYSTEM_DESTINATION';
const inputFieldName = getAccountingDocApi.inputField || 'LockBoxId';

// Build OData filter
const queryParams = {
    $filter: `${inputFieldName} eq '${lockboxIdForRule004}'`  // "LockBoxId eq '1000073'"
};

// Build select clause
const outputFields = getAccountingDocApi.outputField.split(',').map(f => f.trim());
if (outputFields.length > 0) {
    queryParams.$select = outputFields.join(',');
}

console.log('Query Params:', queryParams);
```

**Resulting Query:**
```javascript
{
  "$filter": "LockBoxId eq '1000073'",
  "$select": "LockBoxId,SendingBank,BankStatement,StatementId,CompanyCode,HeaderStatus,BankStatementItem,DocumentNumber,PaymentAdvice,SubledgerDocument,SubledgerOnaccountDocument,Amount,TransactionCurrency,DocumentStatus"
}
```

### Step 5: Call SAP API
**Code:** Lines 2572-2580

```javascript
console.log('Calling RULE-004 API:', apiEndpoint);

const rule004Response = await sapClient.executeSapGetRequest(
    destination,
    apiEndpoint,
    queryParams
);

console.log('✅ SAP Response received');
```

**Full API Call:**
```
GET https://44.196.95.84:44301/sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT
    ?sap-client=100
    &$filter=LockBoxId eq '1000073'
    &$select=LockBoxId,SendingBank,BankStatement,StatementId,CompanyCode,HeaderStatus,BankStatementItem,DocumentNumber,PaymentAdvice,SubledgerDocument,SubledgerOnaccountDocument,Amount,TransactionCurrency,DocumentStatus

Headers:
    Authorization: Basic [base64(S4H_FIN:Welcome1)]
```

### Step 6: Process SAP Response
**Code:** Lines 2582-2600

```javascript
const clearingDocuments = rule004Response.data.value || [];
console.log(`✓ Retrieved ${clearingDocuments.length} clearing documents from SAP`);

// Format documents for storage
const formattedClearingDocuments = clearingDocuments.map((doc, index) => ({
    item: (index + 1).toString(),
    LockBoxId: doc.LockBoxId || '',
    SendingBank: doc.SendingBank || '',
    BankStatement: doc.BankStatement || '',
    StatementId: doc.StatementId || '',
    CompanyCode: doc.CompanyCode || '',
    HeaderStatus: doc.HeaderStatus || '',
    BankStatementItem: doc.BankStatementItem || '',
    DocumentNumber: doc.DocumentNumber || '',
    PaymentAdvice: doc.PaymentAdvice || '',
    SubledgerDocument: doc.SubledgerDocument || '',
    SubledgerOnaccountDocument: doc.SubledgerOnaccountDocument || '',
    Amount: doc.Amount || 0,
    TransactionCurrency: doc.TransactionCurrency || 'USD',
    DocumentStatus: doc.DocumentStatus || ''
}));

console.log(`✓ Formatted ${formattedClearingDocuments.length} clearing documents`);
```

**Example SAP Response:**
```json
{
  "data": {
    "value": [
      {
        "LockBoxId": "1000073",
        "SendingBank": "SAMPLEDEST 1234567890",
        "BankStatement": "60",
        "StatementId": "1000073 260318 0000",
        "CompanyCode": "0001",
        "HeaderStatus": "Processed",
        "BankStatementItem": "1",
        "DocumentNumber": "5100000123",
        "PaymentAdvice": "01000000600002",
        "SubledgerDocument": "SD001",
        "SubledgerOnaccountDocument": "SA001",
        "Amount": 900.00,
        "TransactionCurrency": "USD",
        "DocumentStatus": "Posted"
      },
      {
        "LockBoxId": "1000073",
        "BankStatementItem": "2",
        "DocumentNumber": "5100000124",
        "Amount": 1200.00,
        "DocumentStatus": "Posted"
      }
    ]
  }
}
```

### Step 7: Store Documents in Run Object
**Code:** Lines 2636-2650

```javascript
console.log('=== SAVING CLEARING DOCUMENTS TO RUN ===');

// Find the run in lockboxProcessingRuns array
const runIndex = lockboxProcessingRuns.findIndex(r => r.runId === runId);

if (runIndex >= 0) {
    // Store documents in run
    lockboxProcessingRuns[runIndex].clearingDocuments = formattedClearingDocuments;
    lockboxProcessingRuns[runIndex].clearingDocumentsTimestamp = new Date().toISOString();
    
    // Save to file for persistence
    saveRunsToFile();
    
    console.log(`✓ Clearing documents saved to run: ${runId}`);
}

// Include in API response
finalResponse.clearingDocuments = formattedClearingDocuments;
```

**Run Object After Storage:**
```json
{
  "runId": "RUN-2026-00175",
  "lockboxId": "1000073",
  "status": "posted",
  "clearingDocuments": [
    {
      "item": "1",
      "LockBoxId": "1000073",
      "SendingBank": "SAMPLEDEST 1234567890",
      "DocumentNumber": "5100000123",
      "Amount": 900.00,
      ...
    }
  ],
  "clearingDocumentsTimestamp": "2026-03-18T10:30:00.000Z"
}
```

### Step 8: Return Response to Frontend
**Code:** Line 2650+

```javascript
return res.status(200).json({
    success: true,
    runId: runId,
    status: 'posted',
    clearingDocuments: formattedClearingDocuments,
    productionResponse: productionResponse
});
```

---

## SCENARIO 2: Manual Call via Transaction Dialog

### Step 1: User Clicks Navigation Arrow
**Location:** Frontend → `/app/frontend/public/webapp/controller/Main.controller.js` line 7451

**Trigger:**
```
User navigates to "Lockbox Transaction" page
Clicks navigation arrow (→) in table row
```

**Code:**
```javascript
onRowPress: function(oEvent) {
    var oItem = oEvent.getSource();
    var oContext = oItem.getBindingContext("app");
    if (oContext) {
        var oData = oContext.getObject();  // Get run data
        
        // Call transaction details function
        this.onShowTransactionDetails({
            getSource: function() {
                return {
                    getBindingContext: function() { return oContext; }
                };
            }
        });
    }
}
```

### Step 2: Fetch RULE-004 Data via API
**Location:** Controller line 8384+

**Code:**
```javascript
onShowTransactionDetails: function (oEvent) {
    var that = this;
    var oContext = oEvent.getSource().getBindingContext("app");
    var oRun = oContext.getObject();
    var runId = oRun.runId;  // "RUN-2026-00175"
    
    var API_BASE = window.location.origin;
    
    // Fetch run details and RULE-004 data in parallel
    Promise.all([
        fetch(API_BASE + "/api/lockbox/runs/" + runId).then(res => res.json()),
        fetch(API_BASE + "/api/lockbox/" + runId + "/accounting-document").then(res => res.json())
    ]).then(function (results) {
        var runData = results[0];
        var rule004Data = results[1];
        
        // Process and display data...
    });
}
```

**API Call:**
```
GET /api/lockbox/RUN-2026-00175/accounting-document
```

### Step 3: Backend Processes Request
**Location:** `/app/backend/server.js` line 5331+

**Code:**
```javascript
app.get('/api/lockbox/:runId/accounting-document', async (req, res) => {
    const { runId } = req.params;  // "RUN-2026-00175"
    const { refresh } = req.query;  // undefined or "true"
    
    console.log(`📋 RULE-004: Fetching accounting document for run ${runId} (refresh=${refresh || 'false'})`);
```

### Step 4: Find Run and Extract LockboxID
**Code:** Lines 5338-5380

```javascript
// STEP 1: Get run data
let run = lockboxProcessingRuns.find(r => r.runId === runId);
if (!run) {
    run = runs.find(r => r.runId === runId);
}

if (!run) {
    return res.status(404).json({ error: 'Run not found' });
}

// STEP 2: Extract LockboxID (try multiple field names)
let lockboxId = run.lockboxId || 
                run.lockbox || 
                run.lockbox_id || 
                run.lockboxBatchOrigin ||
                run.lockbox_batch_origin;

// CRITICAL: Validate lockboxId exists
if (!lockboxId) {
    console.error(`❌ No LockboxID found in run:`, Object.keys(run));
    return res.status(400).json({
        success: false,
        error: 'LockboxID not found in run data',
        availableFields: Object.keys(run)
    });
}

// STEP 3: Strip hyphen if present
if (lockboxId && lockboxId.includes('-')) {
    const originalLockboxId = lockboxId;
    lockboxId = lockboxId.split('-')[0];  // "1000073-0" → "1000073"
    console.log(`📝 Stripped lockboxId: "${originalLockboxId}" → "${lockboxId}"`);
}

console.log(`✅ Using LockboxId: ${lockboxId} (NOT runId: ${runId})`);
```

### Step 5: Check for Cached Data
**Code:** Lines 5366-5376

```javascript
// STEP 4: Check if documents already stored (skip SAP call)
if (run.clearingDocuments && run.clearingDocuments.length > 0 && !refresh) {
    console.log(`✅ Using stored RULE-004 data (${run.clearingDocuments.length} documents)`);
    console.log(`💾 Data source: Run storage (no SAP call needed)`);
    
    return res.json({
        success: true,
        lockboxId: lockboxId,
        documents: run.clearingDocuments,
        source: 'stored',
        storedAt: run.clearingDocumentsTimestamp
    });
}
```

### Step 6: If Not Cached, Fetch from SAP
**Code:** Lines 5378-5420

```javascript
console.log(`🔄 Fetching fresh data from SAP`);

// Get RULE-004 configuration
const rule004 = processingRules.find(r => r.ruleId === 'RULE-004');
const apiEndpoint = rule004.apiMappings[0].apiReference;

// Build query
const queryParams = {
    '$filter': `LockBoxId eq '${lockboxId}'`,  // "LockBoxId eq '1000073'"
    '$select': 'LockBoxId,SendingBank,BankStatement,...',
    '$top': '100'
};

console.log(`API Endpoint: ${apiEndpoint}`);
console.log(`Query Params:`, queryParams);

// Call SAP
const response = await sapClient.executeSapGetRequest(
    rule004.destination,
    apiEndpoint,
    queryParams
);

console.log(`✅ SAP Response received`);
const documents = response.data.value || [];
console.log(`📊 Found ${documents.length} document(s)`);
```

### Step 7: Format and Store Response
**Code:** Lines 5422-5450

```javascript
// Map SAP response to frontend format
const mappedData = documents.map((doc, index) => ({
    item: (index + 1).toString(),
    LockBoxId: doc.LockBoxId || '',
    SendingBank: doc.SendingBank || '',
    BankStatement: doc.BankStatement || '',
    StatementId: doc.StatementId || '',
    CompanyCode: doc.CompanyCode || '',
    HeaderStatus: doc.HeaderStatus || '',
    BankStatementItem: doc.BankStatementItem || '',
    DocumentNumber: doc.DocumentNumber || '',
    PaymentAdvice: doc.PaymentAdvice || '',
    SubledgerDocument: doc.SubledgerDocument || '',
    SubledgerOnaccountDocument: doc.SubledgerOnaccountDocument || '',
    Amount: doc.Amount || 0,
    TransactionCurrency: doc.TransactionCurrency || 'USD',
    DocumentStatus: doc.DocumentStatus || ''
}));

// STEP 5: Store for future use
const runIndex = lockboxProcessingRuns.findIndex(r => r.runId === runId);
if (runIndex >= 0) {
    lockboxProcessingRuns[runIndex].clearingDocuments = mappedData;
    lockboxProcessingRuns[runIndex].clearingDocumentsTimestamp = new Date().toISOString();
    saveRunsToFile();
    console.log(`💾 Stored RULE-004 data to run for future use`);
}

// Return to frontend
res.json({
    success: true,
    lockboxId: lockboxId,
    documents: mappedData,
    source: 'sap',
    fetchedAt: new Date().toISOString()
});
```

### Step 8: Frontend Displays Data
**Location:** Controller lines 8765-8840

```javascript
// Process RULE-004 response
if (rule004Data.success && rule004Data.documents && rule004Data.documents.length > 0) {
    var firstDoc = rule004Data.documents[0];
    
    // STEP 1: Extract header fields from first document
    oTransaction.lockboxId = firstDoc.LockBoxId;
    oTransaction.sendingBank = firstDoc.SendingBank;
    oTransaction.companyCode = firstDoc.CompanyCode;
    oTransaction.bankStatement = firstDoc.BankStatement;
    oTransaction.statementId = firstDoc.StatementId;
    oTransaction.headerStatus = firstDoc.HeaderStatus;
    
    // STEP 2: Map all documents to item array
    oTransaction.lockboxItems = rule004Data.documents.map(function(doc, idx) {
        return {
            item: idx + 1,
            bankStatementItem: doc.BankStatementItem,
            postingDoc: doc.DocumentNumber,
            paytAdvice: doc.PaymentAdvice,
            clearingDoc: doc.SubledgerDocument,
            subledgerOnaccountDoc: doc.SubledgerOnaccountDocument,
            amount: doc.Amount,
            currency: doc.TransactionCurrency,
            documentStatus: doc.DocumentStatus
        };
    });
    
    // STEP 3: Set in model
    oModel.setProperty("/selectedTransaction", oTransaction);
    
    // STEP 4: Open dialog
    that.byId("transactionDetailsDialog").open();
}
```

### Step 9: Dialog Displays Data
**Location:** View `/app/frontend/public/webapp/view/Main.view.xml` lines 1375-1510

**Header Data Tab:**
```xml
<IconTabFilter text="Header Data">
    <Label text="Lockbox ID:"/>
    <Text text="{app>/selectedTransaction/lockboxId}"/>  <!-- "1000073" -->
    
    <Label text="Sending Bank:"/>
    <Text text="{app>/selectedTransaction/sendingBank}"/>  <!-- "SAMPLEDEST..." -->
    
    <Label text="Company Code:"/>
    <Text text="{app>/selectedTransaction/companyCode}"/>  <!-- "0001" -->
</IconTabFilter>
```

**Item Data Tab:**
```xml
<IconTabFilter text="Item Data">
    <Table items="{app>/selectedTransaction/lockboxItems}">
        <ColumnListItem>
            <Text text="{app>item}"/>  <!-- 1, 2, 3... -->
            <Text text="{app>postingDoc}"/>  <!-- "5100000123" -->
            <Text text="{app>paytAdvice}"/>  <!-- "01000000600002" -->
            <ObjectNumber number="{app>amount}" unit="{app>currency}"/>  <!-- "900.00 USD" -->
            <ObjectStatus text="{app>documentStatus}"/>  <!-- "Posted" -->
        </ColumnListItem>
    </Table>
</IconTabFilter>
```

---

## Summary: Complete RULE-004 Flow

```
┌─────────────────────────────────────────────────────────────┐
│ SCENARIO 1: Auto-fetch After Production                    │
└─────────────────────────────────────────────────────────────┘
  
  1. User uploads file → POST /api/lockbox
  2. RULE-003 posts to SAP → Success
  3. Extract lockboxId from header: "1000073-0"
  4. Strip hyphen: "1000073"
  5. Fetch RULE-004 config from database
  6. Build query: LockBoxId eq '1000073'
  7. Call SAP API → GET .../ZFI_I_ACC_BANK_STMT
  8. Process SAP response (documents array)
  9. Store in run.clearingDocuments
  10. Return to frontend


┌─────────────────────────────────────────────────────────────┐
│ SCENARIO 2: Manual Fetch via Transaction Dialog            │
└─────────────────────────────────────────────────────────────┘
  
  1. User clicks navigation arrow (→)
  2. Frontend: GET /api/lockbox/:runId/accounting-document
  3. Backend: Find run by runId
  4. Extract lockboxId from run (multiple fallbacks)
  5. Validate lockboxId exists (error if not)
  6. Strip hyphen if present
  7. Check if cached in run.clearingDocuments
     → If yes: Return cached data (fast)
     → If no: Continue to fetch from SAP
  8. Build query: LockBoxId eq '1000073'
  9. Call SAP API
  10. Format response
  11. Store in run for future use
  12. Return to frontend
  13. Frontend: Populate Header Data tab
  14. Frontend: Populate Item Data tab
  15. Dialog opens with data
```

---

## Key Points

✅ **Input:** LockboxID (e.g., "1000073"), NOT runId  
✅ **Source:** Extracted from `run.lockboxId` or `run.lockbox`  
✅ **Processing:** Hyphen stripped if present  
✅ **Caching:** Stored in `run.clearingDocuments` for instant reload  
✅ **API Filter:** `LockBoxId eq '1000073'`  
✅ **Response:** Array of documents with all fields  
✅ **Display:** Header Data (shared) + Item Data (per document)
