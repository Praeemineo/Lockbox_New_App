# RULE-001 Testing Guide - Document Number 90000334

## Test Objective:
Test RULE-001 to fetch **BELNR** (Accounting Document Number) and **Company Code** from SAP S/4HANA for invoice number **90000334**.

---

## RULE-001 Configuration:

### **Rule Details:**
- **Rule ID:** RULE-001
- **Rule Name:** Accounting Document Lookup
- **Description:** Fetch accounting document details from SAP using invoice number
- **Destination:** S4HANA_SYSTEM_DESTINATION
- **API Endpoint:** `/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT`

### **API Mappings:**

**Mapping 1: Fetch BELNR**
```json
{
  "httpMethod": "GET",
  "apiReference": "/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT",
  "destination": "S4HANA_SYSTEM_DESTINATION",
  "inputField": "P_Documentnumber",
  "sourceInput": "InvoiceNumber",
  "outputField": "BELNR",
  "lockboxApiField": "Paymentreference"
}
```

**Mapping 2: Fetch Company Code**
```json
{
  "httpMethod": "GET",
  "apiReference": "/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT",
  "destination": "S4HANA_SYSTEM_DESTINATION",
  "inputField": "P_Documentnumber",
  "sourceInput": "InvoiceNumber",
  "outputField": "CompanyCode",
  "lockboxApiField": "CompanyCode"
}
```

---

## SAP Connection Details:

**From mta.yaml:**
```yaml
SAP_URL: "https://44.194.22.195:44301"
SAP_CLIENT: "100"
SAP_USER: "S4H_FIN"
SAP_PASSWORD: "Welcome1"
SAP_DESTINATION_NAME: "S4HANA_SYSTEM_DESTINATION"
```

**Expected SAP API Call:**
```
GET https://44.194.22.195:44301/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT?$filter=P_Documentnumber eq '90000334'&$select=BELNR,CompanyCode
```

---

## Test Methods:

### **Method 1: Upload CSV File via UI**

**Step 1: Create Test CSV**
Create file: `test_rule001.csv`
```csv
InvoiceNumber,Amount,Currency,CustomerNumber
90000334,1500.00,USD,10000001
```

**Step 2: Upload to Lockbox Transaction**
1. Navigate to: https://sap-integrator-1.preview.emergentagent.com (or BTP URL)
2. Click "Lockbox Transaction"
3. Click "Upload File"
4. Select `test_rule001.csv`
5. System will:
   - Parse the file
   - Match pattern
   - Execute RULE-001 for validation
   - Call SAP API for invoice 90000334

**Step 3: Check Results**
Look for the processing result showing:
- **BELNR** field populated with value from SAP
- **Company Code** field populated with value from SAP
- Status: SUCCESS or FALLBACK

---

### **Method 2: Test via Backend API (Direct)**

**Using curl:**
```bash
# Set the backend URL
API_URL="https://sap-integrator-1.preview.emergentagent.com"

# Test RULE-001 directly
curl -X POST "$API_URL/api/lockbox/test-rule" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "RULE-001",
    "testData": {
      "InvoiceNumber": "90000334",
      "Amount": 1500.00,
      "Currency": "USD",
      "CustomerNumber": "10000001"
    }
  }'
```

**Expected Response (Success):**
```json
{
  "success": true,
  "enrichedData": {
    "InvoiceNumber": "90000334",
    "Amount": 1500.00,
    "Currency": "USD",
    "CustomerNumber": "10000001",
    "PaymentReference": "1900000123",  // ← BELNR from SAP
    "BELNR": "1900000123",
    "CompanyCode": "1000",              // ← Company Code from SAP
    "FiscalYear": "2026",
    "_rule001_status": "SUCCESS",
    "_rule001_message": "BELNR retrieved: 1900000123, CompanyCode: 1000"
  },
  "message": "RULE-001: Enriched 1 records, 0 errors"
}
```

**Expected Response (Fallback - SAP Unavailable):**
```json
{
  "success": true,
  "enrichedData": {
    "InvoiceNumber": "90000334",
    "Amount": 1500.00,
    "PaymentReference": "90000334",     // ← Fallback: Uses invoice number
    "BELNR": "90000334",
    "CompanyCode": "1710",              // ← Default company code
    "FiscalYear": "2026",
    "_rule001_status": "FALLBACK",
    "_rule001_message": "SAP unavailable - using invoice number as payment reference"
  },
  "message": "RULE-001: Enriched 0 records, 1 errors"
}
```

---

### **Method 3: Check Backend Logs**

**In BTP:**
```bash
cf logs lockbox-srv --recent | grep "RULE-001"
```

