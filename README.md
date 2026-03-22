# Preset Forge — Valeton GP-200 Preset Editor

**The only browser-based Valeton GP-200 preset editor. Works on Linux, Windows, macOS, and Chrome OS — no installation required.**

The official Valeton GP-200 editor software is Windows-only. Preset Forge runs in any modern browser (Chrome/Chromium recommended for USB MIDI). Tested on Linux Mint, Windows 11, and macOS.

**https://preset-forge.com** · Supports GP-200 firmware 1.8.0 · Open source · Free

## What is this?

Preset Forge lets you edit Valeton GP-200 multi-effects pedal presets (`.prst` files) directly in the browser. You can:

- **Load and edit presets** — open `.prst` files, tweak all 305 effects across 11 slots, download the result
- **Live USB MIDI editing** — connect your GP-200 via USB and push changes to the device in real time (toggle effects, adjust parameters, reorder the signal chain)
- **Import Line6 HX Stomp presets** (experimental) — convert `.hlx` files to GP-200 format
- **Build live setlists** — timed cue points for automatic preset switching during gigs, with 3-2-1 count-in
- **Share and discover presets** — community gallery with per-effect filtering across all 305 effects
- **Admin dashboard** — user/preset management, error console with GitHub issue creation, audit log

## Linux Support

Preset Forge is the **only GP-200 editor that runs on Linux**. Tested on Linux Mint with Chrome. The official Valeton software requires Windows.

For USB MIDI on Linux: install Chrome or Chromium, connect the GP-200 via USB, and grant MIDI permission when the browser asks.

## Features

- **Preset Editor** — `.prst` files (1224 bytes, 11 slots, 305 effects, 15 parameters per effect). Pedalboard view with patch cables
- **305 Effects** — names and parameters extracted from the official Valeton `algorithm.xml`
- **Live USB MIDI** — SysEx protocol reverse-engineered and hardware-verified with firmware 1.8.0 (14 message types)
- **HX Stomp Import** (experimental) — Line6 HX Stomp `.hlx` → GP-200 format
- **Playlists & Cue Points** — timed setlists for live gigs, slot-based preset switching, 3-2-1 count-in
- **Preset Gallery** — community sharing, per-effect filtering (305 effects × 12 modules)
- **MIDI Auto-Reconnect** — 3 automatic reconnect attempts on USB disconnect
- **PWA / Offline** — editor works offline; gallery requires internet
- **Admin Area** — user management (suspend/warn/delete), preset moderation (flag/unpublish/delete), error console with GH issue creation, audit log
- Account system with profile, avatar, email verification, login via email or username
- Role-based access (USER/ADMIN)
- Fully bilingual (DE/EN) · WCAG 2.1 AA

## Stack

- **Next.js 14** App Router + TypeScript strict
- **Tailwind CSS** (Dark theme, JetBrains Mono + DM Sans)
- **Prisma 5** + PostgreSQL 16
- **Lucia v3** (Session-Auth, Argon2id)
- **Garage** (S3-kompatibler Object Store) für Avatare und Presets
- **next-intl 4** (DE/EN)
- **Vitest** (288 Unit-Tests) + **Playwright** (E2E + A11y)

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
npm run test          # 288 Unit-Tests (Vitest)
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
