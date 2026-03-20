import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimelinePlayer } from '@/hooks/useTimelinePlayer';
import type { CuePoint } from '@/lib/playlistDb';

let rafCallback: FrameRequestCallback | null = null;
let rafId = 0;

beforeEach(() => {
  rafCallback = null;
  rafId = 0;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    rafCallback = cb;
    return ++rafId;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {
    rafCallback = null;
  });
  vi.spyOn(performance, 'now').mockReturnValue(0);
});

afterEach(() => { vi.restoreAllMocks(); });

function advanceTime(ms: number) {
  vi.spyOn(performance, 'now').mockReturnValue(ms);
  if (rafCallback) {
    const cb = rafCallback;
    rafCallback = null;
    act(() => cb(ms));
  }
}

const cuePoints: CuePoint[] = [
  { id: 'cp1', timeSeconds: 0, action: 'preset-switch', slot: 0 },
  { id: 'cp2', timeSeconds: 5, action: 'effect-toggle', blockIndex: 8, enabled: true },
  { id: 'cp3', timeSeconds: 10, action: 'preset-switch', slot: 4 },
];

describe('useTimelinePlayer', () => {
  it('starts in stopped state', () => {
    const onFire = vi.fn();
    const { result } = renderHook(() => useTimelinePlayer(cuePoints, onFire));
    expect(result.current.state).toBe('stopped');
    expect(result.current.elapsedSeconds).toBe(0);
  });

  it('fires t=0 cue point immediately on play', () => {
    const onFire = vi.fn();
    const { result } = renderHook(() => useTimelinePlayer(cuePoints, onFire));
    act(() => result.current.play());
    advanceTime(100);
    expect(onFire).toHaveBeenCalledWith(cuePoints[0]);
  });

  it('fires cue points at correct time', () => {
    const onFire = vi.fn();
    const { result } = renderHook(() => useTimelinePlayer(cuePoints, onFire));
    act(() => result.current.play());
    advanceTime(1000);
    expect(onFire).toHaveBeenCalledTimes(1);
    advanceTime(5500);
    expect(onFire).toHaveBeenCalledTimes(2);
    expect(onFire).toHaveBeenCalledWith(cuePoints[1]);
  });

  it('does not double-fire cue points', () => {
    const onFire = vi.fn();
    const { result } = renderHook(() => useTimelinePlayer(cuePoints, onFire));
    act(() => result.current.play());
    advanceTime(6000);
    advanceTime(6100);
    advanceTime(6200);
    expect(onFire).toHaveBeenCalledTimes(2);
  });

  it('pause preserves state, resume continues', () => {
    const onFire = vi.fn();
    const { result } = renderHook(() => useTimelinePlayer(cuePoints, onFire));
    act(() => result.current.play());
    advanceTime(3000);
    act(() => result.current.pause());
    expect(result.current.state).toBe('paused');
    act(() => result.current.play());
    advanceTime(8000);
    expect(onFire).toHaveBeenCalledWith(cuePoints[1]);
  });

  it('stop resets everything', () => {
    const onFire = vi.fn();
    const { result } = renderHook(() => useTimelinePlayer(cuePoints, onFire));
    act(() => result.current.play());
    advanceTime(6000);
    act(() => result.current.stop());
    expect(result.current.state).toBe('stopped');
    expect(result.current.elapsedSeconds).toBe(0);
    expect(result.current.firedIds.size).toBe(0);
  });

  it('handles empty cue points', () => {
    const onFire = vi.fn();
    const { result } = renderHook(() => useTimelinePlayer([], onFire));
    act(() => result.current.play());
    advanceTime(5000);
    act(() => result.current.stop());
    expect(onFire).not.toHaveBeenCalled();
  });
});
