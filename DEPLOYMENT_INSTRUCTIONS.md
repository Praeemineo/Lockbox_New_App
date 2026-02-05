# SAP Lockbox Application - BTP Deployment Instructions

## Changes Summary

### 1. Added Dual Connection Strategy
The application now supports **TWO** methods to connect to SAP:
1. **Primary**: BTP Destination Service (via Cloud Connector for on-premise)
2. **Fallback**: Direct HTTPS connection using environment variables

**Location**: `/app/backend/server.js` - `postToSapApi()` function

### 2. Updated MTA Configuration
- Added SAP credentials as environment variables (properties)
- Added PostgreSQL connection details as environment variables
- Updated resource reference from `lockbox-db` to `postgresql-db`
- Reduced memory allocation to 256M (from 512M)
- Changed builder from `npm-ci` to `npm`

**Location**: `/app/mta.yaml`

### 3. Updated Backend Environment File
Added production credentials for local testing:
- PostgreSQL connection details
- SAP connection details (URL, User, Password)

**Location**: `/app/backend/.env`

### 4. Enhanced Error Logging
Added comprehensive debugging to capture:
- Raw SAP SDK error object
- Destination resolution attempts
- Complete error stack traces
- Fallback mechanism activation

## Deployment Steps

### Prerequisites
Ensure you have:
- CF CLI installed and logged in
- MBT (Multi-Target Application Build Tool) installed
- Access to SAP BTP Cloud Foundry space

### Step 1: Build the MTA Archive

```bash
cd /app

# Install MBT if not already installed
npm install -g mbt

# Build the MTA archive
mbt build
```

This will create: `/app/mta_archives/lockbox-app_1.0.0.mtar`

### Step 2: Deploy to BTP

```bash
# Deploy the application
cf deploy mta_archives/lockbox-app_1.0.0.mtar
```

**Expected output:**
```
Deploying multi-target app archive lockbox-app_1.0.0.mtar in org <org> / space <space>...
...
Application "lockbox-srv" started and available at "<url>"
```

### Step 3: Verify Service Bindings

```bash
# Check bound services
cf services

# Check environment variables
cf env lockbox-srv
```

**Expected services in VCAP_SERVICES:**
- `destination` (lockbox-destination)
- `connectivity` (lockbox-connectivity)
- `xsuaa` (lockbox-xsuaa)
- `postgresql` (postgresql-db)

### Step 4: Check Application Logs

```bash
# View recent logs
cf logs lockbox-srv --recent

# Stream live logs
cf logs lockbox-srv
```

### Step 5: Test the Application

#### Health Check
```bash
curl https://lockbox-srv.<cf-domain>/api/health
```

#### Trigger SAP Connection Test
Make a POST request to trigger production processing:
```bash
POST https://lockbox-srv.<cf-domain>/api/lockbox/runs/<runId>/production
```

## Expected Log Output

### Success Case (Destination Service)
```
=== SAP API CALL (BTP Destination via Cloud SDK) ===
Destination: S4HANA_SYSTEM_DESTINATION
...
=== DESTINATION SERVICE CHECK ===
Attempting to resolve destination: S4HANA_SYSTEM_DESTINATION
Destination resolved successfully!
Destination URL: http://s4fnd:443
Destination ProxyType: OnPremise
Destination Authentication: BasicAuthentication
=== END DESTINATION CHECK ===
SAP Response Status: 201
```

### Fallback Case (Direct Connection)
```
=== DESTINATION SERVICE CHECK ===
WARNING: Failed to resolve destination!
Will attempt fallback to direct connection using environment variables...
=== END DESTINATION CHECK ===
=== FALLBACK: Direct SAP Connection ===
Using direct connection to: https://44.194.22.195:44301
User: S4H_FIN
Full URL: https://44.194.22.195:44301/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch?sap-client=100
SAP Response Status (Direct): 201
```

## Troubleshooting

