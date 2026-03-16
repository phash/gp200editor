# GP-200 Editor – CLAUDE.md

Inoffizieller Browser-Editor für Valeton GP-200 Gitarren-Multi-Effektpedal Preset-Dateien (`.prst`).

## Projekt-Überblick

- **Zweck:** `.prst` Preset-Dateien im Browser laden, bearbeiten, speichern, teilen
- **GitHub:** https://github.com/phash/gp200editor
- **Stack:** Next.js 14 App Router · TypeScript strict · Tailwind CSS · Prisma 5 · PostgreSQL 16 · Lucia v3 · Garage S3 · next-intl 4 (DE/EN)
- **Tests:** Vitest (Unit) · Playwright + @axe-core/playwright (E2E + A11y)
- **Ziel:** WCAG 2.1 AA

---

## Entwicklung

```bash
npm install --legacy-peer-deps   # legacy-peer-deps wegen lokaler npm-Version (11.x vs lock-file)
npm run dev                      # http://localhost:3000
npm run test                     # Vitest Unit-Tests (65 Tests)
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
# Alle Services starten (PostgreSQL 16, Garage S3, Mailhog)
docker compose up -d

# Garage initialisieren (einmalig nach erstem Start)
bash scripts/garage-init.sh
# → gibt GARAGE_ACCESS_KEY_ID und GARAGE_SECRET_ACCESS_KEY aus → in .env.local eintragen

# Datenbankmigrationen
npx prisma migrate dev

# App starten
npm run dev
```

### Docker Image (Production)

```bash
docker build -t gp200editor .
docker run -d -p 3000:3000 --name gp200editor gp200editor
```

### Dockerfile-Details

- Basis-Image: `node:23-alpine` (drei Stages: deps → builder → runner)
- `output: 'standalone'` in `next.config.mjs` für Docker-kompatiblen Build
- Non-root User `nextjs:nodejs` (UID/GID 1001)

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
│   ├── BinaryParser.ts      # DataView-basierter Reader
│   ├── BufferGenerator.ts   # DataView-basierter Writer
│   ├── PRSTDecoder.ts       # .prst → GP200Preset (⚠ PLACEHOLDER, s.u.)
│   └── PRSTEncoder.ts       # GP200Preset → .prst (⚠ PLACEHOLDER, s.u.)
│
├── hooks/
│   └── usePreset.ts         # React-State: loadPreset, setPatchName, toggleEffect, reset
│
├── components/
│   ├── Navbar.tsx            # Auth-Status, Locale-Switcher, Links (Profile, Presets)
│   ├── FileUpload.tsx        # Drag & Drop + Keyboard (WCAG)
│   ├── EffectSlot.tsx        # Ein Effekt-Slot (aria-pressed, data-testid)
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
│   ├── editor/page.tsx       # Editor: FileUpload + 11x EffectSlot
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
```

---

## Datenbankschema (Prisma)

```prisma
User          id, email, username, passwordHash, bio, website, avatarKey, createdAt
Session       id, userId, expiresAt  (Lucia v3)
PasswordResetToken  id, userId, token, expiresAt, usedAt
Preset        id, userId, presetKey, name(VarChar32), description, tags(String[]),
              shareToken(@unique), downloadCount, createdAt, updatedAt
              @@index([userId])
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
| `POST /api/presets` | Ja | Upload + PRST-Validierung (512 Bytes) |
| `GET /api/presets` | Ja | Alle Presets des Users |
| `PATCH /api/presets/[id]` | Ja (Owner) | Metadaten/File ersetzen |
| `DELETE /api/presets/[id]` | Ja (Owner) | Löschen |
| `GET /api/presets/[id]/download` | Ja (Owner) | Download |
| `POST /api/presets/[id]/share/revoke` | Ja (Owner) | Share-Link widerrufen |
| `GET /api/share/[token]` | Nein | Öffentliche Preset-Info |
| `GET /api/share/[token]/download` | Nein | Öffentlicher Download (zählt downloadCount) |

---

## i18n-Konventionen

