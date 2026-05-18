# FX-Loop SEND/RETURN — Design Spec

**Date:** 2026-05-18
**Status:** Approved, ready for implementation plan
**Sources:** USB MIDI captures `scripts/gp200-capture-20260518-075745.pcap` (10 moves) and `scripts/gp200-capture-20260518-075856.pcap` (18 moves — SEND last→first, then RETURN last→first), analyzed via `scripts/analyze-sendreturn.py`.

## Goal

Allow users to view and move the FX-Loop SEND and RETURN insertion points in the GP-200 signal chain — analogous to the official Valeton GP-200 Editor. Cover the full path: read from `.prst`, decode from device SysEx, edit in the UI, send live to the device on change, encode back to `.prst`.

## Protocol Findings

### sub=0x20 message (78 bytes, nibble-encoded 32-byte payload)

When the official editor moves SEND or RETURN, it sends a sub=0x20 SysEx message with the same format used for full reorder (`buildReorderEffects`). The interpretation of three previously-assumed "constants" turns out to be variable:

| Decoded offset | Previous interpretation | Correct interpretation |
|----------------|------------------------|------------------------|
| `[14]` | constant `0x04` | **SEND position** (1–10) |
| `[15]` | constant `0x04` | **RETURN position** (1–10) |
| `[27]` | terminator `0x44` | **Modified-flag**: `0x08`=SEND moved, `0xBA`=RETURN moved, `0x44`=routing reorder |

Additional differences observed in official-editor messages (vs. our existing `buildReorderEffects` which sends zeros):

| Decoded offset | Our codec | Official editor (SEND/RETURN moves) |
|----------------|-----------|-------------------------------------|
| `[6]` | `0x00` | `0x51` |
| `[12]` | `0x00` | `0x51` |

The routing array `[16:26]` stays unchanged during pure SEND/RETURN moves — only `[14]`, `[15]`, `[27]` differ between consecutive messages.

### Data-format mapping for SEND/RETURN

Same logical fields appear at three different physical offsets across the formats:

| Format | SEND offset | RETURN offset |
|--------|-------------|---------------|
| `.prst` file (1224 B) | `0xB2` (178 dec) | `0xB3` (179 dec) |
| SysEx Read decoded (1176 B) | `[106]` | `[107]` |
| SysEx Write decoded (876 B in our codec) | `[114]` | `[115]` |

### Valid range

Captures only show values `1`–`10`. Position 1 = "between PRE (block 0) and WAH (block 1)". Position 10 = "between RVB (block 9) and VOL (block 10)". We clamp to 1–10. Whether the device accepts `0` (before PRE) or `11` (after VOL) is unverified and out of scope.

### Constraint observed

All captures satisfy `SEND ≤ RETURN`, including the degenerate case `SEND == RETURN` (FX loop in bypass). UI enforces this constraint by pushing the other arrow when one collides with it.

## Architecture

### 1. Data model — `src/core/types.ts`

```ts
export const GP200PresetSchema = z.object({
  // ... existing fields ...
  fxLoopSend: z.number().int().min(1).max(10).default(4),
  fxLoopReturn: z.number().int().min(1).max(10).default(4),
});
```

Defaults match the historical hardcoded `0x04, 0x04` so presets that never had FX-loop metadata fall back cleanly. Constraint `fxLoopSend ≤ fxLoopReturn` is enforced at mutation points (`usePreset` actions), not in the schema, since cross-field constraints in Zod are clumsy and we want the schema to accept device-reported state verbatim.

### 2. `.prst` decode/encode — `src/core/PRSTDecoder.ts`, `src/core/PRSTEncoder.ts`

- Add constants `OFFSET_FX_SEND = 0xB2` and `OFFSET_FX_RETURN = 0xB3`.
- Decoder: read both bytes into the resulting `GP200Preset`. Clamp to `[1, 10]`; if out of range or zero, fall back to default 4.
- Encoder: write both bytes from the preset (replaces hardcoded values).
- Checksum: unchanged — `sum(bytes[0:0x4C6]) & 0xFFFF` automatically picks up the new bytes.

