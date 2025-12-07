#!/bin/bash
# Deploy to Raindrop from Git Bash on Windows
# Requires npx.exe to be installed in npm global directory (one-time setup)

set -e

echo "🚀 Deploying CloudSage API to Raindrop"
echo "========================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📁 Working directory: $(pwd)"
echo ""

# Check if npx.exe exists (one-time setup should have created this)
if [ ! -f "/c/Users/User/AppData/Roaming/npm/npx.exe" ]; then
  echo "⚠️  npx.exe not found in npm global directory"
  echo "   Run the one-time setup first:"
  echo "   ./setup-windows-npx.sh"
  echo ""
  exit 1
fi

echo "✓ npx.exe found in npm global directory"
echo ""

# Build
echo "🔨 Building application..."
npm run build

if [ ! -d "dist" ]; then
  echo "✗ Build failed - dist directory not found"
  exit 1
fi

echo "✓ Build successful"
echo ""

# Validate
echo "🔍 Validating project..."
if ! raindrop build validate; then
  echo "✗ Validation failed"
  exit 1
fi
echo ""

# Deploy to Raindrop
echo "🚀 Deploying to Raindrop..."
echo ""

# Try deploy with --amend first (in case of locked state)
if raindrop build deploy --amend --start; then
  DEPLOY_SUCCESS=true
elif raindrop build deploy --start; then
  DEPLOY_SUCCESS=true
else
  EXIT_CODE=$?
  echo ""
  echo "✗ Deployment failed (exit code: $EXIT_CODE)"
  echo ""

  if [ $EXIT_CODE -eq 1 ]; then
    echo "Common issues:"
    echo "  - Missing environment variables (use: raindrop build env setup)"
    echo "  - Version mismatch (ensure package.json has exact version: \"0.12.0\")"
    echo "  - Build errors (check logs above)"
  elif [ $EXIT_CODE -eq 2 ]; then
    echo "Deployment locked - try: raindrop build deploy --amend --start"
  fi

  exit $EXIT_CODE
fi

if [ "$DEPLOY_SUCCESS" = true ]; then
  echo ""
  echo "✓ Deployment successful!"
  echo ""
  echo "Getting deployment info..."
  raindrop build find
  echo ""
  echo "Status:"
  raindrop build status
fi

echo ""
echo "✓ Done!"

