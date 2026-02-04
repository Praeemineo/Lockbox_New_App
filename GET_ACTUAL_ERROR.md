# 🔍 Get Actual Error Details from BTP Logs

Since Cloud Connector is working and the destination pings, we need to see the **actual error** from the SAP Cloud SDK.

## Step 1: Tail Live Logs During Test

Open two terminal windows:

### Terminal 1: Stream Logs
```bash
cf logs lockbox-srv
```

### Terminal 2: Trigger the Error
```bash
# Use your app to POST to SAP with useMock=false
# Or via curl/Postman
```

**Watch Terminal 1 for the actual error message**

---

## Step 2: Get Recent Error Details

```bash
cf logs lockbox-srv --recent > /tmp/sap_error_logs.txt
```

Then look for:
```bash
grep -A 50 "SAP API ERROR" /tmp/sap_error_logs.txt
grep -A 50 "SAP API CALL" /tmp/sap_error_logs.txt
grep -A 20 "executeHttpRequest" /tmp/sap_error_logs.txt
```

---

## Step 3: Check What's Actually Being Sent

Look for these specific log lines:
```
=== SAP API CALL (BTP Destination via Cloud SDK) ===
Destination: S4HANA_SYSTEM_DESTINATION
URL: /sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch
sap-client: 100
Payload: { ... }
```

Then look for the error:
```
=== SAP API ERROR (STEP1_POST) ===
HTTP Status: ???
SAP Error Message: ???
```

---

## Step 4: Check Destination Service Logs

The SAP Cloud SDK might be failing before even reaching Cloud Connector.

```bash
# Check if destination service credentials are available
cf env lockbox-srv | grep -A 100 '"destination"'
```

**Expected output:**
```json
{
  "destination": [{
    "label": "destination",
    "credentials": {
      "clientid": "...",
      "clientsecret": "...",
      "uri": "https://destination-configuration...",
      "url": "...",
      "xsappname": "..."
    }
  }]
}
```

**If you see `[]` or no destination key:** The service is not bound!

---

## Step 5: Test Destination Service Directly

Try accessing the destination service API:

```bash
# Get destination service URL from VCAP_SERVICES
DEST_URL=$(cf env lockbox-srv | grep '"uri"' | grep destination | cut -d'"' -f4)
echo "Destination Service URL: $DEST_URL"

# Get access token (you'll need clientid/secret from VCAP_SERVICES)
```

---

## Common Issues Based on "HTTP null"

### Issue A: Destination Service Returns No Response

**Symptom:** No HTTP status code at all

**Cause:** SAP Cloud SDK couldn't connect to destination service

**Check:**
```bash
cf env lockbox-srv | grep destination
```

If empty or `[]`, the service is not bound.

**Fix:**
```bash
cf bind-service lockbox-srv lockbox-destination
cf restage lockbox-srv
```

---

### Issue B: Destination Not Found by SDK

**Symptom:** Error message contains "destination not found"

**Cause:** Destination name mismatch

**Check in BTP Cockpit:**
- Destination name MUST be exactly: `S4HANA_SYSTEM_DESTINATION`
- Case-sensitive
- No extra spaces

---

### Issue C: Authentication Failed

**Symptom:** 401 or 403 but SDK returns null

**Check in BTP Cockpit:**
- Destination → Edit → Check credentials
- Test Connection button
- Should show green checkmark

---

### Issue D: Proxy/Network Issue

**Symptom:** Timeout or connection refused

**Check:**
1. Cloud Connector status (you said it's green ✓)
2. System mapping in Cloud Connector
3. Access control rules in Cloud Connector

**Verify Path:**
In Cloud Connector → Access Control:
```
URL Path: /sap/opu/odata/sap/API_LOCKBOXPOST_IN
Access Policy: Path and all sub-paths
```

---

## Debugging Code Addition

Add this to server.js temporarily to see more details:

Find the `postToSapApi` function (around line 976) and add logging:

```javascript
async function postToSapApi(payload) {
    const url = SAP_API_PATH;
    
    console.log('=== SAP API CALL DEBUG ===');
    console.log('Destination:', SAP_DESTINATION_NAME);
    console.log('URL:', url);
    console.log('Full Request Config:', JSON.stringify({
        destinationName: SAP_DESTINATION_NAME,
        method: 'POST',
        url: url,
        params: { 'sap-client': SAP_CLIENT },
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }, null, 2));
    
    // Check if VCAP_SERVICES exists
    if (process.env.VCAP_SERVICES) {
        console.log('✓ VCAP_SERVICES exists');
        const vcap = JSON.parse(process.env.VCAP_SERVICES);
        console.log('Destination service bound:', !!vcap.destination);
        if (vcap.destination) {
            console.log('Destination service URI:', vcap.destination[0]?.credentials?.uri);
        }
    } else {
        console.log('✗ VCAP_SERVICES not found');
    }
    
    try {
        console.log('Calling executeHttpRequest...');
        const response = await executeHttpRequest(
            { destinationName: SAP_DESTINATION_NAME },
            {
                method: 'POST',
                url: url,
                params: {
                    'sap-client': SAP_CLIENT
                },
                data: payload,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('✓ SAP Response received');
        console.log('SAP Response Status:', response.status);
        console.log('SAP Response Data:', JSON.stringify(response.data, null, 2));
        
        return response;
        
    } catch (error) {
        console.log('✗ Error caught in postToSapApi');
        console.log('Error type:', error.constructor.name);
        console.log('Error message:', error.message);
        console.log('Has response:', !!error.response);
        console.log('Has rootCause:', !!error.rootCause);
        console.log('Has cause:', !!error.cause);
        
        // Log full error structure
        console.log('Full error object keys:', Object.keys(error));
        
        if (error.response) {
            console.log('error.response.status:', error.response.status);
            console.log('error.response.data:', error.response.data);
        }
        
        if (error.rootCause) {
            console.log('error.rootCause:', error.rootCause.message);
            if (error.rootCause.response) {
                console.log('error.rootCause.response.status:', error.rootCause.response.status);
            }
        }
        
        if (error.cause) {
            console.log('error.cause:', error.cause.message);
            if (error.cause.response) {
                console.log('error.cause.response.status:', error.cause.response.status);
            }
        }
        
        // Continue with normal error handling
        const structuredError = extractSapODataError(error);
        // ... rest of error handling
    }
}
```

---

## What to Share

After adding debug logging and redeploying, please share:

1. **Full logs from the POST attempt:**
```bash
cf logs lockbox-srv --recent | grep -A 100 "SAP API CALL DEBUG"
```

2. **VCAP_SERVICES destination part:**
```bash
cf env lockbox-srv | grep -A 30 '"destination"'
```

3. **Service bindings:**
```bash
cf services | grep lockbox
```

This will help us see exactly where the call is failing!
