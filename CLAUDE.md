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
npm install --legacy-peer-deps   # IMMER --legacy-peer-deps (npm 11.x vs Docker npm 10.x)
npm run dev                      # http://localhost:3000
npm run test                     # Vitest Unit-Tests (312 Tests)
npm run test:e2e                 # Playwright E2E (App muss laufen + Garage + DB)
npm run lint                     # ESLint
npm run build                    # Production Build
```

Docker-Setup, Env-Vars, VPS-Deployment, Hardware-Testing: **`docs/deployment.md`**

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
│   ├── effectDescriptions.ts # 255 Effekt→Beschreibung Mappings (original Pedal/Amp Names)
│   └── HLXConverter.ts      # Line6 HX Stomp .hlx (JSON) → GP200Preset Konvertierung
│
├── hooks/
│   ├── usePreset.ts         # React-State: loadPreset, setPatchName, toggleEffect,
│   │                        #   changeEffect (applies default params), reorderEffects, setParam, reset
│   └── useTimelinePlayer.ts # rAF-basierter Timer für Playlist Cue Points
│
├── components/
│   ├── Navbar.tsx            # Auth-Status, Locale-Switcher, Links (Profile, Presets, Admin)
│   ├── FileUpload.tsx        # Drag & Drop + Keyboard (WCAG)
│   ├── EffectSlot.tsx        # Effekt-Slot: Modul-Badge, Effekt-Dropdown, LED-Toggle,
│   │                        #   Drag & Drop Reorder, aufklappbare Parameter
│   ├── EffectParams.tsx      # Parameter-Controls: Slider, Switch, Combox
│   ├── CuePointTable.tsx     # Timeline-Tabelle für Playlist Cue Points (device slot-basiert)
│   ├── AdminDashboard.tsx    # Admin-Dashboard: Users/Presets/Errors/Audit-Log Tabs
│   ├── AdminActions.tsx      # Kontextuelle Admin-Buttons (Profil, Galerie)
│   ├── AmpHeadPanel.tsx       # AMP-Block Knobs (Gain/Presence/Volume/Bass/Middle/Treble)
│   │                        #   prominent am Editor-Top, auto-detects AMP-Modell
│   ├── ControllerPanel.tsx    # EXP 1/2 Assignment-Panel (Param-Select + Min/Max)
│   ├── ConfirmDialog.tsx     # Bestätigungs-Dialog für destruktive Aktionen
│   ├── WarnDialog.tsx        # Warnung-Dialog (Grund + Nachricht per E-Mail)
│   └── Footer.tsx
│
├── lib/
│   ├── auth.ts              # Lucia v3 Instanz (PrismaAdapter, session cookie, role+suspended)
│   ├── prisma.ts            # Prisma Client Singleton
│   ├── session.ts           # validateSession(), refreshSessionCookie()
│   ├── admin.ts             # requireAdmin() Guard, logAdminAction() Audit-Trail
│   ├── errorLog.ts          # logError() → DB-basiertes Error-Logging
│   ├── email.ts             # Nodemailer, sendPasswordResetEmail(), sendWarningEmail()
│   ├── storage.ts           # Garage S3: Avatar (bucket()) + Preset (presetBucket())
│   ├── validators.ts        # Zod-Schemas für Auth, Profile, Preset
│   └── validators.admin.ts  # Zod-Schemas für Admin-API (Patch/Warn/Query)
│
├── app/[locale]/
│   ├── layout.tsx            # NextIntlClientProvider, Navbar, Footer
│   ├── page.tsx              # Home-Seite
│   ├── editor/page.tsx       # Editor: AmpHead + FileUpload + 11x EffectSlot + Drag & Drop
│   │                        #   Collapsible sections (AMP/Preset/Controller) via toggle bar
│   ├── auth/                 # Login (Email/Username), Register, Forgot-Password, Reset-Password
│   ├── admin/page.tsx        # Admin-Dashboard (role-gated)
│   ├── profile/              # Eigenes Profil (edit), /[username] (read-only + Admin-Actions)
│   ├── presets/              # Preset-Liste + Upload, /[id]/edit
│   └── share/[token]/        # Öffentliche Preset-Seite (kein Login nötig)
│
├── app/api/
│   ├── auth/                 # register, login (email/username), logout, forgot/reset-password
│   ├── admin/                # stats, users (CRUD+warn), presets (CRUD), errors, actions
│   ├── profile/              # GET/PATCH Profil (+role), POST Avatar-Upload
│   ├── avatar/[key]/         # Avatar-Proxy (verhindert direkte Garage-Exposition)
│   ├── presets/              # POST/GET Presets, PATCH/DELETE/download/share/revoke
│   └── share/[token]/        # Öffentliche Preset-Info + Download (kein Auth)
│
├── i18n/
│   ├── routing.ts            # defineRouting + createNavigation
│   └── request.ts            # getRequestConfig für next-intl
│
└── middleware.ts             # next-intl + Auth-Guards (profile, presets, admin)

scripts/
└── generate-effect-params.mjs  # Parst algorithm.xml → src/core/effectParams.ts
```

