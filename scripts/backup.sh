#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
ENV_FILE=".env.prod"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; AMBER='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[backup]${NC} $*"; }
warn()  { echo -e "${AMBER}[backup]${NC} $*"; }
error() { echo -e "${RED}[backup]${NC} $*" >&2; }

# ── Check ────────────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  error "$ENV_FILE not found. Is this a production deployment?"
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

mkdir -p "$BACKUP_DIR"

# ── PostgreSQL Dump ──────────────────────────────────────────────────────────
DB_BACKUP="$BACKUP_DIR/gp200-db-${TIMESTAMP}.sql.gz"
info "Backing up PostgreSQL..."
$COMPOSE exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-gp200}" \
  -d "${POSTGRES_DB:-gp200}" \
  --clean --if-exists \
  | gzip > "$DB_BACKUP"

DB_SIZE=$(du -h "$DB_BACKUP" | cut -f1)
info "Database backup: $DB_BACKUP ($DB_SIZE)"

# ── Garage S3 Data ───────────────────────────────────────────────────────────
S3_BACKUP="$BACKUP_DIR/gp200-garage-${TIMESTAMP}.tar.gz"
info "Backing up Garage S3 data..."

# Stop garage briefly for consistent snapshot
$COMPOSE stop garage
docker run --rm \
  -v gp200editor_garage_data:/data \
  -v gp200editor_garage_meta:/meta \
  -v "$(pwd)/$BACKUP_DIR":/backup \
  alpine tar czf "/backup/gp200-garage-${TIMESTAMP}.tar.gz" -C / data meta
$COMPOSE start garage

S3_SIZE=$(du -h "$S3_BACKUP" | cut -f1)
info "Garage backup: $S3_BACKUP ($S3_SIZE)"

# ── Env File Backup ─────────────────────────────────────────────────────────
ENV_BACKUP="$BACKUP_DIR/gp200-env-${TIMESTAMP}.enc"
info "Backing up .env.prod (encrypted)..."
if command -v openssl &>/dev/null; then
  openssl enc -aes-256-cbc -pbkdf2 -salt -in "$ENV_FILE" -out "$ENV_BACKUP" 2>/dev/null && \
    info "Env backup (encrypted): $ENV_BACKUP" || {
      # If interactive password fails (non-interactive), just copy
      cp "$ENV_FILE" "$BACKUP_DIR/gp200-env-${TIMESTAMP}.bak"
      info "Env backup (plain): $BACKUP_DIR/gp200-env-${TIMESTAMP}.bak"
    }
else
  cp "$ENV_FILE" "$BACKUP_DIR/gp200-env-${TIMESTAMP}.bak"
  warn "openssl not found — env backed up as plaintext"
fi

# ── Cleanup old backups (keep last 7) ────────────────────────────────────────
KEEP=7
for prefix in "gp200-db-" "gp200-garage-" "gp200-env-"; do
  COUNT=$(ls -1 "$BACKUP_DIR"/${prefix}* 2>/dev/null | wc -l)
  if [ "$COUNT" -gt "$KEEP" ]; then
    ls -1t "$BACKUP_DIR"/${prefix}* | tail -n +$((KEEP + 1)) | xargs rm -f
    info "Cleaned old ${prefix}* backups (kept last $KEEP)"
  fi
done

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
info "========================================="
info " Backup complete: $TIMESTAMP"
info " Database: $DB_BACKUP ($DB_SIZE)"
info " Garage:   $S3_BACKUP ($S3_SIZE)"
info " Dir:      $BACKUP_DIR/"
info "========================================="
