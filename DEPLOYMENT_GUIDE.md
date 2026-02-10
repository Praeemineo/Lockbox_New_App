# SAP BTP HTML5 Repository Deployment Guide

## Overview
This guide explains how to deploy the Lockbox SAPUI5 application to SAP BTP using the HTML5 Application Repository.

## Prerequisites

1. **Cloud Foundry CLI** installed
   ```bash
   cf --version
   ```

2. **MBT (Multi-Target Application Build Tool)** installed
   ```bash
   npm install -g mbt
   ```

3. **SAP BTP Account** with:
   - Cloud Foundry space
   - HTML5 Application Repository entitlement
   - XSUAA service entitlement
   - Destination service entitlement
   - Connectivity service entitlement

## Project Structure

```
/app
├── mta.yaml                                # MTA descriptor (UPDATED)
├── xs-security.json                        # XSUAA configuration
├── backend/
│   ├── app/
│   │   ├── package.json                   # UI5 build configuration (NEW)
│   │   ├── ui5.yaml                       # UI5 tooling config (NEW)
│   │   └── webapp/
│   │       ├── xs-app.json                # UI routing config (NEW)
│   │       ├── manifest.json              # UI5 app descriptor
│   │       ├── index.html
│   │       ├── controller/
│   │       │   ├── Main.controller.js
│   │       │   ├── PdfLockbox.controller.js
│   │       │   └── ProcessingRules.controller.js  ✅
│   │       └── view/
│   │           ├── Main.view.xml
│   │           ├── PdfLockbox.view.xml
│   │           └── ProcessingRules.view.xml  ✅
│   └── server.js                           # Backend Node.js service
├── approuter/
│   ├── package.json                        # Approuter dependencies (NEW)
│   └── xs-app.json                         # Approuter routing (NEW)
└── deployer/
    ├── package.json                        # Deployer config (NEW)
    └── resources/                          # Auto-generated during build
```

## Deployment Steps

### Step 1: Login to Cloud Foundry

```bash
cf login -a <api-endpoint>
cf target -o <org> -s <space>
```

Example:
```bash
cf login -a https://api.cf.ap21.hana.ondemand.com
cf target -o MyOrg -s dev
```

### Step 2: Build the MTA Archive

```bash
cd /app
mbt build
```

This will:
- Build the UI5 application
- Create the MTA archive in `mta_archives/` folder
- Package all modules and configurations

Expected output:
```
[2024-XX-XX XX:XX:XX]  INFO Cloud MTA Build Tool version X.X.X
[2024-XX-XX XX:XX:XX]  INFO generating the "Makefile_xxx.mta" file...
[2024-XX-XX XX:XX:XX]  INFO done
[2024-XX-XX XX:XX:XX]  INFO executing the "make -f Makefile_xxx.mta p=cf mtar= strict=true mode=" command...
...
[2024-XX-XX XX:XX:XX]  INFO the MTA archive generated at: /app/mta_archives/lockbox-app_1.0.0.mtar
```

### Step 3: Deploy to SAP BTP

```bash
cf deploy mta_archives/lockbox-app_1.0.0.mtar
```

This will create:
- **lockbox-ui** - UI5 application in HTML5 repo
- **lockbox-ui-deployer** - Deployment service
- **lockbox-srv** - Backend Node.js service
- **lockbox-approuter** - Application router
- **lockbox-html5-repo-host** - HTML5 repo host service
- **lockbox-html5-repo-runtime** - HTML5 repo runtime service
- **lockbox-xsuaa** - Authentication service
- **lockbox-destination** - Destination service
- **lockbox-connectivity** - Connectivity service

### Step 4: Verify Deployment

```bash
# Check applications
cf apps

# Check services
cf services

# Get approuter URL
cf app lockbox-approuter
```

### Step 5: Access the Application

Your application will be available at:
```
https://<org>-<space>-lockbox-approuter.cfapps.<region>.hana.ondemand.com
```

Example:
```
https://myorg-dev-lockbox-approuter.cfapps.ap21.hana.ondemand.com
```

## HTML5 Repository Configuration

### 1. HTML5 Repository - Host
- **Service:** `html5-apps-repo`
- **Plan:** `app-host`
- **Purpose:** Stores the UI5 application

### 2. HTML5 Repository - Runtime
- **Service:** `html5-apps-repo`
- **Plan:** `app-runtime`
- **Purpose:** Serves the UI5 application

### 3. Application Structure
```
Approuter (Entry Point)
    ↓
HTML5 Repository Runtime
    ↓
SAPUI5 Application (lockbox-ui)
    ↓
Backend API (lockbox-srv)
    ↓
PostgreSQL Database
```

