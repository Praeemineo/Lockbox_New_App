# RULE-001 Enhanced Logging - Complete Guide

## ✅ RULE-001 Now Has RULE-004 Style Comprehensive Logging

RULE-001 (Accounting Document Lookup) now includes detailed, formatted logs similar to RULE-004 for complete visibility into the validation process.

---

## 📊 RULE-001 Configuration from PostgreSQL:

### **API Reference**:
```
/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set
```

### **Field Mappings**:
```json
[
  {
    "sourceField": "Invoice Number",    // Read from Excel
    "targetField": "Belnr",             // Extract from SAP response
    "apiField": "paymentreference"      // Store in lockbox data
  },
  {
    "sourceField": "Invoice Number",    // Read from Excel (same input)
    "targetField": "CompanyCode",       // Extract from SAP response
    "apiField": "CompanyCode"           // Store in lockbox data
  }
]
```

---

## 📋 Expected BTP Logs During File Upload:

When you upload an Excel file with invoice numbers, you'll see:

### **1. Validation Start**:
```
=================================================================
🔍 LOCKBOX DYNAMIC VALIDATION - RULE-001 & RULE-002
=================================================================
   Filtering rules with: fileType="EXCEL", destination="S4HANA_SYSTEM_DESTINATION"
   Total cached rules: 4

📋 Found 2 applicable validation rules

────────────────────────────────────────────────────────────────
⚙️  Executing RULE-001: Accounting Document Lookup
────────────────────────────────────────────────────────────────
```

### **2. Condition Check**:
```
   🔍 Evaluating conditions for 1 condition(s)
      Checking condition: Invoice Number EXIST
      ✅ Found field "Invoice Number" (matches "Invoice Number") with value: 90001234
   ✅ All conditions met for this row
✅ RULE-001: Condition met - proceeding with API call
```

### **3. Processing Each Row**:
```
   📋 Rule has 2 field mapping(s)

   🔍 Row 1: Looking for source field "Invoice Number" in Excel
   ✅ Row 1: Found Invoice Number = "90001234"

================================================================================
⚙️  EXECUTING RULE-001 - Row 1
================================================================================
   ➡️  Source Value (Invoice Number): 90001234
   📞 Calling SAP API with value: 90001234
   🔗 Full API URL: /sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='90001234')/Set
   🔑 Using direct SAP connection (environment variables)
────────────────────────────────────────────────────────────────
```

### **4. Direct SAP Connection** (NEW - Like RULE-004):
```
   📞 Calling SAP via destination: S4HANA_SYSTEM_DESTINATION
   🔗 API URL: /sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='90001234')/Set
   🎯 Calling executeSapGetRequest: destination="S4HANA_SYSTEM_DESTINATION", endpoint="/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='90001234')/Set"
   ⚡ Using DIRECT connection (bypassing BTP Destination Service)
   
   🚀 SAP GET Request
   ⚡ Using DIRECT SAP connection (bypassing BTP Destination Service)
   🔐 Direct SAP Connection { baseUrl: 'https://44.196.95.84:44301' }
   📍 Full GET URL: https://44.196.95.84:44301/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='90001234')/Set?sap-client=100
   ✅ Direct SAP GET Success { status: 200 }
```

### **5. SAP Response with Field Values**:
```
   ✅ SAP API Response received (Status: 200)

================================================================================
📋 RULE-001 SAP RESPONSE VALUES - Row 1:
================================================================================
🔍 Source value used in query: 90001234
📥 Full SAP Response:
{
  "d": {
    "results": [
      {
        "Belnr": "5100000123",
        "CompanyCode": "1710",
        "DocumentDate": "2024-01-15",
        "PostingDate": "2024-01-15",
        "FiscalYear": "2024",
        ...
      }
    ]
  }
}

📊 Extracted Values:
   🎯 paymentreference: "5100000123" (from SAP field: Belnr)
   🎯 CompanyCode: "1710" (from SAP field: CompanyCode)
================================================================================
```

### **6. Field Enrichment Details**:
```
   📋 Processing 2 field mapping(s)...

   ────────────────────────────────────────────────────────────
   📝 Field Mapping: Invoice Number → Belnr → paymentreference
   ────────────────────────────────────────────────────────────
   ✅ Enriched Field: paymentreference = "5100000123"
      ↳ Extracted from SAP field: Belnr
      ↳ Input value: 90001234

   ────────────────────────────────────────────────────────────
   📝 Field Mapping: Invoice Number → CompanyCode → CompanyCode
   ────────────────────────────────────────────────────────────
   ✅ Enriched Field: CompanyCode = "1710"
      ↳ Extracted from SAP field: CompanyCode
      ↳ Input value: 90001234
```

### **7. Row Summary**:
```
================================================================================
✅ RULE-001 Row 1 ENRICHMENT SUMMARY:
   Fields enriched: 2
   Enriched row data (relevant fields):
   - paymentreference: "5100000123"
   - CompanyCode: "1710"
================================================================================
```

