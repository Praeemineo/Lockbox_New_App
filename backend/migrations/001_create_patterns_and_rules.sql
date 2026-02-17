-- Migration: Create File Patterns and Processing Rules Tables
-- This ensures data persists in PostgreSQL when DB is available

-- Table: file_patterns
CREATE TABLE IF NOT EXISTS file_patterns (
    id SERIAL PRIMARY KEY,
    pattern_id VARCHAR(20) UNIQUE NOT NULL,
    pattern_name VARCHAR(255) NOT NULL,
    description TEXT,
    file_type VARCHAR(50),
    pattern_type VARCHAR(100),
    category VARCHAR(100),
    active BOOLEAN DEFAULT true,
    conditions JSONB DEFAULT '[]'::jsonb,
    actions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: processing_rules
CREATE TABLE IF NOT EXISTS processing_rules (
    id SERIAL PRIMARY KEY,
    rule_id VARCHAR(20) UNIQUE NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    description TEXT,
    file_type VARCHAR(50),
    rule_type VARCHAR(100),
    active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    conditions JSONB DEFAULT '[]'::jsonb,
    api_mappings JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_file_patterns_active ON file_patterns(active);
CREATE INDEX IF NOT EXISTS idx_file_patterns_type ON file_patterns(file_type);
CREATE INDEX IF NOT EXISTS idx_processing_rules_active ON processing_rules(active);
CREATE INDEX IF NOT EXISTS idx_processing_rules_priority ON processing_rules(priority);

-- Comments for documentation
COMMENT ON TABLE file_patterns IS 'Stores file parsing patterns (PAT-001 to PAT-006) for identifying and extracting data from uploaded files';
COMMENT ON TABLE processing_rules IS 'Stores processing rules (RULE-001 to RULE-005) for data validation, enrichment, and SAP posting logic';
