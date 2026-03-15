-- ============================================================================
-- CRITICAL FIX: Update RULE-002 Field Mappings in PostgreSQL
-- Issue: targetField missing nested path for OData navigation properties
-- ============================================================================

-- RULE-002: Update field_mappings with correct nested paths
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

-- Verify the update
SELECT 
    rule_id,
    rule_name,
    field_mappings
FROM lb_processing_rules
WHERE rule_id = 'RULE-002';

-- Expected output should show:
-- targetField: "to_BusinessPartnerBank/results/0/BankNumber" (with full path)
-- NOT just: "BankNumber"
