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
  
  # Convert to Windows path format
  NPX_DIR_WIN=$(echo "$NPX_DIR" | sed 's|^/c/|C:|' | sed 's|/|\\|g')
  
  # Create npx.exe in user-writable location (AppData)
  # This avoids permission issues with Program Files
  USER_NPX_DIR="$HOME/AppData/Local/npm"
  mkdir -p "$USER_NPX_DIR"
  
  # Create npx.exe wrapper that calls npx.cmd
  cat > "$USER_NPX_DIR/npx.exe" << EOF
@echo off
"C:\\Program Files\\nodejs\\npx.cmd" %*
EOF
  
  # Also create npx (without extension) for Unix-like tools
  cat > "$USER_NPX_DIR/npx" << EOF
#!/bin/bash
cmd.exe /c "$NPX_DIR_WIN\\npx.cmd" "\$@"
EOF
  chmod +x "$USER_NPX_DIR/npx"
  
  # Create in ~/.local/bin as well
  mkdir -p "$HOME/.local/bin"
  cp "$USER_NPX_DIR/npx" "$HOME/.local/bin/npx"
  chmod +x "$HOME/.local/bin/npx"
  
  # Add both to PATH (user location first, then nodejs)
  export PATH="$USER_NPX_DIR:$HOME/.local/bin:$NPX_DIR:$PATH"
  
  echo "✓ Created npx.exe in $USER_NPX_DIR (user-writable)"
  echo "✓ Created npx wrapper in ~/.local/bin"
  echo "✓ PATH updated with user locations first"
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

# Verify npx is accessible (quick check, no hanging)
echo "🔍 Verifying npx setup..."
if [ -n "$NPX_DIR" ] && [ -f "$NPX_DIR/npx.cmd" ]; then
  echo "✓ npx.cmd found at: $NPX_DIR/npx.cmd"
  echo "✓ npx.exe created in user directory"
  echo "✓ PATH configured with npx locations"
else
  echo "⚠️  npx.cmd not found, but continuing..."
fi
echo ""

# Deploy
echo "🚀 Deploying to Raindrop..."
echo ""

# Set PATH explicitly for the raindrop command (user locations first)
FINAL_PATH="$USER_NPX_DIR:$HOME/.local/bin:$NPX_DIR:$PATH"
export PATH="$FINAL_PATH"

# Also set PATH in Windows format for Node.js spawn
export NODE_PATH="$USER_NPX_DIR"
export NPM_CONFIG_PREFIX="$HOME/AppData/Local/npm"

echo "Using PATH with npx locations..."
echo ""

# Export npx path explicitly for Node.js spawn
if [ -f "$NPX_EXE_PATH" ]; then
  export NPX_PATH="$NPX_EXE_PATH"
  echo "✓ NPX_PATH set to: $NPX_EXE_PATH"
fi

echo ""

# Try deploying without --start first (just upload)
echo "Step 1: Uploading build..."
if env PATH="$FINAL_PATH" NODE_PATH="$USER_NPX_DIR" NPM_CONFIG_PREFIX="$HOME/AppData/Local/npm" raindrop build deploy; then
  echo "✓ Build uploaded successfully"
  echo ""
  echo "Step 2: Starting service..."
  # Then start separately
  if env PATH="$FINAL_PATH" raindrop build start; then
    echo "✓ Service started"
    DEPLOY_SUCCESS=true
  else
    echo "⚠️  Service start failed, but build is uploaded"
    echo "Try: raindrop build start"
    DEPLOY_SUCCESS=false
  fi
elif env PATH="$FINAL_PATH" raindrop build deploy --start; then
  DEPLOY_SUCCESS=true
else
  DEPLOY_SUCCESS=false
fi

if [ "$DEPLOY_SUCCESS" = true ]; then
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

