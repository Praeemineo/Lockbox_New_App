# 🏗️ CODE STRUCTURE GUIDE

## ⚠️ CRITICAL: Where to Add New Code

**NEVER add business logic to `/app/backend/server.js`**  
**server.js is ONLY for bootstrapping and routing**

---

## 📂 Directory Structure

```
/app/backend/
│
├── srv/                          # SERVICE LAYER (⚠️ ADD ALL NEW CODE HERE)
│   ├── handlers/                 # ⭐ Business Logic Handlers
│   │   ├── upload.js            # File upload logic
│   │   ├── parser.js            # Pattern detection & extraction
│   │   ├── rule-engine.js       # Dynamic rule execution
│   │   ├── sap-posting.js       # SAP integration & posting
│   │   ├── batch-status.js      # Batch status management
│   │   └── error-handler.js     # Error handling
│   │
│   ├── models/                   # ⭐ Data Models
│   │   └── data-models.js       # Patterns, Rules, API Fields
│   │
│   ├── services/                 # ⭐ Service Definitions
│   │   └── routes.js            # API route definitions
│   │
│   ├── integrations/             # ⭐ External Integrations
│   │   └── sap-client.js        # SAP Cloud SDK client
│   │
│   └── utils/                    # ⭐ Utility Functions
│       ├── logger.js            # Logging utility
│       ├── file-utils.js        # File operations
│       └── date-utils.js        # Date operations
│
├── data/                         # Data Files (JSON)
│   ├── file_patterns.json       # 6 file patterns with actions
│   ├── processing_rules.json    # 5 processing rules
│   └── api_fields.json          # API field definitions
│
├── migrations/                   # Database migrations
├── tests/                        # Test files
├── app/                          # Frontend (SAPUI5)
└── server.js                     # ⚠️ BOOTSTRAP ONLY (100 lines max)
```

---

## 🎯 Where to Add What

### **1. New File Pattern Logic?**
**Location**: `/app/backend/srv/handlers/parser.js`
- Pattern detection
- Condition checking
- Action execution
- Data extraction

**Example**:
```javascript
// srv/handlers/parser.js
function detectFilePattern(data, headers) {
    // Your pattern detection logic here
}
```

---

### **2. New Processing Rule?**
**Location**: `/app/backend/srv/handlers/rule-engine.js`
- Rule condition checking
- Rule execution
- API mapping
- Data enrichment

**Example**:
```javascript
// srv/handlers/rule-engine.js
async function executeRule(rule, data) {
    // Your rule execution logic here
}
```

---

### **3. New SAP API Call?**
**Location**: `/app/backend/srv/handlers/sap-posting.js`
- SAP posting logic
- Document creation
- Clearing logic

**Example**:
```javascript
// srv/handlers/sap-posting.js
async function postToSAP(payload) {
    // Your SAP posting logic here
}
```

---

### **4. New API Endpoint?**
**Location**: `/app/backend/srv/services/routes.js`
- Define new routes
- Map routes to handlers

**Example**:
```javascript
// srv/services/routes.js
router.post('/api/new-endpoint', async (req, res) => {
    const handler = require('../handlers/your-handler');
    const result = await handler.process(req.body);
    res.json(result);
});
```

---

### **5. New Utility Function?**
**Location**: `/app/backend/srv/utils/`
- **File operations** → `file-utils.js`
- **Date operations** → `date-utils.js`
- **Logging** → `logger.js`

**Example**:
```javascript
// srv/utils/file-utils.js
function newFileUtility() {
    // Your utility function here
}
```

---

### **6. New Data Model?**
**Location**: `/app/backend/srv/models/data-models.js`
- Load/save patterns
- Load/save rules
- Load/save API fields

**Example**:
```javascript
// srv/models/data-models.js
async function getNewDataModel() {
    // Your data loading logic here
}
```

---

### **7. New External Integration?**
**Location**: `/app/backend/srv/integrations/`
- SAP Cloud SDK → `sap-client.js`
- Other APIs → Create new file

**Example**:
```javascript
// srv/integrations/sap-client.js
async function callSAPAPI(endpoint, params) {
    // Your SAP API call here
}
```

---

## ⚠️ What NOT to Do

### ❌ **DON'T Add Code Here:**
- `/app/backend/server.js` - Only bootstrapping allowed
- Any file outside `/app/backend/srv/` - Keep business logic in srv/

### ❌ **DON'T Create Files in Root:**
- Create in appropriate srv/ subfolder
- Follow module naming conventions

---

## ✅ Best Practices

