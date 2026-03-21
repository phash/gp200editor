# Preset Forge — GP-200 Editor – CLAUDE.md

Inoffizieller Browser-Editor für Valeton GP-200 Gitarren-Multi-Effektpedal Preset-Dateien (`.prst`).
Live USB-MIDI Editing, Preset-Galerie, Community-Sharing.

## Projekt-Überblick

- **Name:** Preset Forge
- **Domain:** https://preset-forge.com
- **Zweck:** `.prst` Preset-Dateien im Browser laden, bearbeiten, speichern, teilen, live per USB-MIDI ans Gerät senden
- **GitHub:** https://github.com/phash/gp200editor
- **Stack:** Next.js 14 App Router · TypeScript strict · Tailwind CSS · Prisma 5 · PostgreSQL 16 · Lucia v3 · Garage S3 · next-intl 4 (DE/EN)
- **Tests:** Vitest (Unit) · Playwright + @axe-core/playwright (E2E + A11y)
- **Ziel:** WCAG 2.1 AA
- **UI:** Dark pedalboard theme (JetBrains Mono + DM Sans, Amber-Akzente, LED-Style Buttons)

---

## Entwicklung

```bash
npm install --legacy-peer-deps   # legacy-peer-deps wegen lokaler npm-Version (11.x vs lock-file)
npm run dev                      # http://localhost:3000
npm run test                     # Vitest Unit-Tests (271 Tests)
npm run test:e2e                 # Playwright E2E (App muss laufen + Garage + DB)
npm run build                    # Production Build
```

### Wichtig: npm-Version

Lokale npm-Version ist 11.x (Node 25), der Lock-File wurde damit erzeugt. Docker verwendet npm 10.x (Node 23). Deshalb **immer** `--legacy-peer-deps` verwenden:

```bash
npm install --legacy-peer-deps
```

---

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

### Production Deployment (IONOS VPS)

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

**VPS-Architektur:**
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

---

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

---

## Architektur

```
src/
├── core/                    # Pure TypeScript, framework-unabhängig
│   ├── types.ts             # Zod-Schemas: GP200PresetSchema, EffectSlotSchema
│   ├── BinaryParser.ts      # DataView-basierter Reader (uint8/16/32, float32, ASCII, bytes)
│   ├── BufferGenerator.ts   # DataView-basierter Writer (uint8/16/32, float32, ASCII)
│   ├── PRSTDecoder.ts       # .prst → GP200Preset (1224 Bytes, echtes Format)
│   ├── PRSTEncoder.ts       # GP200Preset → .prst (1224 Bytes, echtes Format)
│   ├── effectNames.ts       # 305 Effekt-ID→Name Mappings + MODULE_COLORS (aus algorithm.xml)
│   ├── effectParams.ts      # Parameter-Definitionen pro Effekt (Knob/Slider/Switch/Combox)
│   └── HLXConverter.ts      # Line6 HX Stomp .hlx (JSON) → GP200Preset Konvertierung
│
├── hooks/
│   ├── usePreset.ts         # React-State: loadPreset, setPatchName, toggleEffect,
│   │                        #   changeEffect, reorderEffects, setParam, reset
│   └── useTimelinePlayer.ts # rAF-basierter Timer für Playlist Cue Points
│
├── components/
│   ├── Navbar.tsx            # Auth-Status, Locale-Switcher, Links (Profile, Presets)
│   ├── FileUpload.tsx        # Drag & Drop + Keyboard (WCAG)
│   ├── EffectSlot.tsx        # Effekt-Slot: Modul-Badge, Effekt-Dropdown, LED-Toggle,
│   │                        #   Drag & Drop Reorder, aufklappbare Parameter
│   ├── EffectParams.tsx      # Parameter-Controls: Slider, Switch, Combox
│   ├── CuePointTable.tsx     # Timeline-Tabelle für Playlist Cue Points (device slot-basiert)
│   └── Footer.tsx
│
├── lib/
│   ├── auth.ts              # Lucia v3 Instanz (PrismaAdapter, session cookie)
│   ├── prisma.ts            # Prisma Client Singleton
│   ├── session.ts           # validateSession(), refreshSessionCookie()
│   ├── email.ts             # Nodemailer, sendPasswordResetEmail()
│   ├── storage.ts           # Garage S3: Avatar (bucket()) + Preset (presetBucket())
│   └── validators.ts        # Zod-Schemas für Auth, Profile, Preset
│
├── app/[locale]/
│   ├── layout.tsx            # NextIntlClientProvider, Navbar, Footer
│   ├── page.tsx              # Home-Seite
│   ├── editor/page.tsx       # Editor: FileUpload + 11x EffectSlot + Drag & Drop
│   ├── auth/                 # Login, Register, Forgot-Password, Reset-Password
│   ├── profile/              # Eigenes Profil (edit), /[username] (read-only)
│   ├── presets/              # Preset-Liste + Upload, /[id]/edit
│   └── share/[token]/        # Öffentliche Preset-Seite (kein Login nötig)
│
├── app/api/
│   ├── auth/                 # register, login, logout, forgot-password, reset-password
│   ├── profile/              # GET/PATCH Profil, POST Avatar-Upload
│   ├── avatar/[key]/         # Avatar-Proxy (verhindert direkte Garage-Exposition)
│   ├── presets/              # POST/GET Presets, PATCH/DELETE/download/share/revoke
│   └── share/[token]/        # Öffentliche Preset-Info + Download (kein Auth)
│
├── i18n/
│   ├── routing.ts            # defineRouting + createNavigation
│   └── request.ts            # getRequestConfig für next-intl
│
└── middleware.ts             # next-intl + Auth-Guards (profile, presets)

scripts/
└── generate-effect-params.mjs  # Parst algorithm.xml → src/core/effectParams.ts
```

