# CTRL/EXP Controller Assignments — Design Spec

**Date:** 2026-03-23
**Status:** Ready

## Goal

Display and edit CTRL 1-8, EXP 1/2, and Quick Access 1-3 assignments in the Editor UI. Assignments map physical controllers (foot switches, expression pedals, knobs) to effect parameters with min/max ranges.

## Constraints

- Only available when device is connected (assignments are device state, not stored in .prst)
- Read protocol already implemented (handshake Step 9, sub=0x1C)
- Write protocol (sub=0x14, 54 bytes) needs capture analysis to finalize
- Must follow existing pedalboard dark theme (amber accents, JetBrains Mono, LED-style)

## Architecture

### Data Model

Each assignment entry:

```typescript
interface ControllerAssignment {
  controller: string;        // "CTRL 1", "EXP 1", "QA 1", etc.
  section: number;           // 0 or 1
  page: number;              // 0 or 1
  block: number;             // index within page
  targetBlock: number | null; // effect block 0-10 (null = unassigned)
  paramIndex: number | null;  // parameter index within effect
  min: number;               // range minimum
  max: number;               // range maximum
  deviceName: string;        // raw name from device (read-only)
  rawData: Uint8Array;       // full decoded response for debugging
}
```

### Controller Mapping (Section/Page/Block → Physical Controller)

| Controller | Section | Page | Block(s) | Count |
|---|---|---|---|---|
| CTRL 1-8 | 0 | 0 | 0-15 | 16 (2 per CTRL?) |
| Quick Access 1-3 | 0 | 1 | 0-3 | 4 |
| EXP 1-2 | 1 | 0 | 0-9 | 10 (5 per EXP?) |

**Note:** Exact mapping TBD from capture analysis. Block counts suggest multi-entry per controller (e.g., CTRL can control 2 params simultaneously, EXP has 5 slots).

### SysEx Protocol

#### READ (existing)

- Request: CMD=0x11, sub=0x1C, 70 bytes (raw)
- Response: CMD=0x12, sub=0x1C, variable length (nibble-encoded payload)
- Already implemented in `SysExCodec.buildAssignmentQuery()` / `parseAssignmentResponse()`

#### Response rawData Decoding (TBD — pending capture analysis)

Current parsing extracts only a name string. Full decoding needed:

```
decoded[?]    Target effect block (0-10)
decoded[?]    Parameter index (0-14)
decoded[?:?]  Min value (float32 or uint8?)
decoded[?:?]  Max value (float32 or uint8?)
decoded[?]    Assigned flag (0 = empty?)
```

#### WRITE (to implement)

CMD=0x12, sub=0x14, 54 bytes (raw, not nibble-encoded). Same sub as Effect-Change.

**Decoded from capture 103852 (8 messages, Valeton software):**

```
[0-7]    F0 21 25 7E 47 50 2D 32   SysEx header
[8-9]    12 14                       CMD=SET, SUB=assignment
[10-17]  00 00 00 00 00 00 00 00    padding
[18]     04                          constant
[19-29]  00 00 00 00 00 00 00 00 00 00 0F  constant
[30-37]  00 00 00 08 00 00 00       constant
[38]     SECTION                     0x00=CTRL/QA, 0x01=EXP
[39-40]  00 00                       padding
[41-43]  05 0C 05                    constant (nibble: 0x5C 0x5?)
[44]     03                          constant
[45]     VALUE_A                     Section 0: controller param (00,02,04,0C)
[46]     PAGE_TYPE                   0x04=Section 0, 0x08=Section 1
[47]     00                          padding
[48]     VALUE_B                     Section 1: controller param (08,0C,0E)
[49-52]  0D 0C 00 03                constant trailer
[53]     F7                          end
```

**Capture examples:**
- Section 0 (CTRL): byte[38]=0x00, byte[45] varies (00→02→00→04→0C), byte[46]=0x04
- Section 1 (EXP): byte[38]=0x01, byte[48] varies (08→0C→0E), byte[46]=0x08

**Note:** Only 8 captured messages — more capture analysis needed to map byte[45]/[48] values to specific controller slots and parameters. Values may represent the controller index, not parameter assignments. Full reverse engineering requires hardware testing.

### UI Component

#### `ControllerPanel.tsx`

Collapsible panel below the 11 effect slots. Only rendered when `midiDevice.status === 'connected'`.

