import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlaylistPlayer } from '@/hooks/usePlaylistPlayer';
import type { Playlist } from '@/hooks/usePlaylistPlayer';

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
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    expect(result.current.currentSongIndex).toBe(0);
    expect(result.current.currentPresetIndex).toBe(0);
    expect(result.current.currentEntry?.id).toBe('e1');
    expect(result.current.currentPreset?.id).toBe('p1');
  });

  it('navigates to next song', () => {
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    act(() => { result.current.nextSong(); });

    expect(result.current.currentSongIndex).toBe(1);
    expect(result.current.currentEntry?.id).toBe('e2');
  });

  it('navigates to prev song', () => {
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    act(() => { result.current.nextSong(); });
    act(() => { result.current.prevSong(); });

    expect(result.current.currentSongIndex).toBe(0);
    expect(result.current.currentEntry?.id).toBe('e1');
  });

  it('does not go past last song (clamped)', () => {
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    act(() => { result.current.nextSong(); }); // index 1
    act(() => { result.current.nextSong(); }); // index 2 — out of bounds, should stay at 1

    expect(result.current.currentSongIndex).toBe(1);
  });

  it('does not go before first song (clamped)', () => {
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    act(() => { result.current.prevSong(); }); // index -1 — out of bounds, should stay at 0

    expect(result.current.currentSongIndex).toBe(0);
  });

  it('navigates to next preset within song', () => {
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    act(() => { result.current.nextPreset(); });

    expect(result.current.currentPresetIndex).toBe(1);
    expect(result.current.currentPreset?.id).toBe('p2');
  });

  it('navigates to prev preset within song', () => {
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    act(() => { result.current.nextPreset(); });
    act(() => { result.current.prevPreset(); });

    expect(result.current.currentPresetIndex).toBe(0);
    expect(result.current.currentPreset?.id).toBe('p1');
  });

  it('does not go past last preset (clamped)', () => {
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    act(() => { result.current.nextPreset(); }); // index 1
    act(() => { result.current.nextPreset(); }); // index 2 — out of bounds, should stay at 1

    expect(result.current.currentPresetIndex).toBe(1);
  });

  it('does not go before first preset (clamped)', () => {
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    act(() => { result.current.prevPreset(); }); // index -1 — out of bounds, should stay at 0

    expect(result.current.currentPresetIndex).toBe(0);
  });

  it('jumps to specific song via goToSong', () => {
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    act(() => { result.current.goToSong(1); });

    expect(result.current.currentSongIndex).toBe(1);
    expect(result.current.currentEntry?.songName).toBe('Song B');
  });

  it('ignores out-of-bounds goToSong', () => {
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    act(() => { result.current.goToSong(99); });
    expect(result.current.currentSongIndex).toBe(0);

    act(() => { result.current.goToSong(-1); });
    expect(result.current.currentSongIndex).toBe(0);
  });

  it('jumps to specific preset via goToPreset', () => {
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    act(() => { result.current.goToPreset(1); });

    expect(result.current.currentPresetIndex).toBe(1);
    expect(result.current.currentPreset?.label).toBe('Drive');
  });

  it('ignores out-of-bounds goToPreset', () => {
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    act(() => { result.current.goToPreset(99); });
    expect(result.current.currentPresetIndex).toBe(0);

    act(() => { result.current.goToPreset(-1); });
    expect(result.current.currentPresetIndex).toBe(0);
  });

  it('resets preset index when changing song', () => {
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    act(() => { result.current.nextPreset(); }); // preset index = 1
    expect(result.current.currentPresetIndex).toBe(1);

    act(() => { result.current.nextSong(); }); // change song → preset resets to 0
    expect(result.current.currentPresetIndex).toBe(0);
  });

  it('resets preset index when goToSong is called', () => {
    const playlist = makePlaylist();
    const { result } = renderHook(() => usePlaylistPlayer(playlist));

    act(() => { result.current.nextPreset(); }); // preset index = 1
    act(() => { result.current.goToSong(1); });  // jump to song → preset resets to 0

    expect(result.current.currentPresetIndex).toBe(0);
    expect(result.current.currentPreset?.id).toBe('p3');
  });

  it('handles null playlist gracefully', () => {
    const { result } = renderHook(() => usePlaylistPlayer(null));

    expect(result.current.currentSongIndex).toBe(0);
    expect(result.current.currentPresetIndex).toBe(0);
    expect(result.current.currentEntry).toBeNull();
    expect(result.current.currentPreset).toBeNull();
  });

  it('nextSong and prevSong are no-ops on null playlist', () => {
    const { result } = renderHook(() => usePlaylistPlayer(null));

    act(() => { result.current.nextSong(); });
    act(() => { result.current.prevSong(); });

    expect(result.current.currentSongIndex).toBe(0);
    expect(result.current.currentEntry).toBeNull();
  });

  it('nextPreset and prevPreset are no-ops on null playlist', () => {
    const { result } = renderHook(() => usePlaylistPlayer(null));

    act(() => { result.current.nextPreset(); });
    act(() => { result.current.prevPreset(); });

    expect(result.current.currentPresetIndex).toBe(0);
    expect(result.current.currentPreset).toBeNull();
  });
});
