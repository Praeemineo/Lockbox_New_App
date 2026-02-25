/**
 * Pattern Detection Engine
 * Dynamically detects file patterns from file_pattern PostgreSQL table
 * Handles pattern matching, data extraction, and transformation based on database configuration
 */

const logger = require('../utils/logger');

// Cache for loaded patterns
let cachedFilePatterns = [];

/**
 * Load file patterns from parent process (server.js provides this)
 * @param {array} patterns - Array of file patterns from database
 */
function loadFilePatterns(patterns) {
    cachedFilePatterns = patterns || [];
    console.log(`✅ Pattern Engine: Loaded ${cachedFilePatterns.length} file patterns`);
}

/**
 * Get active patterns for a specific file type
 * @param {string} fileType - File type (EXCEL, CSV, PDF, TXT)
 * @returns {array} - Array of active patterns sorted by priority
 */
function getActivePatternsForFileType(fileType) {
    return cachedFilePatterns
        .filter(pattern => pattern.active && pattern.fileType === fileType)
        .sort((a, b) => (a.priority || 100) - (b.priority || 100));
}

/**
 * Detect pattern from uploaded file data
 * @param {array} data - Extracted raw data from file
 * @param {string} fileType - File type (EXCEL, CSV, PDF)
 * @returns {object} - Matched pattern and analysis
 */
function detectPattern(data, fileType = 'EXCEL') {
    console.log('🔍 Pattern Detection: Analyzing file structure...');
    console.log(`   File Type: ${fileType}`);
    console.log(`   Data Rows: ${data.length}`);
    
    const activePatterns = getActivePatternsForFileType(fileType);
    
    if (activePatterns.length === 0) {
        console.warn('⚠️  No active patterns found for file type:', fileType);
        return {
            matched: false,
            pattern: null,
            confidence: 0,
            analysis: {},
            error: 'No active patterns available for this file type'
        };
    }
    
    console.log(`   Checking ${activePatterns.length} active patterns...`);
    
    // Try each pattern in priority order
    for (const pattern of activePatterns) {
        const matchResult = checkPatternMatch(data, pattern);
        
        if (matchResult.matched) {
            console.log(`✅ Pattern Matched: ${pattern.patternId} - ${pattern.patternName}`);
            console.log(`   Pattern Type: ${pattern.patternType}`);
            console.log(`   Confidence: ${matchResult.confidence}%`);
            
            return {
                matched: true,
                pattern: pattern,
                confidence: matchResult.confidence,
                analysis: matchResult.analysis,
                patternId: pattern.patternId,
                patternType: pattern.patternType
            };
        }
    }
    
    // No pattern matched - use default
    console.log('⚠️  No specific pattern matched, using default pattern');
    return {
        matched: false,
        pattern: activePatterns[0] || null,
        confidence: 0,
        analysis: {},
        error: 'No matching pattern found'
    };
}

/**
 * Check if data matches a specific pattern
 * @param {array} data - File data
 * @param {object} pattern - Pattern definition from database
 * @returns {object} - Match result with confidence score
 */
function checkPatternMatch(data, pattern) {
    const analysis = {
        totalRows: data.length,
        checkNumbers: 0,
        invoices: 0,
        amounts: 0,
        hasEmptyCheckRows: false,
        hasCommaSeparated: false,
        hasRanges: false,
        hasMultipleSheets: false,
        detectedColumns: []
    };
    
    // Analyze data structure
    if (data.length > 0) {
        const firstRow = data[0];
        analysis.detectedColumns = Object.keys(firstRow);
        
        // Count patterns in data
        data.forEach(row => {
            if (row.CheckNumber || row['Check Number']) analysis.checkNumbers++;
            if (row.InvoiceNumber || row['Invoice Number']) analysis.invoices++;
            if (row.CheckAmount || row.InvoiceAmount) analysis.amounts++;
            
            // Check for comma-separated values
            Object.values(row).forEach(val => {
                if (typeof val === 'string' && val.includes(',') && /\d+,\d+/.test(val)) {
                    analysis.hasCommaSeparated = true;
                }
                // Check for ranges (e.g., 100-105)
                if (typeof val === 'string' && /\d+-\d+/.test(val)) {
                    analysis.hasRanges = true;
                }
            });
        });
        
        // Check for empty check numbers
        const emptyChecks = data.filter(row => !row.CheckNumber && !row['Check Number']).length;
        analysis.hasEmptyCheckRows = emptyChecks > 0;
    }
    
    // Match against pattern conditions
    let matchScore = 0;
    let totalConditions = 0;
    
    if (pattern.conditions && Array.isArray(pattern.conditions)) {
        totalConditions = pattern.conditions.length;
        
        pattern.conditions.forEach(condition => {
            if (evaluateCondition(condition, analysis, data)) {
                matchScore++;
            }
        });
    } else {
        // Use pattern type for basic matching if no conditions defined
        totalConditions = 1;
        matchScore = matchByPatternType(pattern.patternType, analysis);
    }
    
    const confidence = totalConditions > 0 ? Math.round((matchScore / totalConditions) * 100) : 0;
    const matched = confidence >= 50; // 50% match threshold
    
    return {
        matched,
        confidence,
        analysis
    };
}

