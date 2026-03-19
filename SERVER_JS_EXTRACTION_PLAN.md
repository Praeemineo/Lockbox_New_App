# Server.js Code Extraction Plan - Complete Analysis

## 📊 Current State:
- **Total Endpoints**: 80+ API endpoints in server.js
- **Lines**: ~9,850 lines
- **Status**: Monolithic (almost everything in one file)

---

## 🎯 Extractable Code Categories:

### **1. LOCKBOX OPERATIONS** (Priority: HIGH) 
**Current Location**: server.js (lines 437-2690)
**Target**: `/routes/lockboxRoutes.js` + `/services/lockboxService.js`

#### **Endpoints to Extract** (~15 endpoints):
```javascript
// Lockbox Headers
GET    /api/lockbox/headers              // Get all headers
POST   /api/lockbox/headers              // Create header  
PUT    /api/lockbox/headers/:id          // Update header
DELETE /api/lockbox/headers/:id          // Delete header

// File Operations
GET    /api/lockbox/template             // Download template
POST   /api/lockbox/upload               // Upload Excel file
POST   /api/lockbox/process              // Process file

// Hierarchy & Preview
GET    /api/lockbox/hierarchy/:headerId  // Get hierarchy
GET    /api/lockbox/preview-payload/:headerId  // Preview payload

// Posting Operations
POST   /api/lockbox/simulate/:headerId   // Simulate posting
POST   /api/lockbox/post/:headerId       // Post to SAP
GET    /api/lockbox/retrieve-clearing/:headerId  // Get clearing data
```

**Lines**: ~2,253 lines
**Services to Create**:
- `lockboxService.js` - CRUD operations
- `uploadService.js` - File upload & processing
- `postingService.js` - SAP posting logic

---

### **2. RUN MANAGEMENT** (Priority: HIGH)
**Current Location**: server.js (lines 2913-3070, 8560-9943)
**Target**: `/routes/runRoutes.js` + `/services/runService.js`

#### **Endpoints to Extract** (~12 endpoints):
```javascript
// Run CRUD
GET    /api/runs                         // Get all runs
GET    /api/run/:runId                   // Get run by ID
GET    /api/lockbox/:lockboxId/runs      // Get runs for lockbox
GET    /api/lockbox/runs                 // Get runs with filters
GET    /api/lockbox/runs/:runId          // Get specific run
PUT    /api/lockbox/runs/:runId          // Update run

// Run Operations
✅ GET    /api/lockbox/run/:runId/accounting-document  // DONE - Moved to module
GET    /api/lockbox/runs/:runId/production-result     // Get production result
GET    /api/lockbox/runs/:runId/hierarchy             // Get hierarchy
GET    /api/lockbox/runs/:runId/download              // Download run
POST   /api/lockbox/runs/:runId/reprocess             // Reprocess run
POST   /api/lockbox/runs/:runId/simulate              // Simulate posting
POST   /api/lockbox/runs/:runId/repost                // Repost to SAP
POST   /api/lockbox/runs/:runId/production            // Production posting
```

**Lines**: ~3,400 lines
**Status**: ✅ Partially done (RULE-004 extracted)

---

### **3. FIELD MAPPING & PATTERNS** (Priority: MEDIUM)
**Current Location**: server.js (lines 4282-4949)
**Target**: `/routes/fieldMappingRoutes.js` + `/services/fieldMappingService.js`

#### **Endpoints to Extract** (~20 endpoints):
```javascript
// Templates
GET    /api/field-mapping/templates
POST   /api/field-mapping/templates
GET    /api/field-mapping/templates/:templateId

// Patterns
GET    /api/field-mapping/patterns
POST   /api/field-mapping/patterns
PUT    /api/field-mapping/patterns/:patternId
DELETE /api/field-mapping/patterns/:patternId
POST   /api/field-mapping/patterns/sync-to-db
POST   /api/field-mapping/patterns/:patternId/copy

// Pattern Metadata
GET    /api/field-mapping/pattern-types
GET    /api/field-mapping/pattern-categories
GET    /api/field-mapping/delimiters

// Rules
GET    /api/field-mapping/rules
POST   /api/field-mapping/rules
GET    /api/field-mapping/rules/:ruleId
PUT    /api/field-mapping/rules/:ruleId

// Processing Rules (Field Mapping)
GET    /api/field-mapping/processing-rules
GET    /api/field-mapping/processing-rules/:ruleId
POST   /api/field-mapping/processing-rules
PUT    /api/field-mapping/processing-rules/:ruleId
DELETE /api/field-mapping/processing-rules/:ruleId
POST   /api/field-mapping/processing-rules/sync-to-db

// Reference Document Rules (DEPRECATED - can be removed)
GET    /api/field-mapping/reference-doc-rules
GET    /api/field-mapping/reference-doc-rules/:ruleId
POST   /api/field-mapping/reference-doc-rules
PUT    /api/field-mapping/reference-doc-rules/:ruleId
DELETE /api/field-mapping/reference-doc-rules/:ruleId
POST   /api/field-mapping/reference-doc-rules/:ruleId/select
```

