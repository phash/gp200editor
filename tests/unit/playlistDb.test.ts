import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  openPlaylistDb,
  createPlaylist,
  getPlaylist,
  getAllPlaylists,
  updatePlaylist,
  deletePlaylist,
  _resetDbForTesting,
  type Playlist,
  type PlaylistEntry,
  type PlaylistPreset,
} from '@/lib/playlistDb';

beforeEach(() => {
  // Reset the singleton db promise so each test gets a fresh DB connection
  _resetDbForTesting();
  // Replace the global IndexedDB with a fresh in-memory store.
  // Must use the ESM-imported IDBFactory (same module as fake-indexeddb/auto) so that
  // instanceof checks inside the `idb` library resolve correctly.
  globalThis.indexedDB = new IDBFactory();
});

describe('playlistDb', () => {
  describe('createPlaylist / getPlaylist', () => {
    it('creates a playlist and retrieves it by id', async () => {
      const db = await openPlaylistDb();
      const playlist = await createPlaylist(db, 'My Set List');

      expect(playlist.id).toBeTruthy();
      expect(playlist.name).toBe('My Set List');
      expect(playlist.entries).toEqual([]);
      expect(typeof playlist.createdAt).toBe('number');
      expect(typeof playlist.updatedAt).toBe('number');

      const retrieved = await getPlaylist(db, playlist.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(playlist.id);
      expect(retrieved!.name).toBe('My Set List');
    });

    it('returns null for a non-existent id', async () => {
      const db = await openPlaylistDb();
      const result = await getPlaylist(db, 'does-not-exist');
      expect(result).toBeNull();
    });
  });

  describe('getAllPlaylists', () => {
    it('returns an empty array when no playlists exist', async () => {
      const db = await openPlaylistDb();
      const all = await getAllPlaylists(db);
      expect(all).toEqual([]);
    });

    it('lists all created playlists', async () => {
      const db = await openPlaylistDb();
      await createPlaylist(db, 'Set A');
      await createPlaylist(db, 'Set B');
      await createPlaylist(db, 'Set C');

      const all = await getAllPlaylists(db);
      expect(all).toHaveLength(3);
      const names = all.map((p) => p.name).sort();
      expect(names).toEqual(['Set A', 'Set B', 'Set C']);
    });
  });

  describe('updatePlaylist', () => {
    it('updates the playlist name and entries', async () => {
      const db = await openPlaylistDb();
      const playlist = await createPlaylist(db, 'Original Name');

      const entry: PlaylistEntry = {
        id: 'entry-1',
        songName: 'Song One',
        youtubeUrl: 'https://youtube.com/watch?v=abc123',
        presets: [],
      };

      const updated: Playlist = {
        ...playlist,
        name: 'Updated Name',
        entries: [entry],
        updatedAt: Date.now() + 1000,
      };

      await updatePlaylist(db, updated);

      const retrieved = await getPlaylist(db, playlist.id);
      expect(retrieved!.name).toBe('Updated Name');
      expect(retrieved!.entries).toHaveLength(1);
      expect(retrieved!.entries[0].songName).toBe('Song One');
      expect(retrieved!.entries[0].youtubeUrl).toBe('https://youtube.com/watch?v=abc123');
    });

    it('preserves other playlists when updating one', async () => {
      const db = await openPlaylistDb();
      const a = await createPlaylist(db, 'Set A');
      const b = await createPlaylist(db, 'Set B');

      await updatePlaylist(db, { ...a, name: 'Set A Updated', updatedAt: Date.now() });

      const retrievedB = await getPlaylist(db, b.id);
      expect(retrievedB!.name).toBe('Set B');
    });
  });

  describe('deletePlaylist', () => {
    it('deletes a playlist so it can no longer be retrieved', async () => {
      const db = await openPlaylistDb();
      const playlist = await createPlaylist(db, 'To Delete');

      await deletePlaylist(db, playlist.id);

      const retrieved = await getPlaylist(db, playlist.id);
      expect(retrieved).toBeNull();
    });

    it('does not affect other playlists when deleting one', async () => {
      const db = await openPlaylistDb();
      const a = await createPlaylist(db, 'Keep Me');
      const b = await createPlaylist(db, 'Delete Me');

      await deletePlaylist(db, b.id);

      const all = await getAllPlaylists(db);
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(a.id);
    });
  });

  describe('binary size validation (sliceBinaries)', () => {
    it('stores an exactly 1224-byte binary unchanged', async () => {
      const db = await openPlaylistDb();
      const playlist = await createPlaylist(db, 'Binary Test');

      const exactBinary = new ArrayBuffer(1224);
      const preset: PlaylistPreset = {
        id: 'preset-exact',
        label: 'Exact',
        presetName: 'Clean Tone',
        binary: exactBinary,
      };

      const entry: PlaylistEntry = {
        id: 'entry-binary',
        songName: 'Binary Song',
        presets: [preset],
      };

      const updated: Playlist = {
        ...playlist,
        entries: [entry],
        updatedAt: Date.now(),
      };

      await updatePlaylist(db, updated);
      const retrieved = await getPlaylist(db, playlist.id);
      expect(retrieved!.entries[0].presets[0].binary.byteLength).toBe(1224);
    });

    it('slices an oversized binary down to 1224 bytes on storage', async () => {
      const db = await openPlaylistDb();
      const playlist = await createPlaylist(db, 'Oversized Binary Test');

      const oversizedBinary = new ArrayBuffer(2000);
      const preset: PlaylistPreset = {
        id: 'preset-oversized',
        label: 'Oversized',
        presetName: 'Heavy Dist',
        binary: oversizedBinary,
      };

      const entry: PlaylistEntry = {
        id: 'entry-oversized',
        songName: 'Oversized Song',
        presets: [preset],
      };

      const updated: Playlist = {
        ...playlist,
        entries: [entry],
        updatedAt: Date.now(),
      };

      await updatePlaylist(db, updated);
      const retrieved = await getPlaylist(db, playlist.id);
      expect(retrieved!.entries[0].presets[0].binary.byteLength).toBe(1224);
    });

    it('stores a binary smaller than 1224 bytes unchanged (no padding)', async () => {
      const db = await openPlaylistDb();
      const playlist = await createPlaylist(db, 'Small Binary Test');

      const smallBinary = new ArrayBuffer(512);
      const preset: PlaylistPreset = {
        id: 'preset-small',
        label: 'Small',
        presetName: 'Partial Preset',
        binary: smallBinary,
      };

      const entry: PlaylistEntry = {
        id: 'entry-small',
        songName: 'Small Song',
        presets: [preset],
      };

      const updated: Playlist = {
        ...playlist,
        entries: [entry],
        updatedAt: Date.now(),
      };

      await updatePlaylist(db, updated);
      const retrieved = await getPlaylist(db, playlist.id);
      // Smaller than 1224: slice(0, 1224) returns the whole buffer, no padding
      expect(retrieved!.entries[0].presets[0].binary.byteLength).toBe(512);
    });
  });
});
