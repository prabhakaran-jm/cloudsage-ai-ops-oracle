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
  
  # Add nodejs directory to PATH
  export PATH="$NPX_DIR:$PATH"
  
  # Create npx wrapper in nodejs directory (where it will be found)
  # Convert Windows path to Git Bash format
  NPX_DIR_BASH=$(echo "$NPX_DIR" | sed 's|^/c/|C:/|' | sed 's|/|\\|g')
  
  # Create wrapper in current directory first
  cat > npx << EOF
#!/bin/bash
cmd.exe /c "$NPX_DIR_BASH\\npx.cmd" "\$@"
EOF
  chmod +x npx
  
  # Also try creating it in a temp location that's in PATH
  TEMP_NPX="$HOME/.local/bin/npx"
  mkdir -p "$HOME/.local/bin"
  cp npx "$TEMP_NPX"
  chmod +x "$TEMP_NPX"
  export PATH="$HOME/.local/bin:$NPX_DIR:$PATH"
  
  echo "✓ Created npx wrapper in current dir and ~/.local/bin"
  echo "✓ PATH updated: $HOME/.local/bin and $NPX_DIR added"
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

# Verify npx is accessible
echo "🔍 Verifying npx is accessible..."
if command -v npx &> /dev/null || [ -f "$NPX_DIR/npx.cmd" ]; then
  echo "✓ npx should be accessible"
  # Test it
  if npx --version &> /dev/null || cmd.exe /c "$(echo "$NPX_DIR" | sed 's|/c/|C:/|' | sed 's|/|\\|g')\\npx.cmd" --version &> /dev/null; then
    echo "✓ npx test successful"
  else
    echo "⚠️  npx test failed, but continuing..."
  fi
else
  echo "⚠️  npx not found in PATH, but continuing..."
fi
echo ""

# Deploy
echo "🚀 Deploying to Raindrop..."
echo ""

# Set PATH explicitly for the raindrop command
export PATH="$HOME/.local/bin:$NPX_DIR:$PATH"

if PATH="$HOME/.local/bin:$NPX_DIR:$PATH" raindrop build deploy --start; then
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

