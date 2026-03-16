-- ============================================================================
-- CRITICAL: Change apiField to lowercase "paymentreference"
-- The Reference Document Rule expects lowercase field name
-- ============================================================================

UPDATE lb_processing_rules
SET 
    field_mappings = '[
        {
            "apiField": "paymentreference",
            "sourceField": "Invoice Number",
            "targetField": "Belnr"
        },
        {
            "apiField": "companyCode",
            "sourceField": "Invoice Number",
            "targetField": "CompanyCode"
        }
    ]'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE rule_id = 'RULE-001';

-- Verify the change
SELECT 
    rule_id,
    field_mappings->0->>'apiField' as payment_field,
    field_mappings->1->>'apiField' as company_field
FROM lb_processing_rules
WHERE rule_id = 'RULE-001';

-- Expected output:
-- payment_field: paymentreference (all lowercase!)
-- company_field: companyCode
