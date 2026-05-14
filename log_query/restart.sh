#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure Node 20+ via nvm
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 2>/dev/null || { echo "ERROR: nvm not found or Node version in .nvmrc unavailable. Run: nvm install"; exit 1; }

export PORT="${PORT:-3001}"
LOG_FILE="${SCRIPT_DIR}/server.log"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install --silent
fi

# Rebuild if source is newer than the dist bundle
NEEDS_BUILD=false
if [ ! -d "dist" ]; then
  NEEDS_BUILD=true
elif [ -n "$(find src -newer dist/index.html 2>/dev/null)" ]; then
  NEEDS_BUILD=true
fi

if $NEEDS_BUILD; then
  echo "Building production bundle..."
  npm run build --silent
  echo "Build complete."
fi

# Stop existing process on PORT
pids="$(lsof -ti ":${PORT}" 2>/dev/null || true)"
if [ -n "${pids}" ]; then
  echo "Stopping process(es) on port ${PORT}: ${pids}"
  kill ${pids} 2>/dev/null || true
  sleep 0.5
  pids="$(lsof -ti ":${PORT}" 2>/dev/null || true)"
  if [ -n "${pids}" ]; then
    echo "Force killing: ${pids}"
    kill -9 ${pids} 2>/dev/null || true
    sleep 0.2
  fi
fi

nohup node server.js >>"${LOG_FILE}" 2>&1 &
pid=$!
echo "Server started in background (PID ${pid})"
echo "  URL:  http://localhost:${PORT}"
echo "  Log:  ${LOG_FILE}"
echo "  Stop: kill ${pid}  or  npm run restart"
