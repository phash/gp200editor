# Deployment & Infrastruktur

## Docker / Dev-Infrastruktur

```bash
# 1. Env-Datei erstellen
cp .env.dev.example .env.dev   # Credentials eintragen

# 2. Alle Services starten (PostgreSQL 16, Garage S3, Mailhog)
docker compose --env-file .env.dev up -d --build

# 3. Garage initialisieren (einmalig nach erstem Start)
bash scripts/garage-init.sh
# → gibt GARAGE_ACCESS_KEY_ID und GARAGE_SECRET_ACCESS_KEY aus → in .env.dev eintragen
# → App-Container neustarten: docker compose --env-file .env.dev up -d app

# 4. Datenbankmigrationen
DATABASE_URL="postgresql://USER:PASS@localhost:5433/DB" npx prisma migrate dev

# 5. App starten (ohne Docker)
npm run dev
```

## Umgebungsvariablen (`.env.local`)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gp200

# Garage Object Store — run scripts/garage-init.sh once to get these values
GARAGE_ENDPOINT=http://localhost:3900
GARAGE_ACCESS_KEY_ID=<from garage-init.sh output>
GARAGE_SECRET_ACCESS_KEY=<from garage-init.sh output>
GARAGE_BUCKET=avatars
GARAGE_PRESET_BUCKET=presets
GARAGE_AUDIO_BUCKET=gp200editor-audio-dev

# Email (Mailhog in dev)
EMAIL_FROM=noreply@gp200editor.local
EMAIL_SMTP_HOST=localhost
EMAIL_SMTP_PORT=1025
EMAIL_SMTP_USER=
EMAIL_SMTP_PASS=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Production Deployment (IONOS VPS)

```bash
# Auf dem VPS (preset-forge.com → 82.165.40.140):
cd /opt
git clone https://github.com/phash/gp200editor.git
cd gp200editor
cp .env.prod.example .env.prod   # Secrets eintragen
# Reverse Proxy: vhost für preset-forge.com im zentralen Caddyfile anlegen (siehe unten)
# Hinweis: scripts/deploy-vps.sh stammt aus dem alten Nginx/Certbot-Setup und ist veraltet

# Updates deployen:
cd /opt/gp200editor
bash scripts/deploy-update.sh    # git pull → build → restart (Migrations laufen automatisch)
```

### VPS-Architektur

- GP-200 Stack aus `docker-compose.prod.yml`: `app` (Container `gp200editor-app`), `postgres`, `garage` — **kein Host-Port** (seit der Caddy-Migration, siehe `CADDY-MIGRATION.md`)
- Zentraler **Caddy** Reverse Proxy (Container `caddy-proxy`, ports 80/443) erreicht die App über das externe Docker-Network `caddy-proxy` per Service-Namen; TLS-Zertifikate holt Caddy automatisch
- Caddy-Config: `/opt/caddyserver/Caddyfile` (Reload: `docker restart caddy-proxy`); `preset-forge.com` leitet per 301 auf `www.preset-forge.com` weiter. Security-Header für Preset Forge stehen inline im `www.preset-forge.com`-Block (nicht im shared Snippet); **CSP setzt ausschließlich Next.js**
- `docker-compose.caddy.yml` (nur auf dem VPS, nicht im Repo) wird von `deploy-update.sh` automatisch mitgenommen, falls vorhanden
- `scripts/deploy-update.sh` für Updates (git pull → build → restart); wartet bis 60 s auf `GET /api/health` = 200, sonst Rollback auf `gp200editor-app:previous`
- Healthcheck: Docker prüft `app` alle 30 s über `/api/health` (DB + Garage) — Status in `docker compose ps` (`healthy`/`unhealthy`). Extern: `curl -fsS https://www.preset-forge.com/api/health`
- `scripts/backup.sh` / `scripts/restore.sh` für DB + S3 Backups
  - Ziel: `/opt/gp200editor/backups/` (DB-Dump, Garage-Tarball, `.env.prod`), behält die letzten 7 je Typ. Garage stoppt für den Snapshot ein paar Sekunden
  - Cron (User `musikersuche`): `30 4 * * * bash /opt/gp200editor/scripts/backup.sh >> /opt/backup/gp200editor/backup.log 2>&1` — mit `bash` aufrufen, nicht direkt: `git pull` setzt die Dateirechte auf den Repo-Stand, und bis 2026-10-31 war `backup.sh` dort nicht ausführbar (165 Läufe mit `Permission denied`, kein einziges DB-Backup)
  - Prüfen: `ls -lt /opt/gp200editor/backups | head` und `tail /opt/backup/gp200editor/backup.log`

