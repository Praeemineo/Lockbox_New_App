-- ============================================================================
-- UPDATE PROCESSING RULES IN POSTGRESQL
-- Updates RULE-001, RULE-002, and RULE-004 with new field mapping structure
-- ============================================================================

-- RULE-001: Accounting Document Lookup
UPDATE lb_processing_rules
SET 
    field_mappings = '[
        {
            "sourceField": "Invoice Number",
            "targetField": "AccountingDocument",
            "apiField": "PaymentReference"
        },
        {
            "sourceField": "Invoice Number",
            "targetField": "CompanyCode",
            "apiField": "CompanyCode"
        }
    ]'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE rule_id = 'RULE-001';

-- RULE-002: Partner Bank Details
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

-- RULE-004: Get Accounting Document
UPDATE lb_processing_rules
SET 
    field_mappings = '[
        {
            "sourceField": "LockBox ID",
            "targetField": "DocumentNumber",
            "apiField": "DocumentNumber"
        },
        {
            "sourceField": "LockBox ID",
            "targetField": "PaymentAdvice",
            "apiField": "PaymentAdvice"
        },
        {
            "sourceField": "LockBox ID",
            "targetField": "SubledgerDocument",
            "apiField": "SubledgerDocument"
        },
        {
            "sourceField": "LockBox ID",
            "targetField": "AccountingDocument",
            "apiField": "AccountingDocument"
        },
        {
            "sourceField": "LockBox ID",
            "targetField": "CompanyCode",
            "apiField": "CompanyCode"
        },
        {
            "sourceField": "LockBox ID",
            "targetField": "FiscalYear",
            "apiField": "FiscalYear"
        }
    ]'::jsonb,
    api_mappings = '[
        {
            "sourceType": "OData V4",
            "destination": "S4HANA_SYSTEM_DESTINATION",
            "httpMethod": "GET",
            "apiReference": "/sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT"
        }
    ]'::jsonb,
    conditions = '[
        {
            "attribute": "Status",
            "operator": "equals",
            "value": "Posted"
        }
    ]'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE rule_id = 'RULE-004';

-- Verify the updates
SELECT 
    rule_id,
    rule_name,
    field_mappings,
    updated_at
FROM lb_processing_rules
WHERE rule_id IN ('RULE-001', 'RULE-002', 'RULE-004')
ORDER BY rule_id;
