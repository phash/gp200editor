# Changelog

## 2026-05-19

### Features
- **30 s Audio-Schnipsel pro Preset.** Owner können beim Save-to-Gallery oder nachträglich auf `/share/[token]` ein MP3- oder M4A/AAC-File (max 30 s, max 2 MB) anhängen. Player erscheint auf der Share-Page (voll), im Homepage-Featured-Block und auf jeder Gallery-Card (Icon). Nur ein Player spielt gleichzeitig — Klick auf einen Card-Play pausiert alle anderen.
- **Admin-Audit für fremdes Audio.** Wenn ein Admin Audio eines fremden Presets ersetzt oder löscht, wird die Aktion mit Reason (bei Delete) im AdminAction-Log auditiert.

### Storage / Validation
- Neuer Garage S3-Bucket `gp200editor-audio`. Server prüft Mime + Magic Bytes + Größe (≤ 2 MB) + Dauer (≤ 30.5 s via `music-metadata`) vor jedem S3 PUT.

### Schema
- Drei neue nullable Felder auf `Preset`: `audioKey`, `audioMimeType`, `audioDurationMs`.

## 2026-05-19 (later)

### Features
- **Brasilianisches Portugiesisch (pt-BR) als 7. Locale.** Vorher war `pt.json` faktisch brasilianisch übersetzt (Salvar/Senha/usuário/arquivo); der Inhalt wandert nach `pt-BR.json` und steht jetzt brasilianischen Nutzern als eigenes Locale mit 🇧🇷-Flag im Switcher zur Verfügung. `pt.json` wurde mit ~175 gezielten Substitutionen auf echtes europäisches Portugiesisch konvertiert (Guardar/Palavra-passe/utilizador/ficheiro/Iniciar sessão/A guardar/A carregar/Ligar/Registo/Rastreio).

### i18n-Polish (Sprach-Review aller 7 Locales)
- **DE/IT:** 4 Admin-Buttons (`Unpublish/Republish/Flag/Unflag`) waren noch englisch — jetzt übersetzt.
- **DE:** `home.featured.title` hatte den „Featured ·"-Präfix verloren — wieder dran.
- **IT:** `home.featured.title` hatte „Top Rated" englisch — jetzt „Più votati".
- **FR:** tu/vous-Inkonsistenz behoben — drei FAQ-Antworten + zwei Tooltips + die Verify-Confirm-Seite waren in `vous`, während die App sonst `tu` nutzt. E-Mail-Templates bleiben bewusst in `vous` (formaler Kontext).
- **PT-BR:** Ein EU-PT-Slip in `gallery.rate.ownPresetTooltip` korrigiert.

### Fix
- **Übersetzungs-Skript-Bug korrigiert.** Beim BR→EU-Sweep der `legal.privacyOverviewText` wurde „salvo quando exigido por lei" (im Sinne von „außer wenn") fälschlich zu „guardado quando exigido por lei" umgeschrieben. Zurückgedreht.

## 2026-05-19

### Security
- **Comments leak after un-publish — fixed.** `GET /api/presets/[id]/comments` now refuses to return the thread when the preset has been made non-public or flagged. POST top-level + Reply gained the same gate (Reply previously checked neither). Anyone who had the preset id from a previous public link can no longer continue reading a thread the author tried to retract.
- **Featured-Preset Sybil-Dampening verstärkt.** Bayes-Konstante `m` von 5 auf 10 — eine einzelne 5★-Bewertung von einem Accomplice-Account scoret jetzt nur noch ~4.09 (statt 4.17) und schiebt sich nicht mehr vor etablierte Presets mit echtem Rating-Verlauf.

