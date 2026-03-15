-- ============================================================================
-- CRITICAL FIX: Update RULE-001 API Reference in PostgreSQL
-- Issue: Missing function parameter (P_DocumentNumber='') and /Set endpoint
-- ============================================================================

-- RULE-001: Update api_mappings with correct API reference including parameter placeholder
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

-- Verify the update
SELECT 
    rule_id,
    rule_name,
    api_mappings->0->>'apiReference' as api_reference
FROM lb_processing_rules
WHERE rule_id = 'RULE-001';

-- Expected output should show:
-- /sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set
-- NOT just: /sap/opu/odata4/.../ZFI_I_ACC_DOCUMENT