### Dockerfile-Details

- Basis-Image: `node:22-alpine` (drei Stages: deps → builder → runner)
- `output: 'standalone'` in `next.config.mjs` für Docker-kompatiblen Build
- `@node-rs/argon2` in `serverComponentsExternalPackages` (native binary)
- Non-root User `nextjs:nodejs` (UID/GID 1001)
- `public/.gitkeep` nötig (leerer Ordner wird sonst nicht von Git getrackt → COPY fehlschlägt)
- `docker-entrypoint.sh` führt `prisma migrate deploy` automatisch vor App-Start aus
- Prisma CLI wird global im Runner installiert (`npm install -g prisma@5.22.0`)

## Hardware-Testing (Web MIDI)

```bash
# Vor jedem Hardware-Test: valeton-windows Container stoppen!
# Läuft im Hintergrund (dockur/windows) und löst selbstständig Firmware-Updates aus
docker stop valeton-windows

# App für Hardware-Test starten
docker build -t gp200editor . && docker rm -f gp200editor && docker run -d -p 3000:3000 --name gp200editor --env-file .env.local gp200editor
```

- Web MIDI funktioniert nur in Chrome/Edge (kein Firefox, kein Safari)
- Playwright-Browser hat Zugriff auf echte MIDI-Geräte des Hosts
- `loadPresetNames` läuft als async Loop im Browser-JS — überlebt Navigation/Reload wenn nicht abgebrochen
  → Fix: `namesLoadAbortRef` in `useMidiDevice.ts` + `disconnect()` im Editor-Cleanup-`useEffect`
- **Nie `loadPresetNames` ohne Abbruchmechanismus laufen lassen** — sendet bis zu 256×3s SysEx-Requests,
  kann unerwartete Gerätereaktionen auslösen (beobachtet: Firmware-Update-Popup am GP-200)

### Capture-Workflow

```bash
# 1. Einmalig (falls noch nicht in wireshark-Gruppe)
sudo usermod -aG wireshark manuel   # dann neu einloggen
sudo modprobe usbmon

# 2. Gerät anschließen, Bus identifizieren
lsusb | grep -i valeton
# → z.B. "Bus 003 Device 007" → usbmon3

# 3. Capture starten (tshark ist installiert)
tshark -i usbmon3 -w gp200-capture.pcap

# 4. Offizielle Valeton-Software unter Wine starten
wine ~/.wine/drive_c/Program\ Files/Valeton/GP-200/GP-200.exe

# 5. Im Valeton-Editor: "Vom Gerät laden" + "Auf Gerät speichern" ausführen
# 6. Capture stoppen, SysEx-Pakete analysieren (beginnen mit F0, enden mit F7)
```

### Captures (Windows, 2026-03-19)