### 3. SysEx — `src/core/SysExCodec.ts`

**`parsePresetFromDecoded`** (consumed by both `parseReadChunks` and `parseStateDump`):
- Read `decoded[106]` → `fxLoopSend`, `decoded[107]` → `fxLoopReturn`. Clamp identically to the .prst decoder.

**`buildWriteChunks`**:
- Replace `payload.set([0x04, 0x04], 114)` with `payload[114] = preset.fxLoopSend; payload[115] = preset.fxLoopReturn;`.

**`buildReorderEffects(order: number[], send: number, ret: number)`** — signature extension:
- Existing callers pass current `send`/`ret` from preset state.
- Sets `decoded[14] = send`, `decoded[15] = ret`.
- `decoded[27]` stays at `0x44` (routing-reorder flag), `decoded[6]`/`[12]` stay at `0x00` — this path is hardware-verified, no need to change.

**`buildFxLoopMove(order: number[], send: number, ret: number, which: 'send' | 'return')`** — new function:
- 78-byte SysEx, identical envelope to reorder.
- `decoded[6] = 0x51`, `decoded[12] = 0x51` (match official editor).
- `decoded[8] = 0x08` (reorder msg type, same as reorder).
- `decoded[10] = 0x10`.
- `decoded[14] = send`, `decoded[15] = ret`.
- `decoded[16:27] = order` (11 block indices, current routing).
- `decoded[27] = which === 'send' ? 0x08 : 0xBA`.

### 4. React state — `src/hooks/usePreset.ts`

Two new actions:

```ts
setFxLoopSend(pos: number): void  // clamps to [1, 10], pushes RETURN if pos > current return
setFxLoopReturn(pos: number): void  // clamps to [1, 10], pushes SEND if pos < current send
```

The push behavior keeps the invariant `send ≤ return` and matches the user's mental model of dragging one arrow past the other.

Action result includes which value(s) actually changed (so `useMidiSend` can fire 1 or 2 SysEx messages).

### 5. Live MIDI — `src/hooks/useMidiSend.ts`

Watch `preset.fxLoopSend` and `preset.fxLoopReturn` for changes. On change:

- If only SEND changed → send `buildFxLoopMove(routing, send, ret, 'send')`.
- If only RETURN changed → send `buildFxLoopMove(routing, send, ret, 'return')`.
- If both changed (push-case) → send two messages: first the user-initiated change, then the pushed one. Order: whichever the user touched first carries its own flag; the pushed one follows with its own flag. (Implementation detail: the `usePreset` action returns `{ changed: 'send' | 'return' | 'both', userInitiated: 'send' | 'return' }`.)

Operations remain serialized via the existing `pauseNameLoading()` pattern when needed.

### 6. UI — `src/components/FxLoopArrows.tsx` (new) + `editor/page.tsx`

Visual layout overlaying the existing 11-slot effect row:

```
[PRE] gap1 [WAH] gap2 [BOOST] gap3 [AMP] ... gap10 [VOL]
       ↗               ↘
      SEND           RETURN  (example: send=1, return=3)
```

- 10 gap positions between adjacent slots. Each gap is a drop target.
- Two draggable icons (SEND ↗ amber, RETURN ↘ amber). Pure CSS arrows or Lucide icons — pick whichever matches the existing component style.
- When `send === return`: both icons stacked in the same gap, opacity reduced to ~50% with a `bypass` aria-label and tooltip ("FX-Loop inaktiv").
- Drag & Drop: HTML5 native (matches the existing `EffectSlot` drag implementation — re-use the same handlers if possible).
- Keyboard: each icon `tabindex=0`, `ArrowLeft`/`ArrowRight` shifts position by 1 within `[1, 10]`, respects the push constraint.
- ARIA: `role="slider"`, `aria-valuemin=1`, `aria-valuemax=10`, `aria-valuenow={pos}`, `aria-label` from i18n.

i18n keys added to `messages/{de,en,es,fr,it,pt}.json` under `editor.fxLoop`:
- `send`, `return`, `bypass`, `ariaSend`, `ariaReturn`, `positionLabel`

