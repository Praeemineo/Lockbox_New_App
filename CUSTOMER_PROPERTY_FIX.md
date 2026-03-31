# Customer Property Fix - SAP API Rejection Issue

## Issue Description
**Error:** `Property '_customerForClearing' is invalid`

Production runs were failing with HTTP errors because SAP's API was rejecting the payload. The root cause was that customer information was being stored directly in the payload items using a property name starting with underscore (`_customerForClearing`).

**SAP API Rule:** Properties starting with `_` (underscore) are considered invalid/internal and are rejected by the SAP OData API.

## Root Cause Analysis

### Previous Implementation (INCORRECT):
```javascript
// In buildStandardPayload()
item._customerForClearing = checkData.customer;  // ❌ Added to payload item
payload.to_Item.results.push(item);              // ❌ Sent to SAP with '_' property

// Later when retrieving
const customerFromPayload = firstItem?._customerForClearing || '';
```

**Problem:** The `_customerForClearing` property was added directly to the `item` object before pushing it into the payload. This entire payload object is then sent to SAP's POST API, which rejects any properties starting with underscore.

## Solution Implemented

### New Implementation (CORRECT):
```javascript
// In buildStandardPayload()
// Create separate mapping object - NOT sent to SAP
const customerMapping = {};

// ... build payload items ...

// Store customer in SEPARATE mapping (NOT in payload)
customerMapping[itemId] = checkData.customer;  // ✓ Stored separately
payload.to_Item.results.push(item);            // ✓ Clean payload sent to SAP

// Return both
return { payload, customerMapping };

// Later when retrieving
const customerMapping = run.customerMapping || {};
const customerFromFile = customerMapping[i] || extractedRows[i - 1]?.Customer || '';
```

## Changes Made

### 1. Updated `buildStandardPayload()` function (Lines 7127-7147)
- Created new `customerMapping` object to store customer data separately
- Changed return value from `payload` to `{ payload, customerMapping }`

### 2. Updated payload building logic (Line 7258)
- Replaced: `item._customerForClearing = checkData.customer;`
- With: `customerMapping[itemId] = checkData.customer;`

### 3. Updated all consumer endpoints:
- **Upload endpoint** (Line 8680): Store `customerMapping` in run object
- **Simulation endpoint** (Line 9070): Read from `customerMapping` instead of payload
- **Production endpoint** (Line 9767): Read from `customerMapping` instead of payload
- **Disabled production endpoint** (Line 2268): Read from header's `customer_mapping`

## API Call Format

### Correct GET LockboxClearing Call:
```
GET <host>/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxClearing(
  PaymentAdvice='010000121800001',
  PaymentAdviceItem='1',
  PaymentAdviceAccount='C0001',        ← Customer from customerMapping
  PaymentAdviceAccountType='D',
  CompanyCode='0001'
)
```

### POST Payload (Clean - No '_' properties):
```json
{
  "Lockbox": "1000070",
  "DepositDateTime": "2025-03-31T12:00:00",
  "to_Item": {
    "results": [
      {
        "LockboxBatchItem": "1",
        "Cheque": "CHK12345",
        "to_LockboxClearing": {
          "results": [...]
        }
        // ✓ NO _customerForClearing property
      }
    ]
  }
}
```

## Testing Status
- ✅ Backend syntax check passed
- ✅ Backend restarted successfully
- ⏳ **Requires user testing:** Upload a file and run Production Run to verify the fix

## Additional Cleanup
Also cleaned up `.gitignore` file which had 1,176 lines of duplicate entries. Reduced to 82 clean lines.

## Files Modified
1. `/app/backend/server.js` (5 locations updated)
2. `/app/.gitignore` (cleaned up duplicates)

## Next Steps
1. User should upload an Excel file with customer data
2. Process through validation and mapping
3. Run Production Run (STEP 1: POST LockboxBatch)
4. Verify no "Property '_customerForClearing' is invalid" error
5. Confirm clearing entries are retrieved correctly with customer information
