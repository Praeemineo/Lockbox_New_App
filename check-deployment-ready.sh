#!/bin/bash

# BTP Deployment Readiness Check
# Validates that all required files and configurations are in place

set -e

echo "🔍 Checking BTP Deployment Readiness..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

# Function to check file exists
check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description: $file"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $description: $file (MISSING)"
        ((FAIL++))
    fi
}

# Function to check directory exists
check_dir() {
    local dir=$1
    local description=$2
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description: $dir"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $description: $dir (MISSING)"
        ((FAIL++))
    fi
}

# Function to check executable
check_executable() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ] && [ -x "$file" ]; then
        echo -e "${GREEN}✓${NC} $description: $file"
        ((PASS++))
    elif [ -f "$file" ]; then
        echo -e "${YELLOW}⚠${NC} $description: $file (NOT EXECUTABLE)"
        ((FAIL++))
    else
        echo -e "${RED}✗${NC} $description: $file (MISSING)"
        ((FAIL++))
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 MTA Configuration Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_file "mta.yaml" "MTA Descriptor"
check_file "xs-security.json" "Security Configuration"
check_file "manifest.yml" "CF Manifest"
check_file "mta-dev.mtaext" "Development Extension"
check_file "mta-prod.mtaext" "Production Extension"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Deployment Scripts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_executable "deploy.sh" "Deployment Script"
check_executable "build.sh" "Build Script"
check_executable "create-services.sh" "Service Creation Script"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📄 Deployment Exclusions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_file ".cfignore" "Root CF Ignore"
check_file "backend/.cfignore" "Backend CF Ignore"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Documentation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_file "README.md" "Main README"
check_file "BTP_DEPLOYMENT.md" "Deployment Guide"
check_file "DESTINATION_CONFIG.md" "Destination Guide"
check_file "BTP_FILES_SUMMARY.md" "Files Summary"
check_file "SETUP_COMPLETE.md" "Setup Guide"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏗️ Application Structure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_dir "backend" "Backend Directory"
check_dir "backend/sap" "SAP Module"
check_dir "backend/db" "Database Module"
check_file "backend/server.js" "Backend Server"
check_file "backend/package.json" "Backend Package"
check_file "backend/.env" "Backend Environment"
echo ""
check_dir "frontend" "Frontend Directory"
check_file "frontend/package.json" "Frontend Package"
check_file "frontend/.env" "Frontend Environment"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Package Management"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_file "package.json" "Root Package"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛠️ Required Tools Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check CF CLI
if command -v cf &> /dev/null; then
    CF_VERSION=$(cf version | head -n 1)
    echo -e "${GREEN}✓${NC} Cloud Foundry CLI: $CF_VERSION"
    ((PASS++))
else
    echo -e "${RED}✗${NC} Cloud Foundry CLI: NOT INSTALLED"
    echo "  Install: https://docs.cloudfoundry.org/cf-cli/install-go-cli.html"
    ((FAIL++))
fi

# Check MBT
if command -v mbt &> /dev/null; then
    MBT_VERSION=$(mbt --version 2>&1 | head -n 1)
    echo -e "${GREEN}✓${NC} MBT (MTA Build Tool): $MBT_VERSION"
    ((PASS++))
else
    echo -e "${RED}✗${NC} MBT (MTA Build Tool): NOT INSTALLED"
    echo "  Install: npm install -g mbt"
    ((FAIL++))
fi

# Check CF MTA Plugin
if cf plugins | grep -q multiapps; then
    echo -e "${GREEN}✓${NC} CF MTA Plugin: Installed"
    ((PASS++))
else
    echo -e "${RED}✗${NC} CF MTA Plugin: NOT INSTALLED"
    echo "  Install: cf install-plugin multiapps"
    ((FAIL++))
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js: $NODE_VERSION"
    ((PASS++))
else
    echo -e "${RED}✗${NC} Node.js: NOT INSTALLED"
    ((FAIL++))
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm: v$NPM_VERSION"
    ((PASS++))
else
    echo -e "${RED}✗${NC} npm: NOT INSTALLED"
    ((FAIL++))
fi

echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Readiness Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "Total Checks: $((PASS + FAIL))"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ ALL CHECKS PASSED - READY FOR BTP DEPLOYMENT${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Next Steps:"
    echo "1. cf login"
    echo "2. ./create-services.sh"
    echo "3. ./deploy.sh"
    echo ""
    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ SOME CHECKS FAILED - REVIEW ABOVE ERRORS${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Please fix the issues above before deployment."
    echo ""
    exit 1
fi
