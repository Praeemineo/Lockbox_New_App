-- ============================================================================
-- COMPLETE FIX: Update RULE-001 and RULE-002 in PostgreSQL
-- Issues Found:
-- - RULE-001: Missing function parameter (P_DocumentNumber='') in API reference
-- - RULE-002: Missing nested paths in field mappings
-- ============================================================================

-- RULE-001: Fix API Reference
-- Add missing function parameter placeholder and /Set endpoint
UPDATE lb_processing_rules
SET 
    api_mappings = '[
        {
            "sourceType": "OData V4",
            "destination": "S4HANA_SYSTEM_DESTINATION",
            "httpMethod": "GET",
            "apiReference": "/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='''')/Set"
        }
    ]'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE rule_id = 'RULE-001';

-- RULE-002: Fix Field Mappings
-- Add nested paths for OData V2 navigation properties
UPDATE lb_processing_rules
SET 
    field_mappings = '[
        {
            "sourceField": "Customer Number",
            "targetField": "to_BusinessPartnerBank/results/0/BankNumber",
            "apiField": "PartnerBank"
        },
        {
            "sourceField": "Customer Number",
            "targetField": "to_BusinessPartnerBank/results/0/BankAccount",
            "apiField": "PartnerBankAccount"
        },
        {
            "sourceField": "Customer Number",
            "targetField": "to_BusinessPartnerBank/results/0/BankCountryKey",
            "apiField": "PartnerBankCountry"
        }
    ]'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE rule_id = 'RULE-002';

-- Verify both updates
SELECT 
    rule_id,
    rule_name,
    api_mappings->0->>'apiReference' as api_reference,
    field_mappings->0->>'targetField' as first_target_field
FROM lb_processing_rules
WHERE rule_id IN ('RULE-001', 'RULE-002')
ORDER BY rule_id;

-- Expected output:
-- RULE-001 | api_reference includes: (P_DocumentNumber='')
-- RULE-002 | first_target_field: to_BusinessPartnerBank/results/0/BankNumber
