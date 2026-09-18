#!/usr/bin/env bash
# IDUN Automated Node.js 24 Environment Bootstrapper for macOS / Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TOOLS_DIR="$ROOT_DIR/.idun/tools/node"

get_node_major() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    "$cmd" -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/'
  else
    echo "0"
  fi
}

SYSTEM_MAJOR=$(get_node_major "node")
if [ "$SYSTEM_MAJOR" -ge 24 ]; then
  exit 0
fi

if [ -x "$TOOLS_DIR/bin/node" ]; then
  LOCAL_MAJOR=$(get_node_major "$TOOLS_DIR/bin/node")
  if [ "$LOCAL_MAJOR" -ge 24 ]; then
    export PATH="$TOOLS_DIR/bin:$PATH"
    exit 0
  fi
fi

echo "========================================================="
echo "  IDUN: Node.js 24 is required system-wide."
echo "  Automated installer initializing..."
echo "========================================================="

# Try NVM if present
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
  echo "IDUN: Installing Node.js 24 via NVM..."
  nvm install 24
  nvm use 24
  exit 0
fi

# Try FNM if present
if command -v fnm >/dev/null 2>&1; then
  echo "IDUN: Installing Node.js 24 via FNM..."
  fnm install 24
  fnm use 24
  exit 0
fi

# Try Homebrew on macOS
if command -v brew >/dev/null 2>&1; then
  echo "IDUN: Installing Node.js 24 via Homebrew..."
  brew install node@24
  brew link --force --overwrite node@24 2>/dev/null || true
  exit 0
fi

# Fallback: Download official standalone tarball
echo "IDUN: Downloading standalone Node.js 24 runtime from nodejs.org..."
mkdir -p "$TOOLS_DIR"
ARCH="$(uname -m)"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"

if [ "$OS" = "darwin" ]; then
  if [ "$ARCH" = "arm64" ]; then
    TAR_URL="https://nodejs.org/dist/latest-v24.x/node-v24.21.0-darwin-arm64.tar.gz"
  else
    TAR_URL="https://nodejs.org/dist/latest-v24.x/node-v24.21.0-darwin-x64.tar.gz"
  fi
else
  if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    TAR_URL="https://nodejs.org/dist/latest-v24.x/node-v24.21.0-linux-arm64.tar.gz"
  else
    TAR_URL="https://nodejs.org/dist/latest-v24.x/node-v24.21.0-linux-x64.tar.gz"
  fi
fi

curl -fsSL "$TAR_URL" | tar -xz -C "$TOOLS_DIR" --strip-components=1
export PATH="$TOOLS_DIR/bin:$PATH"
echo "IDUN: Standalone Node.js 24 provisioned at $TOOLS_DIR."
exit 0
