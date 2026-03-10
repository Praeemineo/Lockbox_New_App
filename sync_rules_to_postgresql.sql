-- ============================================================================
-- PostgreSQL Script to Sync Processing Rules from JSON to Database
-- ============================================================================
-- This script will populate the lb_processing_rules table with all 5 rules
-- Run this in PGAdmin to sync your rules from JSON to PostgreSQL
-- ============================================================================

-- Optional: Clear existing rules (uncomment if you want to start fresh)
-- DELETE FROM lb_processing_rules;

-- ============================================================================
-- RULE-001: Accounting Document Lookup
-- ============================================================================
INSERT INTO lb_processing_rules (
    id, rule_id, rule_name, description, file_type, rule_type, 
    active, priority, destination, conditions, api_mappings, 
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'RULE-001',
    'Accounting Document Lookup',
    'Fetch accounting document details from SAP using invoice number',
    'EXCEL',
    'API_LOOKUP',
    true,
    10,
    'S4HANA_SYSTEM_DESTINATION',
    $$[
        {
            "documentFormat": "Invoice number",
            "condition": "Exist"
        }
    ]$$::jsonb,
    $$[
        {
            "httpMethod": "GET",
            "apiReference": "/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set",
            "destination": "S4HANA_SYSTEM_DESTINATION",
            "inputField": "P_DocumentNumber",
            "sourceInput": "InvoiceNumber",
            "outputField": "AccountingDocument",
            "lockboxApiField": "Paymentreference"
        },
        {
            "httpMethod": "GET",
            "apiReference": "/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT(P_DocumentNumber='')/Set",
            "destination": "S4HANA_SYSTEM_DESTINATION",
            "inputField": "P_DocumentNumber",
            "sourceInput": "InvoiceNumber",
            "outputField": "CompanyCode",
            "lockboxApiField": "CompanyCode"
        }
    ]$$::jsonb,
    '2026-02-16T12:00:00Z'::timestamp,
    '2026-02-28T13:30:00Z'::timestamp
)
ON CONFLICT (rule_id) DO UPDATE SET
    rule_name = EXCLUDED.rule_name,
    description = EXCLUDED.description,
    file_type = EXCLUDED.file_type,
    rule_type = EXCLUDED.rule_type,
    active = EXCLUDED.active,
    priority = EXCLUDED.priority,
    destination = EXCLUDED.destination,
    conditions = EXCLUDED.conditions,
    api_mappings = EXCLUDED.api_mappings,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- RULE-002: Partner Bank Details
-- ============================================================================
INSERT INTO lb_processing_rules (
    id, rule_id, rule_name, description, file_type, rule_type, 
    active, priority, destination, conditions, api_mappings, 
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'RULE-002',
    'Partner Bank Details',
    'Retrieve bank account details for partner validation',
    'EXCEL',
    'BANK_VALIDATION',
    true,
    10,
    'S4HANA_SYSTEM_DESTINATION',
    $$[
        {
            "documentFormat": "Customer Number",
            "condition": "Exist"
        }
    ]$$::jsonb,
    $$[
        {
            "httpMethod": "GET",
            "apiReference": "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner(BusinessPartner='')?$expand=to_BusinessPartnerBank&$format=json",
            "destination": "S4HANA_SYSTEM_DESTINATION",
            "inputField": "BusinessPartner",
            "sourceInput": "CustomerNumber",
            "outputField": "to_BusinessPartnerBank/results/0/BankNumber",
            "lockboxApiField": "PartnerBank"
        },
        {
            "httpMethod": "GET",
            "apiReference": "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner(BusinessPartner='')?$expand=to_BusinessPartnerBank&$format=json",
            "destination": "S4HANA_SYSTEM_DESTINATION",
            "inputField": "BusinessPartner",
            "sourceInput": "CustomerNumber",
            "outputField": "to_BusinessPartnerBank/results/0/BankAccount",
            "lockboxApiField": "PartnerBankAccount"
        },
        {
            "httpMethod": "GET",
            "apiReference": "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner(BusinessPartner='')?$expand=to_BusinessPartnerBank&$format=json",
            "destination": "S4HANA_SYSTEM_DESTINATION",
            "inputField": "BusinessPartner",
            "sourceInput": "CustomerNumber",
            "outputField": "to_BusinessPartnerBank/results/0/BankCountryKey",
            "lockboxApiField": "PartnerBankCountry"
        }
    ]$$::jsonb,
    '2026-02-16T12:00:00Z'::timestamp,
    '2026-02-28T13:45:00Z'::timestamp
)
ON CONFLICT (rule_id) DO UPDATE SET
    rule_name = EXCLUDED.rule_name,
    description = EXCLUDED.description,
    file_type = EXCLUDED.file_type,
    rule_type = EXCLUDED.rule_type,
    active = EXCLUDED.active,
    priority = EXCLUDED.priority,
    destination = EXCLUDED.destination,
    conditions = EXCLUDED.conditions,
    api_mappings = EXCLUDED.api_mappings,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- RULE-003: SAP Production Run
