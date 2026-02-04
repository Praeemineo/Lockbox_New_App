# Lockbox Application - Project Structure

This document describes the reorganized file structure for the SAP BTP Lockbox application.

## Directory Structure

```
/app/
├── backend/                        # All Backend (Node.js) code
│   ├── server.js                   # Main Express server entry point
│   │
│   ├── sap/                        # SAP Integration Modules (organized by HTTP method)
│   │   ├── index.js                # Module exports
│   │   ├── sapService.js           # Core SAP connection and configuration
│   │   ├── getSap.js               # SAP GET requests
│   │   ├── postSap.js              # SAP POST requests
│   │   ├── updateSap.js            # SAP UPDATE requests (placeholder)
│   │   └── deleteSap.js            # SAP DELETE requests (placeholder)
│   │
│   ├── db/                         # Database Modules
│   │   ├── index.js                # Module exports
│   │   └── postgresService.js      # PostgreSQL connection and queries
│   │
│   ├── app/                        # SAPUI5 Frontend (served as static files)
│   │   ├── index.html              # Entry HTML
│   │   └── webapp/                 # SAPUI5 application
│   │       ├── Component.js        # UI5 Component
│   │       ├── manifest.json       # UI5 manifest
│   │       ├── init.js             # Initialization
│   │       ├── controller/         # UI5 Controllers
│   │       │   ├── App.controller.js
│   │       │   └── Main.controller.js
│   │       ├── view/               # UI5 Views
│   │       │   ├── App.view.xml
│   │       │   └── Main.view.xml
│   │       └── i18n/               # Internationalization
│   │           └── i18n.properties
│   │
│   ├── data/                       # Local JSON data storage (fallback)
│   │   ├── file_patterns.json
│   │   ├── odata_services.json
│   │   └── processing_runs.json
│   │
│   ├── package.json                # Node.js dependencies
│   └── .env                        # Environment configuration
│
└── mta.yaml                        # SAP BTP Multi-Target Application descriptor
```

## Module Organization

### SAP Modules (`/backend/sap/`)

The SAP integration is organized by HTTP method for clarity and maintainability:

| File | Purpose | HTTP Methods |
|------|---------|--------------|
| `sapService.js` | Core SAP connection via BTP Destination | Configuration |
| `getSap.js` | Read operations from SAP | GET |
| `postSap.js` | Create operations to SAP | POST |
| `updateSap.js` | Update operations (placeholder) | PUT/PATCH |
| `deleteSap.js` | Delete operations (placeholder) | DELETE |

#### Usage Example:
```javascript
// Import all SAP functions
const sap = require('./sap');

// Or import specific functions
const { postToSapApi, getLockboxClearing } = require('./sap');

// Use in routes
const response = await sap.postToSapApi(payload);
const clearing = await sap.getLockboxClearing(queryParams);
```

### Database Module (`/backend/db/`)

PostgreSQL database operations are centralized in the db module:

| File | Purpose |
|------|---------|
| `postgresService.js` | Connection pool, table initialization, queries |

#### Usage Example:
```javascript
// Import database functions
const db = require('./db');

// Initialize database
db.initDatabase();
await db.initTables();

// Execute queries
const pool = db.getPool();
const result = await pool.query('SELECT * FROM lockbox_header');
```

## Frontend Structure

### SAPUI5 Application (`/backend/app/webapp/`)

The SAPUI5 frontend follows standard SAP Fiori application structure:

- **Views**: XML-based UI definitions (`view/*.view.xml`)
- **Controllers**: JavaScript logic (`controller/*.controller.js`)
- **Component**: UI5 component definition (`Component.js`)
- **Manifest**: Application configuration (`manifest.json`)
- **i18n**: Internationalization texts (`i18n/i18n.properties`)

## API Endpoints

### Lockbox Processing
- `POST /api/lockbox/process` - Upload and process file
- `GET /api/lockbox/runs` - Get all processing runs
- `GET /api/lockbox/runs/:runId` - Get specific run
- `POST /api/lockbox/runs/:runId/simulate` - Run simulation
- `POST /api/lockbox/runs/:runId/production` - Execute production run

### Field Mapping Management
- `GET /api/field-mapping/patterns` - Get patterns
- `POST /api/field-mapping/patterns` - Create pattern
- `PUT /api/field-mapping/patterns/:id` - Update pattern
- `DELETE /api/field-mapping/patterns/:id` - Delete pattern

### OData Services
- `GET /api/field-mapping/odata-services` - Get services
- `POST /api/field-mapping/odata-services` - Create service
- `PUT /api/field-mapping/odata-services/:id` - Update service
- `DELETE /api/field-mapping/odata-services/:id` - Delete service

## Configuration

### Environment Variables (`.env`)

```env
# Server
PORT=8001

# PostgreSQL Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lockbox
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=false

# SAP Client
SAP_CLIENT=100
```

### SAP BTP Configuration

The application uses SAP BTP Destination Service for SAP S/4HANA integration:
- Destination Name: `S4HANA_SYSTEM_DESTINATION`
- Authentication: Managed via BTP Destination Service
- API: `API_LOCKBOXPOST_IN`

## Deployment

### Local Development
```bash
cd /app/backend
npm install
npm start
```

### SAP BTP Deployment
```bash
# Build and deploy using MTA
mbt build
cf deploy mta_archives/lockbox_*.mtar
```
