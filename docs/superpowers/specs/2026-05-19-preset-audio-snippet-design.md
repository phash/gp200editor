# Preset Audio Snippet — Design Spec

**Date:** 2026-05-19
**Status:** Approved, ready for implementation plan
**Scope:** User können einen ≤30 s langen MP3/M4A/AAC-Soundschnipsel als Audio-Beispiel ihrem Preset anhängen. Player erscheint auf der Share-Page (voll), im Featured-Block (kompakt) und auf jeder Gallery-Card (Icon). Owner und Admin können hochladen, ersetzen, entfernen; Admin-Aktionen werden auditiert.

## Goal

Presets sind heute rein textuell + Signal-Chain — ein 30-Sekunden-Hörbeispiel lässt User direkt entscheiden, ob der Tone zu ihrem Song passt, bevor sie das Preset downloaden. Browser-only, kein Recording-Modul im Frontend nötig.

## Non-Goals

- Browser-Trim-UI (Waveform + Slider zum Range-Auswählen)
- Waveform-Visualisierung im Player
- Mehrere Audio-Alternates pro Preset (User-Submissions)
- Auto-Play / Continuous-Listen-Modus
- Server-side Transcoding zu einheitlichem Format
- Volume-Slider im Custom-Player (nutze native System-Lautstärke)
- Audio-Captions / Lyrics
- Cross-Tab-Koordination der Player

## User-Entscheidungen (Quelle: AskUserQuestion 2026-05-19)

1. Längen-Validation: **Server-Reject** bei > 30 s (mit 0.5 s Toleranz wegen Encoder-Padding); kein Trim, kein ffmpeg.
2. Format: **MP3 + M4A/AAC**, max **2 MB**.
3. Player-Stellen: **Share-Page (must) + Featured-Block + Gallery-Card** (Icon-Variante).
4. Permissions: **Owner + Admin** (Admin kann ersetzen/löschen, schreibt AdminAction).
5. Upload-Flow: **In SavePresetDialog beim Publish** (optional) + **nachträglich auf /share/[token]** für bestehende Presets.
6. Multi-Player: **Nur ein Player gleichzeitig** (Global Audio Provider pausiert alle anderen beim Play).

## Approach Decisions

- **Längen-Validation:** `music-metadata` npm-Paket (pure JS, parst ID3-Header + MP4 `mvhd`-Atom, gibt `duration` in Sekunden). Keine Docker-Dependency, kein ffprobe.
- **Multi-Player-Koordination:** React Context `AudioPlayerProvider` mit `currentlyPlayingRef: HTMLAudioElement | null`. Beim Play eines Players wird der vorherige gepaust.

## Architecture

### Storage

- Neuer Garage S3-Bucket: `GARAGE_AUDIO_BUCKET` (env var), getrennt von Avatar (`GARAGE_BUCKET`) und Preset (`GARAGE_PRESET_BUCKET`).
- Key-Pattern: `preset-{presetId}-{timestamp}.{ext}` — Timestamp im Key sorgt für implizites Cache-Busting bei Replace.
- Content-Type aus Upload übernommen (`audio/mpeg`, `audio/mp4`, `audio/aac`).
- GET-Response: `Cache-Control: public, max-age=31536000, immutable` — Key ändert sich beim Replace, also safe.

### Neue API-Routes

| Method | Path | Auth | Zweck |
|---|---|---|---|
| `POST` | `/api/presets/[id]/audio` | Owner oder Admin (Session + Verified) | Upload eines neuen Audio-Snippets; ersetzt vorhandenen automatisch. |
| `DELETE` | `/api/presets/[id]/audio` | Owner oder Admin | Entfernt Audio (S3 + DB-Felder null). Admin-on-foreign-Preset schreibt AdminAction mit `reason`. |
| `GET` | `/api/preset-audio/[key]` | öffentlich | Stream/Buffer des Audio-Files mit Key-Pattern-Validation, immutable Cache. |

### Rate-Limit

`audio-upload:${user.id}` — 5 / Stunde (analog Avatar — der Upload führt music-metadata + S3-PUT aus).

### Schema-Änderung `Preset`

```prisma
model Preset {
  // ... bestehende Felder
  audioKey         String?  // S3 key in audio bucket; null = no clip
  audioMimeType    String?  // 'audio/mpeg' | 'audio/mp4' | 'audio/aac'
  audioDurationMs  Int?     // für Display ("0:28") + aria-label
}
```

Keine zusätzlichen Indizes; keine Backlinks/Cascades nötig (S3-Cleanup geschieht in der Delete-Route oder im Preset-Delete-Flow).

### Validation-Pipeline (Server-side, Upload)

