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
            
            // Initialize file types and rule types for dropdowns
            this._initializeDropdownData(oModel);
        },

        /**
         * Initialize sample processing rules data
         */
        _initializeRulesData: function (oModel) {
            var aRules = [
                {
                    ruleId: "RULE-001",
                    ruleName: "Invoice Split by Comma",
                    description: "Split invoice numbers separated by commas into individual payment references",
                    fileType: "Excel",
                    ruleType: "Split",
                    active: true,
                    conditions: [
                        { field: "Invoice Number", operator: "contains", value: "," }
                    ],
                    action: {
                        type: "split",
                        apiEndpoint: "/api/lockbox/process",
                        odataService: "",
                        parameters: '{"delimiter": ",", "trim": true}'
                    }
                },
                {
                    ruleId: "RULE-002",
                    ruleName: "Invoice Range Expansion",
                    description: "Expand invoice number ranges (e.g., 95015001 to 010) into individual invoices",
                    fileType: "Excel",
                    ruleType: "Expand",
                    active: true,
                    conditions: [
                        { field: "Invoice Number", operator: "contains", value: "to" }
                    ],
                    action: {
                        type: "expand",
                        apiEndpoint: "/api/lockbox/process",
                        odataService: "",
                        parameters: '{"rangePattern": "to"}'
                    }
                },
                {
                    ruleId: "RULE-003",
                    ruleName: "Amount Validation",
                    description: "Validate that invoice amounts are numeric and within acceptable range",
                    fileType: "All",
                    ruleType: "Validate",
                    active: true,
                    conditions: [
                        { field: "Amount", operator: "isNotEmpty", value: "" }
                    ],
                    action: {
                        type: "validate",
                        apiEndpoint: "/api/lockbox/validate",
                        odataService: "",
                        parameters: '{"dataType": "numeric", "min": 0, "max": 999999999}'
                    }
                },
                {
                    ruleId: "RULE-004",
                    ruleName: "Date Format Transformation",
                    description: "Convert various date formats to ISO 8601 standard (YYYY-MM-DD)",
                    fileType: "CSV",
                    ruleType: "Transform",
                    active: true,
                    conditions: [
                        { field: "Date", operator: "isNotEmpty", value: "" }
                    ],
                    action: {
                        type: "transform",
                        apiEndpoint: "/api/lockbox/transform",
                        odataService: "",
                        parameters: '{"outputFormat": "ISO8601"}'
                    }
                },
                {
                    ruleId: "RULE-005",
                    ruleName: "Cheque Number Padding",
                    description: "Pad cheque numbers with leading zeros to ensure 10-digit format",
                    fileType: "Excel",
                    ruleType: "Transform",
                    active: false,
                    conditions: [
                        { field: "Cheque Number", operator: "isNotEmpty", value: "" }
                    ],
                    action: {
                        type: "transform",
                        apiEndpoint: "/api/lockbox/transform",
                        odataService: "",
                        parameters: '{"padTo": 10, "padChar": "0", "padDirection": "left"}'
                    }
                }
            ];
            
            oModel.setProperty("/processingRules", aRules);
        },

        /**
         * Initialize dropdown data for file types and rule types
         */
        _initializeDropdownData: function (oModel) {
            var aFileTypes = ["Excel", "CSV", "PDF", "BAI2", "All"];
            var aRuleTypes = ["Split", "Expand", "Transform", "Validate", "API Call"];
            
            oModel.setProperty("/fileTypes", aFileTypes);
            oModel.setProperty("/ruleTypes", aRuleTypes);
        },

        /**
         * Navigate back to home screen
         */
        onNavBack: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            if (oModel) {
                oModel.setProperty("/showHome", true);
                oModel.setProperty("/showProcessingRules", false);
                oModel.setProperty("/showNavButton", false);
                oModel.setProperty("/currentView", "home");
            }
        },

        /**
         * Create new rule button handler
         */
        onCreateRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Create empty rule template
            var oNewRule = {
                ruleId: "RULE-" + String(Date.now()).slice(-3),
                ruleName: "New Rule",
                description: "",
                fileType: "Excel",
                ruleType: "Transform",
                active: true,
                conditions: [],
                action: {
                    type: "transform",
                    apiEndpoint: "",
                    odataService: "",
                    parameters: ""
                }
            };
            
            oModel.setProperty("/selectedRule", oNewRule);
            
            // Open details dialog
            var oDialog = this.byId("ruleDetailsDialog");
            if (oDialog) {
                oDialog.open();
            }
            
            MessageToast.show("Create new processing rule");
        },

        /**
         * Copy selected rule
         */
        onCopyRule: function () {
            var oTable = this.byId("rulesTable");
            var oSelectedItem = oTable.getSelectedItem();
            
            if (!oSelectedItem) {
                MessageBox.warning("Please select a rule to copy");
                return;
            }
            
            var oContext = oSelectedItem.getBindingContext("app");
            var oRule = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            var aRules = oModel.getProperty("/processingRules");
            
            // Create copy with new ID
            var oCopiedRule = JSON.parse(JSON.stringify(oRule));
            oCopiedRule.ruleId = "RULE-" + String(Date.now()).slice(-3);
            oCopiedRule.ruleName = oRule.ruleName + " (Copy)";
            
            aRules.push(oCopiedRule);
            oModel.setProperty("/processingRules", aRules);
            
            MessageToast.show("Rule copied successfully");
        },

        /**
         * Delete selected rule
         */
        onDeleteRule: function () {
            var that = this;
            var oTable = this.byId("rulesTable");
            var oSelectedItem = oTable.getSelectedItem();
            
            if (!oSelectedItem) {
                MessageBox.warning("Please select a rule to delete");
                return;
            }
            
            var oContext = oSelectedItem.getBindingContext("app");
            var oRule = oContext.getObject();
            
            MessageBox.confirm(
                "Are you sure you want to delete rule '" + oRule.ruleName + "'?",
                {
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            var oModel = that.getOwnerComponent().getModel("app");
                            var aRules = oModel.getProperty("/processingRules");
                            var iIndex = aRules.findIndex(function (r) {
                                return r.ruleId === oRule.ruleId;
                            });
                            
                            if (iIndex > -1) {
                                aRules.splice(iIndex, 1);
                                oModel.setProperty("/processingRules", aRules);
                                MessageToast.show("Rule deleted successfully");
                            }
                        }
                    }
                }
            );
        },

        /**
         * Refresh rules list
         */
        onRefresh: function () {
            MessageToast.show("Rules refreshed");
            // In production, this would reload from backend
        },

        /**
         * Download rules
         */
        onDownload: function () {
            MessageToast.show("Download feature coming soon");
        },

        /**
         * Search rules
         */
        onSearchRules: function (oEvent) {
            var sQuery = oEvent.getParameter("query");
            var oTable = this.byId("rulesTable");
            var oBinding = oTable.getBinding("items");
            
            if (sQuery) {
                var aFilters = [
                    new sap.ui.model.Filter({
                        filters: [
                            new sap.ui.model.Filter("ruleId", sap.ui.model.FilterOperator.Contains, sQuery),
                            new sap.ui.model.Filter("ruleName", sap.ui.model.FilterOperator.Contains, sQuery),
                            new sap.ui.model.Filter("description", sap.ui.model.FilterOperator.Contains, sQuery)
                        ],
                        and: false
                    })
                ];
                oBinding.filter(aFilters);
            } else {
                oBinding.filter([]);
            }
        },

        /**
         * Handle rule selection
         */
        onRuleSelect: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem) {
                console.log("Rule selected:", oSelectedItem.getBindingContext("app").getObject());
            }
        },

        /**
         * Handle active toggle
         */
        onActiveToggle: function (oEvent) {
            var bState = oEvent.getParameter("state");
            MessageToast.show(bState ? "Rule activated" : "Rule deactivated");
        },

        /**
         * Open rule details dialog
         */
        onRuleDetailsPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Set selected rule
            oModel.setProperty("/selectedRule", oRule);
            
            // Open dialog
            var oDialog = this.byId("ruleDetailsDialog");
            if (oDialog) {
                oDialog.open();
            }
        },

        /**
         * Close rule details dialog
         */
        onCloseRuleDetails: function () {
            var oDialog = this.byId("ruleDetailsDialog");
            if (oDialog) {
                oDialog.close();
            }
        },

        /**
         * Tab select handler in details dialog
         */
        onTabSelect: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            console.log("Tab selected:", sKey);
        },

        /**
         * Add condition to rule
         */
        onAddCondition: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oRule = oModel.getProperty("/selectedRule");
            
            if (!oRule.conditions) {
                oRule.conditions = [];
            }
            
            oRule.conditions.push({
                field: "",
                operator: "equals",
                value: ""
            });
            
            oModel.setProperty("/selectedRule", oRule);
            MessageToast.show("Condition added");
        },

        /**
         * Delete condition from rule
         */
        onDeleteCondition: function (oEvent) {
            var that = this;
            var oContext = oEvent.getSource().getBindingContext("app");
            var sPath = oContext.getPath();
            var oModel = this.getOwnerComponent().getModel("app");
            
            MessageBox.confirm("Delete this condition?", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        var aConditions = oModel.getProperty("/selectedRule/conditions");
                        var iIndex = parseInt(sPath.split("/").pop());
                        aConditions.splice(iIndex, 1);
                        oModel.setProperty("/selectedRule/conditions", aConditions);
                        MessageToast.show("Condition deleted");
                    }
                }
            });
        },

        /**
         * Save rule changes
         */
        onSaveRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedRule = oModel.getProperty("/selectedRule");
            var aRules = oModel.getProperty("/processingRules");
            
            // Find if rule exists
            var iIndex = aRules.findIndex(function (r) {
                return r.ruleId === oSelectedRule.ruleId;
            });
            
            if (iIndex > -1) {
                // Update existing rule
                aRules[iIndex] = oSelectedRule;
                MessageToast.show("Rule updated successfully");
            } else {
                // Add new rule
                aRules.push(oSelectedRule);
                MessageToast.show("Rule created successfully");
            }
            
            oModel.setProperty("/processingRules", aRules);
            
            // Close dialog
            this.onCloseRuleDetails();
        }
    });
});
