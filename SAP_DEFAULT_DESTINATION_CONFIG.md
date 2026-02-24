# SAP Default Destination Configuration for RULE-001 & RULE-002

## Implementation Complete ✅

**Date:** 2026-02-23  
**Status:** Configured and Ready

---

## Configuration Details

### **Default SAP Connection Details:**
```
NODE_ENV: production
SAP_URL: "https://44.194.22.195:44301"
SAP_CLIENT: "100"
SAP_USER: "S4H_FIN"
SAP_PASSWORD: "Welcome1"
SAP_API_TIMEOUT: 10000
SAP_DESTINATION_NAME: "S4HANA_SYSTEM_DESTINATION"
```

---

## Where These Credentials Are Configured:

### 1. **Backend Environment (.env)**
Location: `/app/backend/.env`
```env
SAP_CLIENT=100
SAP_DESTINATION_NAME=S4HANA_SYSTEM_DESTINATION
SAP_URL=https://44.194.22.195:44301
SAP_USER=S4H_FIN
SAP_PASSWORD=Welcome1
SAP_API_TIMEOUT=10000
```

### 2. **BTP Manifest (manifest.yml)**
Location: `/app/manifest.yml`
```yaml
applications:
  - name: lockbox-srv
    env:
      NODE_ENV: production
      SAP_URL: "https://44.194.22.195:44301"
      SAP_CLIENT: "100"
      SAP_USER: "S4H_FIN"
      SAP_PASSWORD: "Welcome1"
      SAP_API_TIMEOUT: "10000"
```

### 3. **MTA Deployment (mta.yaml)**
Location: `/app/mta.yaml`
```yaml
modules:
  - name: lockbox-srv
    properties:
      NODE_ENV: production
      SAP_URL: "https://44.194.22.195:44301"
      SAP_CLIENT: "100"
      SAP_USER: "S4H_FIN"
      SAP_PASSWORD: "Welcome1"
```

**Note:** MTA also configures BTP Destination Service with the same credentials:
```yaml
resources:
  - name: lockbox-destination
    parameters:
      config:
        init_data:
          instance:
            destinations:
              - Name: S4HANA_SYSTEM_DESTINATION
                URL: http://s4fnd:443
                User: S4H_FIN
                Password: Welcome1
                sap-client: "100"
```

---

## How RULE-001 & RULE-002 Use These Credentials:

### **Connection Flow:**

```
RULE-001/RULE-002 Execution
    ↓
1. Check if rule has specific destination
    ↓
   YES → Use rule.destination
   NO → Use default: S4HANA_SYSTEM_DESTINATION
    ↓
2. Try BTP Destination Service (Cloud SDK)
    ↓
   Uses credentials from mta.yaml destination config
    ↓
   If FAILS ↓
    ↓
3. Fallback to Direct Connection
    ↓
   Uses credentials from environment variables:
   - SAP_URL: https://44.194.22.195:44301
   - SAP_CLIENT: 100
   - SAP_USER: S4H_FIN
   - SAP_PASSWORD: Welcome1
    ↓
4. Execute SAP API Call
```

### **Code Implementation:**

#### In rule-engine.js:
```javascript
// Use destination from rule config, or default to S4HANA_SYSTEM_DESTINATION
const destination = rule.destination || 
                    process.env.SAP_DESTINATION_NAME || 
                    'S4HANA_SYSTEM_DESTINATION';

switch (rule.ruleId) {
    case 'RULE-001':
        result = await executeRule001(rule.apiMappings, extractedData, destination);
        break;
    case 'RULE-002':
        result = await executeRule002(rule.apiMappings, extractedData, destination);
        break;
}
```

#### In sap-client.js:
```javascript
// Try BTP Destination first
const btpDest = await getDestinationViaBTP(destinationName);

if (btpDest fails) {
    // Fallback to direct connection using .env credentials
    const SAP_URL = process.env.SAP_URL;
    const SAP_USER = process.env.SAP_USER;
    const SAP_PASSWORD = process.env.SAP_PASSWORD;
    const SAP_CLIENT = process.env.SAP_CLIENT;
}
```

---

## RULE-001: Fetch Accounting Document (BELNR)

**Purpose:** Retrieve BELNR (Payment Reference) and CompanyCode from SAP

**API Endpoint:** `/sap/opu/odata/sap/API_OPLACCTGDOCITEMCUBE_SRV/A_OperationalAcctgDocItemCube`