1. CSRF-Check, Session-Check, Role-Check (Owner OR Admin), Rate-Limit.
2. FormData `audio=<File>` lesen.
3. Mime-Type ∈ `{audio/mpeg, audio/mp4, audio/x-m4a, audio/aac}`.
4. Magic-Bytes der ersten 12 Bytes:
   - MP3: `49 44 33` (ID3-Header) ODER `FF Fx` (raw MPEG-Frame-Sync, wobei `x` mp3-version-bits sind).
   - MP4/M4A: bytes `[4..7]` == `66 74 79 70` (`"ftyp"`).
5. Size ≤ 2 MB.
6. `music-metadata.parseBuffer(buf)` → `metadata.format.duration` (Sekunden, float).
7. Duration ≤ 30.5 s.
8. → S3 PUT (neuer Key) → DB UPDATE (audioKey/Mime/DurationMs) → alten Key best-effort aus S3 löschen.
9. → Bei Admin-on-foreign: `prisma.adminAction.create({ action: 'REPLACE_PRESET_AUDIO', targetType: 'preset', targetId, reason? })`.
10. Response: `{ audioKey, audioUrl, audioMimeType, audioDurationMs }`.

Bei jedem Fail vor S3 PUT: 400 mit klarem `error`-String aus i18n (`audio.upload.tooBig` / `tooLong` / `wrongType`).

## UI / Components

### Neue Komponenten

| Komponente | Datei | Typ | Verantwortung |
|---|---|---|---|
| `AudioPlayerProvider` | `src/components/audio/AudioPlayerProvider.tsx` | Client | Context an der Root-Position. Hält `currentlyPlayingRef: HTMLAudioElement \| null`. Pausiert alle anderen `<audio>`-Elemente sobald `notifyPlay(el)` aufgerufen wird. |
| `AudioPlayer` | `src/components/audio/AudioPlayer.tsx` | Client | Wrapper um natives `<audio>` mit eigenen Buttons. Props: `src: string`, `mime: string`, `durationMs: number`, `variant: 'full' \| 'icon'`. `preload="none"` — Datei wird erst beim Klick gefetched. Registriert sich beim Provider. Tastatur: Space togglet, Pfeile ±2 s. ARIA: `role="application"` + `aria-label` mit Dauer. |
| `AudioUploadField` | `src/components/audio/AudioUploadField.tsx` | Client | File-Input + Vorschau + Replace/Remove-Buttons. Client-Pre-Filter (Mime/Size für bessere UX, Server validiert nochmal). Optimistic UI mit Rollback bei 4xx/5xx. Verwendet in SavePresetDialog + auf Share-Page. |

### Geänderte Komponenten

- `src/components/SavePresetDialog.tsx`: `<AudioUploadField>` unterhalb der Description. Bei Submit sequenzielle Requests: Preset POST → wenn ok und Audio gewählt: Audio POST mit der zurückgegebenen Preset-ID. Failure-Behavior: Preset-Save-Fail → Audio nicht hochgeladen (kein Orphan); Audio-Fail → Toast „Preset gespeichert, Audio fehlgeschlagen, in Detailansicht erneut hochladen".
- `src/app/[locale]/share/[token]/page.tsx`: `<AudioPlayer variant="full" />` zwischen Description und Signal-Chain wenn `audioKey` gesetzt. Darunter `<AudioUploadField>` nur für Owner/Admin.
- `src/components/FeaturedPresetBlock.tsx`: `<AudioPlayer variant="icon" />` neben dem `GuitarRating` im Hero wenn `audioKey`.
- `src/app/[locale]/gallery/GalleryClient.tsx`: `<AudioPlayer variant="icon" />` neben `RateableGuitarRating` auf jeder Card.
- `src/app/[locale]/layout.tsx` (oder bestehendes `ClientProviders.tsx`): `<AudioPlayerProvider>` als Root-Wrapper.

### Visuelle Sprache

- **`variant="full"`**: zweizeilig — Play/Pause-Button 32 px mit `border: 1px solid var(--accent-amber-dim)`, Progress-Bar 4 px Höhe (drag-bar), Zeit-Label `0:12 / 0:28` in `font-mono-display`. Disabled-Skelett während `preload="none"`-Phase.
- **`variant="icon"`**: 24 px Button mit Play/Pause-Symbol. Tooltip „0:28 Audio-Vorschau". Morpht zu Pause-Symbol während `playing`.
- Tastatur: Space togglet Play/Pause auf focused Player; Pfeile ±2 s.

### i18n-Keys (neu, in allen 7 Locales)

