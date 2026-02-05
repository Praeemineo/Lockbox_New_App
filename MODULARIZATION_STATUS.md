# Backend Modularization - Migration Guide

## Current Status: Phase 1 Complete ✅

### What Has Been Done

#### 1. Directory Structure Created
```
/app/backend/
├── config/
│   └── index.js                 # Centralized configuration
├── middleware/
│   ├── errorHandler.js          # Error handling middleware
│   ├── requestLogger.js         # Request logging middleware
│   └── index.js                 # Middleware exports
├── routes/
│   ├── healthRoutes.js          # Health check endpoints
│   ├── lockboxRoutes.js         # Lockbox operations
│   ├── runRoutes.js             # Run management
│   ├── lockboxRunRoutes.js      # Lockbox run operations
│   ├── fieldMappingRoutes.js    # Field mapping config
│   ├── sapRoutes.js             # SAP diagnostics
│   ├── templateRoutes.js        # Batch templates
│   ├── jobRoutes.js             # Job management
│   └── index.js                 # Route aggregator
├── services/
│   ├── lockboxService.js        # Lockbox business logic
│   ├── runService.js            # Run business logic
│   ├── lockboxRunService.js     # Lockbox run business logic
│   ├── fieldMappingService.js   # Field mapping business logic
│   ├── sapService.js            # SAP API calls
│   ├── templateService.js       # Template business logic
│   ├── jobService.js            # Job business logic
│   └── postgresService.js       # Database operations
├── utils/
│   ├── sapErrorExtractor.js     # SAP error parsing
│   ├── filePatterns.js          # File pattern utilities
│   └── index.js                 # Utility exports
├── server.modular.js            # NEW: Minimal modular entry point
├── server.monolithic.js         # BACKUP: Original 7630-line server
└── server.js                    # CURRENT: Still using monolithic (with SAP fixes)
```

#### 2. Files Created
- ✅ 8 route files (all routes mapped)
- ✅ 7 service files (placeholders ready)
- ✅ 1 config file (centralized configuration)
- ✅ 3 middleware files (error handling, logging)
- ✅ 3 utility files (SAP errors, file patterns)
- ✅ 1 modular server.js (minimal entry point)

#### 3. Architecture Design
```
Request → Middleware → Router → Service → Database/SAP
                                   ↓
                                Response
```

**Benefits:**
- **Separation of Concerns**: Routes handle HTTP, services handle business logic
- **Testability**: Each service can be tested independently
- **Maintainability**: Easier to find and modify specific features
- **Scalability**: New features can be added without touching core files

## Phase 2: Gradual Logic Migration (IN PROGRESS)

### Strategy
Since the monolithic `server.js` is 7630 lines, we'll migrate incrementally while keeping the app functional.

### Approach: Two-Server Strategy

#### Option A: Run Both Servers (Recommended for Safety)
1. Keep `server.js` (monolithic) as primary on port 8001
2. Start `server.modular.js` on port 8002
3. Migrate one endpoint at a time
4. Test each endpoint on 8002
5. Once all endpoints work, switch to modular only

#### Option B: Direct Migration (Faster but Riskier)
1. Migrate all logic from `server.monolithic.js` to service files
2. Replace `server.js` with `server.modular.js`
3. Test all endpoints at once
4. Fix any issues

### Current Implementation Status

#### Fully Implemented ✅
1. **Health Check** (`/api/health`)
   - Routes: ✅ `/app/backend/routes/healthRoutes.js`
   - Service: ✅ Inline in route

#### Partially Implemented ⚠️
1. **Lockbox Headers** (`/api/lockbox/headers`)
   - Routes: ✅ `/app/backend/routes/lockboxRoutes.js`
   - Service: ⚠️ Basic implementation in `/app/backend/services/lockboxService.js`
   - Status: Simple query works, needs full logic from server.js

#### Not Yet Implemented ❌ (Returning 501 Placeholders)
All other endpoints return `501 Not Implemented` with message:
```json
{
  "message": "Implementation pending - being migrated from server.js"
}
```

### Migration Checklist by Feature

#### Priority 1: Core SAP Integration (CRITICAL for BTP)
- [ ] `/api/lockbox/runs/:runId/production` - Execute production posting
  - Location in monolithic: Line ~6840
  - Target service: `lockboxRunService.executeProduction()`
  - Dependencies: SAP connection (already enhanced with fallback)
  
- [ ] `/api/lockbox/runs/:runId/simulate` - Simulate production
  - Location in monolithic: Line ~6411
  - Target service: `lockboxRunService.simulateProduction()`

#### Priority 2: File Upload & Processing
- [ ] `/api/lockbox/upload` - Upload Excel file
  - Location in monolithic: Line ~516
  - Target service: `lockboxService.uploadFile()`
  - Includes: Excel parsing, validation

