# Tests

```bash
npm run test              # Unit-Tests (Vitest)
npm run test:coverage     # Coverage-Report
npm run test:e2e          # Playwright E2E (App + Garage + DB erforderlich)
```

## Unit-Tests (`tests/unit/`)

- `BinaryParser.test.ts`, `BufferGenerator.test.ts`, `types.test.ts`
- `PRSTDecoder.test.ts`, `PRSTEncoder.test.ts` — inkl. Tests gegen echte .prst-Dateien + Dateigröße + Checksum-Roundtrip
- `SysExCodec.test.ts` — Toggle, ParamChange, Reorder, Handshake, EXP, EffectChange, PatchSetting (88 Tests)
- `effectNames.test.ts` — Effekt-ID→Name Auflösung
- `effectParams.test.ts` — Parameter-Definitionen
- `useMidiDevice.test.ts` — MIDI Hook Tests
- `validators.preset.test.ts` — Upload/Patch Schema + author/style/publish
- `usePreset.test.ts`, `smoke.test.ts`
- `lib/validators.test.ts` – Auth + Profile Schemas (Login akzeptiert Email/Username)
- `validators.admin.test.ts` – Admin-Schemas (Patch/Warn/Query)
- `errorLog.test.ts` – Error-Logging (Prisma-Mock)

## E2E-Tests (`tests/e2e/`)

- `editor.spec.ts` – Datei-Upload, Preset-Anzeige, Effekt-Toggle
- `a11y.spec.ts` – WCAG 2.1 AA mit axe-core
- `auth.spec.ts` – Register, Login, Logout, Passwort-Reset
- `profile.spec.ts` – Profil bearbeiten, Avatar
- `presets.spec.ts` – Preset hochladen, teilen, bearbeiten, löschen, Link widerrufen
- `save-and-gallery.spec.ts` – Save-Dialog, Galerie-Suche/Filter, Gallery→Editor Link
- `ratings.spec.ts` – Preset-Ratings: Anzeige, Bewerten, Persistenz, Editor-Widget

## E2E-Konventionen (wichtig für parallele Tests)

- Register-Helper: Mailhog-Suche per Recipient (`/api/v2/search?kind=to&query=EMAIL`) — kein globaler DELETE
- Email-Body ist Quoted-Printable: `raw.replace(/=\r?\n/g,'').replace(/=([0-9A-Fa-f]{2})/g, ...decode...)`
- Rate Limiting ist in `NODE_ENV !== 'production'` deaktiviert (für parallele Test-Registrierungen)
- `.prst`-Dateien für Tests: `prst/63-B American Idiot.prst` (author=Galtone Studio, DST aktiv), `prst/63-C claude1.prst` (author leer, DST aktiv aber Round-Trip verliert DST — Bug #53)
- Gallery-Locators: immer `.first()` — mehrere Presets gleichen Namens akkumulieren im Test-DB