```
audio.upload.label             "Audio-Schnipsel (optional)"
audio.upload.placeholder       "MP3 oder M4A wählen, max 30 s, max 2 MB"
audio.upload.replace           "Ersetzen"
audio.upload.remove            "Entfernen"
audio.upload.dropHere          "Datei hier ablegen"
audio.upload.picking           "Datei wählen…"
audio.upload.uploading         "Lade hoch…"
audio.upload.success           "Audio gespeichert"
audio.upload.tooLong           "Datei zu lang — max 30 s"
audio.upload.tooBig            "Datei zu groß — max 2 MB"
audio.upload.wrongType         "Format nicht unterstützt — MP3 oder M4A"
audio.upload.notAuthorized     "Nur der Preset-Owner kann Audio hochladen"
audio.upload.genericError      "Upload fehlgeschlagen — bitte erneut versuchen"
audio.player.playLabel         "Abspielen"
audio.player.pauseLabel        "Pause"
audio.player.progressLabel     "Fortschritt {current} von {total}"
audio.player.duration          "{seconds} s Audio-Vorschau"
audio.player.noAudio           "Kein Audio-Beispiel"
gallery.audio.iconLabel        "Vorschau abspielen"
```

Key-Parität via bestehenden `tests/unit/messages-parity.test.ts` automatisch erzwungen.

## Permissions & Edge-Cases

### Permissions-Matrix

| Aktion | Anon | Verifizierter User | Owner | Admin |
|---|---|---|---|---|
| Audio abspielen (GET) | ✓ | ✓ | ✓ | ✓ |
| Audio hochladen / ersetzen | – | – (außer eigenes Preset) | ✓ | ✓ (mit AdminAction) |
| Audio löschen | – | – | ✓ | ✓ (mit AdminAction + reason) |

### Edge-Cases

1. **Preset-Save schlägt fehl, Audio nicht hochgeladen** — kein Orphan (Audio kommt nie ins S3).
2. **Preset-Save klappt, Audio-Upload schlägt fehl** — Toast „Preset gespeichert, Audio fehlgeschlagen, in Detailansicht erneut hochladen"; Preset bleibt publishbar.
3. **Replace während andere User die alte URL streamen** — alter S3-Key wird gelöscht, aktuelle Streams im Browser-Buffer laufen weiter; bei einem Fresh-Request danach 404 → Player zeigt „Datei nicht mehr verfügbar".
4. **Preset wird gelöscht (Cascade)** — Audio-Cleanup im Preset-Delete-Flow vor `prisma.preset.delete`. Best-effort `deleteAudio(audioKey)`; bei Failure: orphaned S3-Object, akzeptabel (Cron-Cleanup als Future).
5. **Admin löscht/ersetzt Audio von fremdem Preset** — AdminAction mit `targetType: 'preset'`, `action: 'DELETE_PRESET_AUDIO'` oder `'REPLACE_PRESET_AUDIO'`, Reason ≥ 5 Zeichen Pflicht.
6. **Preset wird un-published, Audio bleibt im S3** — Akzeptabel: Audio-Keys sind CUID-basiert und nicht ratbar; Keys leaken nicht aus privaten Presets (keine Liste rendert sie). Sollte später ein strikterer Modus gewünscht sein, kann die GET-Route via Key→Preset-Lookup `public/flagged` prüfen.
7. **Duration leicht über 30 s wegen Encoder-Padding** — 0.5 s Toleranz im Server-Check (≤ 30.5 s).
8. **Format-Spoof (Datei sagt .mp3 ist aber WebM)** — Magic-Bytes-Check fängt das ab vor `music-metadata`.
9. **Mehrere Tabs gleichzeitig** — Provider ist tab-lokal; jeder Tab pausiert seine Player. Cross-Tab YAGNI.
10. **Mobile Safari** — natives `<audio>` funktioniert; Auto-Play ist blockiert (haben wir nicht).
11. **ARIA / Screen-Reader** — Player hat `role="application"` + `aria-label` mit Dauer; Buttons haben `aria-pressed` für Play/Pause-State.

### Error-Handling-UX

| Status | UI-Reaktion |
|---|---|
| 400 (Mime/Size/Duration) | Toast mit spezifischem `audio.upload.<reason>`-Key |
| 401 / 403 | Toast `audio.upload.notAuthorized` |
| 429 | Toast `comments.rateLimitToast` (reuse) |
| 5xx | Toast `audio.upload.genericError` mit Retry-Button |

## Datenfluss

**Upload**

