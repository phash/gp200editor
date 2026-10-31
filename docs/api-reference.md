# API Reference

## Storage (Garage S3)

- Drei getrennte Buckets: `avatars` (GARAGE_BUCKET), `presets` (GARAGE_PRESET_BUCKET) und Audio-Snippets (GARAGE_AUDIO_BUCKET, prod `gp200editor-audio`)
- **Wichtig:** `bucket()`, `presetBucket()` und `audioBucket()` in `storage.ts` lesen verschiedene Env-Vars — nie zusammenführen
- Proxies: `/api/avatar/[key]` und `/api/preset-audio/[key]` — Garage-Credentials nie dem Client exponieren
- Dateiersatz-Reihenfolge: neues File uploaden → DB updaten → altes File löschen (`.catch(() => {})`)

## Preset-API

| Route | Auth | Beschreibung |
|-------|------|--------------|
| `POST /api/presets` | Ja | Upload + PRST-Validierung (1224 Bytes) |
| `GET /api/presets` | Ja | Alle Presets des Users |
| `PATCH /api/presets/[id]` | Ja (Owner) | Metadaten/File ersetzen |
| `DELETE /api/presets/[id]` | Ja (Owner) | Löschen |
| `GET /api/presets/[id]/download` | Ja (Owner) | Download |
| `POST /api/presets/[id]/share/revoke` | Ja (Owner) | Share-Link widerrufen |
| `POST /api/presets/[id]/publish` | Ja (Owner, verifiziert) | `public` umschalten (Toggle) |
| `POST /api/presets/[id]/audio` | Ja (Owner/Admin, verifiziert) | Audio-Snippet hochladen (max. 2 MB, max. 30 s) |
| `DELETE /api/presets/[id]/audio` | Ja (Owner/Admin) | Audio-Snippet löschen |
| `GET /api/preset-audio/[key]` | Nein* | Audio-Stream; *nur wenn Preset public + nicht geflaggt (Owner/Admin immer) |
| `GET /api/share/[token]` | Nein | Öffentliche Preset-Info |
| `GET /api/share/[token]/download` | Nein | Öffentlicher Download (zählt downloadCount) |
| `GET /api/share/[token]/json` | Nein | Round-trip `PresetJson` (nur public, nicht geflaggt) |
| `POST /api/presets/[id]/rate` | Ja | Rating abgeben (1-5) — kein eigenes Preset |
| `GET /api/gallery` | Nein | Galerie-Presets (sort: newest/popular/top-rated, filter: style/modules/effects) |

## Kommentar-API

Mutierende Routen prüfen CSRF (`verifyCsrf`); Kommentieren nur auf public + nicht geflaggten Presets.

| Route | Auth | Beschreibung |
|-------|------|--------------|
| `GET /api/presets/[id]/comments` | Nein | Kommentar-Threads eines Presets |
| `POST /api/presets/[id]/comments` | Ja (verifiziert) | Top-Level-Kommentar (max. 1000 Zeichen) |
| `POST /api/comments/[id]/reply` | Ja (verifiziert) | Antwort auf Kommentar |
| `PATCH /api/comments/[id]` | Ja (Autor, verifiziert) | Bearbeiten (Rate-Limit 30/h) |
| `DELETE /api/comments/[id]` | Ja (Autor/Admin) | Soft-Delete (`body=null`, `deletedAt`, `deletedBy`) |

## Feedback-API

| Route | Auth | Beschreibung |
|-------|------|--------------|
| `POST /api/feedback` | Ja (verifiziert) | Feedback-Formular `/feedback`. Body: `category` (`BUG`/`IDEA`/`GENERAL`), `message` (10–2000 Zeichen), `pagePath?` (nur same-origin Pfad), `locale?`, Honeypot `company_url`. Schutz: CSRF → `requireVerifiedUser` → Rate-Limit 3/h + 10/Tag pro User → Honeypot (stilles 201) → Duplikat derselben Nachricht in 24 h (409). Mail an `ADMIN_EMAIL` (`sendFeedbackEmail`, Reply-To = User), Mail-Fehler blockieren nicht |

## Sonstige

| Route | Auth | Beschreibung |
|-------|------|--------------|
| `GET/PATCH /api/profile`, `POST /api/profile/avatar` | Ja | Profil + Avatar-Upload |
| `GET /api/health` | Nein | Readiness: `SELECT 1` gegen Postgres + `HeadBucket` auf den Preset-Bucket (je 3 s Timeout). 200 `{status:'ok', checks:{database,storage}}` oder 503 `status:'error'`; nur ok/ms, keine Fehlertexte; `no-store`. Genutzt von Docker-Healthcheck, `deploy-update.sh`, Uptime-Monitoren |
| `POST /api/errors/client` | Nein | Client-Render-Fehler aus `error.tsx` → `ErrorLog` (Rate-Limit 30/min/IP) |
| `POST /api/cron/verify-reminders` | Bearer `CRON_SECRET` | Verify-Reminder D2/D7 (siehe deployment.md) |
| `POST /api/test/backdate-user` | nur dev/test (`NODE_ENV`) | E2E-Hilfsroute |

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
| `/api/admin/errors` | GET | Error-Liste (paginiert; Filter: q, severity, category, resolved) |
| `/api/admin/errors` | PATCH | Als gelöst/ungelöst markieren (per `fingerprint` oder `ids`) |
| `/api/admin/errors/[id]` | DELETE | Einzelnen Fehler löschen |
| `/api/admin/errors` | DELETE | Alle Fehler löschen |
| `/api/admin/actions` | GET | Audit-Log (paginiert) |
| `/api/admin/comments` | GET | Kommentar-Moderationsliste |
| `/api/admin/feedback` | GET | Feedback-Liste (Cursor, Filter `status`/`category`) + Zähler pro Status |
| `/api/admin/feedback/[id]` | PATCH | Status setzen (`NEW`/`READ`/`DONE`) |

### Error-Logging

- `logError()` in `src/lib/errorLog.ts` — schreibt in `ErrorLog`-Tabelle + `console.error`
- Fire-and-forget: `logError({...}).catch(() => {})` — blockiert nicht den Request

### Admin-Dashboard UI

- `/[locale]/admin` — Server Component mit DB-Rollen-Check
- Tabs: Users | Presets | Errors | Audit Log | Comments | Feedback
- Deep-Link per `?tab=<name>` (z. B. aus Feedback-/Fehler-Mails)
- Kontextuelle Admin-Actions auf Profilen + Galerie-Karten (`AdminActions` Component)
- Navbar: Admin-Link ganz rechts, roter Dot bei Error-Count > 0
