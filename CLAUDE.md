# Preset Forge — GP-200 Editor – CLAUDE.md

Inoffizieller Browser-Editor für Valeton GP-200 Gitarren-Multi-Effektpedal Preset-Dateien (`.prst`).
Live USB-MIDI Editing, Preset-Galerie, Community-Sharing.

## Projekt-Überblick

- **Name:** Preset Forge
- **Domain:** https://preset-forge.com
- **Zweck:** `.prst` Preset-Dateien im Browser laden, bearbeiten, speichern, teilen, live per USB-MIDI ans Gerät senden
- **GitHub:** https://github.com/phash/gp200editor
- **Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Tailwind CSS · Prisma 5 · PostgreSQL 16 · Lucia v3 · Garage S3 · next-intl 4 (DE/EN/ES/FR/IT/PT/pt-BR — 7 Locales)
- **Tests:** Vitest · Playwright + @axe-core/playwright (E2E + A11y)
- **Ziel:** WCAG 2.1 AA
- **UI:** Dark pedalboard theme (JetBrains Mono + DM Sans, Amber-Akzente, LED-Style Buttons)

---

## Entwicklung

```bash
npm install --legacy-peer-deps   # IMMER --legacy-peer-deps (npm 11.x vs Docker npm 10.x)
npm run dev                      # http://localhost:3000
npm run test                     # Vitest Unit-Tests
npm run test:e2e                 # Playwright E2E (App muss laufen + Garage + DB)
npm run lint                     # ESLint
npm run build                    # Production Build
npm run ci                       # Lokale CI: lint + typecheck + test + build (ersetzt GH Actions)
bash scripts/local-ci.sh lint typecheck   # Einzelne Stages
npx vitest run path/test.ts -t "pattern"  # Single-File + Test-Name-Grep (schnelles TDD-Iterate)
```

