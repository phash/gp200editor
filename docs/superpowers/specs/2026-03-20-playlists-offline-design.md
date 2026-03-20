# Playlists + Offline — Design Spec

**Issues:** #9 (Playlists), #11 (Offlinefähigkeit)
**Date:** 2026-03-20
**Status:** Draft

---

## Zusammenfassung

Lokale Playlists mit YouTube-Embed und Preset-Push aufs GP-200, plus PWA/Offline-Support für Editor und Playlists. Primärer Use Case: Üben/Jammen am Schreibtisch mit Gerät per USB.

---

## 1. Datenmodell (IndexedDB)

Zwei Object Stores: `playlists` und `cachedPresets`.

### `playlists` Store

```typescript
interface Playlist {
  id: string            // crypto.randomUUID()
  name: string          // z.B. "Metallica Üben"
  createdAt: number     // Date.now()
  updatedAt: number
  entries: PlaylistEntry[]
}

interface PlaylistEntry {
  id: string            // crypto.randomUUID()
  songName: string      // z.B. "Master of Puppets"
  youtubeUrl?: string   // optional
  presets: PlaylistPreset[]
}

interface PlaylistPreset {
  id: string
  label: string         // z.B. "Clean Verse", "Crunch Chorus", "Lead Solo"
  presetName: string    // Patch-Name aus .prst Datei
  binary: ArrayBuffer   // 1224 Bytes — direkt pushbar
}
```

### `cachedPresets` Store (für Offline-Editor)

```typescript
interface CachedPreset {
  key: string           // hash oder ID
  name: string
  binary: ArrayBuffer   // 1224 Bytes
  cachedAt: number
}
```

**Speicherbedarf:** 1224 Bytes pro Preset. 100 Songs × 4 Presets = ~480 KB. Kein Problem für IndexedDB.

**Validierung:** Beim Speichern in IndexedDB muss `binary.slice(0, 1224)` verwendet werden, um sicherzustellen dass exakt 1224 Bytes gespeichert werden (Fetch/Encoder können größere Buffer liefern).

**Schema-Versionierung:** `idb`'s `upgrade`-Callback nutzen. Initiale DB-Version = 1. Bei Schema-Änderungen (z.B. für #40–#42) neue Version mit Migration.

### `cachedPresets` Store — entfällt in v1

~~Ursprünglich geplant für Offline-Editor-Cache. Wird in v1 nicht benötigt~~ — Playlists speichern Binaries inline, der Editor arbeitet mit lokalen Dateien. Kann bei Bedarf in einem Follow-up ergänzt werden (z.B. "zuletzt bearbeitete Presets" offline halten).

---

## 2. Seitenstruktur & Navigation

### Neue Route: `/[locale]/playlists`

Drei Views auf einer Seite, je nach Query-Parameter:

#### a) Playlist-Übersicht (`/playlists`)

- Liste aller Playlists (Name, Anzahl Songs, letztes Update)
- "Neue Playlist erstellen"-Button
- Klick auf Playlist → Player-Modus

#### b) Playlist bearbeiten (`/playlists?edit=<id>`)

- Playlist-Name editieren
- Einträge hinzufügen/entfernen/umsortieren (Drag & Drop)
- Pro Eintrag: Song-Name, YouTube-URL, Preset-Sub-Liste verwalten
- Presets hinzufügen via: Datei-Upload (.prst), aus gecachten Presets wählen

#### c) Player-Modus (`/playlists?play=<id>`)

- YouTube-Player oben (embedded iframe, 16:9)
- Aktiver Song mit Preset-Chips darunter
- Song-Liste zum Springen
- Mini-Device-Status unten

**Navbar:** Neuer Link "Playlists" zwischen "Editor" und "Presets/Gallery".

**Kein Auth-Guard** — Playlists sind lokal, funktionieren ohne Login.

---

## 3. Player-Modus — Interaktion

### Layout

```
┌─────────────────────────────────────┐
│  ▶ YouTube Player (16:9)            │
│                                     │
├─────────────────────────────────────┤
│  🎸 Master of Puppets               │
│  [Clean Intro] [Rhythm●] [Lead Solo]│
├─────────────────────────────────────┤
│  Song-Liste:                        │
│  1. Master of Puppets          ▶    │
│  2. Enter Sandman                   │
│  3. Nothing Else Matters            │
│  ...                                │
├─────────────────────────────────────┤
│  🔌 GP-200 verbunden (Slot 63-B)   │
└─────────────────────────────────────┘
```

### Interaktion

- **Song klicken:** YouTube-Video wechselt, erstes Preset wird aufs Gerät gepusht
- **Preset-Chip klicken:** Pusht dieses Preset aufs Gerät (kein Video-Wechsel)
- **Tastatur:** `↑`/`↓` = Song wechseln, `←`/`→` = Preset innerhalb des Songs wechseln
- **Push-Feedback:** Chip blinkt amber während Push, grüner Haken bei Erfolg, rot bei Fehler

### Device-Anbindung

