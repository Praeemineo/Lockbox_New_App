# Server.js Refactoring Plan

## 📊 Current State:
- **File**: `/app/backend/server.js`
- **Size**: 463 KB
- **Lines**: 9,997 lines
- **Status**: Monolithic - everything in one file

## 🎯 Goal:
Create a clean, modular architecture with `server.js` as a thin orchestrator.

---

## 📂 Proposed Modular Structure:

```
/app/backend/
├── server.js                          # ✅ Main entry (100-200 lines)
│   └── Express setup, route registration, startup only
│
├── srv/
│   ├── routes/                        # 🆕 API Route Handlers
│   │   ├── lockbox.routes.js          # Lockbox CRUD operations
│   │   ├── upload.routes.js           # File upload & processing
│   │   ├── posting.routes.js          # SAP posting operations
│   │   ├── field-mapping.routes.js    # Field mapping configuration
│   │   ├── processing-rules.routes.js # Processing rules CRUD
│   │   └── health.routes.js           # Health check endpoints
│   │
│   ├── services/                      # 🆕 Business Logic
│   │   ├── lockbox.service.js         # Lockbox business logic
│   │   ├── posting.service.js         # SAP posting logic
│   │   ├── validation.service.js      # Data validation
│   │   └── run-generator.service.js   # Run ID generation
│   │
│   ├── handlers/                      # ✅ Already exists
│   │   ├── rule-engine.js             # Processing rules (RULE-001 to RULE-004)
│   │   └── pattern-engine.js          # Pattern matching
│   │
│   ├── integrations/                  # ✅ Already exists
│   │   └── sap-client.js              # SAP API client
│   │
│   ├── middleware/                    # 🆕 Express Middleware
│   │   ├── auth.middleware.js         # Authentication (if needed)
│   │   ├── upload.middleware.js       # Multer configuration
│   │   └── error.middleware.js        # Error handling
│   │
│   ├── models/                        # ✅ Already exists
│   │   └── data-models.js             # Data models
│   │
│   ├── utils/                         # ✅ Already exists
│   │   ├── logger.js                  # Logging utility
│   │   ├── date-utils.js              # Date utilities
│   │   └── file-utils.js              # File utilities
│   │
│   └── config/                        # 🆕 Configuration
│       ├── database.config.js         # PostgreSQL setup
│       └── app.config.js              # App configuration
│
└── data/                              # ✅ Already exists
    ├── processing_rules.json
    └── field_definitions.json
```

---

## 🔄 Extraction Plan:

### **Phase 1: Extract Routes** (Priority 1)
Move API endpoint handlers from server.js to route files:

#### `routes/lockbox.routes.js`:
- GET `/api/lockbox/headers` - Get all headers
- GET `/api/lockbox/:headerId` - Get specific header
- POST `/api/lockbox/header` - Create header
- PUT `/api/lockbox/header/:id` - Update header
- DELETE `/api/lockbox/header/:id` - Delete header
- GET `/api/lockbox/:runId/details` - Get run details

#### `routes/upload.routes.js`:
- POST `/api/lockbox/upload` - Upload Excel file
- POST `/api/lockbox/download-template` - Download template
- GET `/api/lockbox/:runId/download-excel` - Download processed file

#### `routes/posting.routes.js`:
- POST `/api/lockbox/:runId/simulate` - Simulate posting
- POST `/api/lockbox/:runId/post` - Post to SAP
- GET `/api/lockbox/run/:runId/accounting-document` - RULE-004 endpoint

#### `routes/field-mapping.routes.js`:
- GET `/api/field-mapping` - Get field mappings
- POST `/api/field-mapping` - Create field mapping
- PUT `/api/field-mapping/:id` - Update field mapping
- DELETE `/api/field-mapping/:id` - Delete field mapping

#### `routes/processing-rules.routes.js`:
- GET `/api/processing-rules` - Get all rules
- POST `/api/processing-rules` - Create rule
- PUT `/api/processing-rules/:id` - Update rule
- DELETE `/api/processing-rules/:id` - Delete rule
- POST `/api/processing-rules/sync-to-db` - Sync rules

#### `routes/health.routes.js`:
- GET `/api/health` - Health check

---

### **Phase 2: Extract Services** (Priority 2)
Move business logic from server.js to service files:

#### `services/lockbox.service.js`:
- `createHeader()`
- `updateHeader()`
- `deleteHeader()`
- `getHeaders()`
- `getRunDetails()`

#### `services/posting.service.js`:
- `simulatePosting()`
- `postToSAP()`
- `buildSAPPayload()`
- `applyTransformationRules()`

#### `services/validation.service.js`:
- `validateLockboxData()`
- `validateFieldMappings()`
- `validateProcessingRules()`

