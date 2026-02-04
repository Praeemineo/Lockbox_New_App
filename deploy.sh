#!/bin/bash

# Lockbox Application - BTP Deployment Script
# This script automates the build and deployment process

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="lockbox-app"
APP_VERSION="1.0.0"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Lockbox BTP Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command_exists cf; then
    echo -e "${RED}✗ Cloud Foundry CLI not found${NC}"
    echo "Install: https://docs.cloudfoundry.org/cf-cli/install-go-cli.html"
    exit 1
else
    echo -e "${GREEN}✓ Cloud Foundry CLI found${NC}"
fi

if ! command_exists mbt; then
    echo -e "${RED}✗ MTA Build Tool not found${NC}"
    echo "Install: npm install -g mbt"
    exit 1
else
    echo -e "${GREEN}✓ MTA Build Tool found${NC}"
fi

echo ""

# Check if logged in to CF
echo -e "${YELLOW}Checking Cloud Foundry login...${NC}"
if ! cf target >/dev/null 2>&1; then
    echo -e "${RED}✗ Not logged in to Cloud Foundry${NC}"
    echo "Please run: cf login"
    exit 1
else
    echo -e "${GREEN}✓ Logged in to Cloud Foundry${NC}"
    cf target
fi

echo ""

# Ask for environment
echo -e "${YELLOW}Select deployment environment:${NC}"
echo "1) Development (mta-dev.mtaext)"
echo "2) Production (mta-prod.mtaext)"
echo "3) Default (no extension)"
read -p "Enter choice [1-3]: " env_choice

EXT_FILE=""
case $env_choice in
    1)
        EXT_FILE="-e mta-dev.mtaext"
        echo -e "${GREEN}Using Development configuration${NC}"
        ;;
    2)
        EXT_FILE="-e mta-prod.mtaext"
        echo -e "${GREEN}Using Production configuration${NC}"
        ;;
    3)
        echo -e "${GREEN}Using Default configuration${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""

# Clean previous build
echo -e "${YELLOW}Cleaning previous build artifacts...${NC}"
rm -rf mta_archives/ .mta/
echo -e "${GREEN}✓ Cleaned${NC}"

echo ""

# Build MTA
echo -e "${YELLOW}Building MTA archive...${NC}"
if mbt build $EXT_FILE; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

echo ""

# Find the MTAR file
MTAR_FILE=$(find mta_archives -name "*.mtar" | head -n 1)

if [ -z "$MTAR_FILE" ]; then
    echo -e "${RED}✗ MTAR file not found${NC}"
    exit 1
fi

echo -e "${GREEN}Found MTAR: $MTAR_FILE${NC}"
echo ""

# Ask for confirmation
read -p "Deploy to Cloud Foundry? [y/N]: " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

echo ""

# Deploy
echo -e "${YELLOW}Deploying to BTP...${NC}"
if cf deploy "$MTAR_FILE"; then
    echo -e "${GREEN}✓ Deployment successful${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi

echo ""

# Post-deployment checks
echo -e "${YELLOW}Running post-deployment checks...${NC}"

# Check app status
echo -e "${YELLOW}Application status:${NC}"
cf app lockbox-srv

echo ""

# Get app URL
APP_URL=$(cf app lockbox-srv | grep routes | awk '{print $2}')
if [ -n "$APP_URL" ]; then
    echo -e "${GREEN}Application URL: https://$APP_URL${NC}"
    echo -e "${GREEN}Health Check: https://$APP_URL/api/health${NC}"
    
    # Test health endpoint
    echo ""
    echo -e "${YELLOW}Testing health endpoint...${NC}"
    if curl -s -f "https://$APP_URL/api/health" > /dev/null; then
        echo -e "${GREEN}✓ Application is healthy${NC}"
    else
        echo -e "${RED}✗ Health check failed${NC}"
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
