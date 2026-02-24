# PostgreSQL Database Update - File Structure in BTP

## 📂 Main Folder: `/app/backend/`

This is the **ONLY** folder that handles PostgreSQL database updates in BTP.

---

## 🗂️ Key Files for Database Operations:

### **1. Main Server File**
```
/app/backend/server.js
```

**What it does:**
- Main application entry point
- Contains ALL database update logic
- Handles API endpoints (POST, PUT, DELETE)
- Contains database save functions
- **Lines 3195-3281:** `savePatternToDb()` function
- **Lines 2940-3009:** `saveProcessingRuleToDb()` function
- **Lines 3880-4005:** POST /api/field-mapping/patterns (Create pattern)
- **Lines 4007-4039:** PUT /api/field-mapping/patterns/:patternId (Update pattern)
- **Lines 4041-4067:** DELETE /api/field-mapping/patterns/:patternId (Delete pattern)
- **Lines 4301-4335:** PUT /api/field-mapping/processing-rules/:ruleId (Update rule)
- **Lines 4273-4299:** POST /api/field-mapping/processing-rules (Create rule)
- **Lines 4337-4357:** DELETE /api/field-mapping/processing-rules/:ruleId (Delete rule)

**How it updates database:**
```javascript
// Example from server.js
async function savePatternToDb(pattern) {
    if (!dbAvailable) return;
    
    const query = `
        INSERT INTO file_pattern (id, pattern_id, pattern_name, ...)
        VALUES ($1, $2, $3, ...)
        ON CONFLICT (pattern_id) DO UPDATE SET
            pattern_name = EXCLUDED.pattern_name,
            ...
    `;
    
    await pool.query(query, [pattern.id, pattern.patternId, ...]);
}
```

---

### **2. Database Service Files (Alternative Architecture - Not Currently Used)**

```
/app/backend/db/
├── index.js              # Database module exports
└── postgresService.js    # Database connection service
```

**Note:** These files exist but are **NOT actively used** in the current implementation. All database operations are in `server.js`.

---

### **3. Configuration Files**

#### **For BTP Deployment:**
```
/app/mta.yaml
```
**Lines 18-23:** PostgreSQL credentials
```yaml
properties:
  DB_HOST: "postgres-aee790df...amazonaws.com"
  DB_PORT: "2477"
  DB_NAME: "CAmqjnIfEdIX"
  DB_USER: "CAmqjnIfEdIX"
  DB_PASSWORD: "593373429221a65ff07f625d1b"
  DB_SSL: "true"
```

#### **For Cloud Foundry Push:**
```
/app/manifest.yml
```
**Lines 12-17:** SAP credentials (database credentials should also be added here)

#### **For Local/Kubernetes:**
```
/app/backend/.env
```
**Lines 2-7:** Database credentials
```
DB_HOST=postgres-aee790df...
DB_PORT=2477
DB_NAME=CAmqjnIfEdIX
DB_USER=CAmqjnIfEdIX
DB_PASSWORD=593373429221a65ff07f625d1b
DB_SSL=true
```

---

### **4. Data Backup Files (JSON)**

```
/app/backend/data/
├── file_patterns.json        # Pattern backup
└── processing_rules.json     # Rules backup
```

**Purpose:**
- Fallback when database unavailable
- Updated whenever database is updated
- Source of truth in Kubernetes environment

---

## 🔄 Complete Data Flow in BTP:

```
1. USER MAKES CHANGE IN UI
   (Field Mapping Rules → Edit Pattern/Rule)
     ↓
2. FRONTEND SENDS API REQUEST
   POST/PUT/DELETE to backend
     ↓
3. BACKEND RECEIVES REQUEST
   /app/backend/server.js (API endpoint)
     ↓
4. UPDATE IN-MEMORY ARRAY
   filePatterns[] or processingRules[]
     ↓
5. CALL DATABASE FUNCTION
   savePatternToDb() or saveProcessingRuleToDb()
     ↓
6. DATABASE CONNECTION
   Uses pool from /app/backend/server.js
   Pool configured with credentials from mta.yaml
     ↓
7. EXECUTE SQL QUERY
   INSERT ... ON CONFLICT ... DO UPDATE
   (Upsert operation to PostgreSQL)
     ↓
8. UPDATE JSON BACKUP
   savePatternsToFile() or saveProcessingRulesToFile()
   Saves to /app/backend/data/
     ↓
9. RETURN SUCCESS RESPONSE
   { success: true, dbSaved: true }
     ↓
10. FRONTEND UPDATES UI
```

---

## 📊 Database Tables Used:

### **1. file_pattern table**
**Updated by:**
- `savePatternToDb()` function in `/app/backend/server.js` (line ~3195)
- Called from POST/PUT/DELETE endpoints

**Columns:**
```sql
id UUID PRIMARY KEY
pattern_id VARCHAR(20) UNIQUE    -- PAT0001, PAT0002, etc.
pattern_name VARCHAR(100)
file_type VARCHAR(30)
pattern_type VARCHAR(50)
conditions JSONB
actions JSONB
field_mappings JSONB
... (30+ columns)
updated_at TIMESTAMP
```

### **2. processing_rule table**
**Updated by:**
- `saveProcessingRuleToDb()` function in `/app/backend/server.js` (line ~2940)
- Called from POST/PUT/DELETE endpoints

**Columns:**
```sql
id UUID PRIMARY KEY
rule_id VARCHAR(30) UNIQUE       -- RULE-001, RULE-002, etc.
rule_name VARCHAR(200)
description TEXT
conditions JSONB
api_mappings JSONB
destination VARCHAR(100)
... (12+ columns)
updated_at TIMESTAMP
```

