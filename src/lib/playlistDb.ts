import { openDB, type IDBPDatabase } from 'idb';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlaylistPreset {
  id: string;
  label: string;
  presetName: string;
  binary: ArrayBuffer;
}

export interface CuePoint {
  id: string;
  timeSeconds: number;
  action: 'preset-switch' | 'effect-toggle';
  slot?: number;        // preset-switch: GP-200 slot 0-255
  blockIndex?: number;  // effect-toggle: 0-10
  enabled?: boolean;    // effect-toggle: on/off
}

export interface PlaylistEntry {
  id: string;
  songName: string;
  youtubeUrl?: string;
  presets: PlaylistPreset[];
  cuePoints?: CuePoint[];
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  entries: PlaylistEntry[];
}

// ─── DB Constants ─────────────────────────────────────────────────────────────

const DB_NAME = 'preset-forge';
const DB_VERSION = 1;
const STORE_PLAYLISTS = 'playlists';
const PRST_SIZE = 1224;

// ─── Singleton ────────────────────────────────────────────────────────────────

// Multiple hooks/components share one connection per page lifecycle.
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

/**
 * Resets the singleton for testing purposes. Call this in beforeEach together
 * with replacing globalThis.indexedDB with a fresh IDBFactory instance so that
 * each test starts with a clean, empty database.
 */
export function _resetDbForTesting(): void {
  dbPromise = null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ensures all preset binaries are at most PRST_SIZE bytes.
 * Oversized buffers are sliced; undersized buffers are left as-is (no padding).
 */
function sliceBinaries(playlist: Playlist): Playlist {
  return {
    ...playlist,
    entries: playlist.entries.map((entry) => ({
      ...entry,
      presets: entry.presets.map((preset) => ({
        ...preset,
        binary:
          preset.binary.byteLength > PRST_SIZE
            ? preset.binary.slice(0, PRST_SIZE)
            : preset.binary,
      })),
    })),
  };
}

function generateId(): string {
  // crypto.randomUUID is available in modern browsers and Node 14.17+
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── CRUD Operations ──────────────────────────────────────────────────────────

/**
 * Creates a new empty playlist with the given name and persists it to IndexedDB.
 */
export async function createPlaylist(db: IDBPDatabase, name: string): Promise<Playlist> {
  const now = Date.now();
  const playlist: Playlist = {
    id: generateId(),
    name,
    createdAt: now,
    updatedAt: now,
    entries: [],
  };
  await db.put(STORE_PLAYLISTS, playlist);
  return playlist;
}

/**
 * Retrieves a playlist by id. Returns null if not found.
 */
export async function getPlaylist(db: IDBPDatabase, id: string): Promise<Playlist | null> {
  const result = await db.get(STORE_PLAYLISTS, id);
  return result ?? null;
}

/**
 * Returns all playlists stored in the database.
 */
export async function getAllPlaylists(db: IDBPDatabase): Promise<Playlist[]> {
  return db.getAll(STORE_PLAYLISTS);
}

/**
 * Persists an updated playlist. Oversized preset binaries are sliced to 1224 bytes
 * before storage to keep the DB consistent with the .prst format.
 */
export async function updatePlaylist(db: IDBPDatabase, playlist: Playlist): Promise<void> {
  const safe = sliceBinaries(playlist);
  await db.put(STORE_PLAYLISTS, safe);
}

/**
 * Deletes a playlist by id.
 */
export async function deletePlaylist(db: IDBPDatabase, id: string): Promise<void> {
  await db.delete(STORE_PLAYLISTS, id);
}