- Nutzt `useMidiDevice` Hook (gleich wie Editor)
- Connect/Disconnect-Button im Mini-Status-Bar
- **Push-to-One-Modus (v1):** Immer auf den aktuellen Slot des Geräts (`currentSlot`) pushen
- Ohne Gerät: Presets werden visuell markiert, Push übersprungen mit Hinweis
- Load-Slot-Modus (fester Slot pro Preset) → Follow-up Issue #42

**Push-Ablauf:** `PlaylistPreset.binary` (ArrayBuffer) → `PRSTDecoder.decode()` → `GP200Preset` → `useMidiDevice.pushPreset(preset, currentSlot)`. Die Dekodierung ist nötig weil `pushPreset` ein `GP200Preset`-Objekt erwartet, kein rohes Binary.

**MIDI-Lifecycle über Seiten hinweg:** `useMidiDevice` wird ins App-Layout (`layout.tsx`) gehoben und per React Context bereitgestellt. So bleibt die MIDI-Verbindung beim Navigieren zwischen Editor und Playlists bestehen — kein erneuter Handshake nötig. Editor und Player konsumieren den Context statt den Hook direkt zu instanziieren.

### YouTube-Embed

- YouTube iframe API (`youtube.com/embed/<videoId>`)
- Video-ID Extraktion aus: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/embed/`
- Kein Autoplay beim Song-Wechsel
- Offline: Platzhalter mit Song-Name + "Video offline nicht verfügbar"

---

## 4. Preset-Flow: Vom Editor/Galerie in die Playlist

Drei Wege Presets in eine Playlist zu bekommen:

### a) Aus dem Editor ("Add to Playlist")

- Neuer Button neben "Download" und "Save to Presets"
- Dialog: Playlist wählen (oder neue erstellen) → Song wählen (oder neuen anlegen) → Label eingeben
- Speichert 1224 Bytes + Metadaten in IndexedDB
- Funktioniert für alle Preset-Quellen (Datei, Galerie, Gerät)

### b) In der Playlist-Bearbeitung

- "Preset hinzufügen"-Button pro Song-Eintrag
- Datei hochladen (.prst) oder aus gecachten Presets wählen
- Kein Galerie-Browse hier (dafür Galerie → Editor → Weg a)

### c) Aus der Galerie (Shortcut) — deferred auf nach v1

~~Neuer Button auf Preset-Cards.~~ Für v1 gestrichen — der Weg über Galerie → "Open in Editor" → "Add to Playlist" ist ausreichend. Vermeidet zusätzliche Download-UX-Komplexität (Loading-State, Fehlerbehandlung beim Fetch) in der Galerie-Komponente. Kann als schneller Follow-up ergänzt werden.

**Wichtig:** Preset-Binary wird beim Hinzufügen **kopiert**. Keine Referenz auf Galerie/S3. Sofort offline verfügbar.

---

## 5. Offline / PWA Architektur

### Service Worker (Workbox)

**Precache (beim Install):**
- App-Shell: JS/CSS-Bundles, Fonts (JetBrains Mono, DM Sans)
- Editor-Seite, Playlists-Seite, Home
- i18n Messages (de.json, en.json)

**Runtime-Cache-Strategien:**
- Editor + Playlists Seiten: Cache-First (App-Shell)
- Galerie, Auth, API-Calls: Network-Only
- Statische Assets (Icons, Fonts): Cache-First, langlebig

### Was offline funktioniert

- **Editor:** .prst Datei laden, bearbeiten, aufs Gerät pushen, lokal speichern
- **Playlists:** Öffnen, durchschalten, Presets aufs Gerät pushen (Binaries in IndexedDB)
- **Playlist bearbeiten:** Umsortieren, umbenennen, entfernen

### Was offline NICHT funktioniert (mit UI-Meldung)

- YouTube-Player: Platzhalter "Offline — Video nicht verfügbar"
- Galerie: Hinweis "Galerie benötigt Internetverbindung"
- Login/Register/Profil: Hinweis
- "Preset aus Galerie hinzufügen": Button disabled mit Tooltip

### Service Worker Technologie

**`@serwist/next`** (aktiver Fork von next-pwa). Achtung: `output: 'standalone'` kopiert `public/` nicht automatisch in den Build-Output. Der Dockerfile muss den generierten SW explizit kopieren (`COPY --from=builder /app/public/sw.js ./public/sw.js`). Alternativ: manueller Service Worker mit `workbox-precaching` + `workbox-routing` für volle Kontrolle. Entscheidung bei Implementierung.

### Manifest

```json
{
  "name": "Preset Forge — GP-200 Editor",
  "short_name": "Preset Forge",
  "start_url": "/de/editor",
  "display": "standalone",
  "theme_color": "#d97706",
  "background_color": "#111827"
}
```

**Hinweis:** `start_url` muss locale-prefixed sein (`/de/editor`), weil next-intl Middleware bei `/editor` einen Redirect auslöst, der offline nicht funktioniert. Default-Locale `de` wählen; User mit EN-Preference landen trotzdem korrekt (Browser-Locale-Detection).

Kein Background-Sync, keine Push-Notifications.

### CSP-Hinweis

Sobald eine Content-Security-Policy eingeführt wird, muss `frame-src https://www.youtube.com` erlaubt werden für den YouTube-Embed. Aktuell kein CSP-Header gesetzt — kein Blocker für v1.

