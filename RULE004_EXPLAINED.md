# RULE-004 Logic Explanation

## Overview
RULE-004 is used to fetch accounting document details from SAP after a lockbox production run is completed. Unlike RULE-001 and RULE-002 (which enrich data during file upload), RULE-004 is called **after** posting to retrieve the results.

---

## Two Different Usage Patterns

### Pattern 1: During Production Run (POST endpoint)
**Location:** `server.js` lines 2533-2616  
**Trigger:** Automatically called after successful production run (RULE-003)  
**Purpose:** Fetch clearing documents immediately after posting

```javascript
// Called inside POST /api/lockbox endpoint after RULE-003 succeeds
if (productionResponse.status === 'SUCCESS' && header.lockbox) {
    // Fetch RULE-004 configuration
    const rule004 = await getRuleById('RULE-004');
    
    // Build query with lockbox ID
    const queryParams = {
        $filter: `LockBoxId eq '${header.lockbox}'`
    };
    
    // Call SAP API
    const rule004Response = await sapClient.executeSapGetRequest(
        destination,
        apiEndpoint,
        queryParams
    );
}
```

### Pattern 2: Transaction Dialog (GET endpoint)
**Location:** `server.js` lines 5321-5411  
**Endpoint:** `GET /api/lockbox/:runId/accounting-document`  
**Trigger:** Called from frontend when user clicks "Show Transaction Details"  
**Purpose:** Fetch documents for display in Transaction Dialog

```javascript
app.get('/api/lockbox/:runId/accounting-document', async (req, res) => {
    const { runId } = req.params;
    
    // Get the run data
    const run = runs.find(r => r.runId === runId);
    const lockboxId = run.lockboxId || run.runId;
    
    // Get RULE-004 configuration
    const rule004 = processingRules.find(r => r.ruleId === 'RULE-004');
    
    // Build query filter with lockbox ID
    const queryParams = {
        '$filter': `LockboxBatchOrigin eq '${lockboxId}'`,
        '$select': 'DocumentNumber,PaymentAdvice,SubledgerDocument,AccountingDocument,CompanyCode,FiscalYear'
    };
    
    // Call SAP API
    const response = await sapClient.executeSapGetRequest(
        rule004.destination,
        apiEndpoint,
        queryParams
    );
    
    // Return documents to frontend
    res.json({
        success: true,
        lockboxId: lockboxId,
        documents: response.data.value
    });
});
```

---

## RULE-004 Configuration

### From processing_rules.json:
```json
{
  "ruleId": "RULE-004",
  "ruleName": "Get Accounting Document",
  "apiMappings": [
    {
      "sourceType": "OData V4",
      "destination": "S4HANA_SYSTEM_DESTINATION",
      "httpMethod": "GET",
      "apiReference": "/sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT"
    }
  ],
  "fieldMappings": [
    {
      "sourceField": "LockBox ID",
      "targetField": "DocumentNumber",
      "apiField": "DocumentNumber"
    },
    {
      "sourceField": "LockBox ID",
      "targetField": "PaymentAdvice",
      "apiField": "PaymentAdvice"
    },
    {
      "sourceField": "LockBox ID",
      "targetField": "SubledgerDocument",
      "apiField": "SubledgerDocument"
    },
    {
      "sourceField": "LockBox ID",
      "targetField": "AccountingDocument",
      "apiField": "AccountingDocument"
    }
  ]
}
```

---

## How Lockbox ID is Used

### Step-by-Step Flow:

**1. User uploads file → Production run starts**
```
POST /api/lockbox
Body: { header: { lockbox: "LB20260318001" }, invoices: [...] }
```

**2. RULE-003 posts data to SAP**
```
Production response includes lockbox ID in the SAP response
```

**3. RULE-004 queries SAP with lockbox ID**
```javascript
// Build filter query
const queryParams = {
    '$filter': `LockboxBatchOrigin eq 'LB20260318001'`  // ← Using lockbox ID
};

// API call becomes:
GET /sap/opu/odata4/.../ZFI_I_ACC_BANK_STMT?$filter=LockboxBatchOrigin eq 'LB20260318001'
```

**4. SAP returns all documents for that lockbox batch**
```json
{
  "value": [
    {
      "DocumentNumber": "5100000123",
      "PaymentAdvice": "PA001",
      "SubledgerDocument": "SD001",
      "AccountingDocument": "9400000440",
      "CompanyCode": "1710",
      "FiscalYear": "2026",
      "LockboxBatchOrigin": "LB20260318001"  // ← Filter matched this
    }
  ]
}
```

**5. Frontend displays in Transaction Dialog**
```
User sees table with all documents posted for that lockbox run
```

---

## Key Differences from RULE-001/RULE-002

| Aspect | RULE-001/002 | RULE-004 |
|--------|--------------|----------|
| **When Called** | During file upload (before posting) | After production run (after posting) |
| **Purpose** | Enrich/validate data | Retrieve posted documents |
| **Input** | Excel row data (Invoice #, Customer #) | Lockbox ID |
| **Filter Type** | Single entity lookup | Batch query ($filter) |
| **Engine** | rule-engine.js | Direct in server.js |
| **Response** | Single entity | Multiple documents (array) |
| **Stores Data** | Updates Excel row | Returns to frontend |

---

## Example API Calls

### RULE-001 (Enrich single invoice):
```
GET .../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='0090003904')/Set
→ Returns single accounting document for that invoice
```

### RULE-004 (Fetch all documents for lockbox):
```
GET .../ZFI_I_ACC_BANK_STMT?$filter=LockboxBatchOrigin eq 'LB20260318001'
→ Returns all documents posted under that lockbox ID
```

---

## Frontend Integration

### Transaction Dialog in Main.controller.js:
```javascript
onShowTransactionDetails: function(oEvent) {
    const runId = this.selectedRunId;
    
    // Call RULE-004 endpoint
    fetch(`/api/lockbox/${runId}/accounting-document`)
        .then(response => response.json())
        .then(data => {
            // Display documents in dialog
            this.transactionModel.setProperty("/documents", data.documents);
            this.transactionDialog.open();
        });
}
```

---

## Summary

**RULE-004 uses the Lockbox ID as a filter parameter** to query SAP for all accounting documents that belong to that batch. It's not enriching individual rows like RULE-001/002, but rather fetching a result set of posted documents for display purposes.

The key SAP field is `LockboxBatchOrigin` which contains the lockbox ID and allows SAP to return all related documents in a single query.
