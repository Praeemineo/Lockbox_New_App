sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
    "use strict";

    return UIComponent.extend("lockbox.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // create the views based on the url/hash
            this.getRouter().initialize();

            // set app model
            var oAppModel = new JSONModel({
                selectedHeader: null,
                headers: [],
                hierarchy: [],
                sapResponse: ""
            });
            this.setModel(oAppModel, "app");
        }
    });
});
