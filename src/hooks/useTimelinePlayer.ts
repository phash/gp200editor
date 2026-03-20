import { useState, useCallback, useRef, useEffect } from 'react';
import type { CuePoint } from '@/lib/playlistDb';

type TimelineState = 'stopped' | 'playing' | 'paused';

interface TimelinePlayer {
  state: TimelineState;
  elapsedSeconds: number;
  firedIds: Set<string>;
  play: () => void;
  pause: () => void;
  stop: () => void;
}

export function useTimelinePlayer(
  cuePoints: CuePoint[],
  onFire: (cuePoint: CuePoint) => void,
): TimelinePlayer {
  const [state, setState] = useState<TimelineState>('stopped');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [firedIds, setFiredIds] = useState<Set<string>>(new Set());

  const stateRef = useRef(state);
  const startTimeRef = useRef(0);
  const pausedElapsedRef = useRef(0);
  const firedRef = useRef(firedIds);
  const rafRef = useRef(0);

  stateRef.current = state;
  firedRef.current = firedIds;

  const tick = useCallback(() => {
    if (stateRef.current !== 'playing') return;
    const now = performance.now();
    const elapsed = pausedElapsedRef.current + (now - startTimeRef.current) / 1000;
    setElapsedSeconds(elapsed);
    const newFired = new Set(firedRef.current);
    for (const cp of cuePoints) {
      if (!newFired.has(cp.id) && cp.timeSeconds <= elapsed) {
        newFired.add(cp.id);
        onFire(cp);
      }
    }
    if (newFired.size !== firedRef.current.size) {
      setFiredIds(newFired);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [cuePoints, onFire]);

  const play = useCallback(() => {
    startTimeRef.current = performance.now();
    setState('playing');
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    pausedElapsedRef.current += (performance.now() - startTimeRef.current) / 1000;
    setState('paused');
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    pausedElapsedRef.current = 0;
    startTimeRef.current = 0;
    setState('stopped');
    setElapsedSeconds(0);
    setFiredIds(new Set());
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return { state, elapsedSeconds, firedIds, play, pause, stop };
}
