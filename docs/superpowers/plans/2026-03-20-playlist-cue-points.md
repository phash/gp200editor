# Playlist Cue Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add timed cue points to playlist entries that trigger MIDI preset switches and effect toggles during live playback.

**Architecture:** Extend `PlaylistEntry` in IndexedDB with a `cuePoints` array. New `useTimelinePlayer` hook runs a rAF timer and fires MIDI actions at specified timestamps. Cue point table UI added to `PlaylistPlayer.tsx`.

**Tech Stack:** React hooks, IndexedDB (idb), Web MIDI (existing `useMidiDevice`), Vitest, next-intl

**Spec:** `docs/superpowers/specs/2026-03-20-playlist-cue-points-design.md`

---

### Task 1: Add CuePoint type and extend PlaylistEntry

**Files:**
- Modify: `src/lib/playlistDb.ts`
- Modify: `tests/unit/playlistDb.test.ts`

- [ ] **Step 1: Add CuePoint interface and extend PlaylistEntry**

In `src/lib/playlistDb.ts`, add after the `PlaylistPreset` interface:

```ts
export interface CuePoint {
  id: string;
  timeSeconds: number;
  action: 'preset-switch' | 'effect-toggle';
  slot?: number;        // preset-switch: GP-200 slot 0-255
  blockIndex?: number;  // effect-toggle: 0-10
  enabled?: boolean;    // effect-toggle: on/off
}
```

Add `cuePoints?: CuePoint[]` to `PlaylistEntry` interface.

- [ ] **Step 2: Write test for cue point persistence**

In `tests/unit/playlistDb.test.ts`, add a test that creates a playlist with an entry containing cue points, saves it, retrieves it, and verifies the cue points are intact.

```ts
it('persists cue points on playlist entries', async () => {
  const db = await openPlaylistDb();
  const playlist = await createPlaylist(db, 'Cue Test');
  playlist.entries.push({
    id: 'e1',
    songName: 'Song 1',
    presets: [],
    cuePoints: [
      { id: 'cp1', timeSeconds: 0, action: 'preset-switch', slot: 0 },
      { id: 'cp2', timeSeconds: 18, action: 'effect-toggle', blockIndex: 8, enabled: true },
    ],
  });
  await updatePlaylist(db, playlist);
  const loaded = await getPlaylist(db, playlist.id);
  expect(loaded!.entries[0].cuePoints).toHaveLength(2);
  expect(loaded!.entries[0].cuePoints![0].action).toBe('preset-switch');
  expect(loaded!.entries[0].cuePoints![1].timeSeconds).toBe(18);
});
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- tests/unit/playlistDb.test.ts`
Expected: All pass including new test.

- [ ] **Step 4: Commit**

```bash
git add src/lib/playlistDb.ts tests/unit/playlistDb.test.ts
git commit -m "feat: add CuePoint type to PlaylistEntry"
```

---

### Task 2: Build useTimelinePlayer hook

**Files:**
- Create: `src/hooks/useTimelinePlayer.ts`
- Create: `tests/unit/useTimelinePlayer.test.ts`

- [ ] **Step 1: Write failing tests for the timer hook**

Create `tests/unit/useTimelinePlayer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimelinePlayer } from '@/hooks/useTimelinePlayer';
import type { CuePoint } from '@/lib/playlistDb';

// Mock rAF with manual control
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

afterEach(() => {
  vi.restoreAllMocks();
});

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
    expect(result.current.state).toBe('playing');
    // rAF fires once
    advanceTime(100);
    expect(onFire).toHaveBeenCalledWith(cuePoints[0]);
  });

  it('fires cue points at correct time', () => {
    const onFire = vi.fn();
    const { result } = renderHook(() => useTimelinePlayer(cuePoints, onFire));
    act(() => result.current.play());
    advanceTime(1000); // 1s — only cp1 fired
    expect(onFire).toHaveBeenCalledTimes(1);
    advanceTime(5500); // 5.5s — cp2 should fire
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
    // cp1 and cp2 fired, but only once each
    expect(onFire).toHaveBeenCalledTimes(2);
  });

  it('pause preserves state, resume continues', () => {
    const onFire = vi.fn();
    const { result } = renderHook(() => useTimelinePlayer(cuePoints, onFire));
    act(() => result.current.play());
    advanceTime(3000); // 3s
    act(() => result.current.pause());
    expect(result.current.state).toBe('paused');
    // Resume — advance past cp2
    act(() => result.current.play());
    advanceTime(8000); // total ~8s
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/unit/useTimelinePlayer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement useTimelinePlayer hook**

Create `src/hooks/useTimelinePlayer.ts`:

```ts
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

    // Check cue points
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
    const now = performance.now();
    pausedElapsedRef.current += (now - startTimeRef.current) / 1000;
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

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return { state, elapsedSeconds, firedIds, play, pause, stop };
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- tests/unit/useTimelinePlayer.test.ts`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTimelinePlayer.ts tests/unit/useTimelinePlayer.test.ts
git commit -m "feat: useTimelinePlayer hook with rAF timer and cue firing"
```

