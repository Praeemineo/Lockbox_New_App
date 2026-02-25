# BTP Cloud Foundry Deployment Fix

## Issue
The BTP deployment at `https://praeemineo-llc-h40wwjzd772w1g15-dev-lockbox-srv.cfapps.ap10.hana.ondemand.com/` is returning 404 after frontend consolidation changes.

## Root Cause
The application code has been updated in the Kubernetes environment but the BTP Cloud Foundry instance still has the old code. BTP deployments require explicit redeployment using `cf push`.

## Solution

### Changes Made:
1. **Consolidated frontend** to single source: `/app/frontend/public/webapp/`
2. **Updated `server.js`** to support both deployment models:
   - Kubernetes: Serves from `/app/frontend/public/` 
   - BTP: Serves from `/app/backend/app/` (local to deployment)
3. **Synced frontend files** to `/app/backend/app/` for BTP deployment
4. **Fixed JavaScript syntax errors** in `Main.controller.js`
5. **Removed "Simulate" and "Production Run" buttons**
6. **Implemented SAP72 font**

### Deployment Steps for BTP:

```bash
# 1. Navigate to project root
cd /app

# 2. Login to Cloud Foundry
cf login -a https://api.cf.ap10.hana.ondemand.com

# 3. Target your org and space
cf target -o <your-org> -s <your-space>

# 4. Push the updated application
cf push

# 5. Verify deployment
cf apps
cf logs lockbox-srv --recent
```

### Verification:
After deployment, verify the application at:
- URL: https://praeemineo-llc-h40wwjzd772w1g15-dev-lockbox-srv.cfapps.ap10.hana.ondemand.com/
- Check: Homepage with 3 tiles should load
- Check: SAP72 font applied
- Check: No "Simulate" or "Production Run" buttons

### Architecture:

**Kubernetes Deployment (Current Working):**
```
Frontend Service (port 3000) → /app/frontend/public/
Backend Service (port 8001) → APIs only
URL: https://lockbox-processor-2.preview.emergentagent.com
Status: ✅ WORKING
```

**BTP Cloud Foundry Deployment (Needs Redeploy):**
```
lockbox-srv app → Serves both UI (/app/backend/app/) AND APIs
URL: https://praeemineo-llc-h40wwjzd772w1g15-dev-lockbox-srv.cfapps.ap10.hana.ondemand.com/
Status: ❌ NEEDS REDEPLOYMENT
```

### Files Synced to BTP Deployment Package:
- `/app/backend/app/index.html` - Updated
- `/app/backend/app/webapp/manifest.json` - Includes CSS reference
- `/app/backend/app/webapp/css/custom.css` - SAP72 font configuration
- `/app/backend/app/webapp/controller/Main.controller.js` - Fixed syntax errors
- `/app/backend/app/webapp/view/PdfLockbox.view.xml` - Buttons removed
- `/app/backend/app/webapp/view/Main.view.xml` - Synced

### Smart Path Resolution in server.js:
```javascript
// Backend automatically detects environment
const consolidatedPath = path.join(__dirname, '../frontend/public');
const localPath = path.join(__dirname, 'app');

if (require('fs').existsSync(consolidatedPath)) {
    // Kubernetes: use consolidated frontend
    frontendPath = consolidatedPath;
} else {
    // BTP: use local frontend (in deployment package)
    frontendPath = localPath;
}
```

### Notes:
- Both `/app/frontend/public/` and `/app/backend/app/` now contain identical frontend code
- Single source of truth is `/app/frontend/public/`
- `/app/backend/app/` is synced for BTP deployment compatibility
- Future UI changes should be made to `/app/frontend/public/` and then synced to `/app/backend/app/`

---

**Date:** 2026-02-20
**Status:** Code Ready - Awaiting BTP Redeployment