---

## Datenbankschema (Prisma)

```prisma
User          id, email, username, passwordHash, bio, website, avatarKey, createdAt
Session       id, userId, expiresAt  (Lucia v3)
PasswordResetToken  id, userId, token, expiresAt, usedAt
Preset        id, userId, presetKey, name(VarChar32), description, tags(String[]),
              shareToken(@unique), downloadCount, publish, style, author,
              ratingAverage(Float), ratingCount(Int), modules(String[]),
              createdAt, updatedAt
              @@index([userId])
PresetRating  id, presetId, userId, score(Int 1-5), createdAt, updatedAt
              @@unique([presetId, userId])
              @@index([presetId])
```

---

## Auth (Lucia v3)

- `@lucia-auth/adapter-prisma@4.0.1` (nicht 1.0.0 — das ist Lucia v1/v2)
- Session-Cookie: `auth_session` (Lucia-Standard)
- Passwort-Hashing: Argon2id (`@node-rs/argon2`)
- Session-Validation: `validateSession()` in `src/lib/session.ts` — immer auch `refreshSessionCookie()` aufrufen
- Zod-Fehler: `.issues[0].message` (nicht `.errors` — das ist Zod v4)

---

## Storage (Garage S3)

- Zwei getrennte Buckets: `avatars` (GARAGE_BUCKET) und `presets` (GARAGE_PRESET_BUCKET)
- **Wichtig:** `presetBucket()` und `bucket()` in `storage.ts` lesen verschiedene Env-Vars — nie zusammenführen
- Avatar-Proxy: `/api/avatar/[key]` — Garage-Credentials nie dem Client exponieren
- Dateiersatz-Reihenfolge: neues File uploaden → DB updaten → altes File löschen (`.catch(() => {})`)

---

## Preset-API

| Route | Auth | Beschreibung |
|-------|------|--------------|
| `POST /api/presets` | Ja | Upload + PRST-Validierung (1224 Bytes) |
| `GET /api/presets` | Ja | Alle Presets des Users |
| `PATCH /api/presets/[id]` | Ja (Owner) | Metadaten/File ersetzen |
| `DELETE /api/presets/[id]` | Ja (Owner) | Löschen |
| `GET /api/presets/[id]/download` | Ja (Owner) | Download |
| `POST /api/presets/[id]/share/revoke` | Ja (Owner) | Share-Link widerrufen |
| `GET /api/share/[token]` | Nein | Öffentliche Preset-Info |
| `GET /api/share/[token]/download` | Nein | Öffentlicher Download (zählt downloadCount) |
| `POST /api/presets/[id]/rate` | Ja | Rating abgeben (1-5) — kein eigenes Preset |
| `GET /api/gallery` | Nein | Galerie-Presets (sort: newest/popular/top-rated, filter: style/modules/effects) |

