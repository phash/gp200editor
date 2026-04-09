#!/usr/bin/env bash
set -euo pipefail

# GP-200 Editor — Update Deployment
# Usage:
#   cd /opt/gp200editor
#   bash scripts/deploy-update.sh
#
# Pulls latest code, rebuilds the app, runs migrations automatically on startup.

INSTALL_DIR="/opt/gp200editor"
COMPOSE_FILES="-f docker-compose.prod.yml"

# Use Caddy override if present (no host ports, routed via Docker network)
if [ -f docker-compose.caddy.yml ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.caddy.yml"
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; AMBER='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${AMBER}[deploy]${NC} $*"; }
error() { echo -e "${RED}[deploy]${NC} $*" >&2; }

cd "$INSTALL_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# Step 1: Pull latest code
# ══════════════════════════════════════════════════════════════════════════════
info "Pulling latest code..."
git pull

# ══════════════════════════════════════════════════════════════════════════════
# Step 2: Tag previous image for rollback, then rebuild
# ══════════════════════════════════════════════════════════════════════════════
PREV_IMAGE=$(docker compose $COMPOSE_FILES images app -q 2>/dev/null | head -1 || true)
if [ -n "$PREV_IMAGE" ]; then
  info "Tagging previous image for rollback: $PREV_IMAGE"
  docker tag "$PREV_IMAGE" gp200editor-app:previous 2>/dev/null || true
fi

info "Rebuilding app container..."
docker compose $COMPOSE_FILES --env-file .env.prod build app

info "Restarting app (migrations run automatically on startup)..."
docker compose $COMPOSE_FILES --env-file .env.prod up -d app

# ══════════════════════════════════════════════════════════════════════════════
# Step 3: Wait for app to be ready
# ══════════════════════════════════════════════════════════════════════════════
info "Waiting for app..."
APP_CONTAINER=$(docker compose $COMPOSE_FILES ps -q app 2>/dev/null | head -1)
for i in $(seq 1 60); do
  # Check via docker exec using node (always available in node:alpine)
  if docker exec "$APP_CONTAINER" node -e "require('http').get('http://localhost:3000/',r=>{process.exit(r.statusCode<400?0:1)}).on('error',()=>process.exit(1))" 2>/dev/null; then break; fi
  sleep 1
done

if docker exec "$APP_CONTAINER" node -e "require('http').get('http://localhost:3000/',r=>{process.exit(r.statusCode<400?0:1)}).on('error',()=>process.exit(1))" 2>/dev/null; then
  info "App is running."
else
  error "App not responding after 60s!"
  if docker image inspect gp200editor-app:previous >/dev/null 2>&1; then
    warn "Rolling back to previous image..."
    docker compose $COMPOSE_FILES --env-file .env.prod stop app
    docker tag gp200editor-app:previous gp200editor-app:latest 2>/dev/null || true
    docker compose $COMPOSE_FILES --env-file .env.prod up -d app
    warn "Rolled back. Check logs: docker compose $COMPOSE_FILES logs --tail 50 app"
  else
    echo "  No previous image available. Check logs:"
    echo "  docker compose $COMPOSE_FILES logs --tail 50 app"
  fi
  exit 1
fi

# ══════════════════════════════════════════════════════════════════════════════
# Done
# ══════════════════════════════════════════════════════════════════════════════
info "════════════════════════════════════════════════════"
info " Update deployed!"
info " Logs: docker compose $COMPOSE_FILES logs -f app"
info "════════════════════════════════════════════════════"