**Expected logs (Success):**
```
=== Executing RULE-001: Accounting Document Lookup (DYNAMIC with Destination) ===
RULE-001 using destination: S4HANA_SYSTEM_DESTINATION
RULE-001: Calling SAP API via S4HANA_SYSTEM_DESTINATION for Invoice 90000334
Dynamic SAP API Call via S4HANA_SYSTEM_DESTINATION: GET /sap/opu/odata4/...
✅ SAP API Success via S4HANA_SYSTEM_DESTINATION: GET /sap/opu/odata4/...
RULE-001 SUCCESS: Invoice 90000334 → BELNR 1900000123, CompanyCode 1710
```

**Expected logs (Fallback):**
```
=== Executing RULE-001: Accounting Document Lookup ===
RULE-001: Calling SAP API via S4HANA_SYSTEM_DESTINATION for Invoice 90000334
❌ SAP API Error: Connection timeout
RULE-001 FALLBACK: Invoice 90000334 - Connection timeout
```

---

## Test Data Flow:

```
1. CSV Upload: InvoiceNumber = 90000334
     ↓
2. Pattern Matching: Identifies correct pattern
     ↓
3. Data Extraction: extractedData = [{ InvoiceNumber: "90000334", ... }]
     ↓
4. Validation Stage: Executes RULE-001
     ↓
5. RULE-001 Execution:
   - Reads InvoiceNumber from row
   - Calls SAP API with P_Documentnumber = 90000334
   - API: GET .../ZFI_I_ACC_DOCUMENT?$filter=P_Documentnumber eq '90000334'
     ↓
6. SAP Connection Flow:
   a. Try BTP Destination Service (S4HANA_SYSTEM_DESTINATION)
   b. If fails → Try Direct Connection (SAP_URL from mta.yaml)
   c. If fails → Use Fallback (invoice number as BELNR)
     ↓
7. Response Processing:
   - Extract BELNR from SAP response
   - Extract CompanyCode from SAP response
   - Update row:
     * PaymentReference = BELNR
     * CompanyCode = CompanyCode
     * _rule001_status = "SUCCESS"
     ↓
8. Return enriched data with BELNR and CompanyCode
```

---

## Expected SAP Response Format:

**OData v4 Response:**
```json
{
  "value": [
    {
      "BELNR": "1900000123",
      "CompanyCode": "1000",
      "FiscalYear": "2026",
      "DocumentDate": "2026-01-15",
      "PostingDate": "2026-01-15"
    }
  ]
}
```

**How RULE-001 extracts:**
- `outputField: "BELNR"` → Extracts value "1900000123"
- `outputField: "CompanyCode"` → Extracts value "1000"
- Maps to `lockboxApiField: "Paymentreference"` and `"CompanyCode"`

---

## Troubleshooting:

### **Issue 1: SAP Connection Timeout**
**Symptoms:**
- Logs show: "Connection timeout" or "ENOTFOUND"
- Status: FALLBACK
- BELNR = Invoice Number (not from SAP)

**Cause:**
- SAP server unreachable from current environment
- Network/firewall blocking connection

**Solution:**
- In BTP: Check SAP connectivity service
- Verify SAP_URL is accessible: `curl -k https://44.194.22.195:44301`
- Check firewall rules for port 44301

### **Issue 2: SAP Returns No Data**
**Symptoms:**
- Connection succeeds but no BELNR found
- Logs show: "No results from SAP"

**Cause:**
- Invoice number 90000334 doesn't exist in SAP
- Wrong API endpoint or parameters

**Solution:**
- Verify invoice exists in SAP: Transaction F-03
- Check OData service is active: Transaction /IWFND/MAINT_SERVICE
- Test API in browser: `https://44.194.22.195:44301/sap/opu/odata4/...`

### **Issue 3: Authentication Failed**
**Symptoms:**
- Logs show: "401 Unauthorized"

**Cause:**
- Wrong SAP credentials

**Solution:**
- Verify credentials in mta.yaml:
  - SAP_USER: S4H_FIN
  - SAP_PASSWORD: Welcome1
  - SAP_CLIENT: 100

---

## Success Criteria:

✅ **Test Passes If:**
1. RULE-001 executes without errors
2. SAP API call succeeds (HTTP 200)
3. BELNR value retrieved from SAP (not fallback)
4. CompanyCode value retrieved from SAP
5. Enriched data contains correct values
6. Logs show "RULE-001 SUCCESS"

❌ **Test Fails If:**
- SAP connection fails (acceptable if SAP unavailable)
- BELNR = Invoice Number (fallback mode)
- Logs show "RULE-001 FALLBACK"

**Note:** Fallback mode is EXPECTED in Kubernetes environment. Only test full success in BTP.

---

## Test Results Template:

```
Test Date: _________________
Environment: [ ] Kubernetes  [ ] BTP
Invoice Number: 90000334

Results:
[ ] File uploaded successfully
[ ] RULE-001 executed
[ ] SAP connection: [ ] Success  [ ] Failed
[ ] BELNR retrieved: _______________
[ ] CompanyCode retrieved: _______________
[ ] Status: [ ] SUCCESS  [ ] FALLBACK

Notes:
_________________________________
_________________________________
```

---

**Status:** Ready for testing in BTP environment with live SAP connection.
