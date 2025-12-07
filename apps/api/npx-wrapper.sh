#!/bin/bash
# npx wrapper for Windows Git Bash
# This allows Raindrop CLI to find npx

# Try different npx locations
NPX_CMD=""

# Check common Windows locations
if [ -f "/c/Program Files/nodejs/npx.cmd" ]; then
  NPX_CMD="/c/Program Files/nodejs/npx.cmd"
elif [ -f "/c/Program Files (x86)/nodejs/npx.cmd" ]; then
  NPX_CMD="/c/Program Files (x86)/nodejs/npx.cmd"
elif command -v npx.cmd &> /dev/null; then
  NPX_CMD="npx.cmd"
elif command -v npx &> /dev/null; then
  NPX_CMD="npx"
fi

if [ -z "$NPX_CMD" ]; then
  echo "Error: npx not found" >&2
  exit 1
fi

# Execute npx with all arguments
if [[ "$NPX_CMD" == *".cmd" ]]; then
  # Use cmd.exe to run .cmd file
  cmd.exe /c "$NPX_CMD" "$@"
else
  # Direct execution
  exec "$NPX_CMD" "$@"
fi

