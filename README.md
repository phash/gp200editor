# Preset Forge — GP-200 Editor

Inoffizieller Browser-Editor für Valeton GP-200 Gitarren-Multi-Effektpedal. Live USB-MIDI Editing, Preset-Galerie, Community-Sharing.

**https://preset-forge.com** · Firmware 1.8.0

## Features

- **Preset Editor** — `.prst` Dateien laden, bearbeiten, speichern. Pedalboard-View mit Patch Cables
- **305 Effekte** mit Namen und Parametern aus der offiziellen Valeton-Software
- **Live USB MIDI** — Effekte togglen, Parameter ändern, Signal-Kette umordnen in Echtzeit
- **HX Stomp Import** (experimental) — Line6 HX Stomp `.hlx` Presets importieren und konvertieren
- **Author & Metadata** — Author-Name wird in .prst Datei + per SysEx ans Gerät geschrieben
- **Playlists & Cue Points** — Setlists mit zeitgesteuerten Preset-Wechseln für Live-Gigs
- **Slot-basierte Cue Points** — Slots direkt vom GP-200 wählen, instant Switching per `sendSlotChange`
- **3-2-1 Count-In** — Countdown vor Timeline-Start
- **Preset-Galerie** — Presets teilen, suchen, filtern nach Modul UND einzelnem Effekt
- **MIDI Auto-Reconnect** — 3 automatische Reconnect-Versuche bei USB-Unterbrechung
- **PWA / Offline** — Editor funktioniert offline, Galerie braucht Internet
- **Kontextuelle Hilfe** — ? Button auf jeder Seite verlinkt zur relevanten Hilfe-Sektion
- Account-System mit Profil, Avatar, Email-Verifikation
- Vollständig zweisprachig (DE/EN) · WCAG 2.1 AA

## Stack

- **Next.js 14** App Router + TypeScript strict
- **Tailwind CSS** (Dark theme, JetBrains Mono + DM Sans)
- **Prisma 5** + PostgreSQL 16
- **Lucia v3** (Session-Auth, Argon2id)
- **Garage** (S3-kompatibler Object Store) für Avatare und Presets
- **next-intl 4** (DE/EN)
- **Vitest** (271 Unit-Tests) + **Playwright** (E2E + A11y)

## Entwicklung

### Voraussetzungen

- Node.js 23+
- Docker (für PostgreSQL, Garage, Mailhog)

### Setup

```bash
# Dependencies
npm install --legacy-peer-deps

# Infrastruktur starten (PostgreSQL, Garage, Mailhog)
docker compose up -d

# Garage einmalig initialisieren → gibt Access Keys aus
bash scripts/garage-init.sh

# .env.local anlegen (Vorlage: .env.local.example)
cp .env.local.example .env.local
# → Access Keys aus garage-init.sh eintragen

# Datenbankmigrationen
npx prisma migrate dev

# Dev-Server
npm run dev       # http://localhost:3000
```

> **Hinweis:** Immer `--legacy-peer-deps` verwenden — lokale npm-Version ist 11.x, Lock-File wurde damit erzeugt.

### Tests

```bash
npm run test          # 271 Unit-Tests (Vitest)
npm run test:coverage # Coverage-Report
npm run test:e2e      # Playwright E2E (App + Garage + DB erforderlich)
```

### Build

```bash
npm run build

# Docker
docker build -t gp200editor .
docker run -d -p 3000:3000 gp200editor
```

### Production Deployment (IONOS VPS)

```bash
# Erstmalig:
cd /opt && git clone https://github.com/phash/gp200editor.git && cd gp200editor
bash scripts/deploy-vps.sh    # Setup: Build, Garage, SSL, Nginx

# Updates:
bash scripts/deploy-update.sh # git pull → build → restart (Migrations laufen automatisch)
```

DB-Migrationen laufen automatisch bei jedem Container-Start (`docker-entrypoint.sh`).

## .prst Binärformat

Alle User-Presets sind exakt **1224 Bytes**. Das Format wurde per Reverse Engineering dokumentiert:

- Magic `TSRP` (reversed "PRST") + Device ID `2-PG` (reversed "GP-2")
- 11 Effekt-Blöcke à 72 Bytes mit Effekt-Code (uint32), Active-Flag und 15× float32 Parametern
- 305 Effekte mit Namen und Parameter-Definitionen aus der offiziellen Valeton GP-200 Editor Software (`algorithm.xml`)

Details: [CLAUDE.md](./CLAUDE.md#prst-binärformat-reverse-engineered-2026-03-16)

## Umgebungsvariablen

Vorlage: `.env.local.example`

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gp200

GARAGE_ENDPOINT=http://localhost:3900
GARAGE_ACCESS_KEY_ID=<from garage-init.sh>
GARAGE_SECRET_ACCESS_KEY=<from garage-init.sh>
GARAGE_BUCKET=avatars
GARAGE_PRESET_BUCKET=presets

EMAIL_FROM=noreply@gp200editor.local
EMAIL_SMTP_HOST=localhost
EMAIL_SMTP_PORT=1025

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Dokumentation

Technische Entscheidungen und Konventionen: [CLAUDE.md](./CLAUDE.md)