/**
 * Evaluate a single condition
 * @param {object} condition - Condition from pattern
 * @param {object} analysis - Data analysis results
 * @param {array} data - Original data
 * @returns {boolean} - True if condition is met
 */
function evaluateCondition(condition, analysis, data) {
    const { field, operator, value } = condition;
    
    switch (operator) {
        case 'equals':
            return analysis[field] === value;
        case 'greaterThan':
            return analysis[field] > value;
        case 'lessThan':
            return analysis[field] < value;
        case 'contains':
            return analysis[field] && String(analysis[field]).includes(value);
        case 'exists':
            return analysis[field] !== undefined && analysis[field] !== null;
        case 'hasValue':
            return analysis[field] === true;
        default:
            return false;
    }
}

/**
 * Match by pattern type when no conditions defined
 * @param {string} patternType - Pattern type identifier
 * @param {object} analysis - Data analysis
 * @returns {number} - Match score (0 or 1)
 */
function matchByPatternType(patternType, analysis) {
    switch (patternType) {
        case 'Single_Check_Single_Invoice':
        case 'SINGLE_CHECK_SINGLE_INVOICE':
            return (analysis.totalRows === 1 && analysis.checkNumbers === 1 && analysis.invoices === 1) ? 1 : 0;
        
        case 'Multiple_Check_Multiple_Invoice':
        case 'MULTIPLE_CHECK_MULTIPLE_INVOICE':
            return (analysis.totalRows > 1 && analysis.checkNumbers > 1) ? 1 : 0;
        
        case 'Document_Split_Comma':
        case 'DOCUMENT_SPLIT_COMMA':
            return analysis.hasCommaSeparated ? 1 : 0;
        
        case 'Document_Range':
        case 'DOCUMENT_RANGE':
            return analysis.hasRanges ? 1 : 0;
        
        case 'DATE_PATTERN':
            // Check for date patterns in data
            return 0.5; // Partial match
        
        case 'Multi_Sheet':
        case 'MULTI_SHEET':
            return analysis.hasMultipleSheets ? 1 : 0;
        
        default:
            return 0;
    }
}

/**
 * Execute pattern-based data extraction
 * @param {array} data - Raw data from file
 * @param {object} pattern - Matched pattern
 * @returns {array} - Processed data based on pattern actions
 */
function executePatternExtraction(data, pattern) {
    console.log(`🔧 Executing pattern extraction: ${pattern.patternType}`);
    
    let processedData = [...data];
    
    // Execute pattern-specific actions
    if (pattern.actions && Array.isArray(pattern.actions)) {
        pattern.actions.forEach(action => {
            processedData = executeAction(action, processedData, pattern);
        });
    } else {
        // Execute default actions based on pattern type
        processedData = executeDefaultPatternActions(pattern.patternType, processedData);
    }
    
    console.log(`✅ Pattern extraction complete: ${processedData.length} rows processed`);
    return processedData;
}

/**
 * Execute a single action on data
 * @param {object} action - Action definition
 * @param {array} data - Current data
 * @param {object} pattern - Pattern context
 * @returns {array} - Transformed data
 */
function executeAction(action, data, pattern) {
    const { actionType, field, value, config } = action;
    
    switch (actionType) {
        case 'split_comma':
            return splitByComma(data, field);
        
        case 'expand_range':
            return expandRange(data, field);
        
        case 'convert_date':
            return convertDateFormat(data, field, config);
        
        case 'fill_down':
            return fillDownEmpty(data, field);
        
        case 'combine_sheets':
            return combineSheets(data);
        
        case 'apply_mapping':
            return applyFieldMapping(data, pattern.fieldMappings);
        
        default:
            console.warn(`Unknown action type: ${actionType}`);
            return data;
    }
}

/**
 * Execute default actions based on pattern type
 * @param {string} patternType - Pattern type
 * @param {array} data - Data to process
 * @returns {array} - Processed data
 */
function executeDefaultPatternActions(patternType, data) {
    switch (patternType) {
        case 'Document_Split_Comma':
        case 'DOCUMENT_SPLIT_COMMA':
            return splitByComma(data, 'InvoiceNumber');
        
        case 'Document_Range':
        case 'DOCUMENT_RANGE':
            return expandRange(data, 'InvoiceNumber');
        
        case 'DATE_PATTERN':
            return convertDateFormat(data, 'DepositDate');
        
        case 'Multi_Sheet':
        case 'MULTI_SHEET':
            return combineSheets(data);
        
        default:
            return data;
    }
}

/**
 * Split comma-separated values into multiple rows
 * @param {array} data - Original data
 * @param {string} field - Field to split
 * @returns {array} - Expanded data
 */