### **8. Validation Complete**:
```
✅ RULE-001: Completed - 1 records enriched

================================================================================
📊 VALIDATION SUMMARY
================================================================================
   Rules Executed: RULE-001, RULE-002
   Records Enriched: 2
   Errors: 0
   Warnings: 0
================================================================================
```

---

## 🔍 Key Log Sections to Verify:

### ✅ **Direct Connection (No BTP Destination)**:
Look for these lines:
```
⚡ Using DIRECT connection (bypassing BTP Destination Service)
🔐 Direct SAP Connection { baseUrl: 'https://44.196.95.84:44301' }
✅ Direct SAP GET Success { status: 200 }
```

### ✅ **API Call Details**:
```
➡️  Source Value (Invoice Number): 90001234
📞 Calling SAP API with value: 90001234
🔗 Full API URL: .../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='90001234')/Set
```

### ✅ **SAP Response Data**:
```
📥 Full SAP Response:
{
  "d": {
    "results": [...]
  }
}
```

### ✅ **Field Extraction**:
```
📊 Extracted Values:
   🎯 paymentreference: "5100000123" (from SAP field: Belnr)
   🎯 CompanyCode: "1710" (from SAP field: CompanyCode)
```

### ✅ **Field Enrichment**:
```
✅ Enriched Field: paymentreference = "5100000123"
   ↳ Extracted from SAP field: Belnr
   ↳ Input value: 90001234
```

---

## 🚨 Error Scenarios:

### **Scenario 1: API Call Failed**:
```
❌ RULE-001: SAP API call failed for row 1:
   rule: Accounting Document Lookup
   error: Request failed with status code 400
   apiURL: /sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='90001234')/Set
   sourceValue: 90001234
   statusCode: 400
   statusText: Bad Request
   row: 1
```

### **Scenario 2: Field Not Found in Response**:
```
📊 Extracted Values:
   ⚠️  paymentreference: NOT FOUND (expected from: Belnr)
   🎯 CompanyCode: "1710" (from SAP field: CompanyCode)
```

### **Scenario 3: Source Field Missing in Excel**:
```
⏭️  Row 1: Source field "Invoice Number" not found or empty
📋 Available Excel columns: Customer Name, Amount, Date, Reference
```

---

## 🧪 Testing Checklist:

After deploying to BTP, upload a test Excel file and verify:

### **1. Direct Connection**:
- [ ] Logs show "⚡ Using DIRECT connection"
- [ ] No "Resolving SAP Destination" messages
- [ ] No "Request path contains unescaped characters" warnings

### **2. API Call**:
- [ ] Source value (Invoice Number) is logged
- [ ] Full API URL is shown with the invoice number substituted
- [ ] "✅ Direct SAP GET Success { status: 200 }"

### **3. SAP Response**:
- [ ] Full JSON response is logged
- [ ] "📊 Extracted Values" shows both fields with their values
- [ ] Belnr value is extracted
- [ ] CompanyCode value is extracted

### **4. Field Enrichment**:
- [ ] Both fields show "✅ Enriched Field"
- [ ] paymentreference gets the Belnr value
- [ ] CompanyCode gets the CompanyCode value
- [ ] "ENRICHMENT SUMMARY" shows "Fields enriched: 2"

### **5. Final Result**:
- [ ] "Records Enriched: X" matches the number of rows
- [ ] No errors in the summary
- [ ] Enriched data is visible in the UI after upload

---

## 📄 Related Documentation:

- `/app/RULE004_DIRECT_CONNECTION_FIX.md` - RULE-004 direct connection (working)
- `/app/RULE001_DIRECT_CONNECTION_FIX.md` - RULE-001 connection method
- `/app/RULE004_SAP_API_DETAILS.md` - SAP API field mappings

---

## 🎯 Comparison: RULE-001 vs RULE-004

| Feature | RULE-001 (Validation) | RULE-004 (View Details) |
|---------|----------------------|------------------------|
| **When** | During file upload | After posting (on-demand) |
| **Input** | Invoice Number from Excel | LockboxId from BTP run |
| **API** | `/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='...')/Set` | `/ZFI_I_ACC_BANK_STMT?$filter=LockBoxId eq '...'` |
| **Output** | Belnr, CompanyCode | 13 fields (LockBoxId, SendingBank, etc.) |
| **Connection** | ✅ Direct .env | ✅ Direct .env |
| **Logging Style** | ✅ Comprehensive (same as RULE-004) | ✅ Comprehensive |
| **Status** | ✅ READY TO TEST | ✅ WORKING |

---

## 🚀 Next Steps:

1. **Deploy** updated `/app/backend/srv/handlers/rule-engine.js` to BTP
2. **Upload** a test Excel file with invoice numbers
3. **Check** BTP logs (`cf logs <app-name>`) during upload
4. **Share** the complete logs showing:
   - Direct connection messages
   - API call with invoice number
   - Full SAP response
   - Field extraction and enrichment
5. **Verify** enriched data appears in the UI

**The logs will now show you exactly what RULE-001 is doing, just like RULE-004!** 🎯
