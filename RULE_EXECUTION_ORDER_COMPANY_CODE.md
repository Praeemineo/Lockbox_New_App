# Rule Execution Order - Company Code Dependency

## Issue Clarification
Company Code is **NOT** in the uploaded file. It is **derived from RULE_FETCH_ACCT_DOC** and then used by **RULE_FETCH_LOCKBOX_DATA**.

## Data Flow

### Upload File Contains:
```
- Invoice Number
- Amount
- Customer Number
- etc.
```

**NO Company Code column!**

### Rule Execution Chain

#### 1. RULE_FETCH_ACCT_DOC (First)
**Condition:** Invoice Number exists
**Action:** Call SAP API to fetch accounting document
**Enriches Data With:**
- PaymentReference (from AccountingDocument field)
- **CompanyCode** (from CompanyCode field) ✅ THIS IS WHERE COMPANY CODE COMES FROM

**Output after RULE_FETCH_ACCT_DOC:**
```json
{
  "Invoice Number": "1000073",
  "Amount": 100,
  "PaymentReference": "5000123",      ← Added by RULE_FETCH_ACCT_DOC
  "CompanyCode": "1710"                ← Added by RULE_FETCH_ACCT_DOC ✅
}
```

#### 2. RULE_FETCH_LOCKBOX_DATA (Second)
**Condition:** Company Code exists (checks enriched data, not original file)
**Action:** Apply constant field mappings (no API call)
**Checks:** Does CompanyCode exist in the enriched data? ✅ YES (from step 1)
**Adds:**
- Lockbox = "1234"
- LockboxBatchDestination = "LOCKBOXDES"
- LockboxBatchOrigin = "LOCKBOXORI"

**Output after RULE_FETCH_LOCKBOX_DATA:**
```json
{
  "Invoice Number": "1000073",
  "Amount": 100,
  "PaymentReference": "5000123",
  "CompanyCode": "1710",
  "Lockbox": "1234",                           ← Added by RULE_FETCH_LOCKBOX_DATA
  "LockboxBatchDestination": "LOCKBOXDES",     ← Added by RULE_FETCH_LOCKBOX_DATA
  "LockboxBatchOrigin": "LOCKBOXORI"           ← Added by RULE_FETCH_LOCKBOX_DATA
}
```

#### 3. RULE_FETCH_PARTNER_BANK (Third)
**Condition:** Customer Number exists
**Action:** Call SAP API to fetch partner bank details
**Enriches Data With:**
- PartnerBank
- PartnerBankAccount
- PartnerBankCountry

## Why Execution Order Matters

**CRITICAL:** RULE_FETCH_ACCT_DOC **MUST** run before RULE_FETCH_LOCKBOX_DATA

- **If RULE_FETCH_ACCT_DOC runs first:**
  - ✅ CompanyCode is enriched
  - ✅ RULE_FETCH_LOCKBOX_DATA finds CompanyCode
  - ✅ Constant mappings are applied

- **If RULE_FETCH_LOCKBOX_DATA runs first:**
  - ❌ CompanyCode doesn't exist yet
  - ❌ Condition "Company Code exists" fails
  - ❌ Constant mappings are NOT applied

## Implementation

### Rule Execution Order Enforced

**File:** `/app/backend/srv/handlers/rule-engine.js`

```javascript
// Sort rules to ensure correct execution order
const ruleOrder = {
    'RULE_FETCH_ACCT_DOC': 1,        // MUST run first (enriches CompanyCode)
    'RULE_FETCH_LOCKBOX_DATA': 2,    // Runs second (uses CompanyCode from step 1)
    'RULE_FETCH_PARTNER_BANK': 3     // Runs third
};

applicableRules.sort((a, b) => {
    const orderA = ruleOrder[a.ruleId] || 999;
    const orderB = ruleOrder[b.ruleId] || 999;
    return orderA - orderB;
});
```

### Backend Logs Show Order

