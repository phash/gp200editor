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

### c) Aus der Galerie (Shortcut)

- Neuer Button auf Preset-Cards: "Add to Playlist"
- Lädt Binary runter, gleicher Dialog wie (a)
- Spart Umweg über Editor beim Sammeln

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

### Manifest

```json
{
  "name": "Preset Forge — GP-200 Editor",
  "short_name": "Preset Forge",
  "start_url": "/editor",
  "display": "standalone",
  "theme_color": "#d97706",
  "background_color": "#111827"
}
```

Kein Background-Sync, keine Push-Notifications.

---

## 6. Neue Dateien / Änderungen

### Neue Dateien

| Datei | Beschreibung |
|-------|-------------|
| `src/lib/playlistDb.ts` | IndexedDB Wrapper (idb): CRUD Playlists, Cache Presets |
| `src/hooks/usePlaylist.ts` | React Hook: Playlist-State, CRUD-Operationen |
| `src/hooks/usePlaylistPlayer.ts` | Player-State: aktiver Song/Preset, Navigation, Push-Logik |
| `src/app/[locale]/playlists/page.tsx` | Playlists Hauptseite (Server Component) |
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
| `src/app/[locale]/editor/page.tsx` | "Add to Playlist"-Button + Dialog |
| `src/app/[locale]/gallery/GalleryClient.tsx` | "Add to Playlist"-Button auf Preset-Cards |
| `src/components/Navbar.tsx` | "Playlists"-Link hinzufügen |
| `src/app/[locale]/layout.tsx` | PWA Meta-Tags, Manifest-Link |
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

- Playlist duplizieren, Import/Export → #40
- Social Playlists (veröffentlichen, entdecken) → #41
- Load-Slot-Modus (fester Slot pro Preset) → #42
- Background-Sync, Push-Notifications
- Galerie offline cachen
- YouTube-Video offline cachen (technisch nicht möglich)

---

## 8. i18n Namespaces

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
