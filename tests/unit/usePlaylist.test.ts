import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePlaylist } from '@/hooks/usePlaylist';
import { _resetDbForTesting } from '@/lib/playlistDb';

beforeEach(() => {
  // Replace the global IndexedDB with a fresh in-memory store.
  globalThis.indexedDB = new IDBFactory();
  // Reset the singleton db promise so each test gets a fresh DB connection.
  _resetDbForTesting();
});

describe('usePlaylist', () => {
  it('starts with empty playlists and loading=false after init', async () => {
    const { result } = renderHook(() => usePlaylist());

    // Initially loading=true, playlists=[]
    expect(result.current.loading).toBe(true);
    expect(result.current.playlists).toEqual([]);

    // Wait for the async init to complete (IDB open + getAll + setState)
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.playlists).toEqual([]);
  });

  it('creates a playlist and updates the playlists array', async () => {
    const { result } = renderHook(() => usePlaylist());

    // Wait for init
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.playlists).toHaveLength(0);

    let createdId: string;
    await act(async () => {
      createdId = await result.current.createPlaylist('My Set List');
    });

    expect(typeof createdId!).toBe('string');
    expect(createdId!).toBeTruthy();
    expect(result.current.playlists).toHaveLength(1);
    expect(result.current.playlists[0].name).toBe('My Set List');
    expect(result.current.playlists[0].id).toBe(createdId!);
  });

  it('deletes a playlist and updates the playlists array', async () => {
    const { result } = renderHook(() => usePlaylist());

    // Wait for init
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Create two playlists
    let idA: string;
    let idB: string;
    await act(async () => {
      idA = await result.current.createPlaylist('Set A');
      idB = await result.current.createPlaylist('Set B');
    });
    expect(result.current.playlists).toHaveLength(2);

    // Delete one
    await act(async () => {
      await result.current.deletePlaylist(idA!);
    });

    expect(result.current.playlists).toHaveLength(1);
    expect(result.current.playlists[0].id).toBe(idB!);
    expect(result.current.playlists[0].name).toBe('Set B');
  });

  it('updates a playlist name and reflects the change in the playlists array', async () => {
    const { result } = renderHook(() => usePlaylist());

    // Wait for init
    await waitFor(() => expect(result.current.loading).toBe(false));

    let createdId: string;
    await act(async () => {
      createdId = await result.current.createPlaylist('Original Name');
    });
    expect(result.current.playlists[0].name).toBe('Original Name');

    // Get the playlist and update its name
    const playlist = result.current.playlists[0];
    await act(async () => {
      await result.current.updatePlaylist({
        ...playlist,
        name: 'Updated Name',
        updatedAt: Date.now() + 1000,
      });
    });

    expect(result.current.playlists).toHaveLength(1);
    expect(result.current.playlists[0].name).toBe('Updated Name');
    expect(result.current.playlists[0].id).toBe(createdId!);
  });
});
