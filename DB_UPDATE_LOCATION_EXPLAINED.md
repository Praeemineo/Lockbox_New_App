# Where Database Updates Happen: postgresService.js vs server.js

## ✅ Clear Answer:

### **Database updates happen in: `/app/backend/server.js`**

### **NOT in postgresService.js**

---

## 📊 Comparison:

### **postgresService.js (364 lines)**
**Purpose:** Database connection and table creation ONLY

**What it does:**
- ✅ Creates database connection (`initDatabase()`)
- ✅ Tests connection (3 retry attempts)
- ✅ Creates tables (`initTables()`)
- ✅ Exports utility functions (`getPool()`, `query()`)

**What it does NOT do:**
- ❌ NO INSERT queries
- ❌ NO UPDATE queries  
- ❌ NO DELETE queries
- ❌ NO data operations
- ❌ NOT USED in the current application

**Code analysis:**
```bash
grep -c "INSERT INTO" postgresService.js
# Result: 0

grep -c "UPDATE.*SET" postgresService.js
# Result: 0

grep -c "DELETE FROM" postgresService.js
# Result: 0
```

---

### **server.js (9,403 lines)**
**Purpose:** EVERYTHING - Connection, tables, API endpoints, AND all database updates

**What it does:**
- ✅ Database connection setup (same as postgresService.js)
- ✅ Table creation (same as postgresService.js)
- ✅ **INSERT queries** - Creates new patterns/rules
- ✅ **UPDATE queries** - Updates existing patterns/rules
- ✅ **DELETE queries** - Removes patterns/rules
- ✅ API endpoints (POST, PUT, DELETE)
- ✅ All business logic

**Code analysis:**
```bash
grep -c "INSERT INTO" server.js
# Result: 20 occurrences

grep -c "ON CONFLICT.*DO UPDATE" server.js
# Result: 6 occurrences

grep -c "DELETE FROM" server.js
# Result: 7 occurrences
```

---

## 🔍 Detailed Breakdown:

### **Functions in server.js that UPDATE database:**

#### **1. File Patterns:**
```javascript
// Line ~3195-3281
async function savePatternToDb(pattern) {
    const query = `
        INSERT INTO file_pattern 
        (id, pattern_id, pattern_name, conditions, actions, ...)
        VALUES ($1, $2, $3, $4, $5, ...)
        ON CONFLICT (pattern_id) DO UPDATE SET
            pattern_name = EXCLUDED.pattern_name,
            conditions = EXCLUDED.conditions,
            actions = EXCLUDED.actions,
            ...
    `;
    await pool.query(query, [pattern.id, pattern.patternId, ...]);
}

// Line ~3364
async function deletePatternFromDb(patternId) {
    await pool.query('DELETE FROM file_pattern WHERE pattern_id = $1', [patternId]);
}
```

#### **2. Processing Rules:**
```javascript
// Line ~2940-3009
async function saveProcessingRuleToDb(rule) {
    const query = `
        INSERT INTO processing_rule 
        (id, rule_id, rule_name, description, conditions, api_mappings, ...)
        VALUES ($1, $2, $3, $4, $5, $6, ...)
        ON CONFLICT (rule_id) DO UPDATE SET
            rule_name = EXCLUDED.rule_name,
            description = EXCLUDED.description,
            conditions = EXCLUDED.conditions,
            api_mappings = EXCLUDED.api_mappings,
            ...
    `;
    await pool.query(query, [rule.id, rule.ruleId, ...]);
}

// Line ~3049
async function deleteProcessingRuleFromDb(ruleId) {
    await pool.query('DELETE FROM processing_rule WHERE rule_id = $1', [ruleId]);
}
```

#### **3. API Endpoints (Call the functions above):**
```javascript
// Line ~3932
app.post('/api/field-mapping/patterns', async (req, res) => {
    // ... create pattern
    await savePatternToDb(newPattern);  // ← Calls the function
    // ...
});

// Line ~4008
app.put('/api/field-mapping/patterns/:patternId', async (req, res) => {
    // ... update pattern
    await savePatternToDb(filePatterns[idx]);  // ← Calls the function
    // ...
});

// Line ~4301
app.put('/api/field-mapping/processing-rules/:ruleId', async (req, res) => {
    // ... update rule
    await saveProcessingRuleToDb(processingRules[idx]);  // ← Calls the function
    // ...
});
```

