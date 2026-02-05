/**
 * File Pattern Utilities
 * Handles file pattern matching and extraction
 */

const fs = require('fs');
const path = require('path');
const { PATHS } = require('../config');

const PATTERNS_FILE = path.join(PATHS.DATA_DIR, 'file_patterns.json');

function loadFilePatterns() {
    try {
        if (fs.existsSync(PATTERNS_FILE)) {
            const data = fs.readFileSync(PATTERNS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Error loading file patterns:', err.message);
    }
    return [];
}

function saveFilePatterns(patterns) {
    try {
        fs.writeFileSync(PATTERNS_FILE, JSON.stringify(patterns, null, 2));
    } catch (err) {
        console.error('Error saving file patterns:', err.message);
    }
}

module.exports = {
    loadFilePatterns,
    saveFilePatterns
};
