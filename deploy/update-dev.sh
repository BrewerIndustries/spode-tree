#!/usr/bin/env bash
# Pull latest dev and redeploy Spode Tree (spode-tree-dev, :4870) on the jarvis server.
# From your Mac:  ssh dan@100.102.159.57 /opt/spode-tree-dev/deploy/update-dev.sh
set -euo pipefail

cd /opt/spode-tree-dev

# npm install on Linux rewrites the macOS-generated lockfile; discard that churn
# so the fast-forward pull can't abort.
git checkout -- package-lock.json 2>/dev/null || true

echo "→ fetching latest dev…"
git pull --ff-only

echo "→ installing deps…"          # npm install (not ci): lockfile is macOS-generated
npm install

# npm 12 blocks install scripts not listed in allowScripts, so better-sqlite3's
# native build is skipped on a fresh install or version bump. Compile it directly
# if it doesn't load under the current Node.
if ! node -e 'new (require("better-sqlite3"))(":memory:")' 2>/dev/null; then
  echo "→ compiling better-sqlite3 for $(node -v)…"
  (cd node_modules/better-sqlite3 && npx --yes node-gyp rebuild --release)
fi

echo "→ building…"
npm run build

echo "→ restarting spode-tree-dev…"
sudo systemctl restart spode-tree-dev

for i in $(seq 1 20); do
  curl -sf http://localhost:4870/api/health >/dev/null && break
  sleep 1
done
echo "✓ deployed $(git log -1 --pretty='%h %s') — $(systemctl is-active spode-tree-dev) on :4870, health $(curl -s http://localhost:4870/api/health)"
