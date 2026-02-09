sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, JSONModel, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("lockbox.controller.ProcessingRules", {

        onInit: function () {
            console.log("Processing Rules Controller initialized");
            
            // Get parent component model
            var oModel = this.getOwnerComponent().getModel("app");
            if (!oModel) {
                console.error("Parent app model not found");
                return;
            }
            
            // Initialize processing rules data if not exists
            if (!oModel.getProperty("/processingRules")) {
                this._initializeRulesData(oModel);
            }
            
            // Initialize filters
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
            oModel.setProperty("/selectedProcessingRule", null);
        },

        /**
         * Initialize filter data
         */
        _initializeFilters: function (oModel) {
            if (!oModel.getProperty("/processingRuleFilters")) {
                oModel.setProperty("/processingRuleFilters", {
                    fileType: "",
                    ruleType: "",
                    active: ""
                });
            }
        },

        /**
         * Navigate back to home
         */
        onNavBack: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            if (oModel) {
                oModel.setProperty("/showHome", true);
                oModel.setProperty("/showProcessingRules", false);
                oModel.setProperty("/showNavButton", false);
            }
        },

        /**
         * Filter Go button
         */
        onProcessingRuleFilterGo: function () {
            MessageToast.show("Filters applied");
            // In production: apply filters to table binding
        },

        /**
         * Clear filters
         */
        onClearProcessingRuleFilters: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/processingRuleFilters", {
                fileType: "",
                ruleType: "",
                active: ""
            });
            this.byId("filterRuleId").setValue("");
            MessageToast.show("Filters cleared");
        },

        /**
         * Create new rule
         */
        onCreateProcessingRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/editingProcessingRule", {
                ruleId: "",
                fileType: "Excel",
                ruleType: "Transform",
                description: "",
                active: true
            });
            
            var oDialog = this.byId("processingRuleDialog");
            if (oDialog) {
                oDialog.open();
            }
        },

        /**
         * Edit selected rule
         */
        onEditProcessingRule: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            if (!oContext) {
                // Handle case when button is clicked
                var oItem = oEvent.getSource().getParent();
                oContext = oItem.getBindingContext("app");
            }
            
            var oRule = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Clone the rule for editing
            oModel.setProperty("/editingProcessingRule", JSON.parse(JSON.stringify(oRule)));
            
            var oDialog = this.byId("processingRuleDialog");
            if (oDialog) {
                oDialog.open();
            }
        },

        /**
         * Copy selected rule
         */
        onCopyProcessingRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedRule = oModel.getProperty("/selectedProcessingRule");
            
            if (!oSelectedRule) {
                MessageBox.warning("Please select a rule to copy");
                return;
            }
            
            var aRules = oModel.getProperty("/processingRules");
            var oCopiedRule = JSON.parse(JSON.stringify(oSelectedRule));
            oCopiedRule.ruleId = "LB-RULE-" + String(Date.now()).slice(-3);
            oCopiedRule.description = oSelectedRule.description + " (Copy)";
            
            aRules.push(oCopiedRule);
            oModel.setProperty("/processingRules", aRules);
            
            MessageToast.show("Rule copied successfully");
        },

        /**
         * Delete selected rule
         */
        onDeleteProcessingRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedRule = oModel.getProperty("/selectedProcessingRule");
            
            if (!oSelectedRule) {
                MessageBox.warning("Please select a rule to delete");
                return;
            }
            
            MessageBox.confirm(
                "Are you sure you want to delete rule '" + oSelectedRule.ruleId + "'?",
                {
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            var aRules = oModel.getProperty("/processingRules");
                            var iIndex = aRules.findIndex(function (r) {
                                return r.ruleId === oSelectedRule.ruleId;
                            });
                            
                            if (iIndex > -1) {
                                aRules.splice(iIndex, 1);
                                oModel.setProperty("/processingRules", aRules);
                                oModel.setProperty("/selectedProcessingRule", null);
                                MessageToast.show("Rule deleted successfully");
                            }
                        }
                    }
                }
            );
        },

        /**
         * Refresh rules
         */
        onRefreshProcessingRules: function () {
            MessageToast.show("Rules refreshed");
            // In production: reload from backend
        },

        /**
         * Rule selection changed
         */
        onProcessingRuleSelectionChange: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem) {
                var oContext = oSelectedItem.getBindingContext("app");
                var oRule = oContext.getObject();
                var oModel = this.getOwnerComponent().getModel("app");
                oModel.setProperty("/selectedProcessingRule", oRule);
            }
        },

        /**
         * Rule active toggle
         */
        onProcessingRuleActiveToggle: function (oEvent) {
            var bState = oEvent.getParameter("state");
            MessageToast.show(bState ? "Rule activated" : "Rule deactivated");
        },

        /**
         * Save rule
         */
        onSaveProcessingRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oEditingRule = oModel.getProperty("/editingProcessingRule");
            
            // Validate required fields
            if (!oEditingRule.ruleId || !oEditingRule.description) {
                MessageBox.error("Please fill in all required fields");
                return;
            }
            
            var aRules = oModel.getProperty("/processingRules");
            
            // Check if rule exists
            var iIndex = aRules.findIndex(function (r) {
                return r.ruleId === oEditingRule.ruleId;
            });
            
            if (iIndex > -1) {
                // Update existing rule
                aRules[iIndex] = oEditingRule;
                MessageToast.show("Rule updated successfully");
            } else {
                // Add new rule
                aRules.push(oEditingRule);
                MessageToast.show("Rule created successfully");
            }
            
            oModel.setProperty("/processingRules", aRules);
            
            // Close dialog
            this.onCloseProcessingRuleDialog();
        },

        /**
         * Close dialog
         */
        onCloseProcessingRuleDialog: function () {
            var oDialog = this.byId("processingRuleDialog");
            if (oDialog) {
                oDialog.close();
            }
        }
    });
});
