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
 * Normalize file type for pattern matching
 * @param {string} fileType - Raw file type (XLSX, XLS, XLSK, CSV, etc.)
 * @returns {string} - Normalized file type
 */
function normalizeFileType(fileType) {
    const normalized = fileType?.toUpperCase() || 'EXCEL';
    // Excel files: .xlsx, .xls, .xlsk, .xlsm, .xlsb
    if (['XLSX', 'XLS', 'XLSK', 'XLSM', 'XLSB'].includes(normalized)) {
        return 'EXCEL';
    }
    return normalized;
}

/**
 * Get active patterns for a specific file type
 * @param {string} fileType - File type (XLSX, XLS, CSV, PDF, TXT)
 * @returns {array} - Array of active patterns sorted by priority
 */
function getActivePatternsForFileType(fileType) {
    const normalizedType = normalizeFileType(fileType);
    console.log(`   Normalized file type: ${fileType} → ${normalizedType}`);
    
    return cachedFilePatterns
        .filter(pattern => pattern.active && pattern.fileType === normalizedType)
        .sort((a, b) => (a.priority || 100) - (b.priority || 100));
}

/**
 * Detect pattern from uploaded file data
 * @param {array} data - Extracted raw data from file
 * @param {string} fileType - File type (XLSX, XLS, CSV, PDF)
 * @returns {object} - Matched pattern and analysis
 */
function detectPattern(data, fileType = 'XLSX') {
    console.log('🔍 Pattern Detection: Analyzing file structure...');
    console.log(`   File Type (original): ${fileType}`);
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
    
    // Analyze file structure first
    const analysis = analyzeFileStructure(data);
    console.log('   File Analysis:', JSON.stringify(analysis, null, 2));
    
    // Pattern detection with priority order (by priority value, lower = higher priority)
    let detectedPattern = null;
    let detectedAnalysis = analysis;
    
    // PAT-003: Document Split Comma (Priority 5 - HIGHEST for data patterns)
    // Check for comma-separated values in key fields
    if (analysis.hasCommaSeparated) {
        detectedPattern = activePatterns.find(p => p.patternId === 'PAT-003' || p.patternType === 'DOUCMENT_SPLIT_COMMA');
        if (detectedPattern) {
            console.log(`✅ Pattern Matched: PAT-003 - DOUCMENT_SPLIT_COMMA`);
            console.log(`   Comma-separated fields: ${analysis.commaSeparatedFields.join(', ')}`);
            return {
                matched: true,
                pattern: detectedPattern,
                confidence: 95,
                analysis: detectedAnalysis,
                patternId: 'PAT-003',
                patternType: 'DOUCMENT_SPLIT_COMMA',
                message: `Comma-separated values detected in: ${analysis.commaSeparatedFields.join(', ')}`
            };
        }
    }
    
    // PAT-004: Document Range (Priority 6)
    if (analysis.hasRanges) {
        detectedPattern = activePatterns.find(p => p.patternId === 'PAT-004' || p.patternType === 'DOCUMENT_RANGE');
        if (detectedPattern) {
            console.log(`✅ Pattern Matched: PAT-004 - DOCUMENT_RANGE`);
            console.log(`   Range fields: ${analysis.rangeFields.join(', ')}`);
            return {
                matched: true,
                pattern: detectedPattern,
                confidence: 90,
                analysis: detectedAnalysis,
                patternId: 'PAT-004',
                patternType: 'DOCUMENT_RANGE',
                message: `Hyphen ranges detected in: ${analysis.rangeFields.join(', ')}`
            };
        }
    }
    
    // PAT-006: Multi-Sheet (Priority 7)
    // IMPORTANT: Only match if MULTIPLE sheets have actual data (not just empty sheets)
    if (analysis.hasMultipleSheetsWithData && analysis.sheetsWithDataCount > 1) {
        detectedPattern = activePatterns.find(p => p.patternId === 'PAT-006' || p.patternType === 'MULTI_SHEET');
        if (detectedPattern) {
            console.log(`✅ Pattern Matched: PAT-006 - MULTI_SHEET`);
            return {
                matched: true,
                pattern: detectedPattern,
                confidence: 95,
                analysis: detectedAnalysis,
                patternId: 'PAT-006',
                patternType: 'MULTI_SHEET',
                message: `Multiple sheets with data detected (${analysis.sheetsWithDataCount} sheets)`
            };
        }
    }
    // PAT-001: Single Check Single Invoice (Priority 10)
    if (analysis.totalRows === 1 && analysis.uniqueCheckNumbers === 1 && analysis.uniqueInvoices === 1) {
        detectedPattern = activePatterns.find(p => p.patternId === 'PAT-001' || p.patternType === 'SINGLE_CHECK_SINGLE_INVOICE');
        if (detectedPattern) {
            console.log(`✅ Pattern Matched: PAT-001 - SINGLE_CHECK_SINGLE_INVOICE`);
            return {
                matched: true,
                pattern: detectedPattern,
                confidence: 100,
                analysis: detectedAnalysis,
                patternId: 'PAT-001',
                patternType: 'SINGLE_CHECK_SINGLE_INVOICE',
                message: 'Single check with single invoice detected'
            };
        }
    }
    
    // PAT-002: Multiple Check Multiple Invoice (Priority 20)
    if (analysis.totalRows > 1 && (analysis.uniqueCheckNumbers > 1 || analysis.uniqueInvoices > 1)) {
        detectedPattern = activePatterns.find(p => p.patternId === 'PAT-002' || p.patternType === 'MULTI_CHECK_MULTI_INVOICE');
        if (detectedPattern) {
            console.log(`✅ Pattern Matched: PAT-002 - MULTI_CHECK_MULTI_INVOICE`);
            console.log(`   Rows: ${analysis.totalRows}, Checks: ${analysis.uniqueCheckNumbers}, Invoices: ${analysis.uniqueInvoices}`);
            return {
                matched: true,
                pattern: detectedPattern,
                confidence: 95,
                analysis: detectedAnalysis,
                patternId: 'PAT-002',
                patternType: 'MULTI_CHECK_MULTI_INVOICE',
                message: `Multiple checks (${analysis.uniqueCheckNumbers}) and invoices (${analysis.uniqueInvoices}) detected`
            };
        }
    }
    
    // Default: Use PAT-002 as fallback
    console.log('⚠️  No specific pattern matched, using default PAT-002');
    detectedPattern = activePatterns.find(p => p.patternId === 'PAT-002') || activePatterns[0];
    
    return {
        matched: true,
        pattern: detectedPattern,
        confidence: 50,
        analysis: detectedAnalysis,
        patternId: detectedPattern.patternId,
        patternType: detectedPattern.patternType,
        message: 'Using default pattern'
    };
}

