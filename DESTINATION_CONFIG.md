# SAP Destination Configuration Template
# Copy this to BTP Cockpit -> Connectivity -> Destinations

## Destination: S4HANA_SYSTEM_DESTINATION

### Basic Configuration
```
Name: S4HANA_SYSTEM_DESTINATION
Type: HTTP
Description: SAP S/4HANA Lockbox API
URL: https://<your-sap-host>:<port>
Proxy Type: OnPremise
Authentication: BasicAuthentication
```

### Authentication
```
User: <SAP_USERNAME>
Password: <SAP_PASSWORD>
```

### Additional Properties
```properties
sap-client=100
WebIDEEnabled=true
WebIDEUsage=odata_gen
HTML5.DynamicDestination=true
```

### Cloud Connector Configuration

**Virtual Host Mapping:**
- **Internal Host**: `<SAP-SERVER-HOSTNAME>`
- **Internal Port**: `<SAP-PORT>` (e.g., 44300)
- **Virtual Host**: `<your-sap-host>` (must match destination URL)
- **Virtual Port**: `<port>`
- **Protocol**: HTTPS

**Access Control:**
- **URL Path**: `/sap/opu/odata/sap/API_LOCKBOXPOST_IN`
- **Access Policy**: Path and all sub-paths

## Testing the Destination

### From BTP Cockpit
1. Go to Connectivity -> Destinations
2. Select `S4HANA_SYSTEM_DESTINATION`
3. Click "Check Connection"
4. Should return: "Connection established"

### From Application
```javascript
// The backend automatically uses this destination
// via SAP Cloud SDK
const response = await executeHttpRequest(
    { destinationName: 'S4HANA_SYSTEM_DESTINATION' },
    { method: 'GET', url: '/sap/opu/odata/sap/API_LOCKBOXPOST_IN' }
);
```

## SAP API Endpoints

### OData Service
```
Base URL: /sap/opu/odata/sap/API_LOCKBOXPOST_IN
```

### Available Entities
```
LockboxBatch           # Main batch entity
LockboxBatchItem       # Payment items
LockboxClearing        # Clearing details
```

### Example Operations

**Create Lockbox Batch (POST)**
```http
POST /sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch?sap-client=100
Content-Type: application/json

{
  "Lockbox": "1234",
  "DepositDateTime": "2024-01-15T10:30:00",
  "AmountInTransactionCurrency": "25000.00",
  "to_Item": {
    "results": [
      {
        "LockboxBatch": "001",
        "LockboxBatchItem": "001",
        "Currency": "USD",
        "AmountInTransactionCurrency": "10000.00"
      }
    ]
  }
}
```

**Read Lockbox Batch (GET)**
```http
GET /sap/opu/odata/sap/API_LOCKBOXPOST_IN/LockboxBatch(LockboxBatchInternalKey='XXX',LockboxBatch='001')?sap-client=100
```

## Troubleshooting

### Error: "Destination not found"
**Solution:**
- Verify destination name matches exactly: `S4HANA_SYSTEM_DESTINATION`
- Check destination is deployed in same subaccount
- Verify destination service is bound to application

### Error: "Connection refused"
**Solution:**
- Check Cloud Connector is running
- Verify virtual host mapping
- Check internal host is reachable from Cloud Connector
- Verify firewall rules

### Error: "401 Unauthorized"
**Solution:**
- Check SAP credentials in destination
- Verify user has required authorizations
- Check sap-client parameter

### Error: "404 Not Found"
**Solution:**
- Verify API path is correct
- Check SAP system has API_LOCKBOXPOST_IN activated
- Verify sap-client parameter

## Security Notes

1. **Credentials**: Never commit credentials to Git
2. **Rotation**: Rotate SAP passwords regularly
3. **Audit**: Enable audit logging for API calls
4. **Access**: Restrict Cloud Connector access rules
5. **Encryption**: Always use HTTPS for SAP connectivity

---

**Last Updated**: 2026-02-04
