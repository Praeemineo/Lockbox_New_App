-- ============================================================================
-- FINAL FIX FOR RULE-001
-- Target Field: Belnr (what SAP API returns)
-- API Field: paymentreference (what Reference Document Rule expects)
-- ============================================================================

UPDATE lb_processing_rules
SET 
    field_mappings = '[
        {
            "sourceField": "Invoice Number",
            "targetField": "Belnr",
            "apiField": "paymentreference"
        },
        {
            "sourceField": "Invoice Number",
            "targetField": "CompanyCode",
            "apiField": "companyCode"
        }
    ]'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE rule_id = 'RULE-001';

-- Verify the update
SELECT 
    rule_id,
    rule_name,
    field_mappings->0->>'targetField' as target_field_1,
    field_mappings->0->>'apiField' as api_field_1,
    field_mappings->1->>'targetField' as target_field_2,
    field_mappings->1->>'apiField' as api_field_2
FROM lb_processing_rules
WHERE rule_id = 'RULE-001';

-- Expected output:
-- target_field_1: Belnr
-- api_field_1: paymentreference
-- target_field_2: CompanyCode
-- api_field_2: companyCode
