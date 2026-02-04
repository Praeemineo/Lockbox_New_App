#!/bin/bash

# Service Creation Script for SAP BTP
# Creates all required services before deployment

set -e

echo "🔧 Creating SAP BTP Services for Lockbox Application"
echo ""

# Check if logged in
if ! cf target >/dev/null 2>&1; then
    echo "❌ Not logged in to Cloud Foundry"
    echo "Please run: cf login"
    exit 1
fi

echo "✓ Logged in to Cloud Foundry"
cf target
echo ""

# Function to create service if it doesn't exist
create_service_if_not_exists() {
    local service_name=$1
    local service=$2
    local plan=$3
    local config=$4
    
    if cf service "$service_name" >/dev/null 2>&1; then
        echo "ℹ️  Service '$service_name' already exists"
    else
        echo "📦 Creating service: $service_name"
        if [ -n "$config" ]; then
            cf create-service "$service" "$plan" "$service_name" -c "$config"
        else
            cf create-service "$service" "$plan" "$service_name"
        fi
        echo "✅ Service '$service_name' created"
    fi
    echo ""
}

# PostgreSQL Database
echo "1️⃣  PostgreSQL Database"
create_service_if_not_exists "lockbox-db" "postgresql-db" "standard"

# Destination Service
echo "2️⃣  Destination Service"
create_service_if_not_exists "lockbox-destination" "destination" "lite"

# Connectivity Service
echo "3️⃣  Connectivity Service"
create_service_if_not_exists "lockbox-connectivity" "connectivity" "lite"

# XSUAA Service
echo "4️⃣  XSUAA Service"
if [ -f "xs-security.json" ]; then
    create_service_if_not_exists "lockbox-xsuaa" "xsuaa" "application" "xs-security.json"
else
    echo "❌ xs-security.json not found"
    exit 1
fi

# Check service creation status
echo "⏳ Checking service creation status..."
echo ""
cf services

echo ""
echo "✅ Service creation complete!"
echo ""
echo "Note: Service provisioning may take a few minutes."
echo "Check status with: cf services"
echo ""
echo "Next steps:"
echo "1. Wait for all services to show 'create succeeded'"
echo "2. Configure SAP destination in BTP Cockpit"
echo "3. Run: ./deploy.sh"
