# Playlist Cue Points (Timeline) — Design Spec

## Summary

Extend playlist items with timed cue points that trigger MIDI actions (preset switch, effect toggle) during playback. Enables automated preset changes synced to song sections — "at 18s switch to 1-B, at 28s toggle delay on."

## Scope

- v1: Timestamp-based cue points with table UI
- v2 (future): Visual timeline, audio/video sync
- YouTube embed: already exists, remains optional

## Data Model

```ts
interface CuePoint {
  id: string;           // nanoid
  timeSeconds: number;  // trigger time in seconds
  action: 'preset-switch' | 'effect-toggle';
  slot?: number;        // preset-switch: GP-200 slot 0-255
  blockIndex?: number;  // effect-toggle: 0-10 (PRE..VOL)
  enabled?: boolean;    // effect-toggle: on/off
}
```

**Storage:** Added as `cuePoints: CuePoint[]` field on existing `PlaylistItem` in IndexedDB (`playlistDb.ts`). No Prisma/Postgres changes — playlists are client-side only.

## Playback Engine

New hook: `useTimelinePlayer(cuePoints, midiDevice)`

- Starts a `requestAnimationFrame` loop when user presses Play
- Tracks elapsed seconds from start
- On each frame: checks if any unfired cue point's `timeSeconds <= elapsed`
- Fires action via existing MIDI methods:
  - `preset-switch` → `midiDevice.sendSlotChange(slot)`
  - `effect-toggle` → `midiDevice.sendToggle(blockIndex, enabled)`
- Maintains a `Set<string>` of fired cue point IDs (prevents double-fire)
- Pause: stops rAF loop, preserves elapsed time + fired set
- Stop/Reset: clears elapsed time + fired set

**Edge cases:**
- No MIDI device connected → cue points still fire visually (highlight in table) but skip MIDI send
- Cue points at t=0 fire immediately on play

## UI

### Location

Inside `PlaylistPlayer.tsx`, below the current song info. Only visible when a song is selected.

### Cue Point Table

| Zeit | Aktion | Ziel | |
|------|--------|------|-|
| 0:00 | Preset Switch | 1-A | x |
| 0:18 | Preset Switch | 1-B | x |
| 0:28 | Effect Toggle | DLY AN | x |
| 0:44 | Preset Switch | 1-A | x |

- **Zeit**: Editable input (MM:SS format, stored as seconds)
- **Aktion**: Dropdown — "Preset Switch" / "Effect Toggle"
- **Ziel**:
  - Preset Switch: slot label input (e.g. "1-B") using `SysExCodec.labelToSlot()`
  - Effect Toggle: module dropdown (PRE/WAH/DST/AMP/NR/CAB/EQ/MOD/DLY/RVB/VOL) + on/off toggle
- **x**: Delete button
- **"+ Cue Point"** button below table → adds new row with defaults

### Playback State

- Timer display: `0:00 / 3:45` (elapsed / last cue point time)
- Play/Pause/Stop buttons
- During playback:
  - Current/next cue point highlighted in amber
  - Fired cue points dimmed (opacity)
  - Active row scrolls into view

### Styling

Follows existing dark pedalboard theme. Table uses `font-mono-display`, amber accents for active states.

## i18n

New keys in `editor` or `playlists` namespace:
- `cuePoints`, `addCuePoint`, `presetSwitch`, `effectToggle`
- `timeLabel`, `actionLabel`, `targetLabel`
- `play`, `pause`, `stop` (may already exist)

## Files Changed

| File | Change |
|------|--------|
| `src/lib/playlistDb.ts` | Add `cuePoints` to PlaylistItem type |
| `src/hooks/useTimelinePlayer.ts` | New hook — timer + cue firing logic |
| `src/app/[locale]/playlists/PlaylistPlayer.tsx` | Add cue point table + playback controls |
| `messages/de.json`, `messages/en.json` | New i18n keys |
| `tests/unit/useTimelinePlayer.test.ts` | New — timer logic, firing, reset |
| `tests/unit/playlistDb.test.ts` | Update — cue point CRUD |

## Dependencies

- Existing: `useMidiDeviceContext()` for `sendSlotChange`, `sendToggle`
- Existing: `SysExCodec.slotToLabel()` / `labelToSlot()` for slot display
- Existing: `playlistDb.ts` IndexedDB operations

## Out of Scope

- Visual timeline (drag markers on a bar) — v2
- Audio/video sync (YouTube playback triggering cue points) — v2
- Parameter changes (only preset-switch and effect-toggle in v1)
- Server-side storage of cue points (stays client-side in IndexedDB)
