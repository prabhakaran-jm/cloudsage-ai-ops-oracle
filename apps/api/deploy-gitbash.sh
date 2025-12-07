#!/bin/bash
# Deploy to Raindrop from Git Bash on Windows
# This script fixes the npx PATH issue

set -e

echo "🚀 Deploying CloudSage API to Raindrop"
echo "========================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📁 Working directory: $(pwd)"
echo ""

# Find and add npx to PATH
echo "🔍 Finding npx..."
NPX_DIR=""

# Check common Windows locations
if [ -f "/c/Program Files/nodejs/npx.cmd" ]; then
  NPX_DIR="/c/Program Files/nodejs"
elif [ -f "/c/Program Files (x86)/nodejs/npx.cmd" ]; then
  NPX_DIR="/c/Program Files (x86)/nodejs"
fi

if [ -n "$NPX_DIR" ]; then
  echo "✓ Found npx at: $NPX_DIR/npx.cmd"
  export PATH="$NPX_DIR:$PATH"
  
  # Create npx wrapper in current directory
  cat > npx << 'EOF'
#!/bin/bash
cmd.exe /c "C:\Program Files\nodejs\npx.cmd" "$@"
EOF
  chmod +x npx
  export PATH="$(pwd):$PATH"
  echo "✓ Created npx wrapper"
else
  echo "⚠️  npx.cmd not found in standard locations"
  echo "Trying to use npm to find it..."
  if command -v npm &> /dev/null; then
    NPM_DIR=$(dirname "$(which npm)")
    export PATH="$NPM_DIR:$PATH"
  fi
fi

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

# Deploy
echo "🚀 Deploying to Raindrop..."
echo ""

if raindrop build deploy --start; then
  echo ""
  echo "✓ Deployment successful!"
  echo ""
  echo "Getting deployment URL..."
  raindrop build find
  echo ""
  echo "Check status:"
  raindrop build status
else
  echo ""
  echo "✗ Deployment failed"
  exit 1
fi

# Cleanup
if [ -f "npx" ]; then
  rm npx
fi

echo ""
echo "Done!"

