# Caddy Migration (2026-03-23)

## Was wurde geaendert

### docker-compose.prod.yml
- `ports` bei `app` (${APP_PORT:-3320}:3000) entfernt — Caddy routet intern via Docker Network

### Vorher
Die App war ueber Host-Port 3320 erreichbar. Der Musikersuche-Nginx hat ueber
die Docker-Bridge-IP (172.17.0.1:3320) auf die App zugegriffen.

### Neues Setup
- Zentraler Caddy Reverse Proxy unter `/opt/caddy-proxy/`
- Override-Datei `docker-compose.caddy.yml` verbindet den `app` Service mit dem `caddy-proxy` Network
- Start mit: `docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d`
- Caddy erreicht den Container direkt ueber den Service-Namen im Docker Network (kein Host-Port noetig)