/**
 * Analyze file structure to determine characteristics
 * @param {array} data - Raw data
 * @returns {object} - Analysis results
 */
function analyzeFileStructure(data) {
    const analysis = {
        totalRows: data.length,
        uniqueCheckNumbers: 0,
        uniqueInvoices: 0,
        hasEmptyCheckRows: false,
        hasCommaSeparated: false,
        commaSeparatedFields: [],
        hasRanges: false,
        rangeFields: [],
        hasMultipleSheets: false,
        hasMultipleSheetsWithData: false,
        sheetCount: 1,
        sheetsWithDataCount: 0,
        hasDateFields: false,
        dateFields: [],
        detectedColumns: []
    };
    
    if (data.length === 0) return analysis;
    
    const firstRow = data[0];
    analysis.detectedColumns = Object.keys(firstRow);
    
    // Track unique values
    const checkNumbers = new Set();
    const invoices = new Set();
    
    // Track sheets with actual data (non-empty rows)
    const sheetsWithData = new Set();
    
    // Analyze each row
    data.forEach((row, idx) => {
        // Track sheets
        const sheetName = row._sheet || row.SheetName || row['Sheet Name'];
        if (sheetName) {
            analysis.hasMultipleSheets = true;
            // Only count sheets that have actual data (not just headers or empty rows)
            const hasActualData = Object.keys(row).some(key => 
                !key.startsWith('_') && row[key] !== null && row[key] !== undefined && row[key] !== ''
            );
            if (hasActualData) {
                sheetsWithData.add(sheetName);
            }
        }
        
        // Check for check numbers
        const checkNum = row.CheckNumber || row['Check Number'] || row.Check;
        if (checkNum) {
            checkNumbers.add(checkNum);
        } else {
            analysis.hasEmptyCheckRows = true;
        }
        
        // Check for invoices
        const invoice = row.InvoiceNumber || row['Invoice Number'] || row.Invoice;
        if (invoice) invoices.add(invoice);
        
        // Check all fields for patterns
        Object.entries(row).forEach(([key, value]) => {
            if (!value) return;
            const strValue = String(value);
            
            // Check for comma-separated values (e.g., "100,101,102" or "100, 101, 102")
            if (/\d+\s*,\s*\d+/.test(strValue)) {
                analysis.hasCommaSeparated = true;
                if (!analysis.commaSeparatedFields.includes(key)) {
                    analysis.commaSeparatedFields.push(key);
                }
            }
            
            // Check for hyphen ranges (e.g., "100-105")
            if (/\d+-\d+/.test(strValue)) {
                analysis.hasRanges = true;
                if (!analysis.rangeFields.includes(key)) {
                    analysis.rangeFields.push(key);
                }
            }
            
            // Check for date patterns
            if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
                analysis.hasDateFields = true;
                if (!analysis.dateFields.includes(key)) {
                    analysis.dateFields.push(key);
                }
            }
        });
    });
    
    analysis.uniqueCheckNumbers = checkNumbers.size;
    analysis.uniqueInvoices = invoices.size;
    
    // Update sheet counts
    analysis.sheetsWithDataCount = sheetsWithData.size;
    analysis.hasMultipleSheetsWithData = analysis.sheetsWithDataCount > 1;
    
    // Total sheet count (including empty sheets)
    if (analysis.hasMultipleSheets) {
        const allSheets = new Set(data.map(r => r._sheet || r.SheetName || r['Sheet Name']).filter(s => s));
        analysis.sheetCount = allSheets.size || 1;
    }
    
    return analysis;
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
    let extractionLog = [];
    
    // Execute pattern-specific extraction
    switch (pattern.patternType) {
        case 'Single_Check_Single_Invoice':
        case 'SINGLE_CHECK_SINGLE_INVOICE':
            console.log('   Pattern PAT-001: Single check, single invoice - standard extraction');
            processedData = convertDateFormats(processedData);
            extractionLog.push('✅ Single check and single invoice extracted successfully');
            extractionLog.push(`✅ Date validation and conversion completed`);
            break;
        
        case 'Multiple_Check_Multiple_Invoice':
        case 'MULTIPLE_CHECK_MULTIPLE_INVOICE':
            console.log('   Pattern PAT-002: Multiple checks and invoices - multi-line extraction');
            processedData = convertDateFormats(processedData);
            extractionLog.push(`✅ Multiple checks and invoices extracted successfully (${processedData.length} rows)`);
            extractionLog.push(`✅ Date validation and conversion completed`);
            break;
        
        case 'Document_Split_Comma':
        case 'DOCUMENT_SPLIT_COMMA':
            console.log('   Pattern PAT-003: Comma-separated values - splitting into multiple rows');
            const beforeSplit = processedData.length;
            processedData = splitByComma(processedData, 'InvoiceNumber');
            processedData = splitByComma(processedData, 'CheckNumber');
            processedData = convertDateFormats(processedData);
            const afterSplit = processedData.length;
            extractionLog.push(`✅ Comma-separated values split successfully`);
            extractionLog.push(`   Expanded from ${beforeSplit} to ${afterSplit} rows`);
            extractionLog.push(`✅ Amount distributed proportionally across split rows`);
            extractionLog.push(`✅ Date validation and conversion completed`);
            break;
        
        case 'Document_Range':
        case 'DOCUMENT_RANGE':
            console.log('   Pattern PAT-004: Hyphen ranges - expanding into multiple rows');
            const beforeExpand = processedData.length;
            processedData = expandRange(processedData, 'InvoiceNumber');
            processedData = expandRange(processedData, 'CheckNumber');
            processedData = convertDateFormats(processedData);
            const afterExpand = processedData.length;
            extractionLog.push(`✅ Hyphen ranges expanded successfully`);
            extractionLog.push(`   Expanded from ${beforeExpand} to ${afterExpand} rows`);
            extractionLog.push(`✅ Amount distributed proportionally across expanded rows`);
            extractionLog.push(`✅ Date validation and conversion completed`);
            break;
        
        case 'DATE_PATTERN':
            console.log('   Pattern PAT-005: Date format conversion');
            processedData = convertDateFormats(processedData);
            extractionLog.push(`✅ Date format successfully validated and converted to YYYY-MM-DD`);
            break;
        
        case 'Multi_Sheet':
        case 'MULTI_SHEET':
            console.log('   Pattern PAT-006: Multiple sheets - consolidating data');
            processedData = combineSheets(processedData);
            processedData = convertDateFormats(processedData);
            extractionLog.push(`✅ Multiple sheets consolidated successfully`);
            extractionLog.push(`   Total rows after consolidation: ${processedData.length}`);
            extractionLog.push(`✅ Date validation and conversion completed`);
            break;
        
        default:
            console.log('   Using default extraction');
            processedData = convertDateFormats(processedData);
            extractionLog.push(`✅ Data extracted successfully`);
            extractionLog.push(`✅ Date validation and conversion completed`);
    }
    
    // Store extraction log
    processedData._extractionLog = extractionLog;
    
    console.log(`✅ Pattern extraction complete: ${processedData.length} rows processed`);
    extractionLog.forEach(log => console.log(`   ${log}`));
    
    return processedData;
}

