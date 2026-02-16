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
            
            // Load processing rules from backend
            this.loadProcessingRules();
        },

        /**
         * Load processing rules from backend
         */
        loadProcessingRules: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            
            fetch("/api/processing-rules")
                .then(function (response) {
                    return response.json();
                })
                .then(function (data) {
                    oModel.setProperty("/processingRules", data);
                    oModel.setProperty("/selectedProcessingRule", null);
                    console.log("Loaded", data.length, "processing rules");
                })
                .catch(function (error) {
                    console.error("Error loading processing rules:", error);
                    MessageBox.error("Failed to load processing rules");
                });
        },

        /**
         * Create new rule
         */
        onCreateRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var newRule = {
                rule_id: "RULE-" + Date.now(),
                rule_name: "",
                description: "",
                file_type: "Excel",
                rule_type: "Validation",
                is_active: true,
                conditions: [],
                api_mappings: []
            };
            oModel.setProperty("/selectedRule", newRule);
            this.byId("ruleDetailsDialog").open();
        },

        /**
         * Show rule details dialog
         */
        onShowRuleDetails: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            
            // Ensure conditions and mappings are arrays
            if (!oRule.conditions || typeof oRule.conditions === 'string') {
                try {
                    oRule.conditions = JSON.parse(oRule.conditions || '[]');
                } catch (e) {
                    oRule.conditions = [];
                }
            }
            if (!oRule.api_mappings || typeof oRule.api_mappings === 'string') {
                try {
                    oRule.api_mappings = JSON.parse(oRule.api_mappings || '[]');
                } catch (e) {
                    oRule.api_mappings = [];
                }
            }
            
            oModel.setProperty("/selectedRule", oRule);
            this.byId("ruleDetailsDialog").open();
        },

        /**
         * Close rule details dialog
         */
        onCloseRuleDetails: function () {
            this.byId("ruleDetailsDialog").close();
        },

        /**
         * Save rule
         */
        onSaveRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oRule = oModel.getProperty("/selectedRule");
            
            // Validate required fields
            if (!oRule.rule_name) {
                MessageBox.error("Please enter a Rule Name");
                return;
            }
            
            // Determine if this is a new rule or an update
            var method = oRule.id ? "PUT" : "POST";
            var url = oRule.id ? "/api/processing-rules/" + oRule.id : "/api/processing-rules";
            
            fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(oRule)
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                MessageToast.show("Rule saved successfully");
                that.byId("ruleDetailsDialog").close();
                that.loadProcessingRules();
            })
            .catch(function (error) {
                console.error("Error saving rule:", error);
                MessageBox.error("Failed to save rule");
            });
        },

        /**
         * Refresh rules
         */
        onRefreshRules: function () {
            this.loadProcessingRules();
            MessageToast.show("Rules refreshed");
        },

        /**
         * Add condition
         */
        onAddCondition: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aConditions = oModel.getProperty("/selectedRule/conditions") || [];
            aConditions.push({
                field: "",
                operator: "equals",
                value: "",
                logic: "AND"
            });
            oModel.setProperty("/selectedRule/conditions", aConditions);
        },

        /**
         * Delete condition
         */
        onDeleteCondition: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext("app");
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.split("/").pop());
            
            var aConditions = oModel.getProperty("/selectedRule/conditions");
            aConditions.splice(iIndex, 1);
            oModel.setProperty("/selectedRule/conditions", aConditions);
        },

        /**
         * Add mapping
         */
        onAddMapping: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aMappings = oModel.getProperty("/selectedRule/api_mappings") || [];
            aMappings.push({
                source_field: "",
                target_field: "",
                transformation: "none",
                required: false
            });
            oModel.setProperty("/selectedRule/api_mappings", aMappings);
        },

        /**
         * Delete mapping
         */
        onDeleteMapping: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext("app");
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.split("/").pop());
            
            var aMappings = oModel.getProperty("/selectedRule/api_mappings");
            aMappings.splice(iIndex, 1);
            oModel.setProperty("/selectedRule/api_mappings", aMappings);
        },
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/editingProcessingRule", {
                ruleId: "",
                fileType: "Excel/CSV",
                ruleType: "Document Type",
                ruleDescription: "",
                active: true,
                description: "",
                journalEntryType: "ZV (Payment Clearing)",
                ruleFor: "Incoming Payment",
                ruleForIndex: 0,
                actionType: "G/L Posting",
                shareRule: false,
                ignoreProcessor: false,
                conditions: [],
                glAccounts: []
            });
            
            var oDialog = this.byId("processingRuleDialog");
            if (oDialog) {
                oDialog.open();
                var oTabBar = this.byId("ruleTabBar");
                if (oTabBar) {
                    oTabBar.setSelectedKey("processingRule");
                }
            }
        },

        /**
         * Edit selected rule
         */
        onEditProcessingRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oSelectedRule = oModel.getProperty("/selectedProcessingRule");
            
            if (!oSelectedRule) {
                MessageBox.warning("Please select a rule to edit");
                return;
            }
            
            this._openEditDialog(oSelectedRule);
        },

        /**
         * Row press handler
         */
        onRowPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            this._openEditDialog(oRule);
        },

        /**
         * Open edit dialog
         */
        _openEditDialog: function (oRule) {
            var oModel = this.getOwnerComponent().getModel("app");
            
            // Clone the rule for editing
            var oEditingRule = JSON.parse(JSON.stringify(oRule));
            
            // Set ruleForIndex based on ruleFor value
            oEditingRule.ruleForIndex = oEditingRule.ruleFor === "Incoming Payment" ? 0 : 1;
            
            // Ensure arrays exist
            if (!oEditingRule.conditions) {
                oEditingRule.conditions = [];
            }
            if (!oEditingRule.glAccounts) {
                oEditingRule.glAccounts = [];
            }
            
            oModel.setProperty("/editingProcessingRule", oEditingRule);
            
            var oDialog = this.byId("processingRuleDialog");
            if (oDialog) {
                oDialog.open();
            }
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
                            that._deleteRule(oSelectedRule.ruleId);
                        }
                    }
                }
            );
        },

        /**
         * Delete rule via API
         */
        _deleteRule: function (ruleId) {
            var that = this;
            
            fetch("/api/processing-rules/" + ruleId, {
                method: "DELETE"
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (data.success) {
                    MessageToast.show("Rule deleted successfully");
                    that.loadProcessingRules();
                } else {
                    MessageBox.error("Failed to delete rule");
                }
            })
            .catch(function (error) {
                console.error("Error deleting rule:", error);
                MessageBox.error("Failed to delete rule");
            });
        },

        /**
         * Refresh rules
         */
        onRefreshProcessingRules: function () {
            this.loadProcessingRules();
            MessageToast.show("Rules refreshed");
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
            var that = this;
            var bState = oEvent.getParameter("state");
            var oContext = oEvent.getSource().getBindingContext("app");
            var oRule = oContext.getObject();
            
            // Update rule active state
            oRule.active = bState;
            
            // Save to backend
            fetch("/api/processing-rules/" + oRule.ruleId, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oRule)
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (data.success) {
                    MessageToast.show(bState ? "Rule activated" : "Rule deactivated");
                } else {
                    MessageBox.error("Failed to update rule");
                }
            })
            .catch(function (error) {
                console.error("Error updating rule:", error);
                MessageBox.error("Failed to update rule");
            });
        },

        /**
         * Add condition
         */
        onAddCondition: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aConditions = oModel.getProperty("/editingProcessingRule/conditions") || [];
            
            aConditions.push({
                attribute: "",
                option: "equals",
                from: "",
                to: ""
            });
            
            oModel.setProperty("/editingProcessingRule/conditions", aConditions);
        },

        /**
         * Delete condition
         */
        onDeleteCondition: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext("app");
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.substring(sPath.lastIndexOf("/") + 1));
            
            var aConditions = oModel.getProperty("/editingProcessingRule/conditions");
            aConditions.splice(iIndex, 1);
            oModel.setProperty("/editingProcessingRule/conditions", aConditions);
        },

        /**
         * Add G/L Account
         */
        onAddGLAccount: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aGLAccounts = oModel.getProperty("/editingProcessingRule/glAccounts") || [];
            
            aGLAccounts.push({
                account: "",
                profitCenter: "",
                costCenter: "",
                taxCode: "",
                segment: "",
                functionalArea: ""
            });
            
            oModel.setProperty("/editingProcessingRule/glAccounts", aGLAccounts);
        },

        /**
         * Delete G/L Account
         */
        onDeleteGLAccount: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext("app");
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.substring(sPath.lastIndexOf("/") + 1));
            
            var aGLAccounts = oModel.getProperty("/editingProcessingRule/glAccounts");
            aGLAccounts.splice(iIndex, 1);
            oModel.setProperty("/editingProcessingRule/glAccounts", aGLAccounts);
        },

        /**
         * Save rule
         */
        onSaveProcessingRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oEditingRule = oModel.getProperty("/editingProcessingRule");
            
            // Update ruleFor based on ruleForIndex
            if (oEditingRule.ruleForIndex !== undefined) {
                oEditingRule.ruleFor = oEditingRule.ruleForIndex === 0 ? "Incoming Payment" : "Outgoing Payment";
            }
            
            // Validate required fields
            if (!oEditingRule.ruleId || !oEditingRule.ruleDescription) {
                MessageBox.error("Please fill in Rule ID and Rule Description");
                return;
            }
            
            // Check if rule exists
            var aRules = oModel.getProperty("/processingRules") || [];
            var bExists = aRules.some(function (r) {
                return r.ruleId === oEditingRule.ruleId;
            });
            
            var sMethod = bExists ? "PUT" : "POST";
            var sUrl = bExists ? "/api/processing-rules/" + oEditingRule.ruleId : "/api/processing-rules";
            
            fetch(sUrl, {
                method: sMethod,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oEditingRule)
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (data.success) {
                    MessageToast.show(bExists ? "Rule updated successfully" : "Rule created successfully");
                    that.loadProcessingRules();
                    that.onCloseProcessingRuleDialog();
                } else {
                    MessageBox.error(data.error || "Failed to save rule");
                }
            })
            .catch(function (error) {
                console.error("Error saving rule:", error);
                MessageBox.error("Failed to save rule");
            });
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
