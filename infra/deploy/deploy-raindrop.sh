#!/bin/bash
# CloudSage Backend Deployment Script for Raindrop
# Run this in Git Bash or WSL on Windows

set -e  # Exit on error

echo "🚀 CloudSage Backend Deployment to Raindrop"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Navigate to API directory
cd "$(dirname "$0")/../../apps/api" || exit 1
echo -e "${GREEN}✓${NC} Changed to apps/api directory"
echo ""

# Check if raindrop CLI is installed
if ! command -v raindrop &> /dev/null; then
    echo -e "${RED}✗${NC} Raindrop CLI not found"
    echo "Installing Raindrop CLI..."
    npm install -g @liquidmetal-ai/raindrop@latest
fi

echo -e "${GREEN}✓${NC} Raindrop CLI found"
echo ""

# Check authentication
echo "Checking authentication..."
if ! raindrop auth list &> /dev/null; then
    echo -e "${YELLOW}⚠${NC} Not authenticated. Please login:"
    echo "  raindrop auth login"
    exit 1
fi

echo -e "${GREEN}✓${NC} Authenticated"
raindrop auth list
echo ""

# Build application
echo "Building application..."
npm install
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}✗${NC} Build failed - dist directory not found"
    exit 1
fi

echo -e "${GREEN}✓${NC} Build successful"
echo ""

# Validate manifest
echo "Validating Raindrop manifest..."
if raindrop build validate; then
    echo -e "${GREEN}✓${NC} Manifest is valid"
else
    echo -e "${RED}✗${NC} Manifest validation failed"
    exit 1
fi
echo ""

# Set environment variables
echo "Setting environment variables..."
echo -e "${YELLOW}⚠${NC} Make sure you have these values ready:"
echo "  - RAINDROP_MCP_URL"
echo "  - RAINDROP_API_KEY"
echo "  - VULTR_WORKER_URL"
echo "  - VULTR_API_KEY"
echo ""

read -p "Set RAINDROP_MCP_URL (default: https://mcp.raindrop.run/): " MCP_URL
MCP_URL=${MCP_URL:-https://mcp.raindrop.run/}
raindrop build env set RAINDROP_MCP_URL "$MCP_URL"

read -p "Set RAINDROP_API_KEY: " API_KEY
raindrop build env set RAINDROP_API_KEY "$API_KEY"

read -p "Set VULTR_WORKER_URL: " WORKER_URL
raindrop build env set VULTR_WORKER_URL "$WORKER_URL"

read -p "Set VULTR_API_KEY: " VULTR_KEY
raindrop build env set VULTR_API_KEY "$VULTR_KEY"

raindrop build env set PORT "3001"
raindrop build env set NODE_ENV "production"

echo -e "${GREEN}✓${NC} Environment variables set"
echo ""

# Deploy
echo "Deploying to Raindrop..."
echo ""

if raindrop build deploy --start; then
    echo ""
    echo -e "${GREEN}✓${NC} Deployment successful!"
    echo ""
    echo "Getting deployment status..."
    raindrop build status
    echo ""
    echo "Getting deployment URL..."
    raindrop build find
else
    echo ""
    echo -e "${RED}✗${NC} Deployment failed"
    exit 1
fi

echo ""
echo "Done!"