---

## Datenbankschema (Prisma)

```prisma
enum Role     { USER, ADMIN }
User          id, email, username, passwordHash, emailVerified, bio, website, avatarKey,
              role(Role @default(USER)), suspended(Boolean @default(false)),
              createdAt
              Relations: sessions, resetTokens, emailVerifyTokens, presets, ratings, adminActions
Session       id, userId, expiresAt  (Lucia v3)
PasswordResetToken  id, userId, tokenHash, expiresAt, usedAt
EmailVerificationToken  id, userId, tokenHash, expiresAt, usedAt
Preset        id, userId, presetKey, name(VarChar32), description, tags(String[]),
              shareToken(@unique), downloadCount, public, style, author,
              flagged(Boolean @default(false)),
              ratingAverage(Float), ratingCount(Int), modules(String[]), effects(String[]),
              createdAt, updatedAt
              @@index([userId])
PresetRating  id, presetId, userId, score(Int 1-5), createdAt, updatedAt
              @@unique([presetId, userId])
              @@index([presetId])
ErrorLog      id, level, message, stack?, url?, userId?, metadata(Json?), createdAt
              @@index([createdAt])
AdminAction   id, adminId?(→User onDelete:SetNull), action, targetType, targetId,
              reason?, metadata(Json?), createdAt
              @@index([adminId]) @@index([createdAt])
```

---

## Auth (Lucia v3)

- `@lucia-auth/adapter-prisma@4.0.1` (nicht 1.0.0 — das ist Lucia v1/v2)
- Session-Cookie: `auth_session` (Lucia-Standard)
- Passwort-Hashing: Argon2id (`@node-rs/argon2`)
- Session-Validation: `validateSession()` in `src/lib/session.ts` — immer auch `refreshSessionCookie()` aufrufen
- `getUserAttributes` liefert: `username`, `email`, `role`, `suspended`
- Login akzeptiert Email oder Username (`loginSchema.login` Feld, `@`-Check für Lookup)
- Gesperrte User (`suspended=true`) können sich nicht einloggen (403)
- Admin-Guard: `requireAdmin()` in `src/lib/admin.ts` — prüft `role === 'ADMIN'`
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

## Admin-API

Alle Routen unter `/api/admin/` — jede beginnt mit `requireAdmin()`.

| Route | Method | Beschreibung |
|-------|--------|-------------|
| `/api/admin/stats` | GET | Dashboard-Statistiken (Users, Presets, Errors, Suspended) |
| `/api/admin/users` | GET | User-Liste (paginiert, durchsuchbar) |
| `/api/admin/users/[id]` | PATCH | Suspend/Unsuspend, Edit (username, email, bio, role) |
| `/api/admin/users/[id]` | DELETE | User + S3-Files + Sessions löschen (Cascade) |
| `/api/admin/users/[id]/warn` | POST | Warnung per E-Mail (Grund + Nachricht) |
| `/api/admin/presets` | GET | Preset-Liste (paginiert, durchsuchbar, filterbar) |
| `/api/admin/presets/[id]` | PATCH | Unpublish/Flag/Edit |
| `/api/admin/presets/[id]` | DELETE | Preset + S3-File löschen |
| `/api/admin/errors` | GET | Error-Liste (paginiert, Level-Filter) |
| `/api/admin/errors/[id]` | DELETE | Einzelnen Fehler löschen |
| `/api/admin/errors` | DELETE | Alle Fehler löschen |
| `/api/admin/actions` | GET | Audit-Log (paginiert) |

### Error-Logging

