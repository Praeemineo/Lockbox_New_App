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
            oModel.setProperty("/showConfig", false);
            oModel.setProperty("/showTemplateBuilder", false);
            oModel.setProperty("/showLockbox", false);
            oModel.setProperty("/showNavButton", false);
            oModel.setProperty("/currentView", "home");
        },
        
        // Navigation: Configuration Tile Press
        onConfigTilePress: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/showHome", false);
            oModel.setProperty("/showConfig", true);
            oModel.setProperty("/showTemplateBuilder", false);
            oModel.setProperty("/showLockbox", false);
            oModel.setProperty("/showNavButton", true);
            oModel.setProperty("/currentView", "config");
        },
        
        // Navigation: Template Builder Tile Press
        onTemplateBuilderTilePress: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/showHome", false);
            oModel.setProperty("/showConfig", false);
            oModel.setProperty("/showTemplateBuilder", true);
            oModel.setProperty("/showLockbox", false);
            oModel.setProperty("/showNavButton", true);
            oModel.setProperty("/currentView", "templateBuilder");
        },
        
        // Navigation: Lockbox Transaction Tile Press
        onLockboxTilePress: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/showHome", false);
            oModel.setProperty("/showConfig", false);
            oModel.setProperty("/showTemplateBuilder", false);
            oModel.setProperty("/showLockbox", true);
            oModel.setProperty("/showNavButton", true);
            oModel.setProperty("/currentView", "lockbox");
            // Load headers when entering Lockbox Transaction
            this._loadHeaders();
        },
        
        // Navigation: Back Button Press
        onNavBack: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/showHome", true);
            oModel.setProperty("/showConfig", false);
            oModel.setProperty("/showTemplateBuilder", false);
            oModel.setProperty("/showLockbox", false);
            oModel.setProperty("/showNavButton", false);
            oModel.setProperty("/currentView", "home");
        },
        
        // ============================================================================
        // TEMPLATE BUILDER FUNCTIONS
        // ============================================================================
        
        // Initialize Template Builder state
        _initTemplateBuilder: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Generate unique Lockbox ID for testing
            var sTestLockboxId = "LB-TEST-" + Date.now().toString().slice(-8);
            
            // Initialize template builder state
            oModel.setProperty("/templateBuilder", {
                fileSelected: false,
                uploadedFile: null,
                extractedFields: [],
                fieldMappings: [],
                templateName: "",
                savedTemplates: [],
                simulationResult: null,
                testLockboxId: sTestLockboxId,
                // Auto-populated fields from system/background
                autoPopulatedFields: [
                    { apiField: "Lockbox", value: sTestLockboxId, source: "Auto-Generated", editable: false },
                    { apiField: "CompanyCode", value: "1710", source: "System", editable: true },
                    { apiField: "Currency", value: "USD", source: "Default", editable: true },
                    { apiField: "LockboxBatchOrigin", value: "LOCKBOXORI", source: "System", editable: true },
                    { apiField: "LockboxBatchDestination", value: "LOCKBOXDES", source: "System", editable: true },
                    { apiField: "PartnerBankCountry", value: "US", source: "Default", editable: true }
                ],
                // Available API fields for mapping
                availableApiFields: [
                    { key: "", text: "-- Select API Field --" },
                    // Header fields
                    { key: "Lockbox", text: "Lockbox (Header)" },
                    { key: "DepositDateTime", text: "DepositDateTime (Header)" },
                    { key: "AmountInTransactionCurrency", text: "Amount (Header)" },
                    { key: "LockboxBatchOrigin", text: "LockboxBatchOrigin (Header)" },
                    { key: "LockboxBatchDestination", text: "LockboxBatchDestination (Header)" },
                    { key: "CompanyCode", text: "CompanyCode (Header)" },
                    // Cheques fields
                    { key: "LockboxBatch", text: "LockboxBatch (Cheques)" },
                    { key: "LockboxBatchItem", text: "LockboxBatchItem (Cheques)" },
                    { key: "Cheque", text: "Cheque Number (Cheques)" },
                    { key: "PartnerBank", text: "PartnerBank (Cheques)" },
                    { key: "PartnerBankAccount", text: "PartnerBankAccount (Cheques)" },
                    { key: "PartnerBankCountry", text: "PartnerBankCountry (Cheques)" },
                    // Payment Reference fields
                    { key: "PaymentReference", text: "PaymentReference (Payment Ref)" },
                    { key: "NetPaymentAmountInPaytCurrency", text: "NetPaymentAmount (Payment Ref)" },
                    { key: "DeductionAmountInPaytCurrency", text: "DeductionAmount (Payment Ref)" },
                    { key: "PaymentDifferenceReason", text: "PaymentDifferenceReason (Payment Ref)" },
                    { key: "Currency", text: "Currency" },
                    // Custom fields
                    { key: "CustomerNumber", text: "Customer Number (Custom)" },
                    { key: "InvoiceNumber", text: "Invoice Number (Custom)" }
                ]
            });
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
                    return "sap-icon://folder";
                case "BATCH":
                    return "sap-icon://batch-payments";
                case "CHEQUE":
                    return "sap-icon://money-bills";
                case "PAYMENT_REF":
                    return "sap-icon://payment-approval";
                default:
                    return "sap-icon://document";
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

            fetch(API_BASE + "/lockbox/headers", {
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
                    var aHeaders = data.value || [];
                    
                    // Apply client-side filters
                    if (oFilters.lockboxId) {
                        aHeaders = aHeaders.filter(function(h) { return h.lockbox === oFilters.lockboxId; });
                    }
                    if (oFilters.status) {
                        aHeaders = aHeaders.filter(function(h) { return h.status === oFilters.status; });
                    }
                    
                    oModel.setProperty("/headers", aHeaders);
                    
                    // Build tree data for TreeTable
                    that._buildTreeData(aHeaders);
                    
                    // Update lockbox ID dropdown list
                    var aLockboxIds = [{ key: "", text: "All" }];
                    var aUniqueIds = [...new Set((data.value || []).map(function(h) { return h.lockbox; }))];
                    aUniqueIds.forEach(function(id) {
                        aLockboxIds.push({ key: id, text: id });
                    });
                    oModel.setProperty("/lockboxIdList", aLockboxIds);
                    
                    BusyIndicator.hide();
                })
                .catch(function (error) {
                    console.error("Error loading headers:", error);
                    MessageToast.show("Error loading lockbox headers: " + error.message);
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
            var oNode = {
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
                        
                        // Find the full header details from headers array
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
            
            // Create FileUploader for the dialog
            if (!this._oDialogFileUploader) {
                this._oDialogFileUploader = new FileUploader({
                    id: "dialogFileUploader",
                    name: "lockboxFile",
                    fileType: ["xlsx", "xls"],
                    placeholder: "Select an Excel file (.xlsx, .xls)",
                    width: "100%",
                    change: function (oEvent) {
                        var sFileName = oEvent.getParameter("newValue");
                        if (sFileName) {
                            MessageToast.show("File selected: " + sFileName);
                        }
                    },
                    typeMissmatch: function () {
                        MessageBox.error("Please select an Excel file (.xlsx or .xls)");
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
        
        // Perform upload from dialog
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
            
            // Use XMLHttpRequest for proper multipart handling
            var oXhr = new XMLHttpRequest();
            oXhr.open("POST", API_BASE + "/lockbox/upload", true);
            
            oXhr.onload = function () {
                BusyIndicator.hide();
                
                try {
                    var oResponse = JSON.parse(oXhr.responseText);
                    
                    if (oResponse.success) {
                        MessageBox.success(oResponse.message + "\n\nStatus: UPLOADED\nReady for Simulation", {
                            title: "Upload Successful",
                            onClose: function () {
                                that._loadHeaders();
                                var oModel = that.getOwnerComponent().getModel("app");
                                oModel.setProperty("/selectedHeader", oResponse.header_id);
                            }
                        });
                    } else {
                        var sErrors = "";
                        if (oResponse.errors && oResponse.errors.length > 0) {
                            sErrors = "\n\nValidation Errors:\n";
                            oResponse.errors.forEach(function (err) {
                                sErrors += "- [" + err.code + "] " + err.message + "\n";
                            });
                        }
                        MessageBox.error(oResponse.message + sErrors, {
                            title: "Upload Failed"
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
            
            // Send the form data
            oXhr.send(oFormData);
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

        // Upload handler
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

            // Create FormData for multipart upload
            var oFormData = new FormData();
            oFormData.append("file", oFile, oFile.name);

            // Use XMLHttpRequest for proper multipart handling
            var oXhr = new XMLHttpRequest();
            oXhr.open("POST", API_BASE + "/lockbox/upload", true);
            
            oXhr.onload = function () {
                BusyIndicator.hide();
                
                try {
                    var oResponse = JSON.parse(oXhr.responseText);
                    
                    if (oResponse.success) {
                        MessageBox.success(oResponse.message, {
                            title: "Upload Successful",
                            onClose: function () {
                                oFileUploader.clear();
                                that._loadHeaders();
                                var oModel = that.getOwnerComponent().getModel("app");
                                oModel.setProperty("/selectedHeader", oResponse.header_id);
                                that._loadHierarchy(oResponse.header_id);
                            }
                        });
                    } else {
                        var sErrors = "";
                        if (oResponse.errors && oResponse.errors.length > 0) {
                            sErrors = "\n\nValidation Errors:\n";
                            oResponse.errors.forEach(function (err) {
                                sErrors += "- [" + err.code + "] " + err.message + "\n";
                            });
                        }
                        MessageBox.error(oResponse.message + sErrors, {
                            title: "Upload Failed"
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
            
            fetch(API_BASE + "/run/" + sRunId, {
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
                
                if (data.success) {
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
        _showRunDetailsDialog: function (oData) {
            var oRun = oData.run;
            var aSapResponses = oData.sapResponses || [];
            var aClearing = oData.lineLevelClearing || [];
            
            var sContent = "";
            sContent += "════════════════════════════════════════════════════════════════\n";
            sContent += "              RUN DETAILS: " + oRun.runId + "\n";
            sContent += "════════════════════════════════════════════════════════════════\n\n";
            
            // Run Header
            sContent += "────────────────────────────────────────────────────────────────\n";
            sContent += "                       RUN HEADER\n";
            sContent += "────────────────────────────────────────────────────────────────\n\n";
            sContent += "  Run ID:              " + oRun.runId + "\n";
            sContent += "  Lockbox:             " + oRun.lockbox + "\n";
            sContent += "  Company Code:        " + oRun.companyCode + "\n";
            sContent += "  Mode:                " + oRun.mode + "\n";
            sContent += "  Status:              " + oRun.status + "\n";
            sContent += "  Amount:              " + oRun.amount + " " + (oRun.currency || "") + "\n";
            sContent += "  Started At:          " + (oRun.startedAt ? new Date(oRun.startedAt).toLocaleString() : "N/A") + "\n";
            sContent += "  Completed At:        " + (oRun.completedAt ? new Date(oRun.completedAt).toLocaleString() : "N/A") + "\n";
            if (oRun.duration) {
                sContent += "  Duration:            " + oRun.duration + " seconds\n";
            }
            sContent += "\n";
            
            // SAP Response Entries
            sContent += "────────────────────────────────────────────────────────────────\n";
            sContent += "               SAP RESPONSE LOG (" + aSapResponses.length + " entries)\n";
            sContent += "────────────────────────────────────────────────────────────────\n\n";
            
            if (aSapResponses.length > 0) {
                aSapResponses.forEach(function (oResp, idx) {
                    sContent += "  Entry " + (idx + 1) + ":\n";
                    sContent += "    Payment Advice:      " + (oResp.paymentAdvice || "N/A") + "\n";
                    sContent += "    Payment Advice Item: " + (oResp.paymentAdviceItem || "N/A") + "\n";
                    sContent += "    Accounting Document: " + (oResp.accountingDocument || "N/A") + "\n";
                    sContent += "    Fiscal Year:         " + (oResp.fiscalYear || "N/A") + "\n";
                    sContent += "    Lockbox Batch:       " + (oResp.lockboxBatch || "N/A") + "\n";
                    sContent += "    Amount:              " + (oResp.amount || "N/A") + " " + (oResp.currency || "") + "\n";
                    sContent += "\n";
                });
            } else {
                sContent += "  No SAP response entries available.\n\n";
            }
            
            // Line Level Clearing
            sContent += "────────────────────────────────────────────────────────────────\n";
            sContent += "            LINE LEVEL CLEARING (" + aClearing.length + " entries)\n";
            sContent += "────────────────────────────────────────────────────────────────\n\n";
            
            if (aClearing.length > 0) {
                aClearing.forEach(function (oLine, idx) {
                    sContent += "  Line " + (idx + 1) + ":\n";
                    sContent += "    Payment Reference:   " + (oLine.paymentReference || "N/A") + "\n";
                    sContent += "    Invoice:             " + (oLine.invoice || "N/A") + "\n";
                    sContent += "    Cleared Amount:      " + (oLine.clearedAmount || "N/A") + " " + (oLine.currency || "") + "\n";
                    sContent += "\n";
                });
            } else {
                sContent += "  No line-level clearing entries available.\n\n";
            }
            
            sContent += "════════════════════════════════════════════════════════════════\n";
            
            // Create TextArea for display
            var oTextArea = new TextArea({
                value: sContent,
                width: "100%",
                height: "400px",
                editable: false,
                growing: false
            });
            
            // Create dialog
            var oDialog = new Dialog({
                title: "Run Details - " + oRun.runId,
                icon: "sap-icon://detail-view",
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
        }

    });
});
