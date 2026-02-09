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
         * Create new rule
         */
        onCreateRule: function () {
            MessageToast.show("Create rule dialog - To be implemented");
        },

        /**
         * Copy selected rule
         */
        onCopyRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedRule = oModel.getProperty("/selectedRule");
            
            if (!oSelectedRule) {
                MessageBox.warning("Please select a rule to copy");
                return;
            }
            
            var aRules = oModel.getProperty("/processingRules");
            var oCopiedRule = JSON.parse(JSON.stringify(oSelectedRule));
            oCopiedRule.ruleId = "RULE-" + String(Date.now()).slice(-3);
            oCopiedRule.ruleName = oSelectedRule.ruleName + " (Copy)";
            
            aRules.push(oCopiedRule);
            oModel.setProperty("/processingRules", aRules);
            
            MessageToast.show("Rule copied successfully");
        },

        /**
         * Delete selected rule
         */
        onDeleteRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedRule = oModel.getProperty("/selectedRule");
            
            if (!oSelectedRule) {
                MessageBox.warning("Please select a rule to delete");
                return;
            }
            
            MessageBox.confirm(
                "Are you sure you want to delete rule '" + oSelectedRule.ruleName + "'?",
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
                                oModel.setProperty("/selectedRule", null);
                                oModel.setProperty("/ruleDetailExpanded", false);
                                MessageToast.show("Rule deleted successfully");
                            }
                        }
                    }
                }
            );
        },

        /**
         * Search rules
         */
        onRuleSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue");
            var oTable = this.byId("processingRulesTable");
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
         * Rule selection changed
         */
        onRuleSelectionChange: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem) {
                var oContext = oSelectedItem.getBindingContext("app");
                var oRule = oContext.getObject();
                var oModel = this.getOwnerComponent().getModel("app");
                oModel.setProperty("/selectedRule", oRule);
            }
        },

        /**
         * Rule row press
         */
        onRuleRowPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            oModel.setProperty("/selectedRule", oRule);
            oModel.setProperty("/ruleDetailExpanded", true);
        },

        /**
         * Toggle rule detail panel
         */
        onToggleRuleDetail: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var bExpanded = oModel.getProperty("/ruleDetailExpanded");
            
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            
            if (!bExpanded || oModel.getProperty("/selectedRule/ruleId") !== oRule.ruleId) {
                oModel.setProperty("/selectedRule", oRule);
                oModel.setProperty("/ruleDetailExpanded", true);
            } else {
                oModel.setProperty("/ruleDetailExpanded", false);
            }
        },

        /**
         * Collapse rule detail panel
         */
        onCollapseRuleDetail: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/ruleDetailExpanded", false);
        },

        /**
         * Edit rule
         */
        onEditRule: function () {
            MessageToast.show("Edit mode enabled");
        },

        /**
         * Save rule
         */
        onSaveRule: function () {
            MessageToast.show("Rule saved successfully");
        },

        /**
         * Rule active toggle
         */
        onRuleActiveToggle: function (oEvent) {
            var bState = oEvent.getParameter("state");
            MessageToast.show(bState ? "Rule activated" : "Rule deactivated");
        },

        /**
         * Add condition
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
         * Delete condition
         */
        onDeleteCondition: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var sPath = oContext.getPath();
            var oModel = this.getOwnerComponent().getModel("app");
            
            var aConditions = oModel.getProperty("/selectedRule/conditions");
            var iIndex = parseInt(sPath.split("/").pop());
            aConditions.splice(iIndex, 1);
            oModel.setProperty("/selectedRule/conditions", aConditions);
            
            MessageToast.show("Condition deleted");
        },

        /**
         * Filter Go button
         */
        onRuleFilterGo: function () {
            MessageToast.show("Filters applied");
            // TODO: Apply filters to table
        },

        /**
         * Adapt filters
         */
        onAdaptRuleFilters: function () {
            MessageToast.show("Adapt filters dialog - To be implemented");
        }
    });
});