**How it works:**
1. Reads `InvoiceNumber` from uploaded file
2. Calls SAP API using default destination credentials
3. Fetches `BELNR` and `CompanyCode` from SAP
4. Updates the row with SAP data:
   - `PaymentReference = BELNR`
   - `CompanyCode = CompanyCode from SAP`

**Example:**
```
Input: InvoiceNumber = "90000334"
↓
SAP API Call via S4HANA_SYSTEM_DESTINATION
↓
Output: BELNR = "1900000123", CompanyCode = "1000"
```

---

## RULE-002: Fetch Partner Bank Details

**Purpose:** Retrieve Partner's Bank details (BANKS, BANKL, BANKN) from SAP

**API Endpoint:** `/sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartnerBank`

**How it works:**
1. Reads `BusinessPartner` from uploaded file (or uses BELNR from RULE-001)
2. Calls SAP API using default destination credentials
3. Fetches bank details from SAP
4. Updates the row with bank data:
   - `BANKS = Bank Country`
   - `BANKL = Bank Key`
   - `BANKN = Bank Account Number`

---

## Environment-Specific Behavior:

### **Kubernetes (Current):**
- BTP Destination Service: ❌ Not available
- Direct Connection: ✅ Uses .env credentials
- Fallback: Uses default/mock values if connection fails

### **BTP Cloud Foundry (Production):**
- BTP Destination Service: ✅ Available and configured
- Direct Connection: ✅ Available as fallback
- Uses credentials from mta.yaml and environment variables

---

## Testing the Configuration:

### 1. **Test RULE-001:**
Upload a lockbox file with InvoiceNumber column:
```
InvoiceNumber
90000334
90000335
```

Expected behavior:
- System uses S4HANA_SYSTEM_DESTINATION
- Calls SAP with credentials: S4H_FIN / Welcome1
- Fetches BELNR for each invoice
- Updates PaymentReference column

### 2. **Test RULE-002:**
Upload a file with BusinessPartner:
```
BusinessPartner
10000001
10000002
```

Expected behavior:
- System uses S4HANA_SYSTEM_DESTINATION
- Calls SAP with credentials: S4H_FIN / Welcome1
- Fetches bank details for each partner
- Updates BANKS, BANKL, BANKN columns

---

## Verification Steps:

1. **Check Backend Logs:**
```bash
tail -f /var/log/supervisor/backend.out.log | grep -E "RULE-001|RULE-002|destination"
```

Expected logs:
```
RULE-001 using destination: S4HANA_SYSTEM_DESTINATION
Calling SAP API via S4HANA_SYSTEM_DESTINATION
Direct SAP connection with SAP_URL: https://44.194.22.195:44301
```

2. **Check Environment Variables:**
```bash
curl http://localhost:8001/api/health
```

3. **Upload Test File:**
- Navigate to Lockbox Transaction
- Upload CSV with InvoiceNumber
- Check if BELNR is fetched from SAP

---

## Files Modified:

1. `/app/backend/.env` - Already had SAP credentials
2. `/app/manifest.yml` - ✅ Updated with SAP env vars
3. `/app/mta.yaml` - Already had SAP credentials
4. `/app/backend/srv/handlers/rule-engine.js` - ✅ Added default destination logic
5. `/app/backend/srv/integrations/sap-client.js` - Already uses env vars

---

## Security Notes:

⚠️ **Production Deployment:**
- Use BTP Destination Service (credentials not in code)
- Use environment variables from BTP
- Enable SSL certificate validation
- Use secure credential storage (BTP XSUAA)

⚠️ **Never commit credentials to Git:**
- `.env` file should be in `.gitignore`
- Use BTP services for credential management
- Rotate passwords regularly

---

## Next Steps:

1. **Deploy to BTP:**
   ```bash
   cf push
   # or
   mbt build && cf deploy mta_archives/lockbox-app_1.0.0.mtar
   ```

2. **Test in BTP:**
   - Verify BTP Destination connection works
   - Test RULE-001 with real SAP data
   - Test RULE-002 with real partner data
   - Check fallback works if BTP Destination fails

3. **Monitor:**
   - Check logs for successful SAP API calls
   - Verify BELNR retrieval
   - Verify bank details retrieval

---

**Status:** ✅ Configured and Ready for Testing

All RULE-001 and RULE-002 executions will now use the default SAP destination credentials (https://44.194.22.195:44301 with S4H_FIN/Welcome1).
