# Deploying Spode Tree

The jarvis server (`dan@100.102.159.57`) runs both environments. Each is a git checkout
that pulls through a read-only deploy key (`~/.ssh/spode-tree-deploy`, host alias
`github-spode-tree`).

| Env  | Branch | Path                     | Port | Service            | URL                              |
| ---- | ------ | ------------------------ | ---- | ------------------ | -------------------------------- |
| PROD | `main` | `/opt/spode-tree`      | 4860 | `spode-tree`     | https://spode.dabrewer.dev     |
| DEV  | `dev`  | `/opt/spode-tree-dev`  | 4870 | `spode-tree-dev` | https://spode.dev.dabrewer.dev |

Each environment has its own SQLite DB at `data/spode.db (+ data/images/ for photos of pieces you add)`. Dev's `.env` holds
`JARVIS_ENV=dev`; prod has no `.env`, or one without that line.

## Tailnet-only

1. **DNS**: dev uses the `*.dev.dabrewer.dev` wildcard. Prod has an explicit **A record
   `spode` → `100.102.159.57`** (DNS-only). Both resolve to the Tailscale IP, so only
   tailnet devices can connect.
2. **nginx**: both server blocks carry `allow 100.64.0.0/10; allow 127.0.0.1; deny all;`, so a
   request that reaches the box any other way (for example from the LAN) gets a 403.
   The blocks are in [nginx.conf](nginx.conf).

## Native module (better-sqlite3)

The server's npm 12 blocks install scripts, so `npm install` does not compile
better-sqlite3. Both update scripts check that it loads and run `node-gyp rebuild`
in `node_modules/better-sqlite3` if not. Do the same after a Node major upgrade,
then restart the service.

## Workflow

```bash
git push origin dev
ssh dan@100.102.159.57 /opt/spode-tree-dev/deploy/update-dev.sh   # → DEV
# after an approved dev→main PR is merged:
ssh dan@100.102.159.57 /opt/spode-tree/deploy/update.sh           # → PROD
```

## First-time setup (per environment)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/spode-tree-deploy -N "" -C "spode-tree deploy (jarvis-server)"
gh repo deploy-key add ~/.ssh/spode-tree-deploy.pub -R BrewerIndustries/spode-tree -t jarvis-server
# ~/.ssh/config:  Host github-spode-tree / HostName github.com / User git /
#                 IdentityFile ~/.ssh/spode-tree-deploy / IdentitiesOnly yes

sudo mkdir -p /opt/spode-tree && sudo chown dan:dan /opt/spode-tree
git clone -b main github-spode-tree:BrewerIndustries/spode-tree.git /opt/spode-tree
cd /opt/spode-tree && npm install && npm run build      # as dan, never sudo
(cd node_modules/better-sqlite3 && npx --yes node-gyp rebuild --release)   # npm 12 skips this
sudo cp deploy/spode-tree.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl enable --now spode-tree
# nginx: append the prod block from deploy/nginx.conf → sudo nginx -t && sudo systemctl reload nginx
# DNS (prod only): A spode → 100.102.159.57, proxied:false (Cloudflare API, token in /etc/cloudflare/credentials.ini)
```
