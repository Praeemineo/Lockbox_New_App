#!/bin/bash

# Quick SAP Connection Diagnostic Script
# Run this after deployment to check everything

echo "=================================================="
echo "SAP Lockbox Connection Diagnostic"
echo "=================================================="
echo ""

# Get app name
APP_NAME="lockbox-srv"

echo "1. Checking if app is running..."
cf app $APP_NAME | grep -E "state|instances"
echo ""

echo "2. Checking service bindings..."
cf services | grep -E "name|lockbox"
echo ""

echo "3. Checking if destination service is bound..."
DEST_BOUND=$(cf services | grep "lockbox-destination" | grep "$APP_NAME")
if [ -z "$DEST_BOUND" ]; then
    echo "❌ PROBLEM: Destination service NOT bound to app!"
    echo "   Fix: cf bind-service $APP_NAME lockbox-destination && cf restage $APP_NAME"
else
    echo "✅ Destination service is bound"
fi
echo ""

echo "4. Checking VCAP_SERVICES..."
HAS_VCAP=$(cf env $APP_NAME | grep '"destination"')
if [ -z "$HAS_VCAP" ]; then
    echo "❌ PROBLEM: No destination in VCAP_SERVICES!"
    echo "   This means the service is not properly bound"
else
    echo "✅ Destination found in VCAP_SERVICES"
    echo ""
    echo "   Destination service details:"
    cf env $APP_NAME | grep -A 20 '"destination"' | head -25
fi
echo ""

echo "5. Getting app URL..."
APP_URL=$(cf app $APP_NAME | grep routes | awk '{print $2}')
echo "   App URL: https://$APP_URL"
echo ""

echo "6. Testing health endpoint..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$APP_URL/api/health)
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Health endpoint OK (200)"
else
    echo "❌ Health endpoint failed: $HEALTH_STATUS"
fi
echo ""

echo "7. Checking recent logs for SAP config..."
echo "   SAP Configuration from logs:"
cf logs $APP_NAME --recent | grep -A 5 "SAP Configuration" | head -10
echo ""

echo "8. Checking for any destination errors in logs..."
DEST_ERRORS=$(cf logs $APP_NAME --recent | grep -i "destination" | grep -i "error")
if [ -z "$DEST_ERRORS" ]; then
    echo "✅ No destination errors in recent logs"
else
    echo "❌ Destination errors found:"
    echo "$DEST_ERRORS"
fi
echo ""

echo "=================================================="
echo "Diagnostic Summary"
echo "=================================================="
echo ""
echo "If you see ❌ above, those are issues to fix."
echo "Most common fix: Rebind destination service"
echo ""
echo "To rebind:"
echo "  cf bind-service $APP_NAME lockbox-destination"
echo "  cf restage $APP_NAME"
echo ""
echo "To see live logs during SAP call:"
echo "  cf logs $APP_NAME"
echo ""
