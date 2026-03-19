/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║                         ⚠️  WARNING ⚠️                                ║
 * ║                                                                       ║
 * ║   DO NOT ADD BUSINESS LOGIC TO THIS FILE!                           ║
 * ║                                                                       ║
 * ║   This file is ONLY for:                                            ║
 * ║   - Bootstrapping the application                                   ║
 * ║   - Loading modules                                                 ║
 * ║   - Registering routes                                              ║
 * ║   - Starting the server                                             ║
 * ║                                                                       ║
 * ║   ALL BUSINESS LOGIC GOES IN: /srv/handlers/                       ║
 * ║   See CODE_STRUCTURE.md for detailed guide                          ║
 * ║                                                                       ║
 * ║   If you add code here, it WILL be removed in next refactoring!    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// This is a PLACEHOLDER - Full restructuring is in progress
// The existing server.js will be gradually migrated to modular structure

// For now, load the old monolithic server.js
// This will be replaced with modular imports soon

const oldServer = require('./server.js.OLD');

// TODO: Replace with modular structure:
// const express = require('express');
// const app = express();
// 
// // Load modules
// const dataModels = require('./srv/models/data-models');
// const routesModule = require('./srv/services/routes');
// 
// // Initialize
// dataModels.initializeDataModels();
// app.use('/api', routesModule);
// 
// // Start
// app.listen(8001);

module.exports = oldServer;
