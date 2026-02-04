# Lockbox Application - SAP BTP

## 📚 Overview

SAP Lockbox application for processing and posting lockbox payment files to SAP S/4HANA. Built with Node.js, PostgreSQL, and designed for SAP Business Technology Platform (BTP) deployment.

## 🏗️ Architecture

### Backend (Node.js + Express)
```
backend/
├── server.js              # Main Express application
├── sap/                   # SAP Module
│   ├── sapService.js      # Core SAP connection
│   ├── getSap.js          # SAP GET operations
│   ├── postSap.js         # SAP POST operations
│   ├── updateSap.js       # SAP UPDATE operations
│   └── deleteSap.js       # SAP DELETE operations
└── db/                    # Database Module
    └── postgresService.js # PostgreSQL connection
```

### Frontend (React + SAPUI5)
- React 19 for modern component architecture
- SAPUI5 for SAP Fiori user experience
- Tailwind CSS for styling
- Radix UI components

### Database
- PostgreSQL for data persistence
- 10 tables for lockbox data and audit trail
- Support for BTP PostgreSQL service

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && yarn install

# Start PostgreSQL
sudo -u postgres pg_ctlcluster 15 main start

# Start services
sudo supervisorctl restart all

# Access application
# Frontend: http://localhost:3000
# Backend: http://localhost:8001
```

### BTP Deployment

```bash
# 1. Login to Cloud Foundry
cf login

# 2. Build MTA archive
npm run build
# OR
./build.sh

# 3. Deploy to BTP
cf deploy mta_archives/lockbox-app_1.0.0.mtar
# OR
./deploy.sh
```

## 📦 BTP Configuration Files

| File | Purpose |
|------|--------|
| `mta.yaml` | Main MTA descriptor for BTP deployment |
| `xs-security.json` | XSUAA security configuration |
| `manifest.yml` | Cloud Foundry manifest (alternative) |
| `mta-dev.mtaext` | Development environment overrides |
| `mta-prod.mtaext` | Production environment overrides |
| `.cfignore` | Files to exclude from deployment |

## 🔑 Required BTP Services

1. **PostgreSQL Database** (`postgresql-db`)
   - Plan: `standard` or `trial`
   - Stores lockbox data and audit logs

2. **Destination Service** (`destination`)
   - Plan: `lite`
   - Manages SAP S/4HANA connection

3. **Connectivity Service** (`connectivity`)
   - Plan: `lite`
   - Enables Cloud Connector for on-premise SAP

4. **XSUAA Service** (`xsuaa`)
   - Plan: `application`
   - Authentication and authorization

## 👥 Role Collections

- **Lockbox_Admin**: Full administrative access
- **Lockbox_User**: Upload and process files
- **Lockbox_Viewer**: Read-only access

## 📡 API Endpoints

### Health & Status
```
GET  /api/health                    # Health check
```

### Lockbox Operations
```
GET  /api/lockbox/headers           # List all batches
GET  /api/lockbox/hierarchy/:id     # Get 3-level hierarchy
GET  /api/lockbox/template          # Download Excel template
POST /api/lockbox/upload            # Upload Excel file
POST /api/lockbox/simulate/:id      # Preview SAP payload
POST /api/lockbox/post-to-sap/:id   # Post to SAP (production)
DELETE /api/lockbox/headers/:id     # Delete batch
```

## 📊 Database Schema

### Core Tables
- `lockbox_header` - Batch headers (Level 1)
- `lockbox_item` - Cheque/payment items (Level 2)
- `lockbox_clearing` - Payment references (Level 3)

### Audit Tables
- `lockbox_run_log` - Production run history
- `sap_response_log` - SAP API responses
- `line_level_clearing` - Detailed clearing entries

### Configuration Tables
- `lockbox_processing_run` - File processing runs
- `file_pattern` - File pattern definitions
- `batch_template` - Upload templates
- `odata_service` - SAP service configurations

## 🔧 Development

### Project Structure
```
lockbox-app/
├── backend/              # Node.js backend
├── frontend/             # React frontend
├── mta.yaml              # BTP deployment descriptor
├── xs-security.json      # Security configuration
├── manifest.yml          # CF manifest
├── deploy.sh             # Deployment script
├── build.sh              # Build script
└── BTP_DEPLOYMENT.md    # Deployment guide
```

### Environment Variables

**Backend (.env)**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lockbox
DB_USER=postgres
DB_PASSWORD=postgres
PORT=8001
NODE_ENV=development
SAP_CLIENT=100
```

**Frontend (.env)**
```env
REACT_APP_BACKEND_URL=http://localhost:8001
PORT=3000
```

### Service Management

```bash
# Check status
sudo supervisorctl status

# Restart services
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
sudo supervisorctl restart all

# View logs
tail -f /var/log/supervisor/backend.out.log
tail -f /var/log/supervisor/frontend.out.log
```

## 🛡️ Security

- XSUAA integration for authentication
- Role-based access control (RBAC)
- Secure credential management via BTP services
- Cloud Connector for secure on-premise connectivity
- HTTPS enforcement in production

## 📝 Documentation

- [BTP Deployment Guide](./BTP_DEPLOYMENT.md) - Complete deployment instructions
- [Setup Guide](./SETUP_COMPLETE.md) - Local development setup
- [Backend README](./backend/README.md) - Backend documentation
- [Frontend README](./frontend/README.md) - Frontend documentation

## 🔍 Testing

### Health Check
```bash
curl http://localhost:8001/api/health
```

### Upload Test File
Use the UI at http://localhost:3000 to upload an Excel file with 3 sheets:
1. **Header** - Batch information
2. **Cheques** - Payment items
3. **PaymentReferences** - Clearing details

## 🚨 Troubleshooting

### Backend won't start
```bash
# Check logs
tail -100 /var/log/supervisor/backend.err.log

# Common issues:
# - PostgreSQL not running
# - Port 8001 already in use
# - Missing environment variables
```

### Database connection error
```bash
# Start PostgreSQL
sudo -u postgres pg_ctlcluster 15 main start

# Verify connection
psql -U postgres -d lockbox -c "SELECT 1;"
```

### BTP deployment fails
```bash
# Check logs
cf logs lockbox-srv --recent

# Verify services
cf services

# Verify service bindings
cf env lockbox-srv
```

## 📊 Monitoring

### Application Logs
```bash
# Stream logs in BTP
cf logs lockbox-srv

# Recent logs
cf logs lockbox-srv --recent
```

### Application Metrics
```bash
# View app info
cf app lockbox-srv

# Scale application
cf scale lockbox-srv -i 2 -m 1024M
```

## 🔄 Updates & Rollback

### Update Application
```bash
# Make changes
# Rebuild
npm run build

# Redeploy
cf deploy mta_archives/lockbox-app_1.0.0.mtar
```

### Rollback
```bash
# Undeploy current
cf undeploy lockbox-app

# Deploy previous version
cf deploy mta_archives/lockbox-app_<previous>.mtar
```

## 📄 License

UNLICENSED - Private/Internal Use

## 👥 Support

For issues and support:
1. Check application logs
2. Review BTP Cockpit alerts
3. Consult SAP documentation
4. Contact SAP Support if needed

---

**Version**: 1.0.0  
**Last Updated**: 2026-02-04  
**Platform**: SAP Business Technology Platform (BTP)
