#!/bin/bash
# Netlify build script for Next.js in monorepo with standalone output

set -e

echo "🔧 Building Next.js app in monorepo..."
echo ""

# Step 1: Install dependencies from workspace root
echo "📦 Installing workspace dependencies..."
cd ../..
npm install --legacy-peer-deps
cd apps/web
echo "✓ Dependencies installed"
echo ""

# Step 2: Build Next.js with standalone output
echo "🔨 Building Next.js application..."
npm run build
echo "✓ Build complete"
echo ""

# Step 3: Verify standalone output
if [ -d ".next/standalone" ]; then
  echo "✓ Standalone output created at .next/standalone"
  ls -la .next/standalone
else
  echo "⚠️  Warning: No standalone output found"
  echo "   Check next.config.js has output: 'standalone'"
fi

echo ""
echo "✓ Build script complete"
