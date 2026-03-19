#!/usr/bin/env bash
set -euo pipefail

# GP-200 Editor — VPS Deployment Script
# Prerequisites:
#   - Domain preset-forge.com DNS points to this VPS
#   - Musikersuche stack running with Nginx on ports 80/443
#   - Run as user with docker access (e.g. musikersuche@ubuntu)
#
# Usage:
#   ssh musikersuche@<vps-ip>
#   cd /opt
#   git clone https://github.com/phash/gp200editor.git
#   cd gp200editor
#   bash scripts/deploy-vps.sh

DOMAIN="preset-forge.com"
APP_PORT=3320
INSTALL_DIR="/opt/gp200editor"
MUSIKERSUCHE_DIR="/opt/musikersuche"
DOCKER_BRIDGE_IP="172.17.0.1"

RED='\033[0;31m'; GREEN='\033[0;32m'; AMBER='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${AMBER}[deploy]${NC} $*"; }
error() { echo -e "${RED}[deploy]${NC} $*" >&2; }

cd "$INSTALL_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# Step 1: Create .env.prod
# ══════════════════════════════════════════════════════════════════════════════
if [ ! -f .env.prod ]; then
  info "Creating .env.prod..."
  PG_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
  cat > .env.prod <<ENVEOF
APP_PORT=${APP_PORT}
NEXT_PUBLIC_APP_URL=https://${DOMAIN}

POSTGRES_USER=gp200prod
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=gp200prod
DATABASE_URL=postgresql://gp200prod:${PG_PASS}@postgres:5432/gp200prod

GARAGE_ENDPOINT=http://garage:3900
GARAGE_ACCESS_KEY_ID=
GARAGE_SECRET_ACCESS_KEY=
GARAGE_BUCKET=avatars
GARAGE_PRESET_BUCKET=presets

EMAIL_FROM=noreply@${DOMAIN}
EMAIL_SMTP_HOST=mailhog
EMAIL_SMTP_PORT=1025
EMAIL_SMTP_USER=
EMAIL_SMTP_PASS=
ENVEOF
  info "Generated .env.prod with random Postgres password"
else
  info ".env.prod already exists, keeping it"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Step 2: Build and start GP-200 stack
# ══════════════════════════════════════════════════════════════════════════════
info "Building Docker images..."
docker compose -f docker-compose.prod.yml --env-file .env.prod build

info "Starting Postgres + Garage + Mailhog..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d postgres garage mailhog

info "Waiting for Postgres..."
until docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U gp200prod &>/dev/null; do sleep 1; done
info "Postgres ready."

# ══════════════════════════════════════════════════════════════════════════════
# Step 3: Run database migrations
# ══════════════════════════════════════════════════════════════════════════════
info "Running Prisma migrations..."
# Use a temporary app container to run migrations
source .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
  app npx prisma migrate deploy
info "Migrations complete."

# ══════════════════════════════════════════════════════════════════════════════
# Step 4: Initialize Garage S3 (first run only)
# ══════════════════════════════════════════════════════════════════════════════
sleep 3  # give Garage time to start
GARAGE_KEY_EXISTS=$(docker compose -f docker-compose.prod.yml exec -T garage /garage key list 2>/dev/null | grep -c "gp200editor-key" || true)

if [ "$GARAGE_KEY_EXISTS" -eq 0 ]; then
  info "Initializing Garage S3..."
  NODE_ID=$(docker compose -f docker-compose.prod.yml exec -T garage /garage node id 2>/dev/null | head -1 | awk '{print $1}')
  docker compose -f docker-compose.prod.yml exec -T garage /garage layout assign --zone dc1 --capacity 1G "$NODE_ID"
  docker compose -f docker-compose.prod.yml exec -T garage /garage layout apply --version 1
  docker compose -f docker-compose.prod.yml exec -T garage /garage key create gp200editor-key
  docker compose -f docker-compose.prod.yml exec -T garage /garage bucket create avatars
  docker compose -f docker-compose.prod.yml exec -T garage /garage bucket allow avatars --read --write --key gp200editor-key
  docker compose -f docker-compose.prod.yml exec -T garage /garage bucket create presets
  docker compose -f docker-compose.prod.yml exec -T garage /garage bucket allow presets --read --write --key gp200editor-key

  KEY_INFO=$(docker compose -f docker-compose.prod.yml exec -T garage /garage key info gp200editor-key 2>/dev/null)
  ACCESS_KEY=$(echo "$KEY_INFO" | grep "Key ID" | awk '{print $NF}')
  SECRET_KEY=$(echo "$KEY_INFO" | grep "Secret key" | awk '{print $NF}')

  if [ -n "$ACCESS_KEY" ] && [ -n "$SECRET_KEY" ]; then
    sed -i "s|^GARAGE_ACCESS_KEY_ID=.*|GARAGE_ACCESS_KEY_ID=$ACCESS_KEY|" .env.prod
    sed -i "s|^GARAGE_SECRET_ACCESS_KEY=.*|GARAGE_SECRET_ACCESS_KEY=$SECRET_KEY|" .env.prod
    info "Garage credentials saved to .env.prod"
  else
    error "Could not extract Garage credentials!"
    echo "$KEY_INFO"
  fi