-- ============================================================================
INSERT INTO lb_processing_rules (
    id, rule_id, rule_name, description, file_type, rule_type, 
    active, priority, destination, conditions, api_mappings, 
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'RULE-003',
    'SAP Production Run',
    'Fetch Payload do production run and post accounting document',
    'EXCEL',
    'Production_Run',
    true,
    10,
    'S4HANA_SYSTEM_DESTINATION',
    '[
        {
            "documentFormat": "Status",
            "condition": "Simulated"
        }
    ]'::jsonb,
    '[
        {
            "httpMethod": "POST",
            "apiReference": "/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch",
            "destination": "S4HANA_SYSTEM_DESTINATION",
            "inputField": "SAP Payload",
            "sourceInput": "SAP Payload",
            "outputField": "",
            "lockboxApiField": ""
        },
        {
            "httpMethod": "GET",
            "apiReference": "/sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxClearing",
            "destination": "S4HANA_SYSTEM_DESTINATION",
            "inputField": "Lockbox Batch",
            "sourceInput": "Payment Advice",
            "outputField": "Accounting document",
            "lockboxApiField": "Subledgerdocument"
        }
    ]'::jsonb,
    '2026-02-16T12:00:00Z'::timestamp,
    '2026-03-04T12:03:55.090Z'::timestamp
)
ON CONFLICT (rule_id) DO UPDATE SET
    rule_name = EXCLUDED.rule_name,
    description = EXCLUDED.description,
    file_type = EXCLUDED.file_type,
    rule_type = EXCLUDED.rule_type,
    active = EXCLUDED.active,
    priority = EXCLUDED.priority,
    destination = EXCLUDED.destination,
    conditions = EXCLUDED.conditions,
    api_mappings = EXCLUDED.api_mappings,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- RULE-004: Get Accounting Document
-- ============================================================================
INSERT INTO lb_processing_rules (
    id, rule_id, rule_name, description, file_type, rule_type, 
    active, priority, destination, conditions, api_mappings, 
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'RULE-004',
    'Get Accounting Document',
    'Retrieve Accounting document',
    'EXCEL',
    'Accounting_Document',
    true,
    10,
    'S4HANA_SYSTEM_DESTINATION',
    '[
        {
            "documentFormat": "Invoice Number",
            "condition": "Open Item Check"
        },
        {
            "documentFormat": "Document Amount",
            "condition": "Amount Verification"
        }
    ]'::jsonb,
    '[
        {
            "httpMethod": "GET",
            "apiReference": "/sap/opu/odata4/sap/zsb_acc_bank_stmt/srvd_a2x/sap/zsd_acc_bank_stmt/0001/ZFI_I_ACC_BANK_STMT",
            "destination": "S4HANA_SYSTEM_DESTINATION",
            "inputField": "LockBoxId",
            "sourceInput": "InvoiceReference",
            "outputField": "DocumentNumber,PaymentAdvice,SubledgerDocument,CompanyCode,SubledgerOnaccountDocument",
            "lockboxApiField": "Accounting Document"
        }
    ]'::jsonb,
    '2026-02-16T12:00:00Z'::timestamp,
    '2026-03-04T12:05:50.079Z'::timestamp
)
ON CONFLICT (rule_id) DO UPDATE SET
    rule_name = EXCLUDED.rule_name,
    description = EXCLUDED.description,
    file_type = EXCLUDED.file_type,
    rule_type = EXCLUDED.rule_type,
    active = EXCLUDED.active,
    priority = EXCLUDED.priority,
    destination = EXCLUDED.destination,
    conditions = EXCLUDED.conditions,
    api_mappings = EXCLUDED.api_mappings,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- RULE-005: Payment Terms Lookup
-- ============================================================================
INSERT INTO lb_processing_rules (
    id, rule_id, rule_name, description, file_type, rule_type, 
    active, priority, destination, conditions, api_mappings, 
    created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'RULE-005',
    'Payment Terms Lookup',
    'Retrieve payment terms for invoice processing',
    'EXCEL',
    'ENRICHMENT',
    true,
    10,
    'S4HANA_SYSTEM_DESTINATION',
    '[
        {
            "documentFormat": "Customer Number",
            "condition": "Payment Terms Lookup"
        },
        {
            "documentFormat": "Due Date",
            "condition": "Calculate Due Date"
        }
    ]'::jsonb,
    '[
        {
            "httpMethod": "GET",
            "apiReference": "/sap/opu/odata/sap/API_PAYMENTTERMS/PaymentTerms",
            "destination": "S4HANA_SYSTEM_DESTINATION",
            "inputField": "Customer",
            "sourceInput": "CustomerID",
            "outputField": "TermsOfPayment",
            "lockboxApiField": "PaymentTerm"
        }
    ]'::jsonb,
    '2026-02-16T12:00:00Z'::timestamp,
    '2026-02-16T12:00:00Z'::timestamp
)
ON CONFLICT (rule_id) DO UPDATE SET
    rule_name = EXCLUDED.rule_name,
    description = EXCLUDED.description,
    file_type = EXCLUDED.file_type,
    rule_type = EXCLUDED.rule_type,
    active = EXCLUDED.active,
    priority = EXCLUDED.priority,
    destination = EXCLUDED.destination,
    conditions = EXCLUDED.conditions,
    api_mappings = EXCLUDED.api_mappings,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify all rules were inserted successfully
SELECT 
    rule_id, 
    rule_name, 
    rule_type, 
    active,
    jsonb_array_length(api_mappings) as api_mapping_count,
    jsonb_array_length(conditions) as condition_count,
    updated_at
FROM lb_processing_rules
ORDER BY rule_id;

-- ============================================================================
-- Script Complete
-- ============================================================================
-- Expected Result: 5 rules (RULE-001 through RULE-005) inserted/updated
-- ============================================================================
