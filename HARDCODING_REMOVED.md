# ✅ Hardcoded Values Removed - Now Using Saved Field Configuration

## 🎯 Changes Summary

Removed all hardcoded values for **Lockbox**, **LockboxBatchOrigin**, and **LockboxBatchDestination**. These now use the saved field configurations (FLD-001, FLD-002, FLD-003) and will **NOT be overwritten** once saved by the user.

---

## 🔧 What Was Changed

### 1. Template Download Endpoint (`/api/lockbox/template`)

**Before** (Hardcoded):
```javascript
const sampleValues = {
    'Lockbox': '1234',  // Hardcoded
    'LockboxBatchOrigin': 'EMERGENT',  // Hardcoded
    'LockboxBatchDestination': 'SAMPLEDEST',  // Hardcoded
};
```

**After** (Uses Saved Values):
```javascript
// Helper function to get field default value from saved configuration
const getFieldDefault = (fieldName) => {
    const field = apiFields.find(f => f.fieldName === fieldName);
    return field ? field.defaultValue : '';
};

const sampleValues = {
    'Lockbox': getFieldDefault('Lockbox') || '1234',  // FLD-001
    'LockboxBatchOrigin': getFieldDefault('LockboxBatchOrigin') || '1234567890',  // FLD-003
    'LockboxBatchDestination': getFieldDefault('LockboxBatchDestination') || 'SAMPLEDEST',  // FLD-002
};
```

---

### 2. SAP Payload Builder (`buildLockboxPayload`)

**Before** (Hardcoded Fallbacks):
```javascript
const payload = {
    Lockbox: (header.lockbox || "").substring(0, 7),  // Empty if not in header
    LockboxBatchOrigin: (header.lockbox_batch_origin || "").substring(0, 10),
    LockboxBatchDestination: (header.lockbox_batch_destination || "").substring(0, 10),
};
```

**After** (Uses Saved Values):
```javascript
// Helper function added inside buildLockboxPayload
const getFieldDefault = (fieldName) => {
    const field = apiFields.find(f => f.fieldName === fieldName);
    return field ? field.defaultValue : '';
};

const payload = {
    // Use saved values from FLD-001, FLD-002, FLD-003
    // If values exist in header, use them (don't overwrite)
    // Otherwise use saved defaults from field configuration
    Lockbox: (header.lockbox || getFieldDefault('Lockbox') || "").substring(0, 7),
    LockboxBatchOrigin: (header.lockbox_batch_origin || getFieldDefault('LockboxBatchOrigin') || "").substring(0, 10),
    LockboxBatchDestination: (header.lockbox_batch_destination || getFieldDefault('LockboxBatchDestination') || "").substring(0, 10),
};
```

---

## 📋 Field Mapping Configuration

### FLD-001: Lockbox ID
```json
{
  "fieldId": "FLD-001",
  "fieldName": "Lockbox",
  "fieldType": "Constant",
  "necessity": "Mandatory",
  "maxLength": 7,
  "defaultValue": "1234",
  "isEditable": true
}
```

### FLD-002: LockboxBatchDestination
```json
{
  "fieldId": "FLD-002",
  "fieldName": "LockboxBatchDestination",
  "fieldType": "Constant",
  "necessity": "Mandatory",
  "maxLength": 10,
  "defaultValue": "SAMPLEDEST",
  "isEditable": true
}
```

### FLD-003: LockboxBatchOrigin
```json
{
  "fieldId": "FLD-003",
  "fieldName": "LockboxBatchOrigin",
  "fieldType": "Constant",
  "necessity": "Mandatory",
  "maxLength": 10,
  "defaultValue": "1234567890",
  "isEditable": true
}
```

---

## 🔄 How Values Are Loaded

### On Server Startup
```
1. Server starts
2. Loads API fields from default configuration
3. Checks if saved file exists: /app/backend/data/api_fields.json
4. If file exists:
   - Loads saved field values
   - Merges with defaults (preserving saved values)
   - Updates apiFields array with saved defaultValue
5. Uses merged values throughout application
```

### File Location
```
/app/backend/data/api_fields.json
```

