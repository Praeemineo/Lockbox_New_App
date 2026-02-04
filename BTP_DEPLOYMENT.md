# SAP BTP Deployment Guide

## Prerequisites

### 1. Required Tools
```bash
# Install Cloud Foundry CLI
curl -L "https://cli.run.pivotal.io/stable?release=linux64-binary" | tar -zx
sudo mv cf /usr/local/bin

# Install MTA Build Tool
npm install -g mbt

# Install Cloud Foundry MTA Plugin
cf install-plugin multiapps

# Verify installations
cf --version
mbt --version
cf plugins | grep multiapps
```

### 2. SAP BTP Account Setup
- SAP BTP Global Account
- Cloud Foundry Subaccount
- Space with appropriate entitlements:
  - PostgreSQL Database (standard plan)
  - Destination Service (lite plan)
  - Connectivity Service (lite plan)
  - XSUAA Service (application plan)

### 3. SAP Cloud Connector Setup
- Install SAP Cloud Connector on-premise
- Configure connection to SAP BTP subaccount
- Add virtual host mapping for SAP S/4HANA system
- Configure destination `S4HANA_SYSTEM_DESTINATION`

## Deployment Steps

### Step 1: Login to Cloud Foundry
```bash
# Set API endpoint (replace with your region)
cf api https://api.cf.us10.hana.ondemand.com

# Login
cf login

# Target your org and space
cf target -o <your-org> -s <your-space>
```

### Step 2: Create Required Services (if not exists)

```bash
# Create PostgreSQL Database
cf create-service postgresql-db standard lockbox-db

# Create Destination Service
cf create-service destination lite lockbox-destination

# Create Connectivity Service
cf create-service connectivity lite lockbox-connectivity

# Create XSUAA Service
cf create-service xsuaa application lockbox-xsuaa -c xs-security.json

# Check service creation status
cf services
```

### Step 3: Build MTA Archive

```bash
# Navigate to project root
cd /app

# Build for development
mbt build -e mta-dev.mtaext

# OR Build for production
mbt build -e mta-prod.mtaext

# OR Build without extension (default)
mbt build
```

This creates an `.mtar` file in `mta_archives/` directory.

### Step 4: Deploy to BTP

```bash
# Deploy the MTA archive
cf deploy mta_archives/lockbox-app_1.0.0.mtar

# Monitor deployment
cf apps
cf services
```

### Step 5: Configure SAP Destination

After deployment, configure the destination in BTP Cockpit:

1. Go to BTP Cockpit → Connectivity → Destinations
2. Edit `S4HANA_SYSTEM_DESTINATION`
3. Set properties:
   - **Name**: `S4HANA_SYSTEM_DESTINATION`
   - **Type**: `HTTP`
   - **URL**: `https://your-sap-host:port`
   - **Proxy Type**: `OnPremise`
   - **Authentication**: `BasicAuthentication`
   - **User**: `<SAP User>`
   - **Password**: `<SAP Password>`
4. Additional Properties:
   - `sap-client`: `100`
   - `WebIDEEnabled`: `true`
   - `WebIDEUsage`: `odata_gen`

### Step 6: Assign Roles to Users

1. Go to BTP Cockpit → Security → Role Collections
2. Assign role collections to users:
   - `Lockbox_Admin` - Full access
   - `Lockbox_User` - Upload and process
   - `Lockbox_Viewer` - Read-only

### Step 7: Access the Application

```bash
# Get application URL
cf apps

# Example output:
name           requested state   instances   memory   disk   urls
lockbox-srv    started           1/1         512M     1G     lockbox-srv-<random>.cfapps.<region>.hana.ondemand.com
```

Access: `https://lockbox-srv-<random>.cfapps.<region>.hana.ondemand.com`

## Environment-Specific Deployments

### Development Environment
```bash
cf target -s dev
mbt build -e mta-dev.mtaext
cf deploy mta_archives/lockbox-app_1.0.0.mtar
```

### Production Environment
```bash
cf target -s prod
mbt build -e mta-prod.mtaext
cf deploy mta_archives/lockbox-app_1.0.0.mtar
```

## Post-Deployment Checks

### 1. Check Application Status
```bash
cf app lockbox-srv
cf logs lockbox-srv --recent
```

### 2. Test Health Endpoint
```bash
curl https://lockbox-srv-<random>.cfapps.<region>.hana.ondemand.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "lockbox-srv",
  "timestamp": "2026-02-04T..."
}
```

### 3. Verify Database Connection
```bash
# Check service binding
cf env lockbox-srv | grep -A 20 VCAP_SERVICES
```

### 4. Test SAP Connectivity
Use the application UI to test:
1. Upload a test lockbox file
2. Preview SAP payload (simulation)
3. Check if SAP connection works

## Troubleshooting

### Issue: Application crashes on startup
```bash
# Check logs
cf logs lockbox-srv --recent

# Common causes:
# - Database connection failure
# - Missing service bindings
# - Insufficient memory

# Restart application
cf restart lockbox-srv
```

### Issue: Database connection error
```bash
# Verify service is created and bound
cf services
cf env lockbox-srv | grep postgresql

# Recreate service binding
cf unbind-service lockbox-srv lockbox-db
cf bind-service lockbox-srv lockbox-db
cf restage lockbox-srv
```

### Issue: SAP connection fails
```bash
# Check Cloud Connector status
# Verify destination configuration in BTP Cockpit
# Test with SAP GUI or other tools

# Check connectivity service
cf service lockbox-connectivity
```

## Updating the Application

### 1. Make code changes locally
### 2. Rebuild MTA
```bash
mbt build
```

### 3. Redeploy
```bash
cf deploy mta_archives/lockbox-app_1.0.0.mtar
```

### 4. Zero-Downtime Deployment
```bash
# Use blue-green deployment
cf deploy mta_archives/lockbox-app_1.0.0.mtar --strategy blue-green
```

## Rollback Procedure

```bash
# List deployed MTA modules
cf mtas

# Undeploy current version
cf undeploy lockbox-app

# Deploy previous version
cf deploy mta_archives/lockbox-app_<previous-version>.mtar
```

## Scaling

```bash
# Scale instances
cf scale lockbox-srv -i 2

# Scale memory
cf scale lockbox-srv -m 1024M

# Scale disk
cf scale lockbox-srv -k 2048M
```

## Monitoring

### Application Logs
```bash
# Stream logs
cf logs lockbox-srv

# Recent logs
cf logs lockbox-srv --recent
```

### Application Metrics
```bash
# CPU and Memory usage
cf app lockbox-srv
```

### Database Monitoring
Use BTP Cockpit → Databases → lockbox-db → Monitoring

## Security Best Practices

1. **Never commit credentials** to Git
2. **Use environment variables** for configuration
3. **Rotate credentials** regularly
4. **Enable audit logging** in BTP
5. **Restrict role assignments** to necessary users only
6. **Use HTTPS only** for all communications
7. **Keep dependencies updated** (npm audit)

## Cost Optimization

1. Use **trial plans** for development
2. Scale down instances during off-hours
3. Use **lite plans** where possible
4. Monitor usage in BTP Cockpit
5. Clean up unused services

## Support

For issues:
1. Check application logs: `cf logs lockbox-srv --recent`
2. Check service status: `cf services`
3. Review BTP Cockpit alerts
4. Contact SAP Support if needed

---

**Last Updated**: 2026-02-04
**Version**: 1.0.0