- [ ] `/api/lockbox/process` - Process with mapping rules
  - Location in monolithic: Line ~5743
  - Target service: `lockboxService.processFile()`
  - Includes: Rule application, data transformation

#### Priority 3: Run Management
- [ ] `/api/runs` - Get all runs
  - Location in monolithic: Line ~2164
  - Target service: `runService.getAllRuns()`

- [ ] `/api/run/:runId` - Get specific run
  - Location in monolithic: Line ~2234
  - Target service: `runService.getRunById()`

- [ ] `/api/lockbox/runs/:runId` - Get run details
  - Location in monolithic: Line ~6252
  - Target service: `lockboxRunService.getRunDetails()`

#### Priority 4: Field Mapping (Configuration)
- [ ] All `/api/field-mapping/*` endpoints
  - Location in monolithic: Lines 3340-4219
  - Target service: `fieldMappingService` (all methods)
  - Note: These are mostly JSON file operations

#### Priority 5: SAP Diagnostics
- [ ] `/api/sap/service-document` - SAP service doc
  - Location in monolithic: Line ~6280
  - Target service: `sapService.getServiceDocument()`

- [ ] `/api/sap/metadata` - SAP metadata
  - Location in monolithic: Line ~6301
  - Target service: `sapService.getMetadata()`

- [ ] `/api/sap/diagnostics` - SAP diagnostics
  - Location in monolithic: Line ~6322
  - Target service: `sapService.runDiagnostics()`

### Next Steps

#### Immediate (This Session)
1. ✅ Complete Phase 1: Structure created
2. ⏳ Choose migration strategy (Option A or Option B)
3. ⏳ Migrate Priority 1 endpoints (SAP integration)
4. ⏳ Test with BTP deployment

#### Short-term (Next Session)
1. Migrate Priority 2 & 3 endpoints
2. Test file upload and processing flows
3. Verify all core features work

#### Medium-term (Future Session)
1. Migrate Priority 4 & 5 endpoints
2. Complete full modularization
3. Remove `server.monolithic.js` backup
4. Update documentation

## Testing Strategy

### Local Testing
```bash
# Test modular server
cd /app/backend
node server.modular.js

# In another terminal, test endpoints
curl http://localhost:8001/api/health
curl http://localhost:8001/api/lockbox/headers
```

### BTP Testing
After migration of critical endpoints:
```bash
# Build and deploy
cd /app
mbt build
cf deploy mta_archives/lockbox-app_1.0.0.mtar

# Test critical endpoint
curl https://lockbox-srv.<cf-domain>/api/lockbox/runs/:runId/production
```

## Files Reference

### Monolithic Source
- `/app/backend/server.monolithic.js` - Original 7630-line file (BACKUP)
- `/app/backend/server.js` - Current with SAP fixes (ACTIVE)

### Modular Target
- `/app/backend/server.modular.js` - New minimal entry point
- `/app/backend/routes/*.js` - Route handlers
- `/app/backend/services/*.js` - Business logic

### Configuration
- `/app/backend/config/index.js` - All environment variables
- `/app/backend/.env` - Environment values

## Important Notes

### ⚠️ Current Status
- The application is currently using the **monolithic server.js** with SAP connection fixes
- The **modular structure is ready** but services need logic migration
- Both approaches (monolithic and modular) can coexist during migration

### 🎯 Goal
Create a clean, maintainable codebase where:
- `server.js` is < 100 lines (just initialization)
- Each route file is < 200 lines
- Each service file is < 500 lines
- Business logic is separated from HTTP handling

### 📝 Migration Pattern (Example)

**From monolithic server.js:**
```javascript
app.post('/api/lockbox/upload', upload.single('file'), async (req, res) => {
    try {
        // 150 lines of business logic here
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

**To modular structure:**

**routes/lockboxRoutes.js:**
```javascript
router.post('/upload', upload.single('file'), lockboxService.uploadFile);
```

**services/lockboxService.js:**
```javascript
async function uploadFile(req, res) {
    try {
        // 150 lines of business logic here
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
```

## Summary

**Phase 1 Complete ✅**
- Modular structure created
- All routes mapped
- Service placeholders ready
- Minimal server.js created

**Phase 2 In Progress ⏳**
- Need to migrate business logic from monolithic server
- Recommended: Migrate Priority 1 (SAP integration) first
- Then gradually migrate other features

**Current Working State**: Monolithic server with SAP fixes (ready for BTP deployment)
**Target State**: Fully modular server (better maintainability)

---

**Decision Needed**: Should we:
A) Deploy current monolithic+SAP-fixes to BTP now, then gradually migrate?
B) Complete SAP endpoint migration to modular, then deploy?
