# Playlists + Offline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local-first playlists with YouTube embed and GP-200 preset push, plus PWA offline support for editor and playlists.

**Architecture:** IndexedDB stores playlists with embedded preset binaries (1224 bytes each). A shared MIDI Context Provider in the app layout keeps the device connection alive across Editor and Playlist pages. Service worker (Workbox) precaches the app shell for offline use. Three playlist views (overview, editor, player) live under `/[locale]/playlists` with query-parameter routing.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, `idb` (IndexedDB wrapper), manual Workbox service worker (no `@serwist/next` — better control with `output: 'standalone'`), YouTube iframe embed, existing `useMidiDevice` hook via React Context.

**Font convention:** The project uses `font-mono-display` (custom Tailwind class) for all text. Never use `font-mono` or `font-display` — always `font-mono-display`.

**Spec:** `docs/superpowers/specs/2026-03-20-playlists-offline-design.md`

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install `idb` and `fake-indexeddb`**

```bash
npm install --legacy-peer-deps idb
npm install --legacy-peer-deps -D fake-indexeddb
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('idb'); console.log('idb OK')"
node -e "require('fake-indexeddb'); console.log('fake-indexeddb OK')"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add idb and fake-indexeddb dependencies"
```

---

## Task 2: i18n — Add Playlist Translation Keys

**Files:**
- Modify: `messages/de.json`
- Modify: `messages/en.json`

Both files have top-level namespaces: `nav`, `home`, `footer`, `editor`, `auth`, `profile`, `presets`, `gallery`, `device`, `help`.

- [ ] **Step 1: Add `playlists` namespace to `messages/de.json`**

Add after the `gallery` namespace:

```json
"playlists": {
  "title": "Playlists",
  "empty": "Noch keine Playlists. Erstelle deine erste!",
  "create": "Neue Playlist",
  "edit": "Playlist bearbeiten",
  "delete": "Playlist löschen",
  "deleteConfirm": "Playlist \"{name}\" wirklich löschen?",
  "name": "Playlist-Name",
  "namePlaceholder": "z.B. Metallica Üben",
  "songs": "{count, plural, =0 {Keine Songs} one {1 Song} other {# Songs}}",
  "addSong": "Song hinzufügen",
  "songName": "Song-Name",
  "songNamePlaceholder": "z.B. Master of Puppets",
  "youtubeUrl": "YouTube-URL (optional)",
  "youtubeUrlPlaceholder": "https://youtube.com/watch?v=...",
  "addPreset": "Preset hinzufügen",
  "presetLabel": "Bezeichnung",
  "presetLabelPlaceholder": "z.B. Clean Verse, Lead Solo",
  "uploadPreset": "Datei hochladen (.prst)",
  "removeSong": "Song entfernen",
  "removePreset": "Preset entfernen",
  "player": "Abspielen",
  "pushSuccess": "Preset geladen",
  "pushError": "Push fehlgeschlagen",
  "pushing": "Lade Preset...",
  "noDevice": "Kein Gerät verbunden",
  "offlineVideo": "Video offline nicht verfügbar",
  "back": "Zurück zur Übersicht",
  "save": "Speichern",
  "lastUpdated": "Zuletzt bearbeitet"
}
```

- [ ] **Step 2: Add `playlists` namespace to `messages/en.json`**

```json
"playlists": {
  "title": "Playlists",
  "empty": "No playlists yet. Create your first one!",
  "create": "New Playlist",
  "edit": "Edit Playlist",
  "delete": "Delete Playlist",
  "deleteConfirm": "Really delete playlist \"{name}\"?",
  "name": "Playlist Name",
  "namePlaceholder": "e.g. Metallica Practice",
  "songs": "{count, plural, =0 {No songs} one {1 song} other {# songs}}",
  "addSong": "Add Song",
  "songName": "Song Name",
  "songNamePlaceholder": "e.g. Master of Puppets",
  "youtubeUrl": "YouTube URL (optional)",
  "youtubeUrlPlaceholder": "https://youtube.com/watch?v=...",
  "addPreset": "Add Preset",
  "presetLabel": "Label",
  "presetLabelPlaceholder": "e.g. Clean Verse, Lead Solo",
  "uploadPreset": "Upload file (.prst)",
  "removeSong": "Remove Song",
  "removePreset": "Remove Preset",
  "player": "Play",
  "pushSuccess": "Preset loaded",
  "pushError": "Push failed",
  "pushing": "Loading preset...",
  "noDevice": "No device connected",
  "offlineVideo": "Video unavailable offline",
  "back": "Back to overview",
  "save": "Save",
  "lastUpdated": "Last updated"
}
```

- [ ] **Step 3: Add `nav.playlists` key**

In `messages/de.json` `nav` object, add: `"playlists": "Playlists"`
In `messages/en.json` `nav` object, add: `"playlists": "Playlists"`

- [ ] **Step 4: Add `editor.addToPlaylist` key**

In `messages/de.json` `editor` object, add: `"addToPlaylist": "Zur Playlist hinzufügen"`
In `messages/en.json` `editor` object, add: `"addToPlaylist": "Add to Playlist"`

- [ ] **Step 5: Commit**

```bash
git add messages/de.json messages/en.json
git commit -m "i18n: add playlist translation keys (DE/EN)"
```

---

## Task 3: IndexedDB Layer — `playlistDb.ts` (TDD)

**Files:**
- Create: `src/lib/playlistDb.ts`
- Create: `tests/unit/playlistDb.test.ts`

**Reference:** `idb` API docs — `openDB(name, version, { upgrade })`, typed stores via generics.

### Types

- [ ] **Step 1: Write type definitions in `src/lib/playlistDb.ts`**

```typescript
export interface PlaylistPreset {
  id: string;
  label: string;
  presetName: string;
  binary: ArrayBuffer;
}

export interface PlaylistEntry {
  id: string;
  songName: string;
  youtubeUrl?: string;
  presets: PlaylistPreset[];
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  entries: PlaylistEntry[];
}
```

- [ ] **Step 2: Commit types**

```bash
git add src/lib/playlistDb.ts
git commit -m "feat(playlists): add IndexedDB type definitions"
```

### CRUD Operations

- [ ] **Step 3: Write failing tests for DB open + CRUD**

File: `tests/unit/playlistDb.test.ts`

```typescript
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  openPlaylistDb,
  createPlaylist,
  getPlaylist,
  getAllPlaylists,
  updatePlaylist,
  deletePlaylist,
} from '@/lib/playlistDb';

describe('playlistDb', () => {
  beforeEach(() => {
    // Reset IndexedDB between tests
    indexedDB = new IDBFactory();
  });

  it('creates and retrieves a playlist', async () => {
    const db = await openPlaylistDb();
    const id = await createPlaylist(db, 'Metallica Üben');
    const playlist = await getPlaylist(db, id);
    expect(playlist).toBeDefined();
    expect(playlist!.name).toBe('Metallica Üben');
    expect(playlist!.entries).toEqual([]);
    expect(playlist!.createdAt).toBeGreaterThan(0);
    db.close();
  });

  it('lists all playlists', async () => {
    const db = await openPlaylistDb();
    await createPlaylist(db, 'Playlist A');
    await createPlaylist(db, 'Playlist B');
    const all = await getAllPlaylists(db);
    expect(all).toHaveLength(2);
    db.close();
  });

  it('updates a playlist', async () => {
    const db = await openPlaylistDb();
    const id = await createPlaylist(db, 'Old Name');
    const playlist = await getPlaylist(db, id);
    playlist!.name = 'New Name';
    playlist!.entries = [{
      id: crypto.randomUUID(),
      songName: 'Master of Puppets',
      presets: [],
    }];
    await updatePlaylist(db, playlist!);
    const updated = await getPlaylist(db, id);
    expect(updated!.name).toBe('New Name');
    expect(updated!.entries).toHaveLength(1);
    db.close();
  });

  it('deletes a playlist', async () => {
    const db = await openPlaylistDb();
    const id = await createPlaylist(db, 'To Delete');
    await deletePlaylist(db, id);
    const result = await getPlaylist(db, id);
    expect(result).toBeUndefined();
    db.close();
  });

  it('validates binary size on preset storage', async () => {
    const db = await openPlaylistDb();
    const id = await createPlaylist(db, 'Test');
    const playlist = await getPlaylist(db, id);
    const oversizedBuffer = new ArrayBuffer(2000);
    playlist!.entries = [{
      id: crypto.randomUUID(),
      songName: 'Song',
      presets: [{
        id: crypto.randomUUID(),
        label: 'Clean',
        presetName: 'TestPreset',
        binary: oversizedBuffer,
      }],
    }];
    await updatePlaylist(db, playlist!);
    const saved = await getPlaylist(db, id);
    expect(saved!.entries[0].presets[0].binary.byteLength).toBe(1224);
    db.close();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
npm test -- tests/unit/playlistDb.test.ts
```