- `routing.ts` exportiert typisierte Navigation: `import { Link, useRouter, usePathname } from '@/i18n/routing'`
- Nie `next/link` oder `next/navigation` direkt importieren (Ausnahme: `redirect()` in Server Components — next-intl's redirect benötigt `{ href: string }`)
- Alle UI-Strings über `useTranslations()` / `getTranslations()` (kein Hardcoding)
- Translations in `messages/de.json` und `messages/en.json`
- Namespaces: `nav`, `home`, `editor`, `auth`, `profile`, `presets`

---

## .prst Binärformat — Echte Dateien (Reverse Engineered, 2026-03-16)

**Alle bekannten echten .prst-Dateien sind exakt 1224 Bytes** (User-Presets; Factory-Presets: 1176 Bytes).

> ⚠️ **Code-Hinweis:** `PRSTDecoder.ts` und `PRSTEncoder.ts` verwenden aktuell Platzhalter-Werte (512 Bytes, Magic `'PRST'` an Offset 0). Das ist noch nicht das finale Format — die TODOs in diesen Dateien markieren die offenen Punkte. Die unten stehende Dokumentation beschreibt das **echte Hardware-Format**.

### Datei-Header (0x00–0x2F, 48 Bytes)

| Offset | Größe | Inhalt                          |
|--------|-------|---------------------------------|
| 0x00   | 4     | Magic: `TSRP` ("PRST" reversed) |
| 0x10   | 4     | Device ID: `2-PG` ("GP-2" rev.) |
| 0x14   | 4     | Firmware-Version: `00 01 01 00` |
| 0x1C   | 4     | Timestamp / Preset-ID           |
| 0x28   | 4     | Chunk-Marker: `MRAP`            |
| 0x2C   | 4     | Chunk-Größe (LE uint32 = 1172)  |

### Preset-Name (0x44–0x7F)

- Null-terminierter ASCII-String ab Offset 0x44
- Max. ~48 Zeichen

### Effekt-Blöcke (0xa0–0x3AF, 11× 72 Bytes)

```
+0   4  Marker: 14 00 44 00
+4   1  Slot-Index (0–10)
+5   1  Aktiv-Flag (0 = bypass, 1 = aktiv)
+6   2  Konstante: 0x000F
+8   2  Model-ID (LE uint16)
+12  60 Parameter-Bytes (LE float32 × 15)
```

**Wichtig:** Blockgröße = **72 Bytes (0x48)**, nicht 64 (0x40).

### Checksum (letzte 2 Bytes, 0x4C6)

LE uint16; Algorithmus unbekannt.

---

## Tests

```bash
npm run test              # 65 Unit-Tests (Vitest)
npm run test:coverage     # Coverage-Report
npm run test:e2e          # Playwright E2E (App + Garage + DB erforderlich)
```

Unit-Tests in `tests/unit/`:
- `BinaryParser.test.ts`, `BufferGenerator.test.ts`, `types.test.ts`
- `PRSTDecoder.test.ts`, `PRSTEncoder.test.ts`, `usePreset.test.ts`, `smoke.test.ts`
- `lib/validators.test.ts` – Auth + Profile Schemas
- `validators.preset.test.ts` – uploadPresetSchema + patchPresetSchema (18 Tests)

E2E-Tests in `tests/e2e/`:
- `editor.spec.ts` – Datei-Upload, Preset-Anzeige, Effekt-Toggle
- `a11y.spec.ts` – WCAG 2.1 AA mit axe-core
- `auth.spec.ts` – Register, Login, Logout, Passwort-Reset
- `profile.spec.ts` – Profil bearbeiten, Avatar
- `presets.spec.ts` – Preset hochladen, teilen, bearbeiten, löschen, Link widerrufen

---

## Nicht tun

- `npm ci` verwenden (Lock-File-Inkompatibilität mit Docker-npm-Version)
- `next/link` oder `next/navigation` direkt in Client-Components importieren (immer `@/i18n/routing`)
- UI-Strings hardcoden (immer `useTranslations` / `getTranslations`)
- `@lucia-auth/adapter-prisma@1.0.0` — das ist Lucia v1/v2; Lucia v3 braucht `@4.0.1`
- Zod `.errors` verwenden — in Zod v4 heißt es `.issues`
- `GARAGE_BUCKET` für Presets verwenden — das ist für Avatare; `GARAGE_PRESET_BUCKET` für Presets
- `bucket()` und `presetBucket()` in `storage.ts` zusammenführen
- Den `matcher` in `middleware.ts` ändern — next-intl braucht den breiten Matcher; Auth-Guards als `if`-Blöcke im Body hinzufügen