| Datei | Bytes | Inhalt |
|-------|-------|--------|
| 100548 | 8988 | Toggle FX + Save to Slot |
| 101538 | 14964 | Toggle + Reorder + Effect Change + Save |
| 101714 | 49680 | Param Change + Effect Change + Reorder + Toggle |
| 102448 | 23M | DLY Ping Pong: alle Knobs 0→max + Sync/Trail Buttons |
| 102857 | 22M | AMP Mess4 LD: alle 6 Knobs 0→max |
| 103852 | 46M | Patch Settings (VOL/PAN/Tempo) + Controller Settings |
| 104211 | 170M | EXP 1/2 Settings + Quick Access Para + FX Loop |
| 104836 | 22M | Edit Info: Author "Manuel R", Style "Gnorki", Note "Das ist ein Note" |
| 105520 | 22M | Drum-Computer: BPM ändern, Pattern wechseln, Play/Stop |
| 105713 | 27KB | IR Upload (Timeout — 23 Chunks gesendet, keine Antwort) |

### Captures (Windows, 2026-03-24)

| Datei | Bytes | Inhalt |
|-------|-------|--------|
| 084047 | — | State-Dump Slot 13 (04-B), Knob-Notification Verifizierung |
| 084156 | — | State-Dump Slot 0 (01-A), Baseline |
| 085205 | — | D→H Knob-Notifications: AMP alle 6 Knobs + VOL, je 0→100→~50 |

---

## Verify-Reminder Cron

A system-cron entry on the VPS hits `POST /api/cron/verify-reminders` hourly to fire Day-2 and Day-7 reminder mails for users who never verified their email. The cron route is idempotent (each user gets each reminder at most once via a race-safe `updateMany`-claim), so missing a tick is harmless.

### Setup (once per environment)

```bash
# 1. Generate the secret on the VPS
ssh musikersuche@82.165.40.140
openssl rand -hex 32
# → copy the 64-char hex output

# 2. Add to .env.prod
echo "CRON_SECRET=<value>" >> /opt/gp200editor/.env.prod
chmod 600 /opt/gp200editor/.env.prod   # lock to owner-read only

# 3. Restart so the app loads the env var
cd /opt/gp200editor && bash scripts/deploy-update.sh

# 4. Install the crontab entry (musikersuche user)
crontab -e
```

Add this to the crontab (`crontab -e`):

```cron
# Verify-reminder cron — runs hourly
CRON_SECRET=<paste the 64-char hex value here>
0 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://www.preset-forge.com/api/cron/verify-reminders >> /opt/gp200editor/logs/cron-verify-reminders.log 2>&1
```

Two important details:

- **Use `www.preset-forge.com`** (with www), not `preset-forge.com` — the bare-domain Caddy block does a 301 redirect to `www`, and curl strips the `Authorization` header on cross-host redirects (security default per RFC 7235). Direct `www` URL preserves the header.
- **Declare `CRON_SECRET` inside the crontab file**, NOT in `~/.profile`. System cron does not source the user's shell profile. The `VAR=VAL` line at the top of the crontab is read directly by cron and exported for each scheduled command.

If you prefer not to put the secret in the crontab file, inline the 64-char value directly:

```cron
0 * * * * curl -fsS -X POST -H "Authorization: Bearer 72d08e8e9d..." https://www.preset-forge.com/api/cron/verify-reminders >> /opt/gp200editor/logs/cron-verify-reminders.log 2>&1
```

Also: create the log directory if it doesn't exist yet:
```bash
mkdir -p /opt/gp200editor/logs
```

### Smoke test

```bash
source /opt/gp200editor/.env.prod
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://www.preset-forge.com/api/cron/verify-reminders | jq
```

Expected on a fresh install (no eligible users yet):
```json
{
  "d2": { "sent": 0, "failed": 0, "skippedByRace": 0 },
  "d7": { "sent": 0, "failed": 0, "skippedByRace": 0 }
}
```

A 401 means the secret didn't match — check `.env.prod` and that the app restart picked it up.

### Local dev / E2E

In `.env.dev` set `CRON_SECRET=test-secret-value` and `TEST_SECRET=test`. These values match the defaults in `tests/e2e/verify-reminder.spec.ts`. The test-only `/api/test/backdate-user` endpoint returns 404 when `NODE_ENV=production` and is invisible in deployed builds.
