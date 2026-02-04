sap.ui.define([
    "sap/m/Shell",
    "sap/ui/core/ComponentContainer"
], function (Shell, ComponentContainer) {
    "use strict";
    
    new Shell({
        app: new ComponentContainer({
            height: "100%",
            name: "lockbox",
            async: true,
            settings: {
                id: "lockbox"
            }
        })
    }).placeAt("content");
});