### Bugfixes
- **Inline-Rating Optimistic-UI ohne Rollback** — bei fehlgeschlagenem POST blieb die UI bei der Phantom-Bewertung. Snapshot+Restore + `errorTooltip`-Toast.
- **Comment-Textarea verlor Inhalt bei 429/Auth-Fail** — `CommentForm` clear jetzt nur bei Success; bei Fehler steht der Text zum Retry da.
- **CommentSection swallowed 401/5xx silently** — separate Toasts für Rate-Limit, Session-Expired und generischen Fehler.
- **Gallery-Rating Page 2+ zeigte falschen Count** — bereits-bewertete Presets jenseits der ersten SSR-Page bekamen `existingRating=0`, was bei Re-Rating zu Phantom-Counts führte. Session-Lookup zog ans `/api/gallery`-Endpoint, jede Card trägt jetzt korrekte Rating-Context.
- **AdminCommentsTab hatte keine Pagination-UI** — alle Comments jenseits der ersten 50 waren unerreichbar. Load-More-Button + In-Flight-Guard.

### UI / i18n
- **Confirm-Dialog vor User-Soft-Delete.** Klick auf „Delete" beim eigenen Kommentar öffnet jetzt einen Bestätigungsdialog (Soft-Delete ist nicht reversibel — `body` wird genullt). Admin-Hard-Delete behält seinen separaten Reason-Dialog.
- **Drei hardcoded englische Strings korrigiert** (`Comments` Header, `Email verification required`, Admin-`Cancel`-Button) — jetzt in allen 6 Locales übersetzt.
- **Toter i18n-Key entfernt** (`comments.adminDeleteReasonLabel` — Admin-Tab nutzt `admin.comments.hardDeleteReasonLabel`).

### Schema / Performance
- **Index `Comment(createdAt DESC)`** — die Admin-Moderation-Liste sortiert ohne `presetId`-Filter; der bisherige Compound-Index half nicht. Cheap forward-looking change.
- **Shared `commentSerializer`** — Avatar-Mapping (`avatarKey → /api/avatar/<key>`) lebt jetzt in `src/lib/commentSerializer.ts`; PATCH gab bisher den Raw-`avatarKey` zurück, alle anderen Routes serialisierten zu `avatarUrl`. Inkonsistenz behoben.

## 2026-05-18

### Features
- **Inline-Rating in der Gallery** — Bewertungen können direkt auf der Gallery-Liste abgegeben werden. Anonyme Klicks zeigen einen Tooltip mit Login-Link; eigene Presets sind erwartungsgemäß nicht bewertbar.
- **Kommentare auf Share-Pages** — Plaintext-Kommentare mit 1-Level-Threading (Top-Level + Reply), max 1000 Zeichen, URLs werden automatisch verlinkt (`rel=nofollow`). Verifizierte User können kommentieren, jederzeit editieren und soft-löschen. Soft-Delete zeigt einen Platzhalter, Replies bleiben sichtbar.
- **Admin-Moderation für Kommentare** — Neuer Tab im Admin-Dashboard: Liste der letzten 50 Kommentare. Hard-Delete erfordert einen Grund (5–200 Zeichen) und wird im AdminAction-Log auditiert; kaskadiert auf Replies.
- **Featured Preset auf der Startseite** — Bayes-Average (m=5, C=globaler Durchschnitt) über alle Presets mit Ratings der letzten 30 Tage. Hero-Block mit Signal-Chain-Grafik (Amp/Cab-Realnamen), Sternebewertung, Beschreibung und den 3 neuesten Kommentaren. Fallback auf All-Time-Best wenn das 30-Tage-Fenster leer ist.
- **FX-Loop SEND/RETURN editor** — neuer Insertion-Point-Editor analog zum offiziellen Valeton GP-200 Editor. Pfeile (`↗` SEND, `↘` RETURN) lassen sich per Drag & Drop oder Tastatur (←/→) zwischen den 11 Effekt-Slots (PRE…VOL) verschieben. Bypass-Anzeige wenn SEND === RETURN. ARIA-konform (`role="slider"`, vollständige Screenreader-Labels in allen 6 Sprachen).
- **Live MIDI für FX-Loop** — SEND/RETURN-Bewegungen werden bei verbundenem Gerät sofort als SysEx `sub=0x20` ans Pedal geschickt. Push-Constraint (`SEND ≤ RETURN`) feuert bei Bedarf zwei Messages, um beide Pfeile synchron zu halten.
- **`.prst` Codec für FX-Loop** — SEND/RETURN werden an Bytes `0x92`/`0x93` (innerhalb des Routing-Section-Headers) gelesen und geschrieben. Round-Trip-stabil, inkl. `rawSource`-basierter Presets.

