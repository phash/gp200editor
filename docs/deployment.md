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
bash scripts/deploy-vps.sh    # Einmaliges Setup: Build, Migrate, Garage, SSL, Nginx

# Updates deployen:
cd /opt/gp200editor
bash scripts/deploy-update.sh    # git pull → build → restart (Migrations laufen automatisch)
```

### VPS-Architektur

- GP-200 Stack (Postgres, Garage, Mailhog, App) auf Port 3320
- Musikersuche-Nginx (ports 80/443) proxied `preset-forge.com` → `172.17.0.1:3320`
- SSL via Musikersuche's Certbot-Container
- `scripts/deploy-vps.sh` macht alles automatisch (erster Start)
- `scripts/deploy-update.sh` für Updates (git pull → build → restart)
- `scripts/backup.sh` / `scripts/restore.sh` für DB + S3 Backups

### Dockerfile-Details

- Basis-Image: `node:23-alpine` (drei Stages: deps → builder → runner)
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
