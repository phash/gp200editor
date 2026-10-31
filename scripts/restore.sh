#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
ENV_FILE=".env.prod"
BACKUP_DIR="./backups"

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; AMBER='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[restore]${NC} $*"; }
warn()  { echo -e "${AMBER}[restore]${NC} $*"; }
error() { echo -e "${RED}[restore]${NC} $*" >&2; }

# ── Usage ────────────────────────────────────────────────────────────────────
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  echo "Usage: $0 [TIMESTAMP]"
  echo ""
  echo "Restores database and Garage data from a backup."
  echo "If TIMESTAMP is omitted, uses the most recent backup."
  echo ""
  echo "Available backups:"
  ls -1t "$BACKUP_DIR"/gp200-db-*.sql.gz 2>/dev/null | head -5 | sed 's|.*/gp200-db-||;s|\.sql\.gz||' | while read -r ts; do
    echo "  $ts"
  done
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  error "$ENV_FILE not found."
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

# ── Find backup ──────────────────────────────────────────────────────────────
if [ -n "${1:-}" ]; then
  TIMESTAMP="$1"
else
  LATEST=$(ls -1t "$BACKUP_DIR"/gp200-db-*.sql.gz 2>/dev/null | head -1)
  if [ -z "$LATEST" ]; then
    error "No backups found in $BACKUP_DIR/"
    exit 1
  fi
  TIMESTAMP=$(basename "$LATEST" | sed 's/gp200-db-//;s/\.sql\.gz//')
fi

DB_BACKUP="$BACKUP_DIR/gp200-db-${TIMESTAMP}.sql.gz"
S3_BACKUP="$BACKUP_DIR/gp200-garage-${TIMESTAMP}.tar.gz"

if [ ! -f "$DB_BACKUP" ]; then
  error "Database backup not found: $DB_BACKUP"
  exit 1
fi

warn "This will OVERWRITE the current database and Garage data!"
warn "Restoring from: $TIMESTAMP"
read -rp "Continue? [y/N] " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

# ── Stop app ─────────────────────────────────────────────────────────────────
info "Stopping app..."
$COMPOSE stop app

# ── Restore Database ─────────────────────────────────────────────────────────
info "Restoring database from $DB_BACKUP..."
gunzip -c "$DB_BACKUP" | $COMPOSE exec -T postgres psql \
  -U "${POSTGRES_USER:-gp200}" \
  -d "${POSTGRES_DB:-gp200}" \
  --quiet
info "Database restored."

# ── Restore Garage ───────────────────────────────────────────────────────────
if [ -f "$S3_BACKUP" ]; then
  info "Restoring Garage data from $S3_BACKUP..."
  $COMPOSE stop garage
  docker run --rm \
    -v gp200editor_garage_data:/data \
    -v gp200editor_garage_meta:/meta \
    -v "$(pwd)/$BACKUP_DIR":/backup \
    alpine sh -c "rm -rf /data/* /meta/* && tar xzf /backup/gp200-garage-${TIMESTAMP}.tar.gz -C /"
  $COMPOSE start garage
  info "Garage data restored."
else
  warn "Garage backup not found: $S3_BACKUP — skipping S3 restore"
fi

# ── Restart ──────────────────────────────────────────────────────────────────
info "Starting app..."
$COMPOSE start app

echo ""
info "========================================="
info " Restore complete from: $TIMESTAMP"
info "========================================="