---

## 🔧 How Database Connection Works:

### **In server.js:**

**Step 1: Database Initialization (Line ~75-125)**
```javascript
function initDatabase() {
    // Try BTP service binding first
    if (process.env.VCAP_SERVICES) {
        // ... (not used currently)
    }
    
    // Use direct credentials from environment
    const dbHost = process.env.DB_HOST;  // From mta.yaml
    const dbPort = process.env.DB_PORT;
    const dbName = process.env.DB_NAME;
    const dbUser = process.env.DB_USER;
    const dbPassword = process.env.DB_PASSWORD;
    const dbSsl = process.env.DB_SSL === 'true';
    
    pool = new Pool({
        host: dbHost,
        port: dbPort,
        database: dbName,
        user: dbUser,
        password: dbPassword,
        ssl: dbSsl ? { rejectUnauthorized: false } : false
    });
}
```

**Step 2: Connection Test (Line ~129-150)**
```javascript
async function initTables() {
    // Try connection 3 times with 2s delay
    for (let i = 1; i <= 3; i++) {
        try {
            await pool.query('SELECT 1');
            dbAvailable = true;
            break;
        } catch (err) {
            console.log(`Connection attempt ${i}/3...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}
```

**Step 3: Create Tables (Line ~153-400)**
```javascript
// Create all necessary tables
await pool.query(`CREATE TABLE IF NOT EXISTS file_pattern (...)`);
await pool.query(`CREATE TABLE IF NOT EXISTS processing_rule (...)`);
// ... other tables
```

---

## 🚀 Deployment Process:

### **When you deploy to BTP:**

```bash
# Option 1: Using cf push
cd /app
cf push

# Option 2: Using MTA build
cd /app
mbt build
cf deploy mta_archives/lockbox-app_1.0.0.mtar
```

**What happens:**
1. Code from `/app/backend/` is deployed
2. `mta.yaml` sets environment variables (DB_HOST, DB_PORT, etc.)
3. Application starts, runs `initDatabase()`
4. Connects to PostgreSQL using credentials from environment
5. Creates tables if they don't exist
6. Loads patterns/rules from database
7. Ready to receive API requests

---

## 📝 Key Database Functions in server.js:

### **Pattern Functions:**
```javascript
// Line ~3195
async function savePatternToDb(pattern)
  → INSERT INTO file_pattern ... ON CONFLICT ... DO UPDATE

// Line ~3276
async function loadPatternsFromDb()
  → SELECT * FROM file_pattern

// Line ~3289
async function deletePatternFromDb(patternId)
  → DELETE FROM file_pattern WHERE pattern_id = ?
```

### **Processing Rule Functions:**
```javascript
// Line ~2940
async function saveProcessingRuleToDb(rule)
  → INSERT INTO processing_rule ... ON CONFLICT ... DO UPDATE

// Line ~3009
async function loadProcessingRulesFromDb()
  → SELECT * FROM processing_rule

// Line ~3045
async function deleteProcessingRuleFromDb(ruleId)
  → DELETE FROM processing_rule WHERE rule_id = ?
```

---

## 🔍 How to Verify Database Updates:

### **1. Check Logs:**
```bash
cf logs lockbox-srv --recent | grep -E "PostgreSQL|database|save"
```

**Look for:**
```
💾 Saving processing rule to PostgreSQL: RULE-001
✅ Processing rule saved to database: RULE-001
📄 Saved to JSON backup file
```

### **2. Query Database Directly:**
```sql
-- Connect to PostgreSQL
psql -h postgres-aee790df-b48b-48cc-96b3-db432a62390e.czuelothxj0h.ap-southeast-2.rds.amazonaws.com \
     -p 2477 \
     -U CAmqjnIfEdIX \
     -d CAmqjnIfEdIX

-- Check patterns
SELECT pattern_id, pattern_name, updated_at 
FROM file_pattern 
ORDER BY updated_at DESC 
LIMIT 5;

-- Check rules
SELECT rule_id, rule_name, updated_at 
FROM processing_rule 
ORDER BY updated_at DESC 
LIMIT 5;
```

### **3. Check API Response:**
When you save a pattern/rule, response includes:
```json
{
  "success": true,
  "dbSaved": true  // ← Confirms database update
}
```

---

## ⚠️ Important Notes:

### **Single File Architecture:**
- **ALL database operations** are in `/app/backend/server.js`
- **NO separate database layer** (unlike typical MVC architecture)
- Functions are defined in `server.js` and called from API endpoints

### **Database Pool:**
- Global `pool` variable in `server.js` (line ~73)
- Shared by all database operations
- Initialized once on application startup

### **Credentials Source:**
- **BTP:** From `mta.yaml` properties → Environment variables
- **Kubernetes:** From `.env` file
- **Both use same code:** `process.env.DB_HOST`, `process.env.DB_PORT`, etc.

---

## 📁 Summary - Files That Update PostgreSQL:

### **Active Files:**
✅ `/app/backend/server.js` - **PRIMARY FILE** - All database operations  
✅ `/app/mta.yaml` - Database credentials for BTP  
✅ `/app/backend/.env` - Database credentials for Kubernetes  
✅ `/app/backend/data/*.json` - Backup files (updated when DB updated)  

### **Inactive Files (Not Used):**
❌ `/app/backend/db/postgresService.js` - Exists but not used  
❌ `/app/backend/db/index.js` - Exists but not used  
❌ `/app/backend/services/postgresService.js` - Exists but not used  

---

**The answer to your question:** PostgreSQL database is updated from **`/app/backend/server.js`** only. This single file contains all database connection logic, table creation, and CRUD operations for patterns and rules.
