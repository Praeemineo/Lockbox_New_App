sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator"
], function (Controller, JSONModel, MessageBox, MessageToast, BusyIndicator) {
    "use strict";

    // API Base URL - Use window.location or environment
    const API_BASE = window.REACT_APP_BACKEND_URL || window.location.origin;

    return Controller.extend("lockbox.controller.PdfLockbox", {

        onInit: function () {
            console.log("PDF Lockbox Controller initialized");
            
            // Get parent component model instead of creating new one
            var oModel = this.getOwnerComponent().getModel("app");
            if (!oModel) {
                console.error("Parent app model not found");
                return;
            }
            
            // Initialize PDF-specific properties if they don't exist
            if (!oModel.getProperty("/pdfRuns")) {
                oModel.setProperty("/pdfRuns", []);
                oModel.setProperty("/pdfRunsCount", 0);
            }
            
            // Load PDF runs
            this.loadPdfRuns();
        },

        onNavBack: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            if (oModel) {
                oModel.setProperty("/showHome", true);
                oModel.setProperty("/showPdfLockbox", false);
            }
        },

        loadPdfRuns: function () {
            var that = this;
            
            BusyIndicator.show(0);
            
            fetch(API_BASE + "/api/lockbox/runs")
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(function(data) {
                    // Ensure data is an array
                    if (!Array.isArray(data)) {
                        console.error("API did not return an array:", data);
                        data = [];
                    }
                    
                    // Filter only PDF runs
                    var pdfRuns = data.filter(function(run) {
                        return run.fileType === 'PDF';
                    });
                    
                    console.log("PDF runs loaded:", pdfRuns.length);
                    
                    var oModel = that.getOwnerComponent().getModel("app");
                    if (oModel) {
                        oModel.setProperty("/pdfRuns", pdfRuns);
                        oModel.setProperty("/pdfRunsCount", pdfRuns.length);
                    }
                    
                    BusyIndicator.hide();
                    
                    if (pdfRuns.length === 0) {
                        MessageToast.show("No PDF runs found. Upload a PDF to get started.");
                    }
                })
                .catch(function(error) {
                    console.error("Error loading PDF runs:", error);
                    BusyIndicator.hide();
                    
                    // Set empty array on error
                    var oModel = that.getOwnerComponent().getModel("app");
                    if (oModel) {
                        oModel.setProperty("/pdfRuns", []);
                        oModel.setProperty("/pdfRunsCount", 0);
                    }
                    
                    MessageToast.show("Could not load PDF runs. Please check your connection.");
                });
        },

        onRefreshData: function () {
            this.loadPdfRuns();
            MessageToast.show("Data refreshed");
        },

        onUploadPdf: function () {
            var oDialog = this.byId("pdfUploadDialog");
            if (oDialog) {
                oDialog.open();
            }
        },

        onClosePdfUploadDialog: function () {
            var oDialog = this.byId("pdfUploadDialog");
            if (oDialog) {
                oDialog.close();
            }
            // Clear file input
            var oFileInput = document.getElementById("pdfFileInput");
            if (oFileInput) {
                oFileInput.value = "";
            }
        },

        onUploadPdfFile: function () {
            var that = this;
            var oFileInput = document.getElementById("pdfFileInput");
            
            if (!oFileInput || !oFileInput.files || oFileInput.files.length === 0) {
                MessageBox.warning("Please select a PDF file first");
                return;
            }
            
            var oFile = oFileInput.files[0];
            
            // Validate file type
            if (!oFile.name.toLowerCase().endsWith('.pdf')) {
                MessageBox.warning("Only PDF files are supported");
                return;
            }
            
            // Show busy indicator
            BusyIndicator.show(0);
            
            // Create form data
            var oFormData = new FormData();
            oFormData.append('file', oFile);
            
            // Make API call
            var oXhr = new XMLHttpRequest();
            oXhr.open("POST", API_BASE + "/api/lockbox/process-pdf", true);
            
            oXhr.onload = function () {
                BusyIndicator.hide();
                
                try {
                    var oResponse = JSON.parse(oXhr.responseText);
                    
                    if (oResponse.success) {
                        // Close dialog
                        that.onClosePdfUploadDialog();
                        
                        // Reload data
                        that.loadPdfRuns();
                        
                        // Show success message
                        var sMessage = "PDF uploaded successfully!\n\n" +
                                      "✅ OCR Extraction: " + (oResponse.extractedRows || 0) + " rows\n" +
                                      "🤖 AI Provider: " + (oResponse.run.stages.ocr.provider || 'Claude AI');
                        
                        MessageBox.success(sMessage, {
                            title: "PDF Processing Complete"
                        });
                    } else {
                        MessageBox.error("Upload failed: " + (oResponse.message || oResponse.error || "Unknown error"));
                    }
                } catch (e) {
                    console.error("Error parsing response:", e);
                    MessageBox.error("Error processing response");
                }
            };
            
            oXhr.onerror = function () {
                BusyIndicator.hide();
                MessageBox.error("Network error during upload");
            };
            
            oXhr.send(oFormData);
        },

        onViewDetails: function (oEvent) {
            var oItem = oEvent.getSource().getParent().getParent();
            var oContext = oItem.getBindingContext("app");
            
            if (!oContext) {
                MessageBox.error("Could not get run details");
                return;
            }
            
            var oRun = oContext.getObject();
            
            MessageBox.information("Run Details:\n\n" +
                "Run ID: " + oRun.runId + "\n" +
                "File: " + oRun.filename + "\n" +
                "Status: " + oRun.overallStatus + "\n" +
                "Rows: " + (oRun.stages && oRun.stages.extraction ? oRun.stages.extraction.rowCount || 0 : 0), {
                title: "PDF Run Details"
            });
        },

        onSimulate: function (oEvent) {
            var oItem = oEvent.getSource().getParent().getParent();
            var oContext = oItem.getBindingContext("app");
            
            if (!oContext) {
                return;
            }
            
            var oRun = oContext.getObject();
            
            MessageBox.information("Simulation feature will be implemented here.\n\nRun ID: " + oRun.runId);
        },

        onProductionRun: function (oEvent) {
            var oItem = oEvent.getSource().getParent().getParent();
            var oContext = oItem.getBindingContext("app");
            
            if (!oContext) {
                return;
            }
            
            var oRun = oContext.getObject();
            
            MessageBox.information("Production Run feature will be implemented here.\n\nRun ID: " + oRun.runId);
        }

    });
});
