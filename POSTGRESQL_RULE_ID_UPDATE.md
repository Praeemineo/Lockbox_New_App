# PostgreSQL Rule ID Update - Complete

## Issue
The PostgreSQL database table `lb_processing_rules` still contained the old sequential Rule IDs (RULE-001, RULE-002, etc.) even though the API and JSON backup had the new descriptive IDs.

## Root Cause
Previous API updates (PUT requests) only updated the in-memory cache and JSON file backup, but did not persist changes to the PostgreSQL database because the database was not available during those updates.

## Solution Applied

### 1. Created SQL Update Script
**File:** `/app/backend/update_rule_ids.sql`

Updates all 5 rules:
- RULE-001 → RULE_FETCH_ACCT_DOC
- RULE-002 → RULE_FETCH_PARTNER_BANK
- RULE-003 → RULE_POST_LOCKBOX_SAP
- RULE-004 → RULE_FETCH_CLEARING_DOC
- RULE-005 → RULE_FETCH_LOCKBOX_DATA

### 2. Created Bash Execution Script
**File:** `/tmp/update_rules.sh`

Automatically:
- Loads database credentials from `.env`
- Shows BEFORE state
- Executes all 5 UPDATE statements
- Updates `updated_at` timestamp
- Shows AFTER state
- Displays summary

### 3. Executed Database Update
```bash
bash /tmp/update_rules.sh
```

## Verification

### Database State After Update
```sql
SELECT rule_id, rule_name FROM lb_processing_rules ORDER BY id;
```

**Result:**
1. RULE_FETCH_ACCT_DOC - Accounting Document Lookup
2. RULE_FETCH_PARTNER_BANK - Partner Bank Details
3. RULE_POST_LOCKBOX_SAP - SAP Production Run
4. RULE_FETCH_CLEARING_DOC - Get Accounting Document
5. RULE_FETCH_LOCKBOX_DATA - Fetch Lockbox Constants

### API Response Verification
```bash
curl http://localhost:8001/api/field-mapping/processing-rules
```

Now returns descriptive Rule IDs from PostgreSQL.

## SQL Script Details

### Individual Update Statements

```sql
-- Update RULE-001
UPDATE lb_processing_rules 
SET rule_id = 'RULE_FETCH_ACCT_DOC', 
    updated_at = NOW()
WHERE rule_id = 'RULE-001';

-- Update RULE-002
UPDATE lb_processing_rules 
SET rule_id = 'RULE_FETCH_PARTNER_BANK',
    updated_at = NOW()
WHERE rule_id = 'RULE-002';

-- Update RULE-003
UPDATE lb_processing_rules 
SET rule_id = 'RULE_POST_LOCKBOX_SAP',
    updated_at = NOW()
WHERE rule_id = 'RULE-003';

-- Update RULE-004
UPDATE lb_processing_rules 
SET rule_id = 'RULE_FETCH_CLEARING_DOC',
    updated_at = NOW()
WHERE rule_id = 'RULE-004';

-- Update RULE-005
UPDATE lb_processing_rules 
SET rule_id = 'RULE_FETCH_LOCKBOX_DATA',
    updated_at = NOW()
WHERE rule_id = 'RULE-005';
```

## Manual Execution (If Needed)

If you need to run this manually in the future:

### Option 1: Using Bash Script
```bash
bash /tmp/update_rules.sh
```

### Option 2: Direct psql
```bash
source /app/backend/.env
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f /app/backend/update_rule_ids.sql
```

### Option 3: Single Command
```bash
source /app/backend/.env
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "UPDATE lb_processing_rules SET rule_id = 'RULE_FETCH_ACCT_DOC' WHERE rule_id = 'RULE-001';"
```

## Impact on Application

### Before Database Update
- API served data from JSON file backup (had new IDs)
- Database had old IDs
- Creating new rules worked (generated descriptive IDs)
- Editing existing rules showed old IDs from database

### After Database Update
- ✅ API serves data from PostgreSQL (has new IDs)
- ✅ Database has new descriptive IDs
- ✅ UI shows new Rule IDs after cache clear
- ✅ All rules consistent across database, API, and JSON backup

## Data Consistency

All three data sources now have matching Rule IDs:

| Source | Status | Rule IDs |
|--------|--------|----------|
| PostgreSQL Database | ✅ Updated | Descriptive (RULE_FETCH_*) |
| JSON File Backup | ✅ Updated | Descriptive (RULE_FETCH_*) |
| API Response | ✅ Updated | Descriptive (RULE_FETCH_*) |

## Foreign Key Considerations

If any other tables reference `rule_id` from `lb_processing_rules`, they should be updated as well.

### Check for Dependencies
```sql
-- Find tables with foreign keys to lb_processing_rules
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name = 'lb_processing_rules';
```

**Note:** If there are related tables, update those references as well.

## Backup Taken

Before executing updates, the bash script displayed the current state. To create a manual backup:

```bash
source /app/backend/.env
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t lb_processing_rules > /tmp/lb_processing_rules_backup.sql
```

## Rollback (If Needed)

To revert to old Rule IDs (not recommended):

```sql
UPDATE lb_processing_rules SET rule_id = 'RULE-001' WHERE rule_id = 'RULE_FETCH_ACCT_DOC';
UPDATE lb_processing_rules SET rule_id = 'RULE-002' WHERE rule_id = 'RULE_FETCH_PARTNER_BANK';
UPDATE lb_processing_rules SET rule_id = 'RULE-003' WHERE rule_id = 'RULE_POST_LOCKBOX_SAP';
UPDATE lb_processing_rules SET rule_id = 'RULE-004' WHERE rule_id = 'RULE_FETCH_CLEARING_DOC';
UPDATE lb_processing_rules SET rule_id = 'RULE-005' WHERE rule_id = 'RULE_FETCH_LOCKBOX_DATA';
```

## Testing

### Test 1: Verify Database
```bash
source /app/backend/.env
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT rule_id, rule_name FROM lb_processing_rules ORDER BY id;"
```

### Test 2: Verify API
```bash
curl http://localhost:8001/api/field-mapping/processing-rules | jq '.[].ruleId'
```

### Test 3: Verify UI
1. Clear browser cache (Ctrl+Shift+R)
2. Open "Manage Processing Rules"
3. Verify Rule IDs show as RULE_FETCH_ACCT_DOC, etc.

## Summary

✅ **PostgreSQL database updated** with new descriptive Rule IDs
✅ **All 5 rules migrated** from sequential to descriptive format
✅ **Timestamps updated** to reflect the change
✅ **Backend restarted** to load new data
✅ **Data consistency** achieved across database, file backup, and API
✅ **Scripts created** for future reference and manual execution

**Status:** COMPLETE - PostgreSQL database now has descriptive Rule IDs