else
  info "Garage already initialized."
fi

# ══════════════════════════════════════════════════════════════════════════════
# Step 5: Start the app
# ══════════════════════════════════════════════════════════════════════════════
info "Starting GP-200 Editor app on port ${APP_PORT}..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d app

info "Waiting for app..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${APP_PORT}/" >/dev/null 2>&1; then break; fi
  sleep 1
done

if ! curl -sf "http://localhost:${APP_PORT}/" >/dev/null 2>&1; then
  error "App not responding! Check: docker compose -f docker-compose.prod.yml logs app"
  exit 1
fi
info "App is running on port ${APP_PORT}."

# ══════════════════════════════════════════════════════════════════════════════
# Step 6: SSL certificate via Musikersuche Certbot
# ══════════════════════════════════════════════════════════════════════════════
CERT_DIR="${MUSIKERSUCHE_DIR}/certbot/conf/live/${DOMAIN}"
if [ ! -d "$CERT_DIR" ]; then
  info "Requesting SSL certificate for ${DOMAIN}..."
  docker exec musikersuche-certbot certbot certonly \
    --webroot -w /var/www/certbot \
    -d "${DOMAIN}" -d "www.${DOMAIN}" \
    --non-interactive --agree-tos \
    --email admin@phash.de \
    || {
      warn "Certbot failed. Make sure DNS for ${DOMAIN} points to this server."
      warn "You can retry manually:"
      echo "  docker exec musikersuche-certbot certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN}"
    }
else
  info "SSL certificate already exists for ${DOMAIN}."
fi

# ══════════════════════════════════════════════════════════════════════════════
# Step 7: Add Nginx vhost to Musikersuche
# ══════════════════════════════════════════════════════════════════════════════
NGINX_CONF="${MUSIKERSUCHE_DIR}/nginx/nginx.conf"
if ! grep -q "${DOMAIN}" "$NGINX_CONF" 2>/dev/null; then
  info "Adding ${DOMAIN} vhost to Musikersuche Nginx..."

  # Insert before the final closing brace of http {}
  VHOST_BLOCK="
    # ── ${DOMAIN} (GP-200 Preset Editor) ──────────────────
    server {
        listen 80;
        server_name ${DOMAIN} www.${DOMAIN};
        location /.well-known/acme-challenge/ { root /var/www/certbot; }
        location / { return 301 https://\\\$host\\\$request_uri; }
    }

    server {
        listen 443 ssl;
        http2 on;
        server_name ${DOMAIN} www.${DOMAIN};

        ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        client_max_body_size 10M;

        add_header Strict-Transport-Security \"max-age=63072000; includeSubDomains\" always;
        add_header X-Frame-Options \"SAMEORIGIN\" always;
        add_header X-Content-Type-Options \"nosniff\" always;

        location / {
            proxy_pass http://${DOCKER_BRIDGE_IP}:${APP_PORT};
            proxy_http_version 1.1;
            proxy_set_header Host \\\$host;
            proxy_set_header X-Real-IP \\\$remote_addr;
            proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \\\$scheme;
            proxy_set_header Upgrade \\\$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_cache_bypass \\\$http_upgrade;
        }
    }
"

  # Backup original
  cp "$NGINX_CONF" "${NGINX_CONF}.bak.$(date +%Y%m%d-%H%M%S)"

  # Insert before last closing brace
  sed -i "$ i\\${VHOST_BLOCK}" "$NGINX_CONF"

  info "Reloading Musikersuche Nginx..."
  docker exec musikersuche-nginx nginx -t && \
    docker exec musikersuche-nginx nginx -s reload && \
    info "Nginx reloaded successfully." || \
    error "Nginx config test failed! Check ${NGINX_CONF}"
else
  info "${DOMAIN} vhost already in Nginx config."
fi

# ══════════════════════════════════════════════════════════════════════════════
# Done
# ══════════════════════════════════════════════════════════════════════════════
echo ""
info "════════════════════════════════════════════════════"
info " GP-200 Editor deployed!"
info " URL:   https://${DOMAIN}"
info " Port:  ${APP_PORT} (internal)"
info " Stack: docker compose -f docker-compose.prod.yml --env-file .env.prod"
info " Logs:  docker compose -f docker-compose.prod.yml logs -f app"
info "════════════════════════════════════════════════════"
