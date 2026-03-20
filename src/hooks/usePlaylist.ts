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

  const createPlaylist = useCallback(
    async (name: string): Promise<string> => {
      const db = await openPlaylistDb();
      const playlist = await dbCreate(db, name);
      await reload();
      return playlist.id;
    },
    [reload],
  );

  const updatePlaylist = useCallback(
    async (playlist: Playlist): Promise<void> => {
      const db = await openPlaylistDb();
      await dbUpdate(db, playlist);
      await reload();
    },
    [reload],
  );

  const deletePlaylist = useCallback(
    async (id: string): Promise<void> => {
      const db = await openPlaylistDb();
      await dbDelete(db, id);
      await reload();
    },
    [reload],
  );

  const getPlaylist = useCallback(async (id: string): Promise<Playlist | undefined> => {
    const db = await openPlaylistDb();
    const result = await dbGet(db, id);
    return result ?? undefined;
  }, []);

  return { playlists, loading, createPlaylist, updatePlaylist, deletePlaylist, getPlaylist };
}