**Lines**: ~1,724 lines

---

### **4. PROCESSING RULES** (Priority: MEDIUM)
**Current Location**: server.js (lines 5712-5902)
**Target**: `/routes/processingRulesRoutes.js` + `/services/processingRulesService.js`

#### **Endpoints to Extract** (~6 endpoints):
```javascript
GET    /api/processing-rules              // Get all rules
GET    /api/processing-rules/:ruleId      // Get specific rule
POST   /api/processing-rules              // Create rule
PUT    /api/processing-rules/:ruleId      // Update rule
DELETE /api/processing-rules/:ruleId      // Delete rule
POST   /api/processing-rules/sync-to-db   // Sync to database
```

**Lines**: ~615 lines

---

### **5. API FIELDS MANAGEMENT** (Priority: LOW)
**Current Location**: server.js (lines 5007-5287)
**Target**: `/routes/apiFieldsRoutes.js` + `/services/apiFieldsService.js`

#### **Endpoints to Extract** (~9 endpoints):
```javascript
// API Fields
GET    /api-fields                        // Get all fields
POST   /api-fields                        // Create field
GET    /api-fields/:fieldId               // Get field
PUT    /api-fields/:fieldId               // Update field

// Field Mapping Constants
GET    /api/field-mapping/constants

// OData Services
GET    /api/field-mapping/odata-services
POST   /api/field-mapping/odata-services
PUT    /api/field-mapping/odata-services/:serviceId
DELETE /api/field-mapping/odata-services/:serviceId
```

**Lines**: ~280 lines

---

### **6. SAP INTEGRATION ENDPOINTS** (Priority: LOW)
**Current Location**: server.js (lines 8660-8702)
**Target**: `/routes/sapRoutes.js` + Use existing `/srv/integrations/sap-client.js`

#### **Endpoints to Extract** (~3 endpoints):
```javascript
POST   /api/sap/service-document         // Call SAP service
GET    /api/sap/metadata                 // Get SAP metadata
POST   /api/sap/diagnostics              // SAP diagnostics
```

**Lines**: ~42 lines

---

### **7. JOB MANAGEMENT** (Priority: LOW)
**Current Location**: server.js (line 8571)
**Target**: `/routes/jobRoutes.js` (might already exist)

#### **Endpoints to Extract** (~1 endpoint):
```javascript
GET    /api/jobs                         // Get all jobs
```

**Lines**: ~24 lines

---

### **8. BATCH TEMPLATES** (Priority: LOW)
**Current Location**: server.js (lines 9943-9965)
**Target**: `/routes/batchTemplateRoutes.js` + `/services/batchTemplateService.js`

#### **Endpoints to Extract** (~3 endpoints):
```javascript
GET    /api/batch-templates
GET    /api/batch-templates/:templateId
PUT    /api/batch-templates/:templateId
```

**Lines**: ~22 lines

---

## 📊 Summary by Priority:

| Priority | Category | Endpoints | Lines | Complexity | Impact |
|----------|----------|-----------|-------|------------|--------|
| **HIGH** | Lockbox Operations | 15 | ~2,253 | High | Core functionality |
| **HIGH** | Run Management | 12 | ~3,400 | High | Critical operations |
| **MEDIUM** | Field Mapping | 20 | ~1,724 | Medium | Configuration |
| **MEDIUM** | Processing Rules | 6 | ~615 | Medium | Rule management |
| **LOW** | API Fields | 9 | ~280 | Low | Admin functionality |
| **LOW** | SAP Integration | 3 | ~42 | Low | Utility endpoints |
| **LOW** | Job Management | 1 | ~24 | Low | Monitoring |
| **LOW** | Batch Templates | 3 | ~22 | Low | Templates |
| **TOTAL** | | **69** | **~8,360** | | |

**Note**: ~80 endpoints total, but some are duplicates or deprecated.

---

## 🎯 Recommended Extraction Order:

### **Phase 1: Core Operations** (Already Started) ✅
- [x] RULE-004 endpoint (DONE)
- [ ] Posting service extraction
- [ ] Upload/process service extraction

### **Phase 2: Run Management** (Next)
- [ ] Extract run CRUD operations
- [ ] Extract run simulate/post/reprocess
- [ ] Extract run download/hierarchy

### **Phase 3: Lockbox Operations**
- [ ] Extract lockbox CRUD
- [ ] Extract file upload
- [ ] Extract SAP posting logic

### **Phase 4: Configuration** (Lower Priority)
- [ ] Extract field mapping
- [ ] Extract processing rules
- [ ] Extract API fields

### **Phase 5: Utilities** (Cleanup)
- [ ] Extract SAP integration endpoints
- [ ] Extract batch templates
- [ ] Remove deprecated code (Reference Document Rules)

---

## 📂 Target Modular Structure:

