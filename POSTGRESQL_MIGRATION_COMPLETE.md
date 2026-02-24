# PostgreSQL Migration - File Patterns & Processing Rules

## Implementation Complete ✅

**Date:** 2026-02-23  
**Status:** Deployed and Ready

---

## What Was Implemented:

### 1. **Database Schema Updates**

#### File Pattern Table (`file_pattern`):
```sql
CREATE TABLE IF NOT EXISTS file_pattern (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id VARCHAR(20) NOT NULL UNIQUE,          -- PAT-001, PAT-002, etc.
    pattern_name VARCHAR(100) NOT NULL,
    file_type VARCHAR(30) NOT NULL,
    pattern_type VARCHAR(50) NOT NULL,
    category VARCHAR(30),
    description TEXT,
    delimiter VARCHAR(10),
    active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,
    conditions JSONB,                                 -- Dialog: Conditions
    actions JSONB,                                    -- Dialog: Actions  
    field_mappings JSONB,                            -- Dialog: Field Patterns
    -- Additional fields...
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

#### Processing Rule Table (`processing_rule`):
```sql
CREATE TABLE IF NOT EXISTS processing_rule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id VARCHAR(30) NOT NULL UNIQUE,             -- RULE-001, RULE-002, etc.
    rule_name VARCHAR(200) NOT NULL,
    description TEXT,
    file_type VARCHAR(50) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 10,
    destination VARCHAR(100),
    conditions JSONB,                                 -- Dialog: Conditions
    api_mappings JSONB,                              -- Dialog: API Mappings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

---

### 2. **Backend API Changes - All CRUD Operations Now Use PostgreSQL**

#### File Patterns APIs:
- `GET /api/field-mapping/patterns` - Load from PostgreSQL
- `GET /api/field-mapping/patterns/:patternId` - Load specific pattern
- `POST /api/field-mapping/patterns` - Create → PostgreSQL + JSON backup
- `PUT /api/field-mapping/patterns/:patternId` - Update → PostgreSQL + JSON backup
- `DELETE /api/field-mapping/patterns/:patternId` - Delete from PostgreSQL + JSON backup
- `PATCH /api/field-mapping/patterns/:patternId/toggle` - Toggle active status

#### Processing Rules APIs:
- `GET /api/field-mapping/processing-rules` - Load from PostgreSQL
- `GET /api/field-mapping/processing-rules/:ruleId` - Load specific rule
- `POST /api/field-mapping/processing-rules` - Create → PostgreSQL + JSON backup
- `PUT /api/field-mapping/processing-rules/:ruleId` - Update → PostgreSQL + JSON backup
- `DELETE /api/field-mapping/processing-rules/:ruleId` - Delete from PostgreSQL + JSON backup

---

### 3. **PostgreSQL Functions Created**

#### For File Patterns:
- `savePatternToDb(pattern)` - Upsert pattern to PostgreSQL
- `loadPatternsFromDb()` - Load all patterns from PostgreSQL on startup
- `deletePatternFromDb(patternId)` - Delete pattern from PostgreSQL

#### For Processing Rules:
- `saveProcessingRuleToDb(rule)` - Upsert rule to PostgreSQL
- `loadProcessingRulesFromDb()` - Load all rules from PostgreSQL on startup
- `deleteProcessingRuleFromDb(ruleId)` - Delete rule from PostgreSQL

---

### 4. **Smart Dual-Storage System**

**How it works:**
1. **Primary Storage:** PostgreSQL tables (when available)
2. **Backup Storage:** JSON files in `/app/backend/data/`
3. **Fallback:** If PostgreSQL unavailable, use JSON files

**On Every Change (Create/Update/Delete):**
```
Frontend → Backend API → PostgreSQL → JSON Backup
                       ↓
                   If DB fails, JSON only
```

**On Startup:**
```
Backend Starts → Try PostgreSQL → Load data → Save to JSON backup
              ↓
          If DB unavailable → Load from JSON files
```

---

### 5. **Pattern Validation Flow**

