// Rule Service - Fetch processing rules from PostgreSQL with JSON fallback
const pool = require('../db/pool');

/**
 * Fetch a processing rule by ID
 * Tries PostgreSQL first, falls back to JSON file if DB fails
 * @param {string} ruleId - Rule ID (e.g., 'RULE-003')
 * @returns {Object} Rule object
 */
async function getRuleById(ruleId) {
    console.log(`Fetching ${ruleId}...`);
    
    // Try PostgreSQL first
    try {
        const result = await pool.query(
            'SELECT * FROM lb_processing_rules WHERE rule_id = $1',
            [ruleId]
        );
        
        if (result.rows.length > 0) {
            const rule = result.rows[0];
            console.log(`✓ ${ruleId} fetched from PostgreSQL`);
            
            // Parse JSON fields if stored as strings
            if (typeof rule.api_mappings === 'string') {
                rule.api_mappings = JSON.parse(rule.api_mappings);
            }
            if (typeof rule.conditions === 'string') {
                rule.conditions = JSON.parse(rule.conditions);
            }
            
            return rule;
        }
    } catch (dbError) {
        console.log(`⚠ PostgreSQL fetch failed for ${ruleId}:`, dbError.message);
        console.log('Falling back to JSON file...');
    }
    
    // Fallback to JSON file
    try {
        const rulesJson = require('../data/processing_rules.json');
        const rule = rulesJson.find(r => r.ruleId === ruleId);
        
        if (rule) {
            console.log(`✓ ${ruleId} fetched from JSON file`);
            return rule;
        } else {
            throw new Error(`${ruleId} not found in JSON file`);
        }
    } catch (jsonError) {
        console.error(`✗ Failed to fetch ${ruleId} from JSON:`, jsonError.message);
        throw new Error(`Rule ${ruleId} not found in database or JSON file`);
    }
}

/**
 * Get API endpoint configuration from rule
 * @param {Object} rule - Rule object
 * @param {string} httpMethod - HTTP method (GET or POST)
 * @returns {Object} API configuration
 */
function getApiConfig(rule, httpMethod) {
    const apiMappings = Array.isArray(rule.api_mappings) 
        ? rule.api_mappings 
        : rule.apiMappings || [];
    
    const apiConfig = apiMappings.find(api => 
        (api.httpMethod || api.method) === httpMethod
    );
    
    if (!apiConfig) {
        console.warn(`⚠ No ${httpMethod} API found in ${rule.rule_id || rule.ruleId}`);
    }
    
    return apiConfig || {};
}

module.exports = {
    getRuleById,
    getApiConfig
};