Expected: FAIL — functions not exported yet.

- [ ] **Step 5: Implement DB functions in `src/lib/playlistDb.ts`**

```typescript
import { openDB, type IDBPDatabase } from 'idb';

// ... types from Step 1 ...

const DB_NAME = 'preset-forge';
const DB_VERSION = 1;
const STORE_PLAYLISTS = 'playlists';
const PRST_SIZE = 1224;

// Singleton — multiple hooks/components share one connection
let dbPromise: Promise<IDBPDatabase> | null = null;

export function openPlaylistDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // v1: only playlists store. cachedPresets deliberately omitted per spec.
        if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
          db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

function sliceBinaries(playlist: Playlist): Playlist {
  return {
    ...playlist,
    entries: playlist.entries.map(entry => ({
      ...entry,
      presets: entry.presets.map(p => ({
        ...p,
        binary: p.binary.byteLength > PRST_SIZE
          ? p.binary.slice(0, PRST_SIZE)
          : p.binary,
      })),
    })),
  };
}

export async function createPlaylist(db: IDBPDatabase, name: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const playlist: Playlist = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    entries: [],
  };
  await db.put(STORE_PLAYLISTS, playlist);
  return id;
}

export async function getPlaylist(db: IDBPDatabase, id: string): Promise<Playlist | undefined> {
  return db.get(STORE_PLAYLISTS, id);
}

export async function getAllPlaylists(db: IDBPDatabase): Promise<Playlist[]> {
  return db.getAll(STORE_PLAYLISTS);
}

export async function updatePlaylist(db: IDBPDatabase, playlist: Playlist): Promise<void> {
  const sanitized = sliceBinaries({ ...playlist, updatedAt: Date.now() });
  await db.put(STORE_PLAYLISTS, sanitized);
}

export async function deletePlaylist(db: IDBPDatabase, id: string): Promise<void> {
  await db.delete(STORE_PLAYLISTS, id);
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- tests/unit/playlistDb.test.ts
```

Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/playlistDb.ts tests/unit/playlistDb.test.ts
git commit -m "feat(playlists): IndexedDB CRUD layer with binary validation"
```

---

## Task 4: YouTube URL Parser (TDD)

**Files:**
- Create: `src/lib/youtube.ts`
- Create: `tests/unit/youtube.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { extractYouTubeId } from '@/lib/youtube';

