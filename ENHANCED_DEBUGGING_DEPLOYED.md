# Enhanced SAP Connection Debugging - Deployment Guide

## Changes Made

### 1. Enhanced Error Logging in extractSapODataError()
Added comprehensive logging to capture the raw SAP Cloud SDK error object structure:
- Logs all error object keys
- Logs error name, message, and stack trace
- Attempts to serialize the full error object as JSON
- Logs presence of response, cause, and rootCause properties

Location: `/app/backend/server.js` - Line ~893

### 2. Destination Service Pre-Check
Added destination resolution check BEFORE making the SAP API call:
- Attempts to resolve the destination using `getDestination()`
- Logs destination URL, ProxyType, and Authentication type
- Captures destination resolution errors separately

Location: `/app/backend/server.js` - Line ~985

## Root Cause Identified by Troubleshoot Agent

**Issue**: The "HTTP null" error occurs when SAP Cloud SDK fails to establish an HTTP connection to the on-premise SAP system. The failure happens at the BTP level (destination service or Cloud Connector) BEFORE any HTTP request reaches the target SAP system.

**Possible Causes**:
1. Destination configuration issues (wrong URL, missing credentials)
2. Cloud Connector connectivity problems
3. Service binding configuration errors
4. Authentication credential issues

## Next Steps for Deployment

### Step 1: Build the MTA Archive
```bash
cd /app
npm install -g mbt
mbt build
```

### Step 2: Deploy to BTP
```bash
cf deploy mta_archives/lockbox-app_1.0.0.mtar
```

### Step 3: Verify Services are Bound
```bash
cf services
cf env lockbox-srv
```

Check that these services appear in VCAP_SERVICES:
- lockbox-destination
- lockbox-connectivity  
- lockbox-db
- lockbox-xsuaa

### Step 4: Trigger the SAP API Call
Use the production endpoint to trigger a SAP POST request:
```
POST /api/lockbox/runs/:runId/production
```

### Step 5: Capture Enhanced Logs
```bash
cf logs lockbox-srv --recent | grep -A 50 "SAP API CALL"
```

Look for:
- **DESTINATION SERVICE CHECK** section - Will show if destination can be resolved
- **RAW SAP SDK ERROR OBJECT** section - Will show complete error structure
- Destination URL, ProxyType, Authentication details

## Expected Log Output

If destination resolution fails, you'll see:
```
=== DESTINATION SERVICE CHECK ===
CRITICAL: Failed to resolve destination!
Destination Error: [error message]
```

If destination resolves but HTTP call fails, you'll see:
```
=== DESTINATION SERVICE CHECK ===
Destination resolved successfully!
Destination URL: https://your-sap-system:port
...
=== RAW SAP SDK ERROR OBJECT ===
Error Object Keys: [...]
Error Name: [...]
Error Message: [...]
```

## Known Configuration Issues

### Issue 1: Placeholder URL in mta.yaml
Line 83 in `/app/mta.yaml` has:
```yaml
URL: https://your-sap-system:port
```

**This needs to be updated with the actual SAP system URL!**

### Issue 2: Missing Credentials
The mta.yaml comment states "Credentials will be provided during deployment" but they may not be configured in the BTP Destination.

## How to Fix Destination Configuration in BTP

1. Go to BTP Cockpit
2. Navigate to: Connectivity → Destinations
3. Find destination: `S4HANA_SYSTEM_DESTINATION`
4. Verify/Update:
   - **URL**: Your actual SAP S/4HANA system URL
   - **Proxy Type**: OnPremise
   - **Authentication**: BasicAuthentication
   - **User**: SAP username
   - **Password**: SAP password
   - **sap-client**: 100 (or your client number)

5. Save and test the destination using the "Check Connection" button

## Alternative: Update Destination via BTP CLI

Create a destination configuration file:
```json
{
  "Name": "S4HANA_SYSTEM_DESTINATION",
  "Type": "HTTP",
  "URL": "https://your-actual-sap-system:port",
  "Authentication": "BasicAuthentication",
  "ProxyType": "OnPremise",
  "User": "your-sap-username",
  "Password": "your-sap-password"
}
```

Then update using CF CLI service key or BTP Destination Service REST API.

## After Deployment: Action Items

1. Check if enhanced logs appear in `cf logs lockbox-srv --recent`
2. Analyze the DESTINATION SERVICE CHECK section
3. Analyze the RAW SAP SDK ERROR OBJECT section
4. Based on the detailed error, fix the destination configuration
5. Re-test the endpoint

## Contact Information

If destination configuration is correct in BTP Cockpit but still failing:
- Verify Cloud Connector is running and properly configured
- Check Cloud Connector access control for the backend system
- Verify network connectivity between Cloud Connector and SAP system
- Check SAP system firewall rules

---

**Status**: Ready for deployment with enhanced debugging
**Next Action**: User needs to build, deploy, and trigger the SAP call to capture enhanced logs