### **1. Module Naming**
```
✅ srv/handlers/pattern-matcher.js  (kebab-case)
❌ srv/PatternMatcher.js            (PascalCase - avoid)
```

### **2. Function Naming**
```
✅ async function detectFilePattern() {}  (camelCase)
❌ async function DetectFilePattern() {}  (PascalCase - avoid)
```

### **3. File Organization**
```
✅ One handler per responsibility
✅ Handlers import from models/utils
❌ One massive file with everything
```

### **4. Documentation**
```
✅ Add JSDoc comments to all exported functions
✅ Include examples in complex functions
✅ Document parameters and return types
```

---

## 🔄 Workflow for Adding New Feature

### **Step 1: Identify Module**
```
New feature: "Add invoice range validation"

Where does it go?
→ Pattern detection logic? → srv/handlers/parser.js
→ Rule execution logic? → srv/handlers/rule-engine.js
→ SAP posting logic? → srv/handlers/sap-posting.js
→ Utility function? → srv/utils/
```

### **Step 2: Add Code to Module**
```javascript
// srv/handlers/parser.js
function validateInvoiceRange(invoices) {
    // Your validation logic
}

module.exports = {
    ...existingExports,
    validateInvoiceRange  // Export new function
};
```

### **Step 3: Use in Handler**
```javascript
// srv/handlers/upload.js
const { validateInvoiceRange } = require('./parser');

async function processUpload(file) {
    const valid = validateInvoiceRange(data.invoices);
    // ...
}
```

### **Step 4: Test**
```javascript
// tests/parser.test.js
const { validateInvoiceRange } = require('../srv/handlers/parser');

test('validates invoice range', () => {
    expect(validateInvoiceRange(['INV-001', 'INV-002'])).toBe(true);
});
```

---

## 📊 Code Organization Principles

### **Single Responsibility**
Each module has ONE clear purpose:
- `parser.js` - Pattern detection ONLY
- `rule-engine.js` - Rule execution ONLY
- `sap-posting.js` - SAP posting ONLY

### **Dependency Direction**
```
handlers → models → utils
   ↓
integrations → utils
```

**Never**: utils → handlers (wrong direction!)

### **Module Coupling**
```
✅ Loose coupling: Handlers import from models
✅ High cohesion: Related functions in same module
❌ Tight coupling: Handlers directly modify each other's state
```

---

## 🚫 Common Mistakes to Avoid

### **Mistake 1: Adding Code to server.js**
```javascript
❌ BAD:
// server.js
app.post('/api/upload', (req, res) => {
    // 500 lines of upload logic here  ← DON'T DO THIS
});

✅ GOOD:
// server.js
app.post('/api/upload', uploadHandler);  ← Delegate to handler

// srv/handlers/upload.js
async function uploadHandler(req, res) {
    // Upload logic in proper module
}
```

### **Mistake 2: Creating Monolithic Files**
```javascript
❌ BAD: srv/handlers/everything.js (5000 lines)

✅ GOOD:
srv/handlers/upload.js (200 lines)
srv/handlers/parser.js (300 lines)
srv/handlers/rule-engine.js (400 lines)
```

### **Mistake 3: Mixing Concerns**
```javascript
❌ BAD: srv/handlers/upload-and-post-to-sap.js

✅ GOOD:
srv/handlers/upload.js
srv/handlers/sap-posting.js
```

---

## 📝 Quick Reference Card

**Print this and keep it visible!**

```
┌─────────────────────────────────────────────────────────┐
│  NEW CODE LOCATION QUICK REFERENCE                      │
├─────────────────────────────────────────────────────────┤
│  Pattern logic      → srv/handlers/parser.js           │
│  Rule logic         → srv/handlers/rule-engine.js      │
│  SAP posting        → srv/handlers/sap-posting.js      │
│  File upload        → srv/handlers/upload.js           │
│  API routes         → srv/services/routes.js           │
│  Data access        → srv/models/data-models.js        │
│  Utilities          → srv/utils/                       │
│  SAP integration    → srv/integrations/sap-client.js   │
│                                                          │
│  ⚠️  server.js      → BOOTSTRAP ONLY (don't touch!)    │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Summary

**Golden Rule**: If it's business logic, it goes in `/app/backend/srv/`, NOT in `server.js`

**server.js Role**: 
- Bootstrap app
- Load modules
- Register routes
- Start server
- **THAT'S IT!**

**Everything Else**: Goes in appropriate `srv/` module

---

## 📧 Questions?

If unsure where to add code, ask:
1. What is the code doing?
2. Which existing module handles similar logic?
3. If new functionality, create new module in appropriate folder

**Remember**: It's better to create a new, small module than to add to server.js!