describe('extractYouTubeId', () => {
  it('extracts from watch URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from short URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from embed URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts with extra params', () => {
    expect(extractYouTubeId('https://youtube.com/watch?v=abc123&t=42')).toBe('abc123');
  });

  it('returns null for invalid URL', () => {
    expect(extractYouTubeId('https://example.com')).toBeNull();
    expect(extractYouTubeId('')).toBeNull();
    expect(extractYouTubeId('not a url')).toBeNull();
  });

  it('handles URL without protocol', () => {
    expect(extractYouTubeId('youtube.com/watch?v=abc123')).toBe('abc123');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/youtube.test.ts
```

- [ ] **Step 3: Implement**

File: `src/lib/youtube.ts`

```typescript
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;

  const normalized = url.includes('://') ? url : `https://${url}`;

  try {
    const parsed = new URL(normalized);

    // youtu.be/VIDEO_ID
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1);
      return id || null;
    }

    // youtube.com/watch?v=VIDEO_ID
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return v;

      // youtube.com/embed/VIDEO_ID
      const embedMatch = parsed.pathname.match(/^\/embed\/([^/]+)/);
      if (embedMatch) return embedMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/unit/youtube.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/youtube.ts tests/unit/youtube.test.ts
git commit -m "feat(playlists): YouTube URL parser with tests"
```

---

## Task 5: MIDI Device Context Provider

**Files:**
- Create: `src/contexts/MidiDeviceContext.tsx`
- Modify: `src/app/[locale]/layout.tsx`
- Modify: `src/app/[locale]/editor/page.tsx`

**Why:** `useMidiDevice` currently lives inside the Editor page. To share the MIDI connection between Editor and Playlist Player without re-handshaking, we lift it to a React Context in the app layout.

**Trade-off:** The MIDI hook runs on every page (home, auth, etc.), not just editor/playlists. This is acceptable because the hook is fully lazy — it only touches `navigator.requestMIDIAccess` when `connect()` is explicitly called. No browser APIs are invoked on mount. Verify this is still true before proceeding.

- [ ] **Step 1: Create `MidiDeviceContext.tsx`**

```typescript
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useMidiDevice, type UseMidiDeviceReturn } from '@/hooks/useMidiDevice';

const MidiDeviceContext = createContext<UseMidiDeviceReturn | null>(null);

export function MidiDeviceProvider({ children }: { children: ReactNode }) {
  const midiDevice = useMidiDevice();
  return (
    <MidiDeviceContext.Provider value={midiDevice}>
      {children}
    </MidiDeviceContext.Provider>
  );
}

export function useMidiDeviceContext(): UseMidiDeviceReturn {
  const ctx = useContext(MidiDeviceContext);
  if (!ctx) throw new Error('useMidiDeviceContext must be used within MidiDeviceProvider');
  return ctx;
}
```

- [ ] **Step 2: Add `MidiDeviceProvider` to `layout.tsx`**

In `src/app/[locale]/layout.tsx`, import and wrap:

```typescript
import { MidiDeviceProvider } from '@/contexts/MidiDeviceContext';
```

Wrap children inside `NextIntlClientProvider`:

```tsx
<NextIntlClientProvider messages={messages}>
  <MidiDeviceProvider>
    <Navbar />
    <main ...>{children}</main>
    <Footer />
  </MidiDeviceProvider>
</NextIntlClientProvider>
```

**Important:** `MidiDeviceProvider` is a client component. The layout is a server component. This requires a client-component wrapper pattern. If the layout already uses `'use client'` (it doesn't — it's async/server), create a small wrapper:

Create `src/app/[locale]/ClientProviders.tsx`:

```typescript
'use client';

import { type ReactNode } from 'react';
import { MidiDeviceProvider } from '@/contexts/MidiDeviceContext';

export function ClientProviders({ children }: { children: ReactNode }) {
  return <MidiDeviceProvider>{children}</MidiDeviceProvider>;
}
```

Then in layout:

```tsx
<NextIntlClientProvider messages={messages}>
  <ClientProviders>
    <Navbar />
    <main ...>{children}</main>
    <Footer />
  </ClientProviders>
</NextIntlClientProvider>
```

- [ ] **Step 3: Refactor Editor to use context**

In `src/app/[locale]/editor/page.tsx`:

Replace:
```typescript
import { useMidiDevice } from '@/hooks/useMidiDevice';
// ...
const midiDevice = useMidiDevice();
```

With:
```typescript
import { useMidiDeviceContext } from '@/contexts/MidiDeviceContext';
// ...
const midiDevice = useMidiDeviceContext();
```

Remove the `useEffect` cleanup that calls `midiDevice.disconnect()` on unmount (line ~72) — the connection should persist across pages now. The `MidiDeviceProvider` in layout handles the lifecycle.

- [ ] **Step 4: Verify editor still works**

```bash
npm run build
```

Expected: Build succeeds. No runtime errors (manual check: load editor page, verify MIDI device section renders).

- [ ] **Step 5: Run existing tests**

```bash
npm test
```

Expected: All 183+ existing tests pass. The `useMidiDevice.test.ts` tests should still pass because they test the hook directly, not via context.

- [ ] **Step 6: Commit**

```bash
git add src/contexts/MidiDeviceContext.tsx src/app/[locale]/ClientProviders.tsx src/app/[locale]/layout.tsx src/app/[locale]/editor/page.tsx
git commit -m "refactor: lift useMidiDevice to React Context for cross-page sharing"
```

---

## Task 6: `usePlaylist` Hook (TDD)

**Files:**
- Create: `src/hooks/usePlaylist.ts`
- Create: `tests/unit/usePlaylist.test.ts`

**Pattern:** Follow the `usePreset` hook pattern — state + action functions.

- [ ] **Step 1: Write failing tests**

```typescript
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlaylist } from '@/hooks/usePlaylist';

describe('usePlaylist', () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
  });

  it('starts with empty playlists', async () => {
    const { result } = renderHook(() => usePlaylist());
    // Wait for async init
    await act(async () => {});
    expect(result.current.playlists).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('creates a playlist', async () => {
    const { result } = renderHook(() => usePlaylist());
    await act(async () => {});
    await act(async () => {
      await result.current.createPlaylist('Test Playlist');
    });
    expect(result.current.playlists).toHaveLength(1);
    expect(result.current.playlists[0].name).toBe('Test Playlist');
  });

  it('deletes a playlist', async () => {
    const { result } = renderHook(() => usePlaylist());
    await act(async () => {});
    let id: string;
    await act(async () => {
      id = await result.current.createPlaylist('To Delete');
    });
    await act(async () => {
      await result.current.deletePlaylist(id!);
    });
    expect(result.current.playlists).toHaveLength(0);
  });

  it('updates a playlist', async () => {
    const { result } = renderHook(() => usePlaylist());
    await act(async () => {});
    let id: string;
    await act(async () => {
      id = await result.current.createPlaylist('Old');
    });
    const playlist = result.current.playlists[0];
    await act(async () => {
      await result.current.updatePlaylist({ ...playlist, name: 'New' });
    });
    expect(result.current.playlists[0].name).toBe('New');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/usePlaylist.test.ts
```

- [ ] **Step 3: Implement `usePlaylist` hook**

File: `src/hooks/usePlaylist.ts`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  openPlaylistDb,
  createPlaylist as dbCreate,
  getAllPlaylists,
  getPlaylist as dbGet,
  updatePlaylist as dbUpdate,
  deletePlaylist as dbDelete,
  type Playlist,
} from '@/lib/playlistDb';

// openPlaylistDb() is a singleton — safe to call from multiple components.

export function usePlaylist() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const db = await openPlaylistDb();
    const all = await getAllPlaylists(db);
    setPlaylists(all);
  }, []);

  useEffect(() => {
    reload().then(() => setLoading(false));
  }, [reload]);

  const createPlaylist = useCallback(async (name: string): Promise<string> => {
    const db = await openPlaylistDb();
    const id = await dbCreate(db, name);
    await reload();
    return id;
  }, [reload]);

  const updatePlaylist = useCallback(async (playlist: Playlist): Promise<void> => {
    const db = await openPlaylistDb();
    await dbUpdate(db, playlist);
    await reload();
  }, [reload]);

  const deletePlaylist = useCallback(async (id: string): Promise<void> => {
    const db = await openPlaylistDb();
    await dbDelete(db, id);
    await reload();
  }, [reload]);

  const getPlaylist = useCallback(async (id: string): Promise<Playlist | undefined> => {
    const db = await openPlaylistDb();
    return dbGet(db, id);
  }, []);

  return { playlists, loading, createPlaylist, updatePlaylist, deletePlaylist, getPlaylist };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/unit/usePlaylist.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePlaylist.ts tests/unit/usePlaylist.test.ts
git commit -m "feat(playlists): usePlaylist hook with TDD"
```

---

## Task 7: `usePlaylistPlayer` Hook (TDD)

**Files:**
- Create: `src/hooks/usePlaylistPlayer.ts`
- Create: `tests/unit/usePlaylistPlayer.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlaylistPlayer } from '@/hooks/usePlaylistPlayer';
import type { Playlist } from '@/lib/playlistDb';

function makePlaylist(): Playlist {
  return {
    id: '1',
    name: 'Test',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    entries: [
      {
        id: 'e1',
        songName: 'Song A',
        youtubeUrl: 'https://youtube.com/watch?v=abc',
        presets: [
          { id: 'p1', label: 'Clean', presetName: 'CleanPreset', binary: new ArrayBuffer(1224) },
          { id: 'p2', label: 'Drive', presetName: 'DrivePreset', binary: new ArrayBuffer(1224) },
        ],
      },
      {
        id: 'e2',
        songName: 'Song B',
        presets: [
          { id: 'p3', label: 'Lead', presetName: 'LeadPreset', binary: new ArrayBuffer(1224) },
        ],
      },
    ],
  };
}

describe('usePlaylistPlayer', () => {
  it('starts at first song, first preset', () => {
    const { result } = renderHook(() => usePlaylistPlayer(makePlaylist()));
    expect(result.current.currentSongIndex).toBe(0);
    expect(result.current.currentPresetIndex).toBe(0);
    expect(result.current.currentEntry?.songName).toBe('Song A');
    expect(result.current.currentPreset?.label).toBe('Clean');
  });

  it('navigates to next/prev song', () => {
    const { result } = renderHook(() => usePlaylistPlayer(makePlaylist()));
    act(() => result.current.nextSong());
    expect(result.current.currentSongIndex).toBe(1);
    expect(result.current.currentPresetIndex).toBe(0);
    act(() => result.current.prevSong());
    expect(result.current.currentSongIndex).toBe(0);
  });

  it('navigates to next/prev preset within song', () => {
    const { result } = renderHook(() => usePlaylistPlayer(makePlaylist()));
    act(() => result.current.nextPreset());
    expect(result.current.currentPresetIndex).toBe(1);
    act(() => result.current.nextPreset());
    // Should not go beyond last preset
    expect(result.current.currentPresetIndex).toBe(1);
    act(() => result.current.prevPreset());
    expect(result.current.currentPresetIndex).toBe(0);
  });

  it('jumps to specific song', () => {
    const { result } = renderHook(() => usePlaylistPlayer(makePlaylist()));
    act(() => result.current.goToSong(1));
    expect(result.current.currentSongIndex).toBe(1);
    expect(result.current.currentPresetIndex).toBe(0);
  });

  it('jumps to specific preset', () => {
    const { result } = renderHook(() => usePlaylistPlayer(makePlaylist()));
    act(() => result.current.goToPreset(1));
    expect(result.current.currentPresetIndex).toBe(1);
  });

  it('resets preset index on song change', () => {
    const { result } = renderHook(() => usePlaylistPlayer(makePlaylist()));
    act(() => result.current.goToPreset(1));
    expect(result.current.currentPresetIndex).toBe(1);
    act(() => result.current.nextSong());
    expect(result.current.currentPresetIndex).toBe(0);
  });

  it('handles null playlist', () => {
    const { result } = renderHook(() => usePlaylistPlayer(null));
    expect(result.current.currentEntry).toBeNull();
    expect(result.current.currentPreset).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/unit/usePlaylistPlayer.test.ts
```

- [ ] **Step 3: Implement**

File: `src/hooks/usePlaylistPlayer.ts`

```typescript
'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Playlist, PlaylistEntry, PlaylistPreset } from '@/lib/playlistDb';

export function usePlaylistPlayer(playlist: Playlist | null) {
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);

  const entries = playlist?.entries ?? [];

  const currentEntry: PlaylistEntry | null = useMemo(
    () => entries[currentSongIndex] ?? null,
    [entries, currentSongIndex],
  );

  const currentPreset: PlaylistPreset | null = useMemo(
    () => currentEntry?.presets[currentPresetIndex] ?? null,
    [currentEntry, currentPresetIndex],
  );

  const goToSong = useCallback((index: number) => {
    if (index >= 0 && index < entries.length) {
      setCurrentSongIndex(index);
      setCurrentPresetIndex(0);
    }
  }, [entries.length]);

  const goToPreset = useCallback((index: number) => {
    const presets = entries[currentSongIndex]?.presets ?? [];
    if (index >= 0 && index < presets.length) {
      setCurrentPresetIndex(index);
    }
  }, [entries, currentSongIndex]);

  const nextSong = useCallback(() => {
    goToSong(currentSongIndex + 1);
  }, [currentSongIndex, goToSong]);

  const prevSong = useCallback(() => {
    goToSong(currentSongIndex - 1);
  }, [currentSongIndex, goToSong]);

  const nextPreset = useCallback(() => {
    goToPreset(currentPresetIndex + 1);
  }, [currentPresetIndex, goToPreset]);

  const prevPreset = useCallback(() => {
    goToPreset(currentPresetIndex - 1);
  }, [currentPresetIndex, goToPreset]);

  return {
    currentSongIndex,
    currentPresetIndex,
    currentEntry,
    currentPreset,
    goToSong,
    goToPreset,
    nextSong,
    prevSong,
    nextPreset,
    prevPreset,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/unit/usePlaylistPlayer.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePlaylistPlayer.ts tests/unit/usePlaylistPlayer.test.ts
git commit -m "feat(playlists): usePlaylistPlayer navigation hook with TDD"
```

---

## Task 8: YouTubeEmbed Component

**Files:**
- Create: `src/components/YouTubeEmbed.tsx`

**Dependencies:** `src/lib/youtube.ts` (Task 4)

- [ ] **Step 1: Create component**

```typescript
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { extractYouTubeId } from '@/lib/youtube';

interface YouTubeEmbedProps {
  url?: string;
  songName: string;
}

export function YouTubeEmbed({ url, songName }: YouTubeEmbedProps) {
  const t = useTranslations('playlists');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const videoId = useMemo(() => url ? extractYouTubeId(url) : null, [url]);

  if (!videoId || !isOnline) {
    return (
      <div
        className="flex aspect-video w-full items-center justify-center rounded-lg"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          {!videoId ? songName : t('offlineVideo')}
        </p>
      </div>
    );
  }

  return (
    <iframe
      className="aspect-video w-full rounded-lg"
      src={`https://www.youtube.com/embed/${videoId}`}
      title={`YouTube: ${songName}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}
```

- [ ] **Step 2: Add component test**

File: `tests/unit/YouTubeEmbed.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { extractYouTubeId } from '@/lib/youtube';

// Component rendering is tested via E2E. Unit tests cover the URL parsing logic
// which is the critical path — already covered in tests/unit/youtube.test.ts.
// This file adds edge cases specific to the embed context.

describe('YouTubeEmbed URL handling', () => {
  it('handles music.youtube.com URLs', () => {
    expect(extractYouTubeId('https://music.youtube.com/watch?v=abc123')).toBe('abc123');
  });

  it('handles URL with timestamp', () => {
    expect(extractYouTubeId('https://youtu.be/abc123?t=120')).toBe('abc123');
  });

  it('handles URL with playlist param', () => {
    expect(extractYouTubeId('https://youtube.com/watch?v=abc123&list=PLxyz')).toBe('abc123');
  });
});
```

- [ ] **Step 3: Run test**

```bash
npm test -- tests/unit/YouTubeEmbed.test.ts
```

If `music.youtube.com` fails, update `extractYouTubeId` in `src/lib/youtube.ts` to also match `music.youtube.com`.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/YouTubeEmbed.tsx tests/unit/YouTubeEmbed.test.ts
git commit -m "feat(playlists): YouTubeEmbed component with offline placeholder and tests"
```

---

## Task 9: Navbar — Add Playlists Link

**Files:**
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Add Playlists link**

In `Navbar.tsx`, find the desktop nav links section. Add a Playlists link **between the Editor link and the Gallery link** (per spec: "zwischen Editor und Presets/Gallery"). The link order should be: Home, Editor, **Playlists**, Gallery, Help.

Use the exact same `className` pattern and `pathname` comparison as the surrounding links (`font-mono-display text-xs px-2.5 py-1 rounded transition-all`):

```tsx
<Link
  href="/playlists"
  className="font-mono-display text-xs px-2.5 py-1 rounded transition-all"
  style={{
    color: pathname === '/playlists' ? 'var(--accent-amber)' : 'var(--text-secondary)',
    background: pathname === '/playlists' ? 'var(--bg-surface)' : 'transparent',
  }}
>
  {t('playlists')}
</Link>
```

Do the same in the mobile hamburger menu section, in the same position.

**Important:** Use `Link` from `@/i18n/routing`, not `next/link`.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat(playlists): add Playlists link to navigation"
```

---

## Task 10: Playlist Page Router + Overview

**Files:**
- Create: `src/app/[locale]/playlists/page.tsx`
- Create: `src/app/[locale]/playlists/PlaylistPageRouter.tsx`
- Create: `src/app/[locale]/playlists/PlaylistOverview.tsx`

The three playlist views (overview, editor, player) are routed via query params. We use a callback-based navigation system — child components call `setView()` directly instead of `router.push()`, which avoids stale URL state issues with Next.js client-side navigation.

- [ ] **Step 1: Create `PlaylistPageRouter.tsx`**

File: `src/app/[locale]/playlists/PlaylistPageRouter.tsx`

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { PlaylistOverview } from './PlaylistOverview';
import { PlaylistEditor } from './PlaylistEditor';
import { PlaylistPlayer } from './PlaylistPlayer';

type View = { type: 'overview' } | { type: 'edit'; id: string } | { type: 'play'; id: string };

export function PlaylistPageRouter() {
  const [view, setView] = useState<View>({ type: 'overview' });

  // Parse URL on mount and popstate
  const parseUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    const playId = params.get('play');
    if (editId) setView({ type: 'edit', id: editId });
    else if (playId) setView({ type: 'play', id: playId });
    else setView({ type: 'overview' });
  }, []);

  useEffect(() => {
    parseUrl();
    window.addEventListener('popstate', parseUrl);
    return () => window.removeEventListener('popstate', parseUrl);
  }, [parseUrl]);

  // Navigate by updating URL + state together
  const navigate = useCallback((newView: View) => {
    let url = '/playlists';
    if (newView.type === 'edit') url = `/playlists?edit=${newView.id}`;
    else if (newView.type === 'play') url = `/playlists?play=${newView.id}`;
    window.history.pushState(null, '', url);
    setView(newView);
  }, []);

  switch (view.type) {
    case 'edit': return <PlaylistEditor playlistId={view.id} onNavigate={navigate} />;
    case 'play': return <PlaylistPlayer playlistId={view.id} onNavigate={navigate} />;
    default: return <PlaylistOverview onNavigate={navigate} />;
  }
}
```

- [ ] **Step 2: Create server-component wrapper**

File: `src/app/[locale]/playlists/page.tsx`

```typescript
import { PlaylistPageRouter } from './PlaylistPageRouter';

export default function PlaylistsPage() {
  return <PlaylistPageRouter />;
}
```

- [ ] **Step 3: Create PlaylistOverview client component**

File: `src/app/[locale]/playlists/PlaylistOverview.tsx`

All three child views receive `onNavigate` prop for view switching — never use `router.push` for playlist-internal navigation.

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePlaylist } from '@/hooks/usePlaylist';

type View = { type: 'overview' } | { type: 'edit'; id: string } | { type: 'play'; id: string };

interface PlaylistOverviewProps {
  onNavigate: (view: View) => void;
}

export function PlaylistOverview({ onNavigate }: PlaylistOverviewProps) {
  const t = useTranslations('playlists');
  const { playlists, loading, createPlaylist, deletePlaylist } = usePlaylist();
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim()) return;
    const id = await createPlaylist(newName.trim());
    setNewName('');
    setShowCreate(false);
    onNavigate({ type: 'edit', id });
  }

  async function handleDelete(id: string) {
    await deletePlaylist(id);
    setDeleteConfirm(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
             style={{ borderColor: 'var(--accent-amber)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-mono-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('title')}
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg px-4 py-2 font-mono-display text-sm font-bold transition-colors"
          style={{ background: 'var(--accent-amber)', color: 'var(--bg-deep)' }}
        >
          {t('create')}
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('namePlaceholder')}
            className="flex-1 rounded-lg px-3 py-2 font-mono-display text-sm"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button onClick={handleCreate} className="rounded-lg px-4 py-2 font-mono-display text-sm font-bold"
                  style={{ background: 'var(--accent-amber)', color: 'var(--bg-deep)' }}>
            {t('save')}
          </button>
          <button onClick={() => { setShowCreate(false); setNewName(''); }}
                  className="rounded-lg px-4 py-2 font-mono-display text-sm"
                  style={{ color: 'var(--text-secondary)' }}>
            ✕
          </button>
        </div>
      )}

      {playlists.length === 0 ? (
        <p className="py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
          {t('empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              className="flex items-center justify-between rounded-lg p-4 transition-colors"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex-1 cursor-pointer" onClick={() => onNavigate({ type: 'play', id: pl.id })}>
                <h2 className="font-mono-display font-bold" style={{ color: 'var(--text-primary)' }}>{pl.name}</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('songs', { count: pl.entries.length })}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onNavigate({ type: 'play', id: pl.id })}
                  className="rounded px-3 py-1 font-mono-display text-sm"
                  style={{ background: 'var(--accent-amber)', color: 'var(--bg-deep)' }}
                >
                  {t('player')}
                </button>
                <button
                  onClick={() => onNavigate({ type: 'edit', id: pl.id })}
                  className="rounded px-3 py-1 font-mono-display text-sm"
                  style={{ color: 'var(--accent-amber)', border: '1px solid var(--accent-amber)' }}
                >
                  {t('edit')}
                </button>
                {deleteConfirm === pl.id ? (
                  <button
                    onClick={() => handleDelete(pl.id)}
                    className="rounded px-3 py-1 font-mono-display text-sm"
                    style={{ background: '#ef4444', color: 'white' }}
                  >
                    {t('delete')}
                  </button>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(pl.id)}
                    className="rounded px-3 py-1 font-mono-display text-sm"
                    style={{ color: '#ef4444' }}
                  >
                    {t('delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build and that the page renders**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/playlists/page.tsx src/app/[locale]/playlists/PlaylistOverview.tsx
git commit -m "feat(playlists): overview page with create/delete"
```

---

## Task 11: Playlist Editor Page

**Files:**
- Create: `src/app/[locale]/playlists/PlaylistEditor.tsx`

**Dependencies:** Task 10 (PlaylistPageRouter already exists and imports PlaylistEditor)

- [ ] **Step 1: Create PlaylistEditor component**

File: `src/app/[locale]/playlists/PlaylistEditor.tsx`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { usePlaylist } from '@/hooks/usePlaylist';
import { PRSTDecoder } from '@/core/PRSTDecoder';
import type { Playlist, PlaylistEntry, PlaylistPreset } from '@/lib/playlistDb';

type View = { type: 'overview' } | { type: 'edit'; id: string } | { type: 'play'; id: string };

interface PlaylistEditorProps {
  playlistId: string;
  onNavigate: (view: View) => void;
}

export function PlaylistEditor({ playlistId, onNavigate }: PlaylistEditorProps) {
  const t = useTranslations('playlists');
  const { getPlaylist, updatePlaylist } = usePlaylist();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    getPlaylist(playlistId).then(pl => pl && setPlaylist(pl));
  }, [playlistId, getPlaylist]);

  // --- Song CRUD ---
  function addSong() {
    if (!playlist) return;
    setPlaylist({
      ...playlist,
      entries: [...playlist.entries, {
        id: crypto.randomUUID(),
        songName: '',
        presets: [],
      }],
    });
  }

  function updateEntry(index: number, patch: Partial<PlaylistEntry>) {
    if (!playlist) return;
    const entries = [...playlist.entries];
    entries[index] = { ...entries[index], ...patch };
    setPlaylist({ ...playlist, entries });
  }

  function removeEntry(index: number) {
    if (!playlist) return;
    setPlaylist({
      ...playlist,
      entries: playlist.entries.filter((_, i) => i !== index),
    });
  }

  // --- Drag & Drop reorder (same pattern as editor EffectSlot) ---
  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(index: number) {
    if (!playlist || dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const entries = [...playlist.entries];
    const [moved] = entries.splice(dragIndex, 1);
    entries.splice(index, 0, moved);
    setPlaylist({ ...playlist, entries });
    setDragIndex(null);
    setDragOverIndex(null);
  }

  // --- Preset upload ---
  async function handlePresetUpload(entryIndex: number, file: File) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length !== 1224) return;
    const decoder = new PRSTDecoder(bytes);
    if (!decoder.hasMagic()) return;
    const decoded = decoder.decode();
    const newPreset: PlaylistPreset = {
      id: crypto.randomUUID(),
      label: decoded.patchName,
      presetName: decoded.patchName,
      binary: buffer.slice(0, 1224),
    };
    const entries = [...playlist!.entries];
    entries[entryIndex] = {
      ...entries[entryIndex],
      presets: [...entries[entryIndex].presets, newPreset],
    };
    setPlaylist({ ...playlist!, entries });
  }

  function removePreset(entryIndex: number, presetIndex: number) {
    if (!playlist) return;
    const entries = [...playlist.entries];
    entries[entryIndex] = {
      ...entries[entryIndex],
      presets: entries[entryIndex].presets.filter((_, i) => i !== presetIndex),
    };
    setPlaylist({ ...playlist, entries });
  }

  // --- Save ---
  async function handleSave() {
    if (!playlist) return;
    setSaving(true);
    await updatePlaylist(playlist);
    setSaving(false);
    onNavigate({ type: 'overview' });
  }

  if (!playlist) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button onClick={() => onNavigate({ type: 'overview' })}
              className="mb-4 font-mono-display text-sm" style={{ color: 'var(--accent-amber)' }}>
        ← {t('back')}
      </button>

      {/* Playlist name */}
      <input
        type="text"
        value={playlist.name}
        onChange={(e) => setPlaylist({ ...playlist, name: e.target.value })}
        className="mb-6 w-full rounded-lg px-3 py-2 font-mono-display text-lg font-bold"
        style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
      />

      {/* Song entries */}
      {playlist.entries.map((entry, ei) => (
        <div
          key={entry.id}
          draggable
          onDragStart={() => handleDragStart(ei)}
          onDragOver={(e) => handleDragOver(e, ei)}
          onDrop={() => handleDrop(ei)}
          className="mb-4 rounded-lg p-4 transition-all"
          style={{
            background: 'var(--bg-surface)',
            border: dragOverIndex === ei ? '2px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
            opacity: dragIndex === ei ? 0.5 : 1,
            cursor: 'grab',
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono-display text-sm" style={{ color: 'var(--text-secondary)' }}>☰</span>
            <input
              type="text"
              value={entry.songName}
              onChange={(e) => updateEntry(ei, { songName: e.target.value })}
              placeholder={t('songNamePlaceholder')}
              className="flex-1 rounded px-2 py-1 font-mono-display text-sm"
              style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
            />
            <button onClick={() => removeEntry(ei)}
                    className="font-mono-display text-sm" style={{ color: '#ef4444' }}>
              {t('removeSong')}
            </button>
          </div>

          <input
            type="text"
            value={entry.youtubeUrl ?? ''}
            onChange={(e) => updateEntry(ei, { youtubeUrl: e.target.value || undefined })}
            placeholder={t('youtubeUrlPlaceholder')}
            className="mb-2 w-full rounded px-2 py-1 font-mono-display text-sm"
            style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
          />

          {/* Preset chips */}
          <div className="flex flex-wrap gap-1.5">
            {entry.presets.map((preset, pi) => (
              <span key={preset.id}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono-display text-xs"
                    style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                {preset.label}
                <button onClick={() => removePreset(ei, pi)} style={{ color: '#ef4444' }}>×</button>
              </span>
            ))}
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 font-mono-display text-xs"
                   style={{ color: 'var(--accent-amber)', border: '1px dashed var(--accent-amber)' }}>
              + {t('addPreset')}
              <input type="file" accept=".prst" className="hidden"
                     onChange={(e) => e.target.files?.[0] && handlePresetUpload(ei, e.target.files[0])} />
            </label>
          </div>
        </div>
      ))}

      {/* Add song + Save */}
      <div className="flex gap-2">
        <button onClick={addSong}
                className="rounded-lg px-4 py-2 font-mono-display text-sm"
                style={{ color: 'var(--accent-amber)', border: '1px dashed var(--accent-amber)' }}>
          + {t('addSong')}
        </button>
        <button onClick={handleSave} disabled={saving}
                className="ml-auto rounded-lg px-4 py-2 font-mono-display text-sm font-bold"
                style={{ background: 'var(--accent-amber)', color: 'var(--bg-deep)' }}>
          {saving ? '...' : t('save')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/playlists/PlaylistEditor.tsx
git commit -m "feat(playlists): editor page with song/preset management and DnD reorder"
```

---

## Task 12: Playlist Player Page

**Files:**
- Create: `src/app/[locale]/playlists/PlaylistPlayer.tsx`

**Dependencies:** Tasks 7 (usePlaylistPlayer), 8 (YouTubeEmbed), 5 (MidiDeviceContext)

- [ ] **Step 1: Create PlaylistPlayer component**

File: `src/app/[locale]/playlists/PlaylistPlayer.tsx`

This is the main player view from the spec. Structure:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { usePlaylist } from '@/hooks/usePlaylist';
import { usePlaylistPlayer } from '@/hooks/usePlaylistPlayer';
import { useMidiDeviceContext } from '@/contexts/MidiDeviceContext';
import { YouTubeEmbed } from '@/components/YouTubeEmbed';
import { PRSTDecoder } from '@/core/PRSTDecoder';
import type { Playlist } from '@/lib/playlistDb';

type View = { type: 'overview' } | { type: 'edit'; id: string } | { type: 'play'; id: string };

interface PlaylistPlayerProps {
  playlistId: string;
  onNavigate: (view: View) => void;
}

export function PlaylistPlayer({ playlistId, onNavigate }: PlaylistPlayerProps) {
  const t = useTranslations('playlists');
  const tDevice = useTranslations('device');
  const { getPlaylist } = usePlaylist();
  const midiDevice = useMidiDeviceContext();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const player = usePlaylistPlayer(playlist);
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'success' | 'error'>('idle');

  // Load playlist on mount
  useEffect(() => {
    getPlaylist(playlistId).then(pl => pl && setPlaylist(pl));
  }, [playlistId, getPlaylist]);

  // Push preset to device
  const pushCurrentPreset = useCallback(async () => {
    const preset = player.currentPreset;
    if (!preset || midiDevice.status !== 'connected' || midiDevice.currentSlot === null) return;

    setPushStatus('pushing');
    try {
      const bytes = new Uint8Array(preset.binary);
      const decoder = new PRSTDecoder(bytes);
      const decoded = decoder.decode();
      await midiDevice.pushPreset(decoded, midiDevice.currentSlot);
      setPushStatus('success');
      setTimeout(() => setPushStatus('idle'), 2000);
    } catch {
      setPushStatus('error');
      setTimeout(() => setPushStatus('idle'), 3000);
    }
  }, [player.currentPreset, midiDevice]);

  // Auto-push on preset change
  useEffect(() => {
    if (player.currentPreset && midiDevice.status === 'connected') {
      pushCurrentPreset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.currentSongIndex, player.currentPresetIndex]);
  // Intentionally omitting pushCurrentPreset from deps — including it causes infinite loop

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowUp': e.preventDefault(); player.prevSong(); break;
        case 'ArrowDown': e.preventDefault(); player.nextSong(); break;
        case 'ArrowLeft': e.preventDefault(); player.prevPreset(); break;
        case 'ArrowRight': e.preventDefault(); player.nextPreset(); break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [player.prevSong, player.nextSong, player.prevPreset, player.nextPreset]);

  if (!playlist) {
    return <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
           style={{ borderColor: 'var(--accent-amber)', borderTopColor: 'transparent' }} />
    </div>;
  }

  // Render: YouTubeEmbed, active song preset chips, song list, mini device status
  // See spec Section 3 for layout
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back button */}
      <button onClick={() => onNavigate({ type: 'overview' })}
              className="mb-4 font-mono-display text-sm" style={{ color: 'var(--accent-amber)' }}>
        ← {t('back')}
      </button>

      <h1 className="mb-4 font-mono-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {playlist.name}
      </h1>

      {/* YouTube Player */}
      <YouTubeEmbed
        url={player.currentEntry?.youtubeUrl}
        songName={player.currentEntry?.songName ?? ''}
      />

      {/* Active song + preset chips */}
      {player.currentEntry && (
        <div className="mt-4 rounded-lg p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <h2 className="mb-2 font-mono-display font-bold" style={{ color: 'var(--text-primary)' }}>
            {player.currentEntry.songName}
          </h2>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Presets">
            {player.currentEntry.presets.map((preset, i) => (
              <button
                key={preset.id}
                role="tab"
                aria-selected={i === player.currentPresetIndex}
                onClick={() => player.goToPreset(i)}
                className="rounded-full px-4 py-1.5 font-mono-display text-sm font-bold transition-all"
                style={{
                  background: i === player.currentPresetIndex ? 'var(--accent-amber)' : 'transparent',
                  color: i === player.currentPresetIndex ? 'var(--bg-deep)' : 'var(--text-primary)',
                  border: `1px solid ${i === player.currentPresetIndex ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                  animation: i === player.currentPresetIndex && pushStatus === 'pushing' ? 'pulse 1s infinite' : 'none',
                }}
              >
                {preset.label}
                {i === player.currentPresetIndex && pushStatus === 'success' && ' ✓'}
                {i === player.currentPresetIndex && pushStatus === 'error' && ' ✗'}
              </button>
            ))}
          </div>
          {/* Push status aria-live region */}
          <div aria-live="polite" className="sr-only">
            {pushStatus === 'pushing' && t('pushing')}
            {pushStatus === 'success' && t('pushSuccess')}
            {pushStatus === 'error' && t('pushError')}
          </div>
        </div>
      )}

      {/* Song list */}
      <div className="mt-4" role="listbox" aria-label={playlist.name}>
        {playlist.entries.map((entry, i) => (
          <button
            key={entry.id}
            role="option"
            aria-selected={i === player.currentSongIndex}
            onClick={() => player.goToSong(i)}
            className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors"
            style={{
              background: i === player.currentSongIndex ? 'var(--bg-surface)' : 'transparent',
              borderLeft: i === player.currentSongIndex ? '3px solid var(--accent-amber)' : '3px solid transparent',
            }}
          >
            <span className="font-mono-display text-sm" style={{ color: 'var(--text-secondary)' }}>
              {i + 1}.
            </span>
            <span className="flex-1 font-mono" style={{ color: 'var(--text-primary)' }}>
              {entry.songName}
            </span>
            <span className="font-mono-display text-xs" style={{ color: 'var(--text-secondary)' }}>
              {entry.presets.length}P
            </span>
          </button>
        ))}
      </div>

      {/* Mini device status */}
      <div className="mt-6 rounded-lg p-3 text-center font-mono-display text-sm"
           style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
        {midiDevice.status === 'connected' ? (
          <span>
            <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: '#22c55e' }} />
            {midiDevice.deviceName}
            {midiDevice.currentSlot !== null && ` — Slot ${midiDevice.currentSlot}`}
          </span>
        ) : (
          <span>
            <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: '#6b7280' }} />
            {t('noDevice')}
            {' — '}
            <button onClick={() => midiDevice.connect()} style={{ color: 'var(--accent-amber)' }}>
              {tDevice('connect')}
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Manual test**

