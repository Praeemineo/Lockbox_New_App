-- ============================================================================
-- Manual Data Sync: JSON to lb_processing_rules Table
-- Execute this SQL script in your PostgreSQL database to populate the table
-- ============================================================================

-- First, verify the table exists
SELECT COUNT(*) FROM lb_processing_rules;

-- Clear any existing data (optional)
-- DELETE FROM lb_processing_rules;

-- Insert RULE-001: Accounting Document Lookup
INSERT INTO lb_processing_rules (
    id, rule_id, rule_name, description, file_type, rule_type, active, priority, 
    destination, conditions, api_mappings, created_at, updated_at
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
    '[{"documentFormat":"Invoice number","condition":"Exist"}]'::jsonb,
    '[{"httpMethod":"GET","apiReference":"/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT","destination":"S4HANA_SYSTEM_DESTINATION","inputField":"P_Documentnumber","sourceInput":"InvoiceNumber","outputField":"BELNR","lockboxApiField":"Paymentreference"},{"httpMethod":"GET","apiReference":"/sap/opu/odata4/sap/zsb_acc_document/srvd_a2x/sap/zsd_acc_document/0001/ZFI_I_ACC_DOCUMENT","destination":"S4HANA_SYSTEM_DESTINATION","inputField":"P_Documentnumber","sourceInput":"InvoiceNumber","outputField":"CompanyCode","lockboxApiField":"CompanyCode"}]'::jsonb,
    '2026-02-16T12:00:00Z'::timestamp,
    CURRENT_TIMESTAMP
) ON CONFLICT (rule_id) DO UPDATE SET
    rule_name = EXCLUDED.rule_name,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- Insert RULE-002: Partner Bank Details
INSERT INTO lb_processing_rules (
    id, rule_id, rule_name, description, file_type, rule_type, active, priority, 
    destination, conditions, api_mappings, created_at, updated_at
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
    '[{"documentFormat":"Customer Number","condition":"Exist"},{"documentFormat":"BankIdentification","condition":"0001"}]'::jsonb,
    '[{"httpMethod":"GET","apiReference":"/sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartnerBank","destination":"S4HANA_SYSTEM_DESTINATION","inputField":"A_BusinessPartner","sourceInput":"CustomerNumber","filterConditions":{"BankIdentification":"0001"},"outputField":"BankNumber","lockboxApiField":"PartnerBank"},{"httpMethod":"GET","apiReference":"/sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartnerBank","destination":"S4HANA_SYSTEM_DESTINATION","inputField":"A_BusinessPartner","sourceInput":"CustomerNumber","filterConditions":{"BankIdentification":"0001"},"outputField":"BankAccount","lockboxApiField":"PartnerBankAccount"},{"httpMethod":"GET","apiReference":"/sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartnerBank","destination":"S4HANA_SYSTEM_DESTINATION","inputField":"A_BusinessPartner","sourceInput":"CustomerNumber","filterConditions":{"BankIdentification":"0001"},"outputField":"BankCountryKey","lockboxApiField":"PartnerBankCountry"}]'::jsonb,
    '2026-02-16T12:00:00Z'::timestamp,
    CURRENT_TIMESTAMP
) ON CONFLICT (rule_id) DO UPDATE SET
    rule_name = EXCLUDED.rule_name,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- Insert RULE-003: Customer Master Data
INSERT INTO lb_processing_rules (
    id, rule_id, rule_name, description, file_type, rule_type, active, priority, 
    destination, conditions, api_mappings, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'RULE-003',
    'Customer Master Data',
    'Fetch customer master data for validation and enrichment',
    'EXCEL',
    'MASTER_DATA',
    true,
    10,
    'S4HANA_SYSTEM_DESTINATION',
    '[{"documentFormat":"Customer Number","condition":"Master Data Verification"},{"documentFormat":"Customer Name","condition":"Name Matching"},{"documentFormat":"Customer Category","condition":"Category Validation"}]'::jsonb,
    '[{"httpMethod":"GET","apiReference":"/sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartner","destination":"S4HANA_SYSTEM_DESTINATION","inputField":"BusinessPartner","sourceInput":"CheckCustomer","outputField":"Customer","lockboxApiField":"CustomerNumber"},{"httpMethod":"GET","apiReference":"/sap/opu/odata/sap/API_BUSINESSPARTNER/A_BusinessPartner","destination":"S4HANA_SYSTEM_DESTINATION","inputField":"SearchTerm1","sourceInput":"CustomerSearch","outputField":"SearchTerm","lockboxApiField":"SearchKey"}]'::jsonb,
    '2026-02-16T12:00:00Z'::timestamp,
    CURRENT_TIMESTAMP
) ON CONFLICT (rule_id) DO UPDATE SET
    rule_name = EXCLUDED.rule_name,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- Insert RULE-004: Open Item Verification
INSERT INTO lb_processing_rules (
    id, rule_id, rule_name, description, file_type, rule_type, active, priority, 
    destination, conditions, api_mappings, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    'RULE-004',
    'Open Item Verification',
    'Check open invoice items before clearing',
    'EXCEL',
    'VALIDATION',
    true,
    10,
    'S4HANA_SYSTEM_DESTINATION',
    '[{"documentFormat":"Invoice Number","condition":"Open Item Check"},{"documentFormat":"Document Amount","condition":"Amount Verification"}]'::jsonb,
    '[{"httpMethod":"GET","apiReference":"/sap/opu/odata/sap/API_ODATA_FI_OPEN_ITEMS/OpenItems","destination":"S4HANA_SYSTEM_DESTINATION","inputField":"DocumentNumber","sourceInput":"InvoiceReference","outputField":"DocumentAmount","lockboxApiField":"InvoiceAmount"}]'::jsonb,
    '2026-02-16T12:00:00Z'::timestamp,
    CURRENT_TIMESTAMP
) ON CONFLICT (rule_id) DO UPDATE SET
    rule_name = EXCLUDED.rule_name,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- Insert RULE-005: Payment Terms Lookup
INSERT INTO lb_processing_rules (
    id, rule_id, rule_name, description, file_type, rule_type, active, priority, 
    destination, conditions, api_mappings, created_at, updated_at
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
    '[{"documentFormat":"Customer Number","condition":"Payment Terms Lookup"},{"documentFormat":"Due Date","condition":"Calculate Due Date"}]'::jsonb,
    '[{"httpMethod":"GET","apiReference":"/sap/opu/odata/sap/API_PAYMENTTERMS/PaymentTerms","destination":"S4HANA_SYSTEM_DESTINATION","inputField":"Customer","sourceInput":"CustomerID","outputField":"TermsOfPayment","lockboxApiField":"PaymentTerm"}]'::jsonb,
    '2026-02-16T12:00:00Z'::timestamp,
    CURRENT_TIMESTAMP
) ON CONFLICT (rule_id) DO UPDATE SET
    rule_name = EXCLUDED.rule_name,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- Verify all rules were inserted
SELECT rule_id, rule_name, file_type, rule_type, active 
FROM lb_processing_rules 
ORDER BY rule_id;

-- Count total rules
SELECT COUNT(*) as total_rules FROM lb_processing_rules;