### Schema
- **Neue Tabelle `Comment`** mit Self-FK für 1-Level-Threading (`parentId` nullable), Soft-Delete-Marker (`deletedAt`/`deletedBy`), Cascade-Delete bei Preset/User/Parent-Removal.

### Protocol
- **`sub=0x20` Reorder vs. FX-Loop Move differenziert** — `decoded[14]`/`[15]` halten SEND/RETURN (vorher fälschlich als Konstanten markiert); `decoded[27]` ist ein Diskriminator: `0x08` = SEND verschoben, `0xBA` = RETURN verschoben, `0x44` = reine Routing-Umordnung. Reverse-engineered aus zwei USB-MIDI-Captures (2026-05-18), byte-für-byte verifiziert.

## 2026-04-11

### Features
- **PRST Library + JSON API** — 145 curated Valeton GP-200 presets ingested from guitarpatches.com, each served with real-world amp/cab names (e.g. "Marshall® JCM800", "Fender® '65 Twin Reverb"). New `/api/share/[token]/json` endpoint serves a round-trip JSON document with signal chain, highlights, and raw preset data.
- **SEO-crawlable signal chain on share pages** — every share page now renders the full effect chain as semantic HTML with both Valeton fake names and real-world brand names. Google rich results supported via schema.org/Product markup per preset.
- **Amp category landing pages** — 64 new pages at `/[locale]/amp/[slug]` (e.g. `/en/amp/marshall-jcm800`, `/en/amp/mesa-boogie-dual-rectifier-modern-mode`), each listing all presets using that amp. Pre-rendered for both locales.
- **hreflang + canonical + JSON-LD** — every share page gets `<link rel="alternate" hreflang>` for de/en/x-default, `<link rel="canonical">`, schema.org/Product JSON-LD with auto-extracted brand, Open Graph + Twitter Card metadata.
- **Dynamic Open Graph images** — 1200×630 PNG per share page generated on demand via Next.js 15 `ImageResponse`, showing preset name + amp + cab real names with Preset Forge branding.
- **Ingest pipeline** — new `scripts/ingest-presets.ts` CLI with four source adapters: guitarpatches.com (polite 10s crawl delay), GitHub Code Search, Valeton factory folder, and a manual curated-URL list. Automatic validation (TSRP magic + checksum), dedup by source URL + sha256 content hash, auto-generated descriptions + tags.
- **Sitemap coverage** — 586 URLs including 128 amp category pages, 450 preset URLs (de/en/json), and 8 static pages. Force-dynamic so newly-ingested presets become indexable without redeploying.

### Bugfixes
- **Decoder NaN handling** — real .prst files from guitarpatches.com carry NaN bytes in unused effect params; the decoder now substitutes 0 so validation doesn't drop ~10% of the library.
- **Factory-size checksum** — 1176-byte factory presets no longer trip the out-of-bounds read at offset 0x4C6.
- **Description generator** — `generateDescription` no longer produces "cabinet cabinet" when the real name already contains the module label.
- **metadataBase** — Open Graph image URLs now resolve to `https://preset-forge.com/...` instead of `http://localhost:3000/...`.

### Local CI
- **GitHub Actions removed** — replaced with `scripts/local-ci.sh` running lint + typecheck + vitest + next build locally. New `npm run ci` entry point.