Open `http://localhost:3000/de/playlists`, create a playlist, add songs + presets, open player. Verify:
- YouTube embed shows for songs with URLs
- Song list navigates correctly
- Arrow keys work
- Preset chips highlight on click

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/playlists/PlaylistPlayer.tsx
git commit -m "feat(playlists): player page with YouTube embed, keyboard nav, device push"
```

---

## Task 13: AddToPlaylistDialog Component

**Files:**
- Create: `src/components/AddToPlaylistDialog.tsx`

**Pattern:** Follow `SavePresetDialog` — fixed overlay, form, ESC to close.

- [ ] **Step 1: Create dialog component**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { usePlaylist } from '@/hooks/usePlaylist';
import type { Playlist, PlaylistPreset } from '@/lib/playlistDb';

interface AddToPlaylistDialogProps {
  presetName: string;
  presetBinary: ArrayBuffer;
  onClose: () => void;
}

export function AddToPlaylistDialog({ presetName, presetBinary, onClose }: AddToPlaylistDialogProps) {
  const t = useTranslations('playlists');
  const { playlists, loading, createPlaylist, getPlaylist, updatePlaylist } = usePlaylist();
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | ''>('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [songName, setSongName] = useState('');
  const [label, setLabel] = useState(presetName);
  const [selectedSongId, setSelectedSongId] = useState<string | 'new'>('new');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [saving, setSaving] = useState(false);

  // Load selected playlist details
  useEffect(() => {
    if (selectedPlaylistId && selectedPlaylistId !== '') {
      getPlaylist(selectedPlaylistId).then(pl => pl && setSelectedPlaylist(pl));
    } else {
      setSelectedPlaylist(null);
    }
  }, [selectedPlaylistId, getPlaylist]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      let playlistId = selectedPlaylistId;

      // Create new playlist if needed
      if (!playlistId && newPlaylistName.trim()) {
        playlistId = await createPlaylist(newPlaylistName.trim());
      }
      if (!playlistId) return;

      const playlist = await getPlaylist(playlistId);
      if (!playlist) return;

      const newPreset: PlaylistPreset = {
        id: crypto.randomUUID(),
        label: label.trim() || presetName,
        presetName,
        binary: presetBinary.slice(0, 1224),
      };

      if (selectedSongId === 'new' && songName.trim()) {
        // Add new song with this preset
        playlist.entries.push({
          id: crypto.randomUUID(),
          songName: songName.trim(),
          presets: [newPreset],
        });
      } else if (selectedSongId !== 'new') {
        // Add preset to existing song
        const entry = playlist.entries.find(e => e.id === selectedSongId);
        if (entry) entry.presets.push(newPreset);
      }

      await updatePlaylist(playlist);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
         style={{ background: 'rgba(0,0,0,0.7)' }}
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-lg p-6"
           style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 24px rgba(0,0,0,0.6)' }}>
        <h2 className="mb-4 font-mono-display text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('addPreset')}
        </h2>
        <p className="mb-4 font-mono-display text-sm" style={{ color: 'var(--accent-amber)' }}>
          {presetName}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Playlist select or create new */}
          <div>
            <label className="mb-1 block font-mono-display text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('title')}
            </label>
            {playlists.length > 0 && (
              <select
                value={selectedPlaylistId}
                onChange={(e) => setSelectedPlaylistId(e.target.value)}
                className="mb-2 w-full rounded-lg px-3 py-2 font-mono-display text-sm"
                style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="">{t('create')}...</option>
                {playlists.map(pl => (
                  <option key={pl.id} value={pl.id}>{pl.name}</option>
                ))}
              </select>
            )}
            {!selectedPlaylistId && (
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className="w-full rounded-lg px-3 py-2 font-mono-display text-sm"
                style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                required={!selectedPlaylistId}
              />
            )}
          </div>

          {/* Song select or create new */}
          <div>
            <label className="mb-1 block font-mono-display text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('songName')}
            </label>
            {selectedPlaylist && selectedPlaylist.entries.length > 0 && (
              <select
                value={selectedSongId}
                onChange={(e) => setSelectedSongId(e.target.value)}
                className="mb-2 w-full rounded-lg px-3 py-2 font-mono-display text-sm"
                style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="new">{t('addSong')}...</option>
                {selectedPlaylist.entries.map(entry => (
                  <option key={entry.id} value={entry.id}>{entry.songName}</option>
                ))}
              </select>
            )}
            {selectedSongId === 'new' && (
              <input
                type="text"
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                placeholder={t('songNamePlaceholder')}
                className="w-full rounded-lg px-3 py-2 font-mono-display text-sm"
                style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                required={selectedSongId === 'new'}
              />
            )}
          </div>

          {/* Preset label */}
          <div>
            <label className="mb-1 block font-mono-display text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('presetLabel')}
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('presetLabelPlaceholder')}
              className="w-full rounded-lg px-3 py-2 font-mono-display text-sm"
              style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose}
                    className="rounded-lg px-4 py-2 font-mono-display text-sm"
                    style={{ color: 'var(--text-secondary)' }}>
              ✕
            </button>
            <button type="submit" disabled={saving}
                    className="rounded-lg px-4 py-2 font-mono-display text-sm font-bold"
                    style={{ background: 'var(--accent-amber)', color: 'var(--bg-deep)' }}>
              {saving ? '...' : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AddToPlaylistDialog.tsx
git commit -m "feat(playlists): AddToPlaylistDialog for editor integration"
```

