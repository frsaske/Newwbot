#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# Fresh VPS/hosting clones may not have node_modules yet.
if [ ! -f node_modules/@hapi/boom/package.json ]; then
  echo "📦 Installing missing Node.js dependencies..."
  npm install --legacy-peer-deps
fi

# Do not start from the wrong directory or with an empty session path.
if [ ! -f sessions/session1/creds.json ] && [ ! -f sessions/session2/creds.json ] && [ ! -f sessions/session3/creds.json ] && [ ! -f sessions/session4/creds.json ] && [ ! -f sessions/session5/creds.json ]; then
  echo "❌ No creds.json found. Upload it to sessions/session1..session5 first."
  exit 1
fi

exec npm start
