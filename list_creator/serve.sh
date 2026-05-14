#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure Node 20+ via nvm
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 2>/dev/null || { echo "ERROR: nvm not found or Node version in .nvmrc unavailable. Run: nvm install"; exit 1; }

echo "=== CSV List Converter ==="
echo ""

if [ ! -d "node_modules" ]; then
  echo "[1/3] Installing dependencies..."
  npm install --silent
else
  echo "[1/3] Dependencies already installed, skipping."
fi

echo "[2/3] Building production bundle..."
npm run build --silent

DIST="$SCRIPT_DIR/dist"
FILE_COUNT=$(find "$DIST" -type f | wc -l | tr -d ' ')
TOTAL_SIZE=$(du -sh "$DIST" | cut -f1)

echo ""
echo "Build complete:"
echo "  Output:  $DIST"
echo "  Files:   $FILE_COUNT"
echo "  Size:    $TOTAL_SIZE"
echo ""

echo "[3/3] Starting local server..."
echo "  URL:   http://localhost:3000"
echo "  Press Ctrl+C to stop."
echo ""

npx vite preview --port 3000
