# PostgreSQL Table Schema Alignment with Main.view.xml

## Analysis: Current State

### **File Patterns Table vs UI (Main.view.xml)**

#### **UI Displays (Main.view.xml - Lines 562-566):**
1. Pattern ID
2. Pattern Name  
3. File Type
4. Pattern Type
5. Active
6. Description (shown in VBox with Pattern Name)

#### **PostgreSQL Table (file_pattern):**
```sql
CREATE TABLE file_pattern (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id VARCHAR(20) NOT NULL UNIQUE,       -- ✅ MATCHES: Pattern ID
    pattern_name VARCHAR(100) NOT NULL,           -- ✅ MATCHES: Pattern Name
    file_type VARCHAR(30) NOT NULL,               -- ✅ MATCHES: File Type
    pattern_type VARCHAR(50) NOT NULL,            -- ✅ MATCHES: Pattern Type
    category VARCHAR(30),                         -- ⚠️ NOT DISPLAYED in main table
    description TEXT,                             -- ✅ MATCHES: Description
    delimiter VARCHAR(10),                        -- ⚠️ NOT DISPLAYED in main table
    active BOOLEAN DEFAULT true,                  -- ✅ MATCHES: Active
    priority INTEGER DEFAULT 100,                 -- ⚠️ NOT DISPLAYED in main table
    conditions JSONB,                             -- ⚠️ Dialog field only
    actions JSONB,                                -- ⚠️ Dialog field only
    field_mappings JSONB,                         -- ⚠️ Dialog field only
    detection JSONB,                              -- ⚠️ Dialog field only
    pdf_fields JSONB,                             -- ⚠️ Dialog field only
    processing_rules JSONB,                       -- ⚠️ Dialog field only
    bank_code VARCHAR(20),                        -- ⚠️ Dialog field only
    account_identifier VARCHAR(50),               -- ⚠️ Dialog field only
    transaction_codes VARCHAR(100),               -- ⚠️ Dialog field only
    split_type VARCHAR(30),                       -- ⚠️ Dialog field only
    amount_threshold DECIMAL(15,2),               -- ⚠️ Dialog field only
    auto_match_open_items BOOLEAN DEFAULT false,  -- ⚠️ Dialog field only
    create_suspense_entry BOOLEAN DEFAULT false,  -- ⚠️ Dialog field only
    common_prefix_detection BOOLEAN DEFAULT false,-- ⚠️ Dialog field only
    pad_check_numbers BOOLEAN DEFAULT false,      -- ⚠️ Dialog field only
    sum_invoice_amounts BOOLEAN DEFAULT false,    -- ⚠️ Dialog field only
    header_row INTEGER DEFAULT 1,                 -- ⚠️ Dialog field only
    data_start_row INTEGER DEFAULT 2,             -- ⚠️ Dialog field only
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**✅ Status: ALIGNED** - All UI fields exist in database table.

---

### **Processing Rules Table vs UI (Main.view.xml)**

#### **UI Displays (Main.view.xml - Lines 618-622):**
1. Rule ID
2. Rule Name
3. Description
4. File Type
5. Rule Type
6. Active

#### **PostgreSQL Table (processing_rule):**
```sql
CREATE TABLE processing_rule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id VARCHAR(30) NOT NULL UNIQUE,          -- ✅ MATCHES: Rule ID
    rule_name VARCHAR(200) NOT NULL,              -- ✅ MATCHES: Rule Name
    description TEXT,                             -- ✅ MATCHES: Description
    file_type VARCHAR(50) NOT NULL,               -- ✅ MATCHES: File Type
    rule_type VARCHAR(50) NOT NULL,               -- ✅ MATCHES: Rule Type
    active BOOLEAN DEFAULT true,                  -- ✅ MATCHES: Active
    priority INTEGER DEFAULT 10,                  -- ⚠️ NOT DISPLAYED in main table
    destination VARCHAR(100),                     -- ⚠️ Dialog field only
    conditions JSONB,                             -- ⚠️ Dialog field only
    api_mappings JSONB,                           -- ⚠️ Dialog field only
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**✅ Status: ALIGNED** - All UI fields exist in database table.

---

## Conclusion:

### **File Patterns Table:**
✅ **NO CHANGES NEEDED**
- All columns displayed in Main.view.xml exist in the database
- Additional columns in database are for dialog/detail views (correct)
- Schema is properly designed

