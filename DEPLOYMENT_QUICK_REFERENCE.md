# Quick Reference: BTP Deployment Files

## ✅ All Files Updated with PostgreSQL Credentials

```
DB_HOST: postgres-aee790df-b48b-48cc-96b3-db432a62390e.czuelothxj0h.ap-southeast-2.rds.amazonaws.com
DB_PORT: 2477
DB_NAME: CAmqjnIfEdIX
DB_USER: 1cf523d60c97
DB_PASSWORD: 593373429221a65ff07f625d1b
DB_SSL: true
```

---

## 📁 Configuration Files Status

| File | Location | Status | Purpose |
|------|----------|--------|---------|
| `mta.yaml` | `/app/mta.yaml` | ✅ Updated | Main MTA deployment descriptor |
| `manifest.yml` | `/app/manifest.yml` | ✅ Updated | Cloud Foundry manifest |
| `.env` | `/app/backend/.env` | ✅ Updated | Local development env vars |
| `mta-dev.mtaext` | `/app/mta-dev.mtaext` | ✅ Ready | Dev environment extension |
| `mta-prod.mtaext` | `/app/mta-prod.mtaext` | ✅ Ready | Prod environment extension |
| `xs-security.json` | `/app/xs-security.json` | ✅ Ready | XSUAA security config |

---

## 🚀 Quick Deploy Commands

### Build MTA
```bash
cd /app
mbt build
```

### Deploy to Development
```bash
cf deploy lockbox-app_1.0.0.mtar -e mta-dev.mtaext
```

### Deploy to Production
```bash
cf deploy lockbox-app_1.0.0.mtar -e mta-prod.mtaext
```

### Simple CF Push
```bash
cf push -f manifest.yml
```

---

## 🔍 Verify Deployment

```bash
# Check app status
cf apps

# Check app details
cf app lockbox-srv

# View environment variables
cf env lockbox-srv | grep DB_

# Stream logs
cf logs lockbox-srv

# SSH into container
cf ssh lockbox-srv
```

---

## 🔗 Application URLs

After deployment, access:
- **App Route:** `https://lockbox-srv-<org>-<space>.cfapps.<region>.hana.ondemand.com`
- **Health Check:** `https://<app-url>/api/health`
- **Main UI:** `https://<app-url>/`

---

## 📊 Resource Configuration

### Development
- **Memory:** 256M
- **Disk:** 512M
- **Instances:** 1

### Production
- **Memory:** 1024M
- **Disk:** 2048M
- **Instances:** 2 (High Availability)

---

## 🔐 Required BTP Services

1. **PostgreSQL** (Existing service: "Postgresql")
2. **Destination** (Plan: lite)
3. **Connectivity** (Plan: lite)
4. **XSUAA** (Plan: application)

---

## ⚡ Key Points

- ✅ PostgreSQL database credentials are in ALL deployment files
- ✅ SSL is enabled for database connection
- ✅ SAP S/4HANA destination configured
- ✅ Health check endpoint: `/api/health`
- ✅ MTA build ready to execute
- 📄 Full documentation: `/app/BTP_DEPLOYMENT_CONFIG.md`

---

**Last Updated:** March 31, 2025
