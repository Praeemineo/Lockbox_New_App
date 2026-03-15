-- ============================================================================
-- FIX RULE-001: Change apiField to lowercase "paymentreference"
-- The Reference Document Rule looks for "paymentreference" (lowercase)
-- ============================================================================

UPDATE lb_processing_rules
SET 
    field_mappings = '[
        {
            "sourceField": "Invoice Number",
            "targetField": "AccountingDocument",
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
    field_mappings
FROM lb_processing_rules
WHERE rule_id = 'RULE-001';