/**
 * Convert date formats in all date fields to YYYY-MM-DD
 * @param {array} data - Data with date fields
 * @returns {array} - Data with converted dates
 */
function convertDateFormats(data) {
    return data.map(row => {
        const updatedRow = { ...row };
        
        // Find all date fields
        Object.keys(row).forEach(key => {
            if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
                const dateValue = row[key];
                if (dateValue) {
                    const converted = parseDateToYYYYMMDD(dateValue);
                    if (converted && converted !== dateValue) {
                        updatedRow[key] = converted;
                        updatedRow[`_original_${key}`] = dateValue;
                        updatedRow._dateConverted = true;
                    }
                }
            }
        });
        
        return updatedRow;
    });
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
 * Parse various date formats to YYYY-MM-DD
 * Handles: MMDDYYYY, DDMMYYYY with separators -, /, .
 * @param {string|number} dateStr - Date string or Excel serial number
 * @returns {string} - YYYY-MM-DD format or original if conversion fails
 */
function parseDateToYYYYMMDD(dateStr) {
    if (!dateStr) return null;
    
    // Handle Excel serial date numbers
    if (typeof dateStr === 'number' && dateStr > 40000 && dateStr < 50000) {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + dateStr * 86400000);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    const str = String(dateStr).trim();
    
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }
    
    // Remove separators and try different formats
    const cleaned = str.replace(/[\/\-\.]/g, '');
    
    // YYYYMMDD (8 digits)
    if (/^\d{8}$/.test(cleaned)) {
        const yyyy = cleaned.substring(0, 4);
        const mm = cleaned.substring(4, 6);
        const dd = cleaned.substring(6, 8);
        
        // Validate
        if (parseInt(mm) > 0 && parseInt(mm) <= 12 && parseInt(dd) > 0 && parseInt(dd) <= 31) {
            return `${yyyy}-${mm}-${dd}`;
        }
    }
    
    // MMDDYYYY or DDMMYYYY (try both)
    if (/^\d{6,8}$/.test(cleaned)) {
        // Try MMDDYYYY
        if (cleaned.length === 8) {
            const mm = cleaned.substring(0, 2);
            const dd = cleaned.substring(2, 4);
            const yyyy = cleaned.substring(4, 8);
            
            // Validate month first (MMDDYYYY more common in US)
            if (parseInt(mm) >= 1 && parseInt(mm) <= 12 && parseInt(dd) >= 1 && parseInt(dd) <= 31) {
                return `${yyyy}-${mm}-${dd}`;
            }
            
            // Try DDMMYYYY
            if (parseInt(dd) >= 1 && parseInt(dd) <= 12 && parseInt(mm) >= 1 && parseInt(mm) <= 31) {
                return `${yyyy}-${dd}-${mm}`;
            }
        }
    }
    
    // Try parsing with Date object
    try {
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    } catch (e) {
        // Ignore parsing errors
    }
    
    // Return original if no conversion possible
    console.warn(`   Could not convert date: ${dateStr}`);
    return str;
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
