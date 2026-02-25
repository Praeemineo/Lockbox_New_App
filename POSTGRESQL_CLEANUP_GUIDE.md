# PostgreSQL Table Cleanup Guide

## Objective
Drop the old `processing_rule` table from PostgreSQL after verifying that the new `lb_processing_rules` table is working correctly in your SAP BTP environment.

---

## ⚠️ IMPORTANT: Pre-requisites

**Before dropping the old table, ensure:**
1. ✅ Application is deployed to SAP BTP using `cf push`
2. ✅ New `lb_processing_rules` table is created and working
3. ✅ All CRUD operations tested and verified on BTP
4. ✅ Data is properly synced to the new table

---

## Option 1: Using SAP BTP Cockpit (GUI Method)

### Step 1: Access Database
1. Log in to SAP BTP Cockpit
2. Navigate to your Space
3. Go to your PostgreSQL service instance
4. Click on "Open Dashboard" or "Manage" (depends on service)
5. Log in with your database credentials

### Step 2: Execute SQL
In the SQL console, run:
```sql
-- First, verify the new table exists
SELECT COUNT(*) FROM lb_processing_rules;

-- Check if old table exists
SELECT COUNT(*) FROM processing_rule;

-- Drop the old table
DROP TABLE IF EXISTS processing_rule CASCADE;

-- Verify it's gone
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'processing_rule';
```

Expected result: No rows returned (table is dropped)

---

## Option 2: Using psql Command Line

### Step 1: Get Database Credentials
From your BTP deployment logs or environment variables:
```bash
cf env lockbox-srv | grep postgres
```

Look for:
- `host` (e.g., postgres-xxxx.rds.amazonaws.com)
- `port` (e.g., 2477)
- `database` (e.g., CAmqjnIfEdIX)
- `username`
- `password`

### Step 2: Connect to Database
```bash
psql -h postgres-aee790df-b48b-48cc-96b3-db432a62390e.czuelothxj0h.ap-southeast-2.rds.amazonaws.com \
     -p 2477 \
     -U your_username \
     -d CAmqjnIfEdIX
```

### Step 3: Verify and Drop
```sql
-- List all tables
\dt

-- Verify new table exists and has data
SELECT COUNT(*) FROM lb_processing_rules;
SELECT rule_id, rule_name FROM lb_processing_rules LIMIT 5;

-- Check old table
SELECT COUNT(*) FROM processing_rule;

-- Drop old table
DROP TABLE IF EXISTS processing_rule CASCADE;

-- Confirm deletion
\dt processing_rule
```

Expected output: `Did not find any relation named "processing_rule".`

---

## Option 3: Automated Cleanup via API (Recommended)

### Create a Cleanup Endpoint (Add to server.js)

**Note:** This is for reference only. The application is already working without this.

```javascript
// Add this endpoint to server.js (optional)
app.post('/api/admin/drop-old-processing-rule-table', async (req, res) => {
    try {
        if (!dbAvailable) {
            return res.status(503).json({ 
                error: 'Database not available',
                message: 'Cannot drop table - PostgreSQL is not connected'
            });
        }
        
        // Verify new table exists first
        const newTableCheck = await pool.query(`
            SELECT COUNT(*) FROM lb_processing_rules
        `);
        
        if (parseInt(newTableCheck.rows[0].count) === 0) {
            return res.status(400).json({
                error: 'New table is empty',
                message: 'Please sync data to lb_processing_rules before dropping old table'
            });
        }
        
        // Drop old table
        await pool.query('DROP TABLE IF EXISTS processing_rule CASCADE');
        
        console.log('✅ Old processing_rule table dropped successfully');
        
        res.json({
            success: true,
            message: 'Old processing_rule table dropped successfully'
        });
    } catch (err) {
        console.error('Error dropping old table:', err);
        res.status(500).json({
            error: 'Failed to drop old table',
            message: err.message
        });
    }
});
```

Then call via curl:
```bash
curl -X POST https://your-app.cfapps.eu10.hana.ondemand.com/api/admin/drop-old-processing-rule-table
```

---

