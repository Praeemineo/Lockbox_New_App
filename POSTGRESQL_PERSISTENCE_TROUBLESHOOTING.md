# PostgreSQL Persistence Issue - Troubleshooting Guide

## Issue Reported:
Changes to RULE-001 & RULE-002 in BTP Field Mapping Rules are not being saved to PostgreSQL `processing_rule` table.

---

## Root Cause Analysis:

### **Environment Difference:**

**Kubernetes (Current Testing Environment):**
- PostgreSQL: ❌ **NOT CONNECTED**
- Logs show: `Database not available after 3 attempts`
- Behavior: Changes save to JSON files only
- Expected: This is normal for Kubernetes environment

**BTP Cloud Foundry (Production Environment):**
- PostgreSQL: ✅ **SHOULD BE CONNECTED**
- Service: `lockbox-db` (PostgreSQL service)
- Behavior: Should save to PostgreSQL + JSON backup
- **Issue:** If changes not appearing in PostgreSQL, connection or query issue exists

---

## Implementation Status:

### ✅ **Code Changes Applied:**

1. **Enhanced Logging in `saveProcessingRuleToDb`:**
```javascript
console.log('💾 Saving processing rule to PostgreSQL:', rule.ruleId);
// ... query execution ...
console.log('✅ Processing rule saved to database:', rule.ruleId);
```

2. **Enhanced PUT Endpoint Logging:**
```javascript
console.log('📝 PUT /api/field-mapping/processing-rules/:ruleId called');
console.log('Rule ID:', req.params.ruleId);
console.log('Request body:', JSON.stringify(req.body, null, 2));
// ... save to database ...
console.log('💾 PostgreSQL save result:', dbResult);
```

3. **Return Database Save Status:**
```javascript
res.json({ 
    success: true, 
    message: 'Processing rule updated', 
    rule: processingRules[idx],
    dbSaved: dbResult?.success || false  // ← NEW: Shows if DB save succeeded
});
```

---

## How to Verify in BTP:

### **Step 1: Check Application Logs**

In BTP Cloud Foundry:
```bash
cf logs lockbox-srv --recent | grep -E "Database|processing rule|PostgreSQL"
```

**Expected logs when saving a rule:**
```
📝 PUT /api/field-mapping/processing-rules/RULE-001 called
Rule ID: RULE-001
Request body: { ... }
📦 Updated in-memory rule: RULE-001
💾 Saving processing rule to PostgreSQL: RULE-001
✅ Processing rule saved to database: RULE-001
📄 Saved to JSON backup file
✅ Updated processing rule: RULE-001
```

**If database is NOT connected:**
```
⚠️ Database not available, rule saved to file backup only
```

### **Step 2: Check Database Connection on Startup**

BTP logs should show:
```
Database connection attempt 1/3...
Database connection successful  ← Should see this in BTP
Loaded 5 processing rules from database
```

**If you see:**
```
Database not available after 3 attempts
```
→ PostgreSQL service is not bound or credentials are wrong

### **Step 3: Verify PostgreSQL Service Binding**

```bash
# Check if service is bound
cf services

# Should show:
# lockbox-db   postgresql   ... bound to lockbox-srv
```

### **Step 4: Check Environment Variables**

```bash
cf env lockbox-srv | grep -E "DB_|POSTGRES"
```

**Should show:**
```
DB_HOST: postgres-aee790df-b48b-48cc-96b3-db432a62390e.czuelothxj0h.ap-southeast-2.rds.amazonaws.com
DB_PORT: 2477
DB_NAME: CAmqjnIfEdIX
DB_USER: CAmqjnIfEdIX
DB_PASSWORD: ***
DB_SSL: true
```

### **Step 5: Test the Update Endpoint Directly**

From BTP terminal or Postman:
```bash
curl -X PUT https://praeemineo-llc-h40wwjzd772w1g15-dev-lockbox-srv.cfapps.ap10.hana.ondemand.com/api/field-mapping/processing-rules/RULE-001 \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "RULE-001",
    "ruleName": "Test Rule Update",
    "description": "Testing PostgreSQL save",
    "conditions": [],
    "apiMappings": []
  }'
```

**Response should include:**
```json
{
  "success": true,
  "message": "Processing rule updated",
  "dbSaved": true    ← This should be true if PostgreSQL save succeeded
}
```

### **Step 6: Query PostgreSQL Directly**

Connect to PostgreSQL and check:
```sql
SELECT rule_id, rule_name, description, updated_at 
FROM processing_rule 
WHERE rule_id = 'RULE-001';
```

Expected: Should show the updated values with current `updated_at` timestamp.

---

## Common Issues & Solutions:

### **Issue 1: Database Not Connected in BTP**

**Symptoms:**
- Logs show: `Database not available after 3 attempts`
- `dbSaved: false` in API response

**Solution:**
```bash
# 1. Check service binding
cf services

# 2. Restart application
cf restage lockbox-srv

# 3. Check logs
cf logs lockbox-srv --recent
```

### **Issue 2: Wrong Database Credentials**

**Symptoms:**
- Connection timeouts
- Authentication errors in logs

**Solution:**
```bash
# Get correct credentials from service
cf service lockbox-db

# Update in mta.yaml or manifest.yml
# Redeploy
cf push
```

### **Issue 3: Table Doesn't Exist**

**Symptoms:**
- Error: `relation "processing_rule" does not exist`

**Solution:**
The table should be created automatically on startup. If not:
```sql
-- Connect to PostgreSQL and run:
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

### **Issue 4: SSL Connection Issues**

**Symptoms:**
- SSL/TLS errors in logs

**Solution:**
Ensure `DB_SSL=true` in environment variables.

---

## Testing Checklist:

- [ ] Deploy to BTP: `cf push` or `cf deploy`
- [ ] Check logs: `cf logs lockbox-srv --recent`
- [ ] Verify database connection: Should see "Database connection successful"
- [ ] Edit RULE-001 in UI
- [ ] Click Save
- [ ] Check API response includes `"dbSaved": true`
- [ ] Query PostgreSQL to verify changes
- [ ] Check `updated_at` timestamp is current

---

## Files Modified (Ready for BTP Deployment):

✅ `/app/backend/server.js`:
- Enhanced logging in `saveProcessingRuleToDb()`
- Enhanced logging in PUT endpoint
- Returns `dbSaved` status in response

---

## Next Steps:

1. **Deploy to BTP:**
   ```bash
   cf push
   ```

2. **Monitor Logs During Startup:**
   ```bash
   cf logs lockbox-srv
   ```
   
   Should see:
   - "Database connection successful"
   - "Loaded X processing rules from database"

3. **Test Rule Update:**
   - Edit RULE-001 in BTP UI
   - Click Save
   - Check logs for "✅ Processing rule saved to database"
   - Verify in PostgreSQL

4. **If Still Failing:**
   - Share the BTP logs showing the PUT request
   - Share the error message from database save
   - Check PostgreSQL service status: `cf service lockbox-db`

---

## Important Notes:

⚠️ **Kubernetes vs BTP:**
- **Kubernetes:** Database NOT available (this is expected, uses JSON files)
- **BTP:** Database SHOULD be available (this is where you need to test)

⚠️ **Two Environments:**
- Testing in Kubernetes won't save to PostgreSQL
- Must test in BTP to verify PostgreSQL persistence
- JSON backup works in both environments

⚠️ **Deployment Required:**
- Code changes are ready but need BTP deployment
- Run `cf push` to deploy updated code to BTP
- Without deployment, BTP still has old code without enhanced logging

---

**Status:** ✅ Code Updated with Enhanced Logging - Ready for BTP Deployment & Testing
