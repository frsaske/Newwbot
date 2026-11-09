#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ is required. Install Node.js first."
  exit 1
fi

node -e 'const major=Number(process.versions.node.split(".")[0]); if (major < 18) { console.error("Node.js 18+ is required"); process.exit(1); }'

mkdir -p sessions/session1 data temp

# Backward-compatible migration for old deployments.
if [ -f session/creds.json ] && [ ! -f sessions/session1/creds.json ]; then
  mv session/creds.json sessions/session1/creds.json
  rmdir session 2>/dev/null || true
fi

npm install --legacy-peer-deps
chmod +x start-vps.sh

echo "Setup complete. Start the bot with: ./start-vps.sh"

if [ -f sessions/session1/creds.json ]; then
  echo "Session detected: sessions/session1/creds.json"
else
  echo "No session credentials found. Add sessions/session1/creds.json before starting."
fi
''