---

## 6. Neue Dateien / Änderungen

### Neue Dateien

| Datei | Beschreibung |
|-------|-------------|
| `src/lib/playlistDb.ts` | IndexedDB Wrapper (idb): CRUD Playlists (Version 1, upgrade-ready) |
| `src/contexts/MidiDeviceContext.tsx` | React Context Provider für useMidiDevice (shared zwischen Editor + Player) |
| `src/hooks/usePlaylist.ts` | React Hook: Playlist-State, CRUD-Operationen |
| `src/hooks/usePlaylistPlayer.ts` | Player-State: aktiver Song/Preset, Navigation, Push-Logik |
| `src/app/[locale]/playlists/page.tsx` | Playlists Hauptseite (dünner Server-Component-Wrapper → Client Components) |
| `src/app/[locale]/playlists/PlaylistOverview.tsx` | Playlist-Liste |
| `src/app/[locale]/playlists/PlaylistEditor.tsx` | Playlist bearbeiten |
| `src/app/[locale]/playlists/PlaylistPlayer.tsx` | Player-Modus |
| `src/components/AddToPlaylistDialog.tsx` | Wiederverwendbarer Dialog (Editor + Galerie) |
| `src/components/YouTubeEmbed.tsx` | YouTube iframe + Offline-Platzhalter |
| `public/manifest.json` | PWA Manifest |
| `public/sw.js` | Service Worker (oder via next-pwa generiert) |

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/app/[locale]/editor/page.tsx` | "Add to Playlist"-Button + Dialog, useMidiDevice aus Context statt direkt |
| `src/components/Navbar.tsx` | "Playlists"-Link hinzufügen |
| `src/app/[locale]/layout.tsx` | PWA Meta-Tags, Manifest-Link, MidiDeviceContext Provider |
| `next.config.mjs` | PWA/Workbox Konfiguration |
| `messages/de.json` | Neue Übersetzungsschlüssel (playlists Namespace) |
| `messages/en.json` | Neue Übersetzungsschlüssel (playlists Namespace) |
| `middleware.ts` | `/playlists` Route erlauben (kein Auth-Guard) |

### Dependencies

| Paket | Zweck |
|-------|-------|
| `idb` | Typsicherer IndexedDB Wrapper |
| `next-pwa` oder `@serwist/next` | Service Worker / Workbox Integration für Next.js |

---

## 7. Nicht im Scope (v1)

- Playlist duplizieren, Import/Export → #40 (angelegt)
- Social Playlists (veröffentlichen, entdecken) → #41 (angelegt)
- Load-Slot-Modus (fester Slot pro Preset) → #42 (angelegt)
- "Add to Playlist" direkt aus Galerie (Shortcut ohne Editor-Umweg)
- Background-Sync, Push-Notifications
- Galerie offline cachen
- YouTube-Video offline cachen (technisch nicht möglich)

---

## 8. Accessibility (WCAG 2.1 AA)

- Song-Liste: `role="listbox"` mit `role="option"` pro Song, `aria-selected` für aktiven Song
- Preset-Chips: `role="tablist"` / `role="tab"`, `aria-selected` für aktives Preset
- Push-Feedback: `aria-live="polite"` Region für Status-Meldungen ("Preset gepusht", "Push fehlgeschlagen")
- YouTube-Embed: `<iframe title="YouTube: {songName}">` für Screen Reader
- Fokus-Management: Bei Song-Wechsel Fokus auf ersten Preset-Chip setzen
- Keyboard: Arrow-Keys wie in Section 3 beschrieben, Enter/Space zum Aktivieren

---

## 9. Tests

### Unit Tests (Vitest)

- `playlistDb.test.ts` — CRUD gegen `fake-indexeddb`, Schema-Upgrade
- `usePlaylist.test.ts` — Hook-State, Add/Remove/Reorder
- `usePlaylistPlayer.test.ts` — Navigation, Push-Trigger-Logik
- `YouTubeEmbed.test.ts` — URL-Parsing (watch?v=, youtu.be/, embed/)

### E2E Tests (Playwright)

- Playlist erstellen, Song hinzufügen, Preset hinzufügen, Player öffnen
- Keyboard-Navigation im Player (Arrow-Keys)
- Offline-Platzhalter für YouTube (Service Worker intercepten)

---

## 10. i18n Namespaces

Neuer Namespace `playlists`:

```
playlists.title, playlists.create, playlists.edit, playlists.delete,
playlists.addSong, playlists.addPreset, playlists.player,
playlists.pushSuccess, playlists.pushError, playlists.noDevice,
playlists.offlineVideo, playlists.empty
```

Bestehende Namespaces erweitert:
- `editor.addToPlaylist`
- `gallery.addToPlaylist` (falls noch nicht `presets` Namespace)
- `nav.playlists`