### Startup Log
```
=== Loading API Fields from File ===
Loaded API Fields from backup file: 20 fields
API Fields merged with saved values
Constant Values: {
  "Lockbox": "1234",
  "LockboxBatchOrigin": "1234567890",
  "LockboxBatchDestination": "SAMPLEDEST"
}
```

---

## 🛡️ Value Preservation Logic

### Priority Order (Never Overwrites)
```
1. Header value (from uploaded file) - HIGHEST PRIORITY
2. Saved field default value (from FLD-001, FLD-002, FLD-003)
3. Hardcoded fallback (only if nothing else available)
```

### Example Flow
```javascript
// If user uploaded file with Lockbox = "5678"
header.lockbox = "5678"  // Used from uploaded file

// If user didn't provide Lockbox in file
header.lockbox = null
// Falls back to saved field configuration
getFieldDefault('Lockbox')  // Returns saved value (e.g., "1234")

// If no saved value exists
getFieldDefault('Lockbox')  // Returns ""
// Falls back to hardcoded default
|| "1234"
```

---

## 📝 How to Update Field Values

### Via API (Recommended)
```bash
# Update Lockbox ID (FLD-001)
curl -X PUT http://localhost:8001/api/field-mapping/api-fields/FLD-001 \
  -H "Content-Type: application/json" \
  -d '{
    "defaultValue": "9999"
  }'

# Update LockboxBatchDestination (FLD-002)
curl -X PUT http://localhost:8001/api/field-mapping/api-fields/FLD-002 \
  -H "Content-Type: application/json" \
  -d '{
    "defaultValue": "NEWDEST"
  }'

# Update LockboxBatchOrigin (FLD-003)
curl -X PUT http://localhost:8001/api/field-mapping/api-fields/FLD-003 \
  -H "Content-Type: application/json" \
  -d '{
    "defaultValue": "NEWORIGIN"
  }'
```

### Via UI (Field Mapping Page)
1. Navigate to **Field Mapping Rules** or **Template Builder**
2. Find the field (FLD-001, FLD-002, FLD-003)
3. Click Edit
4. Update the **Default Value**
5. Save

The value is immediately saved to `/app/backend/data/api_fields.json` and used for all subsequent operations.

---

## ✅ Validation

### Check Current Values
```bash
# Get all constant field values
curl http://localhost:8001/api/field-mapping/constants

# Response:
{
  "success": true,
  "constants": {
    "Lockbox": "1234",
    "LockboxBatchDestination": "SAMPLEDEST",
    "LockboxBatchOrigin": "1234567890",
    "Currency": "USD",
    "PartnerBank": "15051554",
    "PartnerBankAccount": "314129119",
    "PartnerBankCountry": "US"
  }
}
```

### Check Specific Field
```bash
# Get FLD-001 (Lockbox)
curl http://localhost:8001/api/field-mapping/api-fields

# Find FLD-001 in response and check defaultValue
```

### Test Template Download
```bash
# Download template - should use saved values
curl http://localhost:8001/api/lockbox/template -o test_template.xlsx

# Check the template - Header row should have saved values
```

---

## 🔍 Persistence Mechanism

### When Values Are Saved
```javascript
// On field update via PUT /api/field-mapping/api-fields/:fieldId
function saveApiFieldsToFile() {
    fs.writeFileSync(
        API_FIELDS_BACKUP_FILE,
        JSON.stringify(apiFields, null, 2)
    );
}
```

### File Format
```json
[
  {
    "fieldId": "FLD-001",
    "fieldName": "Lockbox",
    "necessity": "Mandatory",
    "fieldType": "Constant",
    "dataType": "String",
    "maxLength": 7,
    "defaultValue": "1234",
    "description": "Lockbox identifier (constant for all payloads)",
    "isEditable": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T14:25:00.000Z"
  }
]
```

### When Values Are Loaded
```javascript
// On server startup
loadApiFieldsFromFile();

// Merges saved values with defaults
apiFields[idx] = { ...apiFields[idx], ...loadedField };
```

---

## 🎯 Benefits

