-- ============================================================================
-- FINAL FIX FOR RULE-001: Update targetField to match actual API response
-- ============================================================================
-- ISSUE: User's API returns "Belnr" (technical field), not "AccountingDocument" (semantic field)
-- This script updates both targetField AND apiField to correct values
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
    field_mappings->0->>'sourceField' as source_field_1,
    field_mappings->0->>'targetField' as target_field_1,
    field_mappings->0->>'apiField' as api_field_1,
    field_mappings->1->>'sourceField' as source_field_2,
    field_mappings->1->>'targetField' as target_field_2,
    field_mappings->1->>'apiField' as api_field_2,
    updated_at
FROM lb_processing_rules
WHERE rule_id = 'RULE-001';

-- Expected output:
-- rule_id: RULE-001
-- source_field_1: Invoice Number
-- target_field_1: Belnr                    ← CRITICAL: Must match API response field
-- api_field_1: paymentreference            ← CRITICAL: Must be lowercase for Reference Document Rule
-- source_field_2: Invoice Number
-- target_field_2: CompanyCode
-- api_field_2: companyCode