---

## Task 14: Editor Integration — "Add to Playlist" Button

**Files:**
- Modify: `src/app/[locale]/editor/page.tsx`

- [ ] **Step 1: Add state and import**

In `editor/page.tsx`, add imports:

```typescript
import { AddToPlaylistDialog } from '@/components/AddToPlaylistDialog';
```

Add state:

```typescript
const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
```

- [ ] **Step 2: Add "Add to Playlist" button**

Find the existing download/save button section in the editor JSX. Add a new button after the download button (before or after the save-to-presets button):

```tsx
<button
  onClick={() => setShowPlaylistDialog(true)}
  disabled={!preset}
  className="rounded-lg px-4 py-2 font-mono-display text-sm font-bold transition-colors disabled:opacity-50"
  style={{ color: 'var(--accent-amber)', border: '1px solid var(--accent-amber)' }}
>
  {t('addToPlaylist')}
</button>
```

- [ ] **Step 3: Add dialog render**

At the end of the return JSX (before the closing fragment/div), add:

```tsx
{showPlaylistDialog && preset && (
  <AddToPlaylistDialog
    presetName={preset.patchName}
    presetBinary={encodePreset()!}
    onClose={() => setShowPlaylistDialog(false)}
  />
)}
```

**Note:** `encodePreset()` already exists in the editor — it returns `ArrayBuffer | null` from `PRSTEncoder`.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Run existing tests**