### 7. Tests

**SysExCodec (`tests/unit/SysExCodec.test.ts`)**
- `buildFxLoopMove` with `which='send'`, `send=5`, `ret=5`, default routing → byte-for-byte equal to capture `075745.pcap` packet 43 (first move in capture 1).
- `buildFxLoopMove` with `which='return'`, `send=1`, `ret=9`, default routing → matches capture `075856.pcap` packet 79 (after RETURN moved from 10 to 9).
- `parsePresetFromDecoded` with synthetic decoded bytes `[106]=7, [107]=8` → returns `fxLoopSend=7, fxLoopReturn=8`.
- `buildReorderEffects(order, send, ret)` regression: still produces hardware-verified bytes for known existing test cases, with `send`/`ret` correctly placed.

**PRST codec (`tests/unit/PRSTDecoder.test.ts`, `PRSTEncoder.test.ts`)**
- Decode test fixture with known SEND/RETURN values → correct extraction.
- Encode preset with `fxLoopSend=3, fxLoopReturn=7` → bytes at 0xB2/0xB3 are `0x03, 0x07`, checksum still valid.
- Round-trip: decode → encode → decode preserves SEND/RETURN.

**`usePreset` (`tests/unit/usePreset.test.ts`)**
- Initial state: SEND and RETURN reflect loaded preset.
- `setFxLoopSend(8)` when current state is `(send=2, ret=5)` → state becomes `(send=8, ret=8)` (RETURN pushed).
- `setFxLoopReturn(2)` when current state is `(send=5, ret=8)` → state becomes `(send=2, ret=2)` (SEND pushed).
- `setFxLoopSend(15)` when current state is `(send=2, ret=5)` → clamped, state becomes `(send=10, ret=10)` (clamp + push).
- Action result reports `{ userInitiated, pushed }` correctly.

**`FxLoopArrows` (`tests/unit/FxLoopArrows.test.tsx`)**
- Renders 2 arrow icons at correct gap positions.
- `send === return` → both icons in same gap, opacity class applied.
- Keyboard: focus SEND arrow, press ArrowRight → `setFxLoopSend` called with `pos+1`.
- ARIA attributes correct.

**Live MIDI**
- Existing `useMidiSend.test.ts` (if exists) or a new test verifies that mutating SEND emits one SysEx of type `buildFxLoopMove('send')`, mutating RETURN emits `('return')`, and the push-case emits two messages in the expected order.

### 8. Migration / Backward-Compat

- No DB schema change (presets are stored as binary `.prst` in S3; the bytes are already there).
- No migration script needed — existing `.prst` files already have SEND/RETURN at 0xB2/0xB3 (written by GP-200 firmware on save). We just start reading them.
- Test fixtures (`prst/63-B American Idiot.prst`, `prst/63-C claude1.prst`, etc.): we read their actual SEND/RETURN values during test updates and assert against them.
- UI: when loading a preset that doesn't decode SEND/RETURN cleanly (out of range), the decoder defaults to 4/4 — no broken rendering.

### 9. Out of scope / Follow-ups

- Position 0 (before PRE) and position 11 (after VOL): unverified, not implemented. Future capture follow-up.
- `decoded[6]=0x51, decoded[12]=0x51` in pure-reorder messages: existing `buildReorderEffects` keeps `0x00` since hardware-verified. We only set `0x51` in the new `buildFxLoopMove`.
- Visual customization (different colors per arrow, animated insertion preview): YAGNI.
- FX-loop level/mix parameter (the "wet" amount): no evidence it exists as a separate preset parameter; deferred until proven.

## Decisions resolved

| Question | Decision |
|----------|----------|
| UX interaction | Drag-handles between slots (matches official editor) |
| Scope | Full: decode + encode + live MIDI + UI |
| Constraint | `SEND ≤ RETURN` enforced via push |
| Bypass display | Arrows always visible; `SEND==RETURN` shown stacked + dimmed |
| Position range | 1–10 (clamped) |
| `decoded[6]/[12]` for reorder | Keep `0x00` (hardware-verified); only set `0x51` for FX-loop moves |