### ✅ No More Hardcoding
- Values are configurable per environment
- No code changes needed to update values
- Centralized configuration management

### ✅ Persistence
- Values saved to file (`api_fields.json`)
- Survives server restarts
- Not overwritten on deployment

### ✅ Flexibility
- Different values for dev/test/prod
- Easy to update via API or UI
- Maintains audit trail (updatedAt timestamp)

### ✅ Backwards Compatible
- Falls back to hardcoded values if file doesn't exist
- Graceful degradation
- No breaking changes

---

## 📊 Affected Endpoints

### Endpoints Now Using Saved Values

| Endpoint | Usage |
|----------|-------|
| `GET /api/lockbox/template` | Template download with saved defaults |
| `POST /api/lockbox/upload` | Uses saved values for missing fields |
| `GET /api/lockbox/preview-payload/:id` | Payload preview with saved values |
| `POST /api/lockbox/simulate/:id` | Simulation with saved values |
| `POST /api/lockbox/post-to-sap/:id` | Production posting with saved values |

---

## 🔄 Migration Path

### From Hardcoded to Saved Values

**Step 1**: Current values become initial defaults
```json
{
  "Lockbox": "1234",
  "LockboxBatchOrigin": "1234567890",
  "LockboxBatchDestination": "SAMPLEDEST"
}
```

**Step 2**: User updates via UI or API
```bash
PUT /api/field-mapping/api-fields/FLD-001
{ "defaultValue": "NEWVALUE" }
```

**Step 3**: Saved to file
```
/app/backend/data/api_fields.json
```

**Step 4**: Loaded on restart
```
Server loads saved values on next startup
```

---

## 🛠️ Troubleshooting

### Values Not Being Saved

**Check file permissions:**
```bash
ls -la /app/backend/data/api_fields.json
# Should be writable by backend process
```

**Check write operation:**
```bash
# Update a field and check file
curl -X PUT http://localhost:8001/api/field-mapping/api-fields/FLD-001 \
  -H "Content-Type: application/json" \
  -d '{"defaultValue": "TEST"}'

# Check if file was updated
cat /app/backend/data/api_fields.json | grep -A5 FLD-001
```

### Values Reverting to Defaults

**Issue**: File not being loaded on startup

**Check startup logs:**
```bash
tail -100 /var/log/supervisor/backend.out.log | grep "API Fields"
```

**Expected output:**
```
=== Loading API Fields from File ===
Loaded API Fields from backup file: 20 fields
API Fields merged with saved values
```

### Field Not Editable

**Issue**: `isEditable: false` for the field

**Solution**: Only fields with `isEditable: true` can be updated
```javascript
// FLD-001, FLD-002, FLD-003 are editable by default
{ 
  fieldId: "FLD-001",
  isEditable: true  // ✅ Can be updated
}
```

---

## 📚 API Reference

### Get All API Fields
```
GET /api/field-mapping/api-fields
```

### Get Constants Only
```
GET /api/field-mapping/constants

Response:
{
  "success": true,
  "constants": {
    "Lockbox": "1234",
    "LockboxBatchOrigin": "1234567890",
    "LockboxBatchDestination": "SAMPLEDEST"
  }
}
```

### Update Field Default Value
```
PUT /api/field-mapping/api-fields/:fieldId

Body:
{
  "defaultValue": "NEW_VALUE"
}

Response:
{
  "success": true,
  "field": { ... updated field ... },
  "message": "Field updated successfully"
}
```

---

## 🎉 Summary

✅ **Hardcoded values removed** - Now uses saved field configuration  
✅ **FLD-001, FLD-002, FLD-003** - Dynamically loaded from file  
✅ **Values preserved** - Not overwritten on server restart  
✅ **User configurable** - Update via API or UI  
✅ **Backwards compatible** - Falls back to defaults if needed  

**All endpoints now respect saved field values for Lockbox, LockboxBatchOrigin, and LockboxBatchDestination!**

---

**Updated**: 2026-02-04  
**Affected Files**: `backend/server.js`  
**Configuration File**: `/app/backend/data/api_fields.json`
