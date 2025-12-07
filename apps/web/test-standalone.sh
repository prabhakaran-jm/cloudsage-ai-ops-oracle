#!/bin/bash
# Test script to verify standalone output works locally

set -e

echo "🧪 Testing Next.js Standalone Output"
echo "===================================="
echo ""

cd "$(dirname "$0")"

# Check if built
if [ ! -d ".next/standalone" ]; then
  echo "❌ No standalone output found"
  echo "   Run: npm run build"
  echo ""
  exit 1
fi

echo "✓ Standalone output exists"
echo ""

# Check for server.js
if [ -f ".next/standalone/apps/web/server.js" ]; then
  echo "✓ Server file found at: .next/standalone/apps/web/server.js"
else
  echo "⚠️  Server file location might differ"
  echo "   Looking for server.js..."
  find .next/standalone -name "server.js" -type f
fi

echo ""
echo "📦 Standalone directory contents:"
ls -la .next/standalone/apps/web/ 2>/dev/null || ls -la .next/standalone/

echo ""
echo "🚀 To test locally, run:"
echo "   node .next/standalone/apps/web/server.js"
echo ""
echo "Then visit: http://localhost:3000"
echo ""

# Check public and static directories
if [ -d "public" ]; then
  echo "✓ public/ directory exists (static assets)"
fi

if [ -d ".next/static" ]; then
  echo "✓ .next/static/ directory exists"
fi

echo ""
echo "✓ Standalone output looks good!"
echo ""
echo "Next steps:"
echo "1. Test locally: node .next/standalone/apps/web/server.js"
echo "2. Push to GitHub"
echo "3. Deploy on Netlify"
