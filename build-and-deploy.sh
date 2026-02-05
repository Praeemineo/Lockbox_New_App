#!/bin/bash

# SAP Lockbox Application - Build and Deploy Script
# This script builds the MTA archive and deploys it to SAP BTP

set -e  # Exit on any error

echo "======================================"
echo "SAP Lockbox - Build & Deploy"
echo "======================================"
echo ""

# Step 1: Check prerequisites
echo "Step 1: Checking prerequisites..."
if ! command -v mbt &> /dev/null; then
    echo "❌ MBT not found. Installing..."
    npm install -g mbt
fi

if ! command -v cf &> /dev/null; then
    echo "❌ CF CLI not found. Please install Cloud Foundry CLI first."
    echo "   Visit: https://docs.cloudfoundry.org/cf-cli/install-go-cli.html"
    exit 1
fi

echo "✅ Prerequisites OK"
echo ""

# Step 2: Clean previous builds
echo "Step 2: Cleaning previous builds..."
rm -rf mta_archives/*.mtar
echo "✅ Cleanup complete"
echo ""

# Step 3: Build MTA archive
echo "Step 3: Building MTA archive..."
cd /app
mbt build

if [ ! -f "mta_archives/lockbox-app_1.0.0.mtar" ]; then
    echo "❌ Build failed - MTAR file not found"
    exit 1
fi

echo "✅ Build complete: mta_archives/lockbox-app_1.0.0.mtar"
echo ""

# Step 4: Show MTA info
echo "Step 4: MTA Archive Info..."
ls -lh mta_archives/lockbox-app_1.0.0.mtar
echo ""

# Step 5: Deploy
echo "Step 5: Deploying to SAP BTP..."
echo "⚠️  This will take several minutes..."
echo ""

cf deploy mta_archives/lockbox-app_1.0.0.mtar

if [ $? -eq 0 ]; then
    echo ""
    echo "======================================"
    echo "✅ Deployment Successful!"
    echo "======================================"
    echo ""
    echo "Next steps:"
    echo "1. Check logs:     cf logs lockbox-srv --recent"
    echo "2. Check app:      cf app lockbox-srv"
    echo "3. Check services: cf services"
    echo "4. Test health:    curl https://\$(cf app lockbox-srv --guid).cfapps.<region>.hana.ondemand.com/api/health"
    echo ""
else
    echo ""
    echo "======================================"
    echo "❌ Deployment Failed!"
    echo "======================================"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check CF login:  cf target"
    echo "2. Check services:  cf services"
    echo "3. Check logs:      cf logs lockbox-srv --recent"
    exit 1
fi
