-- Update Rule IDs from Sequential to Descriptive Names
-- PostgreSQL Update Script

-- Check current Rule IDs before update
SELECT rule_id, rule_name, description 
FROM lb_processing_rules 
ORDER BY id;

-- Update RULE-001 to RULE_FETCH_ACCT_DOC
UPDATE lb_processing_rules 
SET rule_id = 'RULE_FETCH_ACCT_DOC' 
WHERE rule_id = 'RULE-001';

-- Update RULE-002 to RULE_FETCH_PARTNER_BANK
UPDATE lb_processing_rules 
SET rule_id = 'RULE_FETCH_PARTNER_BANK' 
WHERE rule_id = 'RULE-002';

-- Update RULE-003 to RULE_POST_LOCKBOX_SAP
UPDATE lb_processing_rules 
SET rule_id = 'RULE_POST_LOCKBOX_SAP' 
WHERE rule_id = 'RULE-003';

-- Update RULE-004 to RULE_FETCH_CLEARING_DOC
UPDATE lb_processing_rules 
SET rule_id = 'RULE_FETCH_CLEARING_DOC' 
WHERE rule_id = 'RULE-004';

-- Update RULE-005 to RULE_FETCH_LOCKBOX_DATA
UPDATE lb_processing_rules 
SET rule_id = 'RULE_FETCH_LOCKBOX_DATA' 
WHERE rule_id = 'RULE-005';

-- Verify updates
SELECT rule_id, rule_name, description 
FROM lb_processing_rules 
ORDER BY id;

-- Output summary
SELECT 
    'Total Rules Updated: ' || COUNT(*) as summary
FROM lb_processing_rules 
WHERE rule_id LIKE 'RULE_%' AND rule_id NOT LIKE 'RULE-%';
