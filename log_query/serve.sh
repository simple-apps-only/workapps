#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure Node 20+ via nvm
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 2>/dev/null || { echo "ERROR: nvm not found or Node version in .nvmrc unavailable. Run: nvm install"; exit 1; }

echo "=== Log Query ==="
echo ""

# Auth tokens are read from ~/.netrc at query time (set by: css auth login)
# MONOREPO_ROOT is optional — only needed as a CLI fallback if the gateway is unavailable.

if [ ! -d "node_modules" ]; then
  echo "[1/3] Installing dependencies..."
  npm install --silent
else
  echo "[1/3] Dependencies already installed."
fi

# Rebuild only if source is newer than the dist bundle
NEEDS_BUILD=false
if [ ! -d "dist" ]; then
  NEEDS_BUILD=true
elif [ -n "$(find src -newer dist/index.html 2>/dev/null)" ]; then
  NEEDS_BUILD=true
fi

if $NEEDS_BUILD; then
  echo "[2/3] Building production bundle..."
  npm run build --silent
  echo "[2/3] Build complete."
else
  echo "[2/3] Source unchanged — skipping rebuild."
fi

echo ""
echo "[3/3] Starting server on http://localhost:3001"
echo ""
echo "  URL:   http://localhost:3001"
echo "  Auth:  reads ~/.netrc tokens (run 'css auth login' if queries fail)"
if [ -n "${MONOREPO_ROOT:-}" ]; then
  echo "  CLI:   $MONOREPO_ROOT (fallback enabled)"
fi
echo ""
echo "  Press Ctrl+C to stop."
echo ""

exec node server.js
