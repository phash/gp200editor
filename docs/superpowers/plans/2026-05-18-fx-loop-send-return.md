# FX-Loop SEND/RETURN Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface and edit the GP-200 FX-Loop SEND/RETURN insertion points throughout the app: read from `.prst`, decode from SysEx, edit in the UI with drag-and-drop arrows between effect slots, push live to the device, encode back to `.prst`.

**Architecture:** Bottom-up — extend the data schema first, then the codecs (PRSTDecoder/Encoder + SysExCodec), then React state + live MIDI hooks, then a new `FxLoopArrows` overlay component integrated into the editor page. Each task is TDD: failing test → minimal implementation → commit.

**Tech Stack:** TypeScript strict, Zod 4, Vitest, React 19, next-intl (6 locales: de/en/es/fr/it/pt), Tailwind. Web MIDI via `useMidiDevice` / `useMidiSend`.

**Spec:** `docs/superpowers/specs/2026-05-18-fx-loop-send-return-design.md`

---

## Conventions

- All shell commands use PowerShell syntax (project on Windows).
- Test runner: `npx vitest run <path> -t "<test name>"` for single-test iteration; `npm run test` for full suite.
- Commit messages follow existing project style: `feat:`, `test:`, `refactor:` prefixes; `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- Decoded payload offsets are zero-based and refer to the **nibble-decoded** byte stream.

---

## Task 1: Add `fxLoopSend` / `fxLoopReturn` to the Zod schema

**Files:**
- Modify: `src/core/types.ts`
- Test: `tests/unit/types.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/types.test.ts` (find the existing `describe('GP200PresetSchema', ...)` block and add inside it):

```ts
  it('defaults fxLoopSend and fxLoopReturn to 4 when omitted', () => {
    const parsed = GP200PresetSchema.parse({
      version: '1',
      patchName: 'X',
      effects: Array.from({ length: 11 }, (_, i) => ({
        slotIndex: i, effectId: 0, enabled: false, params: Array(15).fill(0),
      })),
      checksum: 0,
    });
    expect(parsed.fxLoopSend).toBe(4);
    expect(parsed.fxLoopReturn).toBe(4);
  });

  it('accepts custom fxLoopSend/Return in range 1..10', () => {
    const parsed = GP200PresetSchema.parse({
      version: '1',
      patchName: 'X',
      effects: Array.from({ length: 11 }, (_, i) => ({
        slotIndex: i, effectId: 0, enabled: false, params: Array(15).fill(0),
      })),
      checksum: 0,
      fxLoopSend: 1,
      fxLoopReturn: 10,
    });
    expect(parsed.fxLoopSend).toBe(1);
    expect(parsed.fxLoopReturn).toBe(10);
  });

  it('rejects fxLoopSend < 1 or > 10', () => {
    const base = {
      version: '1', patchName: 'X',
      effects: Array.from({ length: 11 }, (_, i) => ({
        slotIndex: i, effectId: 0, enabled: false, params: Array(15).fill(0),
      })),
      checksum: 0,
    };
    expect(() => GP200PresetSchema.parse({ ...base, fxLoopSend: 0 })).toThrow();
    expect(() => GP200PresetSchema.parse({ ...base, fxLoopSend: 11 })).toThrow();
    expect(() => GP200PresetSchema.parse({ ...base, fxLoopReturn: 0 })).toThrow();
    expect(() => GP200PresetSchema.parse({ ...base, fxLoopReturn: 11 })).toThrow();
  });
```

- [ ] **Step 2: Run to verify failure**

```
npx vitest run tests/unit/types.test.ts -t "fxLoop"
```

Expected: 3 FAILs ("Unrecognized key 'fxLoopSend'" or similar).

- [ ] **Step 3: Add fields to schema**

Modify `src/core/types.ts`. Add two new fields to `GP200PresetSchema` immediately after `checksum`:

```ts
export const GP200PresetSchema = z.object({
  version: z.string(),
  patchName: z.string().max(16),
  author: z.string().max(16).optional(),
  effects: z.array(EffectSlotSchema).length(11),
  checksum: z.number().int().min(0).max(65535),
  /** FX-loop SEND insertion point. 1 = between PRE(0) and WAH(1). Range 1..10. */
  fxLoopSend: z.number().int().min(1).max(10).default(4),
  /** FX-loop RETURN insertion point. 1..10. Invariant SEND <= RETURN enforced at mutation points, not in the schema. */
  fxLoopReturn: z.number().int().min(1).max(10).default(4),
  rawSource: z.instanceof(Uint8Array).optional(),
});
```

- [ ] **Step 4: Run to verify pass**

```
npx vitest run tests/unit/types.test.ts -t "fxLoop"
```

Expected: 3 PASS.

- [ ] **Step 5: Full type-check to confirm no downstream breakage**

```
npm run lint
```

Expected: no new TypeScript errors. Other places that build `GP200Preset` objects will still type-check because the new fields have `.default()`.

- [ ] **Step 6: Commit**

```
git add src/core/types.ts tests/unit/types.test.ts
git commit -m "feat(types): add fxLoopSend/fxLoopReturn to GP200PresetSchema

Range 1..10 with default 4 (matches existing hardcoded constants
in encoder/SysExCodec). Schema-level constraint is range only;
SEND <= RETURN invariant is enforced at mutation points.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: PRSTDecoder reads SEND/RETURN from `.prst` bytes 0xB2/0xB3

**Files:**
- Modify: `src/core/PRSTDecoder.ts`
- Test: `tests/unit/PRSTDecoder.test.ts`

Bytes 0xB2 and 0xB3 sit inside the routing section header (0x8C..0x9F → wait: routing extras at 0xB2 is actually outside that range — see below).

Actual file mapping: routing section is 0x8C..0x9F, then effect blocks start at 0xA0. SEND/RETURN at 0xB2/0xB3 fall **inside the first effect block (slot 0, base=0xA0, size=0x48 → 0xA0..0xE7)**. That would corrupt block 0.

Verify the offset first before adding code:

- [ ] **Step 1: Confirm SEND/RETURN file-byte position from a real .prst**

Run this throwaway check (PowerShell):

```
node -e "const fs=require('fs');const b=fs.readFileSync('prst/63-B American Idiot.prst');console.log('byte 0xB2:', b[0xB2].toString(16), 'byte 0xB3:', b[0xB3].toString(16));console.log('byte 0x96:', b[0x96].toString(16), 'byte 0x97:', b[0x97].toString(16));"
```

The spec maps SysEx Read decoded `[106]` to .prst offset `0x44 + ... `. Re-derive from the protocol doc section 11.5:

| Component | .prst offset | SysEx Read decoded |
|-----------|-------------|---------------------|
| Routing section | 140 (0x8C) | 100 |

So decoded `[106]` = .prst `[140 + (106-100)] = [146]` = **0x92**, **not 0xB2**.

The spec contains a copy-paste arithmetic error (`146 dec` was right; `0xB2` was wrong because 146 in hex is 0x92, not 0xB2). All downstream uses of 0xB2/0xB3 in this plan are corrected to 0x92/0x93 below. Updating the spec document is part of step 5.

- [ ] **Step 2: Write the failing tests**