## 🧪 Verification Steps After Dropping

### 1. Test Application Still Works
```bash
# Get all rules
curl https://your-app.cfapps.eu10.hana.ondemand.com/api/field-mapping/processing-rules

# Create a test rule
curl -X POST https://your-app.cfapps.eu10.hana.ondemand.com/api/field-mapping/processing-rules \
  -H "Content-Type: application/json" \
  -d '{
    "ruleName": "Post-Migration Test",
    "description": "Verify table cleanup",
    "fileType": "EXCEL",
    "ruleType": "VALIDATION",
    "active": true
  }'

# Delete the test rule
curl -X DELETE https://your-app.cfapps.eu10.hana.ondemand.com/api/field-mapping/processing-rules/RULE-006
```

### 2. Check Application Logs
```bash
cf logs lockbox-srv --recent | grep -i "processing rule"
```

Expected logs:
- ✅ "Loaded X processing rules from LB_Processing_Rules table"
- ✅ "Processing rule saved to LB_Processing_Rules table"
- ❌ NO references to old "processing_rule" table

### 3. Test UI
1. Open your BTP application URL
2. Navigate to "Field Mapping Rules" → "Rules" tab
3. Verify all rules are displayed
4. Try creating, editing, and deleting a rule
5. Refresh the page and verify changes persist

---

## 📊 Expected Database State

### Before Cleanup
```
Tables in 'public' schema:
- lockbox_run_log
- sap_response_log
- line_level_clearing
- lockbox_processing_run
- file_pattern
- odata_service
- batch_template
- processing_rule          ← OLD TABLE (not used)
- lb_processing_rules       ← NEW TABLE (in use)
```

### After Cleanup
```
Tables in 'public' schema:
- lockbox_run_log
- sap_response_log
- line_level_clearing
- lockbox_processing_run
- file_pattern
- odata_service
- batch_template
- lb_processing_rules       ← ONLY THIS ONE
```

---

## 🔄 Rollback Plan (If Something Goes Wrong)

### If you need to restore the old table:

1. **Re-create the old table structure**
```sql
CREATE TABLE IF NOT EXISTS processing_rule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id VARCHAR(30) NOT NULL UNIQUE,
    rule_name VARCHAR(200) NOT NULL,
    description TEXT,
    file_type VARCHAR(50) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 10,
    destination VARCHAR(100),
    conditions JSONB,
    api_mappings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

2. **Copy data from new table**
```sql
INSERT INTO processing_rule 
SELECT * FROM lb_processing_rules;
```

3. **Revert code changes** (use git)
```bash
git log --oneline | head -5  # Find the commit before migration
git revert <commit-hash>
```

---

## ❓ FAQ

### Q1: Will dropping the old table affect the application?
**A:** No. The application code no longer references `processing_rule`. It only uses `lb_processing_rules`.

### Q2: What if I want to keep both tables for safety?
**A:** That's fine! The old table won't cause any issues. However, it will never be updated by the application, so the data will become stale.

### Q3: Will this affect the Kubernetes preview environment?
**A:** No. The Kubernetes environment doesn't connect to PostgreSQL. It uses JSON files as the data source.

### Q4: What if the new table doesn't have data after migration?
**A:** Use the sync endpoint to populate it from JSON:
```bash
POST /api/field-mapping/processing-rules/sync-to-db
```

### Q5: Can I rename `lb_processing_rules` back to `processing_rule`?
**A:** Yes, but you'd need to update the code again. It's better to keep the new name for clarity.

---

## ✅ Cleanup Checklist

- [ ] Application deployed to BTP (`cf push`)
- [ ] New `lb_processing_rules` table exists
- [ ] Table has data (run `SELECT COUNT(*)`)
- [ ] All CRUD operations tested on BTP
- [ ] UI tested and working
- [ ] Backup created (optional but recommended)
- [ ] Old table dropped (`DROP TABLE processing_rule`)
- [ ] Application still works after drop
- [ ] Logs verified (no errors)

---

**Last Updated:** 2026-02-25  
**Status:** Safe to drop old table after BTP verification