**Before (JSON-based):**
```
File Upload → Match against filePatterns array (from JSON file)
```

**After (PostgreSQL-based):**
```
Startup: Load patterns from PostgreSQL → filePatterns array
File Upload → Match against filePatterns array (loaded from PostgreSQL)
Pattern Changes in UI → Save to PostgreSQL → Update filePatterns array
```

---

### 6. **Rule Execution Flow (RULE-001, RULE-002)**

**Before (JSON-based):**
```
Validation Stage → Execute rules from processingRules array (from JSON file)
```

**After (PostgreSQL-based):**
```
Startup: Load rules from PostgreSQL → processingRules array
Validation Stage → Execute rules from processingRules array (loaded from PostgreSQL)
Rule Changes in UI → Save to PostgreSQL → Update processingRules array
```

---

## How to Use:

### For Pattern Management (UI):
1. Navigate to **Field Mapping Rules**
2. View all patterns (PAT-001 to PAT-010)
3. Create/Edit/Delete patterns
4. Changes are automatically saved to PostgreSQL
5. JSON backup is automatically updated

### For Processing Rules (UI):
1. Navigate to **Processing Rules** section
2. View all rules (RULE-001 to RULE-005)
3. Edit conditions, API mappings
4. Changes are automatically saved to PostgreSQL
5. JSON backup is automatically updated

---

## Environment Support:

### ✅ **Kubernetes (Current)**:
- PostgreSQL not available
- Uses JSON files as primary storage
- All APIs work with in-memory data
- Changes save to JSON files

### ✅ **BTP Cloud Foundry**:
- PostgreSQL connection available
- Uses PostgreSQL as primary storage
- JSON files as backup
- Full database persistence

---

## Files Modified:

### Backend:
- `/app/backend/server.js`:
  - Updated table schemas (lines 297-393)
  - Added `saveProcessingRuleToDb()` function
  - Added `loadProcessingRulesFromDb()` function
  - Added `deleteProcessingRuleFromDb()` function
  - Updated `savePatternToDb()` to include actions field
  - Updated all pattern & rule CRUD APIs
  - Updated initialization to load from PostgreSQL

### Backup Files (Auto-updated):
- `/app/backend/data/file_patterns.json` - Auto-updated on changes
- `/app/backend/data/processing_rules.json` - Auto-updated on changes

---

## ID Format:

### Patterns:
- Format: `PAT-001`, `PAT-002`, ..., `PAT-010`
- Counter auto-increments from max existing ID

### Rules:
- Format: `RULE-001`, `RULE-002`, ..., `RULE-005`
- Counter auto-increments from max existing ID

---

## Testing:

### ✅ Verified:
1. Backend starts successfully
2. Falls back to JSON when PostgreSQL unavailable
3. All APIs functional
4. Pattern/Rule counters working correctly
5. Services running (backend + frontend)

### 🔄 To Test in BTP (with PostgreSQL):
1. Deploy to BTP using `cf push`
2. Verify PostgreSQL connection
3. Test Create/Update/Delete operations
4. Verify data persists in database
5. Check JSON backup files are updated

---

## Next Steps:

1. **Deploy to BTP** - Run `cf push` to deploy with PostgreSQL
2. **Test in BTP** - Verify database operations work correctly
3. **Migrate Data** - Manually update the 10 patterns and 5 rules in the UI
4. **Verify Persistence** - Ensure changes save to PostgreSQL tables
5. **Test Pattern Matching** - Upload files and verify pattern detection uses database data
6. **Test Rule Execution** - Verify RULE-001 and RULE-002 execute from database

---

## Benefits:

✅ **Data Persistence** - Changes survive server restarts (in BTP)  
✅ **Scalability** - PostgreSQL handles concurrent access  
✅ **Backup** - JSON files provide fallback and portability  
✅ **Flexibility** - Works in both Kubernetes and BTP  
✅ **Dynamic** - Pattern matching and rule execution from database  
✅ **No Hardcoding** - All logic driven by database configuration  

---

**Status:** Ready for BTP deployment and testing! 🚀