```
[User] → AudioUploadField
   1. File ausgewählt → clientseitig Mime/Size-Pre-Filter (kosmetisch)
   2. FormData (`audio=<File>`) → POST /api/presets/[id]/audio
   3. Server: verifyCsrf → validateSession → owner|admin → rateLimit
   4. Server: Magic-Bytes + Mime + Size + music-metadata.duration
   5. Server: S3 PUT → DB UPDATE → alten Key best-effort löschen
   6. Server: Admin-on-foreign? → AdminAction log
   7. Response: { audioKey, audioUrl, audioMimeType, audioDurationMs }
   8. Client: optimistic UI commit; bei Fehler Rollback + Toast
```

**Player**

```
[User klickt Play auf Card]
   1. Provider.notifyPlay(thisEl) → andere <audio> werden pausiert
   2. <audio src="/api/preset-audio/..."> lädt erst jetzt (preload="none")
   3. Browser streamt via Range-Requests; unsere GET-Route puffert Datei
      (CLAUDE.md: Garage-Stream darf nicht direkt an NextResponse), liefert
      Buffer mit immutable Cache-Header
   4. Player rendert Progress; on-ended → Provider.notifyEnded
```

## Tests

### Unit (Vitest)

- `tests/unit/lib/audioValidation.test.ts` — Mime/Magic/Size/Duration-Pipeline isoliert: akzeptiert MP3 mit ID3-Header, MP3 mit raw Frame-Sync, M4A-Container; rejects WebM (`1A 45 DF A3`), WAV (`RIFF…WAVE`), Datei > 2 MB, Duration > 30.5 s.
- `tests/unit/api/preset-audio-upload.test.ts` — POST: CSRF (403), unauth (401), nicht Owner + nicht Admin (403), Rate-Limit (429), Wrong Mime (400), Too Big (400), Too Long (400), Happy Path mit S3-Mock + DB-Update + Old-Key-Delete, AdminAction-Log bei Admin-on-foreign.
- `tests/unit/api/preset-audio-delete.test.ts` — Owner setzt audioKey=null + S3 delete; Admin-on-foreign mit Reason-Validation; Reason < 5 → 400; AdminAction-Log.
- `tests/unit/api/preset-audio-get.test.ts` — Key-Pattern-Validation (regex `preset-[a-z0-9]+-\d+\.(mp3|m4a|aac)`), 404 bei missing, Buffer-Response mit korrektem Content-Type + immutable Cache.
- `tests/unit/components/AudioPlayer.test.tsx` — Play/Pause-Toggle, Time-Display-Formatting (`0:28`), Provider pausiert other-player bei notifyPlay.
- `tests/unit/components/AudioUploadField.test.tsx` — File-Pick → POST → Success-Toast; Error-Cases zeigen korrektes Toast; Replace-Flow.
- `tests/unit/components/AudioPlayerProvider.test.tsx` — `notifyPlay` pausiert vorherigen Player; `notifyEnded` resettet ref.
- `tests/unit/i18n-parity.test.ts` — bestehend; deckt neue `audio.*`/`gallery.audio.*`-Keys automatisch.

### E2E (Playwright)

- `tests/e2e/audio-upload.spec.ts` — Login, Preset via Editor öffnen, Save-Dialog öffnen, Audio-Fixture (`tests/fixtures/audio/short-5s.mp3`, ~25 KB) via `setInputFiles` anhängen, Save, Navigation zu `/share/[token]`, Audio-Player sichtbar, Play-Button klickbar.
- Audio-Test-Fixture: 5-Sekunden-Sinus-MP3 (~25 KB) ins Repo eingecheckt unter `tests/fixtures/audio/short-5s.mp3`.

## Deployment

1. Neuen Garage-Bucket anlegen: `gp200editor-audio`.
2. `.env.prod` + `.env.local` + `.env.dev` ergänzen: `GARAGE_AUDIO_BUCKET=gp200editor-audio`.
3. `npm install music-metadata` — pure JS, eine new Dep.
4. Prisma-Migration `add_preset_audio_fields` läuft automatisch beim Container-Start.
5. CHANGELOG-Eintrag.
6. Smoke-Check: Upload eines Test-Audios via Editor + Share-Page-Player.

## Open Risks

- **Bandbreite:** Gallery-Page mit 20 Cards × 2 MB = 40 MB Worst-Case wenn alle Audios geladen. Mitigation: `preload="none"` — Bandbreite nur on-click. Beobachten und bei Bedarf in Card-View weglassen.
- **Storage-Wachstum:** Bei 1000 Presets mit Audio = 2 GB. Bei aktueller Userzahl unkritisch; Cron-Cleanup für orphaned S3-Keys als Future.
- **`music-metadata` Library-Maintenance:** aktiv, gut gewartet, 1.3M downloads/Woche — geringes Risiko.
- **Encoder-Padding > 0.5 s** (selten bei modernen Encodern): User bekommt 400 mit Hinweis „Datei zu lang" und kann re-encode. Akzeptabel.
