# LB_Processing_Rules Table Migration

## Overview
This document describes the migration from the old `processing_rule` table to the new `LB_Processing_Rules` table in PostgreSQL.

## Changes Made

### 1. Database Schema
**Old Table:** `processing_rule`
**New Table:** `lb_processing_rules`

#### Table Structure
```sql
CREATE TABLE IF NOT EXISTS lb_processing_rules (
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

### 2. Column Mapping
All columns remain the same between the old and new tables:
- `id` (UUID) - Primary key
- `rule_id` (VARCHAR) - Unique identifier (e.g., RULE-001)
- `rule_name` (VARCHAR) - Human-readable name
- `description` (TEXT) - Detailed description
- `file_type` (VARCHAR) - File format (EXCEL, CSV, PDF, etc.)
- `rule_type` (VARCHAR) - Type of rule (API_LOOKUP, VALIDATION, etc.)
- `active` (BOOLEAN) - Whether rule is enabled
- `priority` (INTEGER) - Execution priority
- `destination` (VARCHAR) - SAP destination name
- `conditions` (JSONB) - Rule conditions as JSON
- `api_mappings` (JSONB) - API field mappings as JSON
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

### 3. Code Changes

#### Updated Functions in `/app/backend/server.js`:
1. **saveProcessingRuleToDb()** - Saves rules to `lb_processing_rules`
2. **loadProcessingRulesFromDb()** - Loads rules from `lb_processing_rules`
3. **deleteProcessingRuleFromDb()** - Deletes rules from `lb_processing_rules`
4. **initializeProcessingRules()** - Initializes default rules in `lb_processing_rules`

#### Updated API Endpoints:
- `GET /api/field-mapping/processing-rules` - Reads from `lb_processing_rules`
- `POST /api/field-mapping/processing-rules` - Creates in `lb_processing_rules`
- `PUT /api/field-mapping/processing-rules/:ruleId` - Updates in `lb_processing_rules`
- `DELETE /api/field-mapping/processing-rules/:ruleId` - Deletes from `lb_processing_rules`
- `POST /api/field-mapping/processing-rules/sync-to-db` - Syncs to `lb_processing_rules`
- `GET /api/processing-rules` - Reads from `lb_processing_rules`
- `POST /api/processing-rules` - Creates in `lb_processing_rules`
- `PUT /api/processing-rules/:ruleId` - Updates in `lb_processing_rules`
- `DELETE /api/processing-rules/:ruleId` - Deletes from `lb_processing_rules`

### 4. Data Persistence Strategy
The application maintains a **dual-mode data persistence** strategy:

#### Kubernetes Environment (Preview)
- PostgreSQL connection will fail (network restrictions)
- Automatically falls back to JSON files in `/app/backend/data/processing_rules.json`
- All CRUD operations work with in-memory data and JSON backup

#### SAP BTP Environment (Production)
- Connects to PostgreSQL successfully
- All CRUD operations write to `lb_processing_rules` table
- JSON files are maintained as backup

### 5. Dropping the Old Table
To drop the old `processing_rule` table from PostgreSQL, run this SQL command when connected to the database:

```sql
DROP TABLE IF EXISTS processing_rule CASCADE;
```

**Note:** This should only be done in the BTP environment where PostgreSQL is accessible. The Kubernetes environment doesn't have database access, so this is not a concern there.

## Migration Steps for BTP Deployment

### On Next `cf push` to SAP BTP:

1. **Automatic Table Creation**
   - The new `lb_processing_rules` table will be created automatically on startup
   - Existing data in the old `processing_rule` table will remain untouched

2. **Data Migration (Manual - If Needed)**
   If you need to migrate existing data from `processing_rule` to `lb_processing_rules`:
   
   ```sql
   -- Copy data from old table to new table
   INSERT INTO lb_processing_rules 
   SELECT * FROM processing_rule;
   
   -- Verify data was copied
   SELECT COUNT(*) FROM lb_processing_rules;
   
   -- Drop old table
   DROP TABLE processing_rule CASCADE;
   ```

3. **Automatic Sync from JSON (Recommended)**
   - The application automatically loads rules from JSON on startup
   - Call the sync endpoint to populate the database:
   ```bash
   POST https://your-app.cfapps.eu10.hana.ondemand.com/api/field-mapping/processing-rules/sync-to-db
   ```

## Testing CRUD Operations

### 1. Create Rule
```bash
curl -X POST https://your-app.cfapps.eu10.hana.ondemand.com/api/field-mapping/processing-rules \
  -H "Content-Type: application/json" \
  -d '{
    "ruleName": "Test Rule",
    "description": "Test description",
    "fileType": "EXCEL",
    "ruleType": "VALIDATION",
    "active": true,
    "priority": 10,
    "conditions": [],
    "apiMappings": []
  }'
```

### 2. Get All Rules
```bash
curl https://your-app.cfapps.eu10.hana.ondemand.com/api/field-mapping/processing-rules
```

### 3. Update Rule
```bash
curl -X PUT https://your-app.cfapps.eu10.hana.ondemand.com/api/field-mapping/processing-rules/RULE-001 \
  -H "Content-Type: application/json" \
  -d '{
    "ruleName": "Updated Rule Name",
    "description": "Updated description",
    "active": false
  }'
```

### 4. Delete Rule
```bash
curl -X DELETE https://your-app.cfapps.eu10.hana.ondemand.com/api/field-mapping/processing-rules/RULE-006
```

## Verification

### Check Backend Logs
```bash
# In BTP (via cf logs)
cf logs lockbox-srv --recent | grep "LB_Processing_Rules"

# In Kubernetes (current environment)
tail -f /var/log/supervisor/backend.out.log | grep -i "processing rule"
```

### Expected Log Messages (BTP):
- ✅ "Saving processing rule to PostgreSQL (LB_Processing_Rules): RULE-XXX"
- ✅ "Processing rule saved to LB_Processing_Rules table: RULE-XXX"
- ✅ "Loaded X processing rules from LB_Processing_Rules table"

### Expected Log Messages (Kubernetes):
- ⚠️  "Database not available, loading processing rules from file backup"
- ✅ "Loaded X processing rules from file"

## Current Status

### Environment: Kubernetes (Preview)
- ✅ Code updated to use `lb_processing_rules`
- ✅ Backend restarted successfully
- ✅ Fallback to JSON working correctly
- ⚠️  Database not accessible (expected behavior)

### Environment: SAP BTP (Production)
- 🔄 Pending deployment via `cf push`
- 🔄 Table will be created on next deployment
- 🔄 Requires user verification after deployment

## Rollback Plan
If any issues occur:
1. The JSON backup files remain intact
2. Application works fully with JSON files
3. Can revert code changes if needed

## Summary
The old `processing_rule` table is now **disconnected** from the application. All code references have been updated to use the new `lb_processing_rules` table. The application continues to work seamlessly with JSON file fallback in the Kubernetes environment and will use the new table when deployed to BTP.
