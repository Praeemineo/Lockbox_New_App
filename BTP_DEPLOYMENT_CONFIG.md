# BTP Deployment Configuration - PostgreSQL Database Setup

## ✅ Configuration Status

All deployment files have been **verified and updated** with the PostgreSQL database credentials.

---

## 📝 Database Credentials

```yaml
DB_HOST: "postgres-aee790df-b48b-48cc-96b3-db432a62390e.czuelothxj0h.ap-southeast-2.rds.amazonaws.com"
DB_PORT: "2477"
DB_NAME: "CAmqjnIfEdIX"
DB_USER: "1cf523d60c97"
DB_PASSWORD: "593373429221a65ff07f625d1b"
DB_SSL: "true"
```

**Database Type:** PostgreSQL (AWS RDS)  
**Region:** ap-southeast-2 (Asia Pacific - Sydney)  
**SSL Enabled:** Yes

---

## 🗂️ Updated Configuration Files

### 1. MTA Deployment Descriptor ✅
**File:** `/app/mta.yaml` (Lines 25-30)

```yaml
modules:
  - name: lockbox-srv
    type: nodejs
    path: backend
    properties:
      NODE_ENV: production
      SAP_URL: "https://44.196.95.84:44301"
      SAP_CLIENT: "100"
      SAP_USER: "S4H_FIN"
      SAP_PASSWORD: "Welcome1"
      DB_HOST: "postgres-aee790df-b48b-48cc-96b3-db432a62390e.czuelothxj0h.ap-southeast-2.rds.amazonaws.com"
      DB_PORT: "2477"
      DB_NAME: "CAmqjnIfEdIX"
      DB_USER: "1cf523d60c97"
      DB_PASSWORD: "593373429221a65ff07f625d1b"
      DB_SSL: "true"
    requires:
      - name: lockbox-destination
      - name: lockbox-xsuaa
      - name: lockbox-connectivity
      - name: postgresql-db
```

**Status:** ✅ Already configured correctly

---

### 2. Cloud Foundry Manifest ✅
**File:** `/app/manifest.yml`

**Updated:** Added database environment variables

```yaml
applications:
  - name: lockbox-srv
    path: backend
    memory: 512M
    disk_quota: 1024M
    instances: 1
    buildpack: nodejs_buildpack
    command: node server.js
    health-check-type: http
    health-check-http-endpoint: /api/health
    timeout: 180
    env:
      NODE_ENV: production
      SAP_URL: "https://44.196.95.84:44301"
      SAP_CLIENT: "100"
      SAP_USER: "S4H_FIN"
      SAP_PASSWORD: "Welcome1"
      SAP_API_TIMEOUT: "10000"
      DB_HOST: "postgres-aee790df-b48b-48cc-96b3-db432a62390e.czuelothxj0h.ap-southeast-2.rds.amazonaws.com"
      DB_PORT: "2477"
      DB_NAME: "CAmqjnIfEdIX"
      DB_USER: "1cf523d60c97"
      DB_PASSWORD: "593373429221a65ff07f625d1b"
      DB_SSL: "true"
    services:
      - lockbox-destination
      - lockbox-xsuaa
      - lockbox-connectivity
```

**Status:** ✅ Updated with DB credentials

---

### 3. Backend Environment File ✅
**File:** `/app/backend/.env`

```env
# Database Configuration (Production - will be overridden by BTP)
DB_HOST=postgres-aee790df-b48b-48cc-96b3-db432a62390e.czuelothxj0h.ap-southeast-2.rds.amazonaws.com
DB_PORT=2477
DB_NAME=CAmqjnIfEdIX
DB_USER=1cf523d60c97
DB_PASSWORD=593373429221a65ff07f625d1b
DB_SSL=true

# Server Configuration
PORT=8001
NODE_ENV=development

# SAP Configuration (for BTP deployment)
SAP_CLIENT=100
SAP_DESTINATION_NAME=S4HANA_SYSTEM_DESTINATION
SAP_URL=https://44.196.95.84:44301
SAP_USER=S4H_FIN
SAP_PASSWORD=Welcome1
SAP_API_TIMEOUT=10000
```

**Status:** ✅ Already configured correctly

---

### 4. MTA Extension Files

#### Development Extension ✅
**File:** `/app/mta-dev.mtaext`

```yaml
_schema-version: "3.2"
ID: lockbox-app.dev
extends: lockbox-app

modules:
  - name: lockbox-srv
    properties:
      NODE_ENV: development
    parameters:
      memory: 256M
      disk-quota: 512M
      instances: 1
```

**Status:** ✅ No changes needed (inherits from mta.yaml)

#### Production Extension ✅
**File:** `/app/mta-prod.mtaext`

```yaml
_schema-version: "3.2"
ID: lockbox-app.prod
extends: lockbox-app

modules:
  - name: lockbox-srv
    properties:
      NODE_ENV: production
    parameters:
      memory: 1024M
      disk-quota: 2048M
      instances: 2  # High Availability
```

**Status:** ✅ No changes needed (inherits from mta.yaml)

---

### 5. Security Configuration ✅
**File:** `/app/xs-security.json`