function splitByComma(data, field = 'InvoiceNumber') {
    const result = [];
    
    data.forEach(row => {
        const fieldValue = row[field] || row['Invoice Number'];
        
        if (fieldValue && typeof fieldValue === 'string' && fieldValue.includes(',')) {
            const values = fieldValue.split(',').map(v => v.trim());
            const baseAmount = row.InvoiceAmount || row.CheckAmount || 0;
            const splitAmount = values.length > 0 ? baseAmount / values.length : baseAmount;
            
            values.forEach(val => {
                result.push({
                    ...row,
                    [field]: val,
                    InvoiceAmount: splitAmount,
                    _splitFrom: fieldValue,
                    _splitCount: values.length
                });
            });
        } else {
            result.push(row);
        }
    });
    
    console.log(`   Split by comma: ${data.length} → ${result.length} rows`);
    return result;
}

/**
 * Expand range values into multiple rows
 * @param {array} data - Original data
 * @param {string} field - Field with range
 * @returns {array} - Expanded data
 */
function expandRange(data, field = 'InvoiceNumber') {
    const result = [];
    
    data.forEach(row => {
        const fieldValue = row[field];
        
        if (fieldValue && typeof fieldValue === 'string' && /(\d+)-(\d+)/.test(fieldValue)) {
            const match = fieldValue.match(/(\d+)-(\d+)/);
            const start = parseInt(match[1]);
            const end = parseInt(match[2]);
            
            const baseAmount = row.InvoiceAmount || row.CheckAmount || 0;
            const count = end - start + 1;
            const splitAmount = count > 0 ? baseAmount / count : baseAmount;
            
            for (let i = start; i <= end; i++) {
                result.push({
                    ...row,
                    [field]: String(i),
                    InvoiceAmount: splitAmount,
                    _expandedFrom: fieldValue,
                    _expandCount: count
                });
            }
        } else {
            result.push(row);
        }
    });
    
    console.log(`   Expand range: ${data.length} → ${result.length} rows`);
    return result;
}

/**
 * Convert date format to YYYYMMDD
 * @param {array} data - Original data
 * @param {string} field - Date field
 * @param {object} config - Date format configuration
 * @returns {array} - Data with converted dates
 */
function convertDateFormat(data, field = 'DepositDate', config = {}) {
    return data.map(row => {
        const dateValue = row[field];
        
        if (dateValue) {
            const converted = parseDateToYYYYMMDD(dateValue, config);
            if (converted) {
                return {
                    ...row,
                    [field]: converted,
                    [`_original_${field}`]: dateValue
                };
            }
        }
        
        return row;
    });
}

/**
 * Parse various date formats to YYYYMMDD
 * @param {string} dateStr - Date string
 * @param {object} config - Format config
 * @returns {string} - YYYYMMDD format
 */
function parseDateToYYYYMMDD(dateStr, config = {}) {
    if (!dateStr) return null;
    
    const str = String(dateStr).replace(/[\/\-\.]/g, '');
    
    // Try MMDDYYYY
    if (str.length === 8) {
        const mm = str.substring(0, 2);
        const dd = str.substring(2, 4);
        const yyyy = str.substring(4, 8);
        
        if (parseInt(mm) <= 12 && parseInt(dd) <= 31) {
            return `${yyyy}${mm}${dd}`;
        }
        
        // Try DDMMYYYY
        if (parseInt(dd) <= 12 && parseInt(mm) <= 31) {
            return `${yyyy}${dd}${mm}`;
        }
    }
    
    return dateStr;
}

/**
 * Fill down empty values from previous row
 * @param {array} data - Original data
 * @param {string} field - Field to fill
 * @returns {array} - Filled data
 */
function fillDownEmpty(data, field) {
    let lastValue = null;
    
    return data.map(row => {
        if (row[field]) {
            lastValue = row[field];
            return row;
        } else if (lastValue) {
            return {
                ...row,
                [field]: lastValue,
                [`_filledDown_${field}`]: true
            };
        }
        return row;
    });
}

/**
 * Combine multiple sheets
 * @param {array} data - Data from multiple sheets
 * @returns {array} - Combined data
 */
function combineSheets(data) {
    // Assumes data is already combined by the upload handler
    console.log(`   Combining sheets: ${data.length} total rows`);
    return data;
}

/**
 * Apply field mappings from pattern
 * @param {array} data - Original data
 * @param {object} mappings - Field mappings
 * @returns {array} - Mapped data
 */
function applyFieldMapping(data, mappings) {
    if (!mappings) return data;
    
    return data.map(row => {
        const mapped = { ...row };
        
        Object.keys(mappings).forEach(sourceField => {
            const targetField = mappings[sourceField];
            if (row[sourceField] !== undefined) {
                mapped[targetField] = row[sourceField];
            }
        });
        
        return mapped;
    });
}

module.exports = {
    loadFilePatterns,
    getActivePatternsForFileType,
    detectPattern,
    checkPatternMatch,
    executePatternExtraction,
    splitByComma,
    expandRange,
    convertDateFormat,
    fillDownEmpty,
    combineSheets
};