### Performance + Security (pre-library)
- Paginated `GET /api/presets` and `/presets` SSR page (default 100, max 500) — previously unbounded.
- Capped `sitemap.xml` query at 10 000 rows with `orderBy: updatedAt desc`.
- Memoized `getEffectParams` lookup in `EffectParams`.
- Middleware regex compilation moved to module scope (single pattern instead of three per request).
- `next-intl` upgraded to 4.9.1 (GHSA-8f24-v5vv-gm5j open redirect).
- `DELETE /api/admin/users/[id]` refuses to delete admins — forces an auditable PATCH demotion first.
- Per-IP rate limit on `/api/auth/forgot-password` alongside the existing per-email limit, closing the account enumeration side-channel.

## 2026-03-24

### Features
- **Live param updates from hardware** — When the user turns knobs on the GP-200 (Volume, Gain, Presence, Bass, Middle, Treble), sliders update in real-time in the webapp. New sub=0x10 D→H knob notification parsing with discriminator (bytes[29:37]=all zeros = knob, otherwise = toggle).
- **AMP Head Panel** — New `AmpHeadPanel` component showing the AMP block's main knobs (Gain/Presence/Volume + Bass/Middle/Treble) prominently at the top of the editor. Auto-detects AMP model from preset.
- **Collapsible head sections** — AMP Head, Preset Info + Patch Settings, and Controller sections can be independently toggled via a button bar at the top of the editor.
- **Auto-load preset names** — After device connect, all 256 preset names load automatically in the background. Previously required opening the slot browser first.

### Bugfixes
- **Correct initial slot detection** — State dump decoded[8:10] LE16 contains the active slot. Previously always returned slot 0. Verified via captures 084047 (slot 13/04-B) and 084156 (slot 0/01-A).
- **Bank switching on device slot change** — When device changes to a slot in a different bank, editor now pulls the entire new bank and switches tab. Previously loaded wrong preset into wrong tab.
- **MIDI operation serialization** — Background `loadPresetNames` no longer conflicts with `pullPreset`/`pushPreset`. Added `pauseNameLoading()` that aborts name loader before any pull/push/write operation.
- **Nibble-encode slot for slots > 127** — SysEx data bytes must be 0-127. Slot 252 (64-A) was sent as raw 0xFC (invalid). Now nibble-encoded at [25:26] in `buildPresetChange` and decoded in `onMidiMessage`.
- **Status bar shows editor preset name** — `currentPresetName` from editor takes priority over stale cached `presetNames`.
- **ControllerPanel visible when disconnected** — Shows at 50% opacity instead of hidden.
- **Cache-Control no-store in dev mode** — Prevents browser from serving stale JS after code changes.

### Protocol
- **State dump header decoded** — decoded[0:10]: constants + active slot at [8:10] LE16. Verified via captures 084047 (slot 13/04-B) and 084156 (slot 0/01-A).
- **D→H Knob notification (sub=0x10)** — byte[22]=block, byte[24]=param, [29:37]=zeros discriminator, [37:45]=nibble float32 value. AMP block=3: param 0=Gain, 1=Presence, 2=Volume, 3=Bass, 4=Middle, 5=Treble.

## 2026-03-23

### Features
- **EXP controller assignments** — Hardware-verified EXP1/EXP2 parameter selection + min/max via SysEx (sub=0x14 + sub=0x18).
- **NAM upload analysis** — Captured IR upload protocol (sub=0x1C, multi-chunk).
- **Patch Settings** — VOL/PAN/Tempo live editing via sub=0x10.

### Protocol
- **Save-to-Slot sub-slot index** — decoded[4] = A(0)/B(1)/C(2)/D(3). Without this, save always wrote to slot A.
- **Effekt-Change-Response (sub=0x0C)** — Block index, effect ID decoded from D→H notification.
- **EXP/Controller Assignment** — Navigation (sub=0x18) + Min/Max write (sub=0x14), hardware-verified.