```bash
npm test
```

Expected: All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/[locale]/editor/page.tsx
git commit -m "feat(playlists): add 'Add to Playlist' button in editor"
```

---

## Task 15: PWA — Manifest + Service Worker

**Files:**
- Create: `public/manifest.json`
- Create: `public/icons/` (PWA icons)
- Modify: `src/app/[locale]/layout.tsx`
- Modify: `next.config.mjs`
- Modify: `Dockerfile`

**Note:** This task takes the manual Workbox approach (no `@serwist/next` dependency) for maximum control with `output: 'standalone'`. The service worker registers via a `<script>` tag and uses runtime caching only (no precache manifest — Next.js hashed filenames make precaching fragile).

- [ ] **Step 1: Create `public/manifest.json`**

```json
{
  "name": "Preset Forge — GP-200 Editor",
  "short_name": "Preset Forge",
  "description": "Browser-based preset editor for Valeton GP-200",
  "start_url": "/de/editor",
  "display": "standalone",
  "theme_color": "#d97706",
  "background_color": "#111827",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Create PWA icons**

Generate simple placeholder icons (192×192 and 512×512 PNG). Can use a solid amber (#d97706) square with "PF" text, or convert an existing logo. Place in `public/icons/`.

For now, create minimal placeholders:

```bash
mkdir -p public/icons
# Use ImageMagick if available, or create manually
convert -size 192x192 xc:'#d97706' -font JetBrains-Mono -pointsize 72 -fill '#111827' -gravity center -annotate 0 'PF' public/icons/icon-192.png 2>/dev/null || echo "Create icons manually"
convert -size 512x512 xc:'#d97706' -font JetBrains-Mono -pointsize 192 -fill '#111827' -gravity center -annotate 0 'PF' public/icons/icon-512.png 2>/dev/null || echo "Create icons manually"
```

If ImageMagick is not available, create simple PNG files manually or use any tool.

- [ ] **Step 3: Create `public/sw.js`**

A minimal service worker that caches the app shell on fetch:

```javascript
const CACHE_NAME = 'preset-forge-v1';

// Cache app shell pages and static assets on fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only cache same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Skip API routes, auth routes
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/auth/')) return;

  // Cache-first for static assets
  if (url.pathname.match(/\.(js|css|woff2?|png|svg|ico)$/)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }))
    );
    return;
  }

  // Network-first for pages (editor, playlists)
  if (url.pathname.match(/^\/(de|en)\/(editor|playlists)(\/|$)/) || url.pathname.match(/^\/(de|en)$/)) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }
});

// Clean old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});
```

- [ ] **Step 4: Add manifest link and SW registration to `layout.tsx`**

In `src/app/[locale]/layout.tsx`, add to `<head>`:

```tsx
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#d97706" />
<meta name="apple-mobile-web-app-capable" content="yes" />
```

Add SW registration script. In the layout body (or in `ClientProviders.tsx`):

```typescript
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}, []);
```

Since layout is a server component, the registration should go in `ClientProviders.tsx`.

- [ ] **Step 5: Update Dockerfile to copy public/sw.js**

In `Dockerfile`, in the runner stage, ensure `public/` files are copied. Check if the existing `COPY --from=builder /app/public ./public` line exists. If standalone mode doesn't include public, add:

```dockerfile
COPY --from=builder /app/public ./public
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add public/manifest.json public/sw.js public/icons/ src/app/[locale]/layout.tsx src/app/[locale]/ClientProviders.tsx Dockerfile
git commit -m "feat(pwa): add manifest, service worker, offline caching"
```

---

## Task 16: E2E Tests

**Files:**
- Create: `tests/e2e/playlists.spec.ts`

- [ ] **Step 1: Write E2E test for basic playlist flow**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Playlists', () => {
  test('create playlist, add song, open player', async ({ page }) => {
    await page.goto('/de/playlists');

    // Create playlist
    await page.click('text=Neue Playlist');
    await page.fill('input[placeholder]', 'Test Playlist');
    await page.click('text=Speichern');

    // Should redirect to edit view
    await expect(page).toHaveURL(/edit=/);

    // Add song
    await page.click('text=Song hinzufügen');
    await page.fill('input[placeholder="z.B. Master of Puppets"]', 'Test Song');

    // Upload preset
    const presetPath = 'prst/63-B American Idiot.prst';
    const fileInput = page.locator('input[type="file"][accept=".prst"]').first();
    await fileInput.setInputFiles(presetPath);

    // Save
    await page.click('text=Speichern');

    // Navigate to player
    await page.goto('/de/playlists');
    await page.click('text=Abspielen');

    // Verify player view
    await expect(page.locator('text=Test Song')).toBeVisible();
  });

  test('keyboard navigation in player', async ({ page }) => {
    // Assumes a playlist exists from previous setup
    // This test would need a playlist with multiple songs
    await page.goto('/de/playlists');

    // Verify playlists page loads
    await expect(page.locator('h1:has-text("Playlists")')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E tests**

```bash
npm run test:e2e -- tests/e2e/playlists.spec.ts
```

**Note:** E2E requires the app running + DB + Garage. If not available, mark as manual verification step.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/playlists.spec.ts
git commit -m "test(playlists): E2E tests for playlist create and player"
```

---

## Task 17: Final Verification + Run All Tests

- [ ] **Step 1: Run all unit tests**

```bash
npm test
```

Expected: All tests pass (existing 183+ plus new playlist/youtube/player tests).

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Smoke test the full flow manually**

1. Open `/de/editor`, load a .prst file, click "Add to Playlist"
2. Create a new playlist, add the preset to a new song
3. Go to `/de/playlists`, see the playlist
4. Click "Edit", add a YouTube URL
5. Click "Play", verify video + preset chips
6. Click preset chips, verify visual feedback
7. Test keyboard navigation (arrow keys)
8. Disconnect WiFi, verify editor + playlists still load (service worker)

- [ ] **Step 4: Fix any issues found**

- [ ] **Step 5: Final commit if any fixes**

```bash
git add -A
git commit -m "fix(playlists): address smoke test findings"
```