```json
{
  "xsappname": "lockbox-app",
  "tenant-mode": "dedicated",
  "description": "Security profile for Lockbox Application",
  "scopes": [
    {
      "name": "$XSAPPNAME.Admin",
      "description": "Administrator - Full access to all features"
    },
    {
      "name": "$XSAPPNAME.User",
      "description": "User - Upload and process lockbox files"
    },
    {
      "name": "$XSAPPNAME.Viewer",
      "description": "Viewer - Read-only access"
    }
  ],
  "role-collections": [
    {
      "name": "Lockbox_Admin",
      "description": "Lockbox Administrator",
      "role-template-references": ["$XSAPPNAME.Admin"]
    },
    {
      "name": "Lockbox_User",
      "description": "Lockbox User",
      "role-template-references": ["$XSAPPNAME.User"]
    },
    {
      "name": "Lockbox_Viewer",
      "description": "Lockbox Viewer",
      "role-template-references": ["$XSAPPNAME.Viewer"]
    }
  ]
}
```

**Status:** ✅ No changes needed

---

## 🚀 Deployment Instructions

### Option 1: MTA Deployment (Recommended)

```bash
# 1. Build the MTA archive
mbt build -t ./

# 2a. Deploy to DEV environment
cf deploy lockbox-app_1.0.0.mtar -e mta-dev.mtaext

# 2b. Deploy to PROD environment
cf deploy lockbox-app_1.0.0.mtar -e mta-prod.mtaext
```

### Option 2: CF Push (Simple Deployment)

```bash
# Navigate to project root
cd /app

# Push using manifest
cf push -f manifest.yml

# Bind to existing PostgreSQL service (if needed)
cf bind-service lockbox-srv Postgresql
cf restage lockbox-srv
```

---

## 🔧 BTP Service Requirements

### Required Services

1. **PostgreSQL Database** (Existing)
   - Service Name: `Postgresql`
   - Type: `org.cloudfoundry.existing-service`
   - Referenced in `mta.yaml` (lines 104-109)

2. **Destination Service**
   - Service: `destination`
   - Plan: `lite`
   - Configuration: S4HANA_SYSTEM_DESTINATION

3. **Connectivity Service**
   - Service: `connectivity`
   - Plan: `lite`
   - For Cloud Connector access

4. **XSUAA (Authorization)**
   - Service: `xsuaa`
   - Plan: `application`
   - Security profile: `xs-security.json`

### Verify Services

```bash
# List all services
cf services

# Check specific service
cf service Postgresql

# View service key (if needed)
cf service-key Postgresql <key-name>
```

---

## 🔐 Database Connection in Code

The backend application (`/app/backend/server.js`) connects to PostgreSQL using these environment variables:

```javascript
// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});
```

**Connection String Format:**
```
postgresql://1cf523d60c97:593373429221a65ff07f625d1b@postgres-aee790df-b48b-48cc-96b3-db432a62390e.czuelothxj0h.ap-southeast-2.rds.amazonaws.com:2477/CAmqjnIfEdIX?ssl=true
```

---

## 📊 Database Schema

The application uses the following PostgreSQL tables:

1. **`lb_processing_rules`** - Processing and validation rules
2. **`lockbox_processing_runs`** - Run history and status
3. **`lockbox_file_patterns`** - Excel file pattern configurations
4. Additional tables as needed

---

## ⚙️ Environment Variable Priority

When deployed to BTP, environment variables are resolved in this order:

1. **MTA properties** (`mta.yaml` - highest priority)
2. **Manifest env** (`manifest.yml`)
3. **Backend .env file** (`/app/backend/.env` - lowest priority)

For BTP deployment, the **MTA properties** will override local `.env` values.

---

## 🔍 Troubleshooting

### Database Connection Issues

**Check connection:**
```bash
# SSH into the app
cf ssh lockbox-srv

# Test connection (inside container)
node -e "const {Pool}=require('pg'); const p=new Pool({host:process.env.DB_HOST,port:process.env.DB_PORT,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}}); p.query('SELECT NOW()', (e,r)=>console.log(e||r.rows))"
```

**Check environment variables:**
```bash
cf env lockbox-srv | grep DB_
```

**Check logs:**
```bash
cf logs lockbox-srv --recent
cf logs lockbox-srv  # Stream logs
```

### SSL Certificate Issues

If you encounter SSL errors, ensure:
```javascript
ssl: { rejectUnauthorized: false }
```

This is already configured in the backend code.

---

## 📝 Deployment Checklist

- [x] Database credentials configured in `mta.yaml`
- [x] Database credentials configured in `manifest.yml`
- [x] Database credentials configured in `backend/.env`
- [x] SAP destination configured
- [x] XSUAA security descriptor ready
- [x] Health check endpoint configured (`/api/health`)
- [x] SSL enabled for database connection
- [ ] MTA build completed successfully
- [ ] Deployed to BTP Cloud Foundry
- [ ] Services bound correctly
- [ ] Database connection verified
- [ ] Application accessible via route

---

## 🔗 Related Files

- `/app/mta.yaml` - Main MTA descriptor
- `/app/manifest.yml` - Cloud Foundry manifest
- `/app/mta-dev.mtaext` - Development extension
- `/app/mta-prod.mtaext` - Production extension
- `/app/xs-security.json` - Security configuration
- `/app/backend/.env` - Local environment variables
- `/app/backend/server.js` - Backend entry point

---

## 📞 Next Steps

1. **Build MTA Archive:**
   ```bash
   cd /app
   mbt build
   ```

2. **Deploy to BTP:**
   ```bash
   cf deploy lockbox-app_1.0.0.mtar -e mta-prod.mtaext
   ```

3. **Verify Deployment:**
   ```bash
   cf apps
   cf app lockbox-srv
   ```

4. **Test Database Connection:**
   - Access health endpoint: `https://<app-url>/api/health`
   - Check logs for database connection success

---

**Configuration Date:** March 31, 2025  
**Database Region:** ap-southeast-2 (Sydney, Australia)  
**Deployment Target:** SAP BTP Cloud Foundry
