#!/bin/bash
# Fix npx PATH issue for Raindrop CLI on Windows

echo "🔧 Fixing npx PATH for Raindrop CLI"
echo "===================================="
echo ""

# Find npx locations
NPX_LOCATIONS=(
  "/c/Program Files/nodejs/npx.cmd"
  "/c/Program Files (x86)/nodejs/npx.cmd"
  "$HOME/AppData/Roaming/npm/npx.cmd"
  "$HOME/AppData/Local/npm/npx.cmd"
)

NPX_FOUND=""

for loc in "${NPX_LOCATIONS[@]}"; do
  if [ -f "$loc" ]; then
    echo "✓ Found npx at: $loc"
    NPX_DIR=$(dirname "$loc")
    NPX_FOUND="$NPX_DIR"
    break
  fi
done

# Also check node directory
if command -v node &> /dev/null; then
  NODE_DIR=$(dirname "$(which node)")
  echo "✓ Node.js directory: $NODE_DIR"
  
  if [ -f "$NODE_DIR/npx.cmd" ]; then
    echo "✓ Found npx.cmd in Node.js directory"
    NPX_FOUND="$NODE_DIR"
  fi
fi

if [ -z "$NPX_FOUND" ]; then
  echo "✗ npx not found in common locations"
  echo ""
  echo "Trying to find via npm..."
  if command -v npm &> /dev/null; then
    NPM_DIR=$(dirname "$(which npm)")
    echo "✓ npm directory: $NPM_DIR"
    export PATH="$NPM_DIR:$PATH"
  fi
else
  echo ""
  echo "Adding to PATH: $NPX_FOUND"
  export PATH="$NPX_FOUND:$PATH"
fi

# Convert Windows path to Git Bash format if needed
if [[ "$NPX_FOUND" == *"Program Files"* ]]; then
  NPX_FOUND=$(echo "$NPX_FOUND" | sed 's|C:|/c|' | sed 's|\\|/|g')
fi

echo ""
echo "Current PATH includes:"
echo "$PATH" | tr ':' '\n' | grep -i "node\|npm" | head -5
echo ""

# Try to find npx now
if command -v npx &> /dev/null || [ -f "$NPX_FOUND/npx.cmd" ]; then
  echo "✓ npx should be accessible now"
  echo ""
  echo "Try deployment again:"
  echo "  cd apps/api"
  echo "  raindrop build deploy --start"
else
  echo "⚠️  npx still not found"
  echo ""
  echo "Alternative: Create npx wrapper"
  echo "  Create a file 'npx' in current directory with:"
  echo "  #!/bin/bash"
  echo "  cmd.exe /c \"$NPX_FOUND/npx.cmd\" \"\$@\""
fi

