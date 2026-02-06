sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator"
], function (Controller, JSONModel, MessageBox, MessageToast, BusyIndicator) {
    "use strict";

    // API Base URL
    const API_BASE = window.REACT_APP_BACKEND_URL || "";

    return Controller.extend("lockbox.controller.PdfLockbox", {

        onInit: function () {
            console.log("PDF Lockbox Controller initialized");
            
            // Initialize model
            var oModel = new JSONModel({
                pdfRuns: [],
                pdfRunsCount: 0
            });
            this.getView().setModel(oModel, "app");
            
            // Load PDF runs
            this.loadPdfRuns();
        },

        onNavBack: function () {
            var oModel = this.getOwnerComponent().getModel("app");
            oModel.setProperty("/showHome", true);
            oModel.setProperty("/showPdfLockbox", false);
        },

        loadPdfRuns: function () {
            var that = this;
            
            BusyIndicator.show(0);
            
            fetch(API_BASE + "/api/lockbox/runs")
                .then(response => response.json())
                .then(data => {
                    // Filter only PDF runs
                    var pdfRuns = data.filter(run => run.fileType === 'PDF');
                    
                    var oModel = that.getView().getModel("app");
                    oModel.setProperty("/pdfRuns", pdfRuns);
                    oModel.setProperty("/pdfRunsCount", pdfRuns.length);
                    
                    BusyIndicator.hide();
                })
                .catch(error => {
                    console.error("Error loading PDF runs:", error);
                    BusyIndicator.hide();
                    MessageToast.show("Error loading data");
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
            var oRun = oContext.getObject();
            
            MessageBox.information("Run Details:\n\n" +
                "Run ID: " + oRun.runId + "\n" +
                "File: " + oRun.filename + "\n" +
                "Status: " + oRun.overallStatus + "\n" +
                "Rows: " + (oRun.stages.extraction.rowCount || 0), {
                title: "PDF Run Details"
            });
        },

        onSimulate: function (oEvent) {
            var oItem = oEvent.getSource().getParent().getParent();
            var oContext = oItem.getBindingContext("app");
            var oRun = oContext.getObject();
            
            MessageBox.information("Simulation feature will be implemented here.\n\nRun ID: " + oRun.runId);
        },

        onProductionRun: function (oEvent) {
            var oItem = oEvent.getSource().getParent().getParent();
            var oContext = oItem.getBindingContext("app");
            var oRun = oContext.getObject();
            
            MessageBox.information("Production Run feature will be implemented here.\n\nRun ID: " + oRun.runId);
        }

    });
});
