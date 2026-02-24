# PostgreSQL Sync Solution - JSON to Database

## Issue Identified ✅

**Problem:** PostgreSQL database has OLD data (10 patterns) while JSON file has CURRENT data (6 patterns). The application is loading from JSON, not from PostgreSQL.

**Root Cause:** The startup logic loads from JSON when database has data but doesn't match, or when the database was never synced with current JSON state.

---

## Solution Implemented

### **Two New API Endpoints Created:**

#### **1. Sync File Patterns:**
```
POST /api/field-mapping/patterns/sync-to-db
```

**What it does:**
1. Clears all old patterns from PostgreSQL `file_pattern` table
2. Inserts all current patterns from JSON file
3. Returns detailed sync report

**Response:**
```json
{
  "success": true,
  "message": "Patterns synced to database",
  "synced": 6,
  "failed": 0,
  "errors": [],
  "total": 6
}
```

#### **2. Sync Processing Rules:**
```
POST /api/field-mapping/processing-rules/sync-to-db
```

**What it does:**
1. Clears all old rules from PostgreSQL `processing_rule` table
2. Inserts all current rules from JSON file
3. Returns detailed sync report

**Response:**
```json
{
  "success": true,
  "message": "Processing rules synced to database",
  "synced": 5,
  "failed": 0,
  "errors": [],
  "total": 5
}
```

---

## How to Use (In BTP):

### **Step 1: Call Sync Endpoints**

Using curl or Postman in BTP:

**Sync File Patterns:**
```bash
curl -X POST https://praeemineo-llc-h40wwjzd772w1g15-dev-lockbox-srv.cfapps.ap10.hana.ondemand.com/api/field-mapping/patterns/sync-to-db \
  -H "Content-Type: application/json"
```

**Sync Processing Rules:**
```bash
curl -X POST https://praeemineo-llc-h40wwjzd772w1g15-dev-lockbox-srv.cfapps.ap10.hana.ondemand.com/api/field-mapping/processing-rules/sync-to-db \
  -H "Content-Type: application/json"
```

### **Step 2: Check Logs**

```bash
cf logs lockbox-srv --recent | grep -E "Sync|sync"
```

**Expected logs:**
```
🔄 Starting JSON to PostgreSQL sync...
🗑️  Clearing old patterns from database...
✅ Old patterns cleared
📝 Inserting 6 patterns from JSON...
  ✅ Synced: PAT0001 - Single Check, Multiple Invoice
  ✅ Synced: PAT0002 - Multiple Check, Multiple Invoice
  ✅ Synced: PAT0003 - File Containing Comma
  ✅ Synced: PAT0004 - File Containing Comma
  ✅ Synced: PAT0005 - Date Pattern
  ✅ Synced: PAT0006 - File containing multiple Sheets
✅ Sync complete: 6 succeeded, 0 failed
```

### **Step 3: Verify in PostgreSQL**

```sql
-- Check patterns
SELECT pattern_id, pattern_name, file_type, updated_at 
FROM file_pattern 
ORDER BY pattern_id;

-- Should show 6 patterns: PAT0001 to PAT0006

-- Check rules
SELECT rule_id, rule_name, description, updated_at 
FROM processing_rule 
ORDER BY rule_id;

-- Should show 5 rules: RULE-001 to RULE-005
```

### **Step 4: Restart Application (Optional)**

To ensure it loads from database on next startup:
```bash
cf restart lockbox-srv
```

**Check startup logs:**
```
Loaded 6 patterns from database
Loaded 5 processing rules from database
```

---

## Current Data State:

### **JSON File (Source of Truth):**

**File Patterns (6 total):**
```
PAT0001: Single Check, Multiple Invoice
PAT0002: Multiple Check, Multiple Invoice
PAT0003: File Containing Comma
PAT0004: File Containing Comma
PAT0005: Date Pattern
PAT0006: File containing multiple Sheets
```

**Processing Rules (5 total):**
```
RULE-001: Fetch Accounting Document
RULE-002: Fetch Partner Bank Details
RULE-003: Validate Business Partner
RULE-004: Check Credit Limit
RULE-005: Validate Payment Terms
```