---

## 🤔 Why is postgresService.js NOT Used?

### **Historical Context:**

**postgresService.js was created** as part of a modular architecture plan to separate concerns:
- Database connection → `db/postgresService.js`
- Business logic → `server.js`
- Routes → `routes/`
- Services → `services/`

**However, the application kept using the monolithic approach:**
- Everything stayed in `server.js`
- The modular files (`db/`, `routes/`, `services/`) exist but are not imported
- All database operations happen directly in `server.js`

**Evidence:**
```bash
# Check if postgresService.js is imported in server.js
grep "require.*postgresService" /app/backend/server.js
# Result: No matches found

# Check if db/index.js is imported
grep "require.*db" /app/backend/server.js
# Result: No matches found
```

---

## 📁 Current Architecture:

```
/app/backend/
├── server.js                    ← ACTIVE - All database operations here
├── db/
│   ├── postgresService.js      ← INACTIVE - Not imported
│   └── index.js                ← INACTIVE - Not imported
├── services/
│   └── postgresService.js      ← INACTIVE - Not imported
└── routes/
    └── *.js                     ← INACTIVE - Not imported
```

**All database operations flow through:**
```
server.js
    ├─ Database connection (lines ~75-125)
    ├─ Table creation (lines ~153-400)
    ├─ savePatternToDb() (line ~3195)
    ├─ saveProcessingRuleToDb() (line ~2940)
    ├─ deletePatternFromDb() (line ~3364)
    ├─ deleteProcessingRuleFromDb() (line ~3049)
    └─ API endpoints that call these functions
```

---

## ✅ Summary:

| Aspect | postgresService.js | server.js |
|--------|-------------------|-----------|
| **File Size** | 364 lines | 9,403 lines |
| **Purpose** | Connection setup | Everything |
| **INSERT queries** | ❌ 0 | ✅ 20+ |
| **UPDATE queries** | ❌ 0 | ✅ 6+ |
| **DELETE queries** | ❌ 0 | ✅ 7+ |
| **Actually Used?** | ❌ NO | ✅ YES |
| **Imported?** | ❌ NO | ✅ Main file |
| **Updates DB?** | ❌ NO | ✅ YES |

---

## 🎯 Direct Answer to Your Question:

**Database updates happen in: `server.js`**

**Specific functions in server.js:**
1. `savePatternToDb()` - Line ~3195 - INSERT/UPDATE patterns
2. `saveProcessingRuleToDb()` - Line ~2940 - INSERT/UPDATE rules
3. `deletePatternFromDb()` - Line ~3364 - DELETE patterns
4. `deleteProcessingRuleFromDb()` - Line ~3049 - DELETE rules

**postgresService.js:**
- Only creates tables (CREATE TABLE IF NOT EXISTS)
- Does NOT insert, update, or delete data
- Not even imported/used in the application

---

## 🔧 If You Want to Verify:

**Check what's imported in server.js:**
```bash
grep "require.*postgres" /app/backend/server.js
# Result: Nothing related to postgresService.js

grep "const.*Pool.*pg" /app/backend/server.js
# Result: const { Pool } = require('pg');
# This is direct PostgreSQL library, not postgresService.js
```

**Check actual database operations:**
```bash
grep -n "savePatternToDb\|saveProcessingRuleToDb" /app/backend/server.js
# Shows: Multiple calls throughout server.js

grep -n "savePatternToDb\|saveProcessingRuleToDb" /app/backend/db/postgresService.js
# Shows: Nothing - these functions don't exist there
```

---

**Conclusion:** All database updates (INSERT, UPDATE, DELETE) happen in **`/app/backend/server.js`**. The file `postgresService.js` exists but is not used.
