#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
ENV_FILE=".env.prod"

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; AMBER='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${AMBER}[deploy]${NC} $*"; }
error() { echo -e "${RED}[deploy]${NC} $*" >&2; }

# ── Check prerequisites ─────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  error "Docker not found. Install Docker first."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  warn ".env.prod not found. Creating from template..."
  cp .env.prod.example "$ENV_FILE"
  error "Please edit $ENV_FILE with your settings, then re-run this script."
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

if [ -z "${POSTGRES_PASSWORD:-}" ] || [ "${POSTGRES_PASSWORD:-}" = "CHANGE_ME_STRONG_PASSWORD" ]; then
  error "POSTGRES_PASSWORD not set or still default in $ENV_FILE. Please change it."
  exit 1
fi

# ── Build & Start ────────────────────────────────────────────────────────────
info "Building Docker images..."
$COMPOSE build

info "Starting services..."
$COMPOSE up -d postgres garage mailhog

info "Waiting for PostgreSQL to be ready..."
until $COMPOSE exec -T postgres pg_isready -U "${POSTGRES_USER:-gp200}" &>/dev/null; do
  sleep 1
done
info "PostgreSQL is ready."

# ── Database Migration ───────────────────────────────────────────────────────
info "Running Prisma migrations..."
$COMPOSE run --rm -e DATABASE_URL="postgresql://${POSTGRES_USER:-gp200}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-gp200}" \
  app npx prisma migrate deploy 2>&1 || {
    warn "Migration via app container failed, trying with local npx..."
    DATABASE_URL="postgresql://${POSTGRES_USER:-gp200}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB:-gp200}" \
      npx prisma migrate deploy
  }
info "Database up to date."

# ── Garage S3 Init (first run only) ─────────────────────────────────────────
GARAGE_KEY_EXISTS=$($COMPOSE exec -T garage /garage key list 2>/dev/null | grep -c "gp200editor-key" || true)

if [ "$GARAGE_KEY_EXISTS" -eq 0 ]; then
  info "First run detected — initializing Garage S3..."

  info "Getting Garage node ID..."
  NODE_ID=$($COMPOSE exec -T garage /garage node id 2>/dev/null | awk 'NR==1{print $1}')

  info "Assigning layout..."
  $COMPOSE exec -T garage /garage layout assign --zone dc1 --capacity 1G "$NODE_ID"
  $COMPOSE exec -T garage /garage layout apply --version 1

  info "Creating access key..."
  $COMPOSE exec -T garage /garage key create gp200editor-key

  info "Creating buckets..."
  $COMPOSE exec -T garage /garage bucket create avatars
  $COMPOSE exec -T garage /garage bucket allow avatars --read --write --key gp200editor-key
  $COMPOSE exec -T garage /garage bucket create presets
  $COMPOSE exec -T garage /garage bucket allow presets --read --write --key gp200editor-key

  # Extract and update credentials in .env.prod
  KEY_INFO=$($COMPOSE exec -T garage /garage key info gp200editor-key 2>/dev/null)
  ACCESS_KEY=$(echo "$KEY_INFO" | grep "Key ID" | awk '{print $NF}')
  SECRET_KEY=$(echo "$KEY_INFO" | grep "Secret key" | awk '{print $NF}')

  if [ -n "$ACCESS_KEY" ] && [ -n "$SECRET_KEY" ]; then
    sed -i "s|^GARAGE_ACCESS_KEY_ID=.*|GARAGE_ACCESS_KEY_ID=$ACCESS_KEY|" "$ENV_FILE"
    sed -i "s|^GARAGE_SECRET_ACCESS_KEY=.*|GARAGE_SECRET_ACCESS_KEY=$SECRET_KEY|" "$ENV_FILE"
    info "Garage credentials written to $ENV_FILE"
  else
    warn "Could not extract Garage credentials. Run manually:"
    echo "$KEY_INFO"
  fi
else
  info "Garage already initialized (key exists)."
fi

# ── Start App ────────────────────────────────────────────────────────────────
info "Starting app..."
$COMPOSE up -d app

info "Waiting for app to respond..."
APP_PORT="${APP_PORT:-3320}"
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${APP_PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if curl -sf "http://localhost:${APP_PORT}/" >/dev/null 2>&1; then
  echo ""
  info "========================================="
  info " GP-200 Editor deployed successfully!"
  info " URL: http://localhost:${APP_PORT}"
  info " Mailhog: http://localhost:8025"
  info "========================================="
else
  warn "App started but not responding yet. Check logs:"
  echo "  $COMPOSE logs app"
fi
