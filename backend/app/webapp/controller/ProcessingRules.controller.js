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
         * Create new rule
         */
        onCreateProcessingRule: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/editingProcessingRule", {
                ruleId: "",
                fileType: "Excel/CSV",
                ruleType: "Document Type",
                ruleDescription: "",
                active: true,
                priority: 10,
                conditionLogic: "AND",
                conditions: [],
                actions: [],
                _isEdit: false
            });
            
            var oDialog = this.byId("processingRuleDialog");
            if (oDialog) {
                oDialog.open();
                // Switch to first tab
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
            oEditingRule._isEdit = true;
            
            // Ensure arrays exist
            if (!oEditingRule.conditions) {
                oEditingRule.conditions = [];
            }
            if (!oEditingRule.actions) {
                oEditingRule.actions = [];
            }
            if (!oEditingRule.conditionLogic) {
                oEditingRule.conditionLogic = "AND";
            }
            
            // Update action config summaries
            oEditingRule.actions = oEditingRule.actions.map(function (action) {
                action.configSummary = this._getActionConfigSummary(action);
                return action;
            }.bind(this));
            
            oModel.setProperty("/editingProcessingRule", oEditingRule);
            
            var oDialog = this.byId("processingRuleDialog");
            if (oDialog) {
                oDialog.open();
            }
        },

        /**
         * Get action configuration summary
         */
        _getActionConfigSummary: function (action) {
            var summary = "";
            
            switch (action.actionType) {
                case "api_call":
                case "odata_call":
                    summary = (action.method || "GET") + " " + (action.endpoint || "Not configured");
                    break;
                case "transformation":
                    summary = (action.transformType || "Not configured") + ": " + (action.sourceFields || "");
                    break;
                case "validation":
                    summary = (action.validationType || "Not configured") + " on " + (action.validationField || "");
                    break;
                case "post_gl":
                    summary = "G/L: " + (action.glAccount || "Not configured");
                    break;
                default:
                    summary = "Configure action...";
            }
            
            return summary;
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

        // ========================================================================
        // CONDITION HANDLERS
        // ========================================================================

        /**
         * Add condition
         */
        onAddCondition: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aConditions = oModel.getProperty("/editingProcessingRule/conditions") || [];
            
            aConditions.push({
                attribute: "Lockbox",
                operator: "equals",
                value: "",
                value2: ""
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

        // ========================================================================
        // ACTION HANDLERS
        // ========================================================================

        /**
         * Add action
         */
        onAddAction: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var aActions = oModel.getProperty("/editingProcessingRule/actions") || [];
            
            aActions.push({
                actionType: "api_call",
                target: "",
                configSummary: "Not configured",
                config: {}
            });
            
            oModel.setProperty("/editingProcessingRule/actions", aActions);
        },

        /**
         * Delete action
         */
        onDeleteAction: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext("app");
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.substring(sPath.lastIndexOf("/") + 1));
            
            var aActions = oModel.getProperty("/editingProcessingRule/actions");
            aActions.splice(iIndex, 1);
            oModel.setProperty("/editingProcessingRule/actions", aActions);
        },

        /**
         * Action type changed
         */
        onActionTypeChange: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oContext = oEvent.getSource().getBindingContext("app");
            var oAction = oContext.getObject();
            
            // Update config summary
            oAction.configSummary = "Configure " + oAction.actionType + "...";
            oModel.updateBindings(true);
        },

        /**
         * Configure action - open configuration dialog
         */
        onConfigureAction: function (oEvent) {
            var oModel = this.getOwnerComponent().getModel("app");
            var oItem = oEvent.getSource().getParent();
            var oContext = oItem.getBindingContext("app");
            var oAction = oContext.getObject();
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.substring(sPath.lastIndexOf("/") + 1));
            
            // Clone action for editing
            var oEditingAction = JSON.parse(JSON.stringify(oAction));
            oEditingAction._index = iIndex;
            
            // Flatten config into editing action
            if (oAction.config) {
                Object.assign(oEditingAction, oAction.config);
            }
            
            // Convert JSON objects to strings for text areas
            if (oEditingAction.headers && typeof oEditingAction.headers === "object") {
                oEditingAction.headers = JSON.stringify(oEditingAction.headers, null, 2);
            }
            if (oEditingAction.params && typeof oEditingAction.params === "object") {
                oEditingAction.params = JSON.stringify(oEditingAction.params, null, 2);
            }
            if (oEditingAction.bodyTemplate && typeof oEditingAction.bodyTemplate === "object") {
                oEditingAction.bodyTemplate = JSON.stringify(oEditingAction.bodyTemplate, null, 2);
            }
            if (oEditingAction.transformConfig && typeof oEditingAction.transformConfig === "object") {
                oEditingAction.transformConfig = JSON.stringify(oEditingAction.transformConfig, null, 2);
            }
            if (oEditingAction.additionalFields && typeof oEditingAction.additionalFields === "object") {
                oEditingAction.additionalFields = JSON.stringify(oEditingAction.additionalFields, null, 2);
            }
            
            oModel.setProperty("/editingAction", oEditingAction);
            
            var oDialog = this.byId("actionConfigDialog");
            if (oDialog) {
                oDialog.open();
            }
        },

        /**
         * Save action configuration
         */
        onSaveActionConfig: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            var oEditingAction = oModel.getProperty("/editingAction");
            var iIndex = oEditingAction._index;
            
            // Parse JSON strings back to objects
            var config = {};
            
            try {
                if (oEditingAction.headers) {
                    config.headers = JSON.parse(oEditingAction.headers);
                }
                if (oEditingAction.params) {
                    config.params = JSON.parse(oEditingAction.params);
                }
                if (oEditingAction.bodyTemplate) {
                    config.bodyTemplate = JSON.parse(oEditingAction.bodyTemplate);
                }
                if (oEditingAction.transformConfig) {
                    config.transformConfig = JSON.parse(oEditingAction.transformConfig);
                }
                if (oEditingAction.additionalFields) {
                    config.additionalFields = JSON.parse(oEditingAction.additionalFields);
                }
            } catch (e) {
                MessageBox.error("Invalid JSON in configuration fields: " + e.message);
                return;
            }
            
            // Copy all fields from editing action to config
            Object.keys(oEditingAction).forEach(function (key) {
                if (key !== "_index" && key !== "actionType" && key !== "target" && key !== "configSummary") {
                    config[key] = oEditingAction[key];
                }
            });
            
            // Update the action in the actions array
            var aActions = oModel.getProperty("/editingProcessingRule/actions");
            aActions[iIndex].config = config;
            aActions[iIndex].target = oEditingAction.target || oEditingAction.endpoint;
            aActions[iIndex].configSummary = this._getActionConfigSummary(aActions[iIndex]);
            
            oModel.setProperty("/editingProcessingRule/actions", aActions);
            
            this.onCloseActionConfigDialog();
            MessageToast.show("Action configuration saved");
        },

        /**
         * Close action config dialog
         */
        onCloseActionConfigDialog: function () {
            var oDialog = this.byId("actionConfigDialog");
            if (oDialog) {
                oDialog.close();
            }
        },

        // ========================================================================
        // SAVE RULE
        // ========================================================================

        /**
         * Save rule
         */
        onSaveProcessingRule: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel("app");
            var oEditingRule = oModel.getProperty("/editingProcessingRule");
            
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
            
            // Clean up temporary fields
            delete oEditingRule._isEdit;
            
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