```
/app/backend/
├── server.js (500-1000 lines)        ← Main orchestrator
│   └── Minimal: imports, middleware, route registration, startup
│
├── routes/
│   ├── lockboxRoutes.js              🆕 Lockbox CRUD & operations
│   ├── runRoutes.js                  ✅ Run management (partial)
│   ├── uploadRoutes.js               🆕 File upload & processing
│   ├── postingRoutes.js              🆕 SAP posting operations
│   ├── fieldMappingRoutes.js         🆕 Field mapping configuration
│   ├── processingRulesRoutes.js      🆕 Processing rules management
│   ├── apiFieldsRoutes.js            🆕 API fields management
│   ├── sapRoutes.js                  🆕 SAP integration utilities
│   ├── jobRoutes.js                  ✅ Already exists
│   └── batchTemplateRoutes.js        🆕 Batch templates
│
├── services/
│   ├── lockboxService.js             🆕 Lockbox business logic
│   ├── runService.js                 ✅ Run management (partial)
│   ├── uploadService.js              🆕 File processing logic
│   ├── postingService.js             🆕 SAP posting logic
│   ├── fieldMappingService.js        🆕 Field mapping logic
│   ├── processingRulesService.js     🆕 Rules management logic
│   └── validationService.js          🆕 Data validation
│
├── srv/handlers/                     ✅ Already modular
│   ├── rule-engine.js                ✅ RULE-001 to RULE-004
│   └── pattern-engine.js             ✅ Pattern matching
│
└── srv/integrations/                 ✅ Already modular
    └── sap-client.js                 ✅ SAP API client
```

---

## 💡 Quick Wins (Easiest to Extract):

### **1. SAP Integration Endpoints** (~42 lines)
Simple passthrough endpoints - can be extracted in 5 minutes.

### **2. Batch Templates** (~22 lines)
Small, self-contained - quick extraction.

### **3. Job Management** (~24 lines)
Single endpoint - very simple.

### **4. API Fields** (~280 lines)
Straightforward CRUD operations.

---

## 🚀 Biggest Impact (Should Extract Next):

### **1. Posting Service** (~800 lines)
**Why**: Contains critical SAP posting logic
- `simulate()`
- `post()`
- `buildSAPPayload()`
- `applyTransformationRules()`

**Impact**: Separates core business logic from routing

### **2. Upload Service** (~750 lines)
**Why**: Complex file processing logic
- File upload handling
- Excel parsing
- Data validation
- RULE-001/RULE-002 execution

**Impact**: Makes file processing testable

### **3. Lockbox CRUD** (~1,200 lines)
**Why**: Basic CRUD operations
- Header management
- Run management
- Database queries

**Impact**: Cleans up a large chunk of server.js

---

## 📝 Extraction Template:

For each extraction, follow this pattern:

```javascript
// 1. Create Service (/services/xxxService.js)
async function operation(req, res) {
    // Business logic here
}
module.exports = { operation };

// 2. Create Route (/routes/xxxRoutes.js)
const express = require('express');
const router = express.Router();
const xxxService = require('../services/xxxService');

router.get('/path', xxxService.operation);
module.exports = router;

// 3. Register in server.js
const xxxRoutes = require('./routes/xxxRoutes');
app.use('/api/xxx', xxxRoutes);

// 4. Disable old endpoint in server.js
// Mark as deprecated, rename path, or comment out
```

---

## ⚠️ Code That Should NOT Be Extracted:

1. **Express app initialization**
2. **Middleware registration** (cors, body-parser, etc.)
3. **Static file serving**
4. **Global error handling**
5. **Server startup** (`app.listen()`)
6. **Database connection** (can extract config)
7. **Environment variable loading**

---

## 🎯 Final Goal:

**server.js structure** (~500-1000 lines):
```javascript
// Imports
const express = require('express');
// ... middleware
// ... route imports (10-15 lines)

// App setup
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
// ... (10-15 lines)

// Static files
app.use(express.static(frontendPath));

// Route registration (10-15 lines)
app.use('/api/lockbox', lockboxRoutes);
app.use('/api/lockbox/run', runRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/posting', postingRoutes);
// ... etc

// Error handling
app.use(errorMiddleware);

// SPA fallback
app.get('*', (req, res) => res.sendFile(...));

// Start server
app.listen(PORT, () => console.log('Started'));
```

**Result**: Clean, maintainable, production-ready codebase! 🎉

---

## 📊 Estimated Time:

| Phase | Endpoints | Lines | Estimated Time |
|-------|-----------|-------|----------------|
| Phase 1 (Core) | 15 | 3,000 | 2-3 hours |
| Phase 2 (Run Mgmt) | 12 | 3,400 | 2-3 hours |
| Phase 3 (Lockbox) | 15 | 2,253 | 2-3 hours |
| Phase 4 (Config) | 20 | 1,724 | 1-2 hours |
| Phase 5 (Cleanup) | 7 | 346 | 1 hour |
| **TOTAL** | **69** | **~10,723** | **8-12 hours** |

**Can be done incrementally over multiple sessions!**