#### `services/run-generator.service.js`:
- `generateRunId()`
- `generateUniqueId()`

---

### **Phase 3: Extract Configuration** (Priority 3)

#### `config/database.config.js`:
```javascript
const { Pool } = require('pg');

let pool;

if (process.env.VCAP_SERVICES) {
    // BTP environment
    const vcapServices = JSON.parse(process.env.VCAP_SERVICES);
    const postgresService = vcapServices.postgresql[0];
    pool = new Pool(postgresService.credentials);
} else {
    // Local environment
    pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lockbox_db'
    });
}

module.exports = pool;
```

#### `config/app.config.js`:
```javascript
module.exports = {
    port: process.env.PORT || 8001,
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendPath: process.env.FRONTEND_PATH || './app/webapp',
    sapClient: process.env.SAP_CLIENT || '100',
    uploadDir: './uploads',
    maxFileSize: 10 * 1024 * 1024 // 10MB
};
```

---

### **Phase 4: Extract Middleware**

#### `middleware/upload.middleware.js`:
```javascript
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, './uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'lockbox-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.xlsx' || ext === '.xls') {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed'));
        }
    }
});

module.exports = upload;
```

#### `middleware/error.middleware.js`:
```javascript
module.exports = (err, req, res, next) => {
    console.error('Error:', err);
    
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    
    res.status(status).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};
```

---

## 📝 New server.js Structure:

```javascript
// server.js (New - Clean & Minimal)

const express = require('express');
const path = require('path');
const cors = require('cors');

// Config
const config = require('./srv/config/app.config');
const db = require('./srv/config/database.config');

// Middleware
const uploadMiddleware = require('./srv/middleware/upload.middleware');
const errorMiddleware = require('./srv/middleware/error.middleware');

// Routes
const healthRoutes = require('./srv/routes/health.routes');
const lockboxRoutes = require('./srv/routes/lockbox.routes');
const uploadRoutes = require('./srv/routes/upload.routes');
const postingRoutes = require('./srv/routes/posting.routes');
const fieldMappingRoutes = require('./srv/routes/field-mapping.routes');
const processingRulesRoutes = require('./srv/routes/processing-rules.routes');

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files
const frontendPath = path.join(__dirname, config.frontendPath);
app.use(express.static(frontendPath));

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/lockbox', lockboxRoutes);
app.use('/api/lockbox', uploadRoutes);
app.use('/api/lockbox', postingRoutes);
app.use('/api/field-mapping', fieldMappingRoutes);
app.use('/api/processing-rules', processingRulesRoutes);

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Error handling middleware (must be last)
app.use(errorMiddleware);

// Start server
const PORT = config.port;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Lockbox Processing Service running on port ${PORT}`);
    console.log(`📂 Frontend path: ${frontendPath}`);
    console.log(`🗄️  Database: ${db.options.host || 'localhost'}`);
});

module.exports = app;
```

**Result**: ~100 lines instead of 10,000! 🎉

---

## 🔍 Duplicate Code to Remove:

### **1. SAP API Helper Functions**
Currently duplicated:
- `executeSapGetRequest()` - Move to `sap-client.js` ✅ (already done)
- `executeSapPostRequest()` - Move to `sap-client.js` ✅ (already done)
- SAP error handling - Consolidate in `sap-client.js`

### **2. Database Queries**
Consolidate into service files:
- Header CRUD operations → `lockbox.service.js`
- Run CRUD operations → `lockbox.service.js`
- Field mapping CRUD → `field-mapping.service.js`

### **3. Validation Logic**
Extract to `validation.service.js`:
- Field validation
- Data type validation
- Required field checks

### **4. Run ID Generation**
Extract to `run-generator.service.js`:
- `generateRunId()`
- `generateUniqueId()`

---

## ✅ Benefits:

| Before | After |
|--------|-------|
| 10,000 lines in one file | 100-line main file + organized modules |
| Hard to find code | Clear directory structure |
| Difficult to test | Easy to unit test each module |
| Merge conflicts | Modular changes |
| No code reuse | Shared services |
| Unclear dependencies | Explicit imports |

---

## 🚀 Implementation Order:

1. ✅ Create directory structure
2. ⏳ Extract configuration files
3. ⏳ Extract middleware
4. ⏳ Extract services (one at a time)
5. ⏳ Extract routes (one at a time)
6. ⏳ Update server.js to use modules
7. ⏳ Test each module
8. ⏳ Remove duplicate code
9. ⏳ Final testing

---

## ⚠️ Testing Strategy:

After each extraction:
1. Test the specific endpoint
2. Run through full workflow (upload → validate → post)
3. Check logs for errors
4. Verify RULE-001 and RULE-004 still work

---

**This refactoring will make the codebase maintainable, testable, and scalable!** 🎯