**Layout:**
```
[v] Controllers                              [Collapse toggle]
┌─────────────────────────────────────────────────────────────┐
│ CTRL 1-8                                                    │
│ ┌─────────┬──────────┬───────────┬─────┬─────┬───────────┐ │
│ │ Name    │ Block    │ Parameter │ Min │ Max │ Device    │ │
│ ├─────────┼──────────┼───────────┼─────┼─────┼───────────┤ │
│ │ CTRL 1  │ [DST  v] │ [Gain  v] │  0  │ 100 │ Green OD  │ │
│ │ CTRL 2  │ [—    v] │ [—     v] │  —  │  —  │ (none)    │ │
│ │ ...     │          │           │     │     │           │ │
│ └─────────┴──────────┴───────────┴─────┴─────┴───────────┘ │
│                                                             │
│ EXP 1-2                                                     │
│ ┌─────────┬──────────┬───────────┬─────┬─────┬───────────┐ │
│ │ EXP 1   │ [WAH  v] │ [Pos   v] │  0  │ 100 │ V-Wah     │ │
│ │ EXP 2   │ [VOL  v] │ [Level v] │  0  │ 100 │ Volume    │ │
│ └─────────┴──────────┴───────────┴─────┴─────┴───────────┘ │
│                                                             │
│ Quick Access 1-3                                            │
│ ┌─────────┬──────────┬───────────┬─────┬─────┬───────────┐ │
│ │ QA 1    │ [AMP  v] │ [Gain  v] │  0  │ 100 │ Mess4 LD  │ │
│ │ ...     │          │           │     │     │           │ │
│ └─────────┴──────────┴───────────┴─────┴─────┴───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Block dropdown: PRE/WAH/BOOST/AMP/NR/CAB/EQ/MOD/DLY/RVB/VOL/None
- Parameter dropdown: populated from `effectParams.ts` based on selected block's current effect
- Min/Max: number inputs (range depends on parameter type)
- Changes send sub=0x14 SysEx immediately (live editing, same as other controls)
- "Device" column: read-only, shows name from device response

### Integration Points

**Editor page (`editor/page.tsx`):**
- Import `ControllerPanel`
- Pass `midiDevice.assignments` + send function
- Render below effect slots, above Footer

**useMidiDevice.ts:**
- Add `sendAssignmentChange(section, page, block, targetBlock, paramIndex, min, max)`
- Builds sub=0x14 message via `SysExCodec.buildAssignmentWrite()`

**SysExCodec.ts:**
- Add `buildAssignmentWrite()` — 54-byte raw SysEx
- Improve `parseAssignmentResponse()` — decode block/param/min/max from rawData

**effectParams.ts / effectNames.ts:**
- Already have parameter definitions per effect — used for Parameter dropdown population

### Translations

New namespace `controllers` in `messages/de.json` / `messages/en.json`:

```json
{
  "controllers": {
    "title": "Controllers",
    "ctrl": "CTRL {n}",
    "exp": "EXP {n}",
    "qa": "Quick Access {n}",
    "block": "Block",
    "parameter": "Parameter",
    "min": "Min",
    "max": "Max",
    "device": "Device",
    "none": "(none)",
    "unassigned": "Not assigned"
  }
}
```

## Files to Create/Modify

| File | Action |
|---|---|
| `src/components/ControllerPanel.tsx` | **Create** — collapsible assignment table |
| `src/core/SysExCodec.ts` | Modify — add `buildAssignmentWrite()`, improve `parseAssignmentResponse()` |
| `src/hooks/useMidiDevice.ts` | Modify — add `sendAssignmentChange()`, expose in return |
| `src/app/[locale]/editor/page.tsx` | Modify — render ControllerPanel |
| `messages/de.json` | Modify — add `controllers` namespace |
| `messages/en.json` | Modify — add `controllers` namespace |
| `tests/unit/SysExCodec.test.ts` | Modify — add assignment write/decode tests |

## Implementation Strategy

**Phase 1 (this PR):** Read-only display + basic write support
1. Decode rawData from existing assignment responses (name + available fields)
2. Build ControllerPanel UI showing current assignments from device
3. Wire up basic write for known byte positions
4. Hardware-verify with device

**Phase 2 (follow-up):** Full editing
1. Complete write protocol via more capture analysis / hardware trial-and-error
2. Add Block/Parameter dropdowns with effectParams integration
3. Add Min/Max editing

## Open Items

- [ ] Confirm rawData byte positions for block/param/min/max (currently only name extracted)
- [ ] Map byte[45] values to specific CTRL slots (need more captures or hardware testing)
- [ ] Map byte[48] values to specific EXP slots
- [ ] Determine if CTRL entries are paired (2 slots per CTRL for dual assignment)