Append to `tests/unit/PRSTDecoder.test.ts` in the existing `describe('PRSTDecoder', ...)` block:

```ts
  it('reads fxLoopSend / fxLoopReturn from offset 0x92 / 0x93', () => {
    const buf = buildTestBuffer();
    buf[0x92] = 0x03;
    buf[0x93] = 0x07;
    const decoded = new PRSTDecoder(buf).decode();
    expect(decoded.fxLoopSend).toBe(3);
    expect(decoded.fxLoopReturn).toBe(7);
  });

  it('falls back to default 4 when fxLoop bytes are out of range', () => {
    const buf = buildTestBuffer();
    buf[0x92] = 0x00; // out of range
    buf[0x93] = 0x0F; // out of range
    const decoded = new PRSTDecoder(buf).decode();
    expect(decoded.fxLoopSend).toBe(4);
    expect(decoded.fxLoopReturn).toBe(4);
  });
```

- [ ] **Step 3: Run to verify failure**

```
npx vitest run tests/unit/PRSTDecoder.test.ts -t "fxLoop"
```

Expected: 2 FAILs (current decoder doesn't read those bytes; result has the schema-default 4, but the out-of-range test will pass coincidentally — keep both to lock in the fallback behaviour once we implement clamping).

- [ ] **Step 4: Implement in `src/core/PRSTDecoder.ts`**

Add constants near the existing offsets:

```ts
const OFFSET_FX_SEND     = 0x92;  // 1 byte: FX-loop SEND position (1..10)
const OFFSET_FX_RETURN   = 0x93;  // 1 byte: FX-loop RETURN position (1..10)
```

In `decode()`, after the existing `effects` calculation and before `checksum`:

```ts
    const rawSend = this.parser.readUint8(OFFSET_FX_SEND);
    const rawReturn = this.parser.readUint8(OFFSET_FX_RETURN);
    const fxLoopSend = rawSend >= 1 && rawSend <= 10 ? rawSend : 4;
    const fxLoopReturn = rawReturn >= 1 && rawReturn <= 10 ? rawReturn : 4;
```

Add to the final `parse()` call:

```ts
    return GP200PresetSchema.parse({
      version, patchName, author: author || undefined, effects,
      fxLoopSend, fxLoopReturn,
      checksum, rawSource,
    });
```

- [ ] **Step 5: Update spec to correct the offset**

```
# in docs/superpowers/specs/2026-05-18-fx-loop-send-return-design.md
# replace every occurrence of 0xB2 with 0x92 and 0xB3 with 0x93
```

Use Edit twice to update the two table rows that mention `0xB2`/`0xB3`.

- [ ] **Step 6: Run to verify pass**

```
npx vitest run tests/unit/PRSTDecoder.test.ts -t "fxLoop"
```

Expected: 2 PASS.

- [ ] **Step 7: Confirm no regressions in the full PRSTDecoder suite**

```
npx vitest run tests/unit/PRSTDecoder.test.ts
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```
git add src/core/PRSTDecoder.ts tests/unit/PRSTDecoder.test.ts docs/superpowers/specs/2026-05-18-fx-loop-send-return-design.md
git commit -m "feat(decoder): read fxLoopSend/Return from .prst 0x92/0x93

Bytes at 0x92 (SEND) and 0x93 (RETURN) live inside the routing
section header. Values outside 1..10 fall back to default 4.

Corrects spec offset (was 0xB2/0xB3, decimal 178/179 — should be
0x92/0x93, decimal 146/147 per protocol doc section 11.5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: PRSTEncoder writes SEND/RETURN to 0x92/0x93

**Files:**
- Modify: `src/core/PRSTEncoder.ts`
- Test: `tests/unit/PRSTEncoder.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/PRSTEncoder.test.ts` (find a suitable `describe`, e.g. the main `describe('PRSTEncoder', ...)`, and add):

```ts
  it('writes fxLoopSend/Return to bytes 0x92/0x93', () => {
    const preset: GP200Preset = {
      version: '1',
      patchName: 'X',
      effects: Array.from({ length: 11 }, (_, i) => ({
        slotIndex: i, effectId: 0, enabled: false, params: Array(15).fill(0),
      })),
      checksum: 0,
      fxLoopSend: 2,
      fxLoopReturn: 8,
    };
    const ab = new PRSTEncoder().encode(preset);
    const bytes = new Uint8Array(ab);
    expect(bytes[0x92]).toBe(2);
    expect(bytes[0x93]).toBe(8);
  });

  it('preserves fxLoopSend/Return through encode→decode round-trip', () => {
    const preset: GP200Preset = {
      version: '1',
      patchName: 'X',
      effects: Array.from({ length: 11 }, (_, i) => ({
        slotIndex: i, effectId: 0, enabled: false, params: Array(15).fill(0),
      })),
      checksum: 0,
      fxLoopSend: 5,
      fxLoopReturn: 9,
    };
    const ab = new PRSTEncoder().encode(preset);
    const decoded = new PRSTDecoder(new Uint8Array(ab)).decode();
    expect(decoded.fxLoopSend).toBe(5);
    expect(decoded.fxLoopReturn).toBe(9);
  });
```

If `PRSTDecoder` isn't imported in this file, add it: `import { PRSTDecoder } from '@/core/PRSTDecoder';`

- [ ] **Step 2: Run to verify failure**

```
npx vitest run tests/unit/PRSTEncoder.test.ts -t "fxLoop"
```

Expected: 2 FAILs. The "writes" test fails because the encoder currently writes `0x04` at `0x96`/`0x97` (offset 6/7 inside the routing header at 0x8C) — `0x92`/`0x93` stay zero. The round-trip test fails because byte `0x92` stays zero and the decoder clamps to default 4, not 5.

- [ ] **Step 3: Implement in `src/core/PRSTEncoder.ts`**

Add constants near the existing routing offsets:

```ts
const OFFSET_FX_SEND     = 0x92;
const OFFSET_FX_RETURN   = 0x93;
```

In `encode()`, replace the existing hardcoded `04 04` writes in the routing section block:

```ts
    if (!preset.rawSource) {
      gen.writeUint8(OFFSET_ROUTING, 0x08);
      gen.writeUint8(OFFSET_ROUTING + 1, 0x00);
      gen.writeUint8(OFFSET_ROUTING + 2, 0x10);
      gen.writeUint8(OFFSET_ROUTING + 3, 0x00);
      // OFFSET_ROUTING+6/+7 used to be hardcoded 0x04 0x04 (= SEND/RETURN default).
      // We now write the preset's actual SEND/RETURN at the canonical positions
      // 0x92/0x93 below — drop the duplicate hardcoded write here.
    }
```

After that block (still inside the `if (!preset.rawSource)` *or* unconditionally, since these bytes belong to the routing section and the editor owns them — write unconditionally so rawSource-based presets pick up edits):

```ts
    // FX-loop SEND/RETURN positions (1..10). Always written, regardless of
    // rawSource, because the editor owns these bytes.
    gen.writeUint8(OFFSET_FX_SEND, preset.fxLoopSend);
    gen.writeUint8(OFFSET_FX_RETURN, preset.fxLoopReturn);
```

- [ ] **Step 4: Run to verify pass**

```
npx vitest run tests/unit/PRSTEncoder.test.ts -t "fxLoop"
```

Expected: 2 PASS.

- [ ] **Step 5: Verify full encoder/decoder suites still pass**

```
npx vitest run tests/unit/PRSTEncoder.test.ts tests/unit/PRSTDecoder.test.ts
```

Expected: all PASS. If a real-file round-trip test in PRSTEncoder fails because some existing fixture had non-default SEND/RETURN, update the test expectation to reflect the actual byte values.

- [ ] **Step 6: Commit**

```
git add src/core/PRSTEncoder.ts tests/unit/PRSTEncoder.test.ts
git commit -m "feat(encoder): write fxLoopSend/Return to .prst 0x92/0x93

Replaces hardcoded 0x04 0x04 with preset values. Written
unconditionally (even for rawSource-based presets) because the
editor owns these bytes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: SysExCodec.parsePresetFromDecoded reads SEND/RETURN

**Files:**
- Modify: `src/core/SysExCodec.ts` (function `parsePresetFromDecoded`)
- Test: `tests/unit/SysExCodec.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/SysExCodec.test.ts` inside an existing `describe` that uses `buildDecodedPreset` (or add a new `describe('SysExCodec: fxLoop decode', ...)`):

```ts
describe('SysExCodec: fxLoop parse', () => {
  it('reads SEND from decoded[106] and RETURN from decoded[107]', () => {
    const buf = buildDecodedPreset('Test', 0);
    buf[106] = 0x03;
    buf[107] = 0x09;
    // Build fake chunks and parse them — reuses the existing test helper
    const chunks = buildFakeChunks(buf, 0);
    const preset = SysExCodec.parseReadChunks(chunks);
    expect(preset.fxLoopSend).toBe(3);
    expect(preset.fxLoopReturn).toBe(9);
  });

  it('clamps out-of-range fxLoop values to default 4', () => {
    const buf = buildDecodedPreset('Test', 0);
    buf[106] = 0x00; // out of range
    buf[107] = 0xFF; // out of range
    const chunks = buildFakeChunks(buf, 0);
    const preset = SysExCodec.parseReadChunks(chunks);
    expect(preset.fxLoopSend).toBe(4);
    expect(preset.fxLoopReturn).toBe(4);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
npx vitest run tests/unit/SysExCodec.test.ts -t "fxLoop parse"
```

Expected: 2 FAILs.

- [ ] **Step 3: Modify `parsePresetFromDecoded` in `src/core/SysExCodec.ts`**

Find the function near line 96. After the `author` extraction block and before the effect-block loop, add:

```ts
    const rawSend = decoded.length > 106 ? decoded[106] : 4;
    const rawReturn = decoded.length > 107 ? decoded[107] : 4;
    const fxLoopSend = rawSend >= 1 && rawSend <= 10 ? rawSend : 4;
    const fxLoopReturn = rawReturn >= 1 && rawReturn <= 10 ? rawReturn : 4;
```

Update the final `GP200PresetSchema.parse({ ... })` call to include both fields:

```ts
    return GP200PresetSchema.parse({
      version: '1', patchName, author: author || undefined, effects,
      fxLoopSend, fxLoopReturn,
      checksum: 0,
    });
```

- [ ] **Step 4: Run to verify pass**

```
npx vitest run tests/unit/SysExCodec.test.ts -t "fxLoop parse"
```

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```
git add src/core/SysExCodec.ts tests/unit/SysExCodec.test.ts
git commit -m "feat(sysex): parse fxLoopSend/Return from read response decoded[106/107]

State Dump (sub=0x4E) consumes the same path, so live-pulled
presets carry SEND/RETURN too.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: SysExCodec.buildWriteChunks writes SEND/RETURN from preset

**Files:**
- Modify: `src/core/SysExCodec.ts` (function `buildWriteChunks`)
- Test: `tests/unit/SysExCodec.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/SysExCodec.test.ts`:

```ts
describe('SysExCodec: buildWriteChunks fxLoop', () => {
  it('writes preset.fxLoopSend/Return to write-payload [114/115]', () => {
    const preset: GP200Preset = {
      version: '1',
      patchName: 'WriteTest',
      effects: Array.from({ length: 11 }, (_, i) => ({
        slotIndex: i, effectId: 0x07000055, enabled: true,
        params: Array(15).fill(0),
      })),
      checksum: 0,
      fxLoopSend: 6,
      fxLoopReturn: 7,
    };
    const chunks = SysExCodec.buildWriteChunks(preset, 5);
    // Reassemble nibble bytes from all chunks (each chunk: F0..[10..12 header]..[nibble]..F7)
    const allNibbles: number[] = [];
    for (const ch of chunks) {
      for (let i = 13; i < ch.length - 1; i++) allNibbles.push(ch[i]);
    }
    const decoded = SysExCodec.nibbleDecode(new Uint8Array(allNibbles));
    expect(decoded[114]).toBe(6);
    expect(decoded[115]).toBe(7);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
npx vitest run tests/unit/SysExCodec.test.ts -t "buildWriteChunks fxLoop"
```

Expected: FAIL — current code hardcodes `0x04, 0x04`.

- [ ] **Step 3: Modify `buildWriteChunks` in `src/core/SysExCodec.ts`**

Find the line `payload.set([0x04, 0x04], 114);` (around line 197) and replace with:

```ts
    payload[114] = preset.fxLoopSend;
    payload[115] = preset.fxLoopReturn;
```

- [ ] **Step 4: Run to verify pass**

```
npx vitest run tests/unit/SysExCodec.test.ts -t "buildWriteChunks fxLoop"
```

Expected: PASS.

- [ ] **Step 5: Re-run full SysExCodec suite**

```
npx vitest run tests/unit/SysExCodec.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```
git add src/core/SysExCodec.ts tests/unit/SysExCodec.test.ts
git commit -m "feat(sysex): write fxLoopSend/Return from preset in buildWriteChunks

Replaces hardcoded 0x04, 0x04 at write-payload [114:116].

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Extend `buildReorderEffects` signature to accept SEND/RETURN

**Files:**
- Modify: `src/core/SysExCodec.ts` (function `buildReorderEffects`)
- Modify: `src/hooks/useMidiSend.ts` (caller `sendReorder`)
- Modify: `src/app/[locale]/editor/page.tsx` (caller in `handleDrop`)
- Test: `tests/unit/SysExCodec.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('SysExCodec: buildReorderEffects with SEND/RETURN', () => {
  it('places send and ret at decoded[14] and [15]', () => {
    const order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const msg = SysExCodec.buildReorderEffects(order, 5, 9);
    // SysEx envelope: F0..[8 header bytes][12 18][..3 pad][64 nibble bytes][F7]
    const nibble = msg.slice(13, msg.length - 1);
    const decoded = SysExCodec.nibbleDecode(nibble);
    expect(decoded[14]).toBe(5);
    expect(decoded[15]).toBe(9);
    // Routing array preserved
    for (let i = 0; i < 11; i++) expect(decoded[16 + i]).toBe(order[i]);
  });

  it('keeps the existing flag byte decoded[27]=0x44 for reorder', () => {
    const msg = SysExCodec.buildReorderEffects([0,1,2,3,4,5,6,7,8,9,10], 4, 4);
    const decoded = SysExCodec.nibbleDecode(msg.slice(13, msg.length - 1));
    expect(decoded[27]).toBe(0x44);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
npx vitest run tests/unit/SysExCodec.test.ts -t "buildReorderEffects with SEND"
```

Expected: TypeScript error (wrong arity) or runtime mismatch (decoded[14]/[15] stay 0x04).

- [ ] **Step 3: Modify `buildReorderEffects` in `src/core/SysExCodec.ts`**

Replace the existing function body. The signature now requires `send` and `ret`:

```ts
  buildReorderEffects(order: number[], send: number, ret: number): Uint8Array {
    // CMD=0x12, sub=0x20, 78 bytes — nibble-encoded 32-byte payload
    // decoded[14]=SEND, decoded[15]=RETURN (1..10). decoded[27]=0x44 flags this
    // as a routing-reorder (vs FX-loop move which uses 0x08/0xBA — see buildFxLoopMove).
    const decoded = new Uint8Array(32);
    decoded[2] = 0x04;
    decoded[8] = 0x08;
    decoded[10] = 0x10;
    decoded[14] = send & 0xFF;
    decoded[15] = ret & 0xFF;
    for (let i = 0; i < 11 && i < order.length; i++) {
      decoded[16 + i] = order[i];
    }
    decoded[27] = 0x44;

    const nibbles = this.nibbleEncode(decoded);
    const msg = new Uint8Array(78);
    msg.set([0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x12, 0x20, 0x00, 0x00, 0x00]);
    msg.set(nibbles, 13);
    msg[77] = 0xF7;
    return msg;
  },
```

- [ ] **Step 4: Update caller in `src/hooks/useMidiSend.ts`**

Change the `sendReorder` signature and update the interface:

In the `UseMidiSendReturn` interface (around line 32):

```ts
  sendReorder: (order: number[], send: number, ret: number) => void;
```

In the implementation (around line 145):

```ts
  const sendReorder = useCallback((order: number[], send: number, ret: number) => {
    if (!outputRef.current) return;
    const msg = SysExCodec.buildReorderEffects(order, send, ret);
    console.log('[GP-200] reorder:', order, 'send:', send, 'ret:', ret);
    outputRef.current.send(msg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 5: Update caller in `src/app/[locale]/editor/page.tsx`**

Find the `handleDrop` callback (around line 477) and pass current SEND/RETURN values:

```ts
  const handleDrop = useCallback((toIndex: number) => {
    if (dragIndex !== null) {
      reorderEffects(dragIndex, toIndex);
      if (midiDevice.status === 'connected' && preset) {
        const order = preset.effects.map(e => e.slotIndex);
        const [moved] = order.splice(dragIndex, 1);
        order.splice(toIndex, 0, moved);
        midiDevice.sendReorder(order, preset.fxLoopSend, preset.fxLoopReturn);
      }
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, reorderEffects, midiDevice, preset]);
```

- [ ] **Step 6: Also check `useMidiDevice.ts` for any `sendReorder` re-export**

```
grep -n "sendReorder" src/hooks/useMidiDevice.ts
```

If `useMidiDevice` exposes `sendReorder` as part of its return, update its type/signature there too. Most likely it re-exports from `useMidiSend` via spread — no change needed, but verify.

- [ ] **Step 7: Run to verify pass**

```
npx vitest run tests/unit/SysExCodec.test.ts -t "buildReorderEffects"
```

Expected: all relevant tests PASS.

```
npm run lint
```

Expected: no TypeScript errors.

- [ ] **Step 8: Commit**

```
git add src/core/SysExCodec.ts src/hooks/useMidiSend.ts src/app/[locale]/editor/page.tsx tests/unit/SysExCodec.test.ts
git commit -m "refactor(sysex): buildReorderEffects takes send/ret args

decoded[14] and [15] are SEND/RETURN positions, not constants.
Caller passes current values from preset state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: New `buildFxLoopMove` for live SEND/RETURN edits

**Files:**
- Modify: `src/core/SysExCodec.ts`
- Test: `tests/unit/SysExCodec.test.ts`

The test asserts byte-for-byte equality against the captured pcap message `gp200-capture-20260518-075745.pcap` packet 43 (SEND=5, RETURN=5, decoded[27]=0x08).

- [ ] **Step 1: Write the failing tests**

```ts
describe('SysExCodec: buildFxLoopMove', () => {
  // Capture: scripts/gp200-capture-20260518-075745.pcap, host->dev pkt 43
  // Raw payload after F0..GP-2..CMD..SUB: 64 nibble bytes
  const CAPTURE_1_PAYLOAD = new Uint8Array([
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x04,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x05,0x01,0x00,0x00,0x00,0x08,0x00,0x00,0x01,0x00,0x00,0x00,0x05,0x01,0x00,0x00,
    0x00,0x05,0x00,0x05,0x00,0x00,0x00,0x01,0x00,0x02,0x00,0x03,0x00,0x04,0x00,0x05,
    0x00,0x06,0x00,0x07,0x00,0x08,0x00,0x09,0x00,0x0a,0x00,0x08,0x00,0x00,0x00,0x00,
  ]);

  it("matches capture pkt 43 byte-for-byte (SEND=5, RETURN=5, kind='send')", () => {
    const msg = SysExCodec.buildFxLoopMove(
      [0,1,2,3,4,5,6,7,8,9,10],
      5, 5,
      'send',
    );
    // Strip envelope (F0..CMD..SUB..3-byte pad → 13 bytes) and trailing F7
    const payload = msg.slice(13, msg.length - 1);
    expect(payload).toEqual(CAPTURE_1_PAYLOAD);
  });

  it("sets decoded[27]=0xBA when kind='return'", () => {
    const msg = SysExCodec.buildFxLoopMove(
      [0,1,2,3,4,5,6,7,8,9,10],
      1, 9,
      'return',
    );
    const decoded = SysExCodec.nibbleDecode(msg.slice(13, msg.length - 1));
    expect(decoded[27]).toBe(0xBA);
    expect(decoded[14]).toBe(1);
    expect(decoded[15]).toBe(9);
  });

  it('total SysEx length is 78 bytes (matches Reorder envelope)', () => {
    const msg = SysExCodec.buildFxLoopMove([0,1,2,3,4,5,6,7,8,9,10], 4, 4, 'send');
    expect(msg.length).toBe(78);
    expect(msg[0]).toBe(0xF0);
    expect(msg[77]).toBe(0xF7);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
npx vitest run tests/unit/SysExCodec.test.ts -t "buildFxLoopMove"
```

Expected: 3 FAILs ("not a function").

- [ ] **Step 3: Implement in `src/core/SysExCodec.ts`**

Add after `buildReorderEffects`:

```ts
  buildFxLoopMove(order: number[], send: number, ret: number, which: 'send' | 'return'): Uint8Array {
    // CMD=0x12, sub=0x20, 78 bytes — nibble-encoded 32-byte payload
    // Confirmed: captures 075745 (SEND moves) + 075856 (RETURN moves) — 2026-05-18
    // Same envelope as buildReorderEffects, but with FX-loop discriminators:
    //   decoded[6]=0x51 and decoded[12]=0x51 (vs 0x00 in reorder)
    //   decoded[27]=0x08 (send moved) or 0xBA (return moved), vs 0x44 (reorder)
    // Routing array decoded[16:27] reflects current state (unchanged by this op).
    const decoded = new Uint8Array(32);
    decoded[2] = 0x04;
    decoded[6] = 0x51;
    decoded[8] = 0x08;
    decoded[10] = 0x10;
    decoded[12] = 0x51;
    decoded[14] = send & 0xFF;
    decoded[15] = ret & 0xFF;
    for (let i = 0; i < 11 && i < order.length; i++) {
      decoded[16 + i] = order[i];
    }
    decoded[27] = which === 'send' ? 0x08 : 0xBA;

    const nibbles = this.nibbleEncode(decoded);
    const msg = new Uint8Array(78);
    msg.set([0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x12, 0x20, 0x00, 0x00, 0x00]);
    msg.set(nibbles, 13);
    msg[77] = 0xF7;
    return msg;
  },
```

- [ ] **Step 4: Run to verify pass**

```
npx vitest run tests/unit/SysExCodec.test.ts -t "buildFxLoopMove"
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```
git add src/core/SysExCodec.ts tests/unit/SysExCodec.test.ts
git commit -m "feat(sysex): add buildFxLoopMove for live SEND/RETURN edits

Reverse-engineered from 2026-05-18 captures. decoded[27]=0x08
(SEND moved) or 0xBA (RETURN moved). decoded[6]/[12]=0x51
matches official editor output (vs 0x00 in pure reorder).

Verified byte-for-byte against capture pkt 43 (SEND=5, RETURN=5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: usePreset adds `setFxLoopSend` / `setFxLoopReturn` with constraint push

**Files:**
- Modify: `src/hooks/usePreset.ts`
- Test: `tests/unit/usePreset.test.ts` (or `tests/unit/hooks/usePreset.test.ts` — pick whichever exists; both showed up in the search)

- [ ] **Step 1: Find the right test file**

```
ls tests/unit/usePreset.test.ts tests/unit/hooks/usePreset.test.ts
```

Use whichever exists. If both exist (as the file listing suggests), prefer `tests/unit/hooks/usePreset.test.ts` (newer convention) — verify by reading a few lines:

```
head -30 tests/unit/hooks/usePreset.test.ts
```

- [ ] **Step 2: Write the failing tests**

Append to the chosen test file inside the main `describe('usePreset', ...)` block. The exact `renderHook` pattern depends on the existing tests — read 30 lines of the existing test setup and copy the helper that loads a preset. Here is the test logic (adapt the `result.current.setFxLoopSend` invocation to match the existing pattern, likely wrapped in `act()`):

```ts
  it('setFxLoopSend clamps to [1,10]', () => {
    const { result } = renderHook(() => usePreset());
    act(() => result.current.loadPreset(makePreset({ fxLoopSend: 4, fxLoopReturn: 4 })));
    act(() => result.current.setFxLoopSend(15));
    expect(result.current.preset?.fxLoopSend).toBe(10);
    act(() => result.current.setFxLoopSend(0));
    expect(result.current.preset?.fxLoopSend).toBe(1);
  });

  it('setFxLoopSend pushes RETURN forward when colliding', () => {
    const { result } = renderHook(() => usePreset());
    act(() => result.current.loadPreset(makePreset({ fxLoopSend: 2, fxLoopReturn: 5 })));
    act(() => result.current.setFxLoopSend(8));
    expect(result.current.preset?.fxLoopSend).toBe(8);
    expect(result.current.preset?.fxLoopReturn).toBe(8);
  });

  it('setFxLoopReturn pushes SEND backward when colliding', () => {
    const { result } = renderHook(() => usePreset());
    act(() => result.current.loadPreset(makePreset({ fxLoopSend: 5, fxLoopReturn: 8 })));
    act(() => result.current.setFxLoopReturn(2));
    expect(result.current.preset?.fxLoopSend).toBe(2);
    expect(result.current.preset?.fxLoopReturn).toBe(2);
  });

  it('setFxLoopSend leaves RETURN alone when no collision', () => {
    const { result } = renderHook(() => usePreset());
    act(() => result.current.loadPreset(makePreset({ fxLoopSend: 2, fxLoopReturn: 8 })));
    act(() => result.current.setFxLoopSend(5));
    expect(result.current.preset?.fxLoopSend).toBe(5);
    expect(result.current.preset?.fxLoopReturn).toBe(8);
  });
```

If `makePreset` doesn't exist as a helper, add it near the top of the file (override any fxLoop fields explicitly):

```ts
function makePreset(overrides: Partial<GP200Preset> = {}): GP200Preset {
  return {
    version: '1',
    patchName: 'TestPreset',
    effects: Array.from({ length: 11 }, (_, i) => ({
      slotIndex: i, effectId: 0, enabled: false, params: Array(15).fill(0),
    })),
    checksum: 0,
    fxLoopSend: 4,
    fxLoopReturn: 4,
    ...overrides,
  };
}
```

- [ ] **Step 3: Run to verify failure**

```
npx vitest run tests/unit/hooks/usePreset.test.ts -t "setFxLoop"
```

(or `tests/unit/usePreset.test.ts` if that was the right file)

Expected: 4 FAILs ("setFxLoopSend is not a function").

- [ ] **Step 4: Implement in `src/hooks/usePreset.ts`**

Add to the `PresetActions` interface:

```ts
  setFxLoopSend: (pos: number) => void;
  setFxLoopReturn: (pos: number) => void;
```

Inside `usePreset()`, add the two actions before `reset`:

```ts
  const setFxLoopSend = useCallback((pos: number) => {
    const clamped = Math.max(1, Math.min(10, pos));
    setPreset((prev) => {
      if (!prev) return null;
      const nextReturn = Math.max(clamped, prev.fxLoopReturn);
      return { ...prev, fxLoopSend: clamped, fxLoopReturn: nextReturn };
    });
  }, []);

  const setFxLoopReturn = useCallback((pos: number) => {
    const clamped = Math.max(1, Math.min(10, pos));
    setPreset((prev) => {
      if (!prev) return null;
      const nextSend = Math.min(clamped, prev.fxLoopSend);
      return { ...prev, fxLoopSend: nextSend, fxLoopReturn: clamped };
    });
  }, []);
```

Return them in the hook's return object:

```ts
  return {
    preset, loadPreset, setPatchName, setAuthor,
    toggleEffect, changeEffect, reorderEffects, setParam,
    setFxLoopSend, setFxLoopReturn,
    reset,
  };
```

- [ ] **Step 5: Run to verify pass**

```
npx vitest run tests/unit/hooks/usePreset.test.ts -t "setFxLoop"
```

Expected: 4 PASS.

- [ ] **Step 6: Commit**

```
git add src/hooks/usePreset.ts tests/unit/hooks/usePreset.test.ts
git commit -m "feat(usePreset): add setFxLoopSend/Return with push constraint

Mutators clamp to [1,10] and enforce SEND <= RETURN by pushing
the other arrow when a collision happens.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: useMidiSend adds `sendFxLoopMove`

**Files:**
- Modify: `src/hooks/useMidiSend.ts`
- Test: skip a dedicated unit test (existing pattern doesn't unit-test individual send fns; we verify via the SysExCodec test in Task 7 and manual smoke later)

- [ ] **Step 1: Extend the `UseMidiSendReturn` interface**

Add to the interface in `src/hooks/useMidiSend.ts`:

```ts
  sendFxLoopMove: (order: number[], send: number, ret: number, which: 'send' | 'return') => void;
```

- [ ] **Step 2: Implement the function**

Add inside `useMidiSend(...)`, near `sendReorder`:

```ts
  const sendFxLoopMove = useCallback(
    (order: number[], send: number, ret: number, which: 'send' | 'return') => {
      if (!outputRef.current) return;
      const msg = SysExCodec.buildFxLoopMove(order, send, ret, which);
      console.log(`[GP-200] fxLoop ${which}: send=${send} ret=${ret}`);
      outputRef.current.send(msg);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [],
  );
```

Add `sendFxLoopMove` to the returned object:

```ts
  return {
    sendEffectChange,
    sendToggle,
    sendParamChange,
    sendReorder,
    sendFxLoopMove,
    sendSlotChange,
    // ... rest unchanged
  };
```

- [ ] **Step 3: Verify no TS errors**

```
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Confirm `useMidiDevice` re-exposes the new method**

```
grep -n "sendReorder" src/hooks/useMidiDevice.ts
```

If `useMidiDevice` returns `...midiSend` via spread, `sendFxLoopMove` is automatically exposed. Otherwise explicitly add it to the returned object.

- [ ] **Step 5: Commit**

```
git add src/hooks/useMidiSend.ts
git commit -m "feat(midi): add sendFxLoopMove for live SEND/RETURN edits

Wraps SysExCodec.buildFxLoopMove. No suppressFx — FX-loop moves
don't trigger echo loops since the device confirms via sub=0x14
which goes through a different handler.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: i18n keys for `editor.fxLoop.*`

**Files:**
- Modify: `messages/de.json`, `messages/en.json`, `messages/es.json`, `messages/fr.json`, `messages/it.json`, `messages/pt.json`
- Test: `tests/unit/messages-parity.test.ts` (existing key-parity enforcer)

- [ ] **Step 1: Pick a location inside the `editor` namespace**

Read `messages/en.json` near the `"editor": {` block to identify a suitable insertion point. Add a nested `fxLoop` sub-namespace at the end of `editor` (just before its closing `}`).

- [ ] **Step 2: Add the keys to all 6 locale files**

In `messages/en.json`, within `"editor": { ... }`:

```json
    "fxLoop": {
      "send": "Send",
      "return": "Return",
      "bypass": "FX Loop bypass (Send = Return)",
      "ariaSend": "FX Loop Send position, currently between effects {prev} and {next}",
      "ariaReturn": "FX Loop Return position, currently between effects {prev} and {next}",
      "positionLabel": "Position {pos} of 10"
    }
```

In `messages/de.json`:

```json
    "fxLoop": {
      "send": "Send",
      "return": "Return",
      "bypass": "FX-Loop deaktiviert (Send = Return)",
      "ariaSend": "FX-Loop Send-Position, derzeit zwischen Effekt {prev} und {next}",
      "ariaReturn": "FX-Loop Return-Position, derzeit zwischen Effekt {prev} und {next}",
      "positionLabel": "Position {pos} von 10"
    }
```

In `messages/es.json`:

```json
    "fxLoop": {
      "send": "Envío",
      "return": "Retorno",
      "bypass": "Bucle de efectos desactivado (Envío = Retorno)",
      "ariaSend": "Posición de envío del bucle de efectos, actualmente entre los efectos {prev} y {next}",
      "ariaReturn": "Posición de retorno del bucle de efectos, actualmente entre los efectos {prev} y {next}",
      "positionLabel": "Posición {pos} de 10"
    }
```

In `messages/fr.json`:

```json
    "fxLoop": {
      "send": "Envoi",
      "return": "Retour",
      "bypass": "Boucle d'effets désactivée (Envoi = Retour)",
      "ariaSend": "Position d'envoi de la boucle d'effets, actuellement entre les effets {prev} et {next}",
      "ariaReturn": "Position de retour de la boucle d'effets, actuellement entre les effets {prev} et {next}",
      "positionLabel": "Position {pos} sur 10"
    }
```

In `messages/it.json`:

```json
    "fxLoop": {
      "send": "Invio",
      "return": "Ritorno",
      "bypass": "FX Loop disattivato (Invio = Ritorno)",
      "ariaSend": "Posizione di invio del FX Loop, attualmente tra gli effetti {prev} e {next}",
      "ariaReturn": "Posizione di ritorno del FX Loop, attualmente tra gli effetti {prev} e {next}",
      "positionLabel": "Posizione {pos} di 10"
    }
```

In `messages/pt.json`:

```json
    "fxLoop": {
      "send": "Envio",
      "return": "Retorno",
      "bypass": "FX Loop desativado (Envio = Retorno)",
      "ariaSend": "Posição de envio do FX Loop, atualmente entre os efeitos {prev} e {next}",
      "ariaReturn": "Posição de retorno do FX Loop, atualmente entre os efeitos {prev} e {next}",
      "positionLabel": "Posição {pos} de 10"
    }
```

- [ ] **Step 3: Run the messages parity test**

```
npx vitest run tests/unit/messages-parity.test.ts
```

Expected: PASS (all 6 locales now have the same keys).

- [ ] **Step 4: Commit**

```
git add messages/de.json messages/en.json messages/es.json messages/fr.json messages/it.json messages/pt.json
git commit -m "feat(i18n): add editor.fxLoop keys for all 6 locales

Send/Return labels, bypass message, ARIA labels with position
interpolation, positionLabel for screen readers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: `FxLoopArrows` component (pure UI, no MIDI)

**Files:**
- Create: `src/components/FxLoopArrows.tsx`
- Create: `tests/unit/FxLoopArrows.test.tsx`

The component takes current SEND/RETURN positions plus two callbacks. It renders two draggable arrow icons positioned absolutely above an existing flex/grid row of effect slots (handled by editor page). For simplicity (and because the editor page uses both `flex` list view and `grid` pedals view), the component renders 10 "gap" markers between slots and the arrows snap to them. Wiring into the editor page (Task 12) is what actually positions the row.

For the first cut, the component is a self-contained block with a flat row of 11 slot placeholders + the two arrows. The editor page renders it as a separate row above the effect chain. This is simpler than overlaying onto the existing chain and still matches the spec ("arrows always visible, drag between slots").

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/FxLoopArrows.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FxLoopArrows } from '@/components/FxLoopArrows';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/../messages/en.json';

function wrap(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('FxLoopArrows', () => {
  it('renders two arrow handles', () => {
    const onSend = vi.fn();
    const onReturn = vi.fn();
    render(wrap(<FxLoopArrows send={3} ret={7} onSendChange={onSend} onReturnChange={onReturn} />));
    expect(screen.getByLabelText(/send position/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/return position/i)).toBeInTheDocument();
  });

  it('arrows in same gap show bypass class when send === ret', () => {
    render(wrap(<FxLoopArrows send={4} ret={4} onSendChange={() => {}} onReturnChange={() => {}} />));
    const sendArrow = screen.getByLabelText(/send position/i);
    expect(sendArrow).toHaveAttribute('data-bypass', 'true');
  });

  it('ArrowRight on SEND calls onSendChange(send+1)', () => {
    const onSend = vi.fn();
    render(wrap(<FxLoopArrows send={3} ret={7} onSendChange={onSend} onReturnChange={() => {}} />));
    const sendArrow = screen.getByLabelText(/send position/i);
    sendArrow.focus();
    fireEvent.keyDown(sendArrow, { key: 'ArrowRight' });
    expect(onSend).toHaveBeenCalledWith(4);
  });

  it('ArrowLeft on RETURN calls onReturnChange(ret-1)', () => {
    const onReturn = vi.fn();
    render(wrap(<FxLoopArrows send={3} ret={7} onSendChange={() => {}} onReturnChange={onReturn} />));
    const returnArrow = screen.getByLabelText(/return position/i);
    returnArrow.focus();
    fireEvent.keyDown(returnArrow, { key: 'ArrowLeft' });
    expect(onReturn).toHaveBeenCalledWith(6);
  });

  it('ArrowRight at position 10 does not exceed bounds', () => {
    const onSend = vi.fn();
    render(wrap(<FxLoopArrows send={10} ret={10} onSendChange={onSend} onReturnChange={() => {}} />));
    const sendArrow = screen.getByLabelText(/send position/i);
    sendArrow.focus();
    fireEvent.keyDown(sendArrow, { key: 'ArrowRight' });
    // Component clamps client-side OR delegates: either is acceptable as long as
    // it does not call with 11.
    if (onSend.mock.calls.length > 0) {
      expect(onSend.mock.calls[0][0]).toBeLessThanOrEqual(10);
    }
  });
});
```

If `@testing-library/react` isn't installed, check `package.json` — it's almost certainly already present (look for `vitest` + `@testing-library/react` in devDeps). If missing, install it:

```
npm install --save-dev --legacy-peer-deps @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event jsdom
```

(Existing component tests like `LocaleSwitcher.test.tsx` confirm the toolchain is set up — no install needed.)

- [ ] **Step 2: Run to verify failure**

```
npx vitest run tests/unit/FxLoopArrows.test.tsx
```

Expected: 5 FAILs ("Cannot find module '@/components/FxLoopArrows'").

- [ ] **Step 3: Create the component**

`src/components/FxLoopArrows.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useRef } from 'react';

interface FxLoopArrowsProps {
  /** Current SEND position (1..10). */
  send: number;
  /** Current RETURN position (1..10). */
  ret: number;
  /** Called when the user drags or keyboard-shifts SEND. New position is unclamped — parent clamps + push-constraints. */
  onSendChange: (pos: number) => void;
  onReturnChange: (pos: number) => void;
}

const GAPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function FxLoopArrows({ send, ret, onSendChange, onReturnChange }: FxLoopArrowsProps) {
  const t = useTranslations('editor.fxLoop');
  const dragKindRef = useRef<'send' | 'return' | null>(null);
  const bypass = send === ret;

  function handleArrowKey(kind: 'send' | 'return', e: React.KeyboardEvent<HTMLButtonElement>) {
    const current = kind === 'send' ? send : ret;
    let next = current;
    if (e.key === 'ArrowRight') next = Math.min(10, current + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(1, current - 1);
    else return;
    e.preventDefault();
    (kind === 'send' ? onSendChange : onReturnChange)(next);
  }

  function handleDragStart(kind: 'send' | 'return', e: React.DragEvent<HTMLButtonElement>) {
    dragKindRef.current = kind;
    e.dataTransfer.effectAllowed = 'move';
    // Some browsers won't fire drag without payload
    e.dataTransfer.setData('text/plain', kind);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(gap: number) {
    if (dragKindRef.current === 'send') onSendChange(gap);
    else if (dragKindRef.current === 'return') onReturnChange(gap);
    dragKindRef.current = null;
  }

  return (
    <div
      className="relative mb-2 font-mono-display select-none"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 4px' }}
    >
      <div className="flex items-center justify-between gap-1 text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {/* 11 slots labelled PRE..VOL with 10 drop-gaps between them */}
        {['PRE', 'WAH', 'BST', 'AMP', 'NR', 'CAB', 'EQ', 'MOD', 'DLY', 'RVB', 'VOL'].map((name, idx) => (
          <div key={name} className="flex items-center" style={{ flex: '1 1 0', minWidth: 0 }}>
            <span className="opacity-50 px-1">{name}</span>
            {idx < 10 && (
              <div
                role="presentation"
                data-gap={idx + 1}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(idx + 1)}
                className="relative flex-1 flex flex-col items-center justify-center"
                style={{ minHeight: 28 }}
              >
                {send === idx + 1 && (
                  <button
                    type="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(e) => handleDragStart('send', e)}
                    onKeyDown={(e) => handleArrowKey('send', e)}
                    aria-label={t('ariaSend', { prev: idx + 1, next: idx + 2 })}
                    aria-valuemin={1}
                    aria-valuemax={10}
                    aria-valuenow={send}
                    role="slider"
                    data-bypass={bypass}
                    title={bypass ? t('bypass') : t('send')}
                    className="leading-none cursor-grab"
                    style={{
                      color: 'var(--accent-amber)',
                      opacity: bypass ? 0.5 : 1,
                      transform: 'translateY(-2px)',
                    }}
                  >
                    ↗
                  </button>
                )}
                {ret === idx + 1 && (
                  <button
                    type="button"
                    tabIndex={0}
                    draggable
                    onDragStart={(e) => handleDragStart('return', e)}
                    onKeyDown={(e) => handleArrowKey('return', e)}
                    aria-label={t('ariaReturn', { prev: idx + 1, next: idx + 2 })}
                    aria-valuemin={1}
                    aria-valuemax={10}
                    aria-valuenow={ret}
                    role="slider"
                    data-bypass={bypass}
                    title={bypass ? t('bypass') : t('return')}
                    className="leading-none cursor-grab"
                    style={{
                      color: 'var(--accent-amber)',
                      opacity: bypass ? 0.5 : 1,
                      transform: 'translateY(2px)',
                    }}
                  >
                    ↘
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

```
npx vitest run tests/unit/FxLoopArrows.test.tsx
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```
git add src/components/FxLoopArrows.tsx tests/unit/FxLoopArrows.test.tsx
git commit -m "feat(ui): add FxLoopArrows component with drag + keyboard

Renders an inline strip with 11 slot labels (PRE..VOL) and 10
drop-gap zones. SEND (↗) and RETURN (↘) arrows snap to gaps,
draggable via HTML5 DnD and keyboard-shiftable via ArrowLeft/Right.
Stacked + dimmed when SEND === RETURN (bypass).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Integrate `FxLoopArrows` into the editor page

**Files:**
- Modify: `src/app/[locale]/editor/page.tsx`

- [ ] **Step 1: Pull `setFxLoopSend` / `setFxLoopReturn` out of `usePreset`**

In the destructuring around line 37:

```ts
  const { preset, loadPreset, setPatchName, setAuthor, toggleEffect, changeEffect, reorderEffects, setParam, setFxLoopSend, setFxLoopReturn } = usePreset();
```

- [ ] **Step 2: Add import**

Near the other component imports at the top of the file:

```ts
import { FxLoopArrows } from '@/components/FxLoopArrows';
```

- [ ] **Step 3: Render `FxLoopArrows` above the signal chain**

Find the signal-chain `<div>` (around line 911 — the one that starts with `viewMode === 'pedals' ? 'relative grid ...`). Just **before** that `<div>`, add:

```tsx
      {/* FX-Loop SEND/RETURN positions — drag arrows between effect slots */}
      {preset && (
        <FxLoopArrows
          send={preset.fxLoopSend}
          ret={preset.fxLoopReturn}
          onSendChange={(pos) => {
            const clamped = Math.max(1, Math.min(10, pos));
            // Compute target state with push constraint to know which message(s) to send
            const nextSend = clamped;
            const nextReturn = Math.max(clamped, preset.fxLoopReturn);
            const sendChanged = nextSend !== preset.fxLoopSend;
            const returnPushed = nextReturn !== preset.fxLoopReturn;
            setFxLoopSend(pos);
            if (midiDevice.status === 'connected') {
              const order = preset.effects.map((e) => e.slotIndex);
              if (sendChanged) {
                midiDevice.sendFxLoopMove(order, nextSend, nextReturn, 'send');
              }
              if (returnPushed) {
                midiDevice.sendFxLoopMove(order, nextSend, nextReturn, 'return');
              }
            }
          }}
          onReturnChange={(pos) => {
            const clamped = Math.max(1, Math.min(10, pos));
            const nextReturn = clamped;
            const nextSend = Math.min(clamped, preset.fxLoopSend);
            const returnChanged = nextReturn !== preset.fxLoopReturn;
            const sendPushed = nextSend !== preset.fxLoopSend;
            setFxLoopReturn(pos);
            if (midiDevice.status === 'connected') {
              const order = preset.effects.map((e) => e.slotIndex);
              if (returnChanged) {
                midiDevice.sendFxLoopMove(order, nextSend, nextReturn, 'return');
              }
              if (sendPushed) {
                midiDevice.sendFxLoopMove(order, nextSend, nextReturn, 'send');
              }
            }
          }}
        />
      )}
```

The 4-line conditional dispatch matches the spec: send the user-initiated change first, then the pushed one if any.

- [ ] **Step 4: TypeScript & lint check**

```
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Build check**

```
npm run build
```

Expected: success. (If a build error surfaces about `midiDevice.sendFxLoopMove` not being on the context type, see Task 9 step 4 — `useMidiDevice` may need to explicitly re-export it.)

- [ ] **Step 6: Quick smoke test (manual)**

Start the dev server and load a `.prst`:

```
npm run dev
```

Open `http://localhost:3000/de/editor`, drop a `.prst` file, look for the FX-loop arrow strip above the signal chain. Drag the SEND arrow to a different gap. Open browser devtools and confirm:
- React state updates (use React DevTools or add a `console.log(preset.fxLoopSend)` if needed).
- If a GP-200 is connected: console shows `[GP-200] fxLoop send: send=X ret=Y`.

- [ ] **Step 7: Commit**

```
git add src/app/[locale]/editor/page.tsx
git commit -m "feat(editor): wire FxLoopArrows + live MIDI dispatch

Arrow strip renders above the signal chain. SEND/RETURN edits
update preset state via usePreset and send sub=0x20 messages
when a device is connected. Push-case fires two messages
(user-initiated first, then the pushed one).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Final verification across the full test suite

**Files:** none modified — just verification.

- [ ] **Step 1: Run all unit tests**

```
npm run test
```

Expected: all PASS. If any fail, address case by case before moving on — common failures:
- Tests that built a `GP200Preset` literal without `fxLoopSend`/`fxLoopReturn` and used Zod schema validation: schema-level defaults cover them.
- Tests that assert exact byte sequences for `buildReorderEffects` and previously expected `0x04, 0x04` at decoded[14:16]: update them to pass explicit send/ret args.
- Tests that compared the encoded `.prst` round-trip byte-for-byte: bytes at 0x96/0x97 used to be `0x04`; they should now be `0x00` (because the encoder no longer writes them). If a fixture-based round-trip fails on that, either re-bake the fixture or update the expectation.

- [ ] **Step 2: Type check + lint**

```
npm run lint
```

Expected: clean.

- [ ] **Step 3: Production build**

```
npm run build
```

Expected: success.

- [ ] **Step 4: Manual UI sanity check**

Open `npm run dev`, load several `.prst` files (including ones that previously had non-default SEND/RETURN if any exist in `prst/`), and confirm:
- Arrows render at the correct gap.
- Drag works.
- Keyboard works (ArrowLeft/Right when focused).
- Connected device: arrow moves trigger `[GP-200] fxLoop ...` console logs and device reflects the change.

- [ ] **Step 5: Final commit (if any test/fixture fixes were applied)**

```
git add -A
git status   # review carefully
git commit -m "test: fix existing tests/fixtures to account for new fxLoop fields

(Only if needed — usually schema defaults cover this.)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Update CLAUDE.md if SysEx protocol section is now out-of-date**

CLAUDE.md (slim version) refers to `docs/sysex-protocol.md`. Update that referenced doc only if Task 7 introduced bytes that conflict with what it currently states (decoded[14:16] = "constant 04 04", decoded[27] = "terminator 0x44"). Add a note in `docs/sysex-protocol.md` section 6.21 that decoded[14] = SEND, decoded[15] = RETURN, decoded[27] = flag (0x44 reorder / 0x08 send / 0xBA return).

```
git add docs/sysex-protocol.md
git commit -m "docs(sysex): clarify decoded[14:16] = SEND/RETURN, [27] = flag

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** All 9 sections of the spec are mapped:
  - 1 Data model → Task 1
  - 2 PRSTDecoder/Encoder → Tasks 2, 3
  - 3 SysExCodec → Tasks 4, 5, 6, 7
  - 4 React state → Task 8
  - 5 Live MIDI → Task 9
  - 6 UI → Tasks 11, 12
  - 7 Tests → every task has TDD
  - 8 Migration → covered by Tasks 2/3 (no script needed)
  - 9 Out of scope → respected (no position 0/11; no editor-also-sends-0x51 for pure reorder)
- **Type consistency:** `setFxLoopSend` / `setFxLoopReturn` named consistently; `sendFxLoopMove(order, send, ret, which)` signature consistent across SysExCodec, useMidiSend, editor page.
- **Spec correction caught during planning:** the spec mentioned offsets `0xB2`/`0xB3` (decimal 178/179); the correct offsets are `0x92`/`0x93` (decimal 146/147). Task 2 corrects the spec inline.
