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
            
            // Initialize sample processing rules data
            var sampleRules = [
                {
                    ruleId: "RUL-001",
                    ruleName: "Document Type Resolution",
                    description: "Identify if reference is Invoice / Accounting Doc / Sales Order and determine Accounting Document accordingly.",
                    fileType: "EXCEL / CSV",
                    ruleType: "DOCUMENT_TYPE_RULE",
                    active: true,
                    conditions: [
                        { field: "ReferenceField", operator: "contains", value: "INV" },
                        { field: "DocType", operator: "equals", value: "Invoice" }
                    ],
                    action: {
                        type: "transform",
                        apiEndpoint: "/api/lockbox/resolve-document-type",
                        odataService: "",
                        parameters: '{"targetField": "AccountingDocument"}'
                    }
                },
                {
                    ruleId: "RUL-002",
                    ruleName: "Comma Split Rule",
                    description: "Split comma-separated reference documents (e.g., INV1001,INV1002) and process individually.",
                    fileType: "EXCEL / CSV",
                    ruleType: "COMMA_SPLIT_RULE",
                    active: true,
                    conditions: [
                        { field: "ReferenceDocument", operator: "contains", value: "," }
                    ],
                    action: {
                        type: "split",
                        apiEndpoint: "/api/lockbox/split-references",
                        odataService: "",
                        parameters: '{"delimiter": ",", "trimWhitespace": true}'
                    }
                },
                {
                    ruleId: "RUL-003",
                    ruleName: "Hyphen Range Rule",
                    description: "Expand document ranges (e.g., INV1001–INV1010) into individual references.",
                    fileType: "EXCEL / CSV",
                    ruleType: "RANGE_EXPANSION_RULE",
                    active: true,
                    conditions: [
                        { field: "ReferenceDocument", operator: "contains", value: "–" },
                        { field: "ReferenceDocument", operator: "contains", value: "-" }
                    ],
                    action: {
                        type: "expand",
                        apiEndpoint: "/api/lockbox/expand-range",
                        odataService: "",
                        parameters: '{"rangeDelimiter": ["-", "–"], "generateSequence": true}'
                    }
                },
                {
                    ruleId: "RUL-004",
                    ruleName: "Multiple Sheets Rule",
                    description: "Process Header and Item sheets together and validate cross-sheet totals before posting.",
                    fileType: "EXCEL",
                    ruleType: "MULTI_SHEET_RULE",
                    active: true,
                    conditions: [
                        { field: "FileType", operator: "equals", value: "EXCEL" },
                        { field: "SheetCount", operator: "equals", value: ">1" }
                    ],
                    action: {
                        type: "validate",
                        apiEndpoint: "/api/lockbox/validate-multi-sheet",
                        odataService: "",
                        parameters: '{"validateTotals": true, "requiredSheets": ["Header", "Items"]}'
                    }
                }
            ];
            
            // Set model properties
            if (!oModel.getProperty("/processingRules")) {
                oModel.setProperty("/processingRules", sampleRules);
            }
            
            // Set dropdown options
            oModel.setProperty("/fileTypes", ["EXCEL", "CSV", "EXCEL / CSV", "PDF", "XML", "JSON"]);
            oModel.setProperty("/ruleTypes", [
                "DOCUMENT_TYPE_RULE",
                "COMMA_SPLIT_RULE",
                "RANGE_EXPANSION_RULE",
                "MULTI_SHEET_RULE",
                "VALIDATION_RULE",
                "TRANSFORMATION_RULE",
                "API_CALL_RULE"
            ]);
        },

        onNavBack: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            if (oModel) {
                oModel.setProperty("/showHome", true);
                oModel.setProperty("/showProcessingRules", false);
            }
        },

        onRefresh: function () {
            MessageToast.show("Processing Rules refreshed");
        },

        onSearchRules: function (oEvent) {
            var sQuery = oEvent.getParameter("query");
            var oTable = this.byId("rulesTable");
            var oBinding = oTable.getBinding("items");
            
            if (oBinding) {
                var aFilters = [];
                if (sQuery) {
                    aFilters.push(new sap.ui.model.Filter({
                        filters: [
                            new sap.ui.model.Filter("ruleId", sap.ui.model.FilterOperator.Contains, sQuery),
                            new sap.ui.model.Filter("ruleName", sap.ui.model.FilterOperator.Contains, sQuery),
                            new sap.ui.model.Filter("description", sap.ui.model.FilterOperator.Contains, sQuery)
                        ],
                        and: false
                    }));
                }
                oBinding.filter(aFilters);
            }
        },

        onCreateRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Create new empty rule
            var newRule = {
                ruleId: "RUL-" + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
                ruleName: "New Rule",
                description: "",
                fileType: "EXCEL / CSV",
                ruleType: "VALIDATION_RULE",
                active: false,
                conditions: [],
                action: {
                    type: "transform",
                    apiEndpoint: "",
                    odataService: "",
                    parameters: ""
                }
            };
            
            oModel.setProperty("/selectedRule", newRule);
            this.byId("ruleDetailsDialog").open();
        },

        onCopyRule: function () {
            var oTable = this.byId("rulesTable");
            var oSelectedItem = oTable.getSelectedItem();
            
            if (!oSelectedItem) {
                MessageBox.warning("Please select a rule to copy");
                return;
            }
            
            var oContext = oSelectedItem.getBindingContext("app");
            var oRule = oContext.getObject();
            
            // Create a copy
            var copiedRule = JSON.parse(JSON.stringify(oRule));
            copiedRule.ruleId = "RUL-" + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
            copiedRule.ruleName = oRule.ruleName + " (Copy)";
            
            var oModel = this.getOwnerComponent().getModel("app");
            var aRules = oModel.getProperty("/processingRules");
            aRules.push(copiedRule);
            oModel.setProperty("/processingRules", aRules);
            
            MessageToast.show("Rule copied successfully");
        },

        onDeleteRule: function () {
            var oTable = this.byId("rulesTable");
            var oSelectedItem = oTable.getSelectedItem();
            
            if (!oSelectedItem) {
                MessageBox.warning("Please select a rule to delete");
                return;
            }
            
            var oContext = oSelectedItem.getBindingContext("app");
            var oRule = oContext.getObject();
            var that = this;
            
            MessageBox.confirm(
                "Are you sure you want to delete rule '" + oRule.ruleName + "'?",
                {
                    title: "Confirm Delete",
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            var oModel = that.getOwnerComponent().getModel("app");
                            var aRules = oModel.getProperty("/processingRules");
                            var index = aRules.findIndex(function(r) { return r.ruleId === oRule.ruleId; });
                            
                            if (index > -1) {
                                aRules.splice(index, 1);
                                oModel.setProperty("/processingRules", aRules);
                                MessageToast.show("Rule deleted successfully");
                            }
                        }
                    }
                }
            );
        },

        onDownload: function () {
            MessageBox.information("Download functionality will export rules to Excel/CSV format");
        },

        onRuleDetailsPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("app");
            
            if (!oContext) {
                return;
            }
            
            var oRule = oContext.getObject();
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Create a deep copy for editing
            oModel.setProperty("/selectedRule", JSON.parse(JSON.stringify(oRule)));
            
            this.byId("ruleDetailsDialog").open();
        },

        onRuleSelect: function (oEvent) {
            // Handle selection change if needed
        },

        onActiveToggle: function (oEvent) {
            var bState = oEvent.getParameter("state");
            MessageToast.show("Rule " + (bState ? "activated" : "deactivated"));
        },

        onCloseRuleDetails: function () {
            this.byId("ruleDetailsDialog").close();
        },

        onTabSelect: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            console.log("Tab selected:", sKey);
        },

        onAddCondition: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aConditions = oModel.getProperty("/selectedRule/conditions");
            
            aConditions.push({
                field: "",
                operator: "equals",
                value: ""
            });
            
            oModel.setProperty("/selectedRule/conditions", aConditions);
        },

        onDeleteCondition: function (oEvent) {
            var oButton = oEvent.getSource();
            var oItem = oButton.getParent();
            var oContext = oItem.getBindingContext("app");
            var sPath = oContext.getPath();
            
            var oModel = this.getOwnerComponent().getModel("app");
            var aConditions = oModel.getProperty("/selectedRule/conditions");
            var index = parseInt(sPath.split("/").pop());
            
            aConditions.splice(index, 1);
            oModel.setProperty("/selectedRule/conditions", aConditions);
        },

        onSaveRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedRule = oModel.getProperty("/selectedRule");
            var aRules = oModel.getProperty("/processingRules");
            
            // Find if rule exists
            var index = aRules.findIndex(function(r) { return r.ruleId === oSelectedRule.ruleId; });
            
            if (index > -1) {
                // Update existing rule
                aRules[index] = oSelectedRule;
            } else {
                // Add new rule
                aRules.push(oSelectedRule);
            }
            
            oModel.setProperty("/processingRules", aRules);
            
            MessageToast.show("Rule saved successfully");
            this.onCloseRuleDetails();
        }

    });
});