### **Processing Rules Table:**
✅ **NO CHANGES NEEDED**
- All columns displayed in Main.view.xml exist in the database
- Additional columns in database are for dialog/detail views (correct)
- Schema is properly designed

---

## Detailed Column Mapping:

### **File Pattern Columns:**

| UI Column (Main.view.xml) | Database Column | Type | Status |
|---------------------------|-----------------|------|--------|
| Pattern ID | pattern_id | VARCHAR(20) | ✅ MATCH |
| Pattern Name | pattern_name | VARCHAR(100) | ✅ MATCH |
| File Type | file_type | VARCHAR(30) | ✅ MATCH |
| Pattern Type | pattern_type | VARCHAR(50) | ✅ MATCH |
| Description | description | TEXT | ✅ MATCH |
| Active | active | BOOLEAN | ✅ MATCH |

**Additional Database Columns (Not in main table, used in dialogs):**
- category, delimiter, priority, conditions, actions, field_mappings, detection, pdf_fields, processing_rules, bank_code, account_identifier, transaction_codes, split_type, amount_threshold, auto_match_open_items, create_suspense_entry, common_prefix_detection, pad_check_numbers, sum_invoice_amounts, header_row, data_start_row

---

### **Processing Rule Columns:**

| UI Column (Main.view.xml) | Database Column | Type | Status |
|---------------------------|-----------------|------|--------|
| Rule ID | rule_id | VARCHAR(30) | ✅ MATCH |
| Rule Name | rule_name | VARCHAR(200) | ✅ MATCH |
| Description | description | TEXT | ✅ MATCH |
| File Type | file_type | VARCHAR(50) | ✅ MATCH |
| Rule Type | rule_type | VARCHAR(50) | ✅ MATCH |
| Active | active | BOOLEAN | ✅ MATCH |

**Additional Database Columns (Not in main table, used in dialogs):**
- priority, destination, conditions, api_mappings

---

## Why Additional Columns Exist:

### **These are CORRECT and NEEDED:**

**File Patterns:**
- `conditions`, `actions`, `field_mappings`: Used in Pattern Dialog for configuration
- `detection`, `pdf_fields`: Used for file parsing logic
- `processing_rules`: Links patterns to rules
- `bank_code`, `account_identifier`, `transaction_codes`: Banking-specific fields
- `split_type`, `amount_threshold`: Processing configuration
- `auto_match_open_items`, `create_suspense_entry`: SAP posting options
- `header_row`, `data_start_row`: File parsing configuration

**Processing Rules:**
- `priority`: Determines rule execution order
- `destination`: SAP destination for API calls
- `conditions`: Rule conditions (JSONB)
- `api_mappings`: API endpoint mappings (JSONB)

---

## Verification:

### **Test Query - File Patterns:**
```sql
SELECT 
    pattern_id, 
    pattern_name, 
    file_type, 
    pattern_type, 
    description, 
    active 
FROM file_pattern 
ORDER BY pattern_id;
```

**Expected:** Should return all patterns with exactly the columns shown in UI.

### **Test Query - Processing Rules:**
```sql
SELECT 
    rule_id, 
    rule_name, 
    description, 
    file_type, 
    rule_type, 
    active 
FROM processing_rule 
ORDER BY rule_id;
```

**Expected:** Should return all rules with exactly the columns shown in UI.

---

## API Response Mapping:

### **GET /api/field-mapping/patterns**
Returns all columns from database, frontend filters to display only:
- patternId
- patternName
- fileType
- patternType
- description
- active

### **GET /api/field-mapping/processing-rules**
Returns all columns from database, frontend filters to display only:
- ruleId
- ruleName
- description
- fileType
- ruleType
- active

---

## Summary:

✅ **No database schema changes required**
✅ **All UI columns exist in database**
✅ **Column names match exactly (camelCase in UI, snake_case in DB)**
✅ **Additional database columns are for dialog views and backend logic**
✅ **Schema is properly designed and aligned**

---

## If Mismatch Was Found (Hypothetical):

If there were actual mismatches, the fix would be:

```sql
-- Add missing column example
ALTER TABLE file_pattern ADD COLUMN IF NOT EXISTS new_column VARCHAR(50);

-- Rename column example
ALTER TABLE processing_rule RENAME COLUMN old_name TO new_name;

-- Change column type example
ALTER TABLE file_pattern ALTER COLUMN column_name TYPE VARCHAR(100);
```

But in this case, **NO CHANGES ARE NEEDED**.

---

**Status:** ✅ PostgreSQL tables are fully aligned with Main.view.xml UI requirements.
