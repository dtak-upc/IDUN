#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "========================================================="
echo "  IDUN: Automatic Environment & Dependency Setup"
echo "========================================================="

echo "[1/3] Checking / Installing Node.js 24..."
if [ -f "scripts/ensure-node.sh" ]; then
  bash scripts/ensure-node.sh
fi

echo ""
echo "[2/3] Installing NPM web dependencies..."
npm install

echo ""
echo "[3/3] Setting up Python virtual environment and uv..."
node scripts/start-local.cjs --setup-only

echo ""
echo "========================================================="
echo "  Setup successfully completed!"
echo "  Run './Start IDUN.command' to launch the workspace."
echo "========================================================="