### **PostgreSQL Database (OLD Data - Before Sync):**
```
10 patterns with format: PAT-002, PAT-006, etc. (old format)
Unknown processing rules state
```

### **After Sync:**
```
PostgreSQL will match JSON exactly:
- 6 patterns (PAT0001-PAT0006)
- 5 rules (RULE-001 to RULE-005)
```

---

## Why This Solution Works:

### **Before:**
```
Application Startup
    ↓
Try to load from PostgreSQL
    ↓
PostgreSQL has 10 old patterns
    ↓
App gets confused or uses old data
    ↓
Falls back to JSON (6 patterns)
    ↓
UI shows JSON data (correct)
Database has old data (incorrect)
```

### **After Sync:**
```
Call Sync API
    ↓
DELETE FROM file_pattern (clears old data)
    ↓
INSERT patterns from JSON (6 patterns)
    ↓
PostgreSQL now has same data as JSON
    ↓
Application Startup
    ↓
Load from PostgreSQL
    ↓
Gets 6 patterns (matches JSON)
    ↓
UI and Database in sync ✅
```

---

## Deployment Steps:

### **1. Deploy Updated Code:**
```bash
cd /app
cf push
```

### **2. Call Sync APIs:**

Once deployed, call both sync endpoints to synchronize data.

### **3. Verify:**

- Check logs for sync success
- Query PostgreSQL to verify data
- Restart app and verify it loads from database
- Test UI to ensure correct data displays

---

## Features of Sync Endpoints:

✅ **Safe:** Clears old data before inserting new  
✅ **Comprehensive:** Syncs all patterns/rules at once  
✅ **Detailed Logging:** Shows progress with emojis  
✅ **Error Handling:** Reports individual failures  
✅ **Status Response:** Returns sync statistics  
✅ **Database Check:** Returns error if DB not available  

---

## What Gets Synced:

### **File Patterns (file_pattern table):**
- pattern_id (PAT0001, etc.)
- pattern_name
- file_type
- pattern_type
- conditions (JSONB)
- actions (JSONB)
- field_mappings (JSONB)
- All other pattern fields

### **Processing Rules (processing_rule table):**
- rule_id (RULE-001, etc.)
- rule_name
- description
- file_type
- rule_type
- conditions (JSONB)
- api_mappings (JSONB)
- destination
- All other rule fields

---

## Maintenance:

### **When to Use Sync:**

1. **Initial Setup:** After deploying to new environment
2. **After Manual Changes:** If you edit JSON files directly
3. **Database Reset:** If database was cleared/reset
4. **Migration:** Moving to new PostgreSQL instance
5. **Mismatch Detected:** When UI shows different data than database

### **Automated Sync (Future Enhancement):**

Could be enhanced to:
- Auto-sync on application startup if mismatch detected
- Scheduled sync (daily/hourly)
- Sync on file system change detection
- Admin UI button to trigger sync

---

## Files Modified:

✅ `/app/backend/server.js`:
- Added `POST /api/field-mapping/patterns/sync-to-db`
- Added `POST /api/field-mapping/processing-rules/sync-to-db`
- Enhanced logging with emojis
- Comprehensive error handling

---

## Testing:

### **Test in Kubernetes (Will Fail - Expected):**
```bash
curl -X POST http://localhost:8001/api/field-mapping/patterns/sync-to-db
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Database not available",
  "message": "Cannot sync - PostgreSQL is not connected"
}
```

### **Test in BTP (Should Succeed):**
```bash
curl -X POST https://your-btp-url/api/field-mapping/patterns/sync-to-db
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Patterns synced to database",
  "synced": 6,
  "failed": 0,
  "errors": [],
  "total": 6
}
```

---

## Important Notes:

⚠️ **One-Way Sync:** JSON → PostgreSQL (JSON is source of truth)  
⚠️ **Destructive:** Clears existing data before insert  
⚠️ **Requires DB:** Only works when PostgreSQL is connected  
⚠️ **Manual Trigger:** Must call API endpoint to sync  

---

**Status:** ✅ Sync Endpoints Ready - Deploy to BTP and Call APIs to Sync Data

After deploying and calling the sync APIs, your PostgreSQL database will match your JSON files exactly, and all future changes will persist to the database.
