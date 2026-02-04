#!/bin/bash

# Lockbox Application - Local Build Script
# Prepares the application for BTP deployment

set -e

echo "🔨 Building Lockbox Application for BTP..."
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm ci --production
cd ..

echo "✅ Backend dependencies installed"
echo ""

# Build MTA
echo "🏗️  Building MTA archive..."
mbt build

echo ""
echo "✅ Build complete!"
echo "📦 MTA archive created in: mta_archives/"
echo ""
echo "Next steps:"
echo "1. cf login"
echo "2. cf deploy mta_archives/lockbox-app_1.0.0.mtar"
