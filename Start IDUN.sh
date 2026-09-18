#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1

if [ -f "scripts/ensure-node.sh" ]; then
  bash scripts/ensure-node.sh
  if [ $? -ne 0 ]; then
    echo "IDUN: Automated Node.js 24 initialization failed."
    echo "Please install Node.js 24 manually from https://nodejs.org"
    exit 1
  fi
fi

exec node scripts/start-local.cjs --open "$@"