## Modules Explained

### lockbox-ui (UI5 Module)
- **Type:** `html5`
- **Build:** Uses UI5 CLI to build the application
- **Output:** Creates `lockbox-ui.zip` in `dist/` folder
- **Includes:** 
  - All SAPUI5 views and controllers
  - Processing Rules app ✅
  - PDF Lockbox app ✅
  - Field Mapping Rules app ✅
  - xs-app.json for routing

### lockbox-ui-deployer (Deployer Module)
- **Type:** `com.sap.application.content`
- **Purpose:** Deploys UI to HTML5 Repository
- **Process:** 
  1. Takes `lockbox-ui.zip`
  2. Uploads to HTML5 Repository Host
  3. Makes it available via Runtime

### lockbox-srv (Backend Module)
- **Type:** `nodejs`
- **Purpose:** Backend API service
- **Endpoints:** `/api/*`
- **Database:** PostgreSQL

### lockbox-approuter (Approuter Module)
- **Type:** `approuter.nodejs`
- **Purpose:** 
  - Entry point for users
  - Authentication via XSUAA
  - Routes requests to UI and backend
  - Serves UI from HTML5 Repository

## Routing Configuration

### xs-app.json (in webapp/)
Routes for the UI5 application:
```json
{
  "routes": [
    {
      "source": "^/api/(.*)",
      "destination": "backend",
      "authenticationType": "xsuaa"
    },
    {
      "source": "^(.*)$",
      "service": "html5-apps-repo-rt",
      "authenticationType": "xsuaa"
    }
  ]
}
```

### xs-app.json (in approuter/)
Routes for the approuter:
```json
{
  "routes": [
    {
      "source": "^/api/(.*)",
      "destination": "backend",
      "csrfProtection": true,
      "authenticationType": "xsuaa"
    },
    {
      "source": "^(.*)$",
      "service": "html5-apps-repo-rt",
      "authenticationType": "xsuaa"
    }
  ]
}
```

## Authentication Setup

After deployment, assign roles to users:

```bash
# Get XSUAA service instance
cf service lockbox-xsuaa

# Assign role collections in BTP Cockpit
# Navigate to: Security → Users → Select User → Assign Role Collections
# Assign: LockboxAdmin or LockboxUser
```

## Troubleshooting

### Build Issues

**Problem:** UI5 build fails
```bash
# Install dependencies
cd /app/backend/app
npm install

# Test build locally
npx ui5 build --clean-dest --dest dist
```

### Deployment Issues

**Problem:** Deployment fails
```bash
# Check logs
cf logs lockbox-approuter --recent
cf logs lockbox-srv --recent

# Check service status
cf service lockbox-html5-repo-host
cf service lockbox-xsuaa
```

**Problem:** Application not accessible
```bash
# Verify approuter is running
cf app lockbox-approuter

# Check route
cf routes
```

### HTML5 Repository Issues

**Problem:** UI not loading
```bash
# Check HTML5 repo content
cf html5-list -d lockbox-html5-repo-runtime -u

# Re-deploy UI
cf deploy mta_archives/lockbox-app_1.0.0.mtar -m lockbox-ui-deployer
```

## Updating the Application

### Update UI Only
```bash
cd /app
mbt build -m lockbox-ui,lockbox-ui-deployer
cf deploy mta_archives/lockbox-app_1.0.0.mtar -m lockbox-ui-deployer
```

### Update Backend Only
```bash
cd /app
mbt build -m lockbox-srv
cf deploy mta_archives/lockbox-app_1.0.0.mtar -m lockbox-srv
```

### Full Deployment
```bash
cd /app
mbt build
cf deploy mta_archives/lockbox-app_1.0.0.mtar
```

## Undeployment

```bash
cf undeploy lockbox-app --delete-services
```

## Useful Commands

```bash
# List all HTML5 apps
cf html5-list

# Get HTML5 app info
cf html5-get lockbox-ui

# Restart services
cf restart lockbox-approuter
cf restart lockbox-srv

# View environment variables
cf env lockbox-srv

# Scale application
cf scale lockbox-srv -m 512M -k 1G
```

## Support

For issues or questions:
1. Check application logs: `cf logs <app-name> --recent`
2. Check service status: `cf services`
3. Review BTP cockpit for service bindings
4. Verify user role assignments

## Additional Resources

- [SAP HTML5 Application Repository Documentation](https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/11d77aa154f64c2e83cc9652a78bb985.html)
- [MTA Development Guide](https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/d04fc0e2ad894545aebfd7126384307c.html)
- [UI5 Deployment Guide](https://sapui5.hana.ondemand.com/#/topic/91f080966f4d1014b6dd926db0e91070)