- `logError()` in `src/lib/errorLog.ts` — schreibt in `ErrorLog`-Tabelle + `console.error`
- Fire-and-forget: `logError({...}).catch(() => {})` — blockiert nicht den Request

### Admin-Dashboard UI

- `/[locale]/admin` — Server Component mit DB-Rollen-Check
- Tabs: Users | Presets | Errors | Audit Log
- Kontextuelle Admin-Actions auf Profilen + Galerie-Karten (`AdminActions` Component)
- Navbar: Admin-Link ganz rechts, roter Dot bei Error-Count > 0

---

## i18n-Konventionen

- `routing.ts` exportiert typisierte Navigation: `import { Link, useRouter, usePathname } from '@/i18n/routing'`
- Nie `next/link` oder `next/navigation` direkt importieren (Ausnahme: `redirect()` in Server Components — next-intl's redirect benötigt `{ href: string }`)
- Alle UI-Strings über `useTranslations()` / `getTranslations()` (kein Hardcoding)
- Translations in `messages/de.json` und `messages/en.json`
- Namespaces: `nav`, `home`, `editor`, `auth`, `profile`, `presets`, `gallery`, `admin`

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
npm run test              # 312 Unit-Tests (Vitest)
npm run test:coverage     # Coverage-Report
npm run test:e2e          # Playwright E2E (App + Garage + DB erforderlich)
```

Unit-Tests in `tests/unit/`:
- `BinaryParser.test.ts`, `BufferGenerator.test.ts`, `types.test.ts`
- `PRSTDecoder.test.ts`, `PRSTEncoder.test.ts` — inkl. Tests gegen echte .prst-Dateien
- `SysExCodec.test.ts` — Toggle, ParamChange, Reorder, Handshake, EXP Assignment (64 Tests)
- `effectNames.test.ts` — Effekt-ID→Name Auflösung
- `effectParams.test.ts` — Parameter-Definitionen
- `useMidiDevice.test.ts` — MIDI Hook Tests
- `validators.preset.test.ts` — Upload/Patch Schema + author/style/publish
- `usePreset.test.ts`, `smoke.test.ts`
- `lib/validators.test.ts` – Auth + Profile Schemas (Login akzeptiert Email/Username)
- `validators.admin.test.ts` – Admin-Schemas (Patch/Warn/Query)
- `errorLog.test.ts` – Error-Logging (Prisma-Mock)

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

Das GP-200 ist USB-MIDI class-compliant. Kommunikation per proprietärem MIDI SysEx.

- **Status:** SysEx-Protokoll reverse-engineered ✓, Web MIDI Live-Editing hardware-verifiziert ✓
- **Code:** `src/core/SysExCodec.ts`, `src/hooks/useMidiDevice.ts`, `src/components/DeviceStatusBar.tsx`, `src/components/DeviceSlotBrowser.tsx`
- **Vollständiges SysEx-Protokoll:** **`docs/sysex-protocol.md`**
- **Deployment & Hardware-Testing:** **`docs/deployment.md`**
- **Auto-Reconnect:** 3× Retry bei Disconnect
- **Auto-Load:** 256 Preset-Namen im Hintergrund nach Connect
- **Operation Serialization:** `pauseNameLoading()` vor Pull/Push/Write
- Web MIDI nur in Chrome/Edge (kein Firefox/Safari)
- **Nie `loadPresetNames` ohne Abbruchmechanismus** — kann Firmware-Update-Popup auslösen

### MIDI CC Steuerung (aus offiziellem Manual V1.8.0)

| CC# | Range | Funktion |
|-----|-------|----------|
| 7 | 0-100 | Patch Volume |
| 11 | 0-100 | EXP 1 |
| 13 | 0-127 | EXP1 A/B (0-63=A, 64-127=B) |
| 16/18/20 | 0-100 | Quick Access Knobs 1/2/3 |
| 48-57 | 0-127 | Module on/off: PRE(48), DST(49), AMP(50), NR(51), CAB(52), EQ(53), MOD(54), DLY(55), RVB(56), WAH(57) |
| 69-72, 76-79 | 0-127 | CTRL 1-8 |
| 73+74 | | Tempo: CC73=MSB(0-1), CC74=40-127(low) oder 0-122(high+128) → 40-250 BPM |
| 92-95 | 0-127 | Drum: on/off(92), Play/Stop(93), Pattern(94, 0-99), Volume(95, 0-100) |

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