**Prod-Deploy:** `ssh musikersuche@musikersuche.org` → `cd /opt/gp200editor && bash scripts/deploy-update.sh`
**Prod-SQL:** `source .env.prod && docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"`

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
├── components/              # Navbar, FileUpload, EffectSlot, EffectParams, AmpHeadPanel,
│                            #   ControllerPanel, AdminDashboard, AdminActions, CuePointTable,
│                            #   ConfirmDialog, WarnDialog, LocaleSwitcher, Footer,
│                            #   YouTubeEmbed, audio/ (AudioPlayer + Provider, 30s Preset-Snippets)
│
├── lib/                     # auth.ts (Lucia v3), prisma.ts, session.ts, admin.ts,
│                            #   errorLog.ts, email.ts, storage.ts, validators.ts
│
├── app/[locale]/            # layout, page (Home), editor, auth/, admin, profile/, presets/, share/,
│                            #   playlists/, gallery/, changelog/, help/, legal/
├── app/api/                 # auth/, admin/, profile/, avatar/, presets/, share/, gallery
├── i18n/                    # routing.ts, request.ts
└── middleware.ts            # next-intl + Auth-Guards
```

---

## i18n-Konventionen

- `routing.ts` exportiert typisierte Navigation: `import { Link, useRouter, usePathname } from '@/i18n/routing'`
- Nie `next/link` oder `next/navigation` direkt importieren (Ausnahme: `redirect()` in Server Components)
- Alle UI-Strings über `useTranslations()` / `getTranslations()` (kein Hardcoding)
- Translations in `messages/{de,en,es,fr,it,pt,pt-BR}.json` — 7 Locales, Key-Parität per Unit-Test erzwungen
- Hreflang: `src/lib/hreflang.ts` mit `buildAlternates(path, locale)` — nie inline schreiben

---

## USB-Gerätekommunikation

- **Status:** SysEx-Protokoll reverse-engineered ✓, Web MIDI Live-Editing hardware-verifiziert ✓
- **Code:** `src/core/SysExCodec.ts`, `src/hooks/useMidiDevice.ts`, `src/hooks/useMidiSend.ts`
- **Live-Push beim Preset-Laden:** `src/core/devicePush.ts` — Sequenz effect-change→400ms settle→params (40ms gespaced)→toggle, 2 Pässe, param0-Re-Send, abbrechbar via `AbortSignal` + `onProgress` (#80)
- **Vollständiges SysEx-Protokoll:** **`docs/sysex-protocol.md`**
- Web MIDI nur in Chrome/Edge (kein Firefox/Safari)
- **Nie `loadPresetNames` ohne Abbruchmechanismus** — kann Firmware-Update-Popup auslösen

---

## Referenz-Dokumente

| Thema | Datei |
|-------|-------|
| Test-Fixtures (.prst) | `planung/*.prst` (1224B Beispiele), `prst/*.prst` (Ingest-Testset) |
| Datenbankschema (Prisma) | [`docs/database-schema.md`](docs/database-schema.md) |
| Auth (Lucia v3) + Anti-Spam | [`docs/auth.md`](docs/auth.md) |
| API-Referenz (Preset + Admin + Storage) | [`docs/api-reference.md`](docs/api-reference.md) |
| .prst Binärformat | [`docs/prst-format.md`](docs/prst-format.md) |
| Tests + E2E-Konventionen | [`docs/testing.md`](docs/testing.md) |
| Library / Preset-Ingest | [`docs/library-ingest.md`](docs/library-ingest.md) |
| SysEx-Protokoll (USB MIDI) | [`docs/sysex-protocol.md`](docs/sysex-protocol.md) |
| Deployment + Docker + Hardware | [`docs/deployment.md`](docs/deployment.md) |
| USB-Capture-Analyse (SysEx RE) | [`docs/capture-catalog.md`](docs/capture-catalog.md) · `scripts/analyze-sysex.py <cap.pcap>` · `scripts/build-capture-catalog.py` (Rohdaten in `caps/`, gitignored) |

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
- Den `matcher` in `middleware.ts` ändern — next-intl braucht den breiten Matcher; Auth-Guards als `if`-Blöcke im Body
- `Content-Length` hardcoden in Download-Responses — immer aus `buffer.length` berechnen
- Garage S3 Stream direkt an NextResponse übergeben — in Standalone-Build hängt der Stream, immer erst in Buffer lesen
- Prod manuell mit `docker compose up -d --build app` deployen — immer `bash scripts/deploy-update.sh`
- `inline style={}` mit `onMouseEnter`/`onMouseLeave` für Hover-Effekte — immer Tailwind `hover:` Klassen
- `DELETE /api/v1/messages` in Mailhog-Tests — killt parallele Test-Emails; stattdessen `/api/v2/search?kind=to&query=EMAIL`
- `writeTempPreset()` mit 512 Bytes — API erwartet 1224 Bytes mit TSRP-Magic
- `validateSession()` mit Argumenten aufrufen — es liest cookies intern (keine Parameter)
- CSP-Header im Caddyfile für `preset-forge.com` setzen — CSP wird ausschließlich von Next.js verwaltet (`next.config.mjs`)
- Honeypot-Feld `website` nennen — kollidiert mit `User.website`; aktueller Name: `company_url`
- `sitemap.ts` mit `revalidate` alleine dynamisch machen — immer `export const dynamic = 'force-dynamic'`
- Vergessen `metadataBase` im root layout zu setzen — sonst `http://localhost:3000/...` in og:image
- `new NextResponse(buffer, {...})` ohne cast — `new NextResponse(buffer as BodyInit, {...})`
- JSON-LD ohne script-tag escape — `JSON.stringify(obj).replace(/</g, '\\u003c')`
- CSP `'unsafe-eval'` in prod weglassen — Matomo + Next 15 runtime brauchen es
- Neue Spalten in `/api/gallery` response weglassen — Frontend erwartet `shareToken`
- `page.goto()` in E2E ohne `waitUntil: 'domcontentloaded'` — default `'load'` hängt auf Matomo
- Playwright-Tests mit vollem `/tmp` — `TMPDIR=/home/manuel/.tmp-playwright npx playwright test`
- Inline locale type literals `'de' | 'en'` hardcoden — IMMER alle 7 Locales oder `Locale` aus `@/lib/hreflang`
- `otherLocale = locale === 'de' ? 'en' : 'de'` Toggle-Pattern — `<LocaleSwitcher />` verwenden
- `next-intl` `requireVerifiedUser` ohne `refreshSessionCookie` — ist intern schon drin
- `z.instanceof(Uint8Array)` mit einem Node `Buffer` füttern — `fs.readFileSync()` gibt `Buffer` zurück, Zod v4 lehnt das ab. Immer `new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))`
- `slotIndex` in Reorder-Operationen überschreiben — `slotIndex` ist die PRST-Block-Identität (0=PRE, …10=VOL), unveränderlich. Drag&Drop ändert nur Array-Order, nie `slotIndex`
- `interParamDelayMs` in `devicePush.ts` unter ~40ms setzen — das Gerät schluckt schnelle Param-Bursts (erste Param-Change je Block geht verloren); echte Captures zeigen nie <19ms zwischen Param-Writes (#80)
- `@import url('https://fonts.googleapis.com/...')` oder andere externe Font-CDNs — Fonts laufen via `next/font/google` (Build-Time self-host); externe Imports brechen DSGVO-Compliance (LG München 3 O 17493/20)
- Matomo-Script ohne `_paq.push(["disableCookies"])` + `_paq.push(["setDoNotTrack", true])` deployen — beide Flags MÜSSEN vor `trackPageView` stehen, sonst widerspricht der Code der Datenschutzerklärung
- `youtube.com/embed/...` für Iframes verwenden — IMMER `youtube-nocookie.com/embed/...` (CSP `frame-src` erlaubt nur die nocookie-Domain)