---

### Task 3: Add i18n strings

**Files:**
- Modify: `messages/de.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add cue point translation keys**

In both message files, add to the `"playlists"` namespace:

**en.json:**
```json
"cuePoints": "Cue Points",
"addCuePoint": "+ Cue Point",
"presetSwitch": "Preset Switch",
"effectToggle": "Effect Toggle",
"timeLabel": "Time",
"actionLabel": "Action",
"targetLabel": "Target",
"timelinePlay": "Play",
"timelinePause": "Pause",
"timelineStop": "Stop",
"on": "ON",
"off": "OFF",
"elapsed": "Elapsed"
```

**de.json:**
```json
"cuePoints": "Cue Points",
"addCuePoint": "+ Cue Point",
"presetSwitch": "Preset wechseln",
"effectToggle": "Effekt schalten",
"timeLabel": "Zeit",
"actionLabel": "Aktion",
"targetLabel": "Ziel",
"timelinePlay": "Start",
"timelinePause": "Pause",
"timelineStop": "Stop",
"on": "AN",
"off": "AUS",
"elapsed": "Vergangen"
```

- [ ] **Step 2: Commit**

```bash
git add messages/de.json messages/en.json
git commit -m "feat: i18n strings for cue points"
```

---

### Task 4: Build CuePointTable UI component

**Files:**
- Create: `src/components/CuePointTable.tsx`

This is a pure presentational component — all state management happens in PlaylistPlayer.

- [ ] **Step 1: Create CuePointTable component**

Create `src/components/CuePointTable.tsx`:

The component receives:
- `cuePoints: CuePoint[]` — the list to display
- `onAdd: () => void` — add new cue point
- `onUpdate: (id: string, patch: Partial<CuePoint>) => void` — edit a cue point field
- `onDelete: (id: string) => void` — remove a cue point
- `elapsedSeconds: number` — current playback position (for highlighting)
- `firedIds: Set<string>` — which cue points have already fired
- `isPlaying: boolean` — whether timeline is running

Table rows:
- **Zeit**: `<input>` MM:SS format, parse to seconds on blur
- **Aktion**: `<select>` with "Preset Switch" / "Effect Toggle"
- **Ziel**: conditional on action type:
  - Preset Switch: text input for slot label (e.g. "1-B")
  - Effect Toggle: select for block (PRE..VOL) + ON/OFF toggle
- **Delete**: button with "x"

Styling: `font-mono-display`, amber highlight for next-to-fire cue, dimmed opacity for fired cues.

Helper functions in the component:
- `formatTime(seconds: number): string` → "M:SS"
- `parseTime(str: string): number` → seconds (handles "1:30", "90", "0:05")

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CuePointTable.tsx
git commit -m "feat: CuePointTable component for timeline editing"
```

---

### Task 5: Integrate into PlaylistPlayer

**Files:**
- Modify: `src/app/[locale]/playlists/PlaylistPlayer.tsx`
- Modify: `src/lib/playlistDb.ts` (add helper for updating entry cue points)

- [ ] **Step 1: Add cue point CRUD helpers**

In `PlaylistPlayer.tsx`, add state and handlers for cue points of the current entry:
- `cuePoints` derived from `currentEntry?.cuePoints ?? []`
- `handleAddCuePoint()` — generates new CuePoint with `crypto.randomUUID()`, time=0, action='preset-switch', slot=0
- `handleUpdateCuePoint(id, patch)` — updates a single cue point's fields
- `handleDeleteCuePoint(id)` — removes by id
- All three persist to IndexedDB via `updatePlaylist()`

- [ ] **Step 2: Wire useTimelinePlayer**

In `PlaylistPlayer.tsx`:
- Import `useTimelinePlayer` and `CuePointTable`
- Create `onCueFire` callback that calls `midiDevice.sendSlotChange(slot)` or `midiDevice.sendToggle(blockIndex, enabled)` based on cue point action
- Initialize `useTimelinePlayer(cuePoints, onCueFire)`

- [ ] **Step 3: Add CuePointTable and playback controls to the render**

After the preset chips section and before the song list, add:
- Play/Pause/Stop buttons row
- Timer display: `elapsed / last cue time`
- `<CuePointTable>` with all props wired

- [ ] **Step 4: Run full build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/playlists/PlaylistPlayer.tsx
git commit -m "feat: cue point table and timeline playback in PlaylistPlayer"
```

---

### Task 6: End-to-end test and polish

**Files:**
- Modify: `tests/unit/useTimelinePlayer.test.ts` (edge cases)

- [ ] **Step 1: Add edge case tests**

Add tests for:
- Empty cue points array → play/stop works without errors
- Cue points not sorted → still fires in correct time order
- Stop during playback → all state resets

- [ ] **Step 2: Run full test suite**

Run: `npm run test`
Expected: All tests pass (current 263 + new ~10).

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "test: edge cases for useTimelinePlayer"
```
