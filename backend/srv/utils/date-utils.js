/**
 * Date Utilities
 * Helper functions for date operations
 */

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parse various date formats to ISO
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Try parsing as Date object
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        return d.toISOString();
    }
    
    // Handle MM/DD/YYYY
    const mdyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdyMatch) {
        return new Date(`${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`).toISOString();
    }
    
    // Handle DD/MM/YYYY
    const dmyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) {
        return new Date(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`).toISOString();
    }
    
    return null;
}

/**
 * Get current timestamp
 */
function getCurrentTimestamp() {
    return new Date().toISOString();
}

module.exports = {
    formatDate,
    parseDate,
    getCurrentTimestamp
};
