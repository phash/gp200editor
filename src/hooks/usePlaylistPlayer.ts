'use client';

import { useState, useCallback, useMemo } from 'react';

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

export function usePlaylistPlayer(playlist: Playlist | null) {
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);

  const entries = playlist?.entries ?? [];

  const currentEntry = useMemo(
    () => entries[currentSongIndex] ?? null,
    [entries, currentSongIndex],
  );

  const currentPreset = useMemo(
    () => currentEntry?.presets[currentPresetIndex] ?? null,
    [currentEntry, currentPresetIndex],
  );

  const goToSong = useCallback(
    (index: number) => {
      if (index >= 0 && index < entries.length) {
        setCurrentSongIndex(index);
        setCurrentPresetIndex(0); // Reset preset on song change
      }
    },
    [entries.length],
  );

  const goToPreset = useCallback(
    (index: number) => {
      const presets = entries[currentSongIndex]?.presets ?? [];
      if (index >= 0 && index < presets.length) {
        setCurrentPresetIndex(index);
      }
    },
    [entries, currentSongIndex],
  );

  const nextSong = useCallback(
    () => goToSong(currentSongIndex + 1),
    [currentSongIndex, goToSong],
  );
  const prevSong = useCallback(
    () => goToSong(currentSongIndex - 1),
    [currentSongIndex, goToSong],
  );
  const nextPreset = useCallback(
    () => goToPreset(currentPresetIndex + 1),
    [currentPresetIndex, goToPreset],
  );
  const prevPreset = useCallback(
    () => goToPreset(currentPresetIndex - 1),
    [currentPresetIndex, goToPreset],
  );

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
