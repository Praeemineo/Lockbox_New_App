sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator"
], function (Controller, JSONModel, MessageBox, MessageToast, BusyIndicator) {
    "use strict";

    // API Base URL
    const API_BASE = window.REACT_APP_BACKEND_URL || window.location.origin;

    return Controller.extend("lockbox.controller.ProcessingRules", {

        onInit: function () {
            console.log("Processing Rules Controller initialized");
            
            // Get parent component model
            var oModel = this.getOwnerComponent().getModel("app");
            if (!oModel) {
                console.error("Parent app model not found");
                return;
            }
            
            // Initialize processing rules data
            this._initializeRulesData(oModel);
            
            // Initialize filter data
            this._initializeFilters(oModel);
        },

        /**
         * Initialize sample processing rules data
         */
        _initializeRulesData: function (oModel) {
            var aRules = [
                {
                    ruleId: "LB-RULE-001",
                    fileType: "Excel",
                    ruleType: "Split",
                    description: "Split invoice numbers separated by commas into individual payment references",
                    active: true
                },
                {
                    ruleId: "LB-RULE-002",
                    fileType: "Excel",
                    ruleType: "Expand",
                    description: "Expand invoice number ranges (e.g., 95015001 to 010) into individual invoices",
                    active: true
                },
                {
                    ruleId: "LB-RULE-003",
                    fileType: "All",
                    ruleType: "Validate",
                    description: "Validate that invoice amounts are numeric and within acceptable range",
                    active: true
                },
                {
                    ruleId: "LB-RULE-004",
                    fileType: "CSV",
                    ruleType: "Transform",
                    description: "Convert various date formats to ISO 8601 standard (YYYY-MM-DD)",
                    active: true
                },
                {
                    ruleId: "LB-RULE-005",
                    fileType: "Excel",
                    ruleType: "Transform",
                    description: "Pad cheque numbers with leading zeros to ensure 10-digit format",
                    active: false
                },
                {
                    ruleId: "LB-RULE-006",
                    fileType: "BAI2",
                    ruleType: "Parse",
                    description: "Parse BAI2 format files and extract transaction details",
                    active: true
                },
                {
                    ruleId: "LB-RULE-007",
                    fileType: "PDF",
                    ruleType: "Extract",
                    description: "Extract payment information from PDF documents using OCR",
                    active: false
                }
            ];
            
            oModel.setProperty("/processingRules", aRules);
            oModel.setProperty("/selectedRules", []);
        },

        /**
         * Initialize filter data
         */
        _initializeFilters: function (oModel) {
            oModel.setProperty("/filters", {
                editingStatus: "",
                description: "",
                procedureType: "",
                journalEntryType: "",
                ruleId: "",
                templateId: "",
                companyCode: "",
                createdOn: null,
                applicationType: [],
                direction: ""
            });
        },

        /**
         * Navigate back to home
         */
        onNavBack: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            if (oModel) {
                oModel.setProperty("/showHome", true);
                oModel.setProperty("/showProcessingRules", false);
            }
        },

        /**
         * Refresh rules list
         */
        onRefreshRules: function () {
            MessageToast.show("Rules refreshed");
            // In production: reload from backend
        },

        /**
         * Tab selection
         */
        onTabSelect: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            MessageToast.show("Selected tab: " + sKey);
        },

        /**
         * Filter Go button
         */
        onFilterGo: function () {
            MessageToast.show("Filters applied");
            // TODO: Apply filters to table
        },

        /**
         * Adapt filters
         */
        onAdaptFilters: function () {
            MessageToast.show("Adapt filters dialog");
        },

        /**
         * Upload button
         */
        onUpload: function () {
            MessageToast.show("Upload functionality");
        },

        /**
         * Download button
         */
        onDownload: function () {
            MessageToast.show("Download functionality");
        },

        /**
         * Create new rule
         */
        onCreateRule: function () {
            MessageToast.show("Create new rule - Opening dialog");
        },

        /**
         * Automate button
         */
        onAutomate: function () {
            MessageToast.show("Automate functionality");
        },

        /**
         * Copy selected rules
         */
        onCopyRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aSelectedRules = oModel.getProperty("/selectedRules");
            
            if (!aSelectedRules || aSelectedRules.length === 0) {
                MessageBox.warning("Please select at least one rule to copy");
                return;
            }
            
            MessageToast.show(aSelectedRules.length + " rule(s) copied");
        },

        /**
         * Delete selected rules
         */
        onDeleteRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var aSelectedRules = oModel.getProperty("/selectedRules");
            
            if (!aSelectedRules || aSelectedRules.length === 0) {
                MessageBox.warning("Please select at least one rule to delete");
                return;
            }
            
            MessageBox.confirm(
                "Are you sure you want to delete " + aSelectedRules.length + " rule(s)?",
                {
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            MessageToast.show(aSelectedRules.length + " rule(s) deleted successfully");
                            oModel.setProperty("/selectedRules", []);
                        }
                    }
                }
            );
        },

        /**
         * Settings button
         */
        onSettings: function () {
            MessageToast.show("Settings");
        },

        /**
         * Table settings
         */
        onTableSettings: function () {
            MessageToast.show("Table settings");
        },

        /**
         * Sort button
         */
        onSort: function () {
            MessageToast.show("Sort options");
        },

        /**
         * Filter table button
         */
        onFilterTable: function () {
            MessageToast.show("Filter table");
        },

        /**
         * More options
         */
        onMore: function () {
            MessageToast.show("More options");
        },

        /**
         * Rule selection changed
         */
        onRuleSelectionChange: function (oEvent) {
            var oTable = oEvent.getSource();
            var aSelectedItems = oTable.getSelectedItems();
            var aSelectedRules = [];
            
            aSelectedItems.forEach(function (oItem) {
                var oContext = oItem.getBindingContext("app");
                aSelectedRules.push(oContext.getObject());
            });
            
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/selectedRules", aSelectedRules);
        },

        /**
         * Rule item press
         */
        onRuleItemPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            
            MessageToast.show("Opening details for: " + oRule.ruleId);
            // TODO: Open rule details dialog/page
        },

        /**
         * Rule ID press
         */
        onRuleIdPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            
            MessageToast.show("Rule ID clicked: " + oRule.ruleId);
        }
    });
});