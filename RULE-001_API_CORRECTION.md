# RULE-001 API Configuration Update

## 🔄 API Endpoint Correction

### ❌ Previous Configuration (Incorrect):
```
API: /sap/opu/odata/sap/API_JOURNALENTRY_SRV/JournalEntry
Type: Standard SAP OData v2 API
Service: Journal Entry Service
```

### ✅ Current Configuration (Corrected):
```
API: /sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT
Type: Custom SAP OData v4 API
Service: Custom Z Accounting Document Service (ZFI_I_ACC_DOCUMENT)
```

---

## 🎯 Key Differences

### OData Version:
- **Old**: OData v2 (`/odata/`)
- **New**: OData v4 (`/odata4/`)

### API Type:
- **Old**: Standard SAP API (`API_JOURNALENTRY_SRV`)
- **New**: Custom Z API (`ZFI_I_ACC_DOCUMENT`)

### Service Path:
- **Old**: Simple path structure
- **New**: Extended BTP service path with service definition

---

## 📡 Complete RULE-001 Configuration

```json
{
  "ruleId": "RULE-001",
  "ruleName": "Accounting Document Lookup",
  "apiMappings": [
    {
      "httpMethod": "GET",
      "apiReference": "/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT",
      "inputField": "InvoiceReference",
      "sourceInput": "PaymentReference",
      "outputField": "Belnr",
      "lockboxApiField": "DocumentNumber"
    }
  ]
}
```

---

## 🔧 Dynamic API Call Example

With the corrected configuration, the system will now generate:

```
GET /sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT?
    $filter=InvoiceReference eq '5100000123' 
           and CompanyCode eq '1000' 
           and FiscalYear eq '2024'
    &$select=Belnr,CompanyCode,FiscalYear
    &$top=1
```

---

## ✅ Benefits of Dynamic Implementation

This is exactly why we built the dynamic system! 🎉

**Before**: To change the API endpoint, you'd need to:
1. Edit code in multiple places
2. Update hardcoded logic
3. Redeploy application
4. Risk breaking other functionality

**Now**: To change the API endpoint, you only:
1. Edit `processing_rules.json`
2. Reload configuration (or restart)
3. ✅ Done!

**No code changes required!** The dynamic implementation automatically:
- Reads the new API endpoint
- Builds the correct OData query
- Uses the right HTTP method
- Connects via BTP destination
- Extracts the correct output field

---

## 🧪 Testing the Updated API

Run the test again to verify:

```bash
cd /app/backend
node test-rule001-dynamic.js
```

Expected output:
```
✅ RULE-001 found in configuration
   API Reference: /sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT
```

---

## 📝 Notes on Custom Z API

### Path Breakdown:
```
/sap/opu/odata4/                    → OData v4 gateway
sap/zsb_acc_document/               → Service binding
srvd_a2x/                           → Service definition  
sap/zsd_acc_document/               → Service namespace
0001/                               → Version
ZFI_I_ACC_DOCUMENT                  → CDS view/entity
```

This is a **custom ABAP RESTful Application Programming (RAP)** service, likely created specifically for your lockbox use case.

### Compatibility:
- Requires S/4HANA Cloud or S/4HANA 2020 or later
- Uses modern CDS views
- Follows SAP RAP best practices

---

## ⚠️ Important for Testing

When testing with the actual SAP backend:
1. Ensure the custom Z service is deployed and active in your S/4HANA system
2. Verify BTP destination has access to this custom API
3. Check that the CDS view `ZFI_I_ACC_DOCUMENT` exists
4. Confirm field names match (especially `InvoiceReference` and `Belnr`)

---

**Status**: ✅ Configuration updated and ready for testing with your custom SAP API!