```
📋 Found 3 applicable validation rules (in execution order):
   1. RULE_FETCH_ACCT_DOC - Accounting Document Lookup
   2. RULE_FETCH_LOCKBOX_DATA - Fetch Lockbox Constants
   3. RULE_FETCH_PARTNER_BANK - Partner Bank Details

⚙️  Executing RULE_FETCH_ACCT_DOC: Accounting Document Lookup
   ✅ Enriched CompanyCode = "1710"

⚙️  Executing RULE_FETCH_LOCKBOX_DATA: Fetch Lockbox Constants
   ✅ Condition met: CompanyCode exists (value: "1710")
   📌 Applying constant field mappings (no API call)
   ✅ Lockbox = "1234"
   ✅ LockboxBatchDestination = "LOCKBOXDES"
   ✅ LockboxBatchOrigin = "LOCKBOXORI"

⚙️  Executing RULE_FETCH_PARTNER_BANK: Partner Bank Details
   ✅ Enriched PartnerBank, PartnerBankAccount, PartnerBankCountry
```

## How evaluateRuleCondition Works

The condition check uses **enriched data**, not the original uploaded file:

```javascript
// Step 3: Evaluate rule condition
const conditionMet = evaluateRuleCondition(rule.conditions, result.enrichedData);
//                                                           ^^^^^^^^^^^^^^
//                                                           Uses enriched data
//                                                           (includes CompanyCode from previous rule)
```

**For RULE_FETCH_LOCKBOX_DATA:**
- Condition: "Company Code exists"
- Checks: `result.enrichedData` (which now has CompanyCode from RULE_FETCH_ACCT_DOC)
- Result: ✅ Condition MET

## Rule Configuration Summary

### RULE_FETCH_ACCT_DOC
- **Provides:** CompanyCode, PaymentReference
- **Field Mappings:**
  - Invoice Number → AccountingDocument → PaymentReference
  - Invoice Number → CompanyCode → **CompanyCode** ✅

### RULE_FETCH_LOCKBOX_DATA
- **Depends on:** CompanyCode (from RULE_FETCH_ACCT_DOC)
- **Condition:** Company Code exists (checks enriched data)
- **Provides:** Lockbox, LockboxBatchDestination, LockboxBatchOrigin

### RULE_FETCH_PARTNER_BANK
- **Provides:** PartnerBank, PartnerBankAccount, PartnerBankCountry
- **Independent:** Can run anytime after file upload

## Testing Scenario

### Upload File:
```csv
Invoice Number, Amount, Customer Number
1000073, 100, 12345
```

**Note:** NO Company Code column in upload!

### Expected Enriched Output:
```json
{
  "Invoice Number": "1000073",
  "Amount": 100,
  "Customer Number": "12345",
  "PaymentReference": "5000123",          ← From RULE_FETCH_ACCT_DOC
  "CompanyCode": "1710",                  ← From RULE_FETCH_ACCT_DOC ✅
  "Lockbox": "1234",                      ← From RULE_FETCH_LOCKBOX_DATA (uses CompanyCode)
  "LockboxBatchDestination": "LOCKBOXDES",← From RULE_FETCH_LOCKBOX_DATA
  "LockboxBatchOrigin": "LOCKBOXORI",     ← From RULE_FETCH_LOCKBOX_DATA
  "PartnerBank": "HDFC001",               ← From RULE_FETCH_PARTNER_BANK
  "PartnerBankAccount": "123456789",      ← From RULE_FETCH_PARTNER_BANK
  "PartnerBankCountry": "IN"              ← From RULE_FETCH_PARTNER_BANK
}
```

## Key Points

1. ✅ **Company Code is NOT in the upload file**
2. ✅ **Company Code is fetched by RULE_FETCH_ACCT_DOC** from SAP API
3. ✅ **RULE_FETCH_LOCKBOX_DATA depends on Company Code** from previous enrichment
4. ✅ **Execution order is enforced** via sorting in rule-engine.js
5. ✅ **Condition evaluation uses enriched data**, not original file data

## Status

✅ **Rule execution order enforced**
✅ **RULE_FETCH_ACCT_DOC runs first** (enriches CompanyCode)
✅ **RULE_FETCH_LOCKBOX_DATA runs second** (uses CompanyCode)
✅ **RULE_FETCH_PARTNER_BANK runs third**
✅ **Dependency chain working correctly**
