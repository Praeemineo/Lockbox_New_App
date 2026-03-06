sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/VBox",
    "sap/m/TextArea",
    "sap/ui/unified/FileUploader",
    "sap/m/ViewSettingsDialog",
    "sap/m/ViewSettingsItem",
    "sap/m/CheckBox",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/m/SearchField"
], function (Controller, JSONModel, MessageToast, MessageBox, BusyIndicator, Dialog, Button, Label, VBox, TextArea, FileUploader, ViewSettingsDialog, ViewSettingsItem, CheckBox, List, StandardListItem, SearchField) {
    "use strict";

    // API Base - Use relative path for BTP deployment (goes through approuter)
    var API_BASE = "/api";

    return Controller.extend("lockbox.controller.Main", {

        onInit: function () {
            // Initialize navigation state - show home screen by default
            this._initNavigationState();
            // Initialize template configuration model
            this._initTemplateConfig();
            // Initialize template builder
            this._initTemplateBuilder();
            // Initialize filters
            this._initFilters();
            // Initialize empty tree data
            this._initTreeData();
            // Initialize column visibility settings
            this._initColumnSettings();
        },
        
        // Initialize navigation state for tile-based navigation
        _initNavigationState: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/showHome", true);
            oModel.setProperty("/showLockbox", false);
            oModel.setProperty("/showFieldMappingRules", false);
            oModel.setProperty("/showRuleDetail", false);
            oModel.setProperty("/showNavButton", false);
            oModel.setProperty("/currentView", "home");
        },
        
        // Navigation: Lockbox Transaction Tile Press
        onLockboxTilePress: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/showHome", false);
            oModel.setProperty("/showLockbox", true);
            oModel.setProperty("/showFieldMappingRules", false);
            oModel.setProperty("/showRuleDetail", false);
            oModel.setProperty("/showNavButton", true);
            oModel.setProperty("/currentView", "lockbox");
            // Load headers and run history when entering Lockbox Transaction
            this._loadHeaders();
            this._loadRunHistory();
        },
        
        // Navigation: Field Mapping Rules Tile Press
        onFieldMappingRulesTilePress: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/showHome", false);
            oModel.setProperty("/showLockbox", false);
            oModel.setProperty("/showFieldMappingRules", true);
            oModel.setProperty("/showRuleDetail", false);
            oModel.setProperty("/showNavButton", true);
            oModel.setProperty("/currentView", "fieldMappingRules");
            // Initialize and load rules
            this._initFieldMappingRules();
        },
        

        // Navigation: Back Button Press
        onNavBack: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var sCurrentView = oModel.getProperty("/currentView");
            
            // If in rule detail, go back to rule list
            if (sCurrentView === "ruleDetail") {
                oModel.setProperty("/showRuleDetail", false);
                oModel.setProperty("/showFieldMappingRules", true);
                oModel.setProperty("/currentView", "fieldMappingRules");
                return;
            }
            
            // Otherwise go to home
            oModel.setProperty("/showHome", true);
            oModel.setProperty("/showConfig", false);
            oModel.setProperty("/showTemplateBuilder", false);
            oModel.setProperty("/showLockbox", false);
            oModel.setProperty("/showFieldMappingRules", false);
            oModel.setProperty("/showRuleDetail", false);
            oModel.setProperty("/showProcessingRules", false);
            oModel.setProperty("/showNavButton", false);
            oModel.setProperty("/currentView", "home");
        },
        
        // ============================================================================
        // TEMPLATE BUILDER FUNCTIONS - 5 Tab Layout
        // ============================================================================
        
        // Initialize Template Builder state with 5 tabs structure
        _initTemplateBuilder: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Initialize template builder state with new structure
            oModel.setProperty("/templateBuilder", {
                // Current tab
                currentTab: "dashboard",
                
                // File upload state
                fileSelected: false,
                pendingFile: null,
                
                // Dashboard stats
                stats: {
                    totalJobs: 0,
                    processing: 0,
                    validated: 0,
                    failed: 0,
                    pending: 0,
                    simulated: 0,
                    posted: 0,
                    successRate: "0%"
                },
                
                // Jobs list
                jobs: [],
                recentJobs: [],
                validatedJobs: [],
                selectedJob: null,
                
                // Filters
                filters: {
                    search: "",
                    status: ""
                },
                
                // Constant Fields (auto-populated for each file)
                // LockboxBatchDestination and LockboxBatchOrigin are header-level constants
                constantFields: [
                    { field: "CompanyCode", value: "1710", editable: true },
                    { field: "Currency", value: "USD", editable: true },
                    { field: "LockboxBatchDestination", value: "LOCKBOXDES", editable: true },
                    { field: "LockboxBatchOrigin", value: "LOCKBOXORI", editable: true },
                    { field: "PartnerBankCountry", value: "US", editable: true },
                    { field: "Lockbox", value: "(Auto-Generated)", editable: false }
                ],
                
                // Validated API Fields from Configuration
                validatedApiFields: [],
                
                // Validation Rules
                validationRules: {
                    totalRules: 4,
                    errorRules: 2,
                    warningRules: 2,
                    rules: [
                        { 
                            name: "Amount Required", 
                            field: "AmountInTransactionCurrency", 
                            type: "error", 
                            description: "Amount is required",
                            condition: "required | not_empty"
                        },
                        { 
                            name: "Amount Format", 
                            field: "AmountInTransactionCurrency", 
                            type: "error", 
                            description: "Amount must be numeric",
                            condition: "format | numeric"
                        },
                        { 
                            name: "Currency Format", 
                            field: "Currency", 
                            type: "warning", 
                            description: "Currency must be 3 characters",
                            condition: "format | length:3"
                        },
                        { 
                            name: "Bank Account Required", 
                            field: "PartnerBankAccount", 
                            type: "warning", 
                            description: "Bank account is required",
                            condition: "required | not_empty"
                        }
                    ]
                },
                
                // Simulation state
                simulationJob: null,
                simulationResult: null
            });
            
            // Initialize Auto Validation (Final Field Mapping) state
            oModel.setProperty("/autoValidation", {
                selectedJobId: null,
                fieldMappings: [],
                lockboxPreview: [],
                stats: {
                    mappedFields: 0,
                    unmappedFields: 0,
                    totalRecords: 0,
                    validationStatus: "Pending"
                }
            });
            
            // Initialize Rule Engine
            this._initRuleEngine();
            
            // Load validated API fields from Configuration
            this._loadValidatedApiFields();
            
            // Load jobs (will use demo data initially)
            this._loadJobs();
        },
        
        // ============================================================================
        // RULE ENGINE INITIALIZATION
        // ============================================================================
        
        _initRuleEngine: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            
            oModel.setProperty("/ruleEngine", {
                // ============================================================
                // RULE ENGINE STATS BY CATEGORY
                // ============================================================
                stats: {
                    invoiceRules: 4,
                    amountRules: 3,
                    dateRules: 2,
                    referenceRules: 2,
                    totalRules: 11,
                    // Legacy stats for Auto Validation tab
                    fieldDetection: 6,
                    mappingRules: 10,
                    validationRules: 6,
                    anomalyRules: 4
                },
                
                // ============================================================
                // COMPREHENSIVE RULE ENGINE WITH STRUCTURED ATTRIBUTES
                // Attributes: Category, Type, Trigger Condition, Input Fields,
                //             Output Fields, Priority, Error Behavior
                // ============================================================
                
                rules: [
                    // INVOICE RULES
                    {
                        id: "rule1",
                        name: "Invoice Comma Split",
                        category: "Invoice",
                        categoryState: "Information",
                        ruleType: "Split",
                        typeState: "Success",
                        triggerCondition: "When Invoice Number contains comma or '&'",
                        inputFields: "Invoice Number",
                        outputFields: "PaymentReference (multiple)",
                        priority: 1,
                        errorBehavior: "Warn",
                        errorState: "Warning",
                        enabled: true,
                        config: {
                            pattern: "SPLIT_COMMA",
                            expandPartial: true
                        },
                        example: {
                            input: "90000001, 5 & 6",
                            output: "90000001, 90000005, 90000006"
                        }
                    },
                    {
                        id: "rule2",
                        name: "Invoice Range Expansion",
                        category: "Invoice",
                        categoryState: "Information",
                        ruleType: "Split",
                        typeState: "Success",
                        triggerCondition: "When Invoice Number contains 'to' or '-' range",
                        inputFields: "Invoice Number",
                        outputFields: "PaymentReference (multiple)",
                        priority: 2,
                        errorBehavior: "Stop",
                        errorState: "Error",
                        enabled: true,
                        config: {
                            pattern: "SPLIT_RANGE",
                            maxRecords: 100
                        },
                        example: {
                            input: "95015001 to 010",
                            output: "95015001-95015010 (10 records)"
                        }
                    },
                    {
                        id: "rule3",
                        name: "Invoice Prefix Derivation",
                        category: "Invoice",
                        categoryState: "Information",
                        ruleType: "Derive",
                        typeState: "Information",
                        triggerCondition: "When partial invoice numbers detected",
                        inputFields: "Invoice Number, Base Invoice",
                        outputFields: "PaymentReference",
                        priority: 3,
                        errorBehavior: "Auto-correct",
                        errorState: "Success",
                        enabled: true,
                        config: {
                            pattern: "PREFIX_EXPAND",
                            useFirstAsBase: true
                        },
                        example: {
                            input: "5, 6 (base: 90000001)",
                            output: "90000005, 90000006"
                        }
                    },
                    {
                        id: "rule4",
                        name: "Invoice Format Validation",
                        category: "Invoice",
                        categoryState: "Information",
                        ruleType: "Validate",
                        typeState: "Error",
                        triggerCondition: "Always - all invoice numbers",
                        inputFields: "PaymentReference",
                        outputFields: "PaymentReference (validated)",
                        priority: 10,
                        errorBehavior: "Stop",
                        errorState: "Error",
                        enabled: true,
                        config: {
                            pattern: "^[A-Z0-9\\-]+$",
                            minLength: 5,
                            maxLength: 20
                        },
                        example: {
                            input: "INV-12345",
                            output: "Valid / Invalid"
                        }
                    },
                    
                    // AMOUNT RULES
                    {
                        id: "rule5",
                        name: "Equal Amount Allocation",
                        category: "Amount",
                        categoryState: "Success",
                        ruleType: "Allocate",
                        typeState: "Warning",
                        triggerCondition: "When invoice splits with no individual amounts",
                        inputFields: "Check Amount, Split Count",
                        outputFields: "NetPaymentAmountInPaytCurrency (per invoice)",
                        priority: 1,
                        errorBehavior: "Warn",
                        errorState: "Warning",
                        enabled: true,
                        config: {
                            method: "EQUAL",
                            roundTo: 2
                        },
                        example: {
                            input: "$3000, 3 invoices",
                            output: "$1000.00, $1000.00, $1000.00"
                        }
                    },
                    {
                        id: "rule6",
                        name: "Open Item Amount Match",
                        category: "Amount",
                        categoryState: "Success",
                        ruleType: "Allocate",
                        typeState: "Warning",
                        triggerCondition: "When SAP open items available for customer",
                        inputFields: "Check Amount, PaymentReference, Customer",
                        outputFields: "NetPaymentAmountInPaytCurrency (matched)",
                        priority: 2,
                        errorBehavior: "Warn",
                        errorState: "Warning",
                        enabled: true,
                        config: {
                            method: "OPEN_ITEM",
                            sapLookup: true
                        },
                        example: {
                            input: "$4800 for INV-001, INV-002",
                            output: "Matched to AR: $3000, $1800"
                        }
                    },
                    {
                        id: "rule7",
                        name: "Sequential Amount Pairing",
                        category: "Amount",
                        categoryState: "Success",
                        ruleType: "Allocate",
                        typeState: "Warning",
                        triggerCondition: "When cheque list with corresponding amounts",
                        inputFields: "Cheque Numbers (list), Amounts (list)",
                        outputFields: "Cheque, AmountInTransactionCurrency (paired)",
                        priority: 3,
                        errorBehavior: "Stop",
                        errorState: "Error",
                        enabled: true,
                        config: {
                            method: "SEQUENTIAL",
                            matchPositional: true
                        },
                        example: {
                            input: "345666, 335556 | $1300, $1500",
                            output: "345666→$1300, 335556→$1500"
                        }
                    },
                    
                    // DATE RULES
                    {
                        id: "rule8",
                        name: "Date Format Conversion",
                        category: "Date",
                        categoryState: "Warning",
                        ruleType: "Derive",
                        typeState: "Information",
                        triggerCondition: "When date not in ISO format",
                        inputFields: "Date (various formats)",
                        outputFields: "DepositDateTime (ISO)",
                        priority: 1,
                        errorBehavior: "Auto-correct",
                        errorState: "Success",
                        enabled: true,
                        config: {
                            inputFormats: ["MM/DD/YYYY", "DD-MM-YYYY", "YYYY.MM.DD"],
                            outputFormat: "YYYY-MM-DDTHH:mm:ss"
                        },
                        example: {
                            input: "12/31/2024",
                            output: "2024-12-31T00:00:00"
                        }
                    },
                    {
                        id: "rule9",
                        name: "Date Validation",
                        category: "Date",
                        categoryState: "Warning",
                        ruleType: "Validate",
                        typeState: "Error",
                        triggerCondition: "Always - all dates",
                        inputFields: "DepositDateTime",
                        outputFields: "DepositDateTime (validated)",
                        priority: 10,
                        errorBehavior: "Stop",
                        errorState: "Error",
                        enabled: true,
                        config: {
                            minDate: "2020-01-01",
                            maxDate: "2030-12-31",
                            notFuture: true
                        },
                        example: {
                            input: "2024-12-31",
                            output: "Valid / Invalid"
                        }
                    },
                    
                    // REFERENCE RULES
                    {
                        id: "rule10",
                        name: "Cheque Number Extraction",
                        category: "Reference",
                        categoryState: "Error",
                        ruleType: "Derive",
                        typeState: "Information",
                        triggerCondition: "When cheque field contains mixed data",
                        inputFields: "Cheque (raw)",
                        outputFields: "Cheque (cleaned)",
                        priority: 1,
                        errorBehavior: "Auto-correct",
                        errorState: "Success",
                        enabled: true,
                        config: {
                            extractPattern: "\\d+",
                            padTo: 10
                        },
                        example: {
                            input: "CHK-345666-A",
                            output: "0000345666"
                        }
                    },
                    {
                        id: "rule11",
                        name: "Bank Account Validation",
                        category: "Reference",
                        categoryState: "Error",
                        ruleType: "Validate",
                        typeState: "Error",
                        triggerCondition: "Always - all bank accounts",
                        inputFields: "PartnerBankAccount",
                        outputFields: "PartnerBankAccount (validated)",
                        priority: 10,
                        errorBehavior: "Stop",
                        errorState: "Error",
                        enabled: true,
                        config: {
                            pattern: "^\\d{8,17}$",
                            checkDigit: false
                        },
                        example: {
                            input: "123456789012",
                            output: "Valid / Invalid"
                        }
                    }
                ],
                
                // File Format Templates - parsing configurations
                fileTemplates: {
                    count: 4,
                    templates: [
                        {
                            id: "ft1",
                            name: "Standard Excel",
                            fileType: "XLSX",
                            typeState: "Success",
                            parserConfig: "Header row 1, data starts row 2",
                            fieldCount: 12,
                            description: "Standard Excel with column headers",
                            active: true
                        },
                        {
                            id: "ft2",
                            name: "BAI2 Bank File",
                            fileType: "BAI2",
                            typeState: "Warning",
                            parserConfig: "Record types: 16=Transaction, 03=Account",
                            fieldCount: 8,
                            description: "Bank Administration Institute format",
                            active: true
                        },
                        {
                            id: "ft3",
                            name: "CSV Standard",
                            fileType: "CSV",
                            typeState: "Information",
                            parserConfig: "Comma delimiter, quoted strings",
                            fieldCount: 10,
                            description: "Comma-separated values file",
                            active: true
                        },
                        {
                            id: "ft4",
                            name: "PDF Extract",
                            fileType: "PDF",
                            typeState: "Error",
                            parserConfig: "OCR extraction with table detection",
                            fieldCount: 6,
                            description: "PDF document with tabular data",
                            active: false
                        }
                    ]
                },
                
                // Sequence Matching Rules - for cheque/amount pairing
                sequenceRules: {
                    count: 2,
                    rules: [
                        {
                            id: "sq1",
                            name: "Cheque-Amount Pair",
                            field1: "Cheque Number",
                            field2: "Amount",
                            matchType: "POSITIONAL",
                            example1: "345666, 335556, 3434566",
                            example2: "1300, 1500, 2000",
                            enabled: true
                        },
                        {
                            id: "sq2",
                            name: "Invoice-Net Amount",
                            field1: "Invoice Number",
                            field2: "Net Payment Amount",
                            matchType: "POSITIONAL",
                            example1: "90001, 90002, 90003",
                            example2: "500, 750, 1250",
                            enabled: true
                        }
                    ]
                },
                
                // Amount Logic configurations
                amountLogic: {
                    count: 3
                },
                
                // Test Rules workspace
                testRules: {
                    input: "",
                    output: "",
                    availableRules: [
                        { key: "SPLIT_COMMA", text: "Split by Comma" },
                        { key: "SPLIT_RANGE", text: "Expand Range (to/through)" },
                        { key: "SPLIT_AMPERSAND", text: "Split by Ampersand (&)" },
                        { key: "FORMAT_AMOUNT", text: "Format Amount" },
                        { key: "FORMAT_DATE", text: "Format Date" },
                        { key: "EQUAL_SPLIT", text: "Equal Amount Split" },
                        { key: "SEQUENTIAL", text: "Sequential Matching" }
                    ]
                },
                
                // ============================================================
                // EXISTING Auto Validation Rules (Field Detection, Mapping, etc.)
                // ============================================================
                
                // Field Detection Rules - patterns to identify field types
                fieldDetectionRules: [
                    { id: "fd1", fieldType: "Date", pattern: "^\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4}$", example: "12/31/2024", enabled: true, state: "Information" },
                    { id: "fd2", fieldType: "Date (ISO)", pattern: "^\\d{4}[\\-]\\d{2}[\\-]\\d{2}$", example: "2024-12-31", enabled: true, state: "Information" },
                    { id: "fd3", fieldType: "Currency Amount", pattern: "^\\$?[\\d,]+\\.?\\d{0,2}$", example: "$1,234.56", enabled: true, state: "Success" },
                    { id: "fd4", fieldType: "Bank Account", pattern: "^\\d{8,17}$", example: "123456789012", enabled: true, state: "Warning" },
                    { id: "fd5", fieldType: "Reference Number", pattern: "^[A-Z0-9\\-]+$", example: "REF-123456", enabled: true, state: "Information" },
                    { id: "fd6", fieldType: "Currency Code", pattern: "^[A-Z]{3}$", example: "USD", enabled: true, state: "Success" }
                ],
                
                // Smart Mapping Rules - keyword to API field mappings
                // IMPORTANT: Invoice Number → PaymentReference, Invoice Amount → NetPaymentAmount
                mappingRules: [
                    { id: "m1", keywords: "Invoice Number, Invoice No, Inv No, BELNR, Invoice", apiField: "PaymentReference", section: "PaymentRef", priority: 1, enabled: true },
                    { id: "m2", keywords: "Invoice Amount, Inv Amount, Invoice Amt", apiField: "NetPaymentAmountInPaytCurrency", section: "PaymentRef", priority: 1, enabled: true },
                    { id: "m3", keywords: "Check Number, Cheque, Chk, Check No, Check", apiField: "Cheque", section: "Cheques", priority: 1, enabled: true },
                    { id: "m4", keywords: "Check Amount, Cheque Amount, Chk Amount", apiField: "AmountInTransactionCurrency", section: "Cheques", priority: 1, enabled: true },
                    { id: "m5", keywords: "Currency, Curr, Ccy, Currency Code", apiField: "Currency", section: "Header", priority: 2, enabled: true },
                    { id: "m6", keywords: "Bank Account, Account No, Account, Acct", apiField: "PartnerBankAccount", section: "Cheques", priority: 1, enabled: true },
                    { id: "m7", keywords: "Customer, Cust, Customer No, Customer Account", apiField: "CustomerNumber", section: "Custom", priority: 2, enabled: true },
                    { id: "m8", keywords: "Date, Deposit Date, Payment Date", apiField: "DepositDateTime", section: "Header", priority: 2, enabled: true },
                    { id: "m9", keywords: "Bank, Partner Bank, Bank Code, Routing", apiField: "PartnerBank", section: "Cheques", priority: 2, enabled: true },
                    { id: "m10", keywords: "Country, Bank Country", apiField: "PartnerBankCountry", section: "Cheques", priority: 3, enabled: true }
                ],
                
                // Validation Rules - data quality checks
                validationRules: [
                    { id: "v1", name: "Amount Required", field: "AmountInTransactionCurrency", ruleType: "Required", condition: "not_empty", severity: "error", enabled: true },
                    { id: "v2", name: "Amount Numeric", field: "AmountInTransactionCurrency", ruleType: "Format", condition: "numeric", severity: "error", enabled: true },
                    { id: "v3", name: "Currency Length", field: "Currency", ruleType: "Length", condition: "exactly 3 characters", severity: "warning", enabled: true },
                    { id: "v4", name: "Bank Account Required", field: "PartnerBankAccount", ruleType: "Required", condition: "not_empty", severity: "warning", enabled: true },
                    { id: "v5", name: "Reference Required", field: "PaymentReference", ruleType: "Required", condition: "not_empty", severity: "warning", enabled: true },
                    { id: "v6", name: "Cheque Number Required", field: "Cheque", ruleType: "Required", condition: "not_empty", severity: "error", enabled: true }
                ],
                
                // Anomaly Detection Rules
                anomalyRules: [
                    { id: "a1", name: "Duplicate Amount", checkType: "Duplicate", field: "AmountInTransactionCurrency", threshold: "Flag same amount appearing 3+ times", severity: "warning", enabled: true },
                    { id: "a2", name: "High Amount Threshold", checkType: "Threshold", field: "AmountInTransactionCurrency", threshold: "Amount > $100,000", severity: "warning", enabled: true },
                    { id: "a3", name: "Round Number Pattern", checkType: "Pattern", field: "AmountInTransactionCurrency", threshold: "Multiple round numbers (1000, 5000, 10000)", severity: "warning", enabled: true },
                    { id: "a4", name: "Duplicate Reference", checkType: "Duplicate", field: "PaymentReference", threshold: "Same reference appears multiple times", severity: "error", enabled: true }
                ]
            });
            
            this._updateRuleEngineStats();
        },
        
        // Update rule engine statistics (handles both new Rule Engine and legacy Auto Validation)
        _updateRuleEngineStatsOld: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oRuleEngine = oModel.getProperty("/ruleEngine");
            
            if (oRuleEngine) {
                // Update legacy Auto Validation stats
                oModel.setProperty("/ruleEngine/stats/fieldDetection", (oRuleEngine.fieldDetectionRules || []).filter(function(r) { return r.enabled; }).length);
                oModel.setProperty("/ruleEngine/stats/mappingRules", (oRuleEngine.mappingRules || []).filter(function(r) { return r.enabled; }).length);
                oModel.setProperty("/ruleEngine/stats/validationRules", (oRuleEngine.validationRules || []).filter(function(r) { return r.enabled; }).length);
                oModel.setProperty("/ruleEngine/stats/anomalyRules", (oRuleEngine.anomalyRules || []).filter(function(r) { return r.enabled; }).length);
            }
        },
        
        // Load validated API fields from Configuration tab settings
        _loadValidatedApiFields: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oConfig = oModel.getProperty("/templateConfig");
            var aValidatedFields = [];
            
            if (oConfig) {
                // Process header fields
                (oConfig.header || []).forEach(function (field) {
                    if (field.selected) {
                        aValidatedFields.push({
                            fieldName: field.fieldName,
                            section: "Header",
                            fieldType: field.fieldType || "text",
                            required: field.required,
                            validation: field.required ? "Required, not empty" : "Optional"
                        });
                    }
                });
                
                // Process cheques fields
                (oConfig.cheques || []).forEach(function (field) {
                    if (field.selected) {
                        aValidatedFields.push({
                            fieldName: field.fieldName,
                            section: "Cheques",
                            fieldType: field.fieldType || "text",
                            required: field.required,
                            validation: field.required ? "Required, not empty" : "Optional"
                        });
                    }
                });
                
                // Process payment references fields
                (oConfig.paymentReferences || []).forEach(function (field) {
                    if (field.selected) {
                        aValidatedFields.push({
                            fieldName: field.fieldName,
                            section: "Payment Ref",
                            fieldType: field.fieldType || "text",
                            required: field.required,
                            validation: field.required ? "Required, not empty" : "Optional"
                        });
                    }
                });
            }
            
            oModel.setProperty("/templateBuilder/validatedApiFields", aValidatedFields);
        },
        
        // Load jobs from backend or initialize with demo data
        _loadJobs: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Fetch jobs from backend API
            fetch(API_BASE + "/jobs", {
                method: "GET",
                headers: { "Accept": "application/json" }
            })
            .then(function (response) {
                if (!response.ok) {
                    // Use demo data if API not available
                    return { jobs: [] };
                }
                return response.json();
            })
            .then(function (data) {
                var aJobs = data.jobs || [];
                
                // Update jobs list
                oModel.setProperty("/templateBuilder/jobs", aJobs);
                
                // Update recent jobs (last 5)
                oModel.setProperty("/templateBuilder/recentJobs", aJobs.slice(0, 5));
                
                // Filter validated jobs for simulation
                var aValidatedJobs = aJobs.filter(function (job) {
                    return job.status === "VALIDATED" || job.status === "EXTRACTED";
                });
                oModel.setProperty("/templateBuilder/validatedJobs", aValidatedJobs);
                
                // Update stats
                that._updateJobStats(aJobs);
            })
            .catch(function (error) {
                console.log("Jobs API not available, using empty state:", error.message);
                oModel.setProperty("/templateBuilder/jobs", []);
                oModel.setProperty("/templateBuilder/recentJobs", []);
                oModel.setProperty("/templateBuilder/validatedJobs", []);
            });
        },
        
        // Update dashboard statistics
        _updateJobStats: function (aJobs) {
            var oModel = this.getOwnerComponent().getModel("app");
            
            var stats = {
                totalJobs: aJobs.length,
                pending: 0,
                processing: 0,
                validated: 0,
                failed: 0,
                simulated: 0,
                posted: 0,
                successRate: "0%"
            };
            
            aJobs.forEach(function (job) {
                switch (job.status) {
                    case "PENDING": stats.pending++; break;
                    case "PROCESSING": 
                    case "EXTRACTED": stats.processing++; break;
                    case "VALIDATED": stats.validated++; break;
                    case "FAILED": stats.failed++; break;
                    case "SIMULATED": stats.simulated++; break;
                    case "POSTED": stats.posted++; break;
                }
            });
            
            // Calculate success rate
            var successCount = stats.validated + stats.simulated + stats.posted;
            if (stats.totalJobs > 0) {
                stats.successRate = Math.round((successCount / stats.totalJobs) * 100) + "%";
            }
            
            oModel.setProperty("/templateBuilder/stats", stats);
        },
        
        // Tab selection handler
        onTemplateBuilderTabSelect: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var sKey = oEvent.getParameter("key");
            oModel.setProperty("/templateBuilder/currentTab", sKey);
            
            // Refresh data based on tab
            if (sKey === "dashboard" || sKey === "extract") {
                this._loadJobs();
            } else if (sKey === "validation") {
                this._loadValidatedApiFields();
            }
        },
        
        // Dashboard Quick Actions
        onDashboardUploadFile: function () {
            // Switch to Upload tab
            var oTabBar = this.byId("templateBuilderTabBar");
            if (oTabBar) {
                oTabBar.setSelectedKey("upload");
            }
        },
        
        onDashboardViewHistory: function () {
            // Switch to Extract tab
            var oTabBar = this.byId("templateBuilderTabBar");
            if (oTabBar) {
                oTabBar.setSelectedKey("extract");
            }
        },
        
        // Format job status state
        formatJobStatusState: function (sStatus) {
            switch (sStatus) {
                case "VALIDATED": return "Success";
                case "SIMULATED": return "Success";
                case "POSTED": return "Success";
                case "PROCESSING":
                case "EXTRACTED": return "Warning";
                case "PENDING": return "Information";
                case "FAILED": return "Error";
                default: return "None";
            }
        },
        
        // Format validation state
        formatValidationState: function (sStatus) {
            switch (sStatus) {
                case "VALID": return "Success";
                case "WARNING": return "Warning";
                case "ERROR": return "Error";
                default: return "None";
            }
        },
        
        // ============================================================================
        // RULE ENGINE HANDLERS
        // ============================================================================
        
        onRuleEngineSubTabSelect: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            console.log("Rule Engine sub-tab selected:", sKey);
        },
        
        // Main Rule Engine tab select handler
        onRuleEngineMainTabSelect: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            console.log("Rule Engine main tab selected:", sKey);
        },
        
        // ============================================================================
        // NEW STRUCTURED RULE ENGINE HANDLERS
        // Attributes: Category, Type, Trigger Condition, Input Fields,
        //             Output Fields, Priority, Error Behavior
        // ============================================================================
        
        // Filter handlers
        onRuleCategoryFilterChange: function (oEvent) {
            this._filterRules();
        },
        
        onRuleTypeFilterChange: function (oEvent) {
            this._filterRules();
        },
        
        _filterRules: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oCategoryFilter = this.byId("ruleCategoryFilter");
            var oTypeFilter = this.byId("ruleTypeFilter");
            
            var sCategory = oCategoryFilter ? oCategoryFilter.getSelectedKey() : "ALL";
            var sType = oTypeFilter ? oTypeFilter.getSelectedKey() : "ALL";
            
            var aAllRules = oModel.getProperty("/ruleEngine/allRules") || [];
            var aFilteredRules = aAllRules.filter(function(rule) {
                var bCategoryMatch = sCategory === "ALL" || rule.category === sCategory;
                var bTypeMatch = sType === "ALL" || rule.ruleType === sType;
                return bCategoryMatch && bTypeMatch;
            });
            
            oModel.setProperty("/ruleEngine/rules", aFilteredRules);
        },
        
        // Add Rule Handler
        onAddRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            if (!this._oAddRuleDialog) {
                this._oAddRuleDialog = new sap.m.Dialog({
                    title: "Add Transformation Rule",
                    contentWidth: "600px",
                    content: [
                        new sap.m.VBox({
                            class: "sapUiSmallMargin",
                            items: [
                                // Row 1: Name and Priority
                                new sap.m.HBox({
                                    items: [
                                        new sap.m.VBox({
                                            width: "70%",
                                            class: "sapUiSmallMarginEnd",
                                            items: [
                                                new sap.m.Label({ text: "Rule Name", required: true }),
                                                new sap.m.Input({ id: "ruleName", placeholder: "e.g., Invoice Comma Split" })
                                            ]
                                        }),
                                        new sap.m.VBox({
                                            width: "30%",
                                            items: [
                                                new sap.m.Label({ text: "Priority" }),
                                                new sap.m.Input({ id: "rulePriority", type: "Number", value: "1", placeholder: "1-10" })
                                            ]
                                        })
                                    ]
                                }),
                                
                                // Row 2: Category and Type
                                new sap.m.HBox({
                                    class: "sapUiSmallMarginTop",
                                    items: [
                                        new sap.m.VBox({
                                            width: "50%",
                                            class: "sapUiSmallMarginEnd",
                                            items: [
                                                new sap.m.Label({ text: "Rule Category", required: true }),
                                                new sap.m.Select({
                                                    id: "ruleCategory",
                                                    width: "100%",
                                                    items: [
                                                        new sap.ui.core.Item({ key: "Invoice", text: "Invoice" }),
                                                        new sap.ui.core.Item({ key: "Amount", text: "Amount" }),
                                                        new sap.ui.core.Item({ key: "Date", text: "Date" }),
                                                        new sap.ui.core.Item({ key: "Reference", text: "Reference" })
                                                    ]
                                                })
                                            ]
                                        }),
                                        new sap.m.VBox({
                                            width: "50%",
                                            items: [
                                                new sap.m.Label({ text: "Rule Type", required: true }),
                                                new sap.m.Select({
                                                    id: "ruleType",
                                                    width: "100%",
                                                    items: [
                                                        new sap.ui.core.Item({ key: "Split", text: "Split" }),
                                                        new sap.ui.core.Item({ key: "Derive", text: "Derive" }),
                                                        new sap.ui.core.Item({ key: "Allocate", text: "Allocate" }),
                                                        new sap.ui.core.Item({ key: "Validate", text: "Validate" })
                                                    ]
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                
                                // Row 3: Trigger Condition
                                new sap.m.Label({ text: "Trigger Condition", required: true, class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "ruleTrigger", placeholder: "e.g., When Invoice Number contains comma" }),
                                
                                // Row 4: Input and Output Fields
                                new sap.m.HBox({
                                    class: "sapUiSmallMarginTop",
                                    items: [
                                        new sap.m.VBox({
                                            width: "50%",
                                            class: "sapUiSmallMarginEnd",
                                            items: [
                                                new sap.m.Label({ text: "Input Fields (Canonical)" }),
                                                new sap.m.Input({ id: "ruleInputFields", placeholder: "e.g., Invoice Number" })
                                            ]
                                        }),
                                        new sap.m.VBox({
                                            width: "50%",
                                            items: [
                                                new sap.m.Label({ text: "Output Fields (Canonical)" }),
                                                new sap.m.Input({ id: "ruleOutputFields", placeholder: "e.g., PaymentReference" })
                                            ]
                                        })
                                    ]
                                }),
                                
                                // Row 5: Error Behavior
                                new sap.m.Label({ text: "Error Behavior", class: "sapUiSmallMarginTop" }),
                                new sap.m.Select({
                                    id: "ruleErrorBehavior",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "Stop", text: "Stop - Stop processing and report error" }),
                                        new sap.ui.core.Item({ key: "Warn", text: "Warn - Log warning but continue" }),
                                        new sap.ui.core.Item({ key: "Auto-correct", text: "Auto-correct - Attempt fix and continue" })
                                    ]
                                })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Add Rule",
                        type: "Emphasized",
                        press: function () {
                            var sName = sap.ui.getCore().byId("ruleName").getValue();
                            var sCategory = sap.ui.getCore().byId("ruleCategory").getSelectedKey();
                            var sRuleType = sap.ui.getCore().byId("ruleType").getSelectedKey();
                            var sTrigger = sap.ui.getCore().byId("ruleTrigger").getValue();
                            var sInputFields = sap.ui.getCore().byId("ruleInputFields").getValue();
                            var sOutputFields = sap.ui.getCore().byId("ruleOutputFields").getValue();
                            var nPriority = parseInt(sap.ui.getCore().byId("rulePriority").getValue()) || 1;
                            var sErrorBehavior = sap.ui.getCore().byId("ruleErrorBehavior").getSelectedKey();
                            
                            if (!sName || !sTrigger) {
                                MessageBox.warning("Rule Name and Trigger Condition are required");
                                return;
                            }
                            
                            // Determine states based on selections
                            var categoryStates = { "Invoice": "Information", "Amount": "Success", "Date": "Warning", "Reference": "Error" };
                            var typeStates = { "Split": "Success", "Derive": "Information", "Allocate": "Warning", "Validate": "Error" };
                            var errorStates = { "Stop": "Error", "Warn": "Warning", "Auto-correct": "Success" };
                            
                            var aRules = oModel.getProperty("/ruleEngine/rules") || [];
                            aRules.push({
                                id: "rule" + Date.now(),
                                name: sName,
                                category: sCategory,
                                categoryState: categoryStates[sCategory] || "Information",
                                ruleType: sRuleType,
                                typeState: typeStates[sRuleType] || "Information",
                                triggerCondition: sTrigger,
                                inputFields: sInputFields,
                                outputFields: sOutputFields,
                                priority: nPriority,
                                errorBehavior: sErrorBehavior,
                                errorState: errorStates[sErrorBehavior] || "Warning",
                                enabled: true,
                                config: {},
                                example: { input: "", output: "" }
                            });
                            
                            oModel.setProperty("/ruleEngine/rules", aRules);
                            that._updateRuleEngineStats();
                            
                            // Clear inputs
                            sap.ui.getCore().byId("ruleName").setValue("");
                            sap.ui.getCore().byId("ruleTrigger").setValue("");
                            sap.ui.getCore().byId("ruleInputFields").setValue("");
                            sap.ui.getCore().byId("ruleOutputFields").setValue("");
                            sap.ui.getCore().byId("rulePriority").setValue("1");
                            that._oAddRuleDialog.close();
                            MessageToast.show("Rule added successfully");
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            that._oAddRuleDialog.close();
                        }
                    })
                });
            }
            this._oAddRuleDialog.open();
        },
        
        // Edit Rule Handler
        onEditRule: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            MessageToast.show("Edit rule: " + oRule.name + " (Category: " + oRule.category + ", Type: " + oRule.ruleType + ")");
            // TODO: Open edit dialog with rule data pre-filled
        },
        
        // Duplicate Rule Handler
        onDuplicateRule: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            var aRules = oModel.getProperty("/ruleEngine/rules") || [];
            var oDuplicate = JSON.parse(JSON.stringify(oRule));
            oDuplicate.id = "rule" + Date.now();
            oDuplicate.name = oRule.name + " (Copy)";
            aRules.push(oDuplicate);
            oModel.setProperty("/ruleEngine/rules", aRules);
            this._updateRuleEngineStats();
            MessageToast.show("Rule duplicated: " + oDuplicate.name);
        },
        
        // Delete Rule Handler
        onDeleteRule: function (oEvent) {
            var that = this;
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            MessageBox.confirm("Delete rule '" + oRule.name + "'?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aRules = oModel.getProperty("/ruleEngine/rules") || [];
                        var nIdx = aRules.findIndex(function(r) { return r.id === oRule.id; });
                        if (nIdx >= 0) {
                            aRules.splice(nIdx, 1);
                            oModel.setProperty("/ruleEngine/rules", aRules);
                            that._updateRuleEngineStats();
                            MessageToast.show("Rule deleted");
                        }
                    }
                }
            });
        },
        
        // Toggle Rule Handler
        onRuleToggle: function (oEvent) {
            this._updateRuleEngineStats();
        },
        
        // Update Rule Engine Statistics
        _updateRuleEngineStats: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aRules = oModel.getProperty("/ruleEngine/rules") || [];
            
            var stats = {
                invoiceRules: 0,
                amountRules: 0,
                dateRules: 0,
                referenceRules: 0,
                totalRules: 0,
                // Keep legacy stats
                fieldDetection: oModel.getProperty("/ruleEngine/stats/fieldDetection") || 6,
                mappingRules: oModel.getProperty("/ruleEngine/stats/mappingRules") || 10,
                validationRules: oModel.getProperty("/ruleEngine/stats/validationRules") || 6,
                anomalyRules: oModel.getProperty("/ruleEngine/stats/anomalyRules") || 4
            };
            
            aRules.forEach(function(rule) {
                if (rule.enabled) {
                    stats.totalRules++;
                    switch (rule.category) {
                        case "Invoice": stats.invoiceRules++; break;
                        case "Amount": stats.amountRules++; break;
                        case "Date": stats.dateRules++; break;
                        case "Reference": stats.referenceRules++; break;
                    }
                }
            });
            
            oModel.setProperty("/ruleEngine/stats", stats);
        },
        
        // ============================================================================
        // LEGACY TRANSFORM RULE HANDLERS (kept for backward compatibility)
        // ============================================================================
        
        // ---------- Transform Rules ----------
        onAddTransformRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            if (!this._oAddTransformRuleDialog) {
                this._oAddTransformRuleDialog = new sap.m.Dialog({
                    title: "Add Field Transformation Rule",
                    contentWidth: "550px",
                    content: [
                        new sap.m.VBox({
                            class: "sapUiSmallMargin",
                            items: [
                                new sap.m.Label({ text: "Source Field (Customer File)", required: true }),
                                new sap.m.Input({ id: "trSourceField", placeholder: "e.g., Invoice Number, Cheque Number" }),
                                new sap.m.Label({ text: "Transform Type", required: true, class: "sapUiSmallMarginTop" }),
                                new sap.m.Select({
                                    id: "trTransformType",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "SPLIT_COMMA", text: "Split by Comma (90001, 5 & 6)" }),
                                        new sap.ui.core.Item({ key: "SPLIT_RANGE", text: "Expand Range (95015001 to 010)" }),
                                        new sap.ui.core.Item({ key: "SPLIT_AMPERSAND", text: "Split by Ampersand (&)" }),
                                        new sap.ui.core.Item({ key: "EXTRACT_PATTERN", text: "Extract using Regex Pattern" }),
                                        new sap.ui.core.Item({ key: "CONCAT", text: "Concatenate Fields" }),
                                        new sap.ui.core.Item({ key: "FORMAT", text: "Format Value (date, amount)" })
                                    ]
                                }),
                                new sap.m.Label({ text: "Pattern/Configuration", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "trPattern", placeholder: "e.g., regex pattern or format config" }),
                                new sap.m.Label({ text: "Target API Field", required: true, class: "sapUiSmallMarginTop" }),
                                new sap.m.Select({
                                    id: "trTargetField",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "PaymentReference", text: "PaymentReference (Invoice/BELNR)" }),
                                        new sap.ui.core.Item({ key: "AmountInTransactionCurrency", text: "AmountInTransactionCurrency" }),
                                        new sap.ui.core.Item({ key: "Cheque", text: "Cheque Number" }),
                                        new sap.ui.core.Item({ key: "PartnerBankAccount", text: "PartnerBankAccount" }),
                                        new sap.ui.core.Item({ key: "DepositDateTime", text: "DepositDateTime" }),
                                        new sap.ui.core.Item({ key: "Currency", text: "Currency" })
                                    ]
                                }),
                                new sap.m.Label({ text: "Example Input", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "trExampleInput", placeholder: "e.g., 90000001, 5 & 6" }),
                                new sap.m.Label({ text: "Example Output", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "trExampleOutput", placeholder: "e.g., 90000001, 90000005, 90000006" })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Add Rule",
                        type: "Emphasized",
                        press: function () {
                            var sSourceField = sap.ui.getCore().byId("trSourceField").getValue();
                            var sTransformType = sap.ui.getCore().byId("trTransformType").getSelectedKey();
                            var sPattern = sap.ui.getCore().byId("trPattern").getValue();
                            var sTargetField = sap.ui.getCore().byId("trTargetField").getSelectedKey();
                            var sExampleInput = sap.ui.getCore().byId("trExampleInput").getValue();
                            var sExampleOutput = sap.ui.getCore().byId("trExampleOutput").getValue();
                            
                            if (!sSourceField || !sTargetField) {
                                MessageBox.warning("Source Field and Target Field are required");
                                return;
                            }
                            
                            var aRules = oModel.getProperty("/ruleEngine/transformRules/rules") || [];
                            aRules.push({
                                id: "tr" + Date.now(),
                                sourceField: sSourceField,
                                transformType: sTransformType,
                                typeState: sTransformType.includes("SPLIT") ? "Success" : "Information",
                                pattern: sPattern || sTransformType,
                                targetField: sTargetField,
                                exampleInput: sExampleInput,
                                exampleOutput: sExampleOutput,
                                enabled: true
                            });
                            oModel.setProperty("/ruleEngine/transformRules/rules", aRules);
                            oModel.setProperty("/ruleEngine/transformRules/count", aRules.length);
                            
                            // Clear inputs
                            sap.ui.getCore().byId("trSourceField").setValue("");
                            sap.ui.getCore().byId("trPattern").setValue("");
                            sap.ui.getCore().byId("trExampleInput").setValue("");
                            sap.ui.getCore().byId("trExampleOutput").setValue("");
                            that._oAddTransformRuleDialog.close();
                            MessageToast.show("Transform rule added successfully");
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            that._oAddTransformRuleDialog.close();
                        }
                    })
                });
            }
            this._oAddTransformRuleDialog.open();
        },
        
        onEditTransformRule: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            MessageToast.show("Edit transform rule: " + oRule.sourceField + " → " + oRule.targetField);
        },
        
        onDeleteTransformRule: function (oEvent) {
            var that = this;
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            MessageBox.confirm("Delete transform rule '" + oRule.sourceField + " → " + oRule.targetField + "'?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aRules = oModel.getProperty("/ruleEngine/transformRules/rules") || [];
                        var nIdx = aRules.findIndex(function(r) { return r.id === oRule.id; });
                        if (nIdx >= 0) {
                            aRules.splice(nIdx, 1);
                            oModel.setProperty("/ruleEngine/transformRules/rules", aRules);
                            oModel.setProperty("/ruleEngine/transformRules/count", aRules.length);
                            MessageToast.show("Transform rule deleted");
                        }
                    }
                }
            });
        },
        
        onTransformRuleToggle: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var aRules = oModel.getProperty("/ruleEngine/transformRules/rules") || [];
            var enabledCount = aRules.filter(function(r) { return r.enabled; }).length;
            oModel.setProperty("/ruleEngine/transformRules/count", enabledCount);
        },
        
        // ---------- Split/Amount Logic Rules ----------
        onAddSplitRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            if (!this._oAddSplitRuleDialog) {
                this._oAddSplitRuleDialog = new sap.m.Dialog({
                    title: "Add Split/Amount Logic Rule",
                    contentWidth: "550px",
                    content: [
                        new sap.m.VBox({
                            class: "sapUiSmallMargin",
                            items: [
                                new sap.m.Label({ text: "Rule Name", required: true }),
                                new sap.m.Input({ id: "srName", placeholder: "e.g., Equal Split, Open Item Match" }),
                                new sap.m.Label({ text: "Split Type", required: true, class: "sapUiSmallMarginTop" }),
                                new sap.m.Select({
                                    id: "srSplitType",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "EQUAL", text: "Equal Split (divide evenly)" }),
                                        new sap.ui.core.Item({ key: "PERCENTAGE", text: "Percentage Split (50%, 30%, 20%)" }),
                                        new sap.ui.core.Item({ key: "OPEN_ITEM", text: "Open Item Match (from SAP AR)" }),
                                        new sap.ui.core.Item({ key: "RATIO", text: "Ratio Split (2:3:5)" }),
                                        new sap.ui.core.Item({ key: "SEQUENTIAL", text: "Sequential (1300, 1500, 2000)" }),
                                        new sap.ui.core.Item({ key: "FORMULA", text: "Custom Formula" })
                                    ]
                                }),
                                new sap.m.Label({ text: "Configuration", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "srConfig", placeholder: "e.g., percentages, ratio, or formula" }),
                                new sap.m.Label({ text: "Applies To", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "srAppliesTo", placeholder: "e.g., All invoice splits, Cheque sequences" }),
                                new sap.m.Label({ text: "Example Total", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "srExampleTotal", placeholder: "e.g., $3000" }),
                                new sap.m.Label({ text: "Example Split Result", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "srExampleSplit", placeholder: "e.g., $1000, $1000, $1000" })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Add Rule",
                        type: "Emphasized",
                        press: function () {
                            var sName = sap.ui.getCore().byId("srName").getValue();
                            var sSplitType = sap.ui.getCore().byId("srSplitType").getSelectedKey();
                            var sConfig = sap.ui.getCore().byId("srConfig").getValue();
                            var sAppliesTo = sap.ui.getCore().byId("srAppliesTo").getValue();
                            var sExampleTotal = sap.ui.getCore().byId("srExampleTotal").getValue();
                            var sExampleSplit = sap.ui.getCore().byId("srExampleSplit").getValue();
                            
                            if (!sName) {
                                MessageBox.warning("Rule Name is required");
                                return;
                            }
                            
                            var aRules = oModel.getProperty("/ruleEngine/splitRules/rules") || [];
                            var typeState = "Information";
                            if (sSplitType === "EQUAL" || sSplitType === "PERCENTAGE") typeState = "Success";
                            if (sSplitType === "OPEN_ITEM") typeState = "Warning";
                            
                            aRules.push({
                                id: "sr" + Date.now(),
                                name: sName,
                                splitType: sSplitType,
                                typeState: typeState,
                                config: sConfig || sSplitType,
                                appliesTo: sAppliesTo,
                                exampleTotal: sExampleTotal,
                                exampleSplit: sExampleSplit,
                                enabled: true
                            });
                            oModel.setProperty("/ruleEngine/splitRules/rules", aRules);
                            oModel.setProperty("/ruleEngine/splitRules/count", aRules.length);
                            
                            // Clear inputs
                            sap.ui.getCore().byId("srName").setValue("");
                            sap.ui.getCore().byId("srConfig").setValue("");
                            sap.ui.getCore().byId("srAppliesTo").setValue("");
                            sap.ui.getCore().byId("srExampleTotal").setValue("");
                            sap.ui.getCore().byId("srExampleSplit").setValue("");
                            that._oAddSplitRuleDialog.close();
                            MessageToast.show("Split rule added successfully");
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            that._oAddSplitRuleDialog.close();
                        }
                    })
                });
            }
            this._oAddSplitRuleDialog.open();
        },
        
        onEditSplitRule: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            MessageToast.show("Edit split rule: " + oRule.name);
        },
        
        onDeleteSplitRule: function (oEvent) {
            var that = this;
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            MessageBox.confirm("Delete split rule '" + oRule.name + "'?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aRules = oModel.getProperty("/ruleEngine/splitRules/rules") || [];
                        var nIdx = aRules.findIndex(function(r) { return r.id === oRule.id; });
                        if (nIdx >= 0) {
                            aRules.splice(nIdx, 1);
                            oModel.setProperty("/ruleEngine/splitRules/rules", aRules);
                            oModel.setProperty("/ruleEngine/splitRules/count", aRules.length);
                            MessageToast.show("Split rule deleted");
                        }
                    }
                }
            });
        },
        
        onSplitRuleToggle: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var aRules = oModel.getProperty("/ruleEngine/splitRules/rules") || [];
            var enabledCount = aRules.filter(function(r) { return r.enabled; }).length;
            oModel.setProperty("/ruleEngine/splitRules/count", enabledCount);
        },
        
        // ---------- File Template Rules ----------
        onAddFileTemplate: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            if (!this._oAddFileTemplateDialog) {
                this._oAddFileTemplateDialog = new sap.m.Dialog({
                    title: "Add File Format Template",
                    contentWidth: "550px",
                    content: [
                        new sap.m.VBox({
                            class: "sapUiSmallMargin",
                            items: [
                                new sap.m.Label({ text: "Template Name", required: true }),
                                new sap.m.Input({ id: "ftName", placeholder: "e.g., Customer XYZ Excel Format" }),
                                new sap.m.Label({ text: "File Type", required: true, class: "sapUiSmallMarginTop" }),
                                new sap.m.Select({
                                    id: "ftFileType",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "XLSX", text: "Excel (.xlsx, .xls)" }),
                                        new sap.ui.core.Item({ key: "CSV", text: "CSV (.csv)" }),
                                        new sap.ui.core.Item({ key: "BAI2", text: "BAI2 Bank File (.bai2, .txt)" }),
                                        new sap.ui.core.Item({ key: "PDF", text: "PDF Document (.pdf)" }),
                                        new sap.ui.core.Item({ key: "TXT", text: "Text File (.txt)" })
                                    ]
                                }),
                                new sap.m.Label({ text: "Parser Configuration", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "ftParserConfig", placeholder: "e.g., Header row 1, data starts row 2" }),
                                new sap.m.Label({ text: "Number of Fields Mapped", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "ftFieldCount", type: "Number", value: "10" }),
                                new sap.m.Label({ text: "Description", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "ftDescription", placeholder: "Brief description of this template" })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Add Template",
                        type: "Emphasized",
                        press: function () {
                            var sName = sap.ui.getCore().byId("ftName").getValue();
                            var sFileType = sap.ui.getCore().byId("ftFileType").getSelectedKey();
                            var sParserConfig = sap.ui.getCore().byId("ftParserConfig").getValue();
                            var nFieldCount = parseInt(sap.ui.getCore().byId("ftFieldCount").getValue()) || 0;
                            var sDescription = sap.ui.getCore().byId("ftDescription").getValue();
                            
                            if (!sName) {
                                MessageBox.warning("Template Name is required");
                                return;
                            }
                            
                            var aTemplates = oModel.getProperty("/ruleEngine/fileTemplates/templates") || [];
                            var typeState = "Information";
                            if (sFileType === "XLSX") typeState = "Success";
                            if (sFileType === "BAI2") typeState = "Warning";
                            if (sFileType === "PDF") typeState = "Error";
                            
                            aTemplates.push({
                                id: "ft" + Date.now(),
                                name: sName,
                                fileType: sFileType,
                                typeState: typeState,
                                parserConfig: sParserConfig,
                                fieldCount: nFieldCount,
                                description: sDescription,
                                active: true
                            });
                            oModel.setProperty("/ruleEngine/fileTemplates/templates", aTemplates);
                            oModel.setProperty("/ruleEngine/fileTemplates/count", aTemplates.length);
                            
                            // Clear inputs
                            sap.ui.getCore().byId("ftName").setValue("");
                            sap.ui.getCore().byId("ftParserConfig").setValue("");
                            sap.ui.getCore().byId("ftFieldCount").setValue("10");
                            sap.ui.getCore().byId("ftDescription").setValue("");
                            that._oAddFileTemplateDialog.close();
                            MessageToast.show("File template added successfully");
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            that._oAddFileTemplateDialog.close();
                        }
                    })
                });
            }
            this._oAddFileTemplateDialog.open();
        },
        
        onEditFileTemplate: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oTemplate = oContext.getObject();
            MessageToast.show("Edit file template: " + oTemplate.name);
        },
        
        onDuplicateFileTemplate: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oTemplate = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            var aTemplates = oModel.getProperty("/ruleEngine/fileTemplates/templates") || [];
            var oDuplicate = Object.assign({}, oTemplate);
            oDuplicate.id = "ft" + Date.now();
            oDuplicate.name = oTemplate.name + " (Copy)";
            aTemplates.push(oDuplicate);
            oModel.setProperty("/ruleEngine/fileTemplates/templates", aTemplates);
            oModel.setProperty("/ruleEngine/fileTemplates/count", aTemplates.length);
            MessageToast.show("Template duplicated: " + oDuplicate.name);
        },
        
        onDeleteFileTemplate: function (oEvent) {
            var that = this;
            var oContext = oEvent.getSource().getBindingContext("app");
            var oTemplate = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            MessageBox.confirm("Delete file template '" + oTemplate.name + "'?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aTemplates = oModel.getProperty("/ruleEngine/fileTemplates/templates") || [];
                        var nIdx = aTemplates.findIndex(function(t) { return t.id === oTemplate.id; });
                        if (nIdx >= 0) {
                            aTemplates.splice(nIdx, 1);
                            oModel.setProperty("/ruleEngine/fileTemplates/templates", aTemplates);
                            oModel.setProperty("/ruleEngine/fileTemplates/count", aTemplates.length);
                            MessageToast.show("File template deleted");
                        }
                    }
                }
            });
        },
        
        onFileTemplateToggle: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var aTemplates = oModel.getProperty("/ruleEngine/fileTemplates/templates") || [];
            var activeCount = aTemplates.filter(function(t) { return t.active; }).length;
            oModel.setProperty("/ruleEngine/fileTemplates/count", activeCount);
        },
        
        // ---------- Sequence Matching Rules ----------
        onAddSequenceRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            if (!this._oAddSequenceRuleDialog) {
                this._oAddSequenceRuleDialog = new sap.m.Dialog({
                    title: "Add Sequence Matching Rule",
                    contentWidth: "550px",
                    content: [
                        new sap.m.VBox({
                            class: "sapUiSmallMargin",
                            items: [
                                new sap.m.Label({ text: "Rule Name", required: true }),
                                new sap.m.Input({ id: "sqName", placeholder: "e.g., Cheque-Amount Pair" }),
                                new sap.m.Label({ text: "Field 1 (Source)", required: true, class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "sqField1", placeholder: "e.g., Cheque Number" }),
                                new sap.m.Label({ text: "Field 2 (To Match)", required: true, class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "sqField2", placeholder: "e.g., Amount" }),
                                new sap.m.Label({ text: "Match Type", class: "sapUiSmallMarginTop" }),
                                new sap.m.Select({
                                    id: "sqMatchType",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "POSITIONAL", text: "Positional (1st→1st, 2nd→2nd)" }),
                                        new sap.ui.core.Item({ key: "INDEXED", text: "Indexed (by explicit index)" }),
                                        new sap.ui.core.Item({ key: "NAMED", text: "Named Reference" })
                                    ]
                                }),
                                new sap.m.Label({ text: "Example Field 1 Values", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "sqExample1", placeholder: "e.g., 345666, 335556, 3434566" }),
                                new sap.m.Label({ text: "Example Field 2 Values", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "sqExample2", placeholder: "e.g., 1300, 1500, 2000" })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Add Rule",
                        type: "Emphasized",
                        press: function () {
                            var sName = sap.ui.getCore().byId("sqName").getValue();
                            var sField1 = sap.ui.getCore().byId("sqField1").getValue();
                            var sField2 = sap.ui.getCore().byId("sqField2").getValue();
                            var sMatchType = sap.ui.getCore().byId("sqMatchType").getSelectedKey();
                            var sExample1 = sap.ui.getCore().byId("sqExample1").getValue();
                            var sExample2 = sap.ui.getCore().byId("sqExample2").getValue();
                            
                            if (!sName || !sField1 || !sField2) {
                                MessageBox.warning("Rule Name, Field 1, and Field 2 are required");
                                return;
                            }
                            
                            var aRules = oModel.getProperty("/ruleEngine/sequenceRules/rules") || [];
                            aRules.push({
                                id: "sq" + Date.now(),
                                name: sName,
                                field1: sField1,
                                field2: sField2,
                                matchType: sMatchType,
                                example1: sExample1,
                                example2: sExample2,
                                enabled: true
                            });
                            oModel.setProperty("/ruleEngine/sequenceRules/rules", aRules);
                            oModel.setProperty("/ruleEngine/sequenceRules/count", aRules.length);
                            
                            // Clear inputs
                            sap.ui.getCore().byId("sqName").setValue("");
                            sap.ui.getCore().byId("sqField1").setValue("");
                            sap.ui.getCore().byId("sqField2").setValue("");
                            sap.ui.getCore().byId("sqExample1").setValue("");
                            sap.ui.getCore().byId("sqExample2").setValue("");
                            that._oAddSequenceRuleDialog.close();
                            MessageToast.show("Sequence rule added successfully");
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            that._oAddSequenceRuleDialog.close();
                        }
                    })
                });
            }
            this._oAddSequenceRuleDialog.open();
        },
        
        onEditSequenceRule: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            MessageToast.show("Edit sequence rule: " + oRule.name);
        },
        
        onDeleteSequenceRule: function (oEvent) {
            var that = this;
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            MessageBox.confirm("Delete sequence rule '" + oRule.name + "'?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aRules = oModel.getProperty("/ruleEngine/sequenceRules/rules") || [];
                        var nIdx = aRules.findIndex(function(r) { return r.id === oRule.id; });
                        if (nIdx >= 0) {
                            aRules.splice(nIdx, 1);
                            oModel.setProperty("/ruleEngine/sequenceRules/rules", aRules);
                            oModel.setProperty("/ruleEngine/sequenceRules/count", aRules.length);
                            MessageToast.show("Sequence rule deleted");
                        }
                    }
                }
            });
        },
        
        onSequenceRuleToggle: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var aRules = oModel.getProperty("/ruleEngine/sequenceRules/rules") || [];
            var enabledCount = aRules.filter(function(r) { return r.enabled; }).length;
            oModel.setProperty("/ruleEngine/sequenceRules/count", enabledCount);
        },
        
        // ---------- Test Rules Workbench ----------
        onRunRuleTest: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var sInput = oModel.getProperty("/ruleEngine/testRules/input");
            var oRuleTypeSelect = this.byId("testRuleType");
            var oRuleSelect = this.byId("testRuleSelect");
            
            var sRuleType = oRuleTypeSelect ? oRuleTypeSelect.getSelectedKey() : "transform";
            var sRule = oRuleSelect ? oRuleSelect.getSelectedKey() : "SPLIT_COMMA";
            
            if (!sInput) {
                MessageBox.warning("Please enter test input data");
                return;
            }
            
            var sOutput = "";
            
            // Apply transformation based on selected rule
            switch (sRule) {
                case "SPLIT_COMMA":
                    sOutput = this._applyCommaTransform(sInput);
                    break;
                case "SPLIT_RANGE":
                    sOutput = this._applyRangeTransform(sInput);
                    break;
                case "SPLIT_AMPERSAND":
                    sOutput = this._applyAmpersandTransform(sInput);
                    break;
                case "FORMAT_AMOUNT":
                    sOutput = this._formatAmount(sInput);
                    break;
                case "FORMAT_DATE":
                    sOutput = this._formatDate(sInput);
                    break;
                case "EQUAL_SPLIT":
                    sOutput = this._applyEqualSplit(sInput);
                    break;
                case "SEQUENTIAL":
                    sOutput = this._applySequentialMatch(sInput);
                    break;
                default:
                    sOutput = "Rule not implemented: " + sRule;
            }
            
            oModel.setProperty("/ruleEngine/testRules/output", sOutput);
            MessageToast.show("Test completed");
        },
        
        onClearRuleTest: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/ruleEngine/testRules/input", "");
            oModel.setProperty("/ruleEngine/testRules/output", "");
            MessageToast.show("Test workspace cleared");
        },
        
        // ============================================================================
        // RULE ENGINE TRANSFORMATION FUNCTIONS
        // ============================================================================
        
        // Transform: Split by comma with partial number expansion
        // Example: "90000001, 5 & 6" → "90000001, 90000005, 90000006"
        _applyCommaTransform: function (sInput) {
            if (!sInput) return "";
            
            var parts = sInput.split(",").map(function(p) { return p.trim(); });
            
            if (parts.length <= 1) {
                return sInput;
            }
            
            var firstPart = parts[0];
            var results = [firstPart];
            
            // Check if first part is a full number and others are partial
            var firstPartStr = String(firstPart).replace(/[^0-9]/g, "");
            
            for (var i = 1; i < parts.length; i++) {
                var part = parts[i];
                
                // Check for ampersand splits within this part
                if (part.includes("&")) {
                    var ampParts = part.split("&").map(function(ap) { return ap.trim(); });
                    ampParts.forEach(function(ap) {
                        var apStr = String(ap).replace(/[^0-9]/g, "");
                        if (apStr.length < firstPartStr.length) {
                            // Expand with prefix
                            var prefix = firstPartStr.substring(0, firstPartStr.length - apStr.length);
                            results.push(prefix + apStr);
                        } else {
                            results.push(ap);
                        }
                    });
                } else {
                    var partStr = String(part).replace(/[^0-9]/g, "");
                    if (partStr.length < firstPartStr.length) {
                        // Expand with prefix
                        var prefix = firstPartStr.substring(0, firstPartStr.length - partStr.length);
                        results.push(prefix + partStr);
                    } else {
                        results.push(part);
                    }
                }
            }
            
            return results.join(", ");
        },
        
        // Transform: Expand range notation
        // Example: "95015001 to 010" → "95015001, 95015002, ... 95015010 (10 records)"
        _applyRangeTransform: function (sInput) {
            if (!sInput) return "";
            
            // Check for "to" or "through" pattern
            var rangeMatch = sInput.match(/(\d+)\s*(?:to|through|-)\s*(\d+)/i);
            
            if (!rangeMatch) {
                return "No range pattern found. Use format like '95015001 to 010'";
            }
            
            var startNum = rangeMatch[1];
            var endSuffix = rangeMatch[2];
            
            // Calculate end number by appending prefix
            var prefixLength = startNum.length - endSuffix.length;
            var prefix = startNum.substring(0, prefixLength);
            var endNum = prefix + endSuffix;
            
            var startInt = parseInt(startNum);
            var endInt = parseInt(endNum);
            
            if (endInt < startInt) {
                return "Error: End number (" + endNum + ") is less than start number (" + startNum + ")";
            }
            
            var count = endInt - startInt + 1;
            
            if (count > 100) {
                return "Range too large (" + count + " records). Max 100 allowed.";
            }
            
            var results = [];
            for (var i = startInt; i <= endInt; i++) {
                results.push(String(i).padStart(startNum.length, "0"));
            }
            
            return results.join(", ") + "\n\n(" + count + " records generated)";
        },
        
        // Transform: Split by ampersand
        // Example: "INV-001 & INV-002 & INV-003" → "INV-001, INV-002, INV-003"
        _applyAmpersandTransform: function (sInput) {
            if (!sInput) return "";
            
            var parts = sInput.split("&").map(function(p) { return p.trim(); });
            return parts.join(", ") + "\n\n(" + parts.length + " items)";
        },
        
        // Format: Clean and standardize amount
        // Example: "$1,234.56" → "1234.56"
        _formatAmount: function (sInput) {
            if (!sInput) return "";
            
            // Remove currency symbols and commas
            var cleaned = sInput.replace(/[$€£¥,\s]/g, "");
            
            // Ensure valid number
            var num = parseFloat(cleaned);
            if (isNaN(num)) {
                return "Invalid amount: " + sInput;
            }
            
            return num.toFixed(2);
        },
        
        // Format: Convert date to ISO format
        // Example: "12/31/2024" → "2024-12-31T00:00:00"
        _formatDate: function (sInput) {
            if (!sInput) return "";
            
            // Try various date formats
            var date = null;
            
            // MM/DD/YYYY
            var match1 = sInput.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (match1) {
                date = new Date(match1[3], match1[1] - 1, match1[2]);
            }
            
            // DD-MM-YYYY
            var match2 = sInput.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
            if (!date && match2) {
                date = new Date(match2[3], match2[2] - 1, match2[1]);
            }
            
            // YYYY-MM-DD (already ISO)
            var match3 = sInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!date && match3) {
                date = new Date(match3[1], match3[2] - 1, match3[3]);
            }
            
            if (!date || isNaN(date.getTime())) {
                return "Unable to parse date: " + sInput;
            }
            
            return date.toISOString().replace(".000Z", "");
        },
        
        // Amount Split: Equal distribution
        // Example: "3000,3" → "$1000.00, $1000.00, $1000.00"
        _applyEqualSplit: function (sInput) {
            if (!sInput) return "";
            
            var parts = sInput.split(",").map(function(p) { return p.trim(); });
            
            if (parts.length !== 2) {
                return "Format: amount,count (e.g., '3000,3')";
            }
            
            var total = parseFloat(parts[0].replace(/[$,]/g, ""));
            var count = parseInt(parts[1]);
            
            if (isNaN(total) || isNaN(count) || count <= 0) {
                return "Invalid input. Format: amount,count (e.g., '3000,3')";
            }
            
            var each = total / count;
            var results = [];
            for (var i = 0; i < count; i++) {
                results.push("$" + each.toFixed(2));
            }
            
            return results.join(", ");
        },
        
        // Sequential Match: Pair items positionally
        // Example: "345666,335556,3434566|1300,1500,2000"
        _applySequentialMatch: function (sInput) {
            if (!sInput) return "";
            
            var sections = sInput.split("|");
            if (sections.length !== 2) {
                return "Format: field1Values|field2Values\n(e.g., '345666,335556,3434566|1300,1500,2000')";
            }
            
            var field1 = sections[0].split(",").map(function(p) { return p.trim(); });
            var field2 = sections[1].split(",").map(function(p) { return p.trim(); });
            
            if (field1.length !== field2.length) {
                return "Warning: Unequal counts - Field1: " + field1.length + ", Field2: " + field2.length;
            }
            
            var results = [];
            for (var i = 0; i < field1.length; i++) {
                results.push("  " + field1[i] + " → $" + field2[i]);
            }
            
            return "Paired Results:\n" + results.join("\n");
        },
        
        // ============================================================================
        // AUTO VALIDATION RULE ENGINE HANDLERS (Existing)
        // ============================================================================
        
        // ---------- Field Detection Rules ----------
        onAddFieldDetectionRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Create dialog for adding field detection rule
            if (!this._oAddFieldDetectionDialog) {
                this._oAddFieldDetectionDialog = new sap.m.Dialog({
                    title: "Add Field Detection Rule",
                    contentWidth: "450px",
                    content: [
                        new sap.m.VBox({
                            class: "sapUiSmallMargin",
                            items: [
                                new sap.m.Label({ text: "Field Type Name", required: true }),
                                new sap.m.Input({ id: "fdFieldType", placeholder: "e.g., Phone Number" }),
                                new sap.m.Label({ text: "Regex Pattern", required: true, class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "fdPattern", placeholder: "e.g., ^\\d{3}-\\d{3}-\\d{4}$" }),
                                new sap.m.Label({ text: "Example Match", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "fdExample", placeholder: "e.g., 555-123-4567" })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Add",
                        type: "Emphasized",
                        press: function () {
                            var sFieldType = sap.ui.getCore().byId("fdFieldType").getValue();
                            var sPattern = sap.ui.getCore().byId("fdPattern").getValue();
                            var sExample = sap.ui.getCore().byId("fdExample").getValue();
                            
                            if (!sFieldType || !sPattern) {
                                MessageBox.warning("Field Type and Pattern are required");
                                return;
                            }
                            
                            var aRules = oModel.getProperty("/ruleEngine/fieldDetectionRules") || [];
                            aRules.push({
                                id: "fd" + Date.now(),
                                fieldType: sFieldType,
                                pattern: sPattern,
                                example: sExample,
                                enabled: true,
                                state: "Information"
                            });
                            oModel.setProperty("/ruleEngine/fieldDetectionRules", aRules);
                            that._updateRuleEngineStats();
                            
                            // Clear and close
                            sap.ui.getCore().byId("fdFieldType").setValue("");
                            sap.ui.getCore().byId("fdPattern").setValue("");
                            sap.ui.getCore().byId("fdExample").setValue("");
                            that._oAddFieldDetectionDialog.close();
                            MessageToast.show("Field detection rule added");
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            that._oAddFieldDetectionDialog.close();
                        }
                    })
                });
            }
            this._oAddFieldDetectionDialog.open();
        },
        
        onEditFieldDetectionRule: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            MessageToast.show("Edit rule: " + oRule.fieldType);
        },
        
        onDeleteFieldDetectionRule: function (oEvent) {
            var that = this;
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            MessageBox.confirm("Delete field detection rule '" + oRule.fieldType + "'?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aRules = oModel.getProperty("/ruleEngine/fieldDetectionRules") || [];
                        var nIdx = aRules.findIndex(function(r) { return r.id === oRule.id; });
                        if (nIdx >= 0) {
                            aRules.splice(nIdx, 1);
                            oModel.setProperty("/ruleEngine/fieldDetectionRules", aRules);
                            that._updateRuleEngineStats();
                            MessageToast.show("Rule deleted");
                        }
                    }
                }
            });
        },
        
        onFieldDetectionRuleToggle: function (oEvent) {
            this._updateRuleEngineStats();
        },
        
        // ---------- Mapping Rules ----------
        onAddMappingRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            if (!this._oAddMappingRuleDialog) {
                this._oAddMappingRuleDialog = new sap.m.Dialog({
                    title: "Add Mapping Rule",
                    contentWidth: "500px",
                    content: [
                        new sap.m.VBox({
                            class: "sapUiSmallMargin",
                            items: [
                                new sap.m.Label({ text: "Keywords (comma-separated)", required: true }),
                                new sap.m.Input({ id: "mrKeywords", placeholder: "e.g., Amount, Amt, Total" }),
                                new sap.m.Label({ text: "Maps To (API Field)", required: true, class: "sapUiSmallMarginTop" }),
                                new sap.m.Select({
                                    id: "mrApiField",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "AmountInTransactionCurrency", text: "AmountInTransactionCurrency" }),
                                        new sap.ui.core.Item({ key: "Cheque", text: "Cheque" }),
                                        new sap.ui.core.Item({ key: "PartnerBankAccount", text: "PartnerBankAccount" }),
                                        new sap.ui.core.Item({ key: "PartnerBank", text: "PartnerBank" }),
                                        new sap.ui.core.Item({ key: "PartnerBankCountry", text: "PartnerBankCountry" }),
                                        new sap.ui.core.Item({ key: "PaymentReference", text: "PaymentReference" }),
                                        new sap.ui.core.Item({ key: "Currency", text: "Currency" }),
                                        new sap.ui.core.Item({ key: "DepositDateTime", text: "DepositDateTime" }),
                                        new sap.ui.core.Item({ key: "CustomerNumber", text: "CustomerNumber (Custom)" })
                                    ]
                                }),
                                new sap.m.Label({ text: "Section", class: "sapUiSmallMarginTop" }),
                                new sap.m.Select({
                                    id: "mrSection",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "Header", text: "Header" }),
                                        new sap.ui.core.Item({ key: "Cheques", text: "Cheques" }),
                                        new sap.ui.core.Item({ key: "PaymentRef", text: "Payment Reference" }),
                                        new sap.ui.core.Item({ key: "Custom", text: "Custom" })
                                    ]
                                }),
                                new sap.m.Label({ text: "Priority (1=highest)", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "mrPriority", type: "Number", value: "1" })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Add",
                        type: "Emphasized",
                        press: function () {
                            var sKeywords = sap.ui.getCore().byId("mrKeywords").getValue();
                            var sApiField = sap.ui.getCore().byId("mrApiField").getSelectedKey();
                            var sSection = sap.ui.getCore().byId("mrSection").getSelectedKey();
                            var nPriority = parseInt(sap.ui.getCore().byId("mrPriority").getValue()) || 1;
                            
                            if (!sKeywords || !sApiField) {
                                MessageBox.warning("Keywords and API Field are required");
                                return;
                            }
                            
                            var aRules = oModel.getProperty("/ruleEngine/mappingRules") || [];
                            aRules.push({
                                id: "m" + Date.now(),
                                keywords: sKeywords,
                                apiField: sApiField,
                                section: sSection,
                                priority: nPriority,
                                enabled: true
                            });
                            oModel.setProperty("/ruleEngine/mappingRules", aRules);
                            that._updateRuleEngineStats();
                            
                            sap.ui.getCore().byId("mrKeywords").setValue("");
                            that._oAddMappingRuleDialog.close();
                            MessageToast.show("Mapping rule added");
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            that._oAddMappingRuleDialog.close();
                        }
                    })
                });
            }
            this._oAddMappingRuleDialog.open();
        },
        
        onEditMappingRule: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            MessageToast.show("Edit mapping: " + oRule.apiField);
        },
        
        onDeleteMappingRule: function (oEvent) {
            var that = this;
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            MessageBox.confirm("Delete mapping rule for '" + oRule.apiField + "'?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aRules = oModel.getProperty("/ruleEngine/mappingRules") || [];
                        var nIdx = aRules.findIndex(function(r) { return r.id === oRule.id; });
                        if (nIdx >= 0) {
                            aRules.splice(nIdx, 1);
                            oModel.setProperty("/ruleEngine/mappingRules", aRules);
                            that._updateRuleEngineStats();
                            MessageToast.show("Rule deleted");
                        }
                    }
                }
            });
        },
        
        onMappingRuleToggle: function (oEvent) {
            this._updateRuleEngineStats();
        },
        
        // ---------- Validation Rules ----------
        onAddValidationRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            if (!this._oAddValidationRuleDialog) {
                this._oAddValidationRuleDialog = new sap.m.Dialog({
                    title: "Add Validation Rule",
                    contentWidth: "500px",
                    content: [
                        new sap.m.VBox({
                            class: "sapUiSmallMargin",
                            items: [
                                new sap.m.Label({ text: "Rule Name", required: true }),
                                new sap.m.Input({ id: "vrName", placeholder: "e.g., Amount Positive" }),
                                new sap.m.Label({ text: "Field", required: true, class: "sapUiSmallMarginTop" }),
                                new sap.m.Select({
                                    id: "vrField",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "AmountInTransactionCurrency", text: "AmountInTransactionCurrency" }),
                                        new sap.ui.core.Item({ key: "Cheque", text: "Cheque" }),
                                        new sap.ui.core.Item({ key: "PartnerBankAccount", text: "PartnerBankAccount" }),
                                        new sap.ui.core.Item({ key: "PaymentReference", text: "PaymentReference" }),
                                        new sap.ui.core.Item({ key: "Currency", text: "Currency" }),
                                        new sap.ui.core.Item({ key: "DepositDateTime", text: "DepositDateTime" })
                                    ]
                                }),
                                new sap.m.Label({ text: "Rule Type", class: "sapUiSmallMarginTop" }),
                                new sap.m.Select({
                                    id: "vrRuleType",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "Required", text: "Required" }),
                                        new sap.ui.core.Item({ key: "Format", text: "Format" }),
                                        new sap.ui.core.Item({ key: "Length", text: "Length" }),
                                        new sap.ui.core.Item({ key: "Range", text: "Range" }),
                                        new sap.ui.core.Item({ key: "Pattern", text: "Pattern (Regex)" }),
                                        new sap.ui.core.Item({ key: "Unique", text: "Unique" })
                                    ]
                                }),
                                new sap.m.Label({ text: "Condition", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "vrCondition", placeholder: "e.g., not_empty, numeric, min:0, max:100" }),
                                new sap.m.Label({ text: "Severity", class: "sapUiSmallMarginTop" }),
                                new sap.m.Select({
                                    id: "vrSeverity",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "error", text: "Error (blocks processing)" }),
                                        new sap.ui.core.Item({ key: "warning", text: "Warning (allows processing)" })
                                    ]
                                })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Add",
                        type: "Emphasized",
                        press: function () {
                            var sName = sap.ui.getCore().byId("vrName").getValue();
                            var sField = sap.ui.getCore().byId("vrField").getSelectedKey();
                            var sRuleType = sap.ui.getCore().byId("vrRuleType").getSelectedKey();
                            var sCondition = sap.ui.getCore().byId("vrCondition").getValue();
                            var sSeverity = sap.ui.getCore().byId("vrSeverity").getSelectedKey();
                            
                            if (!sName || !sField) {
                                MessageBox.warning("Rule Name and Field are required");
                                return;
                            }
                            
                            var aRules = oModel.getProperty("/ruleEngine/validationRules") || [];
                            aRules.push({
                                id: "v" + Date.now(),
                                name: sName,
                                field: sField,
                                ruleType: sRuleType,
                                condition: sCondition || "not_empty",
                                severity: sSeverity,
                                enabled: true
                            });
                            oModel.setProperty("/ruleEngine/validationRules", aRules);
                            that._updateRuleEngineStats();
                            
                            sap.ui.getCore().byId("vrName").setValue("");
                            sap.ui.getCore().byId("vrCondition").setValue("");
                            that._oAddValidationRuleDialog.close();
                            MessageToast.show("Validation rule added");
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            that._oAddValidationRuleDialog.close();
                        }
                    })
                });
            }
            this._oAddValidationRuleDialog.open();
        },
        
        onEditValidationRule: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            MessageToast.show("Edit rule: " + oRule.name);
        },
        
        onDeleteValidationRule: function (oEvent) {
            var that = this;
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            MessageBox.confirm("Delete validation rule '" + oRule.name + "'?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aRules = oModel.getProperty("/ruleEngine/validationRules") || [];
                        var nIdx = aRules.findIndex(function(r) { return r.id === oRule.id; });
                        if (nIdx >= 0) {
                            aRules.splice(nIdx, 1);
                            oModel.setProperty("/ruleEngine/validationRules", aRules);
                            that._updateRuleEngineStats();
                            MessageToast.show("Rule deleted");
                        }
                    }
                }
            });
        },
        
        onValidationRuleToggle: function (oEvent) {
            this._updateRuleEngineStats();
        },
        
        // ---------- Anomaly Detection Rules ----------
        onAddAnomalyRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            if (!this._oAddAnomalyRuleDialog) {
                this._oAddAnomalyRuleDialog = new sap.m.Dialog({
                    title: "Add Anomaly Detection Rule",
                    contentWidth: "500px",
                    content: [
                        new sap.m.VBox({
                            class: "sapUiSmallMargin",
                            items: [
                                new sap.m.Label({ text: "Rule Name", required: true }),
                                new sap.m.Input({ id: "arName", placeholder: "e.g., Large Transaction Alert" }),
                                new sap.m.Label({ text: "Check Type", class: "sapUiSmallMarginTop" }),
                                new sap.m.Select({
                                    id: "arCheckType",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "Duplicate", text: "Duplicate Detection" }),
                                        new sap.ui.core.Item({ key: "Threshold", text: "Threshold Check" }),
                                        new sap.ui.core.Item({ key: "Frequency", text: "Frequency Check" }),
                                        new sap.ui.core.Item({ key: "Outlier", text: "Outlier Detection" }),
                                        new sap.ui.core.Item({ key: "Pattern", text: "Pattern Detection" })
                                    ]
                                }),
                                new sap.m.Label({ text: "Field", required: true, class: "sapUiSmallMarginTop" }),
                                new sap.m.Select({
                                    id: "arField",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "AmountInTransactionCurrency", text: "AmountInTransactionCurrency" }),
                                        new sap.ui.core.Item({ key: "Cheque", text: "Cheque" }),
                                        new sap.ui.core.Item({ key: "PartnerBankAccount", text: "PartnerBankAccount" }),
                                        new sap.ui.core.Item({ key: "PaymentReference", text: "PaymentReference" })
                                    ]
                                }),
                                new sap.m.Label({ text: "Threshold/Condition", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "arThreshold", placeholder: "e.g., Amount > $50,000" }),
                                new sap.m.Label({ text: "Severity", class: "sapUiSmallMarginTop" }),
                                new sap.m.Select({
                                    id: "arSeverity",
                                    width: "100%",
                                    items: [
                                        new sap.ui.core.Item({ key: "error", text: "Error (blocks processing)" }),
                                        new sap.ui.core.Item({ key: "warning", text: "Warning (flags for review)" })
                                    ]
                                })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Add",
                        type: "Emphasized",
                        press: function () {
                            var sName = sap.ui.getCore().byId("arName").getValue();
                            var sCheckType = sap.ui.getCore().byId("arCheckType").getSelectedKey();
                            var sField = sap.ui.getCore().byId("arField").getSelectedKey();
                            var sThreshold = sap.ui.getCore().byId("arThreshold").getValue();
                            var sSeverity = sap.ui.getCore().byId("arSeverity").getSelectedKey();
                            
                            if (!sName || !sField) {
                                MessageBox.warning("Rule Name and Field are required");
                                return;
                            }
                            
                            var aRules = oModel.getProperty("/ruleEngine/anomalyRules") || [];
                            aRules.push({
                                id: "a" + Date.now(),
                                name: sName,
                                checkType: sCheckType,
                                field: sField,
                                threshold: sThreshold,
                                severity: sSeverity,
                                enabled: true
                            });
                            oModel.setProperty("/ruleEngine/anomalyRules", aRules);
                            that._updateRuleEngineStats();
                            
                            sap.ui.getCore().byId("arName").setValue("");
                            sap.ui.getCore().byId("arThreshold").setValue("");
                            that._oAddAnomalyRuleDialog.close();
                            MessageToast.show("Anomaly rule added");
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            that._oAddAnomalyRuleDialog.close();
                        }
                    })
                });
            }
            this._oAddAnomalyRuleDialog.open();
        },
        
        onEditAnomalyRule: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            MessageToast.show("Edit anomaly rule: " + oRule.name);
        },
        
        onDeleteAnomalyRule: function (oEvent) {
            var that = this;
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            MessageBox.confirm("Delete anomaly rule '" + oRule.name + "'?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aRules = oModel.getProperty("/ruleEngine/anomalyRules") || [];
                        var nIdx = aRules.findIndex(function(r) { return r.id === oRule.id; });
                        if (nIdx >= 0) {
                            aRules.splice(nIdx, 1);
                            oModel.setProperty("/ruleEngine/anomalyRules", aRules);
                            that._updateRuleEngineStats();
                            MessageToast.show("Rule deleted");
                        }
                    }
                }
            });
        },
        
        onAnomalyRuleToggle: function (oEvent) {
            this._updateRuleEngineStats();
        },
        
        // ---------- Constant Fields ----------
        onAddConstantField: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            if (!this._oAddConstantFieldDialog) {
                this._oAddConstantFieldDialog = new sap.m.Dialog({
                    title: "Add Constant Field",
                    contentWidth: "400px",
                    content: [
                        new sap.m.VBox({
                            class: "sapUiSmallMargin",
                            items: [
                                new sap.m.Label({ text: "Field Name", required: true }),
                                new sap.m.Input({ id: "cfFieldName", placeholder: "e.g., CustomField1" }),
                                new sap.m.Label({ text: "Default Value", class: "sapUiSmallMarginTop" }),
                                new sap.m.Input({ id: "cfValue", placeholder: "e.g., DefaultValue" })
                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Add",
                        type: "Emphasized",
                        press: function () {
                            var sFieldName = sap.ui.getCore().byId("cfFieldName").getValue();
                            var sValue = sap.ui.getCore().byId("cfValue").getValue();
                            
                            if (!sFieldName) {
                                MessageBox.warning("Field Name is required");
                                return;
                            }
                            
                            var aFields = oModel.getProperty("/templateBuilder/constantFields") || [];
                            aFields.push({
                                field: sFieldName,
                                value: sValue || "",
                                editable: true
                            });
                            oModel.setProperty("/templateBuilder/constantFields", aFields);
                            
                            sap.ui.getCore().byId("cfFieldName").setValue("");
                            sap.ui.getCore().byId("cfValue").setValue("");
                            that._oAddConstantFieldDialog.close();
                            MessageToast.show("Constant field added");
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            that._oAddConstantFieldDialog.close();
                        }
                    })
                });
            }
            this._oAddConstantFieldDialog.open();
        },
        
        onDeleteConstantField: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oField = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            var aFields = oModel.getProperty("/templateBuilder/constantFields") || [];
            var nIdx = aFields.findIndex(function(f) { return f.field === oField.field; });
            if (nIdx >= 0) {
                aFields.splice(nIdx, 1);
                oModel.setProperty("/templateBuilder/constantFields", aFields);
                MessageToast.show("Field removed");
            }
        },
        
        onSaveConstantFields: function () {
            MessageToast.show("Constant fields saved");
        },
        
        // ============================================================================
        // RULE ENGINE - APPLY RULES TO DATA
        // ============================================================================
        
        // Apply all rules to extracted job data
        _applyRulesToJobData: function (oJob) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oRuleEngine = oModel.getProperty("/ruleEngine");
            var aResults = { errors: [], warnings: [], anomalies: [] };
            
            if (!oJob || !oJob.extractedData) {
                return aResults;
            }
            
            var aData = oJob.extractedData;
            
            // Apply Validation Rules
            (oRuleEngine.validationRules || []).forEach(function (rule) {
                if (!rule.enabled) return;
                
                aData.forEach(function (record, idx) {
                    var fieldValue = record[rule.field] || record[rule.field.toLowerCase()];
                    var isValid = true;
                    
                    switch (rule.ruleType) {
                        case "Required":
                            isValid = fieldValue !== undefined && fieldValue !== null && fieldValue !== "";
                            break;
                        case "Format":
                            if (rule.condition === "numeric") {
                                isValid = !isNaN(parseFloat(fieldValue));
                            }
                            break;
                        case "Length":
                            if (rule.condition.includes("exactly")) {
                                var len = parseInt(rule.condition.match(/\d+/)[0]);
                                isValid = String(fieldValue).length === len;
                            }
                            break;
                    }
                    
                    if (!isValid) {
                        var msg = "Row " + (idx + 1) + ": " + rule.name + " - " + rule.field;
                        if (rule.severity === "error") {
                            aResults.errors.push(msg);
                            record.validationStatus = "ERROR";
                        } else {
                            aResults.warnings.push(msg);
                            if (record.validationStatus !== "ERROR") {
                                record.validationStatus = "WARNING";
                            }
                        }
                    }
                });
            });
            
            // Apply Anomaly Rules
            (oRuleEngine.anomalyRules || []).forEach(function (rule) {
                if (!rule.enabled) return;
                
                if (rule.checkType === "Duplicate") {
                    var valueCounts = {};
                    aData.forEach(function (record) {
                        var val = record[rule.field] || record[rule.field.toLowerCase()];
                        if (val) {
                            valueCounts[val] = (valueCounts[val] || 0) + 1;
                        }
                    });
                    
                    Object.keys(valueCounts).forEach(function (val) {
                        if (valueCounts[val] >= 3) {
                            aResults.anomalies.push(rule.name + ": Value '" + val + "' appears " + valueCounts[val] + " times");
                        }
                    });
                }
                
                if (rule.checkType === "Threshold") {
                    aData.forEach(function (record, idx) {
                        var val = parseFloat(record[rule.field] || record[rule.field.toLowerCase()]);
                        if (val > 100000) {
                            aResults.anomalies.push(rule.name + ": Row " + (idx + 1) + " amount $" + val.toFixed(2) + " exceeds threshold");
                        }
                    });
                }
            });
            
            return aResults;
        },
        
        // ============================================================================
        // AUTO FIELD MAPPING - Customer File → Lockbox API
        // ============================================================================
        
        // Automatically map customer file fields to Lockbox API fields using Smart Mapping rules
        _autoMapFields: function (aSourceFields, aSampleData) {
            var oModel = this.getOwnerComponent().getModel("app");
            var aMappingRules = oModel.getProperty("/ruleEngine/mappingRules") || [];
            var aFieldDetectionRules = oModel.getProperty("/ruleEngine/fieldDetectionRules") || [];
            var aFieldMappings = [];
            var that = this;
            
            // Process each source field from the uploaded file
            aSourceFields.forEach(function (sourceField) {
                var sFieldName = sourceField.name || sourceField;
                var sSampleValue = sourceField.sample || (aSampleData && aSampleData[0] ? aSampleData[0][sFieldName] : "");
                
                // Find best matching API field using mapping rules
                var bestMatch = that._findBestApiFieldMatch(sFieldName, sSampleValue, aMappingRules, aFieldDetectionRules);
                
                aFieldMappings.push({
                    sourceField: sFieldName,
                    sampleValue: sSampleValue,
                    apiField: bestMatch.apiField,
                    section: bestMatch.section,
                    confidence: bestMatch.confidence,
                    matchedBy: bestMatch.matchedBy,
                    originalApiField: bestMatch.apiField // Store original for reset
                });
            });
            
            return aFieldMappings;
        },
        
        // Find the best matching API field for a source field
        _findBestApiFieldMatch: function (sSourceField, sSampleValue, aMappingRules, aFieldDetectionRules) {
            var bestMatch = {
                apiField: "",
                section: "",
                confidence: 0,
                matchedBy: "none"
            };
            
            var sFieldLower = sSourceField.toLowerCase();
            
            // Sort mapping rules by priority (lower number = higher priority)
            var sortedRules = aMappingRules.filter(function(r) { return r.enabled; })
                .sort(function(a, b) { return a.priority - b.priority; });
            
            // Check against each mapping rule's keywords
            sortedRules.forEach(function (rule) {
                if (bestMatch.confidence >= 100) return; // Already found perfect match
                
                var aKeywords = rule.keywords.split(",").map(function(k) { return k.trim().toLowerCase(); });
                
                aKeywords.forEach(function (keyword) {
                    if (bestMatch.confidence >= 100) return;
                    
                    // Exact match
                    if (sFieldLower === keyword) {
                        bestMatch = {
                            apiField: rule.apiField,
                            section: rule.section,
                            confidence: 100,
                            matchedBy: "exact_keyword"
                        };
                    }
                    // Contains match
                    else if (sFieldLower.includes(keyword) || keyword.includes(sFieldLower)) {
                        var newConfidence = 80;
                        if (newConfidence > bestMatch.confidence) {
                            bestMatch = {
                                apiField: rule.apiField,
                                section: rule.section,
                                confidence: newConfidence,
                                matchedBy: "partial_keyword"
                            };
                        }
                    }
                    // Word boundary match (e.g., "Payment Amount" contains "Amount")
                    else if (sFieldLower.split(/[\s_\-]+/).some(function(word) { return word === keyword; })) {
                        var newConfidence = 70;
                        if (newConfidence > bestMatch.confidence) {
                            bestMatch = {
                                apiField: rule.apiField,
                                section: rule.section,
                                confidence: newConfidence,
                                matchedBy: "word_match"
                            };
                        }
                    }
                });
            });
            
            // If no keyword match, try to detect field type from sample value
            if (bestMatch.confidence < 50 && sSampleValue) {
                var detectedType = this._detectFieldType(sSampleValue, aFieldDetectionRules);
                if (detectedType) {
                    var typeToApiField = {
                        "Currency Amount": { apiField: "AmountInTransactionCurrency", section: "Header", confidence: 60 },
                        "Date": { apiField: "DepositDateTime", section: "Header", confidence: 50 },
                        "Date (ISO)": { apiField: "DepositDateTime", section: "Header", confidence: 50 },
                        "Bank Account": { apiField: "PartnerBankAccount", section: "Cheques", confidence: 60 },
                        "Reference Number": { apiField: "PaymentReference", section: "PaymentRef", confidence: 55 },
                        "Currency Code": { apiField: "Currency", section: "Header", confidence: 70 }
                    };
                    
                    if (typeToApiField[detectedType]) {
                        bestMatch = {
                            apiField: typeToApiField[detectedType].apiField,
                            section: typeToApiField[detectedType].section,
                            confidence: typeToApiField[detectedType].confidence,
                            matchedBy: "type_detection"
                        };
                    }
                }
            }
            
            return bestMatch;
        },
        
        // Detect field type from sample value using regex patterns
        _detectFieldType: function (sValue, aFieldDetectionRules) {
            if (!sValue) return null;
            
            var sValueStr = String(sValue);
            
            var activeRules = aFieldDetectionRules.filter(function(r) { return r.enabled; });
            
            for (var i = 0; i < activeRules.length; i++) {
                try {
                    var regex = new RegExp(activeRules[i].pattern);
                    if (regex.test(sValueStr)) {
                        return activeRules[i].fieldType;
                    }
                } catch (e) {
                    console.warn("Invalid regex pattern:", activeRules[i].pattern);
                }
            }
            
            return null;
        },
        
        // Calculate mapping summary statistics
        _calculateMappingSummary: function (aFieldMappings) {
            var mapped = 0;
            var unmapped = 0;
            var totalConfidence = 0;
            
            aFieldMappings.forEach(function (mapping) {
                if (mapping.apiField) {
                    mapped++;
                    totalConfidence += mapping.confidence;
                } else {
                    unmapped++;
                }
            });
            
            return {
                mapped: mapped,
                unmapped: unmapped,
                total: aFieldMappings.length,
                avgConfidence: mapped > 0 ? Math.round(totalConfidence / mapped) : 0
            };
        },
        
        // Handler: Re-apply field mapping rules
        onReApplyFieldMapping: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oJob = oModel.getProperty("/templateBuilder/selectedJob");
            
            if (!oJob) {
                MessageToast.show("No job selected");
                return;
            }
            
            // Get source fields from extracted data
            var aSourceFields = [];
            if (oJob.extractedData && oJob.extractedData.length > 0) {
                var firstRecord = oJob.extractedData[0];
                Object.keys(firstRecord).forEach(function (key) {
                    if (key !== "rowNum" && key !== "validationStatus") {
                        aSourceFields.push({
                            name: key,
                            sample: firstRecord[key]
                        });
                    }
                });
            }
            
            // Re-apply mapping
            var aFieldMappings = this._autoMapFields(aSourceFields, oJob.extractedData);
            var oSummary = this._calculateMappingSummary(aFieldMappings);
            
            oJob.fieldMappings = aFieldMappings;
            oJob.mappingSummary = oSummary;
            
            oModel.setProperty("/templateBuilder/selectedJob", oJob);
            
            MessageToast.show("Field mappings re-applied: " + oSummary.mapped + " fields mapped");
        },
        
        // Handler: Field mapping dropdown changed
        onFieldMappingChange: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oJob = oModel.getProperty("/templateBuilder/selectedJob");
            
            if (oJob && oJob.fieldMappings) {
                var oSummary = this._calculateMappingSummary(oJob.fieldMappings);
                oModel.setProperty("/templateBuilder/selectedJob/mappingSummary", oSummary);
            }
        },
        
        // Handler: Reset field mapping to auto-detected value
        onResetFieldMapping: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oMapping = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Reset to original auto-detected value
            if (oMapping.originalApiField !== undefined) {
                oModel.setProperty(oContext.getPath() + "/apiField", oMapping.originalApiField);
                
                var oJob = oModel.getProperty("/templateBuilder/selectedJob");
                if (oJob && oJob.fieldMappings) {
                    var oSummary = this._calculateMappingSummary(oJob.fieldMappings);
                    oModel.setProperty("/templateBuilder/selectedJob/mappingSummary", oSummary);
                }
                
                MessageToast.show("Mapping reset to auto-detected value");
            }
        },
        
        // Handler: Apply mappings and run validation
        onApplyMappingsAndValidate: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oJob = oModel.getProperty("/templateBuilder/selectedJob");
            
            if (!oJob) {
                MessageBox.warning("No job selected");
                return;
            }
            
            BusyIndicator.show(0);
            
            setTimeout(function () {
                // Apply validation rules to the job
                var validationResults = that._applyRulesToJobData(oJob);
                
                // Update job status based on validation
                if (validationResults.errors.length === 0) {
                    oJob.status = "VALIDATED";
                    
                    // Update jobs list
                    var aJobs = oModel.getProperty("/templateBuilder/jobs") || [];
                    var nIdx = aJobs.findIndex(function(j) { return j.id === oJob.id; });
                    if (nIdx >= 0) {
                        aJobs[nIdx] = oJob;
                        oModel.setProperty("/templateBuilder/jobs", aJobs);
                        
                        // Update validated jobs list
                        var aValidatedJobs = aJobs.filter(function(j) {
                            return j.status === "VALIDATED" || j.status === "EXTRACTED";
                        });
                        oModel.setProperty("/templateBuilder/validatedJobs", aValidatedJobs);
                        
                        that._updateJobStats(aJobs);
                    }
                    
                    BusyIndicator.hide();
                    
                    MessageBox.success(
                        "Validation Passed!\n\n" +
                        "• Mapped Fields: " + oJob.mappingSummary.mapped + "\n" +
                        "• Warnings: " + validationResults.warnings.length + "\n" +
                        "• Anomalies: " + validationResults.anomalies.length + "\n\n" +
                        "Job is ready for Simulation.",
                        { title: "Validation Complete" }
                    );
                } else {
                    oJob.status = "FAILED";
                    
                    BusyIndicator.hide();
                    
                    MessageBox.error(
                        "Validation Failed!\n\n" +
                        "Errors:\n" + validationResults.errors.slice(0, 5).join("\n") +
                        (validationResults.errors.length > 5 ? "\n... and " + (validationResults.errors.length - 5) + " more" : ""),
                        { title: "Validation Failed" }
                    );
                }
                
                oModel.setProperty("/templateBuilder/selectedJob", oJob);
            }, 1000);
        },
        
        // Transfer validated data to Lockbox Transaction
        onTransferToLockboxTransaction: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oJob = oModel.getProperty("/templateBuilder/selectedJob");
            
            if (!oJob || oJob.status !== "VALIDATED") {
                MessageBox.warning("Only validated jobs can be transferred to Lockbox Transaction");
                return;
            }
            
            MessageBox.confirm(
                "Transfer this validated lockbox to Lockbox Transaction?\n\n" +
                "Lockbox ID: " + oJob.lockboxId + "\n" +
                "Checks: " + oJob.checkCount + "\n" +
                "Invoices: " + oJob.records + "\n" +
                "Total Amount: $" + oJob.totalAmount,
                {
                    title: "Confirm Transfer",
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            // Build lockbox data for transaction screen
                            var oLockboxData = that._buildLockboxTransactionData(oJob);
                            
                            // Add to lockbox transaction data
                            var aLockboxData = oModel.getProperty("/lockboxData") || [];
                            
                            // Check if already exists
                            var existingIdx = aLockboxData.findIndex(function(lb) {
                                return lb.lockbox === oJob.lockboxId;
                            });
                            
                            if (existingIdx >= 0) {
                                // Update existing
                                aLockboxData[existingIdx] = oLockboxData;
                            } else {
                                // Add new
                                aLockboxData.unshift(oLockboxData);
                            }
                            
                            oModel.setProperty("/lockboxData", aLockboxData);
                            
                            // Update job status
                            oJob.status = "TRANSFERRED";
                            var aJobs = oModel.getProperty("/templateBuilder/jobs") || [];
                            var jobIdx = aJobs.findIndex(function(j) { return j.id === oJob.id; });
                            if (jobIdx >= 0) {
                                aJobs[jobIdx] = oJob;
                                oModel.setProperty("/templateBuilder/jobs", aJobs);
                                that._updateJobStats(aJobs);
                            }
                            oModel.setProperty("/templateBuilder/selectedJob", oJob);
                            
                            MessageBox.success(
                                "Data transferred to Lockbox Transaction!\n\n" +
                                "Lockbox ID: " + oJob.lockboxId + "\n\n" +
                                "You can now run Simulate or Production Run from the Lockbox Transaction screen.",
                                {
                                    title: "Transfer Complete",
                                    onClose: function () {
                                        // Navigate to Lockbox Transaction
                                        oModel.setProperty("/showHome", false);
                                        oModel.setProperty("/showConfig", false);
                                        oModel.setProperty("/showTemplateBuilder", false);
                                        oModel.setProperty("/showLockbox", true);
                                        oModel.setProperty("/showNavButton", true);
                                        oModel.setProperty("/currentView", "lockbox");
                                    }
                                }
                            );
                        }
                    }
                }
            );
        },
        
        // Build lockbox transaction data from validated job
        _buildLockboxTransactionData: function (oJob) {
            var oConstantFields = {};
            (oJob.constantFields || []).forEach(function(cf) {
                oConstantFields[cf.field] = cf.value;
            });
            
            // Build hierarchical structure for lockbox transaction
            var oLockboxData = {
                id: oJob.id,
                lockbox: oJob.lockboxId,
                companyCode: oConstantFields["CompanyCode"] || "1710",
                currency: oConstantFields["Currency"] || "USD",
                depositDateTime: new Date().toISOString(),
                totalAmount: oJob.totalAmount,
                status: "Ready",
                source: "Template Builder",
                filename: oJob.filename,
                checkCount: oJob.checkCount,
                invoiceCount: oJob.records,
                // Hierarchical data
                hierarchicalData: oJob.hierarchicalData,
                // Flat data for table display
                items: []
            };
            
            // Build flat items for display
            if (oJob.hierarchicalData && oJob.hierarchicalData.checks) {
                oJob.hierarchicalData.checks.forEach(function(check, checkIdx) {
                    (check.invoices || []).forEach(function(invoice, invIdx) {
                        oLockboxData.items.push({
                            lockboxBatch: oConstantFields["LockboxBatch"] || "001",
                            lockboxBatchItem: String(oLockboxData.items.length + 1).padStart(4, "0"),
                            checkNumber: check["Check Number"],
                            checkAmount: check["Check Amount"],
                            invoiceNumber: invoice["Invoice Number"],
                            invoiceAmount: invoice["Invoice Amount"],
                            currency: invoice["Currency"] || "USD",
                            customerAccount: invoice["Customer Account"],
                            bankAccount: check["Bank Account"],
                            status: "Ready"
                        });
                    });
                });
            }
            
            return oLockboxData;
        },
        
        // ============================================================================
        // UPLOAD TAB HANDLERS
        // ============================================================================
        
        // Upload and process file - creates a new job
        onUploadAndProcessFile: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oFileUploader = this.byId("templateFileUploader");
            var oPendingFile = oModel.getProperty("/templateBuilder/pendingFile");
            
            if (!oPendingFile) {
                MessageBox.warning("Please select a file first");
                return;
            }
            
            BusyIndicator.show(0);
            
            // Generate unique Lockbox ID for this job
            var sLockboxId = "LB-" + Date.now().toString().slice(-8);
            var oConstantFields = oModel.getProperty("/templateBuilder/constantFields");
            
            // Create job object
            var oJob = {
                id: "JOB-" + Date.now(),
                filename: oPendingFile.name,
                fileType: oPendingFile.type,
                lockboxId: sLockboxId,
                records: 0,
                status: "PENDING",
                createdAt: new Date().toISOString(),
                totalAmount: 0,
                currency: "USD",
                constantFields: [
                    { field: "Lockbox", value: sLockboxId, source: "Auto-Generated" },
                    { field: "CompanyCode", value: oConstantFields.find(function(f) { return f.field === "CompanyCode"; })?.value || "1710", source: "System" },
                    { field: "Currency", value: oConstantFields.find(function(f) { return f.field === "Currency"; })?.value || "USD", source: "Default" },
                    { field: "LockboxBatchDestination", value: oConstantFields.find(function(f) { return f.field === "LockboxBatchDestination"; })?.value || "LOCKBOXDES", source: "System" },
                    { field: "LockboxBatchOrigin", value: oConstantFields.find(function(f) { return f.field === "LockboxBatchOrigin"; })?.value || "LOCKBOXORI", source: "System" },
                    { field: "PartnerBankCountry", value: oConstantFields.find(function(f) { return f.field === "PartnerBankCountry"; })?.value || "US", source: "Default" }
                ],
                extractedData: [],
                fieldMappings: [],
                mappingSummary: { mapped: 0, unmapped: 0, total: 0, avgConfidence: 0 }
            };
            
            // Simulate file processing (in real implementation, this would upload to server)
            setTimeout(function () {
                // Simulate extraction
                oJob.status = "EXTRACTED";
                oJob.records = Math.floor(Math.random() * 10) + 3; // At least 3 records
                oJob.totalAmount = (Math.random() * 50000 + 1000).toFixed(2);
                
                // Generate HIERARCHICAL lockbox data structure
                // Structure: Lockbox → Checks → Payment References (Invoices/BELNR)
                // Each Check has LockboxBatch (001) and LockboxBatchItem (001, 002, etc.)
                var oHierarchicalData = that._generateHierarchicalLockboxData(sLockboxId);
                oJob.hierarchicalData = oHierarchicalData;
                oJob.records = oHierarchicalData.totalRecords;
                oJob.totalAmount = oHierarchicalData.totalAmount;
                oJob.checkCount = oHierarchicalData.checkCount;
                oJob.lockboxBatch = oHierarchicalData.lockboxBatch;
                oJob.checkCount = oHierarchicalData.checkCount;
                
                // Also create flat extractedData for backward compatibility
                oJob.extractedData = [];
                oHierarchicalData.checks.forEach(function (check, checkIdx) {
                    check.invoices.forEach(function (invoice, invIdx) {
                        oJob.extractedData.push({
                            rowNum: oJob.extractedData.length + 1,
                            checkNumber: check["Check Number"],
                            "Invoice Number": invoice["Invoice Number"],
                            "Invoice Amount": invoice["Invoice Amount"],
                            "Check Amount": check["Check Amount"],
                            "Currency": invoice["Currency"],
                            "Bank Account": check["Bank Account"],
                            "Customer Account": invoice["Customer Account"],
                            validationStatus: "VALID"
                        });
                    });
                });
                
                // AUTO FIELD MAPPING - Apply Smart Mapping rules with CORRECT mappings
                // Customer fields shown AS-IS, mapped to correct API fields
                var aSourceFields = [
                    { name: "Invoice Number", sample: "INV-900123", description: "Customer Invoice/BELNR" },
                    { name: "Invoice Amount", sample: "1234.56", description: "Invoice payment amount" },
                    { name: "Check Number", sample: "CHK-12345", description: "Bank check number" },
                    { name: "Check Amount", sample: "5678.90", description: "Total check amount" },
                    { name: "Currency", sample: "USD", description: "Payment currency" },
                    { name: "Bank Account", sample: "****1234", description: "Bank account number" },
                    { name: "Customer Account", sample: "CUST-0001", description: "Customer ID" },
                    { name: "Deposit Date", sample: "12/30/2024", description: "Deposit date" }
                ];
                
                // Apply correct field mappings based on SAP Lockbox API structure
                oJob.fieldMappings = [
                    { 
                        sourceField: "Invoice Number", 
                        sampleValue: "INV-900123",
                        apiField: "PaymentReference",
                        section: "PaymentRef",
                        confidence: 100,
                        matchedBy: "manual_rule",
                        description: "Invoice Number (BELNR) → PaymentReference"
                    },
                    { 
                        sourceField: "Invoice Amount", 
                        sampleValue: "1234.56",
                        apiField: "NetPaymentAmountInPaytCurrency",
                        section: "PaymentRef",
                        confidence: 100,
                        matchedBy: "manual_rule",
                        description: "Invoice Amount → NetPaymentAmount"
                    },
                    { 
                        sourceField: "Check Number", 
                        sampleValue: "CHK-12345",
                        apiField: "Cheque",
                        section: "Cheques",
                        confidence: 100,
                        matchedBy: "manual_rule",
                        description: "Check Number → Cheque"
                    },
                    { 
                        sourceField: "Check Amount", 
                        sampleValue: "5678.90",
                        apiField: "AmountInTransactionCurrency",
                        section: "Cheques",
                        confidence: 100,
                        matchedBy: "manual_rule",
                        description: "Check Amount → AmountInTransactionCurrency"
                    },
                    { 
                        sourceField: "Currency", 
                        sampleValue: "USD",
                        apiField: "Currency",
                        section: "Header",
                        confidence: 100,
                        matchedBy: "manual_rule",
                        description: "Currency → Currency"
                    },
                    { 
                        sourceField: "Bank Account", 
                        sampleValue: "****1234",
                        apiField: "PartnerBankAccount",
                        section: "Cheques",
                        confidence: 95,
                        matchedBy: "keyword_match",
                        description: "Bank Account → PartnerBankAccount"
                    },
                    { 
                        sourceField: "Customer Account", 
                        sampleValue: "CUST-0001",
                        apiField: "CustomerNumber",
                        section: "Custom",
                        confidence: 90,
                        matchedBy: "keyword_match",
                        description: "Customer Account → CustomerNumber"
                    },
                    { 
                        sourceField: "Deposit Date", 
                        sampleValue: "12/30/2024",
                        apiField: "DepositDateTime",
                        section: "Header",
                        confidence: 95,
                        matchedBy: "keyword_match",
                        description: "Deposit Date → DepositDateTime"
                    }
                ];
                
                oJob.mappingSummary = that._calculateMappingSummary(oJob.fieldMappings);
                
                // Run hierarchical validation
                var validationResult = that._validateHierarchicalData(oJob);
                oJob.validationResult = validationResult;
                if (validationResult.valid) {
                    oJob.status = "VALIDATED";
                } else {
                    oJob.status = "EXTRACTED";
                }
                
                // Add to jobs list
                var aJobs = oModel.getProperty("/templateBuilder/jobs") || [];
                aJobs.unshift(oJob);
                oModel.setProperty("/templateBuilder/jobs", aJobs);
                
                // Update recent jobs
                oModel.setProperty("/templateBuilder/recentJobs", aJobs.slice(0, 5));
                
                // Update validated jobs
                var aValidatedJobs = aJobs.filter(function (job) {
                    return job.status === "VALIDATED" || job.status === "EXTRACTED";
                });
                oModel.setProperty("/templateBuilder/validatedJobs", aValidatedJobs);
                
                // Update stats
                that._updateJobStats(aJobs);
                
                // Reset file uploader
                oFileUploader.clear();
                oModel.setProperty("/templateBuilder/fileSelected", false);
                oModel.setProperty("/templateBuilder/pendingFile", null);
                
                // Set as selected job to show mapping
                oModel.setProperty("/templateBuilder/selectedJob", oJob);
                
                BusyIndicator.hide();
                
                MessageBox.success(
                    "File uploaded and processed!\n\n" +
                    "Lockbox ID: " + sLockboxId + "\n" +
                    "Checks: " + oJob.checkCount + "\n" +
                    "Payment References (Invoices): " + oJob.records + "\n" +
                    "Total Amount: $" + oJob.totalAmount + "\n" +
                    "Fields Mapped: " + oJob.mappingSummary.mapped + "/" + oJob.mappingSummary.total + "\n" +
                    "Status: " + oJob.status,
                    {
                        title: "Upload & Mapping Complete",
                        onClose: function () {
                            // Switch to Extract tab to view results and mappings
                            var oTabBar = that.byId("templateBuilderTabBar");
                            if (oTabBar) {
                                oTabBar.setSelectedKey("extract");
                            }
                        }
                    }
                );
            }, 1500);
        },
        
        // Validate hierarchical lockbox data
        // Structure: Lockbox → Checks → Payment References (Invoices)
        _validateHierarchicalData: function (oJob) {
            var aErrors = [];
            var aWarnings = [];
            
            if (!oJob.hierarchicalData || !oJob.hierarchicalData.checks) {
                aErrors.push("No hierarchical data found");
                return { valid: false, errors: aErrors, warnings: aWarnings };
            }
            
            var aChecks = oJob.hierarchicalData.checks;
            
            // Validate each check
            aChecks.forEach(function (check, checkIdx) {
                var sCheckNum = check["Check Number"] || "Check " + (checkIdx + 1);
                
                // Check must have a check number
                if (!check["Check Number"]) {
                    aErrors.push(sCheckNum + ": Check Number is required");
                    check.validationStatus = "ERROR";
                }
                
                // Check must have amount
                if (!check["Check Amount"] || parseFloat(check["Check Amount"]) <= 0) {
                    aErrors.push(sCheckNum + ": Check Amount must be greater than 0");
                    check.validationStatus = "ERROR";
                }
                
                // Check must have at least one invoice
                if (!check.invoices || check.invoices.length === 0) {
                    aErrors.push(sCheckNum + ": At least one Invoice/Payment Reference is required");
                    check.validationStatus = "ERROR";
                }
                
                // Validate sum of invoice amounts matches check amount
                var invoiceTotal = 0;
                (check.invoices || []).forEach(function (invoice, invIdx) {
                    invoiceTotal += parseFloat(invoice["Invoice Amount"] || 0);
                    
                    // Each invoice must have invoice number
                    if (!invoice["Invoice Number"]) {
                        aWarnings.push(sCheckNum + " - Invoice " + (invIdx + 1) + ": Invoice Number (BELNR) is recommended");
                        if (invoice.validationStatus !== "ERROR") {
                            invoice.validationStatus = "WARNING";
                        }
                    }
                    
                    // Each invoice must have amount
                    if (!invoice["Invoice Amount"] || parseFloat(invoice["Invoice Amount"]) <= 0) {
                        aErrors.push(sCheckNum + " - Invoice " + (invIdx + 1) + ": Invoice Amount is required");
                        invoice.validationStatus = "ERROR";
                    }
                });
                
                // Warn if invoice total doesn't match check amount
                var checkAmount = parseFloat(check["Check Amount"] || 0);
                if (Math.abs(invoiceTotal - checkAmount) > 0.01) {
                    aWarnings.push(sCheckNum + ": Invoice total ($" + invoiceTotal.toFixed(2) + ") doesn't match Check Amount ($" + checkAmount.toFixed(2) + ")");
                }
                
                // Set check status based on invoices
                if (check.validationStatus !== "ERROR") {
                    var hasInvoiceError = (check.invoices || []).some(function(inv) { return inv.validationStatus === "ERROR"; });
                    check.validationStatus = hasInvoiceError ? "ERROR" : "VALID";
                }
            });
            
            return {
                valid: aErrors.length === 0,
                errors: aErrors,
                warnings: aWarnings,
                checkCount: aChecks.length,
                invoiceCount: oJob.records
            };
        },
        
        // Generate sample extracted data with realistic column names for demo
        _generateSampleExtractedDataWithColumns: function (nRecords, sLockboxId) {
            var aData = [];
            for (var i = 0; i < nRecords; i++) {
                aData.push({
                    rowNum: i + 1,
                    "Check Number": "CHK-" + (10000 + Math.floor(Math.random() * 90000)),
                    "Payment Amount": (Math.random() * 5000 + 100).toFixed(2),
                    "Currency Code": "USD",
                    "Bank Account No": "****" + Math.floor(Math.random() * 9000 + 1000),
                    "Payment Reference": "REF-" + (100000 + Math.floor(Math.random() * 900000)),
                    "Deposit Date": "12/" + (Math.floor(Math.random() * 28) + 1) + "/2024",
                    "Customer ID": "CUST-" + String(Math.floor(Math.random() * 1000)).padStart(3, "0"),
                    // Also keep the normalized field names for backward compatibility
                    cheque: "CHK-" + (10000 + Math.floor(Math.random() * 90000)),
                    amount: (Math.random() * 5000 + 100).toFixed(2),
                    currency: "USD",
                    bankAccount: "****" + Math.floor(Math.random() * 9000 + 1000),
                    paymentReference: "REF-" + (100000 + Math.floor(Math.random() * 900000)),
                    validationStatus: "VALID"
                });
            }
            return aData;
        },
        
        // Generate sample extracted data for demo - OLD FORMAT (keeping for backward compatibility)
        _generateSampleExtractedData: function (nRecords, sLockboxId) {
            var aData = [];
            for (var i = 0; i < nRecords; i++) {
                aData.push({
                    rowNum: i + 1,
                    cheque: "CHK-" + (10000 + Math.floor(Math.random() * 90000)),
                    amount: (Math.random() * 5000 + 100).toFixed(2),
                    currency: "USD",
                    bankAccount: "****" + Math.floor(Math.random() * 9000 + 1000),
                    paymentReference: "REF-" + (100000 + Math.floor(Math.random() * 900000)),
                    validationStatus: "VALID"
                });
            }
            return aData;
        },
        
        // Generate hierarchical lockbox data structure
        // Structure: Lockbox → Checks → Payment References (Invoices)
        // Each Check has LockboxBatch (001) and LockboxBatchItem (001, 002, etc.)
        _generateHierarchicalLockboxData: function (sLockboxId) {
            var nChecks = Math.floor(Math.random() * 3) + 2; // 2-4 checks
            var aChecks = [];
            var nTotalRecords = 0;
            var nTotalAmount = 0;
            var sLockboxBatch = "001"; // Default batch number
            
            for (var c = 0; c < nChecks; c++) {
                var sCheckNumber = "CHK-" + (10000 + Math.floor(Math.random() * 90000));
                var nCheckAmount = 0;
                var nInvoices = Math.floor(Math.random() * 3) + 1; // 1-3 invoices per check
                var aInvoices = [];
                
                // Generate LockboxBatchItem for this check (3 digits: 001, 002, 003, etc.)
                var sLockboxBatchItem = String(c + 1).padStart(3, "0");
                
                for (var i = 0; i < nInvoices; i++) {
                    var invoiceAmount = parseFloat((Math.random() * 2000 + 100).toFixed(2));
                    nCheckAmount += invoiceAmount;
                    
                    aInvoices.push({
                        "Invoice Number": "INV-" + (900000 + Math.floor(Math.random() * 99999)),
                        "Invoice Amount": invoiceAmount.toFixed(2),
                        "Currency": "USD",
                        "Customer Account": "CUST-" + String(Math.floor(Math.random() * 1000)).padStart(4, "0"),
                        // Mapped API fields
                        _apiField_PaymentReference: "INV-" + (900000 + Math.floor(Math.random() * 99999)),
                        _apiField_NetPaymentAmount: invoiceAmount.toFixed(2),
                        validationStatus: "VALID"
                    });
                    nTotalRecords++;
                }
                
                nTotalAmount += nCheckAmount;
                
                aChecks.push({
                    "Check Number": sCheckNumber,
                    "Check Amount": nCheckAmount.toFixed(2),
                    "Bank Account": "****" + Math.floor(Math.random() * 9000 + 1000),
                    "Bank Routing": "0" + Math.floor(Math.random() * 90000000 + 10000000),
                    "Deposit Date": new Date().toLocaleDateString(),
                    // System-generated LockboxBatch and LockboxBatchItem
                    "LockboxBatch": sLockboxBatch,
                    "LockboxBatchItem": sLockboxBatchItem,
                    "BatchItemDisplay": sLockboxBatch + "/" + sLockboxBatchItem, // Display format: 001/001
                    // Mapped API fields
                    _apiField_Cheque: sCheckNumber,
                    _apiField_Amount: nCheckAmount.toFixed(2),
                    _apiField_PartnerBankAccount: "****" + Math.floor(Math.random() * 9000 + 1000),
                    _apiField_LockboxBatch: sLockboxBatch,
                    _apiField_LockboxBatchItem: sLockboxBatchItem,
                    invoices: aInvoices,
                    invoiceCount: nInvoices,
                    expanded: false,
                    validationStatus: "VALID"
                });
            }
            
            return {
                checks: aChecks,
                checkCount: nChecks,
                totalRecords: nTotalRecords,
                totalAmount: nTotalAmount.toFixed(2),
                lockboxBatch: sLockboxBatch
            };
        },
        
        // Validate job data against rules
        _validateJobData: function (oJob) {
            var oModel = this.getOwnerComponent().getModel("app");
            var aRules = oModel.getProperty("/templateBuilder/validationRules/rules") || [];
            var aErrors = [];
            var aWarnings = [];
            
            // Check each extracted record
            (oJob.extractedData || []).forEach(function (record, idx) {
                aRules.forEach(function (rule) {
                    var fieldValue = record[rule.field.toLowerCase()] || record[rule.field];
                    
                    if (rule.condition.includes("required") && !fieldValue) {
                        if (rule.type === "error") {
                            aErrors.push("Row " + (idx + 1) + ": " + rule.name);
                            record.validationStatus = "ERROR";
                        } else {
                            aWarnings.push("Row " + (idx + 1) + ": " + rule.name);
                            if (record.validationStatus !== "ERROR") {
                                record.validationStatus = "WARNING";
                            }
                        }
                    }
                });
            });
            
            return {
                valid: aErrors.length === 0,
                errors: aErrors,
                warnings: aWarnings
            };
        },
        
        // ============================================================================
        // EXTRACT TAB HANDLERS
        // ============================================================================
        
        // Refresh jobs list
        onRefreshJobs: function () {
            this._loadJobs();
            MessageToast.show("Jobs refreshed");
        },
        
        // Job search
        onJobSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("query");
            this._filterJobs(sQuery);
        },
        
        onJobSearchLive: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue");
            this._filterJobs(sQuery);
        },
        
        // Job status filter change
        onJobStatusFilterChange: function (oEvent) {
            var sStatus = oEvent.getParameter("selectedItem").getKey();
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/templateBuilder/filters/status", sStatus);
            this._filterJobs();
        },
        
        // Filter jobs based on search and status
        _filterJobs: function (sSearchQuery) {
            var oModel = this.getOwnerComponent().getModel("app");
            var aAllJobs = oModel.getProperty("/templateBuilder/jobs") || [];
            var sStatusFilter = oModel.getProperty("/templateBuilder/filters/status");
            var sSearch = sSearchQuery || oModel.getProperty("/templateBuilder/filters/search") || "";
            
            var aFilteredJobs = aAllJobs.filter(function (job) {
                var bMatchesStatus = !sStatusFilter || job.status === sStatusFilter;
                var bMatchesSearch = !sSearch || 
                    job.filename.toLowerCase().includes(sSearch.toLowerCase()) ||
                    job.lockboxId.toLowerCase().includes(sSearch.toLowerCase()) ||
                    job.id.toLowerCase().includes(sSearch.toLowerCase());
                return bMatchesStatus && bMatchesSearch;
            });
            
            // Update the binding (in real app, would use filter binding)
            // For now, just refresh
        },
        
        // Job row selection
        onJobSelect: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem) {
                var oContext = oSelectedItem.getBindingContext("app");
                var oJob = oContext.getObject();
                var oModel = this.getOwnerComponent().getModel("app");
                oModel.setProperty("/templateBuilder/selectedJob", oJob);
            }
        },
        
        // Job row press (navigation)
        onJobRowPress: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("app");
            var oJob = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/templateBuilder/selectedJob", oJob);
            
            // Switch to Extract tab if not already there
            var oTabBar = this.byId("templateBuilderTabBar");
            if (oTabBar && oTabBar.getSelectedKey() !== "extract") {
                oTabBar.setSelectedKey("extract");
            }
        },
        
        // View job details
        onViewJobDetails: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oJob = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/templateBuilder/selectedJob", oJob);
            MessageToast.show("Viewing: " + oJob.filename);
        },
        
        // Delete job
        onDeleteJob: function (oEvent) {
            var that = this;
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oJob = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            MessageBox.confirm("Are you sure you want to delete job '" + oJob.filename + "'?", {
                title: "Confirm Delete",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aJobs = oModel.getProperty("/templateBuilder/jobs") || [];
                        var nIndex = aJobs.findIndex(function (j) { return j.id === oJob.id; });
                        if (nIndex >= 0) {
                            aJobs.splice(nIndex, 1);
                            oModel.setProperty("/templateBuilder/jobs", aJobs);
                            oModel.setProperty("/templateBuilder/recentJobs", aJobs.slice(0, 5));
                            that._updateJobStats(aJobs);
                            oModel.setProperty("/templateBuilder/selectedJob", null);
                            MessageToast.show("Job deleted");
                        }
                    }
                }
            });
        },
        
        // ============================================================================
        // VALIDATION TAB HANDLERS
        // ============================================================================
        
        // Add validation rule (placeholder for future)
        onAddValidationRule: function () {
            MessageToast.show("Custom validation rules coming soon!");
        },
        
        // ============================================================================
        // AUTO VALIDATION TAB HANDLERS (Final Field Mapping)
        // ============================================================================
        
        // Select job for mapping preview
        onMappingJobSelect: function (oEvent) {
            var sJobId = oEvent.getParameter("selectedItem").getKey();
            var oModel = this.getOwnerComponent().getModel("app");
            
            if (!sJobId) {
                oModel.setProperty("/autoValidation/fieldMappings", []);
                oModel.setProperty("/autoValidation/lockboxPreview", []);
                return;
            }
            
            var aJobs = oModel.getProperty("/templateBuilder/jobs") || [];
            var oJob = aJobs.find(function(j) { return j.id === sJobId; });
            
            if (oJob) {
                oModel.setProperty("/autoValidation/selectedJobId", sJobId);
                this._buildFieldMappings(oJob);
                this._buildLockboxPreview(oJob);
            }
        },
        
        // Refresh mapping data
        onRefreshMapping: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var sJobId = oModel.getProperty("/autoValidation/selectedJobId");
            
            if (sJobId) {
                var aJobs = oModel.getProperty("/templateBuilder/jobs") || [];
                var oJob = aJobs.find(function(j) { return j.id === sJobId; });
                if (oJob) {
                    this._buildFieldMappings(oJob);
                    this._buildLockboxPreview(oJob);
                    MessageToast.show("Mapping refreshed");
                }
            } else {
                MessageToast.show("Please select a job first");
            }
        },
        
        // Go to Lockbox Transaction with hierarchical data and run auto-processing
        onGoToLockboxTransaction: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var sJobId = oModel.getProperty("/autoValidation/selectedJobId");
            var aLockboxPreview = oModel.getProperty("/autoValidation/lockboxPreview") || [];
            
            if (!sJobId || aLockboxPreview.length === 0) {
                MessageBox.warning("Please select a job with valid lockbox data first");
                return;
            }
            
            MessageBox.confirm("Run auto-processing pipeline (Extract → Validate → Simulate) and transfer to Lockbox Transaction?", {
                title: "Auto-Process and Transfer",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aJobs = oModel.getProperty("/templateBuilder/jobs") || [];
                        var oJob = aJobs.find(function(j) { return j.id === sJobId; });
                        
                        if (oJob) {
                            // Run the auto-processing pipeline
                            that._runAutoProcessingPipeline(oJob);
                        } else {
                            MessageBox.error("Job not found");
                        }
                    }
                }
            });
        },
        
        // Run auto-processing pipeline: Extract → Validate → Simulate
        _runAutoProcessingPipeline: function (oJob) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Show busy indicator
            sap.ui.core.BusyIndicator.show(0);
            
            // Initialize processing stages
            var oProcessingStages = {
                extract: "In Progress",
                validate: "Pending",
                simulate: "Pending"
            };
            
            MessageToast.show("Starting auto-processing pipeline...");
            
            // Stage 1: Extract
            setTimeout(function() {
                try {
                    // Simulate extract processing
                    oProcessingStages.extract = "Success";
                    oProcessingStages.validate = "In Progress";
                    MessageToast.show("Extract completed. Running validation...");
                    
                    // Stage 2: Validate (based on Rule Engine)
                    setTimeout(function() {
                        try {
                            // Apply validation rules from Rule Engine
                            var aValidationRules = oModel.getProperty("/ruleEngine/validationRules") || [];
                            var bValidationPassed = that._applyValidationRules(oJob, aValidationRules);
                            
                            if (bValidationPassed) {
                                oProcessingStages.validate = "Success";
                            } else {
                                oProcessingStages.validate = "Warning";
                            }
                            oProcessingStages.simulate = "In Progress";
                            MessageToast.show("Validation completed. Running simulation...");
                            
                            // Stage 3: Simulate
                            setTimeout(function() {
                                try {
                                    // Simulate the data
                                    var bSimulationPassed = that._runSimulationForJob(oJob);
                                    
                                    if (bSimulationPassed) {
                                        oProcessingStages.simulate = "Success";
                                    } else {
                                        oProcessingStages.simulate = "Error";
                                    }
                                    
                                    // Build hierarchical data with processing stages
                                    var aHierarchicalData = that._buildProcessedHierarchicalData(oJob, oProcessingStages);
                                    
                                    // Transfer to Lockbox Transaction
                                    oModel.setProperty("/lockboxTransactionData", aHierarchicalData);
                                    oModel.setProperty("/selectedLockboxId", oJob.lockboxId || "LBX-" + Date.now());
                                    oModel.setProperty("/treeData", aHierarchicalData);
                                    
                                    // Navigate to Lockbox Transaction
                                    that._showLockboxTransaction();
                                    
                                    sap.ui.core.BusyIndicator.hide();
                                    
                                    var sMessage = oProcessingStages.simulate === "Success" 
                                        ? "Auto-processing completed successfully!" 
                                        : "Auto-processing completed with errors. Check Processing Flow column.";
                                    MessageToast.show(sMessage);
                                    
                                } catch (e) {
                                    oProcessingStages.simulate = "Error";
                                    sap.ui.core.BusyIndicator.hide();
                                    MessageBox.error("Simulation failed: " + e.message);
                                }
                            }, 800);
                            
                        } catch (e) {
                            oProcessingStages.validate = "Error";
                            oProcessingStages.simulate = "Pending";
                            sap.ui.core.BusyIndicator.hide();
                            MessageBox.error("Validation failed: " + e.message);
                        }
                    }, 800);
                    
                } catch (e) {
                    oProcessingStages.extract = "Error";
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("Extract failed: " + e.message);
                }
            }, 500);
        },
        
        // Apply validation rules from Rule Engine
        _applyValidationRules: function (oJob, aValidationRules) {
            var bAllPassed = true;
            var aEnabledRules = aValidationRules.filter(function(r) { return r.enabled; });
            
            // Simulate validation against rules
            aEnabledRules.forEach(function(rule) {
                // In real implementation, would validate actual data
                // For now, simulate with 90% success rate
                if (Math.random() < 0.1 && rule.severity === "error") {
                    bAllPassed = false;
                }
            });
            
            return bAllPassed;
        },
        
        // Run simulation for job
        _runSimulationForJob: function (oJob) {
            // Simulate simulation processing
            // In real implementation, would call SAP API
            // For now, simulate with 95% success rate
            return Math.random() > 0.05;
        },
        
        // Build processed hierarchical data with processing stages
        _buildProcessedHierarchicalData: function (oJob, oParentStages) {
            var aTreeData = [];
            
            // Use existing hierarchical data or generate sample
            var aSourceData = oJob.hierarchicalData || this._generateSampleHierarchicalData(oJob);
            
            aSourceData.forEach(function(lockbox, lIdx) {
                // Determine lockbox-level processing result
                var oLockboxStages = Object.assign({}, oParentStages);
                
                var oLockboxNode = {
                    id: lockbox.id || ("lbx-" + (lIdx + 1)),
                    type: "HEADER",
                    displayText: lockbox.lockboxId || ("Lockbox " + (lIdx + 1)),
                    deposit_datetime: lockbox.depositDateTime || new Date().toISOString(),
                    amount: lockbox.totalAmount || 0,
                    currency: lockbox.currency || "USD",
                    status: oLockboxStages.simulate === "Success" ? "Ready" : "Error",
                    processingFlow: oLockboxStages.simulate === "Success" ? "Completed" : "Error",
                    processingStages: oLockboxStages,
                    ar_posting_doc: "",
                    payment_advice_doc: "",
                    on_account_doc: "",
                    clearing_doc: "",
                    children: []
                };
                
                // Process checks
                var aChecks = lockbox.checks || [];
                aChecks.forEach(function(check, cIdx) {
                    // Randomly assign some errors to show mixed results
                    var bCheckError = Math.random() < 0.1;
                    var oCheckStages = {
                        extract: oParentStages.extract,
                        validate: bCheckError ? "Error" : oParentStages.validate,
                        simulate: bCheckError ? "Error" : oParentStages.simulate
                    };
                    
                    var oCheckNode = {
                        id: check.id || ("chk-" + lIdx + "-" + cIdx),
                        type: "CHEQUE",
                        displayText: "Cheque: " + (check.Cheque || check.chequeNumber || ("CHK" + (cIdx + 1))),
                        deposit_datetime: "",
                        amount: check.AmountInTransactionCurrency || check.amount || 0,
                        currency: check.Currency || lockbox.currency || "USD",
                        status: bCheckError ? "Error" : "Ready",
                        processingFlow: bCheckError ? "Error" : "Completed",
                        processingStages: oCheckStages,
                        ar_posting_doc: "",
                        payment_advice_doc: "",
                        on_account_doc: "",
                        clearing_doc: "",
                        children: []
                    };
                    
                    // Process invoices/payment references
                    var aInvoices = check.invoices || [];
                    aInvoices.forEach(function(invoice, iIdx) {
                        var bInvError = bCheckError || Math.random() < 0.05;
                        var oInvStages = {
                            extract: oParentStages.extract,
                            validate: bInvError ? "Error" : oParentStages.validate,
                            simulate: bInvError ? "Error" : oParentStages.simulate
                        };
                        
                        var oInvoiceNode = {
                            id: invoice.id || ("inv-" + lIdx + "-" + cIdx + "-" + iIdx),
                            type: "PAYMENT_REF",
                            displayText: "Ref: " + (invoice.PaymentReference || invoice.invoiceNumber || ("INV" + (iIdx + 1))),
                            deposit_datetime: "",
                            amount: invoice.NetPaymentAmountInPaytCurrency || invoice.amount || 0,
                            currency: invoice.Currency || check.Currency || "USD",
                            status: bInvError ? "Error" : "Ready",
                            processingFlow: bInvError ? "Error" : "Completed",
                            processingStages: oInvStages,
                            ar_posting_doc: "",
                            payment_advice_doc: "",
                            on_account_doc: "",
                            clearing_doc: "",
                            children: []
                        };
                        
                        oCheckNode.children.push(oInvoiceNode);
                    });
                    
                    oLockboxNode.children.push(oCheckNode);
                });
                
                aTreeData.push(oLockboxNode);
            });
            
            return aTreeData;
        },
        
        // Generate sample hierarchical data if none exists
        _generateSampleHierarchicalData: function (oJob) {
            return [{
                id: "lbx-1",
                lockboxId: oJob.lockboxId || "LBX-001",
                depositDateTime: new Date().toISOString(),
                totalAmount: 4800,
                currency: "USD",
                checks: [
                    {
                        id: "chk-1",
                        Cheque: "345666",
                        AmountInTransactionCurrency: 1300,
                        Currency: "USD",
                        invoices: [
                            { id: "inv-1", PaymentReference: "90000001", NetPaymentAmountInPaytCurrency: 800 },
                            { id: "inv-2", PaymentReference: "90000005", NetPaymentAmountInPaytCurrency: 500 }
                        ]
                    },
                    {
                        id: "chk-2",
                        Cheque: "335556",
                        AmountInTransactionCurrency: 1500,
                        Currency: "USD",
                        invoices: [
                            { id: "inv-3", PaymentReference: "90000006", NetPaymentAmountInPaytCurrency: 750 },
                            { id: "inv-4", PaymentReference: "90000007", NetPaymentAmountInPaytCurrency: 750 }
                        ]
                    },
                    {
                        id: "chk-3",
                        Cheque: "3434566",
                        AmountInTransactionCurrency: 2000,
                        Currency: "USD",
                        invoices: [
                            { id: "inv-5", PaymentReference: "95015001", NetPaymentAmountInPaytCurrency: 2000 }
                        ]
                    }
                ]
            }];
        },
        
        // Build field mappings from job data
        _buildFieldMappings: function (oJob) {
            var oModel = this.getOwnerComponent().getModel("app");
            var aMappingRules = oModel.getProperty("/ruleEngine/mappingRules") || [];
            var aFieldMappings = [];
            
            // Get customer fields from job (if available)
            var aCustomerFields = oJob.customerFields || ["Invoice Number", "Invoice Amount", "Check Number", "Check Amount", "Date", "Currency", "Bank Account"];
            
            aCustomerFields.forEach(function(customerField) {
                // Find matching rule
                var matchedRule = aMappingRules.find(function(rule) {
                    return rule.enabled && rule.keywords.toLowerCase().includes(customerField.toLowerCase());
                });
                
                aFieldMappings.push({
                    customerField: customerField,
                    apiField: matchedRule ? matchedRule.apiField : "(Not Mapped)",
                    section: matchedRule ? matchedRule.section : "N/A",
                    status: matchedRule ? "Mapped" : "Warning",
                    sampleValue: oJob.sampleValues ? oJob.sampleValues[customerField] : "N/A"
                });
            });
            
            oModel.setProperty("/autoValidation/fieldMappings", aFieldMappings);
            
            // Update stats
            var mappedCount = aFieldMappings.filter(function(m) { return m.status === "Mapped"; }).length;
            oModel.setProperty("/autoValidation/stats", {
                mappedFields: mappedCount,
                unmappedFields: aFieldMappings.length - mappedCount,
                totalRecords: oJob.records || 0,
                validationStatus: mappedCount === aFieldMappings.length ? "Valid" : "Needs Review"
            });
        },
        
        // Build lockbox preview from job hierarchical data
        _buildLockboxPreview: function (oJob) {
            var oModel = this.getOwnerComponent().getModel("app");
            var aPreview = [];
            
            if (oJob.hierarchicalData && oJob.hierarchicalData.length > 0) {
                oJob.hierarchicalData.forEach(function(lockbox, lIdx) {
                    if (lockbox.checks && lockbox.checks.length > 0) {
                        lockbox.checks.forEach(function(check, cIdx) {
                            aPreview.push({
                                lockboxId: lockbox.lockboxId || ("LBX-" + (lIdx + 1)),
                                batchItem: lockbox.batchNumber + "/" + check.batchItemNumber,
                                cheque: check.Cheque || "N/A",
                                amount: check.AmountInTransactionCurrency || 0,
                                currency: check.Currency || "USD",
                                invoiceCount: check.invoices ? check.invoices.length : 0,
                                status: "Ready"
                            });
                        });
                    }
                });
            } else {
                // Generate sample preview if no hierarchical data
                aPreview = [
                    { lockboxId: oJob.lockboxId || "LBX-001", batchItem: "001/001", cheque: "345666", amount: 1300, currency: "USD", invoiceCount: 2, status: "Ready" },
                    { lockboxId: oJob.lockboxId || "LBX-001", batchItem: "001/002", cheque: "335556", amount: 1500, currency: "USD", invoiceCount: 3, status: "Ready" },
                    { lockboxId: oJob.lockboxId || "LBX-001", batchItem: "001/003", cheque: "3434566", amount: 2000, currency: "USD", invoiceCount: 1, status: "Ready" }
                ];
            }
            
            oModel.setProperty("/autoValidation/lockboxPreview", aPreview);
        },
        
        // ============================================================================
        // SIMULATION TAB HANDLERS
        // ============================================================================
        
        // Select job for simulation
        onSimulationJobSelect: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem) {
                var oContext = oSelectedItem.getBindingContext("app");
                var oJob = oContext.getObject();
                var oModel = this.getOwnerComponent().getModel("app");
                
                // Build payload preview
                var oPayload = this._buildSimulationPayload(oJob);
                oJob.payloadPreview = JSON.stringify(oPayload, null, 2);
                
                oModel.setProperty("/templateBuilder/simulationJob", oJob);
                oModel.setProperty("/templateBuilder/simulationResult", null);
            }
        },
        
        // Run simulation from table button
        onRunSimulation: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oJob = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Build payload preview
            var oPayload = this._buildSimulationPayload(oJob);
            oJob.payloadPreview = JSON.stringify(oPayload, null, 2);
            
            oModel.setProperty("/templateBuilder/simulationJob", oJob);
            this.onExecuteSimulation();
        },
        
        // Execute simulation
        onExecuteSimulation: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oJob = oModel.getProperty("/templateBuilder/simulationJob");
            
            if (!oJob) {
                MessageBox.warning("Please select a job to simulate");
                return;
            }
            
            BusyIndicator.show(0);
            
            // Build payload
            var oPayload = this._buildSimulationPayload(oJob);
            
            // Call simulation API
            fetch(API_BASE + "/lockbox/simulate-test", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(oPayload)
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                BusyIndicator.hide();
                
                var oResult = {
                    success: data.success,
                    lockbox: oJob.lockboxId,
                    companyCode: "1710",
                    itemCount: oJob.records,
                    totalAmount: oJob.totalAmount,
                    currency: oJob.currency || "USD",
                    errors: data.success ? [] : [{ message: data.message || "Simulation failed" }]
                };
                
                oModel.setProperty("/templateBuilder/simulationResult", oResult);
                
                if (data.success) {
                    // Update job status
                    oJob.status = "SIMULATED";
                    var aJobs = oModel.getProperty("/templateBuilder/jobs") || [];
                    var nIndex = aJobs.findIndex(function (j) { return j.id === oJob.id; });
                    if (nIndex >= 0) {
                        aJobs[nIndex] = oJob;
                        oModel.setProperty("/templateBuilder/jobs", aJobs);
                        that._updateJobStats(aJobs);
                    }
                    
                    MessageBox.success("Simulation successful!\n\nData is ready for Production Run in Lockbox Transaction.", {
                        title: "Simulation Complete"
                    });
                } else {
                    MessageBox.error("Simulation failed:\n\n" + (data.message || "Unknown error"), {
                        title: "Simulation Failed"
                    });
                }
            })
            .catch(function (error) {
                BusyIndicator.hide();
                oModel.setProperty("/templateBuilder/simulationResult", {
                    success: false,
                    errors: [{ message: error.message }]
                });
                MessageBox.error("Simulation error: " + error.message);
            });
        },
        
        // Build simulation payload from job
        _buildSimulationPayload: function (oJob) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oConstantFields = oModel.getProperty("/templateBuilder/constantFields") || [];
            
            // Get constant field values
            var getConstantValue = function (fieldName, defaultValue) {
                var field = oConstantFields.find(function (f) { return f.field === fieldName; });
                return field ? field.value : defaultValue;
            };
            
            // Build header
            var oPayload = {
                Lockbox: oJob.lockboxId,
                CompanyCode: getConstantValue("CompanyCode", "1710"),
                DepositDateTime: new Date().toISOString(),
                AmountInTransactionCurrency: oJob.totalAmount || "1000.00",
                LockboxBatchOrigin: "LOCKBOXORI",
                LockboxBatchDestination: getConstantValue("LockboxBatchDestination", "LOCKBOXDES"),
                to_Item: {
                    results: []
                }
            };
            
            // Build items from extracted data
            var currency = getConstantValue("Currency", "USD");
            (oJob.extractedData || []).forEach(function (record, idx) {
                var oItem = {
                    LockboxBatch: getConstantValue("LockboxBatch", "001"),
                    LockboxBatchItem: String(idx + 1).padStart(4, "0"),
                    AmountInTransactionCurrency: record.amount || "100.00",
                    Currency: currency,
                    Cheque: record.cheque || ("CHK-" + (idx + 1)),
                    PartnerBank: "BANK",
                    PartnerBankAccount: record.bankAccount ? record.bankAccount.replace(/\*/g, "1") : "123456789",
                    PartnerBankCountry: "US",
                    to_PaymentReference: {
                        results: [
                            {
                                PaymentReference: record.paymentReference || ("REF-" + (idx + 1)),
                                NetPaymentAmountInPaytCurrency: record.amount || "100.00",
                                DeductionAmountInPaytCurrency: "0.00",
                                PaymentDifferenceReason: "",
                                Currency: currency
                            }
                        ]
                    }
                };
                oPayload.to_Item.results.push(oItem);
            });
            
            return oPayload;
        },
        
        // Proceed to Lockbox Transaction after successful simulation
        onProceedToLockbox: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oJob = oModel.getProperty("/templateBuilder/simulationJob");
            
            MessageBox.information(
                "Job '" + oJob.filename + "' is ready for Production Run.\n\n" +
                "Lockbox ID: " + oJob.lockboxId + "\n\n" +
                "Navigate to Lockbox Transaction to process this file.",
                {
                    title: "Ready for Production",
                    onClose: function () {
                        // Navigate to Lockbox Transaction
                        oModel.setProperty("/showHome", false);
                        oModel.setProperty("/showConfig", false);
                        oModel.setProperty("/showTemplateBuilder", false);
                        oModel.setProperty("/showLockbox", true);
                        oModel.setProperty("/showNavButton", true);
                        oModel.setProperty("/currentView", "lockbox");
                    }
                }
            );
        },
        
        // Template file selection changed
        onTemplateFileChange: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oFileUploader = oEvent.getSource();
            var sFileName = oEvent.getParameter("newValue");
            
            oModel.setProperty("/templateBuilder/fileSelected", !!sFileName);
            
            if (sFileName) {
                // Store file info
                var sFileType = this._getFileType(sFileName);
                oModel.setProperty("/templateBuilder/pendingFile", {
                    name: sFileName,
                    type: sFileType
                });
            }
        },
        
        // Get file type from filename
        _getFileType: function (sFileName) {
            var sExt = sFileName.split('.').pop().toLowerCase();
            switch (sExt) {
                case 'pdf': return 'PDF';
                case 'xlsx': 
                case 'xls': return 'Excel';
                case 'bai2':
                case 'bai':
                case 'txt': return 'BAI2';
                default: return 'Unknown';
            }
        },
        
        // Format file type icon
        formatFileTypeIcon: function (sFileType) {
            switch (sFileType) {
                case 'PDF': return 'sap-icon://pdf-attachment';
                case 'Excel': return 'sap-icon://excel-attachment';
                case 'BAI2': return 'sap-icon://document-text';
                default: return 'sap-icon://document';
            }
        },
        
        // File type mismatch handler
        onTemplateTypeMismatch: function (oEvent) {
            var sFileName = oEvent.getParameter("fileName");
            var aFileTypes = oEvent.getParameter("fileType");
            MessageBox.error("File type not supported: " + sFileName + "\n\nSupported types: " + aFileTypes.join(", "));
        },
        
        // Upload template file
        onUploadTemplateFile: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oFileUploader = this.byId("templateFileUploader");
            var oPendingFile = oModel.getProperty("/templateBuilder/pendingFile");
            
            if (!oPendingFile) {
                MessageBox.warning("Please select a file first");
                return;
            }
            
            BusyIndicator.show(0);
            
            // Simulate file upload (in real implementation, this would upload to server)
            setTimeout(function () {
                BusyIndicator.hide();
                
                // Store uploaded file info
                var oUploadedFile = {
                    name: oPendingFile.name,
                    type: oPendingFile.type,
                    size: Math.floor(Math.random() * 100 + 10) + " KB",
                    uploadedAt: new Date().toISOString()
                };
                
                oModel.setProperty("/templateBuilder/uploadedFile", oUploadedFile);
                oModel.setProperty("/templateBuilder/extractedFields", []);
                oModel.setProperty("/templateBuilder/fieldMappings", []);
                
                MessageToast.show("File uploaded successfully: " + oPendingFile.name);
            }, 1000);
        },
        
        // Quick Test Demo - Simulates the complete flow for testing
        onQuickTestDemo: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            BusyIndicator.show(0);
            
            // Simulate file upload
            var oUploadedFile = {
                name: "Cheque_Invoice_Template.xlsx",
                type: "Excel",
                size: "15 KB",
                uploadedAt: new Date().toISOString()
            };
            
            oModel.setProperty("/templateBuilder/uploadedFile", oUploadedFile);
            oModel.setProperty("/templateBuilder/fileSelected", true);
            
            // Simulate field extraction
            setTimeout(function () {
                var aExtractedFields = that._simulateFieldExtraction("Excel");
                var aFieldMappings = that._generateFieldMappings(aExtractedFields);
                
                oModel.setProperty("/templateBuilder/extractedFields", aExtractedFields);
                oModel.setProperty("/templateBuilder/fieldMappings", aFieldMappings);
                
                BusyIndicator.hide();
                MessageToast.show("Demo: " + aExtractedFields.length + " fields extracted from Excel template");
            }, 1000);
        },
        
        // Extract fields from uploaded template
        onExtractFields: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oUploadedFile = oModel.getProperty("/templateBuilder/uploadedFile");
            
            if (!oUploadedFile) {
                MessageBox.warning("Please upload a file first");
                return;
            }
            
            BusyIndicator.show(0);
            
            // Simulate field extraction based on file type
            // In real implementation, this would call AI or parsing service
            setTimeout(function () {
                BusyIndicator.hide();
                
                var aExtractedFields = that._simulateFieldExtraction(oUploadedFile.type);
                var aFieldMappings = that._generateFieldMappings(aExtractedFields);
                
                oModel.setProperty("/templateBuilder/extractedFields", aExtractedFields);
                oModel.setProperty("/templateBuilder/fieldMappings", aFieldMappings);
                
                MessageToast.show(aExtractedFields.length + " fields extracted from template");
            }, 1500);
        },
        
        // Simulate field extraction based on file type (will be replaced with AI later)
        _simulateFieldExtraction: function (sFileType) {
            // Common lockbox fields that would be extracted from templates
            var aCommonFields = [];
            
            if (sFileType === 'Excel') {
                // Excel typically has structured columns
                aCommonFields = [
                    { fieldName: "Customer Number", sampleValue: "100234", detectedType: "text" },
                    { fieldName: "Cheque Number", sampleValue: "CHK-78901", detectedType: "text" },
                    { fieldName: "Amount", sampleValue: "1,500.00", detectedType: "currency" },
                    { fieldName: "Payment Date", sampleValue: "2025-01-15", detectedType: "date" },
                    { fieldName: "Bank Account", sampleValue: "****5678", detectedType: "text" },
                    { fieldName: "Invoice Number", sampleValue: "90004206, 207, 208, 209", detectedType: "text", hasMultipleValues: true }
                ];
            } else if (sFileType === 'BAI2') {
                // BAI2 has specific banking fields
                aCommonFields = [
                    { fieldName: "Account Number", sampleValue: "123456789", detectedType: "text" },
                    { fieldName: "Transaction Code", sampleValue: "115", detectedType: "text" },
                    { fieldName: "Amount", sampleValue: "25000.00", detectedType: "currency" },
                    { fieldName: "Bank Reference", sampleValue: "REF123456", detectedType: "text" },
                    { fieldName: "Customer Reference", sampleValue: "CUST-001", detectedType: "text" },
                    { fieldName: "Value Date", sampleValue: "250115", detectedType: "date" },
                    { fieldName: "Description", sampleValue: "LOCKBOX DEPOSIT", detectedType: "text" }
                ];
            } else if (sFileType === 'PDF') {
                // PDF might have mixed content
                aCommonFields = [
                    { fieldName: "Lockbox ID", sampleValue: "LB-001", detectedType: "text" },
                    { fieldName: "Deposit Date", sampleValue: "January 15, 2025", detectedType: "date" },
                    { fieldName: "Total Amount", sampleValue: "$15,750.00", detectedType: "currency" },
                    { fieldName: "Check Number", sampleValue: "1234567", detectedType: "text" },
                    { fieldName: "Payer Name", sampleValue: "ABC Corporation", detectedType: "text" },
                    { fieldName: "Invoice Reference", sampleValue: "INV-2025-0123", detectedType: "text" }
                ];
            }
            
            // Check for fields with multiple comma-separated values and add split preview
            aCommonFields.forEach(function (oField) {
                if (oField.sampleValue && oField.sampleValue.includes(',')) {
                    oField.hasMultipleValues = true;
                    oField.splitPreview = that._splitInvoiceReferences(oField.sampleValue);
                    oField.detectedType = oField.detectedType + " (will split into " + oField.splitPreview.length + " items)";
                }
            });
            
            return aCommonFields;
        },
        
        // Split invoice references - handles "90004206, 207, 208, 209" format
        _splitInvoiceReferences: function (invoiceStr) {
            if (!invoiceStr) return [];
            
            if (!invoiceStr.includes(',')) {
                return [invoiceStr.trim()];
            }
            
            var parts = invoiceStr.split(',').map(function(p) { return p.trim(); }).filter(function(p) { return p; });
            
            if (parts.length <= 1) {
                return [invoiceStr.trim()];
            }
            
            var firstPart = parts[0];
            var otherParts = parts.slice(1);
            var results = [];
            
            // Check if subsequent parts are shorter (indicating they are suffixes)
            var hasShortSuffixes = otherParts.every(function(p) { return p.length < firstPart.length; });
            
            if (hasShortSuffixes && firstPart.length > 3) {
                // Calculate the prefix length based on the first suffix
                var firstSuffix = otherParts[0];
                var prefixLength = firstPart.length - firstSuffix.length;
                
                if (prefixLength > 0) {
                    var commonPrefix = firstPart.substring(0, prefixLength);
                    
                    // First part is already complete
                    results.push(firstPart);
                    
                    // Add prefix to other parts
                    otherParts.forEach(function(suffix) {
                        results.push(commonPrefix + suffix);
                    });
                    
                    return results;
                }
            }
            
            return parts;
        },
        
        // Generate field mappings with suggested API fields
        _generateFieldMappings: function (aExtractedFields) {
            var that = this;
            var aMappings = [];
            
            // Mapping suggestions based on field names
            var oSuggestions = {
                "Customer Number": { apiField: "CustomerNumber", section: "header" },
                "Cheque Number": { apiField: "Cheque", section: "cheques" },
                "Check Number": { apiField: "Cheque", section: "cheques" },
                "Amount": { apiField: "AmountInTransactionCurrency", section: "header" },
                "Cheque_Amount": { apiField: "AmountInTransactionCurrency", section: "cheques" },
                "Total Amount": { apiField: "AmountInTransactionCurrency", section: "header" },
                "Payment Date": { apiField: "DepositDateTime", section: "header" },
                "Deposit Date": { apiField: "DepositDateTime", section: "header" },
                "Value Date": { apiField: "DepositDateTime", section: "header" },
                "Bank Account": { apiField: "PartnerBankAccount", section: "cheques" },
                "Account Number": { apiField: "PartnerBankAccount", section: "cheques" },
                "Partner_Bank_Account": { apiField: "PartnerBankAccount", section: "cheques" },
                "Reference": { apiField: "PaymentReference", section: "paymentReferences" },
                "Invoice Reference": { apiField: "PaymentReference", section: "paymentReferences" },
                "Invoice Number": { apiField: "PaymentReference", section: "paymentReferences" },
                "Payment_Reference": { apiField: "PaymentReference", section: "paymentReferences" },
                "Customer Reference": { apiField: "PaymentReference", section: "paymentReferences" },
                "Bank Reference": { apiField: "LockboxBatch", section: "cheques" },
                "Lockbox ID": { apiField: "Lockbox", section: "header" },
                "Lockbox_Batch": { apiField: "LockboxBatch", section: "cheques" },
                "Lockbox_Batch_Item": { apiField: "LockboxBatchItem", section: "cheques" },
                "Payer Name": { apiField: "CustomerNumber", section: "header" },
                "Transaction Code": { apiField: "LockboxBatchItem", section: "cheques" },
                "Description": { apiField: "PaymentDifferenceReason", section: "paymentReferences" },
                "Partner_Bank": { apiField: "PartnerBank", section: "cheques" },
                "Partner_Bank_Country": { apiField: "PartnerBankCountry", section: "cheques" },
                "Currency": { apiField: "Currency", section: "cheques" },
                "Net_Payment_Amount": { apiField: "NetPaymentAmountInPaytCurrency", section: "paymentReferences" },
                "Deduction_Amount": { apiField: "DeductionAmountInPaytCurrency", section: "paymentReferences" }
            };
            
            aExtractedFields.forEach(function (oField) {
                var oSuggestion = oSuggestions[oField.fieldName] || { apiField: "", section: "header" };
                var oMapping = {
                    templateField: oField.fieldName,
                    apiField: oSuggestion.apiField,
                    section: oSuggestion.section,
                    required: oSuggestion.apiField !== "",
                    detectedType: oField.detectedType,
                    hasMultipleValues: oField.hasMultipleValues || false,
                    splitPreview: oField.splitPreview || null
                };
                
                // Add note for fields that will be split
                if (oField.hasMultipleValues && oField.splitPreview) {
                    oMapping.splitNote = "Will split into " + oField.splitPreview.length + " payment references: " + oField.splitPreview.join(", ");
                }
                
                aMappings.push(oMapping);
            });
            
            return aMappings;
        },
        
        // Field mapping changed
        onFieldMappingChange: function (oEvent) {
            // Could add validation or auto-suggestion logic here
        },
        
        // Save template mapping
        onSaveTemplateMapping: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var sTemplateName = oModel.getProperty("/templateBuilder/templateName");
            var aFieldMappings = oModel.getProperty("/templateBuilder/fieldMappings");
            var oUploadedFile = oModel.getProperty("/templateBuilder/uploadedFile");
            
            if (!sTemplateName || sTemplateName.trim() === "") {
                MessageBox.warning("Please enter a template name");
                return;
            }
            
            if (!aFieldMappings || aFieldMappings.length === 0) {
                MessageBox.warning("No field mappings to save. Please extract fields first.");
                return;
            }
            
            // Create saved template object
            var oSavedTemplate = {
                id: "TPL-" + Date.now(),
                name: sTemplateName.trim(),
                fileType: oUploadedFile ? oUploadedFile.type : "Unknown",
                fieldCount: aFieldMappings.length,
                mappings: aFieldMappings,
                autoPopulatedFields: oModel.getProperty("/templateBuilder/autoPopulatedFields"),
                createdAt: new Date().toISOString()
            };
            
            // Add to saved templates
            var aSavedTemplates = oModel.getProperty("/templateBuilder/savedTemplates") || [];
            aSavedTemplates.unshift(oSavedTemplate);
            oModel.setProperty("/templateBuilder/savedTemplates", aSavedTemplates);
            
            // Clear form
            oModel.setProperty("/templateBuilder/templateName", "");
            
            MessageBox.success("Template '" + sTemplateName + "' saved successfully!\n\nYou can now use this template in the Lockbox Transaction app.");
        },
        
        // Select saved template
        onSavedTemplateSelect: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem) {
                var oContext = oSelectedItem.getBindingContext("app");
                var oTemplate = oContext.getObject();
                MessageToast.show("Selected template: " + oTemplate.name);
            }
        },
        
        // Edit saved template
        onEditSavedTemplate: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oTemplate = oContext.getObject();
            
            // Load template into editor
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/templateBuilder/templateName", oTemplate.name);
            oModel.setProperty("/templateBuilder/fieldMappings", oTemplate.mappings);
            
            MessageToast.show("Editing template: " + oTemplate.name);
        },
        
        // Delete saved template
        onDeleteSavedTemplate: function (oEvent) {
            var that = this;
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oTemplate = oContext.getObject();
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.split("/").pop());
            
            MessageBox.confirm("Are you sure you want to delete template '" + oTemplate.name + "'?", {
                title: "Confirm Delete",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var oModel = that.getOwnerComponent().getModel("app");
                        var aSavedTemplates = oModel.getProperty("/templateBuilder/savedTemplates");
                        aSavedTemplates.splice(iIndex, 1);
                        oModel.setProperty("/templateBuilder/savedTemplates", aSavedTemplates);
                        MessageToast.show("Template deleted");
                    }
                }
            });
        },
        
        // Regenerate test Lockbox ID
        onRegenerateTestLockbox: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var sNewLockboxId = "LB-TEST-" + Date.now().toString().slice(-8);
            oModel.setProperty("/templateBuilder/testLockboxId", sNewLockboxId);
            
            // Update in auto-populated fields
            var aAutoFields = oModel.getProperty("/templateBuilder/autoPopulatedFields");
            aAutoFields.forEach(function (oField) {
                if (oField.apiField === "Lockbox") {
                    oField.value = sNewLockboxId;
                }
            });
            oModel.setProperty("/templateBuilder/autoPopulatedFields", aAutoFields);
            
            MessageToast.show("New Test Lockbox ID generated: " + sNewLockboxId);
        },
        
        // Simulate Lockbox API call for testing
        onSimulateLockboxAPI: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var aFieldMappings = oModel.getProperty("/templateBuilder/fieldMappings");
            var aAutoFields = oModel.getProperty("/templateBuilder/autoPopulatedFields");
            
            if (!aFieldMappings || aFieldMappings.length === 0) {
                MessageBox.warning("No field mappings available. Please upload a template and extract fields first.");
                return;
            }
            
            // Build the test payload from auto-populated fields and mappings
            var oPayload = this._buildTestPayload(aAutoFields, aFieldMappings);
            
            // Show confirmation dialog with payload preview
            var sPayloadPreview = JSON.stringify(oPayload, null, 2);
            
            MessageBox.confirm(
                "This will send a test simulation to the Lockbox API.\n\n" +
                "Test Lockbox ID: " + oPayload.Lockbox + "\n\n" +
                "Do you want to proceed with the simulation?",
                {
                    title: "Confirm Simulation",
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            that._executeSimulation(oPayload);
                        }
                    }
                }
            );
        },
        
        // Build test payload for simulation
        _buildTestPayload: function (aAutoFields, aFieldMappings) {
            var oPayload = {
                // Default test values
                Lockbox: "",
                DepositDateTime: new Date().toISOString(),
                AmountInTransactionCurrency: "1000.00",
                CompanyCode: "1710",
                Currency: "USD",
                LockboxBatchOrigin: "LOCKBOXORI",
                LockboxBatchDestination: "LOCKBOXDES",
                // Nested items
                to_Item: {
                    results: [
                        {
                            LockboxBatch: "001",
                            LockboxBatchItem: "0001",
                            AmountInTransactionCurrency: "1000.00",
                            Currency: "USD",
                            Cheque: "CHK-" + Date.now().toString().slice(-6),
                            PartnerBank: "TESTBANK",
                            PartnerBankAccount: "123456789",
                            PartnerBankCountry: "US",
                            to_PaymentReference: {
                                results: [
                                    {
                                        PaymentReference: "REF-" + Date.now().toString().slice(-6),
                                        NetPaymentAmountInPaytCurrency: "1000.00",
                                        DeductionAmountInPaytCurrency: "0.00",
                                        PaymentDifferenceReason: "",
                                        Currency: "USD"
                                    }
                                ]
                            }
                        }
                    ]
                }
            };
            
            // Apply auto-populated field values
            aAutoFields.forEach(function (oField) {
                if (oPayload.hasOwnProperty(oField.apiField)) {
                    oPayload[oField.apiField] = oField.value;
                }
                // Also update nested items if applicable
                if (oField.apiField === "Currency") {
                    oPayload.to_Item.results[0].Currency = oField.value;
                    oPayload.to_Item.results[0].to_PaymentReference.results[0].Currency = oField.value;
                }
            });
            
            return oPayload;
        },
        
        // Execute simulation API call
        _executeSimulation: function (oPayload) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            BusyIndicator.show(0);
            
            // Call the simulate API endpoint
            fetch(API_BASE + "/lockbox/simulate-test", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(oPayload)
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                BusyIndicator.hide();
                
                // Store simulation result
                oModel.setProperty("/templateBuilder/simulationResult", data);
                
                if (data.success) {
                    // Success
                    var sSuccessMsg = "✅ Simulation Successful!\n\n";
                    sSuccessMsg += "Lockbox ID: " + oPayload.Lockbox + "\n";
                    sSuccessMsg += "Status: " + (data.status || "SIMULATED") + "\n\n";
                    if (data.message) {
                        sSuccessMsg += "Message: " + data.message + "\n";
                    }
                    sSuccessMsg += "\nThe template mapping is valid for the Lockbox API.";
                    
                    MessageBox.success(sSuccessMsg, {
                        title: "Simulation Successful"
                    });
                } else {
                    // Error
                    var sErrorMsg = "❌ Simulation Failed!\n\n";
                    sErrorMsg += "Lockbox ID: " + oPayload.Lockbox + "\n\n";
                    sErrorMsg += "Error: " + (data.message || data.error || "Unknown error") + "\n";
                    if (data.details) {
                        sErrorMsg += "\nDetails: " + JSON.stringify(data.details, null, 2);
                    }
                    
                    MessageBox.error(sErrorMsg, {
                        title: "Simulation Failed"
                    });
                }
            })
            .catch(function (error) {
                BusyIndicator.hide();
                
                // Store error result
                oModel.setProperty("/templateBuilder/simulationResult", {
                    success: false,
                    error: error.message
                });
                
                MessageBox.error(
                    "❌ Simulation Failed!\n\n" +
                    "Error: " + error.message + "\n\n" +
                    "Please check the network connection and try again.",
                    {
                        title: "Simulation Error"
                    }
                );
            });
        },
        
        
        // Initialize column visibility settings
        _initColumnSettings: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            // Define all columns with their visibility state
            oModel.setProperty("/columnSettings", [
                { id: "colLockboxItem", label: "Lockbox / Item", visible: true },
                { id: "colDepositDateTime", label: "Deposit DateTime", visible: true },
                { id: "colAmount", label: "Amount", visible: true },
                { id: "colCurrency", label: "Currency", visible: true },
                { id: "colStatus", label: "Status", visible: true },
                { id: "colARPostingDoc", label: "AR Posting Doc", visible: true },
                { id: "colPaymentAdvice", label: "Payment Advice", visible: true },
                { id: "colOnAccount", label: "On Account", visible: true },
                { id: "colClearingDoc", label: "Clearing Doc", visible: true }
            ]);
        },
        
        // Initialize empty tree data structure
        _initTreeData: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            // Initialize with empty array - real data will be loaded from database
            oModel.setProperty("/treeData", []);
        },
        
        // Initialize filters for Lockbox Transaction tab
        _initFilters: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/filters", {
                lockboxId: "",
                companyCode: "",
                currency: "",
                status: ""
            });
            oModel.setProperty("/lockboxIdList", [
                { key: "", text: "All" }
            ]);
        },
        
        // Initialize template configuration with all fields
        _initTemplateConfig: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            
            var oTemplateConfig = {
                header: [
                    { fieldName: "Lockbox", selected: true, required: true, fieldType: "text", section: "header" },
                    { fieldName: "DepositDateTime", selected: true, required: false, fieldType: "date", section: "header" },
                    { fieldName: "AmountInTransactionCurrency", selected: true, required: true, fieldType: "currency", section: "header" },
                    { fieldName: "LockboxBatchOrigin", selected: true, required: false, fieldType: "text", section: "header" },
                    { fieldName: "LockboxBatchDestination", selected: true, required: false, fieldType: "text", section: "header" },
                    { fieldName: "CompanyCode", selected: true, required: false, fieldType: "text", section: "header" }
                ],
                cheques: [
                    { fieldName: "LockboxBatch", selected: true, required: true, fieldType: "text", section: "cheques" },
                    { fieldName: "LockboxBatchItem", selected: true, required: true, fieldType: "text", section: "cheques" },
                    { fieldName: "AmountInTransactionCurrency", selected: true, required: true, fieldType: "currency", section: "cheques" },
                    { fieldName: "Currency", selected: true, required: true, fieldType: "text", section: "cheques" },
                    { fieldName: "Cheque", selected: true, required: true, fieldType: "text", section: "cheques" },
                    { fieldName: "PartnerBank", selected: true, required: true, fieldType: "text", section: "cheques" },
                    { fieldName: "PartnerBankAccount", selected: true, required: true, fieldType: "number", section: "cheques" },
                    { fieldName: "PartnerBankCountry", selected: true, required: true, fieldType: "text", section: "cheques" }
                ],
                paymentReferences: [
                    { fieldName: "Cheque", selected: true, required: true, fieldType: "text", section: "paymentReferences" },
                    { fieldName: "PaymentReference", selected: true, required: true, fieldType: "text", section: "paymentReferences" },
                    { fieldName: "NetPaymentAmountInPaytCurrency", selected: true, required: true, fieldType: "currency", section: "paymentReferences" },
                    { fieldName: "DeductionAmountInPaytCurrency", selected: true, required: false, fieldType: "currency", section: "paymentReferences" },
                    { fieldName: "PaymentDifferenceReason", selected: true, required: false, fieldType: "text", section: "paymentReferences" },
                    { fieldName: "Currency", selected: true, required: false, fieldType: "text", section: "paymentReferences" }
                ]
            };
            
            oModel.setProperty("/templateConfig", oTemplateConfig);
            
            // Initialize field sequence from selected fields
            this._updateFieldSequence();
            
            // Initialize new field form
            oModel.setProperty("/newField", {
                fieldName: "",
                section: "header",
                required: false,
                fieldType: "text"
            });
            
            // Initialize selected sequence field
            oModel.setProperty("/selectedSequenceField", null);
            oModel.setProperty("/selectedSequenceIndex", -1);
        },
        
        // Update field sequence from selected fields in all sections
        _updateFieldSequence: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oConfig = oModel.getProperty("/templateConfig");
            var aSequence = [];
            
            // Add selected fields from each section
            ["header", "cheques", "paymentReferences"].forEach(function (sSection) {
                var aFields = oConfig[sSection] || [];
                aFields.forEach(function (oField) {
                    if (oField.selected) {
                        aSequence.push({
                            fieldName: oField.fieldName,
                            fieldType: oField.fieldType || "text",
                            required: oField.required,
                            section: sSection
                        });
                    }
                });
            });
            
            oModel.setProperty("/fieldSequence", aSequence);
        },
        
        // Field selection changed - update sequence
        onFieldSelectionChange: function () {
            this._updateFieldSequence();
        },
        
        // Select field in sequence list
        onSequenceFieldSelect: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oList = oEvent.getSource();
            var oSelectedItem = oList.getSelectedItem();
            
            if (oSelectedItem) {
                var oContext = oSelectedItem.getBindingContext("app");
                var sPath = oContext.getPath();
                var iIndex = parseInt(sPath.split("/").pop());
                oModel.setProperty("/selectedSequenceField", oContext.getObject());
                oModel.setProperty("/selectedSequenceIndex", iIndex);
            } else {
                oModel.setProperty("/selectedSequenceField", null);
                oModel.setProperty("/selectedSequenceIndex", -1);
            }
        },
        
        // Move field up in sequence
        onMoveFieldUp: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var iIndex = oModel.getProperty("/selectedSequenceIndex");
            var aSequence = oModel.getProperty("/fieldSequence");
            
            if (iIndex > 0) {
                var oTemp = aSequence[iIndex];
                aSequence[iIndex] = aSequence[iIndex - 1];
                aSequence[iIndex - 1] = oTemp;
                oModel.setProperty("/fieldSequence", aSequence);
                oModel.setProperty("/selectedSequenceIndex", iIndex - 1);
                
                // Re-select the item
                var oList = this.byId("fieldSequenceList");
                oList.setSelectedItem(oList.getItems()[iIndex - 1]);
            }
        },
        
        // Move field down in sequence
        onMoveFieldDown: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var iIndex = oModel.getProperty("/selectedSequenceIndex");
            var aSequence = oModel.getProperty("/fieldSequence");
            
            if (iIndex < aSequence.length - 1) {
                var oTemp = aSequence[iIndex];
                aSequence[iIndex] = aSequence[iIndex + 1];
                aSequence[iIndex + 1] = oTemp;
                oModel.setProperty("/fieldSequence", aSequence);
                oModel.setProperty("/selectedSequenceIndex", iIndex + 1);
                
                // Re-select the item
                var oList = this.byId("fieldSequenceList");
                oList.setSelectedItem(oList.getItems()[iIndex + 1]);
            }
        },
        
        // Remove field from sequence (deselect it)
        onRemoveFromSequence: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedField = oModel.getProperty("/selectedSequenceField");
            
            if (oSelectedField) {
                var oConfig = oModel.getProperty("/templateConfig");
                var sSection = oSelectedField.section;
                var aFields = oConfig[sSection];
                
                // Find and deselect the field
                aFields.forEach(function (oField) {
                    if (oField.fieldName === oSelectedField.fieldName) {
                        oField.selected = false;
                    }
                });
                
                oModel.setProperty("/templateConfig", oConfig);
                this._updateFieldSequence();
                oModel.setProperty("/selectedSequenceField", null);
                oModel.setProperty("/selectedSequenceIndex", -1);
                
                MessageToast.show("Field '" + oSelectedField.fieldName + "' removed from sequence");
            }
        },
        
        // Format field type icon
        formatFieldTypeIcon: function (sFieldType) {
            switch (sFieldType) {
                case "text":
                    return "sap-icon://text";
                case "number":
                    return "sap-icon://number-sign";
                case "currency":
                    return "sap-icon://lead";
                case "date":
                    return "sap-icon://calendar";
                case "scan":
                    return "sap-icon://bar-code";
                default:
                    return "sap-icon://text";
            }
        },
        
        // Add custom SAP field to selected section
        onAddCustomField: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oNewField = oModel.getProperty("/newField");
            
            if (!oNewField.fieldName || oNewField.fieldName.trim() === "") {
                MessageBox.warning("Please enter a field name");
                return;
            }
            
            // Get the target section
            var sSection = oNewField.section;
            var aFields = oModel.getProperty("/templateConfig/" + sSection);
            
            // Check if field already exists
            var bExists = aFields.some(function(f) {
                return f.fieldName.toLowerCase() === oNewField.fieldName.trim().toLowerCase();
            });
            
            if (bExists) {
                MessageBox.warning("Field '" + oNewField.fieldName + "' already exists in " + sSection + " section");
                return;
            }
            
            // Add new field
            aFields.push({
                fieldName: oNewField.fieldName.trim(),
                selected: true,
                required: oNewField.required,
                fieldType: oNewField.fieldType || "text",
                section: sSection
            });
            
            oModel.setProperty("/templateConfig/" + sSection, aFields);
            
            // Update field sequence
            this._updateFieldSequence();
            
            // Reset form
            oModel.setProperty("/newField", {
                fieldName: "",
                section: sSection,
                required: false,
                fieldType: "text"
            });
            
            MessageToast.show("Field '" + oNewField.fieldName + "' added to " + sSection + " section");
        },

        // Format helpers
        formatDateTime: function (sDateTime) {
            if (!sDateTime) return "";
            try {
                var oDate = new Date(sDateTime);
                return oDate.toLocaleString();
            } catch (e) {
                return sDateTime;
            }
        },
        
        // Format Batch/Item column - combines batchId and itemId
        formatBatchItem: function (oContext) {
            if (!oContext) return "";
            var sType = oContext.type;
            var sBatchId = oContext.batchId || "";
            var sItemId = oContext.itemId || "";
            
            if (sType === "LOCKBOX") {
                // For lockbox level, show batch only
                return sBatchId ? sBatchId : "";
            } else if (sType === "CHEQUE") {
                // For check/item level, show batch-item (e.g., "001-001")
                return sBatchId && sItemId ? sBatchId + "-" + sItemId : sItemId;
            } else {
                // For payment level, show just the item
                return sItemId || "";
            }
        },

        // Format Lockbox/Item column display - shows combined info based on hierarchy level
        // LOCKBOX: shows lockbox number (e.g., "12345")
        // CHEQUE: shows "Batch: 001, Item: 001, Cheque: 100003"
        // PAYMENT: shows "Payment Ref: 9400000091"
        formatLockboxItemDisplay: function (oContext) {
            if (!oContext) return "";
            var sType = oContext.type;
            
            if (sType === "LOCKBOX" || sType === "HEADER") {
                // Top level - show Lockbox number
                return oContext.lockbox || oContext.displayText || "";
            } else if (sType === "CHEQUE" || sType === "CHECK") {
                // Cheque level - show combined Batch, Item, Cheque info
                var sBatch = oContext.batchId || "001";
                var sItem = oContext.itemId || "001";
                var sCheque = oContext.cheque || oContext.displayText || "";
                return "Batch: " + sBatch + ", Item: " + sItem + ", Cheque: " + sCheque;
            } else if (sType === "PAYMENT" || sType === "PAYMENT_REF" || sType === "INVOICE") {
                // Payment reference level
                var sRef = oContext.paymentReference || oContext.displayText || "";
                return "Payment Ref: " + sRef;
            } else {
                // Default - show displayText
                return oContext.displayText || "";
            }
        },

        formatStatusState: function (sStatus) {
            switch (sStatus) {
                case "POSTED":
                    return "Success";
                case "SIMULATED":
                    return "Warning";
                case "UPLOADED":
                    return "Information";
                case "POST_ERROR":
                case "SIMULATION_ERROR":
                    return "Error";
                default:
                    return "None";
            }
        },

        formatTypeIcon: function (sType) {
            switch (sType) {
                case "HEADER":
                case "LOCKBOX":
                    return "sap-icon://folder";
                case "CUSTOMER":
                    return "sap-icon://customer";
                case "BATCH":
                    return "sap-icon://batch-payments";
                case "CHECK":
                case "CHEQUE":
                    return "sap-icon://money-bills";
                case "INVOICE":
                case "PAYMENT_REF":
                case "PAYMENT":
                    return "sap-icon://payment-approval";
                default:
                    return "sap-icon://document";
            }
        },
        
        // Processing Flow formatters
        formatProcessingFlowState: function (sFlow) {
            switch (sFlow) {
                case "Completed":
                case "Posted":
                    return "Success";
                case "In Progress":
                case "Processing":
                    return "Warning";
                case "Not Processed":
                case "Pending":
                    return "None";
                case "Error":
                case "Failed":
                    return "Error";
                default:
                    return "None";
            }
        },
        
        formatProcessingFlowIcon: function (sFlow) {
            switch (sFlow) {
                case "Completed":
                case "Posted":
                    return "sap-icon://sys-enter-2";
                case "In Progress":
                case "Processing":
                    return "sap-icon://process";
                case "Not Processed":
                case "Pending":
                    return "sap-icon://pending";
                case "Error":
                case "Failed":
                    return "sap-icon://error";
                default:
                    return "";
            }
        },
        
        // Format version state for OData services
        formatVersionState: function (sVersion) {
            if (!sVersion) return "None";
            switch (sVersion.toUpperCase()) {
                case "V4":
                    return "Success";
                case "V2":
                    return "Warning";
                default:
                    return "Information";
            }
        },
        
        // Format auth type state for OData services
        formatAuthTypeState: function (sAuthType) {
            if (!sAuthType) return "None";
            switch (sAuthType.toUpperCase()) {
                case "OAUTH2":
                case "OAUTH":
                    return "Success";
                case "BASIC":
                    return "Warning";
                case "CERTIFICATE":
                    return "Information";
                default:
                    return "None";
            }
        },
        
        // Stage-based Processing Flow formatters (Extract → Validate → Simulate)
        formatStageIcon: function (sStatus) {
            switch (sStatus) {
                case "Success":
                case "Completed":
                    return "sap-icon://sys-enter-2";
                case "In Progress":
                case "Processing":
                    return "sap-icon://process";
                case "Pending":
                case "Not Started":
                    return "sap-icon://circle-task-2";
                case "Error":
                case "Failed":
                    return "sap-icon://error";
                case "Warning":
                    return "sap-icon://warning";
                default:
                    return "sap-icon://circle-task-2";
            }
        },
        
        formatStageColor: function (sStatus) {
            switch (sStatus) {
                case "Success":
                case "Completed":
                    return "#107e3e"; // Green
                case "In Progress":
                case "Processing":
                    return "#e78c07"; // Orange
                case "Pending":
                case "Not Started":
                    return "#6a6d70"; // Gray
                case "Error":
                case "Failed":
                    return "#bb0000"; // Red
                case "Warning":
                    return "#e78c07"; // Orange
                default:
                    return "#6a6d70"; // Gray
            }
        },

        formatTypeState: function (sType) {
            switch (sType) {
                case "HEADER":
                    return "Success";
                case "BATCH":
                    return "Warning";
                case "CHEQUE":
                    return "Information";
                case "PAYMENT_REF":
                    return "None";
                default:
                    return "None";
            }
        },
        
        // Filter handlers for Lockbox Transaction tab
        onFilterGo: function () {
            this._loadHeaders();
        },
        
        onAdaptFilters: function () {
            MessageToast.show("Adapt Filters - Coming soon");
        },
        
        // Open Table Settings Dialog for Column Visibility
        onOpenTableSettings: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var aColumnSettings = oModel.getProperty("/columnSettings") || [];
            
            // Count visible columns
            var nVisibleCount = aColumnSettings.filter(function (col) { return col.visible; }).length;
            var nTotalCount = aColumnSettings.length;
            
            // Create list items for columns
            var aListItems = [];
            aColumnSettings.forEach(function (oCol, idx) {
                var oItem = new StandardListItem({
                    title: oCol.label,
                    type: "Active",
                    selected: oCol.visible,
                    customData: [
                        new sap.ui.core.CustomData({ key: "colId", value: oCol.id }),
                        new sap.ui.core.CustomData({ key: "index", value: idx })
                    ]
                });
                aListItems.push(oItem);
            });
            
            // Create list
            var oList = new List({
                mode: "MultiSelect",
                includeItemInSelection: true,
                items: aListItems,
                selectionChange: function (oEvent) {
                    // Update count label
                    var nSelected = oList.getSelectedItems().length;
                    oCountLabel.setText("Columns (" + nSelected + "/" + nTotalCount + ")");
                }
            });
            
            // Pre-select visible columns
            aColumnSettings.forEach(function (oCol, idx) {
                if (oCol.visible) {
                    oList.setSelectedItem(oList.getItems()[idx], true);
                }
            });
            
            // Create search field
            var oSearchField = new SearchField({
                placeholder: "Search",
                width: "100%",
                liveChange: function (oEvent) {
                    var sQuery = oEvent.getParameter("newValue").toLowerCase();
                    oList.getItems().forEach(function (oItem) {
                        var sTitle = oItem.getTitle().toLowerCase();
                        oItem.setVisible(sTitle.indexOf(sQuery) !== -1);
                    });
                }
            });
            
            // Create count label
            var oCountLabel = new Label({
                text: "Columns (" + nVisibleCount + "/" + nTotalCount + ")"
            }).addStyleClass("sapUiSmallMarginTop sapUiSmallMarginBottom");
            
            // Create dialog
            var oDialog = new Dialog({
                title: "View Settings",
                icon: "sap-icon://action-settings",
                contentWidth: "400px",
                contentHeight: "450px",
                content: [
                    new VBox({
                        items: [
                            oSearchField,
                            oCountLabel,
                            oList
                        ]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                beginButton: new Button({
                    text: "OK",
                    type: "Emphasized",
                    press: function () {
                        // Apply column visibility
                        var oTreeTable = that.byId("lockboxTreeTable");
                        var aSelectedItems = oList.getSelectedItems();
                        var aSelectedIds = aSelectedItems.map(function (item) {
                            return item.getCustomData()[0].getValue();
                        });
                        
                        // Update column visibility in TreeTable
                        var aColumns = oTreeTable.getColumns();
                        aColumns.forEach(function (oColumn) {
                            var sColId = oColumn.getId().split("--").pop();
                            var bVisible = aSelectedIds.indexOf(sColId) !== -1;
                            oColumn.setVisible(bVisible);
                        });
                        
                        // Update model
                        var aUpdatedSettings = aColumnSettings.map(function (oCol) {
                            return {
                                id: oCol.id,
                                label: oCol.label,
                                visible: aSelectedIds.indexOf(oCol.id) !== -1
                            };
                        });
                        oModel.setProperty("/columnSettings", aUpdatedSettings);
                        
                        MessageToast.show("Column settings applied");
                        oDialog.close();
                    }
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });
            
            // Add Reset button in the subheader
            oDialog.setSubHeader(new sap.m.Bar({
                contentRight: [
                    new Button({
                        text: "Reset",
                        press: function () {
                            // Reset all columns to visible
                            oList.getItems().forEach(function (oItem, idx) {
                                oList.setSelectedItem(oItem, true);
                            });
                            oCountLabel.setText("Columns (" + nTotalCount + "/" + nTotalCount + ")");
                        }
                    })
                ]
            }));
            
            this.getView().addDependent(oDialog);
            oDialog.open();
        },
        
        onStatusFilterChange: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            var oModel = this.getOwnerComponent().getModel("app");
            
            if (sKey === "all") {
                oModel.setProperty("/filters/status", "");
            } else {
                oModel.setProperty("/filters/status", sKey.toUpperCase());
            }
            this._loadHeaders();
        },
        
        // Row selection handler
        onLockboxRowSelect: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem) {
                var oContext = oSelectedItem.getBindingContext("app");
                var oHeader = oContext.getObject();
                var oModel = this.getOwnerComponent().getModel("app");
                
                oModel.setProperty("/selectedHeader", oHeader.id);
                oModel.setProperty("/selectedHeaderDetails", oHeader);
                
                // Load posted documents if status is POSTED
                if (oHeader.status === "POSTED" && oHeader.sap_response) {
                    try {
                        var oSapResponse = JSON.parse(oHeader.sap_response);
                        var aDocuments = [];
                        if (oSapResponse.documents) {
                            if (oSapResponse.documents.postingDocument) {
                                aDocuments.push(oSapResponse.documents.postingDocument);
                            }
                            if (oSapResponse.documents.paymentAdvice) {
                                aDocuments.push(oSapResponse.documents.paymentAdvice);
                            }
                            if (oSapResponse.documents.financialDocument) {
                                aDocuments.push(oSapResponse.documents.financialDocument);
                            }
                        }
                        oModel.setProperty("/postedDocuments", aDocuments);
                    } catch (e) {
                        oModel.setProperty("/postedDocuments", []);
                    }
                } else {
                    oModel.setProperty("/postedDocuments", []);
                }
            }
        },
        
        onLockboxRowPress: function (oEvent) {
            // Same as selection
            this.onLockboxRowSelect({ getParameter: function() { return oEvent.getSource(); }});
        },
        
        onShowDocuments: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oHeader = oContext.getObject();
            
            if (oHeader.sap_response) {
                var oModel = this.getOwnerComponent().getModel("app");
                oModel.setProperty("/sapResponse", oHeader.sap_response);
            }
        },
        
        // Load lockbox headers and build tree data
        _loadHeaders: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oFilters = oModel.getProperty("/filters") || {};
            
            BusyIndicator.show(0);
            
            // Use AbortController for timeout
            var controller = new AbortController();
            var timeoutId = setTimeout(function() { controller.abort(); }, 5000); // 5 second timeout

            fetch(API_BASE + "/lockbox/headers", {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                signal: controller.signal
            })
                .then(function (response) {
                    clearTimeout(timeoutId);
                    if (!response.ok) {
                        throw new Error("HTTP " + response.status);
                    }
                    return response.json();
                })
                .then(function (data) {
                    var aHeaders = data.value || [];
                    
                    // Apply client-side filters
                    if (oFilters.lockboxId) {
                        aHeaders = aHeaders.filter(function(h) { return h.lockbox === oFilters.lockboxId; });
                    }
                    if (oFilters.status) {
                        aHeaders = aHeaders.filter(function(h) { return h.status === oFilters.status; });
                    }
                    
                    oModel.setProperty("/headers", aHeaders);
                    
                    // Update lockbox ID dropdown list from headers
                    var aLockboxIds = [{ key: "", text: "All" }];
                    var aUniqueIds = [...new Set((data.value || []).map(function(h) { return h.lockbox; }))];
                    aUniqueIds.forEach(function(id) {
                        aLockboxIds.push({ key: id, text: id });
                    });
                    oModel.setProperty("/lockboxIdList", aLockboxIds);
                    
                    // ALWAYS load processing runs as the PRIMARY data source for TreeTable
                    // This ensures newly uploaded files appear in the list
                    that._loadRunHistory();
                    
                    BusyIndicator.hide();
                })
                .catch(function (error) {
                    clearTimeout(timeoutId);
                    console.log("Headers fetch skipped (database not available):", error.name);
                    // Set empty headers - use processing runs instead
                    oModel.setProperty("/headers", []);
                    oModel.setProperty("/lockboxIdList", [{ key: "", text: "All" }]);
                    // Load processing runs as the primary data source
                    that._loadRunHistory();
                    BusyIndicator.hide();
                });
        },
        
        // Build tree data structure for TreeTable
        _buildTreeData: function (aHeaders) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var aTreeData = [];
            
            // For each header, fetch hierarchy and build tree node
            var aPromises = aHeaders.map(function (oHeader) {
                return fetch(API_BASE + "/lockbox/hierarchy/" + oHeader.id, {
                    method: "GET",
                    headers: { "Accept": "application/json" }
                })
                .then(function (response) {
                    if (!response.ok) return null;
                    return response.json();
                })
                .then(function (data) {
                    if (!data) return null;
                    return that._buildHeaderTreeNode(oHeader, data);
                })
                .catch(function () {
                    // If hierarchy fetch fails, return simple header node
                    return {
                        id: oHeader.id,
                        type: "HEADER",
                        displayText: oHeader.lockbox,
                        deposit_datetime: oHeader.deposit_datetime,
                        amount: oHeader.amount_in_transaction_currency,
                        status: oHeader.status,
                        ar_posting_doc: oHeader.ar_posting_doc || "",
                        payment_advice_doc: oHeader.payment_advice_doc || "",
                        on_account_doc: oHeader.on_account_doc || "",
                        clearing_doc: oHeader.clearing_doc || "",
                        children: []
                    };
                });
            });
            
            Promise.all(aPromises).then(function (aNodes) {
                aTreeData = aNodes.filter(function (n) { return n !== null; });
                oModel.setProperty("/treeData", aTreeData);
            });
        },
        
        // Build tree node for a single header with its hierarchy
        _buildHeaderTreeNode: function (oHeader, oHierarchyData) {
            // Default processing stages structure
            var oDefaultStages = {
                extract: "Pending",
                validate: "Pending",
                simulate: "Pending"
            };
            
            var oNode = {
                id: oHeader.id,
                type: "HEADER",
                displayText: oHeader.lockbox,
                deposit_datetime: oHeader.deposit_datetime,
                amount: oHeader.amount_in_transaction_currency,
                status: oHeader.status,
                processingFlow: oHeader.processingFlow || "Not Processed",
                processingStages: oHeader.processingStages || Object.assign({}, oDefaultStages),
                ar_posting_doc: oHeader.ar_posting_doc || "",
                payment_advice_doc: oHeader.payment_advice_doc || "",
                on_account_doc: oHeader.on_account_doc || "",
                clearing_doc: oHeader.clearing_doc || "",
                children: []
            };
            
            // Backend returns hierarchy as nested structure: hierarchy[0] is header with children
            var aHierarchy = oHierarchyData.hierarchy || [];
            
            // The first element in hierarchy is the header node with nested children
            if (aHierarchy.length > 0 && aHierarchy[0].children) {
                var aBackendChildren = aHierarchy[0].children || [];
                
                // Process each cheque/item (Level 2)
                aBackendChildren.forEach(function (oBackendCheque) {
                    var oChequeNode = {
                        id: oBackendCheque.nodeId || oBackendCheque.id,
                        type: "CHEQUE",
                        displayText: oBackendCheque.label || ("Cheque: " + (oBackendCheque.cheque || "N/A")),
                        deposit_datetime: "",
                        amount: oBackendCheque.amount || "",
                        status: "",
                        processingFlow: oBackendCheque.processingFlow || "Not Processed",
                        processingStages: oBackendCheque.processingStages || Object.assign({}, oDefaultStages),
                        ar_posting_doc: "",
                        payment_advice_doc: "",
                        on_account_doc: "",
                        clearing_doc: "",
                        children: []
                    };
                    
                    // Process payment references (Level 3)
                    if (oBackendCheque.children && oBackendCheque.children.length > 0) {
                        oBackendCheque.children.forEach(function (oBackendPayRef) {
                            var oPayRefNode = {
                                id: oBackendPayRef.nodeId || oBackendPayRef.id,
                                type: "PAYMENT_REF",
                                displayText: oBackendPayRef.label || ("Ref: " + (oBackendPayRef.paymentReference || "N/A")),
                                deposit_datetime: "",
                                amount: oBackendPayRef.amount || oBackendPayRef.netAmount || "",
                                status: "",
                                processingFlow: oBackendPayRef.processingFlow || "Not Processed",
                                processingStages: oBackendPayRef.processingStages || Object.assign({}, oDefaultStages),
                                ar_posting_doc: "",
                                payment_advice_doc: "",
                                on_account_doc: "",
                                clearing_doc: "",
                                children: []
                            };
                            oChequeNode.children.push(oPayRefNode);
                        });
                    }
                    
                    oNode.children.push(oChequeNode);
                });
            }
            
            return oNode;
        },
        
        // Tree row selection handler
        onTreeRowSelect: function (oEvent) {
            var that = this;
            var oTable = oEvent.getSource();
            var iSelectedIndex = oTable.getSelectedIndex();
            
            if (iSelectedIndex >= 0) {
                var oContext = oTable.getContextByIndex(iSelectedIndex);
                if (oContext) {
                    var oRowData = oContext.getObject();
                    var oModel = this.getOwnerComponent().getModel("app");
                    
                    // Only set selectedHeader for HEADER type rows
                    if (oRowData.type === "HEADER") {
                        oModel.setProperty("/selectedHeader", oRowData.id);
                        
                        // If this row has a runId, fetch the full run details
                        if (oRowData.runId) {
                            fetch(API_BASE + "/lockbox/runs/" + oRowData.runId)
                                .then(function(response) { return response.json(); })
                                .then(function(data) {
                                    if (data.run) {
                                        oModel.setProperty("/selectedRun", data.run);
                                        MessageToast.show("Selected: " + oRowData.displayText + " (" + data.run.overallStatus + ")");
                                    }
                                })
                                .catch(function(err) {
                                    console.error("Error loading run details:", err);
                                });
                        }
                        
                        // Find the full header details from headers array (legacy support)
                        var aHeaders = oModel.getProperty("/headers") || [];
                        var oHeaderDetails = aHeaders.find(function (h) { return h.id === oRowData.id; });
                        if (oHeaderDetails) {
                            oModel.setProperty("/selectedHeaderDetails", oHeaderDetails);
                        }
                    }
                }
            }
        },
        
        // Tree toggle handler (expand/collapse)
        onTreeToggle: function (oEvent) {
            // Optional: handle expand/collapse events if needed
        },

        // Load hierarchy for selected header
        _loadHierarchy: function (sHeaderId) {
            var that = this;
            BusyIndicator.show(0);

            fetch(API_BASE + "/lockbox/hierarchy/" + sHeaderId, {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            })
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error("HTTP " + response.status);
                    }
                    return response.json();
                })
                .then(function (data) {
                    var oModel = that.getOwnerComponent().getModel("app");
                    
                    // Use the pre-built hierarchy from backend
                    var aHierarchy = data.hierarchy || [];
                    
                    oModel.setProperty("/hierarchy", aHierarchy);
                    oModel.setProperty("/selectedHeaderDetails", data.header);
                    oModel.setProperty("/sapResponse", data.header.sap_response || "");
                    
                    BusyIndicator.hide();
                })
                .catch(function (error) {
                    console.error("Error loading hierarchy:", error);
                    MessageToast.show("Error loading lockbox hierarchy: " + error.message);
                    BusyIndicator.hide();
                });
        },

        // Tab selection
        onTabSelect: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            if (sKey === "review" || sKey === "post") {
                var oModel = this.getOwnerComponent().getModel("app");
                var sHeaderId = oModel.getProperty("/selectedHeader");
                if (sHeaderId) {
                    this._loadHierarchy(sHeaderId);
                }
            }
        },

        // Header selection
        onHeaderSelect: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext("app");
            var oHeader = oContext.getObject();
            
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/selectedHeader", oHeader.id);
            oModel.setProperty("/selectedHeaderDetails", oHeader);
            
            // Load hierarchy
            this._loadHierarchy(oHeader.id);
            
            MessageToast.show("Selected Lockbox: " + oHeader.lockbox);
        },

        // Review tab lockbox selection (from Table)
        onReviewLockboxSelect: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (!oSelectedItem) return;
            
            var oContext = oSelectedItem.getBindingContext("app");
            var oHeader = oContext.getObject();
            
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/selectedHeader", oHeader.id);
            
            this._loadHierarchy(oHeader.id);
        },

        // Delete lockbox from Review tab
        onDeleteLockboxReview: function (oEvent) {
            var that = this;
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oHeader = oContext.getObject();
            
            if (oHeader.status === 'POSTED') {
                MessageBox.error("Cannot delete a posted lockbox");
                return;
            }
            
            MessageBox.confirm("Are you sure you want to delete Lockbox '" + oHeader.lockbox + "'?", {
                title: "Confirm Delete",
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        that._deleteLockbox(oHeader.id, oHeader.lockbox);
                    }
                }
            });
        },

        // Internal delete function
        _deleteLockbox: function (sHeaderId, sLockboxName) {
            var that = this;
            BusyIndicator.show(0);
            
            fetch(API_BASE + "/lockbox/headers/" + sHeaderId, {
                method: "DELETE",
                headers: {
                    "Accept": "application/json"
                }
            })
            .then(function (response) {
                BusyIndicator.hide();
                if (response.ok) {
                    MessageToast.show("Lockbox '" + sLockboxName + "' deleted successfully");
                    
                    // Clear selection and hierarchy if deleted item was selected
                    var oModel = that.getOwnerComponent().getModel("app");
                    if (oModel.getProperty("/selectedHeader") === sHeaderId) {
                        oModel.setProperty("/selectedHeader", null);
                        oModel.setProperty("/hierarchy", []);
                    }
                    
                    that._loadHeaders();
                } else {
                    MessageBox.error("Failed to delete lockbox");
                }
            })
            .catch(function (error) {
                BusyIndicator.hide();
                MessageBox.error("Error deleting lockbox: " + error.message);
            });
        },

        // Refresh headers
        onRefreshHeaders: function () {
            this._loadHeaders();
            MessageToast.show("Headers refreshed");
        },

        // Download template - Direct download
        onDownloadTemplate: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oTemplateConfig = oModel.getProperty("/templateConfig");
            
            // Build query params with selected fields and their constant values
            var aHeaderFields = oTemplateConfig.header.filter(function(f) { return f.selected; });
            var aChequesFields = oTemplateConfig.cheques.filter(function(f) { return f.selected; });
            var aPaymentRefFields = oTemplateConfig.paymentReferences.filter(function(f) { return f.selected; });
            
            // Encode the configuration as JSON and pass to backend
            var oConfig = {
                header: aHeaderFields,
                cheques: aChequesFields,
                paymentReferences: aPaymentRefFields
            };
            
            // Create form and submit to download
            var sUrl = API_BASE + "/lockbox/template?config=" + encodeURIComponent(JSON.stringify(oConfig));
            window.open(sUrl, "_blank");
            MessageToast.show("Downloading customized template...");
        },
        
        // Open Upload Dialog
        onOpenUploadDialog: function () {
            var that = this;
            
            // Create FileUploader for the dialog - accepts ALL file formats
            if (!this._oDialogFileUploader) {
                this._oDialogFileUploader = new FileUploader({
                    id: "dialogFileUploader",
                    name: "lockboxFile",
                    fileType: ["xlsx", "xls", "csv", "pdf", "txt", "bai", "bai2", "xml", "json", "tsv"],
                    placeholder: "Select file (Excel, CSV, BAI2, PDF, Text, XML, JSON)",
                    width: "100%",
                    change: function (oEvent) {
                        var sFileName = oEvent.getParameter("newValue");
                        if (sFileName) {
                            MessageToast.show("File selected: " + sFileName);
                        }
                    },
                    typeMissmatch: function () {
                        MessageBox.warning("File type not in standard list, but will attempt to process. Supported: Excel, CSV, PDF, BAI2, Text, XML, JSON");
                    }
                });
            }
            
            // Create Upload Dialog
            if (!this._oUploadDialog) {
                this._oUploadDialog = new Dialog({
                    title: "Upload Lockbox File",
                    contentWidth: "450px",
                    content: [
                        new VBox({
                            items: [
                                new Label({
                                    text: "File:",
                                    required: true,
                                    labelFor: "dialogFileUploader"
                                }).addStyleClass("sapUiSmallMarginTop"),
                                this._oDialogFileUploader
                            ]
                        }).addStyleClass("sapUiSmallMargin")
                    ],
                    beginButton: new Button({
                        text: "Upload",
                        type: "Emphasized",
                        press: function () {
                            that._doUploadFromDialog();
                        }
                    }),
                    endButton: new Button({
                        text: "Cancel",
                        press: function () {
                            that._oUploadDialog.close();
                        }
                    }),
                    afterClose: function () {
                        // Clear the file uploader after dialog closes
                        if (that._oDialogFileUploader) {
                            that._oDialogFileUploader.clear();
                        }
                    }
                });
                
                this.getView().addDependent(this._oUploadDialog);
            }
            
            // Clear previous selection and open
            this._oDialogFileUploader.clear();
            this._oUploadDialog.open();
        },
        
        // Perform upload from dialog - Uses automated processing engine
        _doUploadFromDialog: function () {
            var that = this;
            var oFileUploader = this._oDialogFileUploader;
            
            // Get the file from the FileUploader
            var aFiles = oFileUploader.oFileUpload ? oFileUploader.oFileUpload.files : null;
            
            // Fallback: try getting from DOM
            if (!aFiles || aFiles.length === 0) {
                var oDomRef = oFileUploader.getDomRef();
                if (oDomRef) {
                    var oInput = oDomRef.querySelector('input[type="file"]');
                    if (oInput) {
                        aFiles = oInput.files;
                    }
                }
            }
            
            if (!aFiles || aFiles.length === 0) {
                MessageBox.warning("Please select a file to upload");
                return;
            }
            
            var oFile = aFiles[0];
            
            // Close dialog and show busy indicator
            this._oUploadDialog.close();
            BusyIndicator.show(0);
            
            // Create FormData for multipart upload
            var oFormData = new FormData();
            oFormData.append("file", oFile, oFile.name);
            
            // Use XMLHttpRequest for proper multipart handling - call /lockbox/process
            var oXhr = new XMLHttpRequest();
            oXhr.open("POST", API_BASE + "/lockbox/process", true);
            
            oXhr.onload = function () {
                BusyIndicator.hide();
                
                try {
                    var oResponse = JSON.parse(oXhr.responseText);
                    var oModel = that.getOwnerComponent().getModel("app");
                    
                    if (oResponse.success) {
                        // Store the run data
                        var aRuns = oModel.getProperty("/processingRuns") || [];
                        aRuns.unshift(oResponse.run);
                        oModel.setProperty("/processingRuns", aRuns);
                        oModel.setProperty("/selectedRun", oResponse.run);
                        
                        // Immediately refresh the run history to update TreeTable
                        that._loadRunHistory();
                        
                        // Build step-by-step processing status message
                        var sStageInfo = that._formatProcessingStagesDetailed(oResponse.run);
                        
                        MessageBox.success(sStageInfo, {
                            title: "✅ Processing Complete - " + oResponse.run.runId,
                            onClose: function () {
                                // Refresh again after dialog closes
                                that._loadRunHistory();
                                // Update hierarchy display
                                if (oResponse.run.hierarchy && oResponse.run.hierarchy.length > 0) {
                                    oModel.setProperty("/lockboxHierarchy", oResponse.run.hierarchy);
                                }
                            }
                        });
                    } else {
                        // Handle failed processing - show which stage failed
                        var sFailedStage = oResponse.run.lastFailedStage || "unknown";
                        var sStageInfo = that._formatProcessingStagesDetailed(oResponse.run);
                        
                        // Store failed run for reprocessing
                        var aRuns = oModel.getProperty("/processingRuns") || [];
                        aRuns.unshift(oResponse.run);
                        oModel.setProperty("/processingRuns", aRuns);
                        oModel.setProperty("/selectedRun", oResponse.run);
                        
                        MessageBox.error(sStageInfo + "\n\n⚠️ Please check Field Mapping Rules:\n- Customer Templates (for template matching)\n- My Rules (for transformation rules)\n\nThen click 'Reprocess' in Run History.", {
                            title: "❌ Processing Failed at: " + sFailedStage.toUpperCase()
                        });
                    }
                } catch (e) {
                    MessageBox.error("Error parsing response: " + e.message + "\n\nPlease check if the file format is supported.");
                }
            };
            
            oXhr.onerror = function () {
                BusyIndicator.hide();
                MessageBox.error("Network error during upload. Please try again.");
            };
            
            // Send the form data
            oXhr.send(oFormData);
        },

        
        // Format processing stages with detailed step-by-step info
        _formatProcessingStagesDetailed: function (oRun) {
            var sResult = "";
            var oStages = oRun.stages;
            
            sResult += "📁 File: " + oRun.filename + "\n";
            sResult += "🔖 Run ID: " + oRun.runId + "\n";
            sResult += "📊 Status: " + oRun.overallStatus.toUpperCase() + "\n\n";
            sResult += "═══════════════════════════════════\n";
            sResult += "PROCESSING STEPS:\n";
            sResult += "═══════════════════════════════════\n\n";
            
            // Stage 1: Upload
            var uploadIcon = oStages.upload.status === 'success' ? '✅' : oStages.upload.status === 'error' ? '❌' : '⏳';
            sResult += uploadIcon + " STEP 1: UPLOAD\n";
            sResult += "   " + (oStages.upload.message || oStages.upload.status) + "\n\n";
            
            // Stage 2: Template Match
            var templateIcon = oStages.templateMatch.status === 'success' ? '✅' : oStages.templateMatch.status === 'error' ? '❌' : '⏳';
            sResult += templateIcon + " STEP 2: TEMPLATE MATCHING\n";
            if (oStages.templateMatch.templateId) {
                sResult += "   Template ID: " + oStages.templateMatch.templateId + "\n";
                sResult += "   Template: " + (oStages.templateMatch.templateName || '') + "\n";
                sResult += "   Match Score: " + (oStages.templateMatch.matchScore || 0) + "\n";
            }
            sResult += "   " + (oStages.templateMatch.message || oStages.templateMatch.status) + "\n\n";
            
            // Stage 3: Extraction
            var extractIcon = oStages.extraction.status === 'success' ? '✅' : oStages.extraction.status === 'error' ? '❌' : '⏳';
            sResult += extractIcon + " STEP 3: EXTRACTION & TRANSFORMATION\n";
            sResult += "   Records: " + (oStages.extraction.rowCount || 0) + "\n";
            if (oStages.extraction.appliedRules && oStages.extraction.appliedRules.length > 0) {
                sResult += "   Rules Applied:\n";
                oStages.extraction.appliedRules.forEach(function (r) {
                    sResult += "     • " + r.rule + " (" + r.action + ")\n";
                    if (r.from && r.to) {
                        sResult += "       Split: " + r.from + " → " + r.to.join(", ") + "\n";
                    }
                });
            }
            sResult += "   " + (oStages.extraction.message || oStages.extraction.status) + "\n\n";
            
            // Stage 4: Validation
            var validateIcon = oStages.validation.status === 'success' ? '✅' : oStages.validation.status === 'warning' ? '⚠️' : oStages.validation.status === 'error' ? '❌' : '⏳';
            sResult += validateIcon + " STEP 4: VALIDATION\n";
            if (oStages.validation.warnings && oStages.validation.warnings.length > 0) {
                sResult += "   Warnings: " + oStages.validation.warnings.length + "\n";
            }
            if (oStages.validation.errors && oStages.validation.errors.length > 0) {
                sResult += "   Errors: " + oStages.validation.errors.length + "\n";
            }
            sResult += "   " + (oStages.validation.message || oStages.validation.status) + "\n\n";
            
            // Stage 5: Mapping
            var mapIcon = oStages.mapping.status === 'success' ? '✅' : oStages.mapping.status === 'error' ? '❌' : '⏳';
            sResult += mapIcon + " STEP 5: API FIELD MAPPING\n";
            sResult += "   " + (oStages.mapping.message || oStages.mapping.status) + "\n\n";
            
            // Next steps
            if (oRun.overallStatus === 'validated') {
                sResult += "═══════════════════════════════════\n";
                sResult += "✅ READY FOR NEXT STEPS:\n";
                sResult += "═══════════════════════════════════\n";
                sResult += "1. Click 'Simulate' to preview SAP posting\n";
                sResult += "2. Click 'Production Run' to commit to SAP\n";
            }
            
            return sResult;
        },

        // File change handler (legacy - kept for compatibility)
        onFileChange: function (oEvent) {
            var sFileName = oEvent.getParameter("newValue");
            if (sFileName) {
                MessageToast.show("File selected: " + sFileName);
            }
        },

        // Type mismatch handler
        onTypeMissmatch: function (oEvent) {
            MessageBox.error("Please select an Excel file (.xlsx or .xls)");
        },

        // Upload handler - Now uses automated processing engine
        onUpload: function () {
            var that = this;
            var oFileUploader = this.byId("fileUploader");
            
            // Get the file from the FileUploader using the correct method
            var aFiles = oFileUploader.oFileUpload ? oFileUploader.oFileUpload.files : null;
            
            // Fallback: try getting from DOM
            if (!aFiles || aFiles.length === 0) {
                var oDomRef = oFileUploader.getDomRef();
                if (oDomRef) {
                    var oInput = oDomRef.querySelector('input[type="file"]');
                    if (oInput) {
                        aFiles = oInput.files;
                    }
                }
            }
            
            if (!aFiles || aFiles.length === 0) {
                MessageBox.warning("Please select a file to upload");
                return;
            }
            
            var oFile = aFiles[0];

            BusyIndicator.show(0);

            // Create FormData for multipart upload - now using /process endpoint
            var oFormData = new FormData();
            oFormData.append("file", oFile, oFile.name);

            // Use XMLHttpRequest for proper multipart handling
            var oXhr = new XMLHttpRequest();
            oXhr.open("POST", API_BASE + "/lockbox/process", true);
            
            oXhr.onload = function () {
                BusyIndicator.hide();
                
                try {
                    var oResponse = JSON.parse(oXhr.responseText);
                    var oModel = that.getOwnerComponent().getModel("app");
                    
                    if (oResponse.success) {
                        // Store the run data
                        var aRuns = oModel.getProperty("/processingRuns") || [];
                        aRuns.unshift(oResponse.run);
                        oModel.setProperty("/processingRuns", aRuns);
                        oModel.setProperty("/selectedRun", oResponse.run);
                        
                        // Show success with processing status
                        var sStageInfo = that._formatProcessingStages(oResponse.run.stages);
                        
                        MessageBox.success(
                            "File processed successfully!\n\n" +
                            "Run ID: " + oResponse.run.runId + "\n" +
                            "Status: " + oResponse.run.overallStatus.toUpperCase() + "\n\n" +
                            "Processing Stages:\n" + sStageInfo + "\n\n" +
                            "Click 'Simulate' to preview SAP posting or 'Production Run' to commit.", {
                            title: "Processing Complete",
                            onClose: function () {
                                oFileUploader.clear();
                                that._loadRunHistory();
                                // Update hierarchy display
                                if (oResponse.run.hierarchy && oResponse.run.hierarchy.length > 0) {
                                    oModel.setProperty("/lockboxHierarchy", oResponse.run.hierarchy);
                                }
                            }
                        });
                    } else {
                        // Handle failed processing
                        var sFailedStage = oResponse.run.lastFailedStage || "unknown";
                        var sStageInfo = that._formatProcessingStages(oResponse.run.stages);
                        var sErrorMsg = oResponse.run.stages[sFailedStage]?.message || "Unknown error";
                        
                        // Store failed run for reprocessing
                        var aRuns = oModel.getProperty("/processingRuns") || [];
                        aRuns.unshift(oResponse.run);
                        oModel.setProperty("/processingRuns", aRuns);
                        oModel.setProperty("/selectedRun", oResponse.run);
                        
                        MessageBox.error(
                            "Processing failed at stage: " + sFailedStage.toUpperCase() + "\n\n" +
                            "Error: " + sErrorMsg + "\n\n" +
                            "Processing Stages:\n" + sStageInfo + "\n\n" +
                            "Please check your templates and rules in Field Mapping Rules, then click 'Reprocess'.", {
                            title: "Processing Failed"
                        });
                    }
                } catch (e) {
                    MessageBox.error("Error parsing response: " + e.message);
                }
            };
            
            oXhr.onerror = function () {
                BusyIndicator.hide();
                MessageBox.error("Network error during upload");
            };
            
            // Send the form data (do NOT set Content-Type header - browser sets it with boundary)
            oXhr.send(oFormData);
        },

        // Format processing stages for display
        _formatProcessingStages: function (oStages) {
            var aStageOrder = ['upload', 'templateMatch', 'extraction', 'validation', 'mapping'];
            var aStageLabels = {
                'upload': 'Upload',
                'templateMatch': 'Template Match',
                'extraction': 'Extraction',
                'validation': 'Validation',
                'mapping': 'API Mapping'
            };
            
            var sResult = "";
            aStageOrder.forEach(function (sStage) {
                var oStage = oStages[sStage];
                var sIcon = "";
                if (oStage.status === 'success') sIcon = "✅";
                else if (oStage.status === 'warning') sIcon = "⚠️";
                else if (oStage.status === 'error') sIcon = "❌";
                else sIcon = "⏳";
                
                sResult += sIcon + " " + aStageLabels[sStage] + ": " + (oStage.message || oStage.status) + "\n";
            });
            
            return sResult;
        },

        // Load run history from server
        _loadRunHistory: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            fetch(API_BASE + "/lockbox/runs")
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    var aRuns = data.runs || [];
                    oModel.setProperty("/processingRuns", aRuns);
                    
                    // Update lockbox ID dropdown with runs
                    var aLockboxIds = oModel.getProperty("/lockboxIdList") || [{ key: "", text: "All" }];
                    var existingKeys = new Set(aLockboxIds.map(function(item) { return item.key; }));
                    
                    // Add lockbox IDs from processing runs
                    aRuns.forEach(function(run) {
                        if (run.sapPayload && run.sapPayload.Lockbox) {
                            var lockboxId = run.sapPayload.Lockbox;
                            if (!existingKeys.has(lockboxId)) {
                                aLockboxIds.push({ key: lockboxId, text: lockboxId });
                                existingKeys.add(lockboxId);
                            }
                        }
                    });
                    oModel.setProperty("/lockboxIdList", aLockboxIds);
                    
                    // Build tree data from runs for the TreeTable
                    that._buildTreeDataFromRuns(aRuns);
                })
                .catch(function (err) {
                    console.error("Error loading run history:", err);
                });
        },
        
        // Build tree data from processing runs
        _buildTreeDataFromRuns: function (aRuns) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var aTreeData = [];
            
            // Fetch hierarchy for each run that has been validated/simulated/posted/failed/error
            var aValidRuns = aRuns.filter(function(run) {
                return ['validated', 'simulated', 'posted', 'failed', 'error'].includes(run.overallStatus);
            });
            
            if (aValidRuns.length === 0) {
                oModel.setProperty("/treeData", []);
                return;
            }
            
            // Fetch hierarchy for each run
            var aPromises = aValidRuns.map(function(run) {
                return fetch(API_BASE + "/lockbox/runs/" + run.runId + "/hierarchy")
                    .then(function(response) { return response.json(); })
                    .then(function(data) {
                        return { run: run, hierarchy: data.hierarchy || [] };
                    })
                    .catch(function() {
                        return { run: run, hierarchy: [] };
                    });
            });
            
            Promise.all(aPromises).then(function(results) {
                var aTreeData = [];
                
                results.forEach(function(result) {
                    var run = result.run;
                    var hierarchy = result.hierarchy;
                    
                    // Create tree structure from hierarchy
                    // Hierarchy: Lockbox ID → Cheque → Payment (with Customer as column)
                    hierarchy.forEach(function(lockbox) {
                        // Determine stage statuses for visual display
                        var stages = run.stages || {};
                        // Only show simulate as success if simulate stage exists and is successful
                        var bSimulateSuccess = stages.simulate && stages.simulate.status === 'success';
                        // Only show posted as success if overallStatus is 'posted'
                        var bPostedSuccess = run.overallStatus === 'posted';
                        
                        // Level 1: Lockbox ID (auto-generated per file)
                        var lockboxNode = {
                            id: run.runId + "_lockbox_" + (lockbox.lockbox || lockbox.nodeId),
                            runId: run.runId,
                            type: "LOCKBOX",
                            displayText: lockbox.lockbox || lockbox.displayText || run.filename,
                            lockbox: lockbox.lockbox,
                            sourceFile: lockbox.sourceFile || run.filename || '', // Source file column
                            batchId: lockbox.batchId || "001", // Batch ID column
                            itemId: "", // Empty for lockbox level
                            customer: lockbox.customer || '', // Customer column
                            deposit_datetime: lockbox.deposit_datetime || run.startedAt,
                            amount: lockbox.amount || 0,
                            currency: lockbox.currency || "USD",
                            status: run.overallStatus.toUpperCase(),
                            // Stage statuses for visual processing flow circles
                            // Each stage only shows green when actually completed successfully
                            stages: {
                                upload: stages.upload?.status || 'pending',
                                templateMatch: stages.templateMatch?.status || 'pending',
                                extraction: stages.extraction?.status || 'pending',
                                validation: stages.validation?.status || 'pending',
                                mapping: stages.mapping?.status || 'pending',
                                simulate: bSimulateSuccess ? 'success' : 'pending',
                                posted: bPostedSuccess ? 'success' : 'pending'
                            },
                            ar_posting_doc: lockbox.arPostingDoc || "",
                            payment_advice_doc: lockbox.paymentAdvice || "",
                            clearing_doc: lockbox.clearingDocument || "",
                            children: []
                        };
                        
                        // Level 2: Cheque/Item (multiple items under Lockbox)
                        if (lockbox.children && lockbox.children.length > 0) {
                            lockbox.children.forEach(function(cheque, chequeIdx) {
                                var chequeNode = {
                                    id: run.runId + "_cheque_" + (cheque.cheque || chequeIdx),
                                    runId: run.runId,
                                    type: "CHEQUE",
                                    displayText: cheque.cheque || cheque.displayText || ("Check " + (chequeIdx + 1)),
                                    cheque: cheque.cheque,
                                    batchId: lockbox.batchId || "001", // Batch ID
                                    itemId: cheque.itemId || String(chequeIdx + 1).padStart(3, '0'), // Item ID (001, 002, etc.)
                                    customer: cheque.customer || '', // Customer column
                                    amount: cheque.amount || 0,
                                    currency: cheque.currency || "USD",
                                    depositDate: cheque.depositDate,
                                    partnerBank: cheque.partnerBank,
                                    partnerBankAccount: cheque.partnerBankAccount,
                                    status: "",
                                    children: []
                                };
                                
                                // Level 3: Payment Reference under Cheque
                                if (cheque.children && cheque.children.length > 0) {
                                    cheque.children.forEach(function(payment, paymentIdx) {
                                        var paymentNode = {
                                            id: run.runId + "_payment_" + (payment.paymentReference || paymentIdx),
                                            runId: run.runId,
                                            type: "PAYMENT",
                                            displayText: payment.paymentReference || payment.displayText || ("Payment " + (paymentIdx + 1)),
                                            paymentReference: payment.paymentReference,
                                            batchId: "", // Empty for payment level
                                            itemId: cheque.itemId || String(chequeIdx + 1).padStart(3, '0'), // Same item ID as parent check
                                            customer: payment.customer || '', // Customer column
                                            amount: payment.netAmount || 0,
                                            netAmount: payment.netAmount || 0,
                                            deductionAmount: payment.deductionAmount || 0,
                                            reasonCode: payment.reasonCode,
                                            currency: payment.currency || "USD",
                                            status: "",
                                            children: []
                                        };
                                        chequeNode.children.push(paymentNode);
                                    });
                                }
                                
                                lockboxNode.children.push(chequeNode);
                            });
                        }
                        
                        aTreeData.push(lockboxNode);
                    });
                });
                
                oModel.setProperty("/treeData", aTreeData);
                
                // Extract flat lockbox list for the main table (only top-level lockbox nodes)
                var aLockboxList = aTreeData.map(function(lockboxNode) {
                    // Find the corresponding run to get actual deposit date and status
                    var run = aValidRuns.find(function(r) { return r.runId === lockboxNode.runId; });
                    
                    // Get deposit date from extractedData (actual file data)
                    var depositDate = lockboxNode.deposit_datetime;
                    if (run && run.extractedData && run.extractedData.length > 0) {
                        depositDate = run.extractedData[0]['Deposit Date'] || 
                                     run.extractedData[0]['DepositDate'] || 
                                     depositDate;
                    }
                    
                    // Get proper status - map overallStatus to display status
                    var status = 'PENDING';
                    if (run) {
                        var overallStatus = run.overallStatus ? run.overallStatus.toLowerCase() : '';
                        if (overallStatus === 'posted') {
                            status = 'POSTED';
                        } else if (overallStatus === 'simulated') {
                            status = 'SIMULATED';
                        } else if (overallStatus === 'validated') {
                            status = 'VALIDATED';
                        } else if (overallStatus === 'failed' || overallStatus === 'error') {
                            status = 'ERROR';
                        }
                    }
                    
                    return {
                        runId: lockboxNode.runId,
                        lockbox: lockboxNode.lockbox,
                        filename: lockboxNode.sourceFile,
                        deposit_datetime: depositDate,
                        status: status,
                        stages: lockboxNode.stages,
                        amount: lockboxNode.amount,
                        currency: lockboxNode.currency,
                        type: lockboxNode.type,
                        uploadedAt: run ? run.uploadedAt || run.startedAt : null
                    };
                });
                
                // Sort by upload time (newest first)
                aLockboxList.sort(function(a, b) {
                    var dateA = new Date(a.uploadedAt || 0);
                    var dateB = new Date(b.uploadedAt || 0);
                    return dateB - dateA; // Descending order (newest first)
                });
                
                // Store full list and initialize pagination
                oModel.setProperty("/lockboxListFull", aLockboxList);
                that._updatePagination(1); // Show first page
                
                // If we have data, auto-select the first item
                if (aTreeData.length > 0) {
                    var firstRun = aValidRuns[0];
                    // Find and set the selected run
                    fetch(API_BASE + "/lockbox/runs/" + firstRun.runId)
                        .then(function(response) { return response.json(); })
                        .then(function(data) {
                            if (data.run) {
                                oModel.setProperty("/selectedRun", data.run);
                            }
                        });
                }
            });
        },
        
        // Get processing flow status text
        _getProcessingFlowText: function (run) {
            if (!run || !run.stages) return "";
            
            var stages = run.stages;
            var icons = [];
            
            icons.push(stages.upload?.status === 'success' ? '✅' : stages.upload?.status === 'error' ? '❌' : '⏳');
            icons.push(stages.templateMatch?.status === 'success' ? '✅' : stages.templateMatch?.status === 'error' ? '❌' : '⏳');
            icons.push(stages.extraction?.status === 'success' ? '✅' : stages.extraction?.status === 'error' ? '❌' : '⏳');
            icons.push(stages.validation?.status === 'success' ? '✅' : stages.validation?.status === 'warning' ? '⚠️' : stages.validation?.status === 'error' ? '❌' : '⏳');
            icons.push(stages.mapping?.status === 'success' ? '✅' : stages.mapping?.status === 'error' ? '❌' : '⏳');
            
            return icons.join(' → ');
        },

        // Show Run History dialog
        onRunHistory: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Load latest runs
            this._loadRunHistory();
            
            // Create dialog if not exists
            if (!this._oRunHistoryDialog) {
                this._oRunHistoryDialog = new Dialog({
                    title: "Processing Run History",
                    contentWidth: "900px",
                    contentHeight: "500px",
                    draggable: true,
                    resizable: true,
                    content: [
                        new sap.m.Table({
                            id: "runHistoryTable",
                            columns: [
                                new sap.m.Column({ header: new sap.m.Text({ text: "Run ID" }), width: "15%" }),
                                new sap.m.Column({ header: new sap.m.Text({ text: "File" }), width: "20%" }),
                                new sap.m.Column({ header: new sap.m.Text({ text: "Status" }), width: "12%" }),
                                new sap.m.Column({ header: new sap.m.Text({ text: "Upload" }), width: "8%" }),
                                new sap.m.Column({ header: new sap.m.Text({ text: "Template" }), width: "8%" }),
                                new sap.m.Column({ header: new sap.m.Text({ text: "Extract" }), width: "8%" }),
                                new sap.m.Column({ header: new sap.m.Text({ text: "Validate" }), width: "8%" }),
                                new sap.m.Column({ header: new sap.m.Text({ text: "Map" }), width: "8%" }),
                                new sap.m.Column({ header: new sap.m.Text({ text: "Actions" }), width: "13%" })
                            ],
                            items: {
                                path: "app>/processingRuns",
                                template: new sap.m.ColumnListItem({
                                    cells: [
                                        new sap.m.Text({ text: "{app>runId}" }),
                                        new sap.m.Text({ text: "{app>filename}" }),
                                        new sap.m.ObjectStatus({
                                            text: "{app>overallStatus}",
                                            state: {
                                                path: "app>overallStatus",
                                                formatter: function (sStatus) {
                                                    if (sStatus === "validated" || sStatus === "simulated" || sStatus === "posted") return "Success";
                                                    if (sStatus === "failed") return "Error";
                                                    return "Warning";
                                                }
                                            }
                                        }),
                                        new sap.m.ObjectStatus({ text: { path: "app>stages/upload/status", formatter: that._formatStageIcon } }),
                                        new sap.m.ObjectStatus({ text: { path: "app>stages/templateMatch/status", formatter: that._formatStageIcon } }),
                                        new sap.m.ObjectStatus({ text: { path: "app>stages/extraction/status", formatter: that._formatStageIcon } }),
                                        new sap.m.ObjectStatus({ text: { path: "app>stages/validation/status", formatter: that._formatStageIcon } }),
                                        new sap.m.ObjectStatus({ text: { path: "app>stages/mapping/status", formatter: that._formatStageIcon } }),
                                        new sap.m.HBox({
                                            items: [
                                                new Button({
                                                    icon: "sap-icon://detail-view",
                                                    tooltip: "View Details",
                                                    type: "Transparent",
                                                    press: function (oEvent) {
                                                        var oContext = oEvent.getSource().getBindingContext("app");
                                                        var oRun = oContext.getObject();
                                                        that._showRunDetails(oRun.runId);
                                                    }
                                                }),
                                                new Button({
                                                    icon: "sap-icon://refresh",
                                                    tooltip: "Reprocess",
                                                    type: "Transparent",
                                                    visible: "{= ${app>overallStatus} === 'failed'}",
                                                    press: function (oEvent) {
                                                        var oContext = oEvent.getSource().getBindingContext("app");
                                                        var oRun = oContext.getObject();
                                                        that._reprocessRun(oRun.runId);
                                                    }
                                                })
                                            ]
                                        })
                                    ]
                                })
                            }
                        })
                    ],
                    beginButton: new Button({
                        text: "Close",
                        press: function () {
                            that._oRunHistoryDialog.close();
                        }
                    })
                });
                
                this.getView().addDependent(this._oRunHistoryDialog);
            }
            
            this._oRunHistoryDialog.open();
        },

        // Format stage status icon
        _formatStageIcon: function (sStatus) {
            if (sStatus === "success") return "✅";
            if (sStatus === "warning") return "⚠️";
            if (sStatus === "error") return "❌";
            return "⏳";
        },

        // Show run details
        _showRunDetails: function (sRunId) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            BusyIndicator.show(0);
            
            fetch(API_BASE + "/lockbox/runs/" + sRunId)
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.run) {
                        oModel.setProperty("/selectedRun", data.run);
                        
                        // Update hierarchy with run's hierarchy data
                        if (data.run.hierarchy && data.run.hierarchy.length > 0) {
                            oModel.setProperty("/lockboxHierarchy", data.run.hierarchy);
                        }
                        
                        var sDetails = "Run ID: " + data.run.runId + "\n" +
                            "File: " + data.run.filename + "\n" +
                            "Status: " + data.run.overallStatus + "\n\n" +
                            "Processing Stages:\n" + that._formatProcessingStages(data.run.stages);
                        
                        if (data.run.stages.extraction.appliedRules && data.run.stages.extraction.appliedRules.length > 0) {
                            sDetails += "\nApplied Rules:\n";
                            data.run.stages.extraction.appliedRules.forEach(function (r) {
                                sDetails += "- " + r.rule + " (" + r.action + ")\n";
                            });
                        }
                        
                        MessageBox.information(sDetails, { title: "Run Details: " + sRunId });
                    }
                })
                .catch(function (err) {
                    BusyIndicator.hide();
                    MessageBox.error("Error loading run details: " + err.message);
                });
        },

        // Reprocess failed run
        _reprocessRun: function (sRunId) {
            var that = this;
            
            BusyIndicator.show(0);
            
            fetch(API_BASE + "/lockbox/runs/" + sRunId + "/reprocess", {
                method: "POST"
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.success) {
                        MessageToast.show("Reprocess initiated for " + sRunId);
                        that._loadRunHistory();
                    } else {
                        MessageBox.error("Reprocess failed: " + (data.error || "Unknown error"));
                    }
                })
                .catch(function (err) {
                    BusyIndicator.hide();
                    MessageBox.error("Error reprocessing: " + err.message);
                });
        },

        // Simulate from selected run
        onSimulate: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedRun = oModel.getProperty("/selectedRun");
            
            if (!oSelectedRun) {
                MessageBox.warning("Please upload and process a file first");
                return;
            }
            
            if (oSelectedRun.overallStatus !== "validated") {
                MessageBox.warning("Run must be validated before simulation. Current status: " + oSelectedRun.overallStatus);
                return;
            }
            
            BusyIndicator.show(0);
            
            fetch(API_BASE + "/lockbox/runs/" + oSelectedRun.runId + "/simulate", {
                method: "POST"
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.success) {
                        oModel.setProperty("/selectedRun", data.run);
                        that._loadRunHistory();
                        
                        // Update hierarchy with simulated status
                        if (data.run.hierarchy) {
                            oModel.setProperty("/lockboxHierarchy", data.run.hierarchy);
                        }
                        
                        // Show detailed simulation popup with mock accounting data
                        that._showSimulationPopup(data.simulation);
                    } else {
                        MessageBox.error("Simulation failed: " + (data.error || "Unknown error"));
                    }
                })
                .catch(function (err) {
                    BusyIndicator.hide();
                    MessageBox.error("Simulation error: " + err.message);
                });
        },
        
        // Show detailed simulation popup with mock accounting data
        _showSimulationPopup: function(simulation) {
            var that = this;
            var mockData = simulation.mockResponse || {};
            var steps = simulation.steps || {};
            var errorRules = simulation.errorHandlingRules || [];
            var glPostings = simulation.mockAccountingData?.glPostings || [];
            
            // Build step-by-step process display
            var stepsText = "";
            stepsText += "═══════════════════════════════════════════════════════════\n";
            stepsText += "        STEP-BY-STEP SAP API PROCESS (MOCK)\n";
            stepsText += "═══════════════════════════════════════════════════════════\n\n";
            
            // STEP 1: POST LockboxBatch
            stepsText += "┌─────────────────────────────────────────────────────────┐\n";
            stepsText += "│ STEP 1: POST /LockboxBatch                              │\n";
            stepsText += "└─────────────────────────────────────────────────────────┘\n";
            stepsText += "  Status: " + (steps.step1?.status || "SUCCESS") + "\n";
            stepsText += "  HTTP: " + (steps.step1?.httpStatus || 201) + "\n";
            stepsText += "  LockboxBatchInternalKey: " + (mockData.lockboxBatchInternalKey || "N/A") + "\n";
            stepsText += "  Error Rule: HTTP error → Reject request\n\n";
            
            // STEP 2: GET LockboxBatch
            stepsText += "┌─────────────────────────────────────────────────────────┐\n";
            stepsText += "│ STEP 2: GET /LockboxBatch (Verify Status)               │\n";
            stepsText += "└─────────────────────────────────────────────────────────┘\n";
            stepsText += "  Status: " + (steps.step2?.status || "SUCCESS") + "\n";
            stepsText += "  Batch Status: " + (steps.step2?.batchStatus || "OK") + "\n";
            stepsText += "  AccountingDocument: " + (mockData.accountingDocument || "N/A") + "\n";
            stepsText += "  Error Rule: Status = Error → Raise exception\n\n";
            
            // STEP 3: GET LockboxBatchItem
            stepsText += "┌─────────────────────────────────────────────────────────┐\n";
            stepsText += "│ STEP 3: GET /LockboxBatchItem (Payment Details)         │\n";
            stepsText += "└─────────────────────────────────────────────────────────┘\n";
            stepsText += "  Status: " + (steps.step3?.status || "SUCCESS") + "\n";
            stepsText += "  Items Processed: " + (steps.step3?.itemsProcessed || mockData.itemsPosted || 0) + "\n";
            stepsText += "  PaymentAdvice: " + (mockData.paymentAdvice || "N/A") + "\n";
            stepsText += "  Error Rule: Missing payment advice → Manual queue\n\n";
            
            // STEP 4: GET LockboxClearing
            stepsText += "┌─────────────────────────────────────────────────────────┐\n";
            stepsText += "│ STEP 4: GET /LockboxClearing (Clearing Result)          │\n";
            stepsText += "└─────────────────────────────────────────────────────────┘\n";
            stepsText += "  Status: " + (steps.step4?.status || "SUCCESS") + "\n";
            stepsText += "  Clearing Items: " + (steps.step4?.clearingItemsProcessed || 0) + "\n";
            stepsText += "  ClearingDocument: " + (mockData.clearingDocument || "N/A") + "\n";
            stepsText += "  Error Rule: No cleared items → Mark as unapplied\n\n";
            
            // Accounting Documents Summary
            stepsText += "═══════════════════════════════════════════════════════════\n";
            stepsText += "        MOCK ACCOUNTING DOCUMENTS\n";
            stepsText += "═══════════════════════════════════════════════════════════\n\n";
            stepsText += "  Lockbox ID:           " + (mockData.displayLockboxId || mockData.lockboxNumber || "1234") + "\n";
            stepsText += "  Accounting Document:  " + (mockData.accountingDocument || "N/A") + "\n";
            stepsText += "  Payment Advice:       " + (mockData.paymentAdvice || "N/A") + "\n";
            stepsText += "  Clearing Document:    " + (mockData.clearingDocument || "N/A") + "\n";
            stepsText += "  Fiscal Year:          " + (mockData.fiscalYear || new Date().getFullYear()) + "\n";
            stepsText += "  Company Code:         " + (mockData.companyCode || "1710") + "\n";
            stepsText += "  Posting Date:         " + (mockData.postingDate || new Date().toISOString().split('T')[0]) + "\n\n";
            
            // GL Postings
            stepsText += "═══════════════════════════════════════════════════════════\n";
            stepsText += "        EXPECTED GL POSTINGS (MOCK)\n";
            stepsText += "═══════════════════════════════════════════════════════════\n\n";
            stepsText += "  Account        Description                 Debit       Credit\n";
            stepsText += "  ─────────────────────────────────────────────────────────────\n";
            if (glPostings.length > 0) {
                glPostings.forEach(function(posting) {
                    var acct = (posting.account || "").padEnd(14);
                    var desc = (posting.description || "").substring(0, 20).padEnd(22);
                    var debit = (posting.debit || "0.00").padStart(10);
                    var credit = (posting.credit || "0.00").padStart(10);
                    stepsText += "  " + acct + desc + debit + "  " + credit + "\n";
                });
            } else {
                stepsText += "  11000000      Bank Account - Lockbox      " + (mockData.totalAmount || "0.00").padStart(10) + "       0.00\n";
                stepsText += "  14000000      Customer Receivables             0.00  " + (mockData.totalAmount || "0.00").padStart(10) + "\n";
            }
            stepsText += "\n";
            
            // Summary
            stepsText += "═══════════════════════════════════════════════════════════\n";
            stepsText += "  Total Amount: " + (mockData.totalAmount || simulation.summary?.totalAmount || "0.00") + " " + (mockData.currency || "USD") + "\n";
            stepsText += "  Items Posted: " + (mockData.itemsPosted || simulation.summary?.itemCount || 0) + "\n";
            stepsText += "═══════════════════════════════════════════════════════════\n\n";
            stepsText += "⚠️  This is a MOCK simulation. No data has been sent to SAP.\n";
            stepsText += "    Use the Processing Runs view to execute production posting.\n";
            
            // Create and show dialog
            if (!this._oSimulationDialog) {
                this._oSimulationDialog = new sap.m.Dialog({
                    title: "Simulation Result - Mock Accounting Data",
                    contentWidth: "700px",
                    contentHeight: "500px",
                    resizable: true,
                    draggable: true,
                    content: [
                        new sap.m.ScrollContainer({
                            height: "100%",
                            width: "100%",
                            vertical: true,
                            content: [
                                new sap.m.TextArea({
                                    id: "simulationResultText",
                                    value: stepsText,
                                    width: "100%",
                                    rows: 30,
                                    editable: false,
                                    growing: false,
                                    wrapping: "Off"
                                }).addStyleClass("sapUiTinyMargin")
                            ]
                        })
                    ],
                    endButton: new sap.m.Button({
                        text: "Close",
                        type: "Emphasized",
                        press: function () {
                            that._oSimulationDialog.close();
                        }
                    })
                });
                this.getView().addDependent(this._oSimulationDialog);
            } else {
                sap.ui.getCore().byId("simulationResultText").setValue(stepsText);
            }
            
            this._oSimulationDialog.open();
        },

        // Production run from selected run
        onProductionRun: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedRun = oModel.getProperty("/selectedRun");
            
            if (!oSelectedRun) {
                MessageBox.warning("Please upload and process a file first");
                return;
            }
            
            if (oSelectedRun.overallStatus !== "simulated") {
                MessageBox.warning("Run must be simulated before production. Current status: " + oSelectedRun.overallStatus);
                return;
            }
            
            MessageBox.confirm(
                "Are you sure you want to post this lockbox to SAP?\n\n" +
                "Run ID: " + oSelectedRun.runId + "\n" +
                "This action cannot be undone.",
                {
                    title: "Confirm Production Run",
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            that._executeProductionRun(oSelectedRun.runId);
                        }
                    }
                }
            );
        },
        
        // Repost Production - Create new batch run from existing file
        onRepostProduction: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedRun = oModel.getProperty("/selectedRun");
            
            if (!oSelectedRun) {
                MessageBox.warning("Please select a run to repost");
                return;
            }
            
            if (oSelectedRun.overallStatus !== "posted" && oSelectedRun.overallStatus !== "post_failed") {
                MessageBox.warning("Only posted or failed runs can be reposted. Current status: " + oSelectedRun.overallStatus);
                return;
            }
            
            MessageBox.confirm(
                "Create a new batch run from this file?\n\n" +
                "Original Run ID: " + oSelectedRun.runId + "\n" +
                "File: " + oSelectedRun.filename + "\n\n" +
                "This will create a new run with a new Run ID and process it as a separate batch.",
                {
                    title: "Confirm Repost",
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            that._executeRepost(oSelectedRun.runId);
                        }
                    }
                }
            );
        },
        
        // Repost Item - Create new batch run from item in TreeTable
        onRepostItem: function (oEvent) {
            var that = this;
            var oContext = oEvent.getSource().getBindingContext("app");
            var oItem = oContext.getObject();
            
            if (!oItem || !oItem.runId) {
                MessageBox.warning("Invalid item selected");
                return;
            }
            
            // Check if status is POST_FAILED
            if (oItem.status !== 'POST_FAILED') {
                MessageBox.warning("Repost can only be executed for failed postings");
                return;
            }
            
            MessageBox.confirm(
                "Retry production run to SAP S/4HANA?\n\n" +
                "Run ID: " + oItem.runId + "\n" +
                "File: " + (oItem.filename || oItem.name) + "\n\n" +
                "This will retry posting the document to SAP using the existing simulation results.",
                {
                    title: "Confirm Repost",
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            that._executeProductionRun(oItem.runId);
                        }
                    }
                }
            );
        },
        
        // Execute Repost - Creates new run from existing file data
        _executeRepost: function (sOriginalRunId) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            BusyIndicator.show(0);
            
            fetch(API_BASE + "/lockbox/runs/" + sOriginalRunId + "/repost", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.success) {
                        MessageToast.show("New batch run created: " + data.newRunId);
                        
                        // Reload the runs list
                        that._loadRunHistory();
                        
                        // Select the new run
                        if (data.newRun) {
                            oModel.setProperty("/selectedRun", data.newRun);
                        }
                    } else {
                        MessageBox.error("Repost failed: " + (data.message || data.error || "Unknown error"));
                    }
                })
                .catch(function (error) {
                    BusyIndicator.hide();
                    console.error("Repost error:", error);
                    MessageBox.error("Repost failed: " + error.message);
                });
        },

        // Execute production run
        _executeProductionRun: function (sRunId) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            BusyIndicator.show(0);
            
            fetch(API_BASE + "/lockbox/runs/" + sRunId + "/production", {
                method: "POST"
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.success) {
                        oModel.setProperty("/selectedRun", data.run);
                        that._loadRunHistory();
                        
                        // Update hierarchy with posted status and document numbers
                        if (data.run.hierarchy) {
                            oModel.setProperty("/lockboxHierarchy", data.run.hierarchy);
                        }
                        
                        MessageBox.success(
                            "Production Run Successful!\n\n" +
                            "Accounting Document: " + data.production.sapResponse.accountingDocument + "\n" +
                            "Payment Advice: " + data.production.sapResponse.paymentAdvice + "\n" +
                            "Fiscal Year: " + data.production.sapResponse.fiscalYear + "\n\n" +
                            "Clearing Status: " + data.production.clearing.status + "\n" +
                            "Items Cleared: " + data.production.clearing.clearedItems,
                            { title: "Posted to SAP" }
                        );
                    } else {
                        // Extract SAP OData error details from response
                        var oErrorInfo = data.error || {};
                        
                        // Get the actual SAP error message (this is the key!)
                        var sSapErrorMessage = oErrorInfo.sapErrorMessage || 
                                               oErrorInfo.details?.error?.message?.value ||
                                               oErrorInfo.rawResponse?.error?.message?.value ||
                                               data.message || 
                                               "Unknown error";
                        
                        // Build error details object for the dialog
                        var oErrorDetails = {
                            step: "Production Run - STEP1_POST",
                            httpStatus: oErrorInfo.httpStatus,
                            sapErrorCode: oErrorInfo.sapErrorCode,
                            sapErrorMessage: sSapErrorMessage,
                            sapInnerError: oErrorInfo.sapInnerError,
                            timestamp: new Date().toISOString(),
                            sapErrorResponse: oErrorInfo.details || oErrorInfo.rawResponse,
                            sapErrorXml: oErrorInfo.xmlResponse
                        };
                        
                        // Log full response for debugging
                        console.log("=== PRODUCTION RUN FAILED ===");
                        console.log("SAP Error Message:", sSapErrorMessage);
                        console.log("SAP Error Code:", oErrorInfo.sapErrorCode);
                        console.log("HTTP Status:", oErrorInfo.httpStatus);
                        console.log("Error Details:", JSON.stringify(oErrorDetails, null, 2));
                        console.log("Full Response:", JSON.stringify(data, null, 2));
                        
                        // Show detailed error dialog with the actual SAP error
                        that._showProductionErrorDialog(sSapErrorMessage, oErrorDetails, data);
                    }
                })
                .catch(function (err) {
                    BusyIndicator.hide();
                    MessageBox.error("Production run error: " + err.message);
                });
        },
        
        // Show production error dialog with SAP OData error details
        _showProductionErrorDialog: function (sErrorMessage, oErrorDetails, oFullResponse) {
            var that = this;
            
            // Build error content - prioritize SAP error message
            var sContent = "";
            sContent += "SAP Error: " + (oErrorDetails.sapErrorMessage || sErrorMessage) + "\n\n";
            
            if (oErrorDetails.sapErrorCode) {
                sContent += "SAP Error Code: " + oErrorDetails.sapErrorCode + "\n";
            }
            if (oErrorDetails.httpStatus) {
                sContent += "HTTP Status: " + oErrorDetails.httpStatus + "\n";
            }
            if (oErrorDetails.step) {
                sContent += "Step: " + oErrorDetails.step + "\n";
            }
            if (oErrorDetails.timestamp) {
                sContent += "Timestamp: " + oErrorDetails.timestamp + "\n";
            }
            
            // SAP Inner Error (often contains additional details)
            var sSapInnerError = "";
            if (oErrorDetails.sapInnerError) {
                sSapInnerError = JSON.stringify(oErrorDetails.sapInnerError, null, 2);
            }
            
            // Check for SAP error response (JSON)
            var sSapErrorJson = "";
            if (oErrorDetails.sapErrorResponse) {
                sSapErrorJson = JSON.stringify(oErrorDetails.sapErrorResponse, null, 2);
            }
            
            // Check for SAP error XML
            var sSapErrorXml = oErrorDetails.sapErrorXml || "";
            
            // Check for payload sent
            var sPayloadSent = "";
            if (oErrorDetails.payloadSent) {
                sPayloadSent = JSON.stringify(oErrorDetails.payloadSent, null, 2);
            }
            
            // Full response for debugging
            var sFullResponse = "";
            if (oFullResponse) {
                sFullResponse = JSON.stringify(oFullResponse, null, 2);
            }
            
            // Create dialog with scrollable content
            var oDialog = new Dialog({
                title: "Production Run Failed - SAP Error Details",
                contentWidth: "800px",
                contentHeight: "600px",
                resizable: true,
                draggable: true,
                content: [
                    new VBox({
                        items: [
                            new Label({ text: "Error Summary:", design: "Bold" }),
                            new TextArea({
                                value: sContent,
                                rows: 5,
                                width: "100%",
                                editable: false
                            }),
                            new Label({ text: "SAP Error Response (XML/Raw):", design: "Bold" }),
                            new TextArea({
                                value: sSapErrorXml || "(No XML/Raw response captured - check Full API Response below)",
                                rows: 10,
                                width: "100%",
                                editable: false
                            }),
                            new Label({ text: "SAP Error Response (JSON):", design: "Bold", visible: !!sSapErrorJson }),
                            new TextArea({
                                value: sSapErrorJson || "(No JSON response)",
                                rows: 6,
                                width: "100%",
                                editable: false,
                                visible: !!sSapErrorJson
                            }),
                            new Label({ text: "Full API Response:", design: "Bold" }),
                            new TextArea({
                                value: sFullResponse || "(No response captured)",
                                rows: 12,
                                width: "100%",
                                editable: false
                            }),
                            new Label({ text: "SAP Inner Error:", design: "Bold", visible: !!sSapInnerError }),
                            new TextArea({
                                value: sSapInnerError || "(No inner error)",
                                rows: 6,
                                width: "100%",
                                editable: false,
                                visible: !!sSapInnerError
                            })
                        ]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                beginButton: new Button({
                    text: "Copy Error Details",
                    press: function () {
                        var sFullError = sContent + "\n\nSAP Inner Error:\n" + sSapInnerError + "\n\nSAP Response:\n" + sSapErrorJson + "\n\nFull API Response:\n" + sFullResponse;
                        navigator.clipboard.writeText(sFullError).then(function() {
                            MessageToast.show("Error details copied to clipboard");
                        });
                    }
                }),
                endButton: new Button({
                    text: "Close",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });
            
            oDialog.open();
        },

        // Delete header
        onDeleteHeader: function (oEvent) {
            var that = this;
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oHeader = oContext.getObject();

            MessageBox.confirm("Are you sure you want to delete lockbox '" + oHeader.lockbox + "'?", {
                title: "Confirm Delete",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        BusyIndicator.show(0);
                        
                        fetch(API_BASE + "/lockbox/headers/" + oHeader.id, {
                            method: "DELETE"
                        })
                            .then(function (response) {
                                return response.json();
                            })
                            .then(function (data) {
                                BusyIndicator.hide();
                                MessageToast.show("Lockbox deleted successfully");
                                that._loadHeaders();
                                
                                var oModel = that.getOwnerComponent().getModel("app");
                                if (oModel.getProperty("/selectedHeader") === oHeader.id) {
                                    oModel.setProperty("/selectedHeader", null);
                                    oModel.setProperty("/selectedHeaderDetails", null);
                                    oModel.setProperty("/hierarchy", []);
                                }
                            })
                            .catch(function (error) {
                                BusyIndicator.hide();
                                MessageBox.error("Error deleting lockbox: " + error.message);
                            });
                    }
                }
            });
        },
        

        // ============================================================================
        // SELECTION-BASED ACTION HANDLERS (for top toolbar buttons with table selection)
        // ============================================================================
        
        // Handle table selection change (for sap.ui.table.Table)
        onTableSelectionChange: function(oEvent) {
            var oTable = oEvent.getSource();
            var iSelectedIndex = oTable.getSelectedIndex();
            var oModel = this.getView().getModel("app");
            
            if (iSelectedIndex >= 0) {
                var oContext = oTable.getContextByIndex(iSelectedIndex);
                if (oContext) {
                    var oSelectedItem = oContext.getObject();
                    oModel.setProperty("/hasSelection", true);
                    oModel.setProperty("/selectedItem", oSelectedItem);
                } else {
                    oModel.setProperty("/hasSelection", false);
                    oModel.setProperty("/selectedItem", null);
                }
            } else {
                oModel.setProperty("/hasSelection", false);
                oModel.setProperty("/selectedItem", null);
            }
        },
        
        // Pagination handlers
        onNextPage: function() {
            var oModel = this.getView().getModel("app");
            var currentPage = oModel.getProperty("/currentPage") || 1;
            var totalPages = oModel.getProperty("/totalPages") || 1;
            
            if (currentPage < totalPages) {
                this._updatePagination(currentPage + 1);
            }
        },
        
        onPreviousPage: function() {
            var oModel = this.getView().getModel("app");
            var currentPage = oModel.getProperty("/currentPage") || 1;
            
            if (currentPage > 1) {
                this._updatePagination(currentPage - 1);
            }
        },
        
        _updatePagination: function(page) {
            var oModel = this.getView().getModel("app");
            var aAllData = oModel.getProperty("/lockboxListFull") || [];
            var itemsPerPage = 7;
            var totalPages = Math.ceil(aAllData.length / itemsPerPage);
            
            var startIndex = (page - 1) * itemsPerPage;
            var endIndex = Math.min(startIndex + itemsPerPage, aAllData.length);
            var aPageData = aAllData.slice(startIndex, endIndex);
            
            oModel.setProperty("/lockboxList", aPageData);
            oModel.setProperty("/currentPage", page);
            oModel.setProperty("/totalPages", totalPages);
            oModel.setProperty("/lockboxListStart", startIndex + 1);
            oModel.setProperty("/lockboxListEnd", endIndex);
        },
        
        // Handle row press (opens transaction details)
        onRowPress: function(oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("app");
            if (oContext) {
                var oData = oContext.getObject();
                // Simulate button press event with context for existing function
                this.onShowTransactionDetails({
                    getSource: function() {
                        return {
                            getBindingContext: function() { return oContext; }
                        };
                    }
                });
            }
        },
        
        // Simulate selected item
        onSimulateSelected: function() {
            var oModel = this.getView().getModel("app");
            var oSelectedItem = oModel.getProperty("/selectedItem");
            
            if (!oSelectedItem) {
                MessageBox.warning("Please select an item first");
                return;
            }
            
            // Call existing simulate function with simulated event
            this.onSimulateItem({
                getSource: function() {
                    return {
                        getBindingContext: function() {
                            return {
                                getObject: function() { return oSelectedItem; }
                            };
                        }
                    };
                }
            });
        },
        
        // Production run for selected item
        onProductionRunSelected: function() {
            var oModel = this.getView().getModel("app");
            var oSelectedItem = oModel.getProperty("/selectedItem");
            
            if (!oSelectedItem) {
                MessageBox.warning("Please select an item first");
                return;
            }
            
            // Call existing production run function with simulated event
            this.onProductionRunItem({
                getSource: function() {
                    return {
                        getBindingContext: function() {
                            return {
                                getObject: function() { return oSelectedItem; }
                            };
                        }
                    };
                }
            });
        },
        
        // Repost selected item
        onRepostSelected: function() {
            var oModel = this.getView().getModel("app");
            var oSelectedItem = oModel.getProperty("/selectedItem");
            
            if (!oSelectedItem) {
                MessageBox.warning("Please select an item first");
                return;
            }
            
            // Call existing repost function with simulated event
            this.onRepostItem({
                getSource: function() {
                    return {
                        getBindingContext: function() {
                            return {
                                getObject: function() { return oSelectedItem; }
                            };
                        }
                    };
                }
            });
        },
        
        // Preview field mapping for selected item
        onPreviewFieldMappingSelected: function() {
            var oModel = this.getView().getModel("app");
            var oSelectedItem = oModel.getProperty("/selectedItem");
            
            if (!oSelectedItem) {
                MessageBox.warning("Please select an item first");
                return;
            }
            
            // Call existing preview field mapping function with simulated event
            this.onPreviewFieldMapping({
                getSource: function() {
                    return {
                        getBindingContext: function() {
                            return {
                                getObject: function() { return oSelectedItem; }
                            };
                        }
                    };
                }
            });
        },
        
        // Helper functions for new filters
        onCopySourceFile: function() {
            var sValue = this.byId("filterSourceFile").getValue();
            if (sValue) {
                navigator.clipboard.writeText(sValue);
                MessageToast.show("Source file copied to clipboard");
            }
        },
        
        onCopyCreatedBy: function() {
            var sValue = this.byId("filterCreatedBy").getValue();
            if (sValue) {
                navigator.clipboard.writeText(sValue);
                MessageToast.show("Created by copied to clipboard");
            }
        },
        
        // Format deposit date to match image (e.g., "Apr 03, 2026")
        formatDepositDate: function(sDate) {
            if (!sDate) return "";
            try {
                var oDate = new Date(sDate);
                var options = { year: 'numeric', month: 'short', day: '2-digit' };
                return oDate.toLocaleDateString('en-US', options);
            } catch (e) {
                return sDate;
            }
        },

        // ============================================================================
        // ITEM-LEVEL ACTION HANDLERS (for TreeTable row buttons)
        // ============================================================================
        
        // Simulate at item level
        onSimulateItem: function (oEvent) {
            var that = this;
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oItem = oContext.getObject();
            
            if (!oItem.runId) {
                MessageBox.warning("No run ID associated with this item");
                return;
            }
            
            BusyIndicator.show(0);
            
            fetch(API_BASE + "/lockbox/runs/" + oItem.runId + "/simulate", {
                method: "POST"
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.success) {
                        that._loadRunHistory();
                        
                        // Show detailed simulation popup with mock accounting data
                        that._showSimulationPopup(data.simulation);
                    } else {
                        MessageBox.error("Simulation failed: " + (data.error || "Unknown error"));
                    }
                })
                .catch(function (err) {
                    BusyIndicator.hide();
                    MessageBox.error("Simulation error: " + err.message);
                });
        },
        
        // Production Run at item level
        onProductionRunItem: function (oEvent) {
            var that = this;
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oItem = oContext.getObject();
            
            if (!oItem.runId) {
                MessageBox.warning("No run ID associated with this item");
                return;
            }
            
            // Create a dialog for production run confirmation
            var oDialog = new sap.m.Dialog({
                title: "Production Run - Post to SAP",
                type: sap.m.DialogType.Message,
                content: [
                    new sap.m.VBox({
                        items: [
                            new sap.m.Text({ text: "Lockbox: " + oItem.lockbox }),
                            new sap.m.Text({ text: "Run ID: " + oItem.runId }),
                            new sap.m.Text({ text: "Amount: " + oItem.amount + " " + (oItem.currency || "USD") }),
                            new sap.ui.core.HTML({ content: "<br/>" }),
                            new sap.m.Text({ 
                                text: "This will post documents to SAP S/4HANA backend in LIVE mode.",
                                wrapping: true
                            })
                        ]
                    })
                ],
                beginButton: new sap.m.Button({
                    text: "Post to SAP",
                    type: "Emphasized",
                    press: function () {
                        oDialog.close();
                        // Always use LIVE mode (bUseMock = false)
                        that._executeProductionRunForItem(oItem.runId, false);
                    }
                }),
                endButton: new sap.m.Button({
                    text: "Cancel",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });
            
            oDialog.open();
        },
        
        // Execute Production Run for item
        _executeProductionRunForItem: function (sRunId, bUseMock) {
            var that = this;
            
            BusyIndicator.show(0);
            
            var sMode = bUseMock ? "MOCK" : "LIVE (SAP BTP Destination)";
            console.log("Executing Production Run - Mode: " + sMode + ", Run ID: " + sRunId);
            
            fetch(API_BASE + "/lockbox/runs/" + sRunId + "/production", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ useMock: bUseMock })
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.success) {
                        that._loadRunHistory();
                        
                        // Build success message with clearing documents
                        var sMessage = "Production Run Successful!\n\n";
                        sMessage += "Company Code: " + (data.lockbox_summary?.companyCode || data.sap_fiscal_year) + "\n";
                        sMessage += "Lockbox: " + (data.lockbox_summary?.lockbox || "") + "\n";
                        sMessage += "Amount: " + (data.lockbox_summary?.amount || "") + "\n\n";
                        
                        // Add clearing documents if available
                        if (data.clearingDocuments && data.clearingDocuments.length > 0) {
                            sMessage += "📄 Clearing Documents Retrieved:\n\n";
                            data.clearingDocuments.forEach(function(doc) {
                                sMessage += "Line Item: " + doc.lineItem + "\n";
                                sMessage += "  Document Number: " + doc.documentNumber + "\n";
                                sMessage += "  Payment Advice: " + doc.paymentAdvice + "\n";
                                sMessage += "  Subledger Document: " + doc.subledgerDocument + "\n";
                                if (doc.subledgerOnaccountDocument) {
                                    sMessage += "  Subledger Onaccount Document: " + doc.subledgerOnaccountDocument + "\n";
                                }
                                if (doc.amount) {
                                    sMessage += "  Amount: " + doc.amount + "\n";
                                }
                                sMessage += "\n";
                            });
                        } else {
                            // Fallback to old format if clearingDocuments not available
                            if (data.production) {
                                sMessage += "Mode: " + data.production.mode + "\n";
                                sMessage += "Service: " + data.production.service.system + "\n\n";
                                sMessage += "📄 AR Posting Document: " + data.production.sapResponse.accountingDocument + "\n";
                                sMessage += "💳 Payment Advice: " + data.production.sapResponse.paymentAdvice + "\n";
                                sMessage += "📅 Fiscal Year: " + data.production.sapResponse.fiscalYear + "\n";
                                sMessage += "🏢 Company Code: " + data.production.sapResponse.companyCode + "\n\n";
                                sMessage += "✅ Clearing Status: " + data.production.clearing.status + "\n";
                                sMessage += "📊 Items Cleared: " + data.production.clearing.clearedItems;
                                
                                if (data.production.clearing.clearingDocument) {
                                    sMessage += "\n🔗 Clearing Document: " + data.production.clearing.clearingDocument;
                                }
                                
                                if (data.production.service.note) {
                                    sMessage += "\n\n⚠️ " + data.production.service.note;
                                }
                            }
                        }
                        
                        MessageBox.success(sMessage, { title: "Posted to SAP" });
                    } else {
                        MessageBox.error("Production run failed: " + (data.error || data.message || "Unknown error"));
                    }
                })
                .catch(function (err) {
                    BusyIndicator.hide();
                    MessageBox.error("Production run error: " + err.message);
                });
        },
        
        // Retrieve Clearing Documents - RULE-004
        onRetrieveClearingDocs: function (oEvent) {
            var that = this;
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oItem = oContext.getObject();
            
            if (!oItem.runId) {
                MessageBox.warning("No run ID associated with this item");
                return;
            }
            
            BusyIndicator.show(0);
            
            console.log("Retrieving clearing documents for Run ID:", oItem.runId);
            console.log("Lockbox ID:", oItem.lockbox);
            
            fetch(API_BASE + "/lockbox/retrieve-clearing/" + oItem.runId, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    lockboxId: oItem.lockbox // Pass lockbox ID for fallback
                })
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.success) {
                        var message = data.updated ? 
                            "Clearing documents retrieved and updated successfully: " + data.count + " documents" :
                            "Clearing documents retrieved successfully (database unavailable): " + data.count + " documents";
                        
                        MessageToast.show(message);
                        
                        // Update the dialog if it's open
                        if (that._oDetailsDialog && that._oDetailsDialog.isOpen()) {
                            var oDialogModel = that._oDetailsDialog.getModel("dialog");
                            if (oDialogModel) {
                                var dialogData = oDialogModel.getData();
                                
                                // Update lockbox data with retrieved documents
                                if (dialogData.lockboxData && data.documents.length > 0) {
                                    dialogData.lockboxData.forEach(function(item, index) {
                                        if (data.documents[index]) {
                                            item.postingDoc = data.documents[index].documentNumber;
                                            item.paytAdvice = data.documents[index].paymentAdvice;
                                            item.clearingDoc = data.documents[index].subledgerDocument;
                                            item.subledgerOnaccountDoc = data.documents[index].subledgerOnaccountDocument;
                                        }
                                    });
                                    oDialogModel.setData(dialogData);
                                }
                            }
                        }
                        
                        // Reload the run history to reflect any updates
                        that._loadRunHistory();
                    } else {
                        MessageBox.error("Failed to retrieve clearing documents: " + (data.message || "Unknown error"));
                    }
                })
                .catch(function (err) {
                    BusyIndicator.hide();
                    MessageBox.error("Error retrieving clearing documents: " + err.message);
                });
        },
        
        // Reprocess at item level
        onReprocessItem: function (oEvent) {
            var that = this;
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oItem = oContext.getObject();
            
            if (!oItem.runId) {
                MessageBox.warning("No run ID associated with this item");
                return;
            }
            
            BusyIndicator.show(0);
            
            fetch(API_BASE + "/lockbox/runs/" + oItem.runId + "/reprocess", {
                method: "POST"
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.success) {
                        MessageToast.show("Reprocess initiated for " + oItem.runId);
                        that._loadRunHistory();
                    } else {
                        MessageBox.error("Reprocess failed: " + (data.error || "Unknown error"));
                    }
                })
                .catch(function (err) {
                    BusyIndicator.hide();
                    MessageBox.error("Error reprocessing: " + err.message);
                });
        },
        
        // Download original source file
        onDownloadSourceFile: function (oEvent) {
            var oLink = oEvent.getSource();
            var oContext = oLink.getBindingContext("app");
            
            if (!oContext) {
                // Try getting from parent row
                var oParent = oLink.getParent();
                while (oParent && !oContext) {
                    oContext = oParent.getBindingContext("app");
                    oParent = oParent.getParent();
                }
            }
            
            if (!oContext) {
                MessageBox.warning("Could not determine run context");
                return;
            }
            
            var oItem = oContext.getObject();
            var sRunId = oItem.runId;
            
            if (!sRunId) {
                MessageBox.warning("No run ID associated with this item");
                return;
            }
            
            // Trigger file download
            var downloadUrl = API_BASE + "/lockbox/runs/" + sRunId + "/download";
            window.open(downloadUrl, "_blank");
        },
        
        // Preview Field Mapping - Show extraction, validation, constants and defaults
        onPreviewFieldMapping: function (oEvent) {
            var that = this;
            var oButton = oEvent.getSource();
            var oModel = this.getView().getModel("app");
            
            // Get the binding context - try multiple approaches
            var oContext = oButton.getBindingContext("app");
            if (!oContext) {
                // Try getting from parent row
                var oParent = oButton.getParent();
                while (oParent && !oContext) {
                    oContext = oParent.getBindingContext("app");
                    oParent = oParent.getParent();
                }
            }
            
            if (!oContext) {
                MessageBox.warning("Could not find item context");
                return;
            }
            
            var oItem = oContext.getObject();
            console.log("Preview Field Mapping clicked for item:", oItem);
            
            if (!oItem.runId) {
                console.log("No runId found in item:", oItem);
                MessageBox.warning("No run data available for this item");
                return;
            }
            
            console.log("Fetching run data for runId:", oItem.runId);
            BusyIndicator.show(0);
            
            // Fetch the full run details including mapped data
            fetch(API_BASE + "/lockbox/runs/" + oItem.runId)
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.run) {
                        var oRun = data.run;
                        var aMappings = that._buildFieldMappings(oRun);
                        
                        oModel.setProperty("/fieldMappingPreview", {
                            lockboxId: oItem.lockbox || oRun.lockboxId || oItem.runId,
                            patternName: oRun.matchedPattern || oRun.patternName || "Auto-detected",
                            status: oItem.status || oRun.status,
                            mappings: aMappings,
                            allMappings: aMappings
                        });
                        
                        that.byId("fieldMappingPreviewDialog").open();
                    } else {
                        MessageBox.warning("No mapping data available");
                    }
                })
                .catch(function (err) {
                    BusyIndicator.hide();
                    MessageBox.error("Error loading field mappings: " + err.message);
                });
        },
        
        // Build field mappings from run data - uses actual Excel headers and SAP payload
        // Shows ALL 20+ API fields organized by SAP payload hierarchy
        _buildFieldMappings: function (oRun) {
            var that = this;
            var aMappings = [];
            var oStages = oRun.stages || {};
            
            // Get header mapping from template match stage (actual Excel headers)
            var oHeaderMapping = (oStages.templateMatch || {}).headerMapping || {};
            
            // Get extracted data - PRIMARY SOURCE for source values
            // Check multiple locations for extracted data
            var aExtractedData = oRun.extractedData || oRun.extracted_data || 
                                 (oStages.extraction || {}).extractedRows || [];
            var oFirstRow = aExtractedData[0] || {};
            
            // Also check mapped data as fallback
            var aMappedData = oRun.mappedData || oRun.mapped_data || [];
            if (!oFirstRow || Object.keys(oFirstRow).length === 0) {
                oFirstRow = aMappedData[0] || {};
            }
            
            console.log("=== FIELD MAPPING PREVIEW DEBUG ===");
            console.log("Run ID:", oRun.runId);
            console.log("Extracted Data Length:", aExtractedData.length);
            console.log("First Row Data:", JSON.stringify(oFirstRow));
            console.log("Available Fields:", Object.keys(oFirstRow));
            console.log("Sample Values:");
            console.log("  - Customer:", oFirstRow["Customer"] || oFirstRow.Customer);
            console.log("  - Check Number:", oFirstRow["Check Number"] || oFirstRow.CheckNumber);
            console.log("  - Check Amount:", oFirstRow["Check Amount"] || oFirstRow.CheckAmount);
            console.log("  - Invoice Number:", oFirstRow["Invoice Number"] || oFirstRow.InvoiceNumber);
            console.log("===================================");
            
            // Get SAP payload
            var oSapPayload = oRun.sapPayload || oRun.sap_payload || {};
            var oFirstItem = {};
            var oFirstClearing = {};
            
            // Navigate SAP payload structure
            if (oSapPayload.to_Item && oSapPayload.to_Item.results && oSapPayload.to_Item.results.length > 0) {
                oFirstItem = oSapPayload.to_Item.results[0];
                if (oFirstItem.to_LockboxClearing && oFirstItem.to_LockboxClearing.results && oFirstItem.to_LockboxClearing.results.length > 0) {
                    oFirstClearing = oFirstItem.to_LockboxClearing.results[0];
                }
            }
            
            // ================================================================
            // COMPLETE API FIELD MAPPING CONFIG - ALL 20+ FIELDS
            // Organized by SAP Payload Structure: Header → Item → Clearing
            // excelKey matches the actual field names from extracted data
            // NOTE: CompanyCode, HouseBank, HouseBankAccount, Customer are NOT sent in payload
            // ================================================================
            var aFieldMappingConfig = [
                // ============================================================
                // HEADER LEVEL FIELDS (LockboxBatch entity - top level)
                // ============================================================
                { excelKey: null, sapField: "Lockbox", sapParent: "header", mappingType: "CONSTANT", transformation: "Lockbox identifier (max 7 chars)", section: "Header" },
                { excelKey: "DepositDate", searchTerms: ["deposit", "date"], sapField: "DepositDateTime", sapParent: "header", mappingType: "DIRECT", transformation: "Date format: YYYY-MM-DDTHH:mm:ss", section: "Header" },
                { excelKey: "CheckAmount", searchTerms: ["check", "amount"], sapField: "AmountInTransactionCurrency", sapParent: "header", mappingType: "DIRECT", transformation: "Total batch amount (sum of checks)", section: "Header" },
                { excelKey: null, sapField: "LockboxBatchOrigin", sapParent: "header", mappingType: "CONSTANT", transformation: "Origin identifier (max 10 chars)", section: "Header" },
                { excelKey: null, sapField: "LockboxBatchDestination", sapParent: "header", mappingType: "CONSTANT", transformation: "Destination identifier (max 10 chars)", section: "Header" },
                
                // ============================================================
                // ITEM LEVEL FIELDS (LockboxBatchItem entity - to_Item.results[])
                // ============================================================
                { excelKey: null, sapField: "LockboxBatch", sapParent: "item", mappingType: "CONSTANT", transformation: "Batch sequence number (max 3 chars)", section: "Item" },
                { excelKey: null, sapField: "LockboxBatchItem", sapParent: "item", mappingType: "SYSTEM", transformation: "Item sequence number (max 5 chars)", section: "Item" },
                { excelKey: "CheckAmount", searchTerms: ["check", "amount"], sapField: "AmountInTransactionCurrency", sapParent: "item", mappingType: "DIRECT", transformation: "Check amount in transaction currency", section: "Item" },
                { excelKey: null, sapField: "Currency", sapParent: "item", mappingType: "DEFAULT", transformation: "Currency code (default: USD)", section: "Item" },
                { excelKey: "CheckNumber", searchTerms: ["check", "number", "cheque"], sapField: "Cheque", sapParent: "item", mappingType: "DIRECT", transformation: "Check/Cheque number (max 13 chars)", section: "Item" },
                { excelKey: "BankCode", searchTerms: ["bank", "code"], sapField: "PartnerBank", sapParent: "item", mappingType: "DEFAULT", transformation: "Partner bank code (max 15 chars)", section: "Item" },
                { excelKey: "BankAccount", searchTerms: ["bank", "account"], sapField: "PartnerBankAccount", sapParent: "item", mappingType: "DEFAULT", transformation: "Partner bank account (max 18 chars)", section: "Item" },
                { excelKey: null, sapField: "PartnerBankCountry", sapParent: "item", mappingType: "DEFAULT", transformation: "Partner bank country (default: US)", section: "Item" },
                
                // ============================================================
                // CLEARING LEVEL FIELDS (LockboxClearing entity - to_LockboxClearing.results[])
                // ============================================================
                { excelKey: "InvoiceNumber", searchTerms: ["invoice", "number", "payment", "reference"], sapField: "PaymentReference", sapParent: "clearing", mappingType: "DIRECT", transformation: "Invoice/Payment reference (max 30 chars)", section: "Clearing" },
                { excelKey: "InvoiceAmount", searchTerms: ["invoice", "amount", "payment", "net"], sapField: "NetPaymentAmountInPaytCurrency", sapParent: "clearing", mappingType: "DIRECT", transformation: "Net payment amount for clearing", section: "Clearing" },
                { excelKey: "DeductionAmount", searchTerms: ["deduction", "amount", "discount"], sapField: "DeductionAmountInPaytCurrency", sapParent: "clearing", mappingType: "DIRECT", transformation: "Deduction/discount amount", section: "Clearing" },
                { excelKey: "ReasonCode", searchTerms: ["reason", "code"], sapField: "PaymentDifferenceReason", sapParent: "clearing", mappingType: "DIRECT", transformation: "Reason code (max 3 chars)", section: "Clearing" },
                { excelKey: null, sapField: "Currency", sapParent: "clearing", mappingType: "DEFAULT", transformation: "Clearing currency (default: USD)", section: "Clearing" },
                
                // ============================================================
                // REFERENCE FIELDS (Used for GET API lookups, NOT in POST payload)
                // ============================================================
                { excelKey: "Customer", searchTerms: ["customer", "account"], sapField: "Customer (GET API only)", sapParent: "source", mappingType: "SOURCE", transformation: "Used for PaymentAdviceAccount in GET LockboxClearing - NOT in POST", section: "Reference" }
            ];
            
            // Build mapping entries with section grouping
            aFieldMappingConfig.forEach(function (config) {
                var sSourceField = config.excelKey;
                var sSourceValue = null;
                var sFinalValue = null;
                
                // FUZZY SEARCH: Get source value from extracted data using multiple strategies
                if (config.excelKey) {
                    // Strategy 1: Try exact match with spaces (e.g., "Check Amount")
                    var keyWithSpaces = config.excelKey.replace(/([A-Z])/g, ' $1').trim();
                    sSourceValue = oFirstRow[keyWithSpaces];
                    
                    // Strategy 2: Try original camelCase (e.g., "CheckAmount")
                    if (sSourceValue === undefined || sSourceValue === null) {
                        sSourceValue = oFirstRow[config.excelKey];
                    }
                    
                    // Strategy 3: FUZZY MATCH - Search for field containing key terms
                    if ((sSourceValue === undefined || sSourceValue === null) && config.searchTerms) {
                        var availableFields = Object.keys(oFirstRow);
                        
                        for (var i = 0; i < availableFields.length; i++) {
                            var fieldName = availableFields[i].toLowerCase();
                            var allTermsMatch = true;
                            
                            // Check if ALL search terms are present in this field name
                            for (var j = 0; j < config.searchTerms.length; j++) {
                                if (fieldName.indexOf(config.searchTerms[j].toLowerCase()) === -1) {
                                    allTermsMatch = false;
                                    break;
                                }
                            }
                            
                            // If all terms match, use this field
                            if (allTermsMatch) {
                                sSourceValue = oFirstRow[availableFields[i]];
                                console.log("✅ FUZZY MATCH: Found '" + availableFields[i] + "' for " + config.excelKey + " = ", sSourceValue);
                                break;
                            }
                        }
                    }
                    
                    // Strategy 4: Try lowercase
                    if (sSourceValue === undefined || sSourceValue === null) {
                        sSourceValue = oFirstRow[config.excelKey.toLowerCase()];
                    }
                    
                    // Strategy 5: Try snake_case
                    if (sSourceValue === undefined || sSourceValue === null) {
                        sSourceValue = oFirstRow[that._toSnakeCase(config.excelKey)];
                    }
                    
                    // Final log
                    if (sSourceValue !== undefined && sSourceValue !== null && sSourceValue !== '') {
                        console.log("✅ SUCCESS: " + config.sapField + " ← " + config.excelKey + " = ", sSourceValue);
                    }
                }
                
                // Get final value from SAP payload based on parent
                switch (config.sapParent) {
                    case "header":
                        sFinalValue = oSapPayload[config.sapField];
                        break;
                    case "item":
                        sFinalValue = oFirstItem[config.sapField];
                        break;
                    case "clearing":
                        sFinalValue = oFirstClearing[config.sapField];
                        break;
                    case "source":
                        sFinalValue = sSourceValue; // Show source value as final for reference fields
                        break;
                }
                
                aMappings.push({
                    sourceField: sSourceField,
                    sourceValue: sSourceValue != null && sSourceValue !== '' ? String(sSourceValue) : null,
                    mappingType: config.mappingType,
                    targetField: config.sapField,
                    finalValue: sFinalValue != null && sFinalValue !== '' ? String(sFinalValue) : null,
                    transformation: config.transformation,
                    section: config.section
                });
            });
            
            return aMappings;
        },
        
        // Helper to convert camelCase to snake_case
        _toSnakeCase: function (str) {
            return str.replace(/[A-Z]/g, function (letter) {
                return "_" + letter.toLowerCase();
            }).replace(/^_/, "");
        },
        
        // Helper to format date for SAP (YYYY-MM-DD)
        _formatDateForSAP: function (sDate) {
            if (!sDate) return null;
            try {
                var oDate = new Date(sDate);
                if (isNaN(oDate.getTime())) {
                    // Try parsing MM-DD-YYYY or other formats
                    var parts = sDate.split(/[-\/]/);
                    if (parts.length === 3) {
                        if (parts[0].length === 4) {
                            return sDate; // Already YYYY-MM-DD
                        }
                        return parts[2] + "-" + parts[0].padStart(2, '0') + "-" + parts[1].padStart(2, '0');
                    }
                    return sDate;
                }
                return oDate.toISOString().split('T')[0];
            } catch (e) {
                return sDate;
            }
        },
        
        // Filter field mappings by type
        onMappingFilterChange: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            var oModel = this.getView().getModel("app");
            var oPreview = oModel.getProperty("/fieldMappingPreview");
            
            if (!oPreview || !oPreview.allMappings) return;
            
            if (sKey === "all") {
                oModel.setProperty("/fieldMappingPreview/mappings", oPreview.allMappings);
            } else {
                var aFiltered = oPreview.allMappings.filter(function (m) {
                    return m.mappingType === sKey;
                });
                oModel.setProperty("/fieldMappingPreview/mappings", aFiltered);
            }
        },
        
        // Close field mapping preview dialog
        onCloseFieldMappingPreview: function () {
            this.byId("fieldMappingPreviewDialog").close();
        },
        
        // Export field mappings to Excel
        onExportFieldMappings: function () {
            var oModel = this.getView().getModel("app");
            var oPreview = oModel.getProperty("/fieldMappingPreview");
            
            if (!oPreview || !oPreview.mappings || oPreview.mappings.length === 0) {
                MessageToast.show("No data to export");
                return;
            }
            
            // Create CSV content
            var aHeaders = ["Source Field", "Source Value", "Mapping Type", "Target API Field", "Final Value", "Transformation"];
            var aRows = [aHeaders.join(",")];
            
            oPreview.mappings.forEach(function (m) {
                var aRow = [
                    m.sourceField || "(none)",
                    m.sourceValue || "—",
                    m.mappingType,
                    m.targetField,
                    m.finalValue || "",
                    m.transformation || "—"
                ];
                aRows.push(aRow.map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(","));
            });
            
            var sCSV = aRows.join("\n");
            var oBlob = new Blob([sCSV], { type: "text/csv;charset=utf-8" });
            var sFilename = "FieldMapping_" + (oPreview.lockboxId || "export") + ".csv";
            
            // Download
            var oLink = document.createElement("a");
            oLink.href = URL.createObjectURL(oBlob);
            oLink.download = sFilename;
            oLink.click();
            
            MessageToast.show("Field mappings exported");
        },
        
        // View item details
        onViewItemDetails: function (oEvent) {
            var that = this;
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oItem = oContext.getObject();
            
            if (!oItem.runId) {
                MessageBox.warning("No run ID associated with this item");
                return;
            }
            
            BusyIndicator.show(0);
            
            fetch(API_BASE + "/lockbox/runs/" + oItem.runId)
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.run) {
                        var sDetails = that._formatProcessingStagesDetailed(data.run);
                        MessageBox.information(sDetails, { title: "Run Details: " + oItem.runId });
                    }
                })
                .catch(function (err) {
                    BusyIndicator.hide();
                    MessageBox.error("Error loading run details: " + err.message);
                });
        },
        
        /**
         * Show comprehensive transaction details dialog
         */
        onShowTransactionDetails: function (oEvent) {
            var that = this;
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oItem = oContext.getObject();
            
            if (!oItem.runId) {
                MessageBox.warning("No run ID associated with this item");
                return;
            }
            
            BusyIndicator.show(0);
            
            // Fetch full run details
            fetch(API_BASE + "/lockbox/runs/" + oItem.runId)
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.run) {
                        // Build comprehensive transaction details object
                        var oTransaction = {
                            runId: data.run.runId || oItem.runId,
                            lockbox: oItem.lockbox,
                            lockboxBatch: oItem.lockbox + "-" + (oItem.item || "0"),
                            depositDate: data.run.deposit_datetime || oItem.deposit_datetime,
                            sourceFile: data.run.filename || oItem.filename,
                            processedDate: data.run.created_at || oItem.created_at,
                            lastUpdated: data.run.updated_at || oItem.updated_at,
                            status: data.run.overall_status || oItem.status,
                            amount: data.run.amount || oItem.amount,
                            currency: data.run.currency || oItem.currency || "USD",
                            rowsExtracted: data.run.rowsExtracted || 1,
                            mode: data.run.mode || oItem.mode || "SIMULATION",
                            
                            // Stages
                            stages: data.run.stages || {
                                upload: oItem.stages?.upload || "unknown",
                                templateMatch: oItem.stages?.templateMatch || "unknown",
                                extraction: oItem.stages?.extraction || "unknown",
                                validation: oItem.stages?.validation || "unknown",
                                mapping: oItem.stages?.mapping || "unknown",
                                simulate: oItem.stages?.simulate || "unknown",
                                posted: oItem.stages?.posted || "unknown"
                            },
                            
                            // Validation
                            validationMessage: data.run.validationMessage || oItem.validationMessage || "",
                            
                            // SAP Posting Details
                            arPostingDoc: oItem.ar_posting_doc || data.run.ar_posting_doc,
                            paymentAdvice: oItem.payment_advice_doc || data.run.payment_advice_doc,
                            clearingDoc: oItem.clearing_doc || data.run.clearing_doc,
                            fiscalYear: data.run.fiscal_year || oItem.fiscal_year,
                            companyCode: data.run.company_code || oItem.company_code,
                            clearingStatus: data.run.clearing_status || "UNAPPLIED",
                            itemsCleared: data.run.items_cleared || 0,
                            lockboxOrigin: data.run.lockbox_origin || oItem.lockbox_origin,
                            lockboxDestination: data.run.lockbox_destination || oItem.lockbox_destination,
                            
                            // Check Data
                            checkNumber: oItem.check_number || data.run.check_number,
                            checkDate: oItem.check_date || data.run.check_date,
                            checkAmount: oItem.check_amount || data.run.check_amount,
                            bankAccount: oItem.bank_account || data.run.bank_account,
                            bankRouting: oItem.bank_routing || data.run.bank_routing,
                            bankName: oItem.bank_name || data.run.bank_name,
                            
                            // Payment Reference Data
                            paymentReference: oItem.payment_reference || data.run.payment_reference,
                            invoiceNumber: oItem.invoice_number || data.run.invoice_number,
                            customerNumber: oItem.customer_number || data.run.customer_number,
                            customerName: oItem.customer_name || data.run.customer_name,
                            paymentMethod: oItem.payment_method || data.run.payment_method,
                            paymentDate: oItem.payment_date || data.run.payment_date,
                            
                            // Item Details (for Item Data tab)
                            itemDetails: data.run.itemDetails || [],
                            
                            // SAP Payload with checks and payments hierarchy
                            sapPayload: data.run.sapPayload || oItem.sapPayload || {},
                            
                            // Lockbox Data (legacy structure for compatibility)
                            headerData: that._buildLockboxHeaderData(data.run),
                            checkData: that._buildLockboxCheckData(data.run),
                            paymentReferenceData: that._buildPaymentReferenceData(data.run),
                            
                            // Errors
                            errors: data.run.errors || []
                        };
                        
                        // Parse checks and payments from sapPayload
                        // Support both 'checks' array (legacy) and SAP OData format (to_Item.results)
                        var aChecks = [];
                        
                        if (oTransaction.sapPayload && oTransaction.sapPayload.to_Item && 
                            oTransaction.sapPayload.to_Item.results && 
                            oTransaction.sapPayload.to_Item.results.length > 0) {
                            // SAP OData format: to_Item.results
                            aChecks = oTransaction.sapPayload.to_Item.results.map(function(item, checkIndex) {
                                var oCheck = {
                                    checkIndex: checkIndex,
                                    Cheque: item.Cheque || '',
                                    AmountInTransactionCurrency: item.AmountInTransactionCurrency || '0',
                                    Currency: item.Currency || 'USD',
                                    PartnerBank: item.PartnerBank || '',
                                    PartnerBankAccount: item.PartnerBankAccount || '',
                                    PartnerBankCountry: item.PartnerBankCountry || '',
                                    LockboxBatch: item.LockboxBatch || '001',
                                    LockboxBatchItem: item.LockboxBatchItem || '',
                                    payments: []
                                };
                                
                                // Parse payments from to_LockboxClearing.results
                                if (item.to_LockboxClearing && item.to_LockboxClearing.results && 
                                    Array.isArray(item.to_LockboxClearing.results)) {
                                    oCheck.payments = item.to_LockboxClearing.results.map(function(clearing, paymentIndex) {
                                        return {
                                            paymentIndex: paymentIndex,
                                            PaymentReference: clearing.PaymentReference || '',
                                            NetPaymentAmountInPaytCurrency: clearing.NetPaymentAmountInPaytCurrency || '0',
                                            DeductionAmountInPaytCurrency: clearing.DeductionAmountInPaytCurrency || '0',
                                            PaymentDifferenceReason: clearing.PaymentDifferenceReason || '',
                                            Currency: clearing.Currency || oCheck.Currency
                                        };
                                    });
                                }
                                
                                return oCheck;
                            });
                        } else if (oTransaction.sapPayload && oTransaction.sapPayload.checks) {
                            // Legacy format: checks array
                            aChecks = oTransaction.sapPayload.checks.map(function(check, checkIndex) {
                                var oCheck = {
                                    checkIndex: checkIndex,
                                    Cheque: check.Cheque || '',
                                    AmountInTransactionCurrency: check.AmountInTransactionCurrency || '0',
                                    Currency: check.Currency || 'USD',
                                    PartnerBank: check.PartnerBank || '',
                                    PartnerBankAccount: check.PartnerBankAccount || '',
                                    PartnerBankCountry: check.PartnerBankCountry || '',
                                    payments: []
                                };
                                
                                // Parse payments for this check
                                if (check.payments && Array.isArray(check.payments)) {
                                    oCheck.payments = check.payments.map(function(payment, paymentIndex) {
                                        return {
                                            paymentIndex: paymentIndex,
                                            PaymentReference: payment.PaymentReference || '',
                                            NetPaymentAmountInPaytCurrency: payment.NetPaymentAmountInPaytCurrency || '0',
                                            DeductionAmountInPaytCurrency: payment.DeductionAmountInPaytCurrency || '0',
                                            PaymentDifferenceReason: payment.PaymentDifferenceReason || '',
                                            Currency: payment.Currency || 'USD'
                                        };
                                    });
                                }
                                
                                return oCheck;
                            });
                        }
                        
                        // Add checks array to transaction object
                        oTransaction.checks = aChecks;
                        
                        // Build lockbox items for the data table from checks
                        var aLockboxItems = [];
                        if (aChecks && aChecks.length > 0) {
                            aChecks.forEach(function(check, idx) {
                                aLockboxItems.push({
                                    companyCode: oTransaction.companyCode || data.run.company_code || '',
                                    lockboxId: oTransaction.sapPayload.Lockbox || oTransaction.lockbox || '',
                                    lockboxDest: oTransaction.sapPayload.LockboxBatchDestination || oTransaction.lockboxDestination || '',
                                    lockboxOrigin: oTransaction.sapPayload.LockboxBatchOrigin || oTransaction.lockboxOrigin || '',
                                    item: (idx + 1).toString().padStart(4, '0'),
                                    amount: check.AmountInTransactionCurrency || '0',
                                    paytAdvice: oTransaction.paymentAdvice || data.run.payment_advice_doc || '',
                                    postingDoc: oTransaction.arPostingDoc || data.run.ar_posting_doc || '',
                                    clearingDoc: oTransaction.clearingDoc || data.run.clearing_doc || ''
                                });
                            });
                        } else {
                            // Fallback: create a single item if no checks data
                            aLockboxItems.push({
                                companyCode: oTransaction.companyCode || data.run.company_code || '',
                                lockboxId: oTransaction.sapPayload.Lockbox || oTransaction.lockbox || '',
                                lockboxDest: oTransaction.sapPayload.LockboxBatchDestination || oTransaction.lockboxDestination || '',
                                lockboxOrigin: oTransaction.sapPayload.LockboxBatchOrigin || oTransaction.lockboxOrigin || '',
                                item: '0001',
                                amount: oTransaction.amount || '0',
                                paytAdvice: oTransaction.paymentAdvice || data.run.payment_advice_doc || '',
                                postingDoc: oTransaction.arPostingDoc || data.run.ar_posting_doc || '',
                                clearingDoc: oTransaction.clearingDoc || data.run.clearing_doc || ''
                            });
                        }
                        
                        // Add lockbox items to transaction
                        oTransaction.lockboxItems = aLockboxItems;
                        
                        // Set in model
                        var oModel = that.getView().getModel("app");
                        oModel.setProperty("/selectedTransaction", oTransaction);
                        
                        // Open dialog
                        that.byId("transactionDetailsDialog").open();
                    }
                })
                .catch(function (err) {
                    BusyIndicator.hide();
                    MessageBox.error("Error loading transaction details: " + err.message);
                });
        },
        
        /**
         * Build header data table
         */
        _buildLockboxHeaderData: function (run) {
            return [
                { field: "Lockbox", value: run.lockbox || "" },
                { field: "Lockbox Batch Origin", value: run.lockbox_origin || "" },
                { field: "Lockbox Batch Destination", value: run.lockbox_destination || "" },
                { field: "Deposit Date/Time", value: run.deposit_datetime || "" },
                { field: "Total Amount", value: run.amount || "" },
                { field: "Currency", value: run.currency || "USD" }
            ];
        },
        
        /**
         * Build check data table
         */
        _buildLockboxCheckData: function (run) {
            return [
                { field: "Check Number", value: run.check_number || "" },
                { field: "Check Date", value: run.check_date || "" },
                { field: "Check Amount", value: run.check_amount || "" },
                { field: "Bank Account", value: run.bank_account || "" },
                { field: "Bank Routing", value: run.bank_routing || "" }
            ];
        },
        
        /**
         * Build payment reference data table
         */
        _buildPaymentReferenceData: function (run) {
            return [
                { field: "Payment Reference", value: run.payment_reference || "" },
                { field: "Invoice Number", value: run.invoice_number || "" },
                { field: "Customer Number", value: run.customer_number || "" },
                { field: "Customer Name", value: run.customer_name || "" },
                { field: "Payment Method", value: run.payment_method || "" },
                { field: "Payment Date", value: run.payment_date || "" }
            ];
        },
        
        /**
         * Close transaction details dialog
         */
        onCloseTransactionDetails: function () {
            this.byId("transactionDetailsDialog").close();
        },
        
        /**
         * View Payload Hierarchy - Shows lockbox data in simplified 3-level structure
         */
        onViewPayloadHierarchy: function () {
            var oModel = this.getView().getModel("app");
            var oTransaction = oModel.getProperty("/selectedTransaction");
            
            if (!oTransaction) {
                MessageBox.warning("No payload data available");
                return;
            }
            
            // Build 3-level hierarchy as per user requirement:
            // Level 1: Lockbox ID (e.g., 1000172)
            // Level 2: Batch: 001, Item: 001, Check number: 3456694 - 1365 USD
            // Level 3: Payment Ref: 9400000940 - 1365 USD
            var aHierarchy = [];
            
            // Get lockbox ID from sapPayload or transaction
            var lockboxId = (oTransaction.sapPayload && oTransaction.sapPayload.Lockbox) || 
                           oTransaction.lockbox || 
                           oTransaction.lockboxId || 
                           "N/A";
            
            // Level 1: Lockbox ID (root node)
            var headerNode = {
                title: lockboxId,
                icon: "sap-icon://product",
                level: 0,
                nodes: []
            };
            
            // Level 2: Check Data - Use oTransaction.checks array which has proper structure
            if (oTransaction.checks && oTransaction.checks.length > 0) {
                oTransaction.checks.forEach(function(check, index) {
                    var checkAmount = check.AmountInTransactionCurrency || "0";
                    var checkCurrency = check.Currency || "USD";
                    var batchNumber = check.LockboxBatch || "001";
                    var itemNum = check.LockboxBatchItem || (index + 1).toString().padStart(3, '0');
                    var checkNumber = check.Cheque || "N/A";
                    
                    var checkNode = {
                        title: "Batch: " + batchNumber + ", Item: " + itemNum + ", Check number: " + checkNumber + " - " + checkAmount + " " + checkCurrency,
                        icon: "sap-icon://payment-approval",
                        level: 1,
                        nodes: []
                    };
                    
                    // Level 3: Payment References
                    if (check.payments && check.payments.length > 0) {
                        check.payments.forEach(function(payment) {
                            var paymentRefAmount = payment.NetPaymentAmountInPaytCurrency || "0";
                            var paymentRefCurrency = payment.Currency || checkCurrency;
                            var refNumber = payment.PaymentReference || "N/A";
                            checkNode.nodes.push({
                                title: "Payment Ref: " + refNumber + " - " + paymentRefAmount + " " + paymentRefCurrency,
                                icon: "sap-icon://document-text",
                                level: 2
                            });
                        });
                    } else {
                        // If no payment references, show one with check amount
                        checkNode.nodes.push({
                            title: "Payment Ref: N/A - " + checkAmount + " " + checkCurrency,
                            icon: "sap-icon://document-text",
                            level: 2
                        });
                    }
                    
                    headerNode.nodes.push(checkNode);
                });
            } else {
                // Fallback: if no checks array, show a warning
                MessageBox.warning("No check data available in payload");
                return;
            }
            
            aHierarchy.push(headerNode);
            
            // Set hierarchy to model
            oModel.setProperty("/payloadHierarchy", aHierarchy);
            
            // Open payload dialog
            this.byId("payloadHierarchyDialog").open();
        },
        
        /**
         * Cancel payload view - return to transaction details
         */
        onCancelPayloadView: function () {
            this.byId("payloadHierarchyDialog").close();
        },
        
        /**
         * View SAP XML Log - Shows XML response from SAP API
         */
        onViewSAPLog: function () {
            var oModel = this.getView().getModel("app");
            var oTransaction = oModel.getProperty("/selectedTransaction");
            
            if (!oTransaction) {
                MessageBox.warning("No transaction data available");
                return;
            }
            
            // Get SAP XML log from transaction
            var sXMLLog = "";
            
            if (oTransaction.sapXMLResponse) {
                // If XML response is stored
                sXMLLog = oTransaction.sapXMLResponse;
            } else if (oTransaction.sapResponse) {
                // Convert JSON response to formatted XML-like text
                sXMLLog = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
                sXMLLog += "<SAP_Response>\n";
                sXMLLog += "  <Status>" + (oTransaction.status || "N/A") + "</Status>\n";
                sXMLLog += "  <Lockbox>" + (oTransaction.lockbox || "N/A") + "</Lockbox>\n";
                sXMLLog += "  <CompanyCode>" + (oTransaction.companyCode || "N/A") + "</CompanyCode>\n";
                
                if (oTransaction.sapResponse.accountingDocument) {
                    sXMLLog += "  <AccountingDocument>" + oTransaction.sapResponse.accountingDocument + "</AccountingDocument>\n";
                }
                if (oTransaction.sapResponse.paymentAdvice) {
                    sXMLLog += "  <PaymentAdvice>" + oTransaction.sapResponse.paymentAdvice + "</PaymentAdvice>\n";
                }
                if (oTransaction.sapResponse.fiscalYear) {
                    sXMLLog += "  <FiscalYear>" + oTransaction.sapResponse.fiscalYear + "</FiscalYear>\n";
                }
                
                // Add clearing documents if available
                if (oTransaction.lockboxItems && oTransaction.lockboxItems.length > 0) {
                    sXMLLog += "  <ClearingDocuments>\n";
                    oTransaction.lockboxItems.forEach(function(item) {
                        sXMLLog += "    <Item>\n";
                        if (item.postingDoc) {
                            sXMLLog += "      <DocumentNumber>" + item.postingDoc + "</DocumentNumber>\n";
                        }
                        if (item.paytAdvice) {
                            sXMLLog += "      <PaymentAdvice>" + item.paytAdvice + "</PaymentAdvice>\n";
                        }
                        if (item.clearingDoc) {
                            sXMLLog += "      <SubledgerDocument>" + item.clearingDoc + "</SubledgerDocument>\n";
                        }
                        if (item.subledgerOnaccountDoc) {
                            sXMLLog += "      <SubledgerOnaccountDocument>" + item.subledgerOnaccountDoc + "</SubledgerOnaccountDocument>\n";
                        }
                        sXMLLog += "    </Item>\n";
                    });
                    sXMLLog += "  </ClearingDocuments>\n";
                }
                
                sXMLLog += "</SAP_Response>";
            } else {
                sXMLLog = "No SAP API response available for this transaction.";
            }
            
            // Set to model
            oModel.setProperty("/sapXMLLog", sXMLLog);
            
            // Open dialog
            this.byId("sapLogDialog").open();
        },
        
        /**
         * Copy SAP Log to clipboard
         */
        onCopySAPLog: function () {
            var oModel = this.getView().getModel("app");
            var sXMLLog = oModel.getProperty("/sapXMLLog");
            
            // Copy to clipboard
            if (navigator.clipboard) {
                navigator.clipboard.writeText(sXMLLog).then(function() {
                    MessageToast.show("SAP Log copied to clipboard");
                }).catch(function() {
                    MessageToast.show("Failed to copy to clipboard");
                });
            } else {
                // Fallback for older browsers
                var textArea = document.createElement("textarea");
                textArea.value = sXMLLog;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    MessageToast.show("SAP Log copied to clipboard");
                } catch (err) {
                    MessageToast.show("Failed to copy to clipboard");
                }
                document.body.removeChild(textArea);
            }
        },
        
        /**
         * Close SAP Log dialog
         */
        onCloseSAPLog: function () {
            this.byId("sapLogDialog").close();
        },
        
        /**
         * Handle tab selection in transaction details dialog
         */
        onTransactionTabSelect: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            console.log("Selected tab:", sKey);
            // Additional logic if needed when switching tabs
        },
        
        // Delete item
        onDeleteItem: function (oEvent) {
            var that = this;
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("app");
            var oItem = oContext.getObject();
            
            // Check if item can be deleted
            if (oItem.status === 'POSTED' || oItem.status === 'SIMULATED') {
                MessageBox.warning("Cannot delete files that have been simulated or posted.\n\nStatus: " + oItem.status);
                return;
            }
            
            MessageBox.confirm(
                "Are you sure you want to delete this file?\n\n" +
                "Run ID: " + oItem.runId + "\n" +
                "File: " + oItem.filename + "\n" +
                "Status: " + oItem.status + "\n\n" +
                "This action cannot be undone.",
                {
                    title: "Confirm Delete",
                    actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.DELETE,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.DELETE) {
                            that._deleteRun(oItem.runId);
                        }
                    }
                }
            );
        },
        
        _deleteRun: function (runId) {
            var that = this;
            
            BusyIndicator.show(0);
            
            fetch(API_BASE + "/api/lockbox/runs/" + runId, {
                method: "DELETE",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            })
                .then(function (response) {
                    BusyIndicator.hide();
                    
                    if (!response.ok) {
                        throw new Error("Failed to delete run");
                    }
                    
                    return response.json();
                })
                .then(function (data) {
                    if (data.success) {
                        MessageToast.show("File deleted successfully");
                        
                        // Reload the run history
                        that._loadRunHistory();
                    } else {
                        MessageBox.error("Failed to delete: " + (data.message || "Unknown error"));
                    }
                })
                .catch(function (error) {
                    BusyIndicator.hide();
                    console.error("Error deleting run:", error);
                    MessageBox.error("Error deleting file: " + error.message);
                });
        },
        
        // ============================================================================
        // LOCKBOX TRANSACTION - PROCESSING WORKFLOW HANDLERS
        // Workflow: Upload File → Extract → Validate → Update → Simulate → Production Run
        // Each step runs in background and logs to Run History
        // ============================================================================
        
        // Extract - Extract relevant data from Customer file in tabular form
        onExtractData: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var sHeaderId = oModel.getProperty("/selectedHeader");

            if (!sHeaderId) {
                MessageBox.warning("Please select a lockbox header first");
                return;
            }

            BusyIndicator.show(0);
            MessageToast.show("Starting extraction process...");

            fetch(API_BASE + "/lockbox/extract/" + sHeaderId, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    // Update processing stages
                    that._updateProcessingStage(sHeaderId, "extract", data.success ? "Complete" : "Error");
                    
                    if (data.success) {
                        MessageBox.success("Data extraction completed successfully.\n\nExtracted " + (data.records || 0) + " records.", {
                            title: "Extract Complete"
                        });
                        that._loadHeaders();
                        that._loadHierarchy(sHeaderId);
                    } else {
                        MessageBox.error("Extraction failed: " + (data.message || "Unknown error"), {
                            title: "Extract Failed"
                        });
                    }
                })
                .catch(function (error) {
                    BusyIndicator.hide();
                    console.error("Extract error:", error);
                    MessageBox.error("Error during extraction: " + error.message);
                });
        },
        
        // Validate - Check rules in Template Builder and map fields from customer template to Lockbox API
        onValidateData: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var sHeaderId = oModel.getProperty("/selectedHeader");

            if (!sHeaderId) {
                MessageBox.warning("Please select a lockbox header first");
                return;
            }

            BusyIndicator.show(0);
            MessageToast.show("Starting validation and field mapping...");

            fetch(API_BASE + "/lockbox/validate/" + sHeaderId, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    rules: oModel.getProperty("/ruleEngine/rules"),
                    mappingRules: oModel.getProperty("/ruleEngine/mappingRules")
                })
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    // Update processing stages
                    that._updateProcessingStage(sHeaderId, "validate", data.success ? "Complete" : "Error");
                    
                    if (data.success) {
                        var sMessage = "Validation completed successfully.";
                        if (data.mappedFields) {
                            sMessage += "\n\nMapped Fields: " + data.mappedFields;
                        }
                        if (data.lockboxNumber) {
                            sMessage += "\nGenerated Lockbox Number: " + data.lockboxNumber;
                        }
                        MessageBox.success(sMessage, {
                            title: "Validation Complete"
                        });
                        that._loadHeaders();
                        that._loadHierarchy(sHeaderId);
                    } else {
                        var sErrors = "";
                        if (data.errors && data.errors.length > 0) {
                            sErrors = "\n\nValidation Errors:\n";
                            data.errors.forEach(function (err) {
                                sErrors += "- " + err + "\n";
                            });
                        }
                        MessageBox.error("Validation failed: " + (data.message || "Unknown error") + sErrors, {
                            title: "Validation Failed"
                        });
                    }
                })
                .catch(function (error) {
                    BusyIndicator.hide();
                    console.error("Validate error:", error);
                    MessageBox.error("Error during validation: " + error.message);
                });
        },
        
        // Update - Convert to hierarchical structure and update list
        onUpdateData: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var sHeaderId = oModel.getProperty("/selectedHeader");

            if (!sHeaderId) {
                MessageBox.warning("Please select a lockbox header first");
                return;
            }

            BusyIndicator.show(0);
            MessageToast.show("Converting to hierarchical structure...");

            fetch(API_BASE + "/lockbox/update/" + sHeaderId, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.success) {
                        var sMessage = "Update completed successfully.";
                        if (data.hierarchy) {
                            sMessage += "\n\nHierarchy: " + (data.hierarchy.lockboxCount || 1) + " Lockbox(es), ";
                            sMessage += (data.hierarchy.checkCount || 0) + " Check(s), ";
                            sMessage += (data.hierarchy.invoiceCount || 0) + " Invoice(s)";
                        }
                        MessageBox.success(sMessage, {
                            title: "Update Complete"
                        });
                        that._loadHeaders();
                        that._loadHierarchy(sHeaderId);
                    } else {
                        MessageBox.error("Update failed: " + (data.message || "Unknown error"), {
                            title: "Update Failed"
                        });
                    }
                })
                .catch(function (error) {
                    BusyIndicator.hide();
                    console.error("Update error:", error);
                    MessageBox.error("Error during update: " + error.message);
                });
        },
        
        // Helper: Update processing stage in tree data
        _updateProcessingStage: function (sHeaderId, sStage, sStatus) {
            var oModel = this.getOwnerComponent().getModel("app");
            var aTreeData = oModel.getProperty("/treeData") || [];
            
            // Find and update the header in tree data
            for (var i = 0; i < aTreeData.length; i++) {
                if (aTreeData[i].id === sHeaderId) {
                    if (!aTreeData[i].processingStages) {
                        aTreeData[i].processingStages = {
                            extract: "Pending",
                            validate: "Pending",
                            simulate: "Pending"
                        };
                    }
                    aTreeData[i].processingStages[sStage] = sStatus;
                    break;
                }
            }
            
            oModel.setProperty("/treeData", aTreeData);
        },
        
        // Edit Header
        onEditHeader: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var sHeaderId = oModel.getProperty("/selectedHeader");

            if (!sHeaderId) {
                MessageBox.warning("Please select a lockbox header first");
                return;
            }
            
            MessageToast.show("Edit functionality - coming soon");
        },

        // Simulate
        onSimulate: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var sHeaderId = oModel.getProperty("/selectedHeader");

            if (!sHeaderId) {
                MessageBox.warning("Please select a lockbox header first");
                return;
            }

            BusyIndicator.show(0);

            fetch(API_BASE + "/lockbox/simulate/" + sHeaderId, {
                method: "POST",
                headers: {
                    "Accept": "application/json"
                }
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    // Store simulation response for SAP Response button
                    oModel.setProperty("/lastProductionResponse", data);
                    oModel.setProperty("/sapResponse", JSON.stringify(data.sap_response || data, null, 2));
                    
                    // Update header details with simulation response
                    var oHeaderDetails = oModel.getProperty("/selectedHeaderDetails");
                    if (oHeaderDetails) {
                        oHeaderDetails.sap_response = JSON.stringify(data);
                        oModel.setProperty("/selectedHeaderDetails", oHeaderDetails);
                    }
                    
                    if (data.success) {
                        MessageBox.success(data.message + "\n\nClick 'SAP Response' button to view detailed response.", {
                            title: "Simulation Successful"
                        });
                        that._loadHeaders();
                        that._loadHierarchy(sHeaderId);
                    } else {
                        var sErrors = "";
                        if (data.errors && data.errors.length > 0) {
                            sErrors = "\n\nErrors:\n";
                            data.errors.forEach(function (err) {
                                sErrors += "- [" + err.code + "] " + err.message + "\n";
                            });
                        }
                        MessageBox.error(data.message + sErrors + "\n\nClick 'SAP Response' button to view error details.", {
                            title: "Simulation Failed"
                        });
                    }
                })
                .catch(function (error) {
                    BusyIndicator.hide();
                    console.error("Simulate error:", error);
                    MessageBox.error("Error during simulation: " + error.message);
                });
        },

        // Post
        onPost: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var sHeaderId = oModel.getProperty("/selectedHeader");

            if (!sHeaderId) {
                MessageBox.warning("Please select a lockbox header first");
                return;
            }

            MessageBox.confirm("Are you sure you want to run Production posting to SAP? This action cannot be undone.", {
                title: "Confirm Production Run",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        BusyIndicator.show(0);

                        fetch(API_BASE + "/lockbox/post/" + sHeaderId, {
                            method: "POST",
                            headers: {
                                "Accept": "application/json"
                            }
                        })
                            .then(function (response) {
                                return response.json();
                            })
                            .then(function (data) {
                                BusyIndicator.hide();
                                
                                if (data.success) {
                                    // Update header details status
                                    var oHeaderDetails = oModel.getProperty("/selectedHeaderDetails");
                                    if (oHeaderDetails) {
                                        oHeaderDetails.status = "POSTED";
                                        oModel.setProperty("/selectedHeaderDetails", oHeaderDetails);
                                    }
                                    
                                    // Store the run ID for reference
                                    if (data.run_id) {
                                        oModel.setProperty("/lastRunId", data.run_id);
                                    }
                                    
                                    // Simple success message
                                    var sSuccessMsg = "Document successfully posted to SAP.";
                                    if (data.run_id) {
                                        sSuccessMsg += "\n\nRun ID: " + data.run_id;
                                    }
                                    sSuccessMsg += "\n\nClick 'Run History' to view details.";
                                    
                                    MessageBox.success(sSuccessMsg, {
                                        title: "Production Run Successful"
                                    });
                                    
                                    that._loadHeaders();
                                } else {
                                    // Simple error message
                                    MessageBox.error("Posting failed.\n\n" + (data.message || "Unknown error"), {
                                        title: "Production Run Failed"
                                    });
                                }
                            })
                            .catch(function (error) {
                                BusyIndicator.hide();
                                console.error("Post error:", error);
                                MessageBox.error("Posting failed: " + error.message);
                            });
                    }
                }
            });
        },
        
        // ============================================================================
        // RUN HISTORY - Display production run logs
        // ============================================================================
        
        // Show Run History Dialog for selected lockbox
        onShowRunHistory: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oHeaderDetails = oModel.getProperty("/selectedHeaderDetails");
            
            if (!oHeaderDetails) {
                MessageBox.warning("Please select a lockbox entry first");
                return;
            }
            
            var sLockbox = oHeaderDetails.lockbox;
            
            BusyIndicator.show(0);
            
            // Fetch run history for this lockbox
            fetch(API_BASE + "/lockbox/" + sLockbox + "/runs", {
                method: "GET",
                headers: { "Accept": "application/json" }
            })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error("HTTP " + response.status);
                }
                return response.json();
            })
            .then(function (data) {
                BusyIndicator.hide();
                
                if (data.success && data.runs && data.runs.length > 0) {
                    that._showRunHistoryDialog(sLockbox, data.runs);
                } else {
                    MessageBox.information("No production runs found for Lockbox '" + sLockbox + "'.\n\nRun history will be available after executing a Production Run.");
                }
            })
            .catch(function (error) {
                BusyIndicator.hide();
                console.error("Error fetching run history:", error);
                MessageBox.error("Error loading run history: " + error.message);
            });
        },
        
        // Display Run History Dialog
        _showRunHistoryDialog: function (sLockbox, aRuns) {
            var that = this;
            
            // Build formatted run list
            var sContent = "";
            sContent += "════════════════════════════════════════════════════════════════\n";
            sContent += "           PRODUCTION RUN HISTORY - LOCKBOX: " + sLockbox + "\n";
            sContent += "════════════════════════════════════════════════════════════════\n\n";
            sContent += "Total Runs: " + aRuns.length + "\n\n";
            
            aRuns.forEach(function (oRun, idx) {
                sContent += "────────────────────────────────────────────────────────────────\n";
                sContent += "  RUN " + (idx + 1) + ": " + oRun.runId + "\n";
                sContent += "────────────────────────────────────────────────────────────────\n\n";
                sContent += "  Status:              " + (oRun.status || "N/A") + "\n";
                sContent += "  Amount:              " + (oRun.amount || "N/A") + " " + (oRun.currency || "") + "\n";
                sContent += "  Started:             " + (oRun.startedAt ? new Date(oRun.startedAt).toLocaleString() : "N/A") + "\n";
                sContent += "  Completed:           " + (oRun.completedAt ? new Date(oRun.completedAt).toLocaleString() : "N/A") + "\n";
                sContent += "\n";
                sContent += "  SAP Document Numbers:\n";
                sContent += "    Accounting Doc:    " + (oRun.accountingDocument || "N/A") + "\n";
                sContent += "    Payment Advice:    " + (oRun.paymentAdvice || "N/A") + "\n";
                sContent += "\n";
            });
            
            sContent += "════════════════════════════════════════════════════════════════\n";
            sContent += "Click on a Run ID to view detailed SAP response and clearing data.\n";
            sContent += "════════════════════════════════════════════════════════════════\n";
            
            // Store runs for detail view
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/runHistory", aRuns);
            
            // Create TextArea for display
            var oTextArea = new TextArea({
                value: sContent,
                width: "100%",
                height: "350px",
                editable: false,
                growing: false
            });
            
            // Create dialog
            var oDialog = new Dialog({
                title: "Run History - " + sLockbox,
                icon: "sap-icon://history",
                contentWidth: "650px",
                contentHeight: "450px",
                content: [
                    new VBox({
                        items: [oTextArea]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                buttons: [
                    new Button({
                        text: "View Latest Run Details",
                        icon: "sap-icon://detail-view",
                        type: "Emphasized",
                        enabled: aRuns.length > 0,
                        press: function () {
                            oDialog.close();
                            if (aRuns.length > 0) {
                                that._showRunDetails(aRuns[0].runId);
                            }
                        }
                    }),
                    new Button({
                        text: "Copy to Clipboard",
                        icon: "sap-icon://copy",
                        press: function () {
                            navigator.clipboard.writeText(sContent).then(function () {
                                MessageToast.show("Run history copied to clipboard");
                            });
                        }
                    }),
                    new Button({
                        text: "Close",
                        press: function () {
                            oDialog.close();
                        }
                    })
                ],
                afterClose: function () {
                    oDialog.destroy();
                }
            });
            
            this.getView().addDependent(oDialog);
            oDialog.open();
        },
        
        // Fetch and display detailed run information
        _showRunDetails: function (sRunId) {
            var that = this;
            
            BusyIndicator.show(0);
            
            fetch(API_BASE + "/lockbox/runs/" + sRunId, {
                method: "GET",
                headers: { "Accept": "application/json" }
            })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error("HTTP " + response.status);
                }
                return response.json();
            })
            .then(function (data) {
                BusyIndicator.hide();
                
                if (data.run) {
                    that._showRunDetailsDialog(data);
                } else {
                    MessageBox.error("Failed to load run details");
                }
            })
            .catch(function (error) {
                BusyIndicator.hide();
                console.error("Error fetching run details:", error);
                MessageBox.error("Error loading run details: " + error.message);
            });
        },
        
        // Display Run Details Dialog
        _showRunDetailsDialog: function (oRun) {
            var sContent = "";
            sContent += "════════════════════════════════════════════════════════════════\n";
            sContent += "              RUN DETAILS: " + oRun.runId + "\n";
            sContent += "════════════════════════════════════════════════════════════════\n\n";
            
            // Run Header with Success/Failure Status
            sContent += "────────────────────────────────────────────────────────────────\n";
            sContent += "                       RUN SUMMARY\n";
            sContent += "────────────────────────────────────────────────────────────────\n\n";
            sContent += "  Run ID:              " + oRun.runId + "\n";
            sContent += "  File:                " + (oRun.filename || "N/A") + "\n";
            sContent += "  Overall Status:      " + (oRun.overallStatus || "N/A").toUpperCase() + "\n";
            
            // Success/Failure Indicator
            var statusIcon = "";
            var statusMessage = "";
            if (oRun.overallStatus === "posted" || oRun.overallStatus === "simulated") {
                statusIcon = "✅ SUCCESS";
                statusMessage = "Run completed successfully";
            } else if (oRun.overallStatus === "failed" || oRun.overallStatus === "post_failed" || oRun.overallStatus === "error") {
                statusIcon = "❌ FAILED";
                statusMessage = "Run failed - " + (oRun.lastFailedStage || "Unknown stage");
            } else if (oRun.overallStatus === "validated") {
                statusIcon = "✅ READY";
                statusMessage = "Ready for simulation or production";
            } else {
                statusIcon = "⚠️  IN PROGRESS";
                statusMessage = "Current stage: " + (oRun.currentStage || "Unknown");
            }
            sContent += "  Status:              " + statusIcon + "\n";
            sContent += "  Message:             " + statusMessage + "\n\n";
            
            sContent += "  Started At:          " + (oRun.startedAt ? new Date(oRun.startedAt).toLocaleString() : "N/A") + "\n";
            sContent += "  Completed At:        " + (oRun.completedAt ? new Date(oRun.completedAt).toLocaleString() : "N/A") + "\n";
            
            if (oRun.startedAt && oRun.completedAt) {
                var duration = (new Date(oRun.completedAt) - new Date(oRun.startedAt)) / 1000;
                sContent += "  Duration:            " + duration.toFixed(2) + " seconds\n";
            }
            sContent += "\n";
            
            // Processing Stages
            sContent += "────────────────────────────────────────────────────────────────\n";
            sContent += "                    PROCESSING STAGES\n";
            sContent += "────────────────────────────────────────────────────────────────\n\n";
            
            if (oRun.stages) {
                // Upload Stage
                if (oRun.stages.upload) {
                    var uploadStatus = oRun.stages.upload.status === "success" ? "✅" : 
                                      oRun.stages.upload.status === "failed" ? "❌" : "⚠️";
                    sContent += "  1. Upload:           " + uploadStatus + " " + (oRun.stages.upload.status || "N/A").toUpperCase() + "\n";
                    if (oRun.stages.upload.message) {
                        sContent += "     Message: " + oRun.stages.upload.message + "\n";
                    }
                }
                
                // Template Match Stage
                if (oRun.stages.templateMatch) {
                    var templateStatus = oRun.stages.templateMatch.status === "success" ? "✅" : 
                                        oRun.stages.templateMatch.status === "failed" ? "❌" : "⚠️";
                    sContent += "  2. Template Match:   " + templateStatus + " " + (oRun.stages.templateMatch.status || "N/A").toUpperCase() + "\n";
                    if (oRun.stages.templateMatch.templateId) {
                        sContent += "     Template: " + oRun.stages.templateMatch.templateId + "\n";
                    }
                    if (oRun.stages.templateMatch.message) {
                        sContent += "     Message: " + oRun.stages.templateMatch.message + "\n";
                    }
                }
                
                // Extraction Stage
                if (oRun.stages.extraction) {
                    var extractStatus = oRun.stages.extraction.status === "success" ? "✅" : 
                                       oRun.stages.extraction.status === "failed" ? "❌" : "⚠️";
                    sContent += "  3. Extraction:       " + extractStatus + " " + (oRun.stages.extraction.status || "N/A").toUpperCase() + "\n";
                    if (oRun.stages.extraction.rowCount) {
                        sContent += "     Rows: " + oRun.stages.extraction.rowCount + "\n";
                    }
                    if (oRun.stages.extraction.message) {
                        sContent += "     Message: " + oRun.stages.extraction.message + "\n";
                    }
                }
                
                // Validation Stage
                if (oRun.stages.validation) {
                    var validStatus = oRun.stages.validation.status === "success" ? "✅" : 
                                     oRun.stages.validation.status === "failed" ? "❌" : "⚠️";
                    sContent += "  4. Validation:       " + validStatus + " " + (oRun.stages.validation.status || "N/A").toUpperCase() + "\n";
                    if (oRun.stages.validation.message) {
                        sContent += "     Message: " + oRun.stages.validation.message + "\n";
                    }
                }
                
                // Mapping Stage
                if (oRun.stages.mapping) {
                    var mapStatus = oRun.stages.mapping.status === "success" ? "✅" : 
                                   oRun.stages.mapping.status === "failed" ? "❌" : "⚠️";
                    sContent += "  5. Mapping:          " + mapStatus + " " + (oRun.stages.mapping.status || "N/A").toUpperCase() + "\n";
                    if (oRun.stages.mapping.message) {
                        sContent += "     Message: " + oRun.stages.mapping.message + "\n";
                    }
                }
            }
            sContent += "\n";
            
            // Production Result (if available)
            if (oRun.productionResult) {
                sContent += "────────────────────────────────────────────────────────────────\n";
                sContent += "                   PRODUCTION RESULT\n";
                sContent += "────────────────────────────────────────────────────────────────\n\n";
                
                if (oRun.productionResult.success) {
                    sContent += "  Status:              ✅ SUCCESS\n";
                    if (oRun.productionResult.sapResponse) {
                        var sapResp = oRun.productionResult.sapResponse;
                        sContent += "  Accounting Document: " + (sapResp.accountingDocument || "N/A") + "\n";
                        sContent += "  Payment Advice:      " + (sapResp.paymentAdvice || "N/A") + "\n";
                        sContent += "  Fiscal Year:         " + (sapResp.fiscalYear || "N/A") + "\n";
                    }
                    if (oRun.productionResult.clearing) {
                        sContent += "  Clearing Status:     " + (oRun.productionResult.clearing.status || "N/A") + "\n";
                        sContent += "  Items Cleared:       " + (oRun.productionResult.clearing.clearedItems || 0) + "\n";
                    }
                } else {
                    sContent += "  Status:              ❌ FAILED\n";
                    if (oRun.productionResult.error) {
                        sContent += "  Error Message:       " + (oRun.productionResult.error.message || "Unknown error") + "\n";
                        if (oRun.productionResult.error.sapErrorMessage) {
                            sContent += "  SAP Error:           " + oRun.productionResult.error.sapErrorMessage + "\n";
                        }
                    }
                }
                sContent += "\n";
            }
            
            // Simulation Result (if available)
            if (oRun.simulationResult && oRun.overallStatus === "simulated") {
                sContent += "────────────────────────────────────────────────────────────────\n";
                sContent += "                   SIMULATION RESULT\n";
                sContent += "────────────────────────────────────────────────────────────────\n\n";
                sContent += "  Status:              ✅ SIMULATED\n";
                sContent += "  Mock Data:           Available (View full details in Simulate dialog)\n\n";
            }
            
            sContent += "════════════════════════════════════════════════════════════════\n";
            
            // Create TextArea for display
            var oTextArea = new TextArea({
                value: sContent,
                width: "100%",
                height: "450px",
                editable: false,
                growing: false
            });
            
            // Create dialog
            var oDialog = new Dialog({
                title: "Run Details - " + oRun.runId,
                icon: "sap-icon://detail-view",
                contentWidth: "750px",
                contentHeight: "550px",
                content: [
                    new VBox({
                        items: [oTextArea]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                beginButton: new Button({
                    text: "Copy to Clipboard",
                    icon: "sap-icon://copy",
                    press: function () {
                        navigator.clipboard.writeText(sContent).then(function () {
                            MessageToast.show("Run details copied to clipboard");
                        });
                    }
                }),
                endButton: new Button({
                    text: "Close",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });
            
            this.getView().addDependent(oDialog);
            oDialog.open();
        },
        
        // ============================================================================
        // FIELD MAPPING RULES - Application Functions
        // Page 1: Rule List with filters and table
        // Page 2: Rule Create/Edit with tabs (Definition, Triggers, Input, Transform, Output, Preview)
        // ============================================================================
        
        // Initialize Field Mapping Rules state
        _initFieldMappingRules: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Initialize state if not already set
            if (!oModel.getProperty("/fieldMappingRules")) {
                oModel.setProperty("/fieldMappingRules", []);
            }
            
            // Initialize filters
            oModel.setProperty("/ruleFilters", {
                fileFormat: "",
                category: "",
                ruleType: "",
                active: "",
                ruleName: ""
            });
            
            // Initialize template filters
            oModel.setProperty("/templateFilters", {
                fileType: "",
                templateType: ""
            });
            
            // Initialize counts for new tabs
            oModel.setProperty("/ruleCounts", {
                customerTemplate: 0,
                filePatterns: 0,
                rules: 0,
                my: 0,
                apiFieldLogic: 0,
                apiOdataServices: 0
            });
            
            // Initialize selected tab
            oModel.setProperty("/selectedRuleTab", "filePatterns");
            
            // Initialize selected items
            oModel.setProperty("/selectedRule", null);
            oModel.setProperty("/selectedTemplate", null);
            oModel.setProperty("/selectedPattern", null);
            oModel.setProperty("/selectedApiField", null);
            oModel.setProperty("/selectedOdataService", null);
            
            // Initialize empty arrays (will be loaded from API)
            oModel.setProperty("/customerTemplates", []);
            oModel.setProperty("/filePatterns", []);
            oModel.setProperty("/apiFields", []);
            oModel.setProperty("/odataServices", []);
            oModel.setProperty("/referenceDocRules", []);
            oModel.setProperty("/selectedReferenceDocRule", "RULE-002");
            oModel.setProperty("/selectedRefDocRule", {});
            oModel.setProperty("/editingRefDocRule", {});
            
            // Initialize pattern filters
            oModel.setProperty("/patternFilters", {
                fileType: "",
                category: "",
                patternType: ""
            });
            
            // Initialize pattern detail panel state
            oModel.setProperty("/patternDetailExpanded", false);
            oModel.setProperty("/selectedPattern", null);
            oModel.setProperty("/selectedCondition", null);
            
            // Load all data from backend
            this._loadCustomerTemplates();
            this._loadFilePatterns();
            this._loadApiFields();
            this._loadOdataServices();
            this._loadRefDocRules(); // Load Reference Document Rules
            this._loadProcessingRules(); // Load Processing Rules
        },
        
        // Load Customer Templates from backend
        _loadCustomerTemplates: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            fetch(API_BASE + "/field-mapping/templates")
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    oModel.setProperty("/customerTemplates", data);
                    oModel.setProperty("/ruleCounts/customerTemplate", data.length);
                })
                .catch(function (error) {
                    console.error("Error loading templates:", error);
                });
        },
        
        // Load File Patterns from backend
        _loadFilePatterns: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            fetch(API_BASE + "/field-mapping/patterns")
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    oModel.setProperty("/filePatterns", data);
                    oModel.setProperty("/ruleCounts/filePatterns", data.length);
                })
                .catch(function (error) {
                    console.error("Error loading file patterns:", error);
                });
        },
        
        // Load API Fields from backend
        _loadApiFields: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            fetch(API_BASE + "/field-mapping/api-fields")
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    oModel.setProperty("/apiFields", data);
                    oModel.setProperty("/ruleCounts/apiFieldLogic", data.length);
                })
                .catch(function (error) {
                    console.error("Error loading API fields:", error);
                });
        },
        
        // Load OData Services from backend
        _loadOdataServices: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            fetch(API_BASE + "/field-mapping/odata-services")
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    oModel.setProperty("/odataServices", data);
                    oModel.setProperty("/ruleCounts/apiOdataServices", data.length);
                })
                .catch(function (error) {
                    console.error("Error loading OData services:", error);
                });
        },
        
        // Load Field Mapping Rules from backend
        _loadFieldMappingRules: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            fetch(API_BASE + "/field-mapping/rules")
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    oModel.setProperty("/fieldMappingRules", data);
                    oModel.setProperty("/ruleCounts/my", data.length);
                })
                .catch(function (error) {
                    console.error("Error loading field mapping rules:", error);
                });
        },
        
        // Filter rules based on selected filters
        onRuleFilterGo: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oFilters = oModel.getProperty("/ruleFilters");
            
            // Apply filters (in production, this would be a backend call)
            MessageToast.show("Filters applied");
        },
        
        // Template filter
        onTemplateFilterGo: function () {
            MessageToast.show("Template filters applied");
        },
        
        // Upload template
        onUploadTemplate: function () {
            MessageToast.show("Upload Template - Opens file dialog");
        },
        
        // Template search
        onTemplateSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue");
            var oTable = this.byId("customerTemplatesTable");
            if (oTable) {
                var oBinding = oTable.getBinding("items");
                var aFilters = [];
                if (sQuery) {
                    aFilters.push(new sap.ui.model.Filter("name", sap.ui.model.FilterOperator.Contains, sQuery));
                }
                oBinding.filter(aFilters);
            }
        },
        
        // Template item press
        onTemplateItemPress: function (oEvent) {
            MessageToast.show("Template selected - Edit functionality coming soon");
        },
        
        // Delete template
        onDeleteTemplate: function () {
            MessageToast.show("Delete Template - Coming soon");
        },
        
        // Refresh templates
        onRefreshTemplates: function () {
            this._loadCustomerTemplates();
            MessageToast.show("Templates refreshed");
        },
        
        // ============================================================================
        // PROCESSING RULES FUNCTIONS
        // ============================================================================
        
        // Load processing rules
        _loadProcessingRules: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            fetch(API_BASE + "/field-mapping/processing-rules")
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    console.log("Loaded Processing Rules:", data.length);
                    oModel.setProperty("/processingRules", data);
                    oModel.setProperty("/ruleCounts/rules", data.length);
                })
                .catch(function (error) {
                    console.error("Error loading processing rules:", error);
                    oModel.setProperty("/processingRules", []);
                });
        },
        
        // Processing rule selection change
        onProcessingRuleSelectionChange: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedItem = oEvent.getParameter("listItem");
            
            if (oSelectedItem) {
                var oContext = oSelectedItem.getBindingContext("app");
                var oRule = oContext.getObject();
                oModel.setProperty("/selectedProcessingRule", oRule);
            }
        },
        
        // Processing rule row press
        onProcessingRuleRowPress: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            oModel.setProperty("/selectedProcessingRule", oRule);
        },
        
        // Open processing rule dialog
        onOpenProcessingRuleDialog: function (oEvent) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("app");
            var oRule = oContext.getObject();
            
            // Create dialog model
            if (!this.getView().getModel("processingRuleDialog")) {
                var oDialogModel = new sap.ui.model.json.JSONModel({
                    editMode: true,
                    rule: {}
                });
                this.getView().setModel(oDialogModel, "processingRuleDialog");
            }
            
            // Set rule data
            var oDialogModel = this.getView().getModel("processingRuleDialog");
            oDialogModel.setProperty("/editMode", true);
            oDialogModel.setProperty("/rule", JSON.parse(JSON.stringify(oRule)));
            
            // Load and open fragment
            // Force reload fragment to get latest changes
            if (this._processingRuleDialog) {
                this._processingRuleDialog.destroy();
                this._processingRuleDialog = null;
            }
            
            if (!this._processingRuleDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "lockbox.view.ProcessingRuleDialog",
                    controller: this
                }).then(function (oDialog) {
                    that._processingRuleDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._processingRuleDialog.open();
            }
        },
        
        // Close processing rule dialog
        onCloseProcessingRuleDialog: function () {
            if (this._processingRuleDialog) {
                this._processingRuleDialog.close();
            }
        },
        
        // Save processing rule
        onSaveProcessingRule: function () {
            var that = this;
            var oDialogModel = this.getView().getModel("processingRuleDialog");
            var oRule = oDialogModel.getProperty("/rule");
            var bEditMode = oDialogModel.getProperty("/editMode");
            
            // Validate
            if (!oRule.ruleId || !oRule.ruleName) {
                sap.m.MessageBox.error("Please fill in all required fields (Rule ID, Rule Name)");
                return;
            }
            
            var sMethod = bEditMode ? "PUT" : "POST";
            var sUrl = bEditMode 
                ? API_BASE + "/field-mapping/processing-rules/" + oRule.ruleId
                : API_BASE + "/field-mapping/processing-rules";
            
            fetch(sUrl, {
                method: sMethod,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oRule)
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    if (data.success) {
                        sap.m.MessageToast.show("Processing rule saved successfully");
                        that._loadProcessingRules();
                        that.onCloseProcessingRuleDialog();
                    } else {
                        sap.m.MessageBox.error("Failed to save processing rule: " + (data.message || "Unknown error"));
                    }
                })
                .catch(function (error) {
                    sap.m.MessageBox.error("Error saving processing rule: " + error.message);
                });
        },
        
        // Create processing rule
        onCreateProcessingRule: function () {
            var that = this;
            
            // Create dialog model
            if (!this.getView().getModel("processingRuleDialog")) {
                var oDialogModel = new sap.ui.model.json.JSONModel({
                    editMode: false,
                    rule: {}
                });
                this.getView().setModel(oDialogModel, "processingRuleDialog");
            }
            
            // Set empty rule
            var oDialogModel = this.getView().getModel("processingRuleDialog");
            oDialogModel.setProperty("/editMode", false);
            oDialogModel.setProperty("/rule", {
                ruleId: "",
                ruleName: "",
                description: "",
                fileType: "EXCEL",
                ruleType: "",
                active: true,
                conditions: [],
                apiMappings: []
            });
            
            // Force reload fragment to get latest changes
            if (this._processingRuleDialog) {
                this._processingRuleDialog.destroy();
                this._processingRuleDialog = null;
            }
            
            // Load and open fragment
            if (!this._processingRuleDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "lockbox.view.ProcessingRuleDialog",
                    controller: this
                }).then(function (oDialog) {
                    that._processingRuleDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._processingRuleDialog.open();
            }
        },
        
        // Edit processing rule
        onEditProcessingRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oRule = oModel.getProperty("/selectedProcessingRule");
            
            if (!oRule) {
                sap.m.MessageToast.show("Please select a rule to edit");
                return;
            }
            
            // Trigger the dialog with the selected rule
            this.onOpenProcessingRuleDialog({
                getSource: function () {
                    return {
                        getBindingContext: function () {
                            return {
                                getObject: function () {
                                    return oRule;
                                }
                            };
                        }
                    };
                }
            });
        },
        
        // Delete processing rule
        onDeleteProcessingRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oRule = oModel.getProperty("/selectedProcessingRule");
            
            if (!oRule) {
                sap.m.MessageToast.show("Please select a rule to delete");
                return;
            }
            
            sap.m.MessageBox.confirm("Are you sure you want to delete rule " + oRule.ruleId + "?", {
                onClose: function (oAction) {
                    if (oAction === sap.m.MessageBox.Action.OK) {
                        fetch(API_BASE + "/field-mapping/processing-rules/" + oRule.ruleId, {
                            method: "DELETE"
                        })
                            .then(function (response) { return response.json(); })
                            .then(function (data) {
                                if (data.success) {
                                    sap.m.MessageToast.show("Rule deleted successfully");
                                    that._loadProcessingRules();
                                    oModel.setProperty("/selectedProcessingRule", null);
                                } else {
                                    sap.m.MessageBox.error("Failed to delete rule: " + (data.message || "Unknown error"));
                                }
                            })
                            .catch(function (error) {
                                sap.m.MessageBox.error("Error deleting rule: " + error.message);
                            });
                    }
                }
            });
        },
        
        // Refresh processing rules
        onRefreshProcessingRules: function () {
            this._loadProcessingRules();
            sap.m.MessageToast.show("Processing rules refreshed");
        },
        
        // Processing rule active toggle
        onProcessingRuleActiveToggle: function (oEvent) {
            var bState = oEvent.getParameter("state");
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("app");
            var oRule = oContext.getObject();
            
            oRule.active = bState;
            
            // Update on backend
            fetch(API_BASE + "/field-mapping/processing-rules/" + oRule.ruleId, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oRule)
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    if (data.success) {
                        sap.m.MessageToast.show("Rule " + (bState ? "activated" : "deactivated"));
                    }
                })
                .catch(function (error) {
                    console.error("Error updating rule:", error);
                });
        },
        
        // Processing rule settings
        onProcessingRuleSettings: function () {
            sap.m.MessageToast.show("Processing rule settings - Coming soon");
        },
        
        // Add rule condition
        onAddRuleCondition: function () {
            var oDialogModel = this.getView().getModel("processingRuleDialog");
            var aConditions = oDialogModel.getProperty("/rule/conditions") || [];
            
            aConditions.push({
                httpMethod: "GET",
                apiReference: "",
                inputField: "",
                sourceInput: "",
                outputField: "",
                lockboxApiField: ""
            });
            
            oDialogModel.setProperty("/rule/conditions", aConditions);
        },
        
        // Delete rule condition
        onDeleteRuleCondition: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("processingRuleDialog");
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.split("/").pop());
            
            var oDialogModel = this.getView().getModel("processingRuleDialog");
            var aConditions = oDialogModel.getProperty("/rule/conditions");
            
            aConditions.splice(iIndex, 1);
            oDialogModel.setProperty("/rule/conditions", aConditions);
        },
        
        // Add API mapping
        onAddApiMapping: function () {
            var oDialogModel = this.getView().getModel("processingRuleDialog");
            var aMappings = oDialogModel.getProperty("/rule/apiMappings") || [];
            
            aMappings.push({
                httpMethod: "GET",
                apiReference: "",
                destination: "",
                inputField: "",
                sourceInput: "",
                outputField: "",
                lockboxApiField: ""
            });
            
            oDialogModel.setProperty("/rule/apiMappings", aMappings);
        },
        
        // Delete API mapping
        onDeleteApiMapping: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("processingRuleDialog");
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.split("/").pop());
            
            var oDialogModel = this.getView().getModel("processingRuleDialog");
            var aMappings = oDialogModel.getProperty("/rule/apiMappings");
            
            aMappings.splice(iIndex, 1);
            oDialogModel.setProperty("/rule/apiMappings", aMappings);
        },
        
        // Processing rule tab select
        onProcessingRuleTabSelect: function (oEvent) {
            // Handle tab selection if needed
        },
        
        // ============================================================================
        // FILE PATTERNS EVENT HANDLERS
        // ============================================================================
        
        // Pattern filter go
        onPatternFilterGo: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oFilters = oModel.getProperty("/patternFilters");
            var that = this;
            
            var queryParams = [];
            if (oFilters.fileType) queryParams.push("fileType=" + oFilters.fileType);
            if (oFilters.category) queryParams.push("category=" + oFilters.category);
            if (oFilters.patternType) queryParams.push("patternType=" + oFilters.patternType);
            
            var url = API_BASE + "/field-mapping/patterns" + (queryParams.length ? "?" + queryParams.join("&") : "");
            
            fetch(url)
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    oModel.setProperty("/filePatterns", data);
                    MessageToast.show(data.length + " pattern(s) found");
                })
                .catch(function (error) {
                    console.error("Error filtering patterns:", error);
                    MessageToast.show("Error filtering patterns");
                });
        },
        
        // Pattern search
        onPatternSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue");
            var oTable = this.byId("filePatternsTable");
            if (oTable) {
                var oBinding = oTable.getBinding("items");
                var aFilters = [];
                if (sQuery) {
                    aFilters.push(new sap.ui.model.Filter({
                        filters: [
                            new sap.ui.model.Filter("patternName", sap.ui.model.FilterOperator.Contains, sQuery),
                            new sap.ui.model.Filter("description", sap.ui.model.FilterOperator.Contains, sQuery)
                        ],
                        and: false
                    }));
                }
                oBinding.filter(aFilters);
            }
        },
        
        // Pattern selection change
        onPatternSelectionChange: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oItem = oEvent.getParameter("listItem");
            if (oItem) {
                var oPattern = oItem.getBindingContext("app").getObject();
                oModel.setProperty("/selectedPattern", oPattern);
                // Initialize conditions array if not exists
                if (!oPattern.conditions) {
                    oPattern.conditions = this._getDefaultConditionsForPattern(oPattern);
                    oModel.setProperty("/selectedPattern/conditions", oPattern.conditions);
                }
            } else {
                oModel.setProperty("/selectedPattern", null);
            }
        },
        
        // Get default conditions based on pattern type
        _getDefaultConditionsForPattern: function(oPattern) {
            var sPatternType = oPattern.patternType;
            var conditions = [];
            
            if (sPatternType === "INVOICE_SPLIT" || sPatternType === "INVOICE_RANGE") {
                conditions = [
                    {
                        priority: 1,
                        detectionCondition: 'Invoice contains ","',
                        strategy: "OUTSTANDING_AMOUNT_MATCH",
                        condition: "OPEN_AR_AVAILABLE = YES",
                        fallbackAction: "HOLD_IN_SUSPENSE",
                        externalDependency: "SAP_AR_Data"
                    },
                    {
                        priority: 2,
                        detectionCondition: 'Invoice contains ","',
                        strategy: "EQUAL_AMOUNT_SPLIT",
                        condition: "DEFAULT",
                        fallbackAction: "HOLD_IN_SUSPENSE",
                        externalDependency: ""
                    }
                ];
            } else if (sPatternType === "CHECK_SPLIT") {
                conditions = [
                    {
                        priority: 1,
                        detectionCondition: 'Check contains ","',
                        strategy: "SPLIT_BY_DELIMITER",
                        condition: "DEFAULT",
                        fallbackAction: "MANUAL_REVIEW",
                        externalDependency: ""
                    }
                ];
            } else if (sPatternType === "BAI2_BANK") {
                conditions = [
                    {
                        priority: 1,
                        detectionCondition: "Transaction Code = 115",
                        strategy: "LOCKBOX_DEPOSIT",
                        condition: "AMOUNT > 0",
                        fallbackAction: "LOG_ERROR",
                        externalDependency: "Bank_Master"
                    }
                ];
            } else if (sPatternType === "PDF_EXTRACTION") {
                conditions = [
                    {
                        priority: 1,
                        detectionCondition: "Field Pattern Match",
                        strategy: "REGEX_EXTRACT",
                        condition: "FIELD_FOUND = YES",
                        fallbackAction: "USE_DEFAULT",
                        externalDependency: ""
                    }
                ];
            }
            
            return conditions;
        },
        
        // Pattern row press - expand detail panel
        onPatternRowPress: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oContext = oEvent.getSource().getBindingContext("app");
            var oPattern = oContext.getObject();
            
            // Set selected pattern
            oModel.setProperty("/selectedPattern", oPattern);
            
            // Initialize conditions if not exists
            if (!oPattern.conditions) {
                oPattern.conditions = this._getDefaultConditionsForPattern(oPattern);
                oModel.setProperty("/selectedPattern/conditions", oPattern.conditions);
            }
            
            // Initialize PDF fields for PDF patterns
            if (oPattern.fileType === "PDF" && !oPattern.pdfFields) {
                oPattern.pdfFields = [
                    { fieldName: "Customer Number", extractionPattern: "", fieldType: "TEXT", required: true, defaultValue: "" },
                    { fieldName: "Invoice Number", extractionPattern: "", fieldType: "TEXT", required: true, defaultValue: "" },
                    { fieldName: "Date", extractionPattern: "", fieldType: "DATE", required: true, defaultValue: "" },
                    { fieldName: "Amount", extractionPattern: "", fieldType: "AMOUNT", required: true, defaultValue: "" },
                    { fieldName: "Payment Reference", extractionPattern: "", fieldType: "TEXT", required: false, defaultValue: "" }
                ];
                oModel.setProperty("/selectedPattern/pdfFields", oPattern.pdfFields);
            }
            
            // Expand the detail panel
            oModel.setProperty("/patternDetailExpanded", true);
        },
        
        // Toggle pattern detail (existing side panel)
        onTogglePatternDetail: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("app");
            var oPattern = oContext.getObject();
            
            var bCurrentlyExpanded = oModel.getProperty("/patternDetailExpanded");
            var currentPatternId = oModel.getProperty("/selectedPattern/patternId");
            
            // If clicking same pattern, toggle; if different pattern, show
            if (bCurrentlyExpanded && currentPatternId === oPattern.patternId) {
                oModel.setProperty("/patternDetailExpanded", false);
                oModel.setProperty("/selectedPattern", null);
            } else {
                oModel.setProperty("/selectedPattern", oPattern);
                oModel.setProperty("/patternDetailExpanded", true);
            }
        },
        
        // Open pattern detail dialog (NEW - for arrow button)
        onOpenPatternDetailDialog: function (oEvent) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("app");
            var oPattern = oContext.getObject();
            
            // Create dialog model
            if (!this.getView().getModel("patternDialog")) {
                var oDialogModel = new sap.ui.model.json.JSONModel({
                    editMode: true,
                    pattern: {}
                });
                this.getView().setModel(oDialogModel, "patternDialog");
            }
            
            // Set pattern data (deep copy)
            var oDialogModel = this.getView().getModel("patternDialog");
            oDialogModel.setProperty("/editMode", true);
            oDialogModel.setProperty("/pattern", JSON.parse(JSON.stringify(oPattern)));
            
            // Load and open fragment
            if (!this._patternDetailDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "lockbox.view.PatternDetailDialog",
                    controller: this
                }).then(function (oDialog) {
                    that._patternDetailDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._patternDetailDialog.open();
            }
        },
        
        // Close pattern detail dialog
        onClosePatternDialog: function () {
            if (this._patternDetailDialog) {
                this._patternDetailDialog.close();
            }
        },
        
        // Pattern tab select
        onPatternTabSelect: function (oEvent) {
            // Handle tab selection if needed
        },
        
        // Add condition row in dialog
        onAddPatternConditionRow: function () {
            var oDialogModel = this.getView().getModel("patternDialog");
            var aConditions = oDialogModel.getProperty("/pattern/conditions") || [];
            
            aConditions.push({
                detectionCondition: "",
                condition: "",
                strategy: "",
                externalDependency: ""
            });
            
            oDialogModel.setProperty("/pattern/conditions", aConditions);
        },
        
        // Delete condition row in dialog
        onDeletePatternConditionRow: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("patternDialog");
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.split("/").pop());
            
            var oDialogModel = this.getView().getModel("patternDialog");
            var aConditions = oDialogModel.getProperty("/pattern/conditions");
            
            if (aConditions.length > 1) {
                aConditions.splice(iIndex, 1);
                oDialogModel.setProperty("/pattern/conditions", aConditions);
                sap.m.MessageToast.show("Condition deleted");
            } else {
                sap.m.MessageToast.show("At least one condition is required");
            }
        },
        
        // Add action row in dialog
        onAddPatternActionRow: function () {
            var oDialogModel = this.getView().getModel("patternDialog");
            var aActions = oDialogModel.getProperty("/pattern/actions") || [];
            
            aActions.push({
                actionType: "",
                relatedApiField: "",
                splitLogic: ""
            });
            
            oDialogModel.setProperty("/pattern/actions", aActions);
        },
        
        // Delete action row in dialog
        onDeletePatternActionRow: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("patternDialog");
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.split("/").pop());
            
            var oDialogModel = this.getView().getModel("patternDialog");
            var aActions = oDialogModel.getProperty("/pattern/actions");
            
            if (aActions && aActions.length > 0) {
                aActions.splice(iIndex, 1);
                oDialogModel.setProperty("/pattern/actions", aActions);
                sap.m.MessageToast.show("Action deleted");
            } else {
                sap.m.MessageToast.show("No actions to delete");
            }
        },
        
        // Save pattern from dialog
        onSavePatternDialog: function () {
            var that = this;
            var oDialogModel = this.getView().getModel("patternDialog");
            var oPattern = oDialogModel.getProperty("/pattern");
            var bEditMode = oDialogModel.getProperty("/editMode");
            
            // Validate
            if (!oPattern.patternId || !oPattern.patternName) {
                sap.m.MessageBox.error("Please fill in Pattern ID and Pattern Name");
                return;
            }
            
            var sMethod = bEditMode ? "PUT" : "POST";
            var sUrl = bEditMode 
                ? API_BASE + "/field-mapping/patterns/" + oPattern.patternId
                : API_BASE + "/field-mapping/patterns";
            
            // Update or create the pattern in the backend
            fetch(sUrl, {
                method: sMethod,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oPattern)
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    if (data.success) {
                        var sMessage = bEditMode ? "Pattern updated successfully" : "Pattern created successfully";
                        sap.m.MessageToast.show(sMessage);
                        that._loadFilePatterns();
                        that.onClosePatternDialog();
                    } else {
                        sap.m.MessageBox.error("Failed to save pattern: " + (data.message || "Unknown error"));
                    }
                })
                .catch(function (error) {
                    sap.m.MessageBox.error("Error saving pattern: " + error.message);
                });
        },
        
        // Create new pattern - opens dialog
        onCreatePatternDialog: function () {
            var that = this;
            
            // Create dialog model if not exists
            if (!this.getView().getModel("patternDialog")) {
                var oDialogModel = new sap.ui.model.json.JSONModel({
                    editMode: false,
                    pattern: {}
                });
                this.getView().setModel(oDialogModel, "patternDialog");
            }
            
            // Set empty pattern for create mode
            var oDialogModel = this.getView().getModel("patternDialog");
            oDialogModel.setProperty("/editMode", false);
            oDialogModel.setProperty("/pattern", {
                patternId: "",
                patternName: "",
                description: "",
                fileType: "EXCEL",
                patternType: "",
                category: "",
                delimiter: "",
                active: true,
                priority: 10,
                conditions: []
            });
            
            // Load and open fragment
            if (!this._patternDetailDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "lockbox.view.PatternDetailDialog",
                    controller: this
                }).then(function (oDialog) {
                    that._patternDetailDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._patternDetailDialog.open();
            }
        },
        
        // Edit pattern from list - opens dialog
        onEditPatternFromList: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oPattern = oModel.getProperty("/selectedPattern");
            
            if (!oPattern) {
                sap.m.MessageToast.show("Please select a pattern to edit");
                return;
            }
            
            // Open dialog with selected pattern
            var oEvent = {
                getSource: function () {
                    return {
                        getBindingContext: function () {
                            return {
                                getObject: function () {
                                    return oPattern;
                                }
                            };
                        }
                    };
                }
            };
            this.onOpenPatternDetailDialog(oEvent);
        },
        
        // Collapse pattern detail panel
        onCollapsePatternDetail: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/patternDetailExpanded", false);
        },
        
        // Add pattern condition
        onAddPatternCondition: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aConditions = oModel.getProperty("/selectedPattern/conditions") || [];
            var oPattern = oModel.getProperty("/selectedPattern");
            
            var newCondition = {
                priority: aConditions.length + 1,
                detectionCondition: "",
                strategy: "EQUAL_AMOUNT_SPLIT",
                condition: "DEFAULT",
                fallbackAction: "HOLD_IN_SUSPENSE",
                externalDependency: ""
            };
            
            // Set default detection condition based on pattern type
            if (oPattern.patternType === "INVOICE_SPLIT") {
                newCondition.detectionCondition = 'Invoice contains ","';
            } else if (oPattern.patternType === "CHECK_SPLIT") {
                newCondition.detectionCondition = 'Check contains ","';
            } else if (oPattern.patternType === "INVOICE_RANGE") {
                newCondition.detectionCondition = 'Invoice contains "-"';
            }
            
            aConditions.push(newCondition);
            oModel.setProperty("/selectedPattern/conditions", aConditions);
            MessageToast.show("New condition added");
        },
        
        // Delete pattern condition
        onDeletePatternCondition: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedCondition = oModel.getProperty("/selectedCondition");
            
            if (!oSelectedCondition) {
                MessageToast.show("Please select a condition to delete");
                return;
            }
            
            var aConditions = oModel.getProperty("/selectedPattern/conditions") || [];
            var idx = aConditions.findIndex(function(c) { return c.priority === oSelectedCondition.priority; });
            
            if (idx >= 0) {
                aConditions.splice(idx, 1);
                // Re-number priorities
                aConditions.forEach(function(c, i) { c.priority = i + 1; });
                oModel.setProperty("/selectedPattern/conditions", aConditions);
                oModel.setProperty("/selectedCondition", null);
                MessageToast.show("Condition deleted");
            }
        },
        
        // Condition selection change
        onConditionSelectionChange: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oItem = oEvent.getParameter("listItem");
            if (oItem) {
                var oCondition = oItem.getBindingContext("app").getObject();
                oModel.setProperty("/selectedCondition", oCondition);
            } else {
                oModel.setProperty("/selectedCondition", null);
            }
        },
        
        // Save pattern conditions
        onSavePatternConditions: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oPattern = oModel.getProperty("/selectedPattern");
            
            if (!oPattern) {
                MessageToast.show("No pattern selected");
                return;
            }
            
            // Update the pattern in the backend
            fetch(API_BASE + "/field-mapping/patterns/" + oPattern.patternId, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oPattern)
            })
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.success) {
                    MessageToast.show("Pattern conditions saved successfully");
                    that._loadFilePatterns();
                } else {
                    MessageBox.error("Failed to save: " + (data.error || "Unknown error"));
                }
            })
            .catch(function(err) {
                MessageBox.error("Error saving pattern: " + err.message);
            });
        },
        
        // Add PDF field
        onAddPdfField: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aPdfFields = oModel.getProperty("/selectedPattern/pdfFields") || [];
            
            aPdfFields.push({
                fieldName: "",
                extractionPattern: "",
                fieldType: "TEXT",
                required: false,
                defaultValue: ""
            });
            
            oModel.setProperty("/selectedPattern/pdfFields", aPdfFields);
            MessageToast.show("New field added");
        },
        
        // Delete PDF field
        onDeletePdfField: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oContext = oEvent.getSource().getBindingContext("app");
            var aPdfFields = oModel.getProperty("/selectedPattern/pdfFields") || [];
            var idx = parseInt(oContext.getPath().split("/").pop());
            
            aPdfFields.splice(idx, 1);
            oModel.setProperty("/selectedPattern/pdfFields", aPdfFields);
            MessageToast.show("Field deleted");
        },
        
        // Format file type state
        formatFileTypeState: function (sType) {
            switch (sType) {
                case "EXCEL": return "Success";
                case "CSV": return "Information";
                case "BAI2": return "Warning";
                case "PDF": return "Error";
                case "WORD": return "None";
                case "PAYMENT_ADVICE": return "Information";
                default: return "None";
            }
        },
        
        // Format strategy state
        formatStrategyState: function (sStrategy) {
            switch (sStrategy) {
                case "OUTSTANDING_AMOUNT_MATCH": return "Success";
                case "EQUAL_AMOUNT_SPLIT": return "Information";
                case "SPLIT_BY_DELIMITER": return "Warning";
                case "REGEX_EXTRACT": return "None";
                case "LOCKBOX_DEPOSIT": return "Success";
                default: return "None";
            }
        },
        
        // Format fallback action state
        formatFallbackState: function (sAction) {
            switch (sAction) {
                case "HOLD_IN_SUSPENSE": return "Warning";
                case "MANUAL_REVIEW": return "Error";
                case "PARTIAL_CLEAR": return "Information";
                case "USE_DEFAULT": return "Success";
                case "LOG_ERROR": return "Error";
                default: return "None";
            }
        },
        
        // Pattern item press - open edit dialog
        onPatternItemPress: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oContext = oEvent.getParameter("listItem").getBindingContext("app");
            var oPattern = oContext.getObject();
            
            // Store for editing
            oModel.setProperty("/editPattern", JSON.parse(JSON.stringify(oPattern)));
            oModel.setProperty("/selectedPattern", oPattern);
            
            // Expand detail panel
            oModel.setProperty("/patternDetailExpanded", true);
        },
        
        // Create new file pattern
        onCreateFilePattern: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Initialize new pattern object
            var oNewPattern = {
                patternName: "",
                fileType: "EXCEL",
                patternType: "SINGLE_CHECK_MULTI_INVOICE",
                category: "CHECK",
                description: "",
                delimiter: "",
                active: true,
                priority: 100,
                fieldMappings: {
                    checkField: "Check Number",
                    amountField: "Check Amount",
                    invoiceField: "Invoice Number",
                    invoiceAmountField: "Invoice Amount",
                    customerField: "Customer",
                    dateField: "Deposit Date"
                }
            };
            
            // Create dialog
            var oDialog = new sap.m.Dialog({
                title: "Create File Pattern",
                contentWidth: "600px",
                content: [
                    new sap.m.VBox({
                        class: "sapUiSmallMargin",
                        items: [
                            new sap.m.Label({ text: "Pattern Name", required: true }),
                            new sap.m.Input({ id: "newPatternName", placeholder: "e.g., Single Check - Multiple Invoices", width: "100%" }),
                            new sap.m.Label({ text: "File Type", required: true }),
                            new sap.m.Select({
                                id: "newPatternFileType",
                                selectedKey: "EXCEL",
                                width: "100%",
                                items: [
                                    new sap.ui.core.Item({ key: "EXCEL", text: "Excel" }),
                                    new sap.ui.core.Item({ key: "CSV", text: "CSV" }),
                                    new sap.ui.core.Item({ key: "BAI2", text: "BAI2" }),
                                    new sap.ui.core.Item({ key: "PDF", text: "PDF" }),
                                    new sap.ui.core.Item({ key: "PAYMENT_ADVICE", text: "Payment Advice" })
                                ]
                            }),
                            new sap.m.Label({ text: "Pattern Type", required: true }),
                            new sap.m.Select({
                                id: "newPatternType",
                                selectedKey: "SINGLE_CHECK_MULTI_INVOICE",
                                width: "100%",
                                items: [
                                    new sap.ui.core.Item({ key: "SINGLE_CHECK_SINGLE_INVOICE", text: "Single Check - Single Invoice" }),
                                    new sap.ui.core.Item({ key: "SINGLE_CHECK_MULTI_INVOICE", text: "Single Check - Multiple Invoices" }),
                                    new sap.ui.core.Item({ key: "MULTI_CHECK_SINGLE_INVOICE", text: "Multiple Checks - Single Invoice" }),
                                    new sap.ui.core.Item({ key: "MULTI_CHECK_MULTI_INVOICE", text: "Multiple Checks - Multiple Invoices" }),
                                    new sap.ui.core.Item({ key: "CHECK_SPLIT", text: "Check Number Split (Delimited)" }),
                                    new sap.ui.core.Item({ key: "INVOICE_SPLIT", text: "Invoice Number Split (Delimited)" }),
                                    new sap.ui.core.Item({ key: "AMOUNT_SPLIT", text: "Amount Split (Delimited)" }),
                                    new sap.ui.core.Item({ key: "SINGLE_CUSTOMER", text: "Single Customer" }),
                                    new sap.ui.core.Item({ key: "MULTI_CUSTOMER", text: "Multiple Customers" })
                                ]
                            }),
                            new sap.m.Label({ text: "Category", required: true }),
                            new sap.m.Select({
                                id: "newPatternCategory",
                                selectedKey: "CHECK",
                                width: "100%",
                                items: [
                                    new sap.ui.core.Item({ key: "CHECK", text: "Check Patterns" }),
                                    new sap.ui.core.Item({ key: "INVOICE", text: "Invoice Patterns" }),
                                    new sap.ui.core.Item({ key: "AMOUNT", text: "Amount Patterns" }),
                                    new sap.ui.core.Item({ key: "CUSTOMER", text: "Customer Patterns" }),
                                    new sap.ui.core.Item({ key: "DELIMITER", text: "Delimiter Patterns" })
                                ]
                            }),
                            new sap.m.Label({ text: "Delimiter (if applicable)" }),
                            new sap.m.Input({ id: "newPatternDelimiter", placeholder: "e.g., , or | or ;", width: "100%" }),
                            new sap.m.Label({ text: "Description" }),
                            new sap.m.TextArea({ id: "newPatternDescription", placeholder: "Describe the pattern...", width: "100%", rows: 3 })
                        ]
                    })
                ],
                beginButton: new sap.m.Button({
                    text: "Create",
                    type: "Emphasized",
                    press: function () {
                        var sName = sap.ui.getCore().byId("newPatternName").getValue();
                        if (!sName) {
                            MessageToast.show("Please enter a pattern name");
                            return;
                        }
                        
                        var oPattern = {
                            patternName: sName,
                            fileType: sap.ui.getCore().byId("newPatternFileType").getSelectedKey(),
                            patternType: sap.ui.getCore().byId("newPatternType").getSelectedKey(),
                            category: sap.ui.getCore().byId("newPatternCategory").getSelectedKey(),
                            delimiter: sap.ui.getCore().byId("newPatternDelimiter").getValue(),
                            description: sap.ui.getCore().byId("newPatternDescription").getValue(),
                            active: true,
                            priority: 100
                        };
                        
                        fetch(API_BASE + "/field-mapping/patterns", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(oPattern)
                        })
                            .then(function (response) { return response.json(); })
                            .then(function (data) {
                                if (data.success) {
                                    that._loadFilePatterns();
                                    MessageToast.show("Pattern created: " + data.pattern.patternId);
                                    oDialog.close();
                                } else {
                                    MessageToast.show("Error: " + (data.error || "Unknown error"));
                                }
                            })
                            .catch(function (error) {
                                MessageToast.show("Error creating pattern: " + error.message);
                            });
                    }
                }),
                endButton: new sap.m.Button({
                    text: "Cancel",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });
            
            oDialog.open();
        },
        
        // Copy pattern
        onCopyPattern: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oPattern = oModel.getProperty("/selectedPattern");
            
            if (!oPattern) {
                MessageToast.show("Please select a pattern to copy");
                return;
            }
            
            fetch(API_BASE + "/field-mapping/patterns/" + oPattern.patternId + "/copy", {
                method: "POST"
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    if (data.success) {
                        that._loadFilePatterns();
                        MessageToast.show("Pattern copied: " + data.pattern.patternId);
                    } else {
                        MessageToast.show("Error: " + (data.error || "Unknown error"));
                    }
                })
                .catch(function (error) {
                    MessageToast.show("Error copying pattern: " + error.message);
                });
        },
        
        // Delete pattern
        onDeletePattern: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oPattern = oModel.getProperty("/selectedPattern");
            
            if (!oPattern) {
                MessageToast.show("Please select a pattern to delete");
                return;
            }
            
            MessageBox.confirm("Are you sure you want to delete pattern '" + oPattern.patternName + "'?", {
                title: "Confirm Delete",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        fetch(API_BASE + "/field-mapping/patterns/" + oPattern.patternId, {
                            method: "DELETE"
                        })
                            .then(function (response) { return response.json(); })
                            .then(function (data) {
                                if (data.success) {
                                    oModel.setProperty("/selectedPattern", null);
                                    that._loadFilePatterns();
                                    MessageToast.show("Pattern deleted");
                                } else {
                                    MessageToast.show("Error: " + (data.error || "Unknown error"));
                                }
                            })
                            .catch(function (error) {
                                MessageToast.show("Error deleting pattern: " + error.message);
                            });
                    }
                }
            });
        },
        
        // Toggle pattern active status
        onPatternActiveToggle: function (oEvent) {
            var that = this;
            var oSwitch = oEvent.getSource();
            var oContext = oSwitch.getBindingContext("app");
            var oPattern = oContext.getObject();
            
            fetch(API_BASE + "/field-mapping/patterns/" + oPattern.patternId + "/toggle", {
                method: "PATCH"
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    if (data.success) {
                        that._loadFilePatterns();
                        MessageToast.show("Pattern " + (data.pattern.active ? "activated" : "deactivated"));
                    }
                })
                .catch(function (error) {
                    console.error("Error toggling pattern:", error);
                    // Revert the switch
                    oSwitch.setState(!oSwitch.getState());
                });
        },
        
        // Refresh patterns
        onRefreshPatterns: function () {
            this._loadFilePatterns();
            MessageToast.show("Patterns refreshed");
        },
        
        // Download patterns (export)
        onDownloadPatterns: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aPatterns = oModel.getProperty("/filePatterns");
            
            var sData = JSON.stringify(aPatterns, null, 2);
            var oBlob = new Blob([sData], { type: "application/json" });
            var sUrl = URL.createObjectURL(oBlob);
            
            var oLink = document.createElement("a");
            oLink.href = sUrl;
            oLink.download = "file_patterns_export.json";
            oLink.click();
            
            URL.revokeObjectURL(sUrl);
            MessageToast.show("Patterns exported");
        },
        
        // Import patterns
        onImportPatterns: function () {
            MessageToast.show("Import patterns - Coming soon");
        },
        
        // Format pattern type state
        formatPatternTypeState: function (sType) {
            switch (sType) {
                case "SINGLE_CHECK_SINGLE_INVOICE":
                case "SINGLE_CHECK_MULTI_INVOICE":
                    return "Success";
                case "MULTI_CHECK_SINGLE_INVOICE":
                case "MULTI_CHECK_MULTI_INVOICE":
                    return "Warning";
                case "CHECK_SPLIT":
                case "INVOICE_SPLIT":
                case "AMOUNT_SPLIT":
                    return "Information";
                default:
                    return "None";
            }
        },
        
        // API field search
        onApiFieldSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue");
            var oTable = this.byId("apiFieldsTable");
            if (oTable) {
                var oBinding = oTable.getBinding("items");
                var aFilters = [];
                if (sQuery) {
                    aFilters.push(new sap.ui.model.Filter("fieldName", sap.ui.model.FilterOperator.Contains, sQuery));
                }
                oBinding.filter(aFilters);
            }
        },
        
        // Refresh API fields
        onRefreshApiFields: function () {
            this._loadApiFields();
            MessageToast.show("API fields refreshed");
        },
        
        // Service search
        onServiceSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue");
            var oTable = this.byId("odataServicesTable");
            if (oTable) {
                var oBinding = oTable.getBinding("items");
                var aFilters = [];
                if (sQuery) {
                    aFilters.push(new sap.ui.model.Filter("technicalServiceName", sap.ui.model.FilterOperator.Contains, sQuery));
                }
                oBinding.filter(aFilters);
            }
        },
        
        // Refresh services
        onRefreshServices: function () {
            this._loadOdataServices();
            MessageToast.show("Services refreshed");
        },
        
        // ============================================================================
        // EXCEL FILE PATTERNS DIALOG FUNCTIONS
        // ============================================================================
        
        // Open Excel File Patterns Dialog
        onOpenExcelFilePatternsDialog: function () {
            var that = this;
            
            // Initialize Excel patterns model if not exists
            if (!this.getView().getModel("excelPatterns")) {
                var oExcelPatternsModel = new JSONModel({
                    patterns: []
                });
                this.getView().setModel(oExcelPatternsModel, "excelPatterns");
            }
            
            // Load sample data based on the Excel sheet provided
            this._loadExcelPatterns();
            
            // Load and open the fragment
            if (!this._excelFilePatternsDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "lockbox.view.ExcelFilePatterns",
                    controller: this
                }).then(function (oDialog) {
                    that._excelFilePatternsDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._excelFilePatternsDialog.open();
            }
        },
        
        // Load Excel Patterns (with sample data from the Excel sheet)
        _loadExcelPatterns: function () {
            var oModel = this.getView().getModel("excelPatterns");
            
            // Sample data based on the provided Excel sheet
            var aPatterns = [
                {
                    patternId: "PAT0001",
                    description: "Single Check, Multiple Invoice",
                    conditions: [
                        {
                            documentFormat: "One check Multiple Invo Check",
                            condition: "One check",
                            action: "One batch item per check",
                            apiFieldReference: "Cheque"
                        },
                        {
                            documentFormat: "Check Amount",
                            condition: "Amount per Check",
                            action: "Per check item",
                            apiFieldReference: "AmountInTransactionCurrency"
                        },
                        {
                            documentFormat: "Invoice/Document number",
                            condition: "Per Check",
                            action: "Invoice/Doc number per Check",
                            apiFieldReference: "PaymentReference"
                        },
                        {
                            documentFormat: "Invoice/Document Amount",
                            condition: "Amount per Invoice/Document",
                            action: "Invoice/Doc number amount",
                            apiFieldReference: "NetPaymentAmountInPayCurrency"
                        }
                    ]
                },
                {
                    patternId: "PAT0002",
                    description: "Multiple Check, Multiple Invoice",
                    conditions: [
                        {
                            documentFormat: "Multiple Check Multiple Check",
                            condition: ">1",
                            action: "Multiple Batch item based on Check",
                            apiFieldReference: "Cheque"
                        },
                        {
                            documentFormat: "Check Amount",
                            condition: ">1",
                            action: "Check amount per batch item",
                            apiFieldReference: "AmountInTransactionCurrency"
                        },
                        {
                            documentFormat: "Invoice/Document number",
                            condition: "Per Check",
                            action: "Invoice/Doc number per Check",
                            apiFieldReference: "PaymentReference"
                        },
                        {
                            documentFormat: "Invoice/Document Amount",
                            condition: "Amount per Invoice/Document",
                            action: "Invoice/Doc number amount",
                            apiFieldReference: "NetPaymentAmountInPayCurrency"
                        }
                    ]
                },
                {
                    patternId: "PAT0003",
                    description: "File Containing Comma",
                    conditions: [
                        {
                            documentFormat: "Comma delimited files Check",
                            condition: "With Comma Separator",
                            action: "Check Split based on Comma",
                            apiFieldReference: "Cheque"
                        },
                        {
                            documentFormat: "Check Amount",
                            condition: "With Comma Separator",
                            action: "Check Amount split per check",
                            apiFieldReference: "AmountInTransactionCurrency"
                        },
                        {
                            documentFormat: "Invoice/Document number",
                            condition: "With Comma Separator",
                            action: "Invoice/Doc number split with complete 10 Digit",
                            apiFieldReference: "PaymentReference"
                        },
                        {
                            documentFormat: "Invoice/Document Amount",
                            condition: "With Comma Separator",
                            action: "Invoice/Document Amount Split with logic per invoice",
                            apiFieldReference: "NetPaymentAmountInPayCurrency"
                        }
                    ]
                },
                {
                    patternId: "PAT0004",
                    description: "File Containing Comma",
                    conditions: [
                        {
                            documentFormat: "Comma delimited files Check",
                            condition: "Hyphen Range",
                            action: "Check Split based on Range",
                            apiFieldReference: "Cheque"
                        },
                        {
                            documentFormat: "Check Amount",
                            condition: "Hyphen Range",
                            action: "Check Amount split per check",
                            apiFieldReference: "AmountInTransactionCurrency"
                        },
                        {
                            documentFormat: "Invoice/Document number",
                            condition: "Hyphen Range",
                            action: "Invoice/Doc number split base on Range",
                            apiFieldReference: "PaymentReference"
                        },
                        {
                            documentFormat: "Invoice/Document Amount",
                            condition: "Hyphen Range",
                            action: "Invoice/Document Amount Split with logic per invoice",
                            apiFieldReference: "NetPaymentAmountInPayCurrency"
                        },
                        {
                            documentFormat: "",
                            condition: "",
                            action: "API Standard",
                            apiFieldReference: ""
                        }
                    ]
                },
                {
                    patternId: "PAT0005",
                    description: "Date Pattern",
                    conditions: [
                        {
                            documentFormat: "Date Pattern Matching MMDDYYYY",
                            condition: "Comma, Dot, Hyphen, Slash",
                            action: "YYYY-MM-DD",
                            apiFieldReference: "DepositDateTime"
                        },
                        {
                            documentFormat: "DDMMYYYY",
                            condition: "Comma, Dot, Hyphen, Slash",
                            action: "YYYY-MM-DD",
                            apiFieldReference: "DepositDateTime"
                        },
                        {
                            documentFormat: "YYYYMMDD",
                            condition: "Comma, Dot, Hyphen, Slash",
                            action: "YYYY-MM-DD",
                            apiFieldReference: "DepositDateTime"
                        },
                        {
                            documentFormat: "MMDDYY",
                            condition: "Comma, Dot, Hyphen, Slash",
                            action: "YYYY-MM-DD",
                            apiFieldReference: "DepositDateTime"
                        },
                        {
                            documentFormat: "DDMMYY",
                            condition: "Comma, Dot, Hyphen, Slash",
                            action: "YYYY-MM-DD",
                            apiFieldReference: "DepositDateTime"
                        },
                        {
                            documentFormat: "YYMMDD",
                            condition: "Comma, Dot, Hyphen, Slash",
                            action: "YYYY-MM-DD",
                            apiFieldReference: "DepositDateTime"
                        }
                    ]
                },
                {
                    patternId: "PAT0006",
                    description: "File containing multiple Sheets",
                    conditions: [
                        {
                            documentFormat: "Header, Item data split Check Data",
                            condition: "Multiple Sheet",
                            action: "Build Heirarchy of 50 Items per Batch",
                            apiFieldReference: "Reference API reference Fields Table"
                        },
                        {
                            documentFormat: "Invoice /Document data",
                            condition: "Multiple Sheet",
                            action: "Build Heirarchy of 50 Items per Batch",
                            apiFieldReference: "Reference API reference Fields Table"
                        }
                    ]
                }
            ];
            
            oModel.setProperty("/patterns", aPatterns);
        },
        
        // Close Excel File Patterns Dialog
        onCloseExcelPatternsDialog: function () {
            if (this._excelFilePatternsDialog) {
                this._excelFilePatternsDialog.close();
            }
        },
        
        // Add new Excel pattern
        onAddExcelPattern: function () {
            var that = this;
            
            // Initialize the edit model
            if (!this.getView().getModel("excelPatternEdit")) {
                var oEditModel = new JSONModel({
                    mode: "create",
                    pattern: {
                        patternId: "",
                        description: "",
                        conditions: []
                    }
                });
                this.getView().setModel(oEditModel, "excelPatternEdit");
            }
            
            // Set mode to create and clear pattern
            var oEditModel = this.getView().getModel("excelPatternEdit");
            oEditModel.setProperty("/mode", "create");
            oEditModel.setProperty("/pattern", {
                patternId: "",
                description: "",
                conditions: [
                    {
                        documentFormat: "",
                        condition: "",
                        action: "",
                        apiFieldReference: ""
                    }
                ]
            });
            
            // Load and open the edit fragment
            if (!this._excelPatternEditDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "lockbox.view.ExcelPatternEdit",
                    controller: this
                }).then(function (oDialog) {
                    that._excelPatternEditDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._excelPatternEditDialog.open();
            }
        },
        
        // Edit Excel pattern
        onEditExcelPattern: function (oEvent) {
            var that = this;
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("excelPatterns");
            var oPattern = oContext.getObject();
            
            // Initialize the edit model if not exists
            if (!this.getView().getModel("excelPatternEdit")) {
                var oEditModel = new JSONModel({
                    mode: "edit",
                    pattern: {}
                });
                this.getView().setModel(oEditModel, "excelPatternEdit");
            }
            
            // Set mode to edit and load pattern data
            var oEditModel = this.getView().getModel("excelPatternEdit");
            oEditModel.setProperty("/mode", "edit");
            oEditModel.setProperty("/pattern", JSON.parse(JSON.stringify(oPattern))); // Deep copy
            
            // Load and open the edit fragment
            if (!this._excelPatternEditDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "lockbox.view.ExcelPatternEdit",
                    controller: this
                }).then(function (oDialog) {
                    that._excelPatternEditDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._excelPatternEditDialog.open();
            }
        },
        
        // Add condition row in edit dialog
        onAddConditionRow: function () {
            var oEditModel = this.getView().getModel("excelPatternEdit");
            var aConditions = oEditModel.getProperty("/pattern/conditions") || [];
            
            aConditions.push({
                documentFormat: "",
                condition: "",
                action: "",
                apiFieldReference: ""
            });
            
            oEditModel.setProperty("/pattern/conditions", aConditions);
        },
        
        // Delete condition row
        onDeleteConditionRow: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("excelPatternEdit");
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.split("/").pop());
            
            var oEditModel = this.getView().getModel("excelPatternEdit");
            var aConditions = oEditModel.getProperty("/pattern/conditions");
            
            if (aConditions.length > 1) {
                aConditions.splice(iIndex, 1);
                oEditModel.setProperty("/pattern/conditions", aConditions);
            } else {
                MessageToast.show("At least one condition row is required");
            }
        },
        
        // Save Excel pattern
        onSaveExcelPattern: function () {
            var oEditModel = this.getView().getModel("excelPatternEdit");
            var oPatternsModel = this.getView().getModel("excelPatterns");
            var oPattern = oEditModel.getProperty("/pattern");
            var sMode = oEditModel.getProperty("/mode");
            
            // Validate
            if (!oPattern.patternId || !oPattern.description) {
                MessageToast.show("Please fill in Pattern ID and Description");
                return;
            }
            
            var aPatterns = oPatternsModel.getProperty("/patterns");
            
            if (sMode === "create") {
                // Check for duplicate ID
                var bExists = aPatterns.some(function (p) {
                    return p.patternId === oPattern.patternId;
                });
                
                if (bExists) {
                    MessageToast.show("Pattern ID already exists");
                    return;
                }
                
                // Add new pattern
                aPatterns.push(JSON.parse(JSON.stringify(oPattern)));
                MessageToast.show("Pattern created: " + oPattern.patternId);
            } else {
                // Update existing pattern
                var iIndex = aPatterns.findIndex(function (p) {
                    return p.patternId === oPattern.patternId;
                });
                
                if (iIndex !== -1) {
                    aPatterns[iIndex] = JSON.parse(JSON.stringify(oPattern));
                    MessageToast.show("Pattern updated: " + oPattern.patternId);
                }
            }
            
            oPatternsModel.setProperty("/patterns", aPatterns);
            
            // Close dialog
            if (this._excelPatternEditDialog) {
                this._excelPatternEditDialog.close();
            }
        },
        
        // Cancel Excel pattern edit
        onCancelExcelPatternEdit: function () {
            if (this._excelPatternEditDialog) {
                this._excelPatternEditDialog.close();
            }
        },
        
        // Delete Excel pattern
        onDeleteExcelPattern: function (oEvent) {
            var that = this;
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("excelPatterns");
            var oPattern = oContext.getObject();
            
            MessageBox.confirm("Are you sure you want to delete pattern " + oPattern.patternId + "?", {
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        var oPatternsModel = that.getView().getModel("excelPatterns");
                        var aPatterns = oPatternsModel.getProperty("/patterns");
                        var iIndex = aPatterns.findIndex(function (p) {
                            return p.patternId === oPattern.patternId;
                        });
                        
                        if (iIndex !== -1) {
                            aPatterns.splice(iIndex, 1);
                            oPatternsModel.setProperty("/patterns", aPatterns);
                            MessageToast.show("Pattern deleted");
                        }
                    }
                }
            });
        },
        
        // Save all Excel patterns
        onSaveExcelPatterns: function () {
            var oPatternsModel = this.getView().getModel("excelPatterns");
            var aPatterns = oPatternsModel.getProperty("/patterns");
            
            // Here you would normally save to backend
            // For now, just show a message
            MessageToast.show("Saved " + aPatterns.length + " Excel patterns");
            
            // You can add backend API call here
            /*
            fetch(API_BASE + "/field-mapping/excel-patterns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ patterns: aPatterns })
            })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                MessageToast.show("Patterns saved successfully");
            })
            .catch(function (error) {
                MessageBox.error("Failed to save patterns: " + error.message);
            });
            */
        },
        
        // Refresh Excel patterns
        onRefreshExcelPatterns: function () {
            this._loadExcelPatterns();
            MessageToast.show("Excel patterns refreshed");
        },
        
        // Excel pattern press (for expanding details)
        onExcelPatternPress: function (oEvent) {
            // Can be used to show additional details in a separate panel if needed
            MessageToast.show("Pattern selected");
        },
        
        // ============================================================================
        // UPLOAD TEMPLATE DIALOG FUNCTIONS
        // ============================================================================
        
        // Open Upload Template Dialog
        onOpenUploadTemplateDialog: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Initialize new template object
            oModel.setProperty("/newTemplate", {
                name: "",
                fileType: "EXCEL",
                templateType: "CUSTOM",
                description: "",
                file: null
            });
            
            var oDialog = this.byId("uploadTemplateDialog");
            oDialog.open();
        },
        
        // Template file change handler
        onTemplateFileChange: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var sFileName = oEvent.getParameter("newValue");
            
            if (sFileName) {
                // Auto-detect file type from extension
                var sExt = sFileName.split('.').pop().toLowerCase();
                var sFileType = "EXCEL";
                
                if (sExt === "csv") {
                    sFileType = "CSV";
                } else if (sExt === "bai" || sExt === "bai2") {
                    sFileType = "BAI2";
                } else if (sExt === "txt" || sExt === "pdf") {
                    sFileType = "PAYMENT_ADVICE";
                }
                
                oModel.setProperty("/newTemplate/fileType", sFileType);
                
                // Auto-fill name if empty
                if (!oModel.getProperty("/newTemplate/name")) {
                    var sName = sFileName.replace(/\.[^/.]+$/, ""); // Remove extension
                    oModel.setProperty("/newTemplate/name", sName);
                }
                
                MessageToast.show("File selected: " + sFileName);
            }
        },
        
        // Save Template
        onSaveTemplate: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oNewTemplate = oModel.getProperty("/newTemplate");
            
            // Validate
            if (!oNewTemplate.name || oNewTemplate.name.trim() === "") {
                MessageBox.error("Template Name is required");
                return;
            }
            
            var oFileUploader = this.byId("templateFileUploader");
            var sFileName = oFileUploader.getValue();
            
            if (!sFileName) {
                MessageBox.error("Please select a file to upload");
                return;
            }
            
            BusyIndicator.show(0);
            
            // Save to backend
            fetch(API_BASE + "/field-mapping/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: oNewTemplate.name,
                    fileType: oNewTemplate.fileType,
                    templateType: oNewTemplate.templateType,
                    description: oNewTemplate.description,
                    fileName: sFileName,
                    active: true
                })
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.success) {
                        // Reload templates
                        that._loadCustomerTemplates();
                        
                        // Close dialog and clear uploader
                        oFileUploader.clear();
                        that.byId("uploadTemplateDialog").close();
                        
                        MessageToast.show("Template '" + oNewTemplate.name + "' uploaded successfully");
                    } else {
                        MessageBox.error("Failed to save template: " + (data.error || "Unknown error"));
                    }
                })
                .catch(function (error) {
                    BusyIndicator.hide();
                    console.error("Error saving template:", error);
                    MessageBox.error("Error saving template: " + error.message);
                });
        },
        
        // Cancel Template Dialog
        onCancelTemplateDialog: function () {
            var oFileUploader = this.byId("templateFileUploader");
            if (oFileUploader) {
                oFileUploader.clear();
            }
            this.byId("uploadTemplateDialog").close();
        },
        
        // ============================================================================
        // ADD API FIELD DIALOG FUNCTIONS
        // ============================================================================
        
        // Open Add API Field Dialog
        // Open Add API Field Dialog
        onOpenAddApiFieldDialog: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Initialize new API field object (no fieldId means this is a new field)
            oModel.setProperty("/editingApiField", {
                fieldId: null,
                fieldName: "",
                necessity: "Optional",
                fieldType: "User Input",
                dataType: "String",
                maxLength: 100,
                defaultValue: "",
                description: "",
                isEditable: true
            });
            
            // Use the same dialog as edit (apiFieldDialog)
            var oDialog = this.byId("apiFieldDialog");
            oDialog.open();
        },
        
        // Save API Field (legacy - redirects to new unified handler)
        onSaveApiField: function () {
            // Redirect to the unified save function
            this.onSaveApiFieldFromDialog();
        },
        
        // Cancel API Field Dialog (legacy - for old addApiFieldDialog)
        onCancelApiFieldDialog: function () {
            var oDialog = this.byId("addApiFieldDialog");
            if (oDialog) {
                oDialog.close();
            }
            // Also close the new dialog if it's open
            var oNewDialog = this.byId("apiFieldDialog");
            if (oNewDialog) {
                oNewDialog.close();
            }
        },
        
        // API Field selection change
        onApiFieldSelectionChange: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedItem = oEvent.getParameter("listItem");
            
            if (oSelectedItem) {
                var oContext = oSelectedItem.getBindingContext("app");
                var sFieldName = oContext.getProperty("fieldName");
                oModel.setProperty("/selectedApiField", sFieldName);
            } else {
                oModel.setProperty("/selectedApiField", null);
            }
        },
        
        // API Field default value change - Save to backend
        onApiFieldDefaultValueChange: function (oEvent) {
            var that = this;
            var oInput = oEvent.getSource();
            var oContext = oInput.getBindingContext("app");
            var oField = oContext.getObject();
            var sNewValue = oEvent.getParameter("value");
            
            // Validate max length
            if (oField.maxLength && sNewValue.length > oField.maxLength) {
                MessageBox.warning("Value exceeds maximum length of " + oField.maxLength + " characters");
                oInput.setValue(oField.defaultValue || "");
                return;
            }
            
            // Save to backend
            fetch(API_BASE + "/field-mapping/api-fields/" + oField.fieldId, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ defaultValue: sNewValue })
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    if (data.success) {
                        MessageToast.show(oField.fieldName + " updated to: " + sNewValue);
                    } else {
                        MessageBox.error("Failed to update: " + (data.error || "Unknown error"));
                        // Revert to original value
                        that._loadApiFields();
                    }
                })
                .catch(function (err) {
                    MessageBox.error("Error: " + err.message);
                    that._loadApiFields();
                });
        },
        
        // Delete API Field (toolbar button - uses selected field)
        onDeleteApiField: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var sSelectedField = oModel.getProperty("/selectedApiField");
            
            if (!sSelectedField) {
                MessageBox.warning("Please select a field to delete");
                return;
            }
            
            // Find the field to get fieldId
            var aFields = oModel.getProperty("/apiFields") || [];
            var oField = aFields.find(function(f) { return f.fieldName === sSelectedField; });
            
            if (!oField) {
                MessageBox.error("Field not found");
                return;
            }
            
            MessageBox.confirm("Are you sure you want to delete the field '" + sSelectedField + "'?", {
                title: "Confirm Delete",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        BusyIndicator.show(0);
                        
                        // Call backend DELETE API
                        fetch(API_BASE + "/field-mapping/api-fields/" + oField.fieldId, {
                            method: "DELETE"
                        })
                            .then(function(response) { return response.json(); })
                            .then(function(data) {
                                BusyIndicator.hide();
                                if (data.success) {
                                    that._loadApiFields();
                                    oModel.setProperty("/selectedApiField", null);
                                    MessageToast.show("Field '" + sSelectedField + "' deleted successfully");
                                } else {
                                    MessageBox.error("Failed to delete: " + (data.error || "Unknown error"));
                                }
                            })
                            .catch(function(err) {
                                BusyIndicator.hide();
                                MessageBox.error("Error deleting field: " + err.message);
                            });
                    }
                }
            });
        },
        
        // Delete API Field Row (inline delete button in table)
        onDeleteApiFieldRow: function (oEvent) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oContext = oEvent.getSource().getBindingContext("app");
            var oField = oContext.getObject();
            
            MessageBox.confirm("Are you sure you want to delete the field '" + oField.fieldName + "'?", {
                title: "Confirm Delete",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        BusyIndicator.show(0);
                        
                        // Call backend DELETE API
                        fetch(API_BASE + "/field-mapping/api-fields/" + oField.fieldId, {
                            method: "DELETE"
                        })
                            .then(function(response) { return response.json(); })
                            .then(function(data) {
                                BusyIndicator.hide();
                                if (data.success) {
                                    that._loadApiFields();
                                    oModel.setProperty("/selectedApiField", null);
                                    MessageToast.show("Field '" + oField.fieldName + "' deleted successfully");
                                } else {
                                    MessageBox.error("Failed to delete: " + (data.error || "Unknown error"));
                                }
                            })
                            .catch(function(err) {
                                BusyIndicator.hide();
                                MessageBox.error("Error deleting field: " + err.message);
                            });
                    }
                }
            });
        },
        
        // Edit API Field (opens dialog with selected field data)
        onEditApiField: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oContext;
            
            // Check if called from table row press or toolbar button
            if (oEvent && oEvent.getSource().getBindingContext) {
                oContext = oEvent.getSource().getBindingContext("app");
            }
            
            var oField;
            if (oContext) {
                // Called from row press
                oField = oContext.getObject();
            } else {
                // Called from toolbar button - use selected field
                var sSelectedField = oModel.getProperty("/selectedApiField");
                if (!sSelectedField) {
                    MessageBox.warning("Please select a field to edit");
                    return;
                }
                var aFields = oModel.getProperty("/apiFields") || [];
                oField = aFields.find(function(f) { return f.fieldName === sSelectedField; });
            }
            
            if (!oField) {
                MessageBox.error("Field not found");
                return;
            }
            
            // Set editing field data for dialog binding
            oModel.setProperty("/editingApiField", {
                fieldId: oField.fieldId,
                fieldName: oField.fieldName,
                necessity: oField.necessity || "Optional",
                fieldType: oField.fieldType || "User Input",
                dataType: oField.dataType || "String",
                maxLength: oField.maxLength || 100,
                defaultValue: oField.defaultValue || "",
                description: oField.description || "",
                isEditable: oField.isEditable !== false
            });
            
            // Open the edit dialog
            var oDialog = this.byId("apiFieldDialog");
            oDialog.open();
        },
        
        // Save API Field (from apiFieldDialog - handles both Add and Edit)
        onSaveApiFieldFromDialog: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oEditingField = oModel.getProperty("/editingApiField");
            
            // Validate
            if (!oEditingField.fieldName || oEditingField.fieldName.trim() === "") {
                MessageBox.error("Field Name is required");
                return;
            }
            
            BusyIndicator.show(0);
            
            var sMethod = oEditingField.fieldId ? "PUT" : "POST";
            var sUrl = oEditingField.fieldId 
                ? API_BASE + "/field-mapping/api-fields/" + oEditingField.fieldId 
                : API_BASE + "/field-mapping/api-fields";
            
            fetch(sUrl, {
                method: sMethod,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oEditingField)
            })
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    BusyIndicator.hide();
                    if (data.success) {
                        that._loadApiFields();
                        that.byId("apiFieldDialog").close();
                        var sAction = oEditingField.fieldId ? "updated" : "added";
                        MessageToast.show("Field '" + oEditingField.fieldName + "' " + sAction + " successfully");
                    } else {
                        MessageBox.error("Failed to save: " + (data.error || "Unknown error"));
                    }
                })
                .catch(function(err) {
                    BusyIndicator.hide();
                    MessageBox.error("Error saving field: " + err.message);
                });
        },
        
        // Close API Field Dialog
        onCloseApiFieldDialog: function () {
            this.byId("apiFieldDialog").close();
        },
        
        // Save All API Fields to backend
        onSaveAllApiFields: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var aFields = oModel.getProperty("/apiFields") || [];
            
            if (aFields.length === 0) {
                MessageBox.warning("No fields to save");
                return;
            }
            
            BusyIndicator.show(0);
            
            // Save each field's default value
            var aPromises = aFields.map(function(oField) {
                return fetch(API_BASE + "/field-mapping/api-fields/" + oField.fieldId, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ defaultValue: oField.defaultValue })
                }).then(function(response) { return response.json(); });
            });
            
            Promise.all(aPromises)
                .then(function(results) {
                    BusyIndicator.hide();
                    var nSuccess = results.filter(function(r) { return r.success; }).length;
                    MessageToast.show(nSuccess + " of " + aFields.length + " fields saved successfully");
                    that._loadApiFields();
                })
                .catch(function(err) {
                    BusyIndicator.hide();
                    MessageBox.error("Error saving fields: " + err.message);
                });
        },
        
        // ============================================================================
        // ADD ODATA SERVICE DIALOG FUNCTIONS
        // ============================================================================
        
        // Open Add OData Service Dialog
        onOpenAddOdataServiceDialog: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Initialize new OData service object
            oModel.setProperty("/editingOdataService", {
                serviceId: null,
                system: "S4HANA On Premise",
                productVersion: "V2",
                technicalServiceName: "",
                externalServiceName: "",
                serviceDescription: "",
                serviceOperations: "GET, POST",
                httpsApiOdata: "",
                authType: "BASIC",
                destination: "",
                active: true
            });
            
            var oDialog = this.byId("odataServiceDialog");
            oDialog.open();
        },
        
        // Edit OData Service
        onEditOdataService: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oService = null;
            
            // Get service from event or selection
            if (oEvent && oEvent.getSource()) {
                var oContext = oEvent.getSource().getBindingContext("app");
                if (oContext) {
                    oService = oContext.getObject();
                }
            }
            
            if (!oService) {
                oService = oModel.getProperty("/selectedOdataService");
            }
            
            if (!oService) {
                MessageToast.show("Please select a service to edit");
                return;
            }
            
            // Set editing service
            oModel.setProperty("/editingOdataService", JSON.parse(JSON.stringify(oService)));
            
            var oDialog = this.byId("odataServiceDialog");
            oDialog.open();
        },
        
        // Save OData Service (Create or Update)
        onSaveOdataService: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oService = oModel.getProperty("/editingOdataService");
            
            // Validate
            if (!oService.system || oService.system.trim() === "") {
                MessageBox.error("System is required");
                return;
            }
            
            if (!oService.httpsApiOdata || oService.httpsApiOdata.trim() === "") {
                MessageBox.error("HTTPS API / OData URL is required");
                return;
            }
            
            BusyIndicator.show(0);
            
            var isEdit = !!oService.serviceId;
            var url = isEdit 
                ? API_BASE + "/field-mapping/odata-services/" + oService.serviceId
                : API_BASE + "/field-mapping/odata-services";
            var method = isEdit ? "PUT" : "POST";
            
            // Save to backend
            fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    system: oService.system,
                    productVersion: oService.productVersion,
                    technicalServiceName: oService.technicalServiceName,
                    externalServiceName: oService.externalServiceName || oService.technicalServiceName,
                    serviceDescription: oService.serviceDescription,
                    serviceOperations: oService.serviceOperations,
                    httpsApiOdata: oService.httpsApiOdata,
                    authType: oService.authType,
                    destination: oService.destination,
                    active: oService.active
                })
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    
                    if (data.success) {
                        // Reload OData services
                        that._loadOdataServices();
                        
                        // Close dialog
                        that.byId("odataServiceDialog").close();
                        
                        MessageToast.show(isEdit ? "Service updated successfully" : "Service added successfully");
                    } else {
                        MessageBox.error("Failed to save service: " + (data.error || "Unknown error"));
                    }
                })
                .catch(function (error) {
                    BusyIndicator.hide();
                    console.error("Error saving OData service:", error);
                    MessageBox.error("Error saving service: " + error.message);
                });
        },
        
        // Close OData Service Dialog
        onCloseOdataServiceDialog: function () {
            this.byId("odataServiceDialog").close();
        },
        
        // Cancel OData Service Dialog (deprecated - use onCloseOdataServiceDialog)
        onCancelOdataServiceDialog: function () {
            this.byId("odataServiceDialog").close();
        },
        
        // OData Service selection change
        onOdataServiceSelectionChange: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedItem = oEvent.getParameter("listItem");
            
            if (oSelectedItem) {
                var oContext = oSelectedItem.getBindingContext("app");
                var sServiceId = oContext.getProperty("id") || oContext.getProperty("technicalServiceName");
                oModel.setProperty("/selectedOdataService", sServiceId);
            } else {
                oModel.setProperty("/selectedOdataService", null);
            }
        },
        
        // Delete OData Service
        onDeleteOdataService: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var sSelectedService = oModel.getProperty("/selectedOdataService");
            
            if (!sSelectedService) {
                MessageBox.warning("Please select a service to delete");
                return;
            }
            
            MessageBox.confirm("Are you sure you want to delete this service?", {
                title: "Confirm Delete",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aServices = oModel.getProperty("/odataServices") || [];
                        var aFiltered = aServices.filter(function(s) {
                            return (s.id || s.technicalServiceName) !== sSelectedService;
                        });
                        oModel.setProperty("/odataServices", aFiltered);
                        oModel.setProperty("/selectedOdataService", null);
                        oModel.setProperty("/ruleCounts/apiOdataServices", aFiltered.length);
                        MessageToast.show("Service deleted successfully");
                    }
                }
            });
        },
        
        // ============================================================================
        // REFERENCE DOCUMENT RULES FUNCTIONS
        // For determining which document number to use for clearing
        // ============================================================================
        
        // Load Reference Document Rules from API
        _loadRefDocRules: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            fetch(API_BASE + "/field-mapping/reference-doc-rules")
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    oModel.setProperty("/referenceDocRules", data.rules || []);
                    oModel.setProperty("/selectedReferenceDocRule", data.selectedRule || "RULE-002");
                    oModel.setProperty("/selectedRefDocRule", data.activeRule || {});
                    oModel.setProperty("/ruleCounts/rules", (data.rules || []).length);
                    console.log("Loaded Reference Doc Rules:", data.rules?.length || 0);
                })
                .catch(function (err) {
                    console.error("Error loading reference doc rules:", err);
                });
        },
        
        // Refresh Reference Document Rules
        onRefreshRefDocRules: function () {
            this._loadRefDocRules();
            MessageToast.show("Reference Document Rules refreshed");
        },
        
        // Open Add Reference Document Rule Dialog
        onOpenAddRefDocRuleDialog: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/editingRefDocRule", {
                ruleName: "",
                description: "",
                ruleType: "XBLNR",
                logicCondition: "",
                documentIdType: "",
                active: true
            });
            this.byId("refDocRuleDialogNew").open();
        },
        
        // Edit Reference Document Rule
        onEditRefDocRule: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            
            oModel.setProperty("/editingRefDocRule", Object.assign({}, oRule));
            this.byId("refDocRuleDialogNew").open();
        },
        
        // Save Reference Document Rule
        onSaveRefDocRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oRule = oModel.getProperty("/editingRefDocRule");
            
            if (!oRule.ruleName || !oRule.ruleType) {
                MessageBox.warning("Rule Name and Rule Type are required");
                return;
            }
            
            BusyIndicator.show(0);
            
            var sMethod = oRule.ruleId ? "PUT" : "POST";
            var sUrl = oRule.ruleId 
                ? API_BASE + "/field-mapping/reference-doc-rules/" + oRule.ruleId
                : API_BASE + "/field-mapping/reference-doc-rules";
            
            fetch(sUrl, {
                method: sMethod,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oRule)
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    if (data.success) {
                        that.byId("refDocRuleDialogNew").close();
                        that._loadRefDocRules();
                        MessageToast.show(oRule.ruleId ? "Rule updated" : "Rule created");
                    } else {
                        MessageBox.error("Failed to save rule: " + (data.error || "Unknown error"));
                    }
                })
                .catch(function (err) {
                    BusyIndicator.hide();
                    MessageBox.error("Error saving rule: " + err.message);
                });
        },
        
        // Close Reference Document Rule Dialog
        onCloseRefDocRuleDialog: function () {
            this.byId("refDocRuleDialogNew").close();
        },
        
        // Reference Document Rule Selection Change
        onRefDocRuleSelectionChange: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedItem = oEvent.getParameter("listItem");
            
            if (oSelectedItem) {
                var oContext = oSelectedItem.getBindingContext("app");
                oModel.setProperty("/selectedRefDocRuleItem", oContext.getObject());
            } else {
                oModel.setProperty("/selectedRefDocRuleItem", null);
            }
        },
        
        // Toggle Reference Document Rule Active Status
        onRefDocRuleActiveToggle: function (oEvent) {
            var that = this;
            var oSwitch = oEvent.getSource();
            var oContext = oSwitch.getBindingContext("app");
            var oRule = oContext.getObject();
            
            fetch(API_BASE + "/field-mapping/reference-doc-rules/" + oRule.ruleId + "/toggle", {
                method: "PATCH"
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    if (data.success) {
                        that._loadRefDocRules();
                    } else {
                        MessageBox.error(data.error || "Failed to toggle rule");
                        // Revert switch state
                        oSwitch.setState(!oSwitch.getState());
                    }
                })
                .catch(function (err) {
                    MessageBox.error("Error: " + err.message);
                    oSwitch.setState(!oSwitch.getState());
                });
        },
        
        // Select Reference Document Rule as Active
        onSelectRefDocRule: function (oEvent) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            
            BusyIndicator.show(0);
            
            fetch(API_BASE + "/field-mapping/reference-doc-rules/" + oRule.ruleId + "/select", {
                method: "POST"
            })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    BusyIndicator.hide();
                    if (data.success) {
                        that._loadRefDocRules();
                        MessageToast.show("Rule '" + oRule.ruleName + "' is now active");
                    } else {
                        MessageBox.error(data.error || "Failed to select rule");
                    }
                })
                .catch(function (err) {
                    BusyIndicator.hide();
                    MessageBox.error("Error: " + err.message);
                });
        },
        
        // ============================================================================
        
        // Adapt filters dialog
        onAdaptRuleFilters: function () {
            MessageToast.show("Adapt Filters - Coming soon");
        },
        
        // Rule tab selection
        onRuleTabSelect: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var sKey = oEvent.getParameter("key");
            oModel.setProperty("/selectedRuleTab", sKey);
        },
        
        // Rule search
        onRuleSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue");
            var oTable = this.byId("fieldMappingRulesTable");
            var oBinding = oTable.getBinding("items");
            
            var aFilters = [];
            if (sQuery) {
                aFilters.push(new sap.ui.model.Filter("ruleName", sap.ui.model.FilterOperator.Contains, sQuery));
            }
            oBinding.filter(aFilters);
        },
        
        // Rule selection change
        onRuleSelectionChange: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedItem = oEvent.getParameter("listItem");
            
            if (oSelectedItem) {
                var oContext = oSelectedItem.getBindingContext("app");
                var sRuleId = oContext.getProperty("id");
                oModel.setProperty("/selectedRule", sRuleId);
            } else {
                oModel.setProperty("/selectedRule", null);
            }
        },
        
        // Rule item press - navigate to detail
        onRuleItemPress: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oListItem = oEvent.getParameter("listItem");
            var oContext = oListItem.getBindingContext("app");
            var oRule = oContext.getObject();
            
            // Store selected rule for copy/delete operations
            oModel.setProperty("/selectedRule", oRule.id);
            
            // Set rule detail for editing
            this._setRuleDetailForEdit(oRule);
            
            // Navigate to detail view
            oModel.setProperty("/showFieldMappingRules", false);
            oModel.setProperty("/showRuleDetail", true);
            oModel.setProperty("/currentView", "ruleDetail");
        },
        
        // Set rule detail for editing
        _setRuleDetailForEdit: function (oRule) {
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Deep copy the rule for editing
            var oRuleDetail = JSON.parse(JSON.stringify(oRule));
            
            // Ensure all required nested objects exist
            oRuleDetail.triggerConditions = oRuleDetail.triggerConditions || [];
            oRuleDetail.inputFields = oRuleDetail.inputFields || [];
            oRuleDetail.outputMappings = oRuleDetail.outputMappings || [];
            oRuleDetail.splitSettings = oRuleDetail.splitSettings || {
                delimiter: ",",
                rangeSeparator: "-",
                outputMode: "EXPLODE",
                preserveOriginal: false
            };
            oRuleDetail.deriveSettings = oRuleDetail.deriveSettings || {
                formula: "",
                sourceFields: "",
                defaultValue: ""
            };
            oRuleDetail.validateSettings = oRuleDetail.validateSettings || {
                validationType: "HARD",
                errorCode: "",
                errorMessage: "",
                stopProcessing: true
            };
            oRuleDetail.allocateSettings = oRuleDetail.allocateSettings || {
                method: "EQUAL",
                roundingRule: "ADJUST_LAST",
                tolerance: 0,
                decimalPlaces: 2
            };
            oRuleDetail.textConversionSettings = oRuleDetail.textConversionSettings || {
                conversionType: "UPPERCASE",
                findText: "",
                replaceWith: "",
                targetLength: 10
            };
            oRuleDetail.description = oRuleDetail.description || "";
            oRuleDetail.errorBehavior = oRuleDetail.errorBehavior || "STOP";
            oRuleDetail.executionOrder = oRuleDetail.executionOrder || 1;
            oRuleDetail.priority = oRuleDetail.priority || 50;
            oRuleDetail.testInput = "";
            oRuleDetail.previewResult = "";
            oRuleDetail.previewApiPayload = "";
            oRuleDetail.previewMessage = "";
            oRuleDetail.previewMessageType = "Information";
            
            oModel.setProperty("/ruleDetail", oRuleDetail);
        },
        
        // Create new rule
        onCreateRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Initialize empty rule detail
            var oNewRule = {
                id: null,
                ruleName: "",
                fileFormat: "EXCEL",
                category: "INVOICE",
                ruleType: "SPLIT",
                active: true,
                priority: 50,
                description: "",
                errorBehavior: "STOP",
                executionOrder: 1,
                triggerConditions: [],
                inputFields: [],
                outputMappings: [],
                splitSettings: {
                    delimiter: ",",
                    rangeSeparator: "-",
                    outputMode: "EXPLODE",
                    preserveOriginal: false
                },
                deriveSettings: {
                    formula: "",
                    sourceFields: "",
                    defaultValue: ""
                },
                validateSettings: {
                    validationType: "HARD",
                    errorCode: "",
                    errorMessage: "",
                    stopProcessing: true
                },
                allocateSettings: {
                    method: "EQUAL",
                    roundingRule: "ADJUST_LAST",
                    tolerance: 0,
                    decimalPlaces: 2
                },
                textConversionSettings: {
                    conversionType: "UPPERCASE",
                    findText: "",
                    replaceWith: "",
                    targetLength: 10
                },
                testInput: "",
                previewResult: "",
                previewApiPayload: "",
                previewMessage: "",
                previewMessageType: "Information"
            };
            
            oModel.setProperty("/ruleDetail", oNewRule);
            
            // Navigate to detail view
            oModel.setProperty("/showFieldMappingRules", false);
            oModel.setProperty("/showRuleDetail", true);
            oModel.setProperty("/currentView", "ruleDetail");
        },
        
        // Copy selected rule
        onCopyRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var sSelectedRuleId = oModel.getProperty("/selectedRule");
            
            if (!sSelectedRuleId) {
                MessageBox.warning("Please select a rule to copy");
                return;
            }
            
            var aRules = oModel.getProperty("/fieldMappingRules");
            var oSourceRule = aRules.find(function(r) { return r.id === sSelectedRuleId; });
            
            if (oSourceRule) {
                var oCopiedRule = JSON.parse(JSON.stringify(oSourceRule));
                oCopiedRule.id = null;
                oCopiedRule.ruleName = oSourceRule.ruleName + " (Copy)";
                this._setRuleDetailForEdit(oCopiedRule);
                
                // Navigate to detail view
                oModel.setProperty("/showFieldMappingRules", false);
                oModel.setProperty("/showRuleDetail", true);
                oModel.setProperty("/currentView", "ruleDetail");
            }
        },
        
        // Delete selected rule
        onDeleteRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var sSelectedRuleId = oModel.getProperty("/selectedRule");
            
            if (!sSelectedRuleId) {
                MessageBox.warning("Please select a rule to delete");
                return;
            }
            
            MessageBox.confirm("Are you sure you want to delete this rule?", {
                title: "Confirm Delete",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aRules = oModel.getProperty("/fieldMappingRules");
                        var aFiltered = aRules.filter(function(r) { return r.id !== sSelectedRuleId; });
                        oModel.setProperty("/fieldMappingRules", aFiltered);
                        oModel.setProperty("/selectedRule", null);
                        MessageToast.show("Rule deleted successfully");
                    }
                }
            });
        },
        
        // Toggle rule active status
        onRuleActiveToggle: function (oEvent) {
            var bState = oEvent.getParameter("state");
            var oContext = oEvent.getSource().getBindingContext("app");
            var sRuleName = oContext.getProperty("ruleName");
            MessageToast.show(sRuleName + " is now " + (bState ? "Active" : "Inactive"));
        },
        
        // Download rules
        onDownloadRules: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aRules = oModel.getProperty("/fieldMappingRules");
            
            var sContent = JSON.stringify(aRules, null, 2);
            var oBlob = new Blob([sContent], { type: "application/json" });
            var sUrl = URL.createObjectURL(oBlob);
            
            var oLink = document.createElement("a");
            oLink.href = sUrl;
            oLink.download = "field_mapping_rules.json";
            oLink.click();
            
            URL.revokeObjectURL(sUrl);
            MessageToast.show("Rules downloaded");
        },
        
        // Upload rules
        onUploadRules: function () {
            MessageToast.show("Upload Rules - Coming soon");
        },
        
        // Rule table settings
        onRuleTableSettings: function () {
            MessageToast.show("Table Settings - Coming soon");
        },
        
        // Refresh rules
        onRefreshRules: function () {
            this._loadFieldMappingRules();
            MessageToast.show("Rules refreshed");
        },
        
        // Format category state
        formatCategoryState: function (sCategory) {
            var oStates = {
                "CHEQUE": "Information",
                "INVOICE": "Success",
                "AMOUNT": "Warning",
                "DATE": "None",
                "REFERENCE": "None"
            };
            return oStates[sCategory] || "None";
        },
        
        // ============================================================================
        // RULE DETAIL PAGE (Page 2) FUNCTIONS
        // ============================================================================
        
        // Back from rule detail
        onRuleDetailBack: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/showRuleDetail", false);
            oModel.setProperty("/showFieldMappingRules", true);
            oModel.setProperty("/currentView", "fieldMappingRules");
        },
        
        // Save rule
        onSaveRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oRuleDetail = oModel.getProperty("/ruleDetail");
            
            // Validate required fields
            if (!oRuleDetail.ruleName || oRuleDetail.ruleName.trim() === "") {
                MessageBox.error("Rule Name is required");
                return;
            }
            
            // Generate ID if new rule
            if (!oRuleDetail.id) {
                oRuleDetail.id = "RULE" + Date.now();
                oRuleDetail.lastChanged = new Date().toISOString();
                oRuleDetail.owner = "user";
                oRuleDetail.type = "my";
                oRuleDetail.triggerSummary = this._generateTriggerSummary(oRuleDetail);
                
                // Add to rules list
                var aRules = oModel.getProperty("/fieldMappingRules") || [];
                aRules.push(oRuleDetail);
                oModel.setProperty("/fieldMappingRules", aRules);
                
                MessageToast.show("Rule created successfully");
            } else {
                // Update existing rule
                oRuleDetail.lastChanged = new Date().toISOString();
                oRuleDetail.triggerSummary = this._generateTriggerSummary(oRuleDetail);
                
                var aRules = oModel.getProperty("/fieldMappingRules") || [];
                var iIndex = aRules.findIndex(function(r) { return r.id === oRuleDetail.id; });
                if (iIndex >= 0) {
                    aRules[iIndex] = oRuleDetail;
                    oModel.setProperty("/fieldMappingRules", aRules);
                }
                
                MessageToast.show("Rule updated successfully");
            }
            
            // Navigate back to list
            this.onRuleDetailBack();
        },
        
        // Generate trigger summary
        _generateTriggerSummary: function (oRule) {
            var sSummary = "";
            if (oRule.triggerConditions && oRule.triggerConditions.length > 0) {
                var oFirst = oRule.triggerConditions[0];
                sSummary = oFirst.attribute + " " + oFirst.operator + " " + oFirst.value;
            } else {
                sSummary = "No conditions defined";
            }
            return sSummary;
        },
        
        // Cancel rule edit
        onCancelRule: function () {
            MessageBox.confirm("Discard changes?", {
                title: "Confirm Cancel",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this.onRuleDetailBack();
                    }
                }.bind(this)
            });
        },
        
        // Rule type change handler
        onRuleTypeChange: function (oEvent) {
            var sRuleType = oEvent.getParameter("selectedItem").getKey();
            MessageToast.show("Rule type changed to: " + sRuleType);
        },
        
        // File format change handler
        onRuleFileFormatChange: function (oEvent) {
            var sFileFormat = oEvent.getParameter("selectedItem").getKey();
            MessageToast.show("File format changed to: " + sFileFormat);
        },
        
        // Add trigger condition
        onAddTriggerCondition: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aConditions = oModel.getProperty("/ruleDetail/triggerConditions") || [];
            
            aConditions.push({
                attribute: "CUSTOMER_FIELD",
                operator: "CONTAINS",
                value: "",
                logic: "AND"
            });
            
            oModel.setProperty("/ruleDetail/triggerConditions", aConditions);
        },
        
        // Delete trigger condition
        onDeleteTriggerCondition: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aConditions = oModel.getProperty("/ruleDetail/triggerConditions") || [];
            
            if (aConditions.length > 0) {
                aConditions.pop();
                oModel.setProperty("/ruleDetail/triggerConditions", aConditions);
            }
        },
        
        // Delete trigger condition row
        onDeleteTriggerConditionRow: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oItem = oEvent.getParameter("listItem");
            var iIndex = oItem.getBindingContext("app").getPath().split("/").pop();
            
            var aConditions = oModel.getProperty("/ruleDetail/triggerConditions") || [];
            aConditions.splice(parseInt(iIndex, 10), 1);
            oModel.setProperty("/ruleDetail/triggerConditions", aConditions);
        },
        
        // Add input field
        onAddInputField: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aFields = oModel.getProperty("/ruleDetail/inputFields") || [];
            
            aFields.push({
                fieldName: "",
                dataType: "STRING",
                sampleValue: "",
                formatPattern: "",
                mandatory: false,
                position: aFields.length + 1
            });
            
            oModel.setProperty("/ruleDetail/inputFields", aFields);
        },
        
        // Auto-detect input fields
        onAutoDetectFields: function () {
            MessageToast.show("Auto-detect fields from uploaded file - Coming soon");
        },
        
        // Delete input field row
        onDeleteInputFieldRow: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oItem = oEvent.getParameter("listItem");
            var iIndex = oItem.getBindingContext("app").getPath().split("/").pop();
            
            var aFields = oModel.getProperty("/ruleDetail/inputFields") || [];
            aFields.splice(parseInt(iIndex, 10), 1);
            oModel.setProperty("/ruleDetail/inputFields", aFields);
        },
        
        // Add output mapping
        onAddOutputMapping: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aMappings = oModel.getProperty("/ruleDetail/outputMappings") || [];
            
            aMappings.push({
                sourceField: "",
                apiField: "AccountingDocument",
                transform: "NONE",
                required: false
            });
            
            oModel.setProperty("/ruleDetail/outputMappings", aMappings);
        },
        
        // Auto-map fields
        onAutoMapFields: function () {
            MessageToast.show("Auto-map fields based on field names - Coming soon");
        },
        
        // Delete output mapping row
        onDeleteOutputMappingRow: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oItem = oEvent.getParameter("listItem");
            var iIndex = oItem.getBindingContext("app").getPath().split("/").pop();
            
            var aMappings = oModel.getProperty("/ruleDetail/outputMappings") || [];
            aMappings.splice(parseInt(iIndex, 10), 1);
            oModel.setProperty("/ruleDetail/outputMappings", aMappings);
        },
        
        // Preview transformation
        onPreviewTransformation: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oRuleDetail = oModel.getProperty("/ruleDetail");
            var sTestInput = oRuleDetail.testInput;
            
            if (!sTestInput || sTestInput.trim() === "") {
                MessageBox.warning("Please enter test input data");
                return;
            }
            
            try {
                // Parse input
                var oInput = JSON.parse(sTestInput);
                
                // Simulate transformation based on rule type
                var oResult = this._applyTransformation(oRuleDetail, oInput);
                
                oModel.setProperty("/ruleDetail/previewResult", JSON.stringify(oResult.transformed, null, 2));
                oModel.setProperty("/ruleDetail/previewApiPayload", JSON.stringify(oResult.apiPayload, null, 2));
                oModel.setProperty("/ruleDetail/previewMessage", "Transformation preview generated successfully");
                oModel.setProperty("/ruleDetail/previewMessageType", "Success");
                
            } catch (e) {
                oModel.setProperty("/ruleDetail/previewMessage", "Error parsing input: " + e.message);
                oModel.setProperty("/ruleDetail/previewMessageType", "Error");
            }
        },
        
        // Apply transformation
        _applyTransformation: function (oRule, oInput) {
            var aTransformed = [];
            var oApiPayload = {};
            
            switch (oRule.ruleType) {
                case "SPLIT":
                    // Split example
                    var sDelimiter = oRule.splitSettings.delimiter || ",";
                    for (var sKey in oInput) {
                        if (typeof oInput[sKey] === "string" && oInput[sKey].includes(sDelimiter)) {
                            var aParts = oInput[sKey].split(sDelimiter);
                            aParts.forEach(function(sPart, i) {
                                var oRow = {};
                                oRow[sKey] = sPart.trim();
                                oRow["_split_index"] = i + 1;
                                aTransformed.push(oRow);
                            });
                        } else {
                            aTransformed.push(oInput);
                        }
                    }
                    break;
                    
                case "VALIDATE":
                    aTransformed.push({
                        input: oInput,
                        validation_passed: true,
                        validation_message: "All validations passed"
                    });
                    break;
                    
                case "DERIVE":
                    var oDerived = JSON.parse(JSON.stringify(oInput));
                    oDerived["_derived_field"] = "Derived value from formula";
                    aTransformed.push(oDerived);
                    break;
                    
                case "ALLOCATE":
                    aTransformed.push({
                        input: oInput,
                        allocation: [{
                            invoice: "INV001",
                            allocated_amount: oInput.Amount || 0
                        }]
                    });
                    break;
                    
                case "TEXT_CONVERSION":
                    var oConverted = {};
                    for (var key in oInput) {
                        if (typeof oInput[key] === "string") {
                            oConverted[key] = oInput[key].toUpperCase();
                        } else {
                            oConverted[key] = oInput[key];
                        }
                    }
                    aTransformed.push(oConverted);
                    break;
                    
                default:
                    aTransformed.push(oInput);
            }
            
            // Generate API payload from output mappings
            if (oRule.outputMappings && oRule.outputMappings.length > 0) {
                oRule.outputMappings.forEach(function(oMapping) {
                    if (oMapping.sourceField && oMapping.apiField) {
                        oApiPayload[oMapping.apiField] = oInput[oMapping.sourceField] || "";
                    }
                });
            }
            
            return {
                transformed: aTransformed,
                apiPayload: oApiPayload
            };
        },
        
        // Simulate rule
        onSimulateRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            
            MessageToast.show("Simulating rule execution...");
            
            // First run preview
            this.onPreviewTransformation();
            
            // Additional simulation logic can be added here
            oModel.setProperty("/ruleDetail/previewMessage", "Rule simulation completed successfully");
            oModel.setProperty("/ruleDetail/previewMessageType", "Success");
        },
        
        // Clear preview
        onClearPreview: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/ruleDetail/testInput", "");
            oModel.setProperty("/ruleDetail/previewResult", "");
            oModel.setProperty("/ruleDetail/previewApiPayload", "");
            oModel.setProperty("/ruleDetail/previewMessage", "");
        },

        // Show stage-specific details when clicking on processing flow icons
        onShowStageDetails: function (oEvent) {
            var oIcon = oEvent.getSource();
            var sStage = oIcon.data("stage");
            var sRunId = oIcon.data("runId");
            
            if (!sRunId) {
                MessageBox.warning("No run ID available");
                return;
            }
            
            // Get the run data from model
            var oModel = this.getView().getModel("app");
            var aRuns = oModel.getProperty("/processingRuns") || [];
            var oRun = aRuns.find(function(run) { return run.runId === sRunId; });
            
            if (!oRun) {
                MessageBox.warning("Run data not found");
                return;
            }
            
            // Build stage-specific content
            var sContent = "";
            var sTitle = "";
            var sIcon = "";
            
            if (sStage === "upload") {
                // Stage 1: Upload & Parse
                sTitle = "Upload & Parse Details";
                sIcon = "sap-icon://write-new-document";
                sContent = this._buildUploadStageContent(oRun);
            } else if (sStage === "validate") {
                // Stage 2: Validate & Map
                sTitle = "Validate & Map Details";
                sIcon = "sap-icon://search";
                sContent = this._buildValidateStageContent(oRun);
            } else if (sStage === "simulate") {
                // Stage 3: Simulation
                sTitle = "Simulation Details";
                sIcon = "sap-icon://document";
                sContent = this._buildSimulateStageContent(oRun);
            } else if (sStage === "post") {
                // Stage 4: Post
                sTitle = "Post Details";
                sIcon = "sap-icon://receipt";
                sContent = this._buildPostStageContent(oRun);
            }
            
            // Show dialog
            this._showStageDetailsDialog(sTitle, sIcon, sContent);
        },
        
        _buildUploadStageContent: function (oRun) {
            var sContent = "";
            sContent += "════════════════════════════════════════════════════════════════\n";
            sContent += "              UPLOAD & PARSE STAGE\n";
            sContent += "════════════════════════════════════════════════════════════════\n\n";
            
            // Upload
            if (oRun.stages && oRun.stages.upload) {
                var uploadStatus = oRun.stages.upload.status === "success" ? "✅ SUCCESS" : 
                                  oRun.stages.upload.status === "error" ? "❌ FAILED" : "⚠️ PENDING";
                sContent += "📤 Upload Stage:\n";
                sContent += "  Status: " + uploadStatus + "\n";
                if (oRun.stages.upload.message) {
                    sContent += "  Message: " + oRun.stages.upload.message + "\n";
                }
                if (oRun.filename) {
                    sContent += "  File: " + oRun.filename + "\n";
                }
                sContent += "\n";
            }
            
            // Template Match
            if (oRun.stages && oRun.stages.templateMatch) {
                var templateStatus = oRun.stages.templateMatch.status === "success" ? "✅ SUCCESS" : 
                                    oRun.stages.templateMatch.status === "error" ? "❌ FAILED" : "⚠️ PENDING";
                sContent += "🔍 Template Match Stage:\n";
                sContent += "  Status: " + templateStatus + "\n";
                if (oRun.stages.templateMatch.templateId) {
                    sContent += "  Template ID: " + oRun.stages.templateMatch.templateId + "\n";
                }
                if (oRun.stages.templateMatch.templateName) {
                    sContent += "  Template Name: " + oRun.stages.templateMatch.templateName + "\n";
                }
                if (oRun.stages.templateMatch.message) {
                    sContent += "  Message: " + oRun.stages.templateMatch.message + "\n";
                }
                sContent += "\n";
            }
            
            // Extraction
            if (oRun.stages && oRun.stages.extraction) {
                var extractStatus = oRun.stages.extraction.status === "success" ? "✅ SUCCESS" : 
                                   oRun.stages.extraction.status === "error" ? "❌ FAILED" : "⚠️ PENDING";
                sContent += "📊 Data Extraction Stage:\n";
                sContent += "  Status: " + extractStatus + "\n";
                if (oRun.stages.extraction.rowCount) {
                    sContent += "  Rows Extracted: " + oRun.stages.extraction.rowCount + "\n";
                }
                if (oRun.stages.extraction.columnsDetected) {
                    sContent += "  Columns Detected: " + oRun.stages.extraction.columnsDetected + "\n";
                }
                if (oRun.stages.extraction.message) {
                    sContent += "  Message: " + oRun.stages.extraction.message + "\n";
                }
                sContent += "\n";
            }
            
            sContent += "════════════════════════════════════════════════════════════════\n";
            return sContent;
        },
        
        _buildValidateStageContent: function (oRun) {
            var sContent = "";
            sContent += "════════════════════════════════════════════════════════════════\n";
            sContent += "              VALIDATE & MAP STAGE\n";
            sContent += "════════════════════════════════════════════════════════════════\n\n";
            
            // Validation
            if (oRun.stages && oRun.stages.validation) {
                var validStatus = oRun.stages.validation.status === "success" ? "✅ SUCCESS" : 
                                 oRun.stages.validation.status === "warning" ? "⚠️ WARNING" :
                                 oRun.stages.validation.status === "error" ? "❌ FAILED" : "⚠️ PENDING";
                sContent += "✓ Validation Stage:\n";
                sContent += "  Status: " + validStatus + "\n";
                if (oRun.stages.validation.validRecords) {
                    sContent += "  Valid Records: " + oRun.stages.validation.validRecords + "\n";
                }
                if (oRun.stages.validation.invalidRecords) {
                    sContent += "  Invalid Records: " + oRun.stages.validation.invalidRecords + "\n";
                }
                if (oRun.stages.validation.warningCount) {
                    sContent += "  Warnings: " + oRun.stages.validation.warningCount + "\n";
                }
                if (oRun.stages.validation.message) {
                    sContent += "  Message: " + oRun.stages.validation.message + "\n";
                }
                if (oRun.stages.validation.errors && oRun.stages.validation.errors.length > 0) {
                    sContent += "  Errors:\n";
                    oRun.stages.validation.errors.forEach(function(err) {
                        sContent += "    • " + err + "\n";
                    });
                }
                sContent += "\n";
            }
            
            // Mapping
            if (oRun.stages && oRun.stages.mapping) {
                var mapStatus = oRun.stages.mapping.status === "success" ? "✅ SUCCESS" : 
                               oRun.stages.mapping.status === "error" ? "❌ FAILED" : "⚠️ PENDING";
                sContent += "🗺️ API Field Mapping Stage:\n";
                sContent += "  Status: " + mapStatus + "\n";
                if (oRun.stages.mapping.fieldsMapped) {
                    sContent += "  Fields Mapped: " + oRun.stages.mapping.fieldsMapped + "\n";
                }
                if (oRun.stages.mapping.rulesApplied) {
                    sContent += "  Rules Applied: " + oRun.stages.mapping.rulesApplied + "\n";
                }
                if (oRun.stages.mapping.message) {
                    sContent += "  Message: " + oRun.stages.mapping.message + "\n";
                }
                sContent += "\n";
            }
            
            sContent += "════════════════════════════════════════════════════════════════\n";
            return sContent;
        },
        
        _buildSimulateStageContent: function (oRun) {
            var sContent = "";
            sContent += "════════════════════════════════════════════════════════════════\n";
            sContent += "              SIMULATION STAGE\n";
            sContent += "════════════════════════════════════════════════════════════════\n\n";
            
            // Check if posted - if posted, simulation was successful
            var isPosted = (oRun.overallStatus === 'posted' || oRun.overallStatus === 'POSTED');
            var isSimulated = (oRun.overallStatus === 'simulated' || oRun.overallStatus === 'SIMULATED');
            
            // If posted, simulation must have been successful
            if (isPosted) {
                sContent += "✅ Simulation Status: SUCCESS\n\n";
                sContent += "The simulation completed successfully and the document has been posted to SAP.\n\n";
                
                // Show simulation result if available
                if (oRun.simulationResult && oRun.simulationResult.sapResponse) {
                    var sapResp = oRun.simulationResult.sapResponse;
                    sContent += "📄 Simulation Preview:\n";
                    sContent += "  Payment Advice: " + (sapResp.paymentAdvice || "N/A") + "\n";
                    if (sapResp.companyCode) {
                        sContent += "  Company Code: " + sapResp.companyCode + "\n";
                    }
                    if (sapResp.fiscalYear) {
                        sContent += "  Fiscal Year: " + sapResp.fiscalYear + "\n";
                    }
                    sContent += "\n";
                }
                
                sContent += "✓ Status: Simulation passed, document successfully posted.\n";
                
            } else if (isSimulated && oRun.simulationResult) {
                // Still in simulated state (not yet posted)
                if (oRun.simulationResult.success) {
                    sContent += "✅ Simulation Result: SUCCESS\n\n";
                    
                    if (oRun.simulationResult.sapResponse) {
                        var sapResp = oRun.simulationResult.sapResponse;
                        sContent += "📄 SAP Simulation Preview:\n";
                        sContent += "  Payment Advice: " + (sapResp.paymentAdvice || "N/A") + "\n";
                        if (sapResp.companyCode) {
                            sContent += "  Company Code: " + sapResp.companyCode + "\n";
                        }
                        if (sapResp.fiscalYear) {
                            sContent += "  Fiscal Year: " + sapResp.fiscalYear + "\n";
                        }
                        sContent += "\n";
                    }
                    
                    if (oRun.simulationResult.itemsProcessed) {
                        sContent += "📊 Items Processed: " + oRun.simulationResult.itemsProcessed + "\n";
                    }
                    
                    if (oRun.simulationResult.totalAmount) {
                        sContent += "💰 Total Amount: " + oRun.simulationResult.totalAmount + " " + 
                                   (oRun.simulationResult.currency || "USD") + "\n";
                    }
                    
                    sContent += "\n📝 Note: This is a simulation preview. No documents have been posted to SAP.\n";
                    sContent += "   To complete posting, click the Production Run button.\n";
                    
                } else {
                    sContent += "❌ Simulation Result: FAILED\n\n";
                    
                    if (oRun.simulationResult.error) {
                        sContent += "Error: " + oRun.simulationResult.error + "\n\n";
                    }
                    
                    if (oRun.simulationResult.sapErrors && oRun.simulationResult.sapErrors.length > 0) {
                        sContent += "SAP Errors:\n";
                        oRun.simulationResult.sapErrors.forEach(function(err, index) {
                            sContent += "  " + (index + 1) + ". " + err + "\n";
                        });
                        sContent += "\n";
                    }
                    
                    sContent += "❗ Please fix the errors before attempting Production Run.\n";
                }
            } else {
                // Check simulation stage status
                if (oRun.stages && oRun.stages.simulate) {
                    var simStatus = oRun.stages.simulate.status === "success" ? "✅ SUCCESS" : 
                                   oRun.stages.simulate.status === "error" ? "❌ FAILED" : "⚠️ PENDING";
                    sContent += "🧪 Simulation Status: " + simStatus + "\n\n";
                    
                    if (oRun.stages.simulate.message) {
                        sContent += "Message: " + oRun.stages.simulate.message + "\n\n";
                    }
                } else {
                    sContent += "⚠️ Status: NOT YET SIMULATED\n\n";
                    sContent += "This run has not been simulated yet.\n";
                    sContent += "Click the 'Simulate' button to preview the SAP posting.\n";
                }
            }
            
            sContent += "\n════════════════════════════════════════════════════════════════\n";
            return sContent;
        },
        
        _buildPostStageContent: function (oRun) {
            var sContent = "";
            sContent += "════════════════════════════════════════════════════════════════\n";
            sContent += "              POST TO SAP STAGE\n";
            sContent += "════════════════════════════════════════════════════════════════\n\n";
            
            // Check if posted based on overallStatus first
            var isPosted = (oRun.overallStatus === 'posted' || oRun.overallStatus === 'POSTED');
            var isSimulated = (oRun.overallStatus === 'simulated' || oRun.overallStatus === 'SIMULATED');
            
            if (isPosted && oRun.productionResult) {
                // Posted with production result
                if (oRun.productionResult.success) {
                    sContent += "✅ Status: SUCCESS\n\n";
                    
                    if (oRun.productionResult.sapResponse) {
                        var sapResp = oRun.productionResult.sapResponse;
                        sContent += "📄 SAP Response:\n";
                        sContent += "  Accounting Document: " + (sapResp.accountingDocument || "N/A") + "\n";
                        sContent += "  Payment Advice: " + (sapResp.paymentAdvice || "N/A") + "\n";
                        sContent += "  Fiscal Year: " + (sapResp.fiscalYear || "N/A") + "\n";
                        sContent += "  Company Code: " + (sapResp.companyCode || "N/A") + "\n";
                        sContent += "\n";
                    }
                    
                    if (oRun.productionResult.clearing) {
                        sContent += "💰 Clearing Information:\n";
                        sContent += "  Status: " + (oRun.productionResult.clearing.status || "N/A") + "\n";
                        sContent += "  Items Cleared: " + (oRun.productionResult.clearing.clearedItems || 0) + "\n";
                        if (oRun.productionResult.clearing.totalAmount) {
                            sContent += "  Total Amount: " + oRun.productionResult.clearing.totalAmount + " " + (oRun.productionResult.clearing.currency || "USD") + "\n";
                        }
                        sContent += "\n";
                    }
                } else {
                    sContent += "❌ Status: FAILED\n\n";
                    
                    if (oRun.productionResult.error) {
                        sContent += "⚠️ Error Details:\n";
                        sContent += "  Message: " + (oRun.productionResult.error.message || "Unknown error") + "\n";
                        if (oRun.productionResult.error.sapErrorMessage) {
                            sContent += "  SAP Error: " + oRun.productionResult.error.sapErrorMessage + "\n";
                        }
                        if (oRun.productionResult.error.sapErrorCode) {
                            sContent += "  Error Code: " + oRun.productionResult.error.sapErrorCode + "\n";
                        }
                        sContent += "\n";
                    }
                }
            } else if (isPosted) {
                // Posted but no detailed production result available
                sContent += "✅ Status: POSTED\n\n";
                sContent += "📄 Production Posting:\n";
                sContent += "  This run has been successfully posted to SAP.\n";
                sContent += "  Run ID: " + (oRun.runId || "N/A") + "\n";
                if (oRun.lockbox) {
                    sContent += "  Lockbox: " + oRun.lockbox + "\n";
                }
                if (oRun.amount) {
                    sContent += "  Amount: " + oRun.amount + " " + (oRun.currency || "USD") + "\n";
                }
                sContent += "\n";
                sContent += "ℹ️ Note: Detailed SAP response not available in cache.\n";
                sContent += "   Check SAP system for accounting documents.\n\n";
            } else if (isSimulated) {
                // Simulated but not posted
                sContent += "⚠️ Status: SIMULATED (Not Posted)\n\n";
                sContent += "This run has been simulated but NOT posted to SAP.\n";
                sContent += "Simulation shows a preview of what would be posted.\n\n";
                sContent += "📋 Next Steps:\n";
                sContent += "  1. Review simulation results\n";
                sContent += "  2. Use Production Run action to post\n\n";
            } else if (oRun.stages && oRun.stages.posted) {
                // Check stages.posted status
                var postStatus = oRun.stages.posted.status === "success" ? "✅ SUCCESS" : 
                                oRun.stages.posted.status === "error" ? "❌ FAILED" : "⚠️ NOT POSTED YET";
                sContent += "Status: " + postStatus + "\n\n";
                
                if (oRun.stages.posted.message) {
                    sContent += "Message: " + oRun.stages.posted.message + "\n\n";
                }
            } else {
                // Not posted yet
                sContent += "⚠️ Status: NOT POSTED YET\n\n";
                sContent += "This run has not been posted to SAP.\n";
                sContent += "Current Stage: " + (oRun.overallStatus || "Unknown").toUpperCase() + "\n\n";
                sContent += "📋 Next Steps:\n";
                if (!isSimulated) {
                    sContent += "  1. Complete validation and mapping\n";
                    sContent += "  2. Run simulation (optional)\n";
                    sContent += "  3. Use Production Run action to post\n\n";
                } else {
                    sContent += "  1. Use Production Run action to post\n\n";
                }
            }
            
            sContent += "════════════════════════════════════════════════════════════════\n";
            return sContent;
        },
        
        _showStageDetailsDialog: function (sTitle, sIcon, sContent) {
            var oTextArea = new TextArea({
                value: sContent,
                width: "100%",
                height: "400px",
                editable: false,
                growing: false
            });
            
            var oDialog = new Dialog({
                title: sTitle,
                icon: sIcon,
                contentWidth: "700px",
                contentHeight: "500px",
                content: [
                    new VBox({
                        items: [oTextArea]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                beginButton: new Button({
                    text: "Copy to Clipboard",
                    icon: "sap-icon://copy",
                    press: function () {
                        navigator.clipboard.writeText(sContent).then(function () {
                            MessageToast.show("Stage details copied to clipboard");
                        });
                    }
                }),
                endButton: new Button({
                    text: "Close",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });
            
            this.getView().addDependent(oDialog);
            oDialog.open();
        }

    });
});
