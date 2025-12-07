#!/bin/bash
# Netlify build script for Next.js in monorepo with standalone output

set -e

echo "🔧 Building Next.js app in monorepo..."
echo ""

# Get the absolute path to the repo root
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
echo "📁 Repository root: $REPO_ROOT"
echo ""

# Step 1: Install dependencies from workspace root
echo "📦 Installing workspace dependencies..."
cd "$REPO_ROOT"
npm install --legacy-peer-deps
echo "✓ Dependencies installed"
echo ""

# Step 2: Add root node_modules/.bin to PATH so 'next' binary is found
export PATH="$REPO_ROOT/node_modules/.bin:$PATH"
echo "✓ PATH updated to include root node_modules/.bin"
echo ""

# Step 3: Build Next.js with standalone output
echo "🔨 Building Next.js application..."
cd "$REPO_ROOT/apps/web"
npm run build
echo "✓ Build complete"
echo ""

# Step 4: Verify standalone output
if [ -d ".next/standalone" ]; then
  echo "✓ Standalone output created at .next/standalone"
  ls -la .next/standalone | head -10
else
  echo "⚠️  Warning: No standalone output found"
  echo "   Check next.config.js has output: 'standalone'"
fi

echo ""
echo "✓ Build script complete"