---

## i18n-Konventionen

- `routing.ts` exportiert typisierte Navigation: `import { Link, useRouter, usePathname } from '@/i18n/routing'`
- Nie `next/link` oder `next/navigation` direkt importieren (Ausnahme: `redirect()` in Server Components — next-intl's redirect benötigt `{ href: string }`)
- Alle UI-Strings über `useTranslations()` / `getTranslations()` (kein Hardcoding)
- Translations in `messages/de.json` und `messages/en.json`
- Namespaces: `nav`, `home`, `editor`, `auth`, `profile`, `presets`

---

## .prst Binärformat (Reverse Engineered, 2026-03-16)

**Alle bekannten echten .prst-Dateien sind exakt 1224 Bytes** (User-Presets; Factory-Presets: 1176 Bytes).

### Datei-Header (0x00–0x2F, 48 Bytes)

| Offset | Größe | Inhalt                          |
|--------|-------|---------------------------------|
| 0x00   | 4     | Magic: `TSRP` ("PRST" reversed) |
| 0x10   | 4     | Device ID: `2-PG` ("GP-2" rev.) |
| 0x14   | 4     | Firmware-Version: `00 01 01 00` |
| 0x1C   | 4     | Timestamp / Preset-ID           |
| 0x28   | 4     | Chunk-Marker: `MRAP`            |
| 0x2C   | 4     | Chunk-Größe (LE uint32 = 1172)  |

### Preset-Name + Author (0x44–0x63)

| Offset | Größe | Inhalt                          |
|--------|-------|---------------------------------|
| 0x44   | 16    | Preset-Name (null-terminiert)   |
| 0x54   | 16    | Author (null-terminiert)        |

- Beide Felder: ASCII, null-terminiert, max 16 Zeichen (nicht 32 wie ursprünglich angenommen)
- Author wird auch per SysEx Live-Message (sub=0x20) ans Gerät gesendet

### Effekt-Blöcke (0xa0–0x3AF, 11× 72 Bytes)

```
+0   4  Marker: 14 00 44 00
+4   1  Slot-Index (0–10)
+5   1  Aktiv-Flag (0 = bypass, 1 = aktiv)
+6   2  Konstante: 0x000F
+8   4  Effekt-Code (LE uint32) — High-Byte = Modul-Typ, Low-Bytes = Variante
+12  60 Parameter (15× LE float32)
```

**Wichtig:** Blockgröße = **72 Bytes (0x48)**, nicht 64 (0x40).

### Effekt-Code Struktur (uint32)

| High-Byte | Modul | Beispiele |
|-----------|-------|-----------|
| 0x00 | PRE/NR | COMP, Gate, Boost |
| 0x01 | PRE/EQ/MOD | AC Sim, Guitar EQ, Detune |
| 0x03 | DST | Green OD, Force, Scream OD |
| 0x04 | MOD | Chorus, Flanger, Phaser, Tremolo |
| 0x05 | WAH | V-Wah, C-Wah |
| 0x06 | VOL | Volume |
| 0x07 | AMP | UK 800, Mess DualV, Eagle 120+ |
| 0x08 | AMP (extra) | AC Pre, Mini Bass |
| 0x0A | CAB | UK GRN 2, EV, User IR |
| 0x0B | DLY | Pure, Analog, Tape |
| 0x0C | RVB | Room, Hall, Shimmer |
| 0x0F | SnapTone | SnapTone (AMP/DST) |

### Effekt-Datenbank

- **305 Effekte** mit Namen aus der offiziellen Valeton GP-200 Editor Software (`algorithm.xml`)
- **322 Parameter-Definitionen** (Knob, Slider, Switch, Combox) pro Effekt
- Quelle: `~/.wine/drive_c/Program Files/Valeton/GP-200/Resource/GP-200/File/algorithm.xml`
- Generator: `scripts/generate-effect-params.mjs` → `src/core/effectParams.ts`

### Checksum (letzte 2 Bytes, 0x4C6)

LE uint16 → **Algorithmus gelöst (2026-03-18):** `sum(bytes[0:0x4C6]) & 0xFFFF`, gespeichert als BE16.

---

## Tests

```bash
npm run test              # 271 Unit-Tests (Vitest)
npm run test:coverage     # Coverage-Report
npm run test:e2e          # Playwright E2E (App + Garage + DB erforderlich)
```

Unit-Tests in `tests/unit/`:
- `BinaryParser.test.ts`, `BufferGenerator.test.ts`, `types.test.ts`
- `PRSTDecoder.test.ts`, `PRSTEncoder.test.ts` — inkl. Tests gegen echte .prst-Dateien
- `SysExCodec.test.ts` — Toggle, ParamChange, Reorder, Handshake (60 Tests)
- `effectNames.test.ts` — Effekt-ID→Name Auflösung
- `effectParams.test.ts` — Parameter-Definitionen
- `useMidiDevice.test.ts` — MIDI Hook Tests
- `validators.preset.test.ts` — Upload/Patch Schema + author/style/publish
- `usePreset.test.ts`, `smoke.test.ts`
- `lib/validators.test.ts` – Auth + Profile Schemas
- `validators.preset.test.ts` – uploadPresetSchema + patchPresetSchema

E2E-Tests in `tests/e2e/`:
- `editor.spec.ts` – Datei-Upload, Preset-Anzeige, Effekt-Toggle
- `a11y.spec.ts` – WCAG 2.1 AA mit axe-core
- `auth.spec.ts` – Register, Login, Logout, Passwort-Reset
- `profile.spec.ts` – Profil bearbeiten, Avatar (⚠ Register-Helper veraltet, siehe Issue #53)
- `presets.spec.ts` – Preset hochladen, teilen, bearbeiten, löschen, Link widerrufen
- `save-and-gallery.spec.ts` – Save-Dialog, Galerie-Suche/Filter, Gallery→Editor Link
- `ratings.spec.ts` – Preset-Ratings: Anzeige, Bewerten, Persistenz, Editor-Widget

**E2E-Test-Konventionen (wichtig für parallele Tests):**
- Register-Helper: Mailhog-Suche per Recipient (`/api/v2/search?kind=to&query=EMAIL`) — kein globaler DELETE
- Email-Body ist Quoted-Printable: `raw.replace(/=\r?\n/g,'').replace(/=([0-9A-Fa-f]{2})/g, ...decode...)`
- Rate Limiting ist in `NODE_ENV !== 'production'` deaktiviert (für parallele Test-Registrierungen)
- `.prst`-Dateien für Tests: `prst/63-B American Idiot.prst` (author=Galtone Studio, DST aktiv), `prst/63-C claude1.prst` (author leer, DST aktiv aber Round-Trip verliert DST — Bug #53)
- Gallery-Locators: immer `.first()` — mehrere Presets gleichen Namens akkumulieren im Test-DB

---

## USB-Gerätekommunikation (Issue #5 + #6)

Das GP-200 ist USB-MIDI class-compliant. Die offizielle Valeton-Software kommuniziert per proprietärem **MIDI SysEx** über USB-MIDI zum Gerät.

### Status

- **Issue #5** (Sniffing): SysEx-Protokoll reverse-engineered ✓ (14 Message-Typen, 10 Captures)
- **Issue #6** (Feature): Web MIDI implementiert ✓ — Pull, Push, **Live-Editing (Toggle, Param, Reorder) hardware-verifiziert**
- Dateien: `src/core/SysExCodec.ts`, `src/hooks/useMidiDevice.ts`, `src/components/DeviceStatusBar.tsx`, `src/components/DeviceSlotBrowser.tsx`
- **Auto-Reconnect:** `useMidiDevice` versucht bei Disconnect automatisch 3× neu zu verbinden

### Hardware-Testing (Web MIDI)

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

### Wenn das Gerät eintrifft: Capture-Workflow

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

### SysEx-Protokoll (Reverse Engineered, 2026-03-18/19)

Alle Messages: `F0 21 25 7E 47 50 2D 32 <CMD> <SUB> <payload> F7`
- Manufacturer: `21 25`, Device: `7E 47 50 2D 32` ("GP-2")
- CMD=0x11: Host-Requests (Read, Identity, Enter Editor)
- CMD=0x12: Host-Commands + Device-Responses (Write, Toggle, Param, Reorder)

#### Message-Übersicht

Sub-Befehle sind **multipurpose** — gleicher Sub hat verschiedene Bedeutungen je nach Kontext/Payload.

| Sub | Richtung | Bytes | Beschreibung | Encoding |
|-----|----------|-------|-------------|----------|
| 0x08 | H→D | 30 | Preset wechseln / Save-Commit | raw |
| 0x08 | H→D | 30 | Drum-Computer Steuerung (BPM, Pattern, Play/Stop) | raw |
| 0x08 | D→H | 30 | ACK / Block-State-Response | raw |
| 0x0C | D→H | 38 | Effekt-Change-Response | raw |
| 0x10 | H→D | 46 | Toggle Effekt an/aus (byte[40]=0/1) | raw |
| 0x10 | H→D | 46 | Patch Settings: VOL/PAN/Tempo/Style (byte[40]=0) | raw |
| 0x10 | H→D | 46 | Read Request (CMD=0x11) | raw |
| 0x14 | H→D | 54 | Effekt wechseln | raw |
| 0x14 | H→D | 54 | Controller/EXP-Assignment ändern | raw |
| 0x14 | D→H | 54 | Reorder-Response (neue Routing-Order) | raw |
| 0x18 | H→D | 62 | Parameter-Change — decoded[8]=0x05 | nibble |
| 0x18 | H→D | 62 | Style-Name schreiben — anderer Header | nibble |
| 0x18 | H→D | 62 | Save-to-Slot (Preset-Name + Commit) | nibble |
| 0x18 | D→H | var | Read-Response Chunks | nibble |
| 0x20 | H→D | 78 | Effekt-Reihenfolge — decoded[8]=0x08 | nibble |
| 0x20 | H→D | 78 | Author-Name schreiben — decoded[8]=0x09 | nibble |
| 0x20 | H→D | var | Write Chunks (7× für Full Write) | nibble |
| 0x38 | H→D | 126 | Note-Text schreiben — decoded[8]=0x0B | nibble |

#### sub=0x10 (46 Bytes, raw) — Toggle / Patch Settings / Style

Multipurpose-Befehl, unterschieden durch byte[40] und Kontext:

```
[0-9]   F0 21 25 7E 47 50 2D 32 12 10   Header + CMD + sub
[10-37] konstante Bytes                   (siehe SysExCodec.ts)
[38]    Target-ID                          Toggle: Block-Index (0=PRE..10=VOL)
                                           Patch: 0x00=VOL, 0x01=Tempo, 0x02=Style, 0x06=PAN
[40]    State / Flag                       Toggle: 0=OFF, 1=ON
                                           Patch Settings: immer 0x00
[41:43] Nibble-encoded Wert               Toggle: 0x09 0x0C (konstant)
                                           Patch: (high<<4|low) = Wert (z.B. 0x33=51)
[43:45] Nibble-encoded Wert 2             Patch: für Tempo (>255) auch [43:45] genutzt
[45]    F7
```

Verifiziert: Patch VOL=51 (≈Display 50), Tempo=119 (≈Display 120), Style=Index-Nummer

#### Parameter-Change (sub=0x18, 62 Bytes, nibble-encoded)

SysEx: `F0 ... 12 18 00 00 00 [48 nibble bytes] F7`
Nibble-decoded Payload (24 Bytes):

```
[0:8]   00 00 04 00 00 00 00 00   Konstanter Header
[8]     05                         Msg-Typ (Param-Change)
[10]    0C                         Konstante
[12]    Block-Index                0-10 (siehe oben)
[13]    Parameter-Index            0-14 (entspricht effectParams.ts Reihenfolge)
[14]    6F                         Marker (normal) / FA (Combox-Controls)
[16:20] Effect-ID                  uint32 LE (aus Preset-Effekt-Block)
[20:24] Wert                       float32 LE
```

Verifiziert mit:
- **AMP Mess4 LD** (0x07000055): Param 0=Gain, 1=Presence, 2=Volume, 3=Bass, 4=Middle, 5=Treble (je 0-100)
- **DLY Ping Pong** (0x0B000004): Param 0=Mix(0-100), 1=Feedback(0-500), 2=Time(0-10 enum), 3=Sync(1-4), 4=Trail(0/1)

#### Effekt-Reihenfolge ändern (sub=0x20, 78 Bytes, nibble-encoded)

SysEx: `F0 ... 12 20 00 00 00 [64 nibble bytes] F7`
Nibble-decoded Payload (32 Bytes):

```
[0:8]   00 00 04 00 00 00 00 00   Konstanter Header
[8]     08                         Msg-Typ (Reorder)
[10]    10                         Konstante
[14:16] 04 04                      Konstante
[16:27] Routing-Order              11 Slot-Indices (neue Reihenfolge)
[27]    44                         Terminator
```

Device antwortet mit sub=0x14 (54 Bytes) und bestätigt die neue Reihenfolge.

#### Author-Name (sub=0x20, 78 Bytes, nibble-encoded)

Gleicher Sub wie Reorder, aber anderer decoded[8] Msg-Typ:
**Verifiziert**: Capture 143029, Pkt 71 — Author "Manuel"

```
[0:8]   00 00 04 00 00 00 01 00   Konstanter Header
[8]     09                         Msg-Typ (Author)
[10]    14                         Konstante
[12]    01                         Konstante
[14]    70                         Marker
[15]    0B                         Konstante
[16:32] Author-Name                Null-terminierter ASCII-String (max 16 Zeichen)
```

#### Note-Text (sub=0x38, 126 Bytes, nibble-encoded)

SysEx: `F0 ... 12 38 00 00 00 [112 nibble bytes] F7`
Nibble-decoded Payload (56 Bytes):
**Verifiziert**: Capture 143029, Pkt 129 — Note "TestNote"

```
[0:8]   00 00 04 00 00 00 01 00   Konstanter Header
[8]     0B                         Msg-Typ (Note)
[10]    2C                         Konstante
[12]    01                         Konstante
[14]    A1                         Marker
[16:56] Note-Text                  Null-terminierter ASCII-String (max 40 Zeichen)
```

#### Style-Name (sub=0x18, 62 Bytes, nibble-encoded)

Gleicher Sub wie Param-Change, aber anderer Header (beginnt mit 03 20 14).
**Verifiziert**: Capture 143029, Pkt 135 — Style "Green Day"

```
[0]     03                         Style-Header (vs 00 bei Param-Change)
[1]     20                         Konstante
[2]     14                         Konstante
[4]     01                         Konstante
[6]     A1                         Marker
[8:24]  Style-Name                 Null-terminierter ASCII-String (max 16 Zeichen)
```

**Hinweis:** Style-Name ist NICHT in der .prst-Datei gespeichert — nur per SysEx ans Gerät + DB-Metadaten.

#### Drum-Computer (sub=0x08, 30 Bytes, raw)

Gleicher Sub wie Preset-Commit/ACK, bidirektional:

```
[13]    Modus                      0x00=BPM/Volume, 0x01=Pattern/Play-Stop
[14]    0x01                       Konstante
[22]    BPM-Aktiv-Flag             0x01=BPM-Kontrolle, 0x00=Pattern-Steuerung
[25:27] Nibble-encoded Wert        BPM oder Pattern-Index
```

#### Controller/EXP Assignments (sub=0x14, 54 Bytes, raw)

Gleicher Sub wie Effect-Change, für EXP-Pedal und CTRL-Zuordnungen.
Byte[28] unterscheidet Sektionen (0x00 vs 0x01). Komplexes Format,
enthält Block-Referenz + Parameter-Referenz + Min/Max-Werte.
Noch nicht vollständig dekodiert — benötigt weitere Analyse.

#### IR Upload (sub=0x1C, variable Länge, nibble-encoded) — Nachrangig

Impulse-Response Dateien werden als Multi-Chunk Transfer über sub=0x1C gesendet:

```
[10]    0x20                       Upload-Marker
[11:13] Chunk-Offset               LE16 (gleiche 311/439 Deltas wie Write-Chunks)
[13:-1] Nibble-encoded IR-Daten
```

- 23+ Chunks für eine vollständige IR
- Capture 105713 zeigt unvollständigen Transfer (1358 von ~4096 Bytes) — Timeout
- Device hat nie geantwortet (0 D→H Messages) — vermutlich USB-Timing-Problem
- Nachrangig: funktioniert evtl. mit längeren Timeouts oder Chunk-Bestätigungen

#### Captures (Windows, 2026-03-19)

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

#### Weitere Infos

- **Firmware-Version:** Identity-Response bytes [22]/[26] zeigen immer 1.2 — das ist NICHT die echte FW-Version. Echte Kompatibilitätsprüfung über sub=0x0A Version-Check. Getestet mit FW 1.8.0.
- Gerät arbeitet im **Normal-Modus** (6-In/4-Out) — nur in diesem Modus funktioniert der Editor
- GP-5-SysEx-Referenz (Geschwistergerät): https://www.scribd.com/document/963614194/GP-5-SysEx-1
- Valeton-Software lokal installiert unter Wine
- Capture-Tool: Wireshark 4.6.4 + USBPcap, Analyzer: `scripts/analyze-sysex.py`

---

## Nicht tun

- `npm ci` verwenden (Lock-File-Inkompatibilität mit Docker-npm-Version)
- `next/link` oder `next/navigation` direkt in Client-Components importieren (immer `@/i18n/routing`)
- `useSearchParams` aus `next/navigation` in Pages verwenden — funktioniert nicht im Production-Build, stattdessen `window.location.search` im `useEffect`
- `onMouseEnter`/`onMouseLeave` auf `<Link>` Komponenten — crasht in Production SSR, stattdessen CSS `hover:` Klassen
- UI-Strings hardcoden (immer `useTranslations` / `getTranslations`)
- `@lucia-auth/adapter-prisma@1.0.0` — das ist Lucia v1/v2; Lucia v3 braucht `@4.0.1`
- Zod `.errors` verwenden — in Zod v4 heißt es `.issues`
- `GARAGE_BUCKET` für Presets verwenden — das ist für Avatare; `GARAGE_PRESET_BUCKET` für Presets
- `bucket()` und `presetBucket()` in `storage.ts` zusammenführen
- Den `matcher` in `middleware.ts` ändern — next-intl braucht den breiten Matcher; Auth-Guards als `if`-Blöcke im Body hinzufügen
- `Content-Length` hardcoden in Download-Responses — immer aus `buffer.length` berechnen
- Garage S3 Stream direkt an NextResponse übergeben — in Standalone-Build hängt der Stream, immer erst in Buffer lesen
- Garage Secret Key nicht sofort speichern — wird nach Erstellung nur einmal angezeigt, danach `(redacted)`
- Prod manuell mit `docker compose up -d --build app` deployen — immer `bash scripts/deploy-update.sh` verwenden (führt Migrationen automatisch aus)
- `npx prisma` im Docker-Standalone-Build verwenden — Prisma wird global installiert, direkt `prisma` nutzen
- `inline style={}` mit `onMouseEnter`/`onMouseLeave` für Hover-Effekte verwenden — immer Tailwind `hover:` Klassen (inkl. `hover:!bg-[var(--accent-amber)]` mit `!` für wichtige Overrides)
- `DELETE /api/v1/messages` in Mailhog-Tests — killt parallele Test-Emails; stattdessen `/api/v2/search?kind=to&query=EMAIL`
- `writeTempPreset()` mit 512 Bytes — API erwartet 1224 Bytes mit TSRP-Magic; korrektes Format: `TSRP` at 0x00, `2-PG` at 0x10, name at 0x44
- `validateSession()` mit Argumenten aufrufen — es liest cookies intern (keine Parameter)
