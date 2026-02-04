# 🚀 Quick BTP Deployment Guide

Since your destination `S4HANA_SYSTEM_DESTINATION` is already configured and pinging in BTP Cockpit, deploying the app will fix the "HTTP null" error.

---

## 🎯 Quick Deployment Commands

### Step 1: Rebuild MTA (with latest changes)
```bash
cd /app
mbt build
```

### Step 2: Deploy to BTP
```bash
cf deploy mta_archives/lockbox-app_1.0.0.mtar
```

**Expected Output:**
```
Deploying multi-target app archive...
Creating/updating services...
  lockbox-db (existing service)
  lockbox-destination (existing service)
  lockbox-connectivity (existing service)
  lockbox-xsuaa (existing service)
Deploying applications...
  lockbox-srv
Application "lockbox-srv" started and available
Process finished.
```

---

## ✅ Post-Deployment Verification

### 1. Check Application Status
```bash
cf app lockbox-srv
```

**Look for:**
- State: `running`
- Instances: `1/1`
- Memory: Within limits
- Disk: Within limits

### 2. Check Service Bindings
```bash
cf services
```

**Verify all services are bound:**
```
name                    service          plan   bound apps
lockbox-db             postgresql-db     free   lockbox-srv
lockbox-destination    destination       lite   lockbox-srv
lockbox-connectivity   connectivity      lite   lockbox-srv
lockbox-xsuaa          xsuaa             app    lockbox-srv
```

### 3. Check Environment (Destination Available)
```bash
cf env lockbox-srv | grep -A 5 destination
```

**Should show destination service binding** with credentials and configuration.

### 4. View Application Logs
```bash
cf logs lockbox-srv --recent | grep -E "SAP|Destination|VCAP"
```

**Look for:**
```
SAP Configuration:
  Destination: S4HANA_SYSTEM_DESTINATION
  API Path: /sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch
✓ VCAP_SERVICES found (BTP environment detected)
```

### 5. Test Health Endpoint
```bash
# Get your app URL
APP_URL=$(cf app lockbox-srv | grep routes | awk '{print $2}')
echo "App URL: https://$APP_URL"

# Test health endpoint
curl https://$APP_URL/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "lockbox-srv",
  "timestamp": "2026-02-04T..."
}
```

---

## 🧪 Test SAP Connection After Deployment

### Test 1: Upload Lockbox File
```bash
# Upload via UI or curl
# This should work regardless of SAP connection
```

### Test 2: Simulate (No SAP Connection)
```bash
curl -X POST https://$APP_URL/api/lockbox/simulate/:headerId \
  -H "Content-Type: application/json" \
  -d '{"serviceId": "SRV-001"}'
```

### Test 3: Post to SAP (Real Connection) 🎯
```bash
curl -X POST https://$APP_URL/api/lockbox/post-to-sap/:headerId \
  -H "Content-Type: application/json" \
  -d '{
    "useMock": false,
    "serviceId": "SRV-001"
  }'
```

**Expected Success Response:**
```json
{
  "status": "SUCCESS",
  "lockboxBatchInternalKey": "1234567890",
  "lockboxBatch": "001",
  "lockbox": "1234",
  "steps": [...]
}
```

---

## 🔍 Troubleshooting After Deployment

### Issue: Destination still not found

**Check destination name matches exactly:**
```bash
# In BTP Cockpit → Destinations
# Name MUST be: S4HANA_SYSTEM_DESTINATION (case-sensitive)
```

**Verify in code:**
```bash
cf logs lockbox-srv --recent | grep "Destination:"
# Should show: Destination: S4HANA_SYSTEM_DESTINATION
```

### Issue: 401 Unauthorized

**Cause:** Invalid SAP credentials in destination

**Fix:**
1. Go to BTP Cockpit → Destinations
2. Edit `S4HANA_SYSTEM_DESTINATION`
3. Verify username/password
4. Test connection from BTP Cockpit

### Issue: Connection timeout

**Cause:** Cloud Connector not running or misconfigured

**Fix:**
1. Check Cloud Connector status (should be green)
2. Verify system mapping
3. Check access control rules
4. Test from Cloud Connector admin UI

### Issue: App crashes on startup

**Check logs:**
```bash
cf logs lockbox-srv --recent
```

**Common causes:**
- Database connection failed (check VCAP_SERVICES)
- Missing service binding
- Port conflict

**Fix:**
```bash
# Restart app
cf restart lockbox-srv

# Check services are created
cf services
```

---

## 📊 Before vs After Deployment

### Before (Local) ❌
```
Environment: Local development
VCAP_SERVICES: Not available
Destination Service: Not accessible
Result: HTTP null error
Solution: Use useMock: true
```

### After (BTP) ✅
```
Environment: SAP BTP Cloud Foundry
VCAP_SERVICES: Available (service bindings)
Destination Service: Accessible
Result: Real SAP connection works
Solution: Use useMock: false
```

---

## 🎯 Quick Reference Commands

```bash
# Deploy
mbt build && cf deploy mta_archives/lockbox-app_1.0.0.mtar

# Check status
cf app lockbox-srv
cf services
cf logs lockbox-srv --recent

# Get app URL
cf app lockbox-srv | grep routes

# Restart if needed
cf restart lockbox-srv

# Check environment
cf env lockbox-srv | grep -E "destination|VCAP_SERVICES"

# Monitor logs (live)
cf logs lockbox-srv
```

---

## ✅ Success Indicators

After deployment, you should see:

- [x] App status: `running`
- [x] All services: `bound`
- [x] VCAP_SERVICES: Present in environment
- [x] Destination service: Available
- [x] Health endpoint: Returns 200 OK
- [x] SAP connection: Works with `useMock: false`
- [x] No "HTTP null" errors

---

## 💡 What Changed

### Local Environment
```
❌ No VCAP_SERVICES
❌ No destination service access
❌ SAP Cloud SDK can't find destination
Result: HTTP null error
```

### BTP Environment
```
✅ VCAP_SERVICES available
✅ Destination service bound to app
✅ SAP Cloud SDK can access destination
Result: SAP connection works!
```

---

## 📝 Deployment Checklist

Before deploying:
- [x] Destination exists in BTP: `S4HANA_SYSTEM_DESTINATION`
- [x] Destination pings successfully
- [x] Cloud Connector running (if on-premise)
- [x] MTA archive built: `mbt build`
- [x] Logged in to CF: `cf login`

After deploying:
- [ ] App running: `cf app lockbox-srv`
- [ ] Services bound: `cf services`
- [ ] Test health: `curl .../api/health`
- [ ] Test SAP: POST with `useMock: false`

---

**Ready to deploy? Run:**
```bash
cd /app
mbt build
cf deploy mta_archives/lockbox-app_1.0.0.mtar
```

Then test with your lockbox data! 🚀
