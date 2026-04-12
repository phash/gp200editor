# API Reference

## Storage (Garage S3)

- Zwei getrennte Buckets: `avatars` (GARAGE_BUCKET) und `presets` (GARAGE_PRESET_BUCKET)
- **Wichtig:** `presetBucket()` und `bucket()` in `storage.ts` lesen verschiedene Env-Vars — nie zusammenführen
- Avatar-Proxy: `/api/avatar/[key]` — Garage-Credentials nie dem Client exponieren
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
| `GET /api/share/[token]` | Nein | Öffentliche Preset-Info |
| `GET /api/share/[token]/download` | Nein | Öffentlicher Download (zählt downloadCount) |
| `POST /api/presets/[id]/rate` | Ja | Rating abgeben (1-5) — kein eigenes Preset |
| `GET /api/gallery` | Nein | Galerie-Presets (sort: newest/popular/top-rated, filter: style/modules/effects) |

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