### Issue 1: Destination Service Fails

**Symptoms:**
```
WARNING: Failed to resolve destination!
Destination Error: Destination 'S4HANA_SYSTEM_DESTINATION' not found
```

**Solution:**
The fallback mechanism should automatically activate. Check logs for:
```
=== FALLBACK: Direct SAP Connection ===
```

If fallback also fails, verify SAP_URL, SAP_USER, SAP_PASSWORD are set in BTP environment.

### Issue 2: Cloud Connector Not Responding

**Symptoms:**
```
Destination resolved successfully!
Error: ETIMEDOUT or ECONNREFUSED
```

**Causes:**
1. Cloud Connector is not running
2. Cloud Connector is not configured for the backend system
3. Network/firewall issues between BTP and Cloud Connector

**Verification Steps:**
1. Log into Cloud Connector admin interface
2. Check "Access Control" for the backend system `s4fnd:443`
3. Verify Cloud Connector shows as "Connected" in BTP Cockpit
4. Check Cloud Connector logs for connection attempts

### Issue 3: Direct Fallback Fails

**Symptoms:**
```
=== FALLBACK: Direct SAP Connection ===
Error: certificate verify failed (self-signed certificate)
```

**Note:** The code includes `rejectUnauthorized: false` to handle self-signed certificates, but this might still fail in some environments.

**Solution:**
Ensure the SAP system is accessible from BTP:
```bash
# Test from BTP app
cf ssh lockbox-srv
curl -k https://44.194.22.195:44301
```

### Issue 4: Authentication Fails

**Symptoms:**
```
SAP Error: 401 Unauthorized
```

**Verification:**
1. Confirm credentials in BTP Destination:
   - User: S4H_FIN
   - Password: Welcome1
2. Confirm credentials in mta.yaml properties match
3. Test credentials directly using Postman/curl

## Important Notes

### Destination Configuration Mismatch

There are **TWO different SAP URLs** configured:

1. **BTP Destination URL**: `http://s4fnd:443` (internal hostname for Cloud Connector)
2. **Direct Connection URL**: `https://44.194.22.195:44301` (public IP address)

**When to use which:**
- **Cloud Connector (Destination)**: Use `http://s4fnd:443` - This is the **preferred** method for on-premise connectivity
- **Direct Connection (Fallback)**: Use `https://44.194.22.195:44301` - Only if destination service fails

### Security Considerations

**⚠️ WARNING:** The `mta.yaml` file contains SAP credentials in plain text. This is **NOT recommended** for production.

**Best Practice:**
1. Remove credentials from `mta.yaml`
2. Configure destination in BTP Cockpit with credentials
3. Use BTP Destination Service (Cloud Connector method)
4. Remove SAP_USER and SAP_PASSWORD from environment variables

## Next Steps After Deployment

1. **Monitor Logs**: Watch for which connection method activates
2. **Test Both Paths**: Verify destination service works before relying on fallback
3. **Security Audit**: Remove hardcoded credentials once destination service is confirmed working
4. **Performance Check**: Measure response times for SAP calls
5. **Error Handling**: Verify error messages are clear and actionable

## Rollback Plan

If deployment fails:

```bash
# Stop the application
cf stop lockbox-srv

# Delete the application
cf delete lockbox-srv -f

# Re-deploy previous version
cf deploy mta_archives/lockbox-app_<previous-version>.mtar
```

## Support

If issues persist after deployment:
1. Capture full logs: `cf logs lockbox-srv --recent > deployment-logs.txt`
2. Capture environment: `cf env lockbox-srv > environment.txt`
3. Check service bindings: `cf services > services.txt`
4. Verify Cloud Connector status in BTP Cockpit

---

**Deployment Status**: Ready for deployment
**Last Updated**: Current session
**Configuration Files Modified**: 
- `/app/mta.yaml`
- `/app/backend/server.js`
- `/app/backend/.env`
