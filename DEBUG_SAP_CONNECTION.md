# 🔍 Debug: Check Deployed Code vs Latest

## Issue
Getting "HTTP null" error even after deployment, suggesting the destination can't be reached or the error isn't being parsed correctly.

## Diagnostic Steps

### 1. Check BTP Logs for Actual Error
```bash
# View recent logs
cf logs lockbox-srv --recent | grep -E "SAP API ERROR|HTTP Status|Destination"

# Look for the actual error structure
cf logs lockbox-srv --recent | grep -A 20 "STEP1_ERROR"
```

**What to look for:**
- Does it show "VCAP_SERVICES not found"?
- Does it show "Destination: S4HANA_SYSTEM_DESTINATION"?
- What's the actual error message from SAP Cloud SDK?

---

### 2. Verify Destination Binding
```bash
# Check if destination service is bound
cf env lockbox-srv | grep -A 30 destination
```

**Expected output:**
```json
{
  "destination": [{
    "credentials": {
      "clientid": "...",
      "clientsecret": "...",
      "uri": "https://destination-configuration..."
    }
  }]
}
```

**If missing:** The destination SERVICE is not bound (different from destination configuration)

---

### 3. Check Service Bindings
```bash
cf services
```

**Expected:**
```
lockbox-destination    destination    lite    lockbox-srv
```

**If not bound:** Rebind the service
```bash
cf bind-service lockbox-srv lockbox-destination
cf restage lockbox-srv
```

---

### 4. Test Destination from BTP
```bash
# Get app URL
APP_URL=$(cf app lockbox-srv | grep routes | awk '{print $2}')

# Test health (should work)
curl https://$APP_URL/api/health

# Check logs for startup messages
cf logs lockbox-srv --recent | grep "SAP Configuration"
```

**Expected log output:**
```
SAP Configuration:
  Destination: S4HANA_SYSTEM_DESTINATION
  API Path: /sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch
  Client: 100
```

---

### 5. Rebuild and Redeploy with Latest Code
```bash
cd /app

# Clean previous build
rm -rf mta_archives .mta

# Rebuild
mbt build

# Deploy
cf deploy mta_archives/lockbox-app_1.0.0.mtar
```

---

### 6. Test with Mock First
```bash
# After redeployment, test with mock mode
curl -X POST https://$APP_URL/api/lockbox/post-to-sap/:headerId \
  -H "Content-Type: application/json" \
  -d '{
    "useMock": true,
    "serviceId": "SRV-001"
  }'
```

**Should work** regardless of destination configuration.

---

### 7. Check Destination in BTP Cockpit

#### A. Destination EXISTS?
Go to: BTP Cockpit → Connectivity → Destinations
Look for: `S4HANA_SYSTEM_DESTINATION`

**If missing:** Create it

#### B. Destination Name Exact Match?
```
Name: S4HANA_SYSTEM_DESTINATION
```
(case-sensitive, must match exactly)

#### C. Test Connection
Click "Check Connection" button
Should show: ✅ "Connection established"

**If fails:** 
- Check Cloud Connector is running
- Check credentials
- Check URL is correct

---

### 8. Check Cloud Connector

#### Status
- Open Cloud Connector UI: http://localhost:8443
- Check Tunnel: Should be **Connected** (green)
- Check System Mapping: Should be **Reachable** (green)

#### Access Control
Verify these paths are accessible:
```
/sap/opu/odata/sap/API_LOCKBOXPOST_IN
/sap/opu/odata/sap/API_BUSINESS_PARTNER
```

---

## Common Issues

### Issue 1: "HTTP null" Error

**Possible Causes:**
1. Destination service not bound to app
2. Destination doesn't exist in BTP
3. Cloud Connector not running
4. SAP system not reachable

**Debug:**
```bash
# Check if VCAP_SERVICES has destination
cf env lockbox-srv | grep -A 50 VCAP_SERVICES | grep destination

# Check app logs for detailed error
cf logs lockbox-srv --recent | grep -A 30 "SAP API ERROR"
```

---

### Issue 2: Destination Service Not Bound

**Symptom:** VCAP_SERVICES doesn't show destination service

**Fix:**
```bash
# List services
cf services

# If lockbox-destination not bound:
cf bind-service lockbox-srv lockbox-destination
cf restage lockbox-srv
```

---

### Issue 3: Wrong Destination Name

**Symptom:** Error says "destination not found"

**Fix:**
1. Go to BTP Cockpit → Destinations
2. Check exact name (case-sensitive)
3. Must be: `S4HANA_SYSTEM_DESTINATION`
4. If different, either:
   - Rename destination in BTP, OR
   - Update code to match

---

### Issue 4: Cloud Connector Not Connected

**Symptom:** Connection timeout or refused

**Fix:**
1. Open Cloud Connector admin
2. Check connection to BTP (green status)
3. Restart if needed
4. Verify system mapping
5. Test from Cloud Connector UI

---

## Quick Test Script

Create this file: `test-sap-connection.sh`

```bash
#!/bin/bash

APP_URL=$(cf app lockbox-srv | grep routes | awk '{print $2}')
echo "App URL: https://$APP_URL"

echo "\n1. Testing health endpoint..."
curl -s https://$APP_URL/api/health | jq .

echo "\n2. Checking service bindings..."
cf services | grep lockbox

echo "\n3. Checking destination binding..."
cf env lockbox-srv | grep -A 5 destination

echo "\n4. Recent logs..."
cf logs lockbox-srv --recent | tail -50
```

Run:
```bash
chmod +x test-sap-connection.sh
./test-sap-connection.sh
```

---

## Most Likely Issue

Based on "HTTP null" error, the most likely causes are:

1. **Destination SERVICE not bound** (not destination configuration)
   ```bash
   cf bind-service lockbox-srv lockbox-destination
   cf restage lockbox-srv
   ```

2. **Destination name mismatch**
   - Code expects: `S4HANA_SYSTEM_DESTINATION`
   - BTP has: different name?

3. **Cloud Connector not running**
   - For on-premise SAP
   - Must be running and connected

---

## Next Steps

1. Run diagnostic commands above
2. Share the output from:
   ```bash
   cf logs lockbox-srv --recent | grep -A 30 "SAP API ERROR"
   ```
3. Check if destination service is bound:
   ```bash
   cf env lockbox-srv | grep destination
   ```

This will help identify the exact issue!
