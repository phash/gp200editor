# Web MIDI Device Sync Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Web MIDI push/pull of presets between the GP-200 pedal and the browser editor.

**Architecture:** A pure `SysExCodec` class handles nibble encoding and SysEx frame assembly/parsing. A `useMidiDevice` React hook manages Web MIDI connection state, chunk collection, and pull/push operations. `DeviceStatusBar` and `DeviceSlotBrowser` components provide the UI. The editor page wires them together.

**Tech Stack:** Next.js 14 App Router · TypeScript strict · React hooks · Web MIDI API (`navigator.requestMIDIAccess`) · Vitest + @testing-library/react · next-intl 4

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/core/SysExCodec.ts` | Create | Nibble encode/decode, frame build/parse, slot labels |
| `tests/unit/SysExCodec.test.ts` | Create | Unit tests for SysExCodec |
| `src/hooks/useMidiDevice.ts` | Create | Web MIDI connection, auto-sync, pull/push |
| `tests/unit/useMidiDevice.test.ts` | Create | Unit tests for hook (mocked Web MIDI) |
| `src/components/DeviceStatusBar.tsx` | Create | Connection LED, slot label, Pull/Push buttons |
| `src/components/DeviceSlotBrowser.tsx` | Create | 256-slot modal, 4-pack groups (1A–64D), search |
| `src/app/[locale]/editor/page.tsx` | Modify | Add `<DeviceStatusBar>` and `<DeviceSlotBrowser>` |
| `messages/de.json` | Modify | Add `device` namespace |
| `messages/en.json` | Modify | Add `device` namespace |

---

## Protocol Reference (quick cheat sheet)

Read from `docs/sysex-protocol.md` if you need full detail. Key facts:

- **SysEx header:** `F0 21 25 7E 47 50 2D 32`
- **Nibble encoding:** `decoded[i] = (raw[2i] << 4) | raw[2i+1]`
- **Read request (§4.4):** CMD=`0x11`, sub=`0x10`, 46 bytes, slot at bytes 16/29/33
- **Read response (§4.5):** 7 chunks, CMD=`0x12`, sub=`0x18`. Chunk layout: `[CMD][SUB][SLOT][OFF_LO][OFF_HI][nibble_data...]`. 7 chunks → 2352 nibble bytes → **1176 decoded bytes**
- **Preset name in decoded:** bytes 28–59 (null-terminated ASCII)
- **Effect blocks in decoded:** bytes 120–911 (11 × 72 bytes, same as `.prst`)
- **Write (§4.6):** CMD=`0x12`, sub=`0x20`, 4 chunks → 1464 nibble bytes → **732 decoded bytes**. Blocks 0–7 complete + block 8 first 28 bytes (4 params). Name at write-byte 36, blocks at write-byte 128.
- **Auto-sync:** device sends CMD=`0x12`, sub=`0x4E` automatically on connect (§4.7). `currentSlot` assumed at `payload[1]` — unverified, fall back to `null`.

In the Web MIDI `onmidimessage` event, `event.data` is the full raw bytes including `F0`…`F7`:
- `data[0]` = `0xF0`, `data[8]` = CMD, `data[9]` = sub
- `data[10]` = slot, `data[11]` + `data[12]<<8` = offset (LE16)
- `data.slice(13, data.length - 1)` = nibble data (excluding `F7`)

---

## Task 1: SysExCodec — nibble encoding

**Files:**
- Create: `src/core/SysExCodec.ts`
- Create: `tests/unit/SysExCodec.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/SysExCodec.test.ts
import { describe, it, expect } from 'vitest';
import { SysExCodec } from '@/core/SysExCodec';

describe('SysExCodec: nibble encoding', () => {
  it('nibbleDecode: two nibble bytes → one decoded byte', () => {
    // 0x05 0x09 → 0x59
    const input = new Uint8Array([0x05, 0x09]);
    expect(SysExCodec.nibbleDecode(input)).toEqual(new Uint8Array([0x59]));
  });

  it('nibbleEncode: one byte → two nibble bytes', () => {
    const input = new Uint8Array([0x59]);
    expect(SysExCodec.nibbleEncode(input)).toEqual(new Uint8Array([0x05, 0x09]));
  });

  it('nibbleEncode/nibbleDecode round-trip', () => {
    const original = new Uint8Array([0x00, 0x7F, 0xFF, 0x42, 0xAB]);
    expect(SysExCodec.nibbleDecode(SysExCodec.nibbleEncode(original))).toEqual(original);
  });

  it('nibbleDecode ignores trailing odd byte', () => {
    const input = new Uint8Array([0x05, 0x09, 0x03]); // odd length → last byte ignored
    expect(SysExCodec.nibbleDecode(input)).toEqual(new Uint8Array([0x59]));
  });

  it('nibbleEncode all values stay in 0x00–0x0F range', () => {
    const input = new Uint8Array(256).map((_, i) => i);
    const encoded = SysExCodec.nibbleEncode(input);
    for (const b of encoded) {
      expect(b).toBeLessThanOrEqual(0x0F);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/SysExCodec.test.ts
```
Expected: FAIL — `Cannot find module '@/core/SysExCodec'`

- [ ] **Step 3: Create SysExCodec with nibble functions**

```typescript
// src/core/SysExCodec.ts
export const SysExCodec = {
  nibbleDecode(data: Uint8Array): Uint8Array {
    const out = new Uint8Array(Math.floor(data.length / 2));
    for (let i = 0; i < out.length; i++) {
      out[i] = ((data[2 * i] & 0x0F) << 4) | (data[2 * i + 1] & 0x0F);
    }
    return out;
  },

  nibbleEncode(data: Uint8Array): Uint8Array {
    const out = new Uint8Array(data.length * 2);
    for (let i = 0; i < data.length; i++) {
      out[2 * i]     = (data[i] >> 4) & 0x0F;
      out[2 * i + 1] = data[i] & 0x0F;
    }
    return out;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/SysExCodec.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/SysExCodec.ts tests/unit/SysExCodec.test.ts
git commit -m "feat: SysExCodec nibble encode/decode"
```

---

## Task 2: SysExCodec — slot labels + read request

**Files:**
- Modify: `src/core/SysExCodec.ts`
- Modify: `tests/unit/SysExCodec.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/SysExCodec.test.ts`:

```typescript
describe('SysExCodec: slot labels', () => {
  it('slotToLabel: 0 → "1A"', () => expect(SysExCodec.slotToLabel(0)).toBe('1A'));
  it('slotToLabel: 1 → "1B"', () => expect(SysExCodec.slotToLabel(1)).toBe('1B'));
  it('slotToLabel: 3 → "1D"', () => expect(SysExCodec.slotToLabel(3)).toBe('1D'));
  it('slotToLabel: 4 → "2A"', () => expect(SysExCodec.slotToLabel(4)).toBe('2A'));
  it('slotToLabel: 255 → "64D"', () => expect(SysExCodec.slotToLabel(255)).toBe('64D'));
  it('labelToSlot: "1A" → 0', () => expect(SysExCodec.labelToSlot('1A')).toBe(0));
  it('labelToSlot: "64D" → 255', () => expect(SysExCodec.labelToSlot('64D')).toBe(255));
  it('round-trip: slotToLabel → labelToSlot', () => {
    for (let s = 0; s < 256; s++) {
      expect(SysExCodec.labelToSlot(SysExCodec.slotToLabel(s))).toBe(s);
    }
  });
});

describe('SysExCodec: buildReadRequest', () => {
  it('returns a 46-byte message starting with F0 header', () => {
    const req = SysExCodec.buildReadRequest(0);
    expect(req.length).toBe(46);
    expect(req[0]).toBe(0xF0);
    expect(req[1]).toBe(0x21);
    expect(req[8]).toBe(0x11); // CMD
    expect(req[9]).toBe(0x10); // sub
    expect(req[45]).toBe(0xF7); // end
  });

  it('places slot number at bytes 16, 29, 33', () => {
    const req = SysExCodec.buildReadRequest(9);
    expect(req[16]).toBe(9);
    expect(req[29]).toBe(9);
    expect(req[33]).toBe(9);
  });

  it('slot 0 has zeros at positions 16, 29, 33', () => {
    const req = SysExCodec.buildReadRequest(0);
    expect(req[16]).toBe(0);
    expect(req[29]).toBe(0);
    expect(req[33]).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failures**

```bash
npx vitest run tests/unit/SysExCodec.test.ts
```
Expected: FAIL — `slotToLabel is not a function`, `buildReadRequest is not a function`

- [ ] **Step 3: Add slot labels and buildReadRequest to SysExCodec**

```typescript
// Add to the SysExCodec object in src/core/SysExCodec.ts:

  slotToLabel(slot: number): string {
    const bank = Math.floor(slot / 4) + 1;
    const letter = 'ABCD'[slot % 4];
    return `${bank}${letter}`;
  },

  labelToSlot(label: string): number {
    const match = label.match(/^(\d+)([ABCD])$/);
    if (!match) throw new Error(`Invalid slot label: ${label}`);
    const bank = parseInt(match[1], 10);
    const letter = 'ABCD'.indexOf(match[2]);
    return (bank - 1) * 4 + letter;
  },

  buildReadRequest(slot: number): Uint8Array {
    // CMD=0x11, sub=0x10, 46 bytes (§4.4 "Request Full Preset Data")
    // Slot number at bytes 16, 29, 33 (0-based)
    const HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32];
    const n = slot & 0xFF;
    return new Uint8Array([
      ...HEADER, 0x11, 0x10,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
      n,                                      // byte 16: slot
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
      n,                                      // byte 29: slot
      0x00, 0x00, 0x00,
      n,                                      // byte 33: slot
      0x00, 0x00,
      0xF7,
    ]);
  },
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/unit/SysExCodec.test.ts
```
Expected: PASS (all tests including Task 1)

- [ ] **Step 5: Commit**

```bash
git add src/core/SysExCodec.ts tests/unit/SysExCodec.test.ts
git commit -m "feat: SysExCodec slot labels and buildReadRequest"
```

---

## Task 3: SysExCodec — parseReadChunks + parsePresetName

**Files:**
- Modify: `src/core/SysExCodec.ts`
- Modify: `tests/unit/SysExCodec.test.ts`

The `parseReadChunks` function receives the 7 raw SysEx messages as Uint8Arrays (including F0…F7). It:
1. Extracts nibble data from each: `msg.slice(13, msg.length - 1)`
2. Sorts chunks by offset (`msg[11] | (msg[12] << 8)`)
3. Concatenates sorted nibble data → 2352 bytes
4. nibble-decodes → 1176 bytes
5. Parses into `GP200Preset`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/SysExCodec.test.ts`:

```typescript
import type { GP200Preset } from '@/core/types';

/** Build a synthetic 1176-byte decoded preset buffer */
function buildDecodedPreset(name: string, slot: number): Uint8Array {
  const buf = new Uint8Array(1176).fill(0);
  const view = new DataView(buf.buffer);
  // Header: slot at [6:8]
  view.setUint16(6, slot, true);
  // Name at [28:60]
  for (let i = 0; i < name.length && i < 31; i++) {
    buf[28 + i] = name.charCodeAt(i);
  }
  buf[28 + name.length] = 0; // null terminator
  // 11 effect blocks at offset 120, each 72 bytes
  for (let b = 0; b < 11; b++) {
    const base = 120 + b * 72;
    buf[base + 0] = 0x14; buf[base + 1] = 0x00; buf[base + 2] = 0x44; buf[base + 3] = 0x00;
    buf[base + 4] = b;    // slot index
    buf[base + 5] = 1;    // active
    buf[base + 6] = 0x00; buf[base + 7] = 0x0F;
    view.setUint32(base + 8, 0x03000001 + b, true); // effect ID
    // 15 float32 params: param[0] = b * 10.0
    view.setFloat32(base + 12, b * 10.0, true);
  }
  return buf;
}

/** Wrap nibble-encoded bytes into a fake sub=0x18 SysEx message */
function makeChunk(slot: number, offset: number, nibbleData: Uint8Array): Uint8Array {
  const HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x12, 0x18];
  const offLo = offset & 0xFF;
  const offHi = (offset >> 8) & 0xFF;
  return new Uint8Array([...HEADER, slot, offLo, offHi, ...nibbleData, 0xF7]);
}

/** Build 7 fake sub=0x18 chunks from a 1176-byte decoded buffer */
function buildFakeChunks(decoded: Uint8Array, slot: number): Uint8Array[] {
  const nibble = SysExCodec.nibbleEncode(decoded); // 2352 bytes
  // Real chunk offsets: 0, 313, 626, 1067, 1380, 1821, 2134
  // For testing, split nibble data at these byte offsets into 7 parts
  const chunkNibbleLengths = [370, 370, 370, 370, 370, 370, 132]; // sum = 2352
  const chunkOffsets       = [0,   313, 626, 1067, 1380, 1821, 2134];
  const chunks: Uint8Array[] = [];
  let pos = 0;
  for (let i = 0; i < 7; i++) {
    const nibbleSlice = nibble.slice(pos, pos + chunkNibbleLengths[i]);
    chunks.push(makeChunk(slot, chunkOffsets[i], nibbleSlice));
    pos += chunkNibbleLengths[i];
  }
  return chunks;
}

describe('SysExCodec: parseReadChunks', () => {
  it('parses preset name correctly', () => {
    const decoded = buildDecodedPreset('Pretender', 9);
    const chunks = buildFakeChunks(decoded, 9);
    const preset = SysExCodec.parseReadChunks(chunks);
    expect(preset.patchName).toBe('Pretender');
  });

  it('parses 11 effect blocks', () => {
    const decoded = buildDecodedPreset('Test', 0);
    const chunks = buildFakeChunks(decoded, 0);
    const preset = SysExCodec.parseReadChunks(chunks);
    expect(preset.effects).toHaveLength(11);
  });

  it('effect blocks have correct slot indices', () => {
    const decoded = buildDecodedPreset('Test', 0);
    const chunks = buildFakeChunks(decoded, 0);
    const preset = SysExCodec.parseReadChunks(chunks);
    preset.effects.forEach((e, i) => expect(e.slotIndex).toBe(i));
  });

  it('effect blocks have correct enabled flag', () => {
    const decoded = buildDecodedPreset('Test', 0);
    const chunks = buildFakeChunks(decoded, 0);
    const preset = SysExCodec.parseReadChunks(chunks);
    preset.effects.forEach(e => expect(e.enabled).toBe(true));
  });

  it('parses float32 params correctly', () => {
    const decoded = buildDecodedPreset('Test', 0);
    const chunks = buildFakeChunks(decoded, 0);
    const preset = SysExCodec.parseReadChunks(chunks);
    expect(preset.effects[3].params[0]).toBeCloseTo(30.0, 4);
  });

  it('sets checksum to 0 (SysEx has no checksum)', () => {
    const decoded = buildDecodedPreset('Test', 0);
    const chunks = buildFakeChunks(decoded, 0);
    const preset = SysExCodec.parseReadChunks(chunks);
    expect(preset.checksum).toBe(0);
  });

  it('sorts chunks by offset (handles out-of-order delivery)', () => {
    const decoded = buildDecodedPreset('Pretender', 9);
    const chunks = buildFakeChunks(decoded, 9);
    const shuffled = [chunks[6], chunks[2], chunks[0], chunks[4], chunks[1], chunks[5], chunks[3]];
    const preset = SysExCodec.parseReadChunks(shuffled);
    expect(preset.patchName).toBe('Pretender');
  });
});

describe('SysExCodec: parsePresetName', () => {
  it('extracts name from first chunk (offset=0)', () => {
    const decoded = buildDecodedPreset('JCM 800', 0);
    const chunks = buildFakeChunks(decoded, 0);
    const firstChunk = chunks[0]; // offset=0
    expect(SysExCodec.parsePresetName(firstChunk)).toBe('JCM 800');
  });
});
```

- [ ] **Step 2: Run to verify failures**

```bash
npx vitest run tests/unit/SysExCodec.test.ts
```
Expected: FAIL — `parseReadChunks is not a function`

- [ ] **Step 3: Implement parseReadChunks and parsePresetName**

```typescript
// Add to SysExCodec object in src/core/SysExCodec.ts:
// Also add at top of file:
import type { GP200Preset } from './types';
import { GP200PresetSchema } from './types';

  parsePresetName(sysexMsg: Uint8Array): string {
    // Extract nibble data from a sub=0x18 chunk (offset must be 0)
    // sysexMsg layout: [F0 header(10B)][slot(1B)][off_lo(1B)][off_hi(1B)][nibble_data...][F7]
    const nibbleData = sysexMsg.slice(13, sysexMsg.length - 1);
    const decoded = this.nibbleDecode(nibbleData);
    // In a full preset, name starts at byte 28. In the first chunk (offset=0),
    // the nibble data covers decoded bytes 0..184, so name is at decoded[28..59].
    let name = '';
    for (let i = 0; i < 32; i++) {
      const b = decoded[28 + i];
      if (b === 0) break;
      name += String.fromCharCode(b);
    }
    return name;
  },

  parseReadChunks(chunks: Uint8Array[]): GP200Preset {
    // Sort by chunk offset (bytes [11:13] of each SysEx message are offset LE16)
    const sorted = [...chunks].sort((a, b) => {
      const offA = a[11] | (a[12] << 8);
      const offB = b[11] | (b[12] << 8);
      return offA - offB;
    });

    // Concatenate nibble data from all 7 chunks
    const nibbleParts = sorted.map(msg => msg.slice(13, msg.length - 1));
    const totalNibbleLen = nibbleParts.reduce((s, p) => s + p.length, 0);
    const allNibbles = new Uint8Array(totalNibbleLen);
    let pos = 0;
    for (const part of nibbleParts) {
      allNibbles.set(part, pos);
      pos += part.length;
    }

    // Nibble-decode → 1176 bytes
    const decoded = this.nibbleDecode(allNibbles);

    // Parse preset name (bytes 28–59, null-terminated)
    let patchName = '';
    for (let i = 0; i < 32; i++) {
      const b = decoded[28 + i];
      if (b === 0) break;
      patchName += String.fromCharCode(b);
    }

    // Parse 11 effect blocks (bytes 120–911, each 72 bytes)
    const view = new DataView(decoded.buffer, decoded.byteOffset, decoded.byteLength);
    const effects: GP200Preset['effects'] = [];
    for (let b = 0; b < 11; b++) {
      const base = 120 + b * 72;
      const slotIndex = decoded[base + 4];
      const enabled   = decoded[base + 5] === 1;
      const effectId  = view.getUint32(base + 8, true);
      const params: number[] = [];
      for (let p = 0; p < 15; p++) {
        params.push(view.getFloat32(base + 12 + p * 4, true));
      }
      effects.push({ slotIndex, enabled, effectId, params });
    }

    return GP200PresetSchema.parse({ version: '1', patchName, effects, checksum: 0 });
  },
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/unit/SysExCodec.test.ts
```
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/SysExCodec.ts tests/unit/SysExCodec.test.ts
git commit -m "feat: SysExCodec parseReadChunks and parsePresetName"
```

---

## Task 4: SysExCodec — buildWriteChunks

**Files:**
- Modify: `src/core/SysExCodec.ts`
- Modify: `tests/unit/SysExCodec.test.ts`

The write payload is 732 decoded bytes. Layout:
- `[0:36]` = write header (36 bytes, slot at `[8:10]`)
- `[36:68]` = preset name (32 bytes, null-padded)
- `[68:128]` = middle section (routing table, 60 bytes)
- `[128:704]` = blocks 0–7 complete (576 bytes)
- `[704:732]` = block 8 partial: `14 00 44 00` + slotIdx + active + `00 0F` + effectID + 4×float32 = 28 bytes

The write header has `0x27` markers at positions 6, 12, 14, 20 (§6.1). The exact bytes for positions 16–35 must be taken from the Windows capture. Use the `analyze-sysex.py` script to extract them, or hardcode the template below (derived from slot 9 "Pretender" capture — constant bytes only, slot position zeroed):

```
00 00 04 00 01 00  // bytes 0–5
27 00              // bytes 6–7 (0x27 marker)
[SLOT] 00          // bytes 8–9 (slot LE16, set at runtime)
04 00              // bytes 10–11
27 00              // bytes 12–13
27 00              // bytes 14–15
00 00 00 00        // bytes 16–19 (from capture)
27 00              // bytes 20–21 (0x27 marker)
00 00 00 00 00 00 00 00 00 00 00 00 00 00  // bytes 22–35 (from capture, likely zeros)
```

**If the above template is wrong**, extract it from the capture:
```bash
python3 -c "
import sys
sys.path.insert(0, 'scripts')
# Open the pcap and print the first 36 write-header bytes
# Run: python3 scripts/analyze-sysex.py /home/manuel/gp200-capture-windows.pcap
"
```
The correct header will be in the 'write reconstruction' output. The zero-slot template is what you get after zeroing bytes [8:10].

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/SysExCodec.test.ts`:

```typescript
describe('SysExCodec: buildWriteChunks', () => {
  const samplePreset: GP200Preset = {
    version: '1',
    patchName: 'MyPreset',
    checksum: 0,
    effects: Array.from({ length: 11 }, (_, i) => ({
      slotIndex: i,
      enabled: i % 2 === 0,
      effectId: 0x03000001 + i,
      params: Array.from({ length: 15 }, (_, p) => p * 1.5),
    })),
  };

  it('returns exactly 4 chunks', () => {
    const chunks = SysExCodec.buildWriteChunks(samplePreset, 5);
    expect(chunks).toHaveLength(4);
  });

  it('each chunk starts with SysEx header CMD=0x12 sub=0x20', () => {
    const chunks = SysExCodec.buildWriteChunks(samplePreset, 5);
    const HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x12, 0x20];
    for (const chunk of chunks) {
      HEADER.forEach((b, i) => expect(chunk[i]).toBe(b));
    }
  });

  it('each chunk ends with F7', () => {
    const chunks = SysExCodec.buildWriteChunks(samplePreset, 5);
    for (const chunk of chunks) expect(chunk[chunk.length - 1]).toBe(0xF7);
  });

  it('slot number in each chunk header (byte 10)', () => {
    const chunks = SysExCodec.buildWriteChunks(samplePreset, 7);
    for (const chunk of chunks) expect(chunk[10]).toBe(7);
  });

  it('chunks decode to 732 bytes total', () => {
    const chunks = SysExCodec.buildWriteChunks(samplePreset, 0);
    // Each chunk: [10-byte header][slot:1][offLo:1][offHi:1][nibbleData...][F7:1]
    const nibbles = chunks.flatMap(c => Array.from(c.slice(13, c.length - 1)));
    const decoded = SysExCodec.nibbleDecode(new Uint8Array(nibbles));
    expect(decoded.length).toBe(732);
  });

  it('preset name appears at write offset 36', () => {
    const chunks = SysExCodec.buildWriteChunks(samplePreset, 0);
    const nibbles = chunks.flatMap(c => Array.from(c.slice(13, c.length - 1)));
    const decoded = SysExCodec.nibbleDecode(new Uint8Array(nibbles));
    const name = new TextDecoder().decode(decoded.slice(36, 36 + samplePreset.patchName.length));
    expect(name).toBe('MyPreset');
  });

  it('effect blocks start at write offset 128', () => {
    const chunks = SysExCodec.buildWriteChunks(samplePreset, 0);
    const nibbles = chunks.flatMap(c => Array.from(c.slice(13, c.length - 1)));
    const decoded = SysExCodec.nibbleDecode(new Uint8Array(nibbles));
    const view = new DataView(decoded.buffer);
    // Block 0 marker: 14 00 44 00 at offset 128
    expect(decoded[128]).toBe(0x14);
    expect(decoded[130]).toBe(0x44);
    // Block 0 effectId
    expect(view.getUint32(128 + 8, true)).toBe(0x03000001);
  });
});
```

- [ ] **Step 2: Run to verify failures**

```bash
npx vitest run tests/unit/SysExCodec.test.ts
```
Expected: FAIL — `buildWriteChunks is not a function`

- [ ] **Step 3: Implement buildWriteChunks**

```typescript
// Add to SysExCodec in src/core/SysExCodec.ts:

  buildWriteChunks(preset: GP200Preset, slot: number): Uint8Array[] {
    const SYSEX_HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x12, 0x20];

    // Build 732-byte decoded write payload
    const payload = new Uint8Array(732).fill(0);
    const view = new DataView(payload.buffer);

    // Write header (36 bytes, §6.1) — constant template with slot at [8:10]
    const WRITE_HEADER = [
      0x00, 0x00, 0x04, 0x00, 0x01, 0x00, // bytes 0–5
      0x27, 0x00,                          // bytes 6–7 (0x27 marker)
      slot & 0xFF, 0x00,                   // bytes 8–9 (slot LE16)
      0x04, 0x00,                          // bytes 10–11
      0x27, 0x00,                          // bytes 12–13 (0x27 marker)
      0x27, 0x00,                          // bytes 14–15 (0x27 marker)
      0x00, 0x00, 0x00, 0x00,              // bytes 16–19
      0x27, 0x00,                          // bytes 20–21 (0x27 marker)
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // bytes 22–35
    ];
    WRITE_HEADER.forEach((b, i) => { payload[i] = b; });

    // Preset name at bytes 36–67 (null-terminated, 32 bytes)
    for (let i = 0; i < 32; i++) {
      payload[36 + i] = i < preset.patchName.length ? preset.patchName.charCodeAt(i) : 0;
    }

    // Effect blocks 0–7 complete at bytes 128–703 (8 × 72 = 576 bytes)
    for (let b = 0; b < 8; b++) {
      const base = 128 + b * 72;
      const slot_e = preset.effects[b];
      if (!slot_e) continue;
      payload[base + 0] = 0x14; payload[base + 1] = 0x00;
      payload[base + 2] = 0x44; payload[base + 3] = 0x00;
      payload[base + 4] = slot_e.slotIndex;
      payload[base + 5] = slot_e.enabled ? 1 : 0;
      payload[base + 6] = 0x00; payload[base + 7] = 0x0F;
      view.setUint32(base + 8, slot_e.effectId, true);
      for (let p = 0; p < 15; p++) {
        view.setFloat32(base + 12 + p * 4, slot_e.params[p] ?? 0, true);
      }
    }

    // Block 8 partial at bytes 704–731 (28 bytes: header + slotIdx + active + const + effectId + 4 params)
    const blk8 = preset.effects[8];
    if (blk8) {
      payload[704] = 0x14; payload[705] = 0x00; payload[706] = 0x44; payload[707] = 0x00;
      payload[708] = blk8.slotIndex;
      payload[709] = blk8.enabled ? 1 : 0;
      payload[710] = 0x00; payload[711] = 0x0F;
      view.setUint32(712, blk8.effectId, true);
      for (let p = 0; p < 4; p++) {
        view.setFloat32(716 + p * 4, blk8.params[p] ?? 0, true);
      }
    }

    // Nibble-encode and split into 4 chunks
    const nibble = this.nibbleEncode(payload); // 1464 bytes
    const CHUNK_OFFSETS = [0, 311, 622, 1061];
    // Nibble lengths per chunk: 366, 366, 366, 366 (total 1464)
    const CHUNK_NIBBLE_LENS = [622, 622, 622, 0]; // decoded offsets → nibble offsets
    // Compute nibble lengths from decoded offsets
    // decoded offsets 0,311,622,1061 → nibble offsets 0,622,1244,2122 → lengths 622,622,878,342
    // Actually: chunk i covers decoded bytes [off_i .. off_{i+1}) → nibble [2*off_i .. 2*off_{i+1})
    const decodedOffsets = [0, 311, 622, 1061, 732];
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < 4; i++) {
      const nibbleStart = decodedOffsets[i] * 2;
      const nibbleEnd   = decodedOffsets[i + 1] * 2;
      const nibbleData  = nibble.slice(nibbleStart, nibbleEnd);
      const offLo = CHUNK_OFFSETS[i] & 0xFF;
      const offHi = (CHUNK_OFFSETS[i] >> 8) & 0xFF;
      chunks.push(new Uint8Array([
        ...SYSEX_HEADER, slot & 0xFF, offLo, offHi, ...nibbleData, 0xF7,
      ]));
    }
    return chunks;
  },
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/unit/SysExCodec.test.ts
```
Expected: PASS (all tests)

- [ ] **Step 5: Run all unit tests to verify no regressions**

```bash
npm run test
```
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/core/SysExCodec.ts tests/unit/SysExCodec.test.ts
git commit -m "feat: SysExCodec buildWriteChunks (complete SysExCodec)"
```

---

## Task 5: i18n — device namespace

**Files:**
- Modify: `messages/de.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add `device` key to messages/de.json**

Add before the closing `}`:
```json
  "device": {
    "connect": "Verbinden",
    "disconnect": "Trennen",
    "connecting": "Verbinde…",
    "noDevice": "Kein Gerät",
    "connected": "GP-200 verbunden",
    "pull": "← Pull",
    "push": "Push →",
    "pullFrom": "Pull von {slot}",
    "pushTo": "Push nach {slot}",
    "loadingNames": "Lade Preset-Namen…",
    "browserTitle": "Preset auswählen",
    "search": "Preset suchen…",
    "chromeOnly": "Nur Chrome/Edge unterstützt",
    "error": "Verbindungsfehler",
    "retry": "Erneut verbinden",
    "cancel": "Abbrechen"
  }
```

- [ ] **Step 2: Add `device` key to messages/en.json**

```json
  "device": {
    "connect": "Connect",
    "disconnect": "Disconnect",
    "connecting": "Connecting…",
    "noDevice": "No device",
    "connected": "GP-200 connected",
    "pull": "← Pull",
    "push": "Push →",
    "pullFrom": "Pull from {slot}",
    "pushTo": "Push to {slot}",
    "loadingNames": "Loading preset names…",
    "browserTitle": "Select Preset",
    "search": "Search presets…",
    "chromeOnly": "Chrome/Edge only",
    "error": "Connection error",
    "retry": "Reconnect",
    "cancel": "Cancel"
  }
```

- [ ] **Step 3: Run tests to verify no regressions**

```bash
npm run test
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add messages/de.json messages/en.json
git commit -m "feat: add device i18n namespace (de + en)"
```

---

## Task 6: useMidiDevice hook

**Files:**
- Create: `src/hooks/useMidiDevice.ts`
- Create: `tests/unit/useMidiDevice.test.ts`

The hook manages Web MIDI connection state. It:
1. Calls `navigator.requestMIDIAccess({ sysex: true })` on `connect()`
2. Finds GP-200 ports by name
3. Listens for sub=0x4E to get `currentSlot`
4. `pullPreset(slot)`: sends `buildReadRequest`, collects 7 sub=0x18 chunks, calls `parseReadChunks`
5. `pushPreset(preset, slot)`: sends 4 `buildWriteChunks` messages sequentially
6. `loadPresetNames()`: iterates 0–255, requests first chunk per slot, extracts name

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/useMidiDevice.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMidiDevice } from '@/hooks/useMidiDevice';

// Mock Web MIDI API
type MIDIMessageHandler = (event: { data: Uint8Array }) => void;

function makeMockMidi() {
  const inputHandlers: MIDIMessageHandler[] = [];
  const mockInput = {
    name: 'GP-200 MIDI 1',
    set onmidimessage(handler: MIDIMessageHandler | null) {
      if (handler) inputHandlers.push(handler);
    },
  };
  const sentMessages: Uint8Array[] = [];
  const mockOutput = {
    name: 'GP-200 MIDI 1',
    send: vi.fn((data: number[] | Uint8Array) => {
      sentMessages.push(new Uint8Array(data));
    }),
  };
  const access = {
    inputs: { values: () => [mockInput] },
    outputs: { values: () => [mockOutput] },
  };

  function emit(data: Uint8Array) {
    inputHandlers.forEach(h => h({ data }));
  }

  return { access, mockInput, mockOutput, sentMessages, emit };
}

describe('useMidiDevice', () => {
  let mockMidi: ReturnType<typeof makeMockMidi>;

  beforeEach(() => {
    mockMidi = makeMockMidi();
    vi.stubGlobal('navigator', {
      requestMIDIAccess: vi.fn().mockResolvedValue(mockMidi.access),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('initial status is disconnected', () => {
    const { result } = renderHook(() => useMidiDevice());
    expect(result.current.status).toBe('disconnected');
    expect(result.current.currentSlot).toBeNull();
    expect(result.current.deviceName).toBeNull();
  });

  it('connect() sets status to connecting then connected', async () => {
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => {
      result.current.connect();
    });
    await waitFor(() => expect(result.current.status).toBe('connected'));
    expect(result.current.deviceName).toContain('GP-200');
  });

  it('connect() fails when no GP-200 found', async () => {
    vi.stubGlobal('navigator', {
      requestMIDIAccess: vi.fn().mockResolvedValue({
        inputs: { values: () => [] },
        outputs: { values: () => [] },
      }),
    });
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toContain('GP-200');
  });

  it('connect() sets error when requestMIDIAccess is denied', async () => {
    vi.stubGlobal('navigator', {
      requestMIDIAccess: vi.fn().mockRejectedValue(new DOMException('Permission denied')),
    });
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('disconnect() resets to disconnected', async () => {
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe('connected'));
    act(() => { result.current.disconnect(); });
    expect(result.current.status).toBe('disconnected');
  });

  it('parses currentSlot from sub=0x4E message', async () => {
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe('connected'));

    // Emit a fake sub=0x4E with slot=9 at payload[1]
    const sysex4E = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x12, 0x4E,
      0x09, // slot = 9
      0x00, 0x00, // offset
      0xF7,
    ]);
    act(() => { mockMidi.emit(sysex4E); });
    expect(result.current.currentSlot).toBe(9);
  });

  it('connect() sends a read request (CMD=0x11) for the MIDI port', async () => {
    const { result } = renderHook(() => useMidiDevice());
    await act(async () => { result.current.connect(); });
    await waitFor(() => expect(result.current.status).toBe('connected'));
    // No request sent on connect — device auto-sends sub=0x4E
    // pullPreset sends the request:
    const SYSEX_HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x11, 0x10];
    let pullPromise: Promise<unknown>;
    act(() => {
      pullPromise = result.current.pullPreset(5);
    });
    await waitFor(() => {
      const sent = mockMidi.sentMessages;
      expect(sent.length).toBeGreaterThan(0);
      const req = sent[0];
      SYSEX_HEADER.forEach((b, i) => expect(req[i]).toBe(b));
      expect(req[16]).toBe(5); // slot
    });
    // Clean up by aborting the pull (no chunks sent)
    pullPromise!.catch(() => {}); // ignore timeout error
  });
});
```

- [ ] **Step 2: Run to verify failures**

```bash
npx vitest run tests/unit/useMidiDevice.test.ts
```
Expected: FAIL — `Cannot find module '@/hooks/useMidiDevice'`

- [ ] **Step 3: Implement useMidiDevice hook**

```typescript
// src/hooks/useMidiDevice.ts
'use client';
import { useState, useRef, useCallback } from 'react';
import { SysExCodec } from '@/core/SysExCodec';
import type { GP200Preset } from '@/core/types';

const SYSEX_HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32];
const READ_TIMEOUT_MS = 3000;

function isSysEx(data: Uint8Array, cmd: number, sub: number): boolean {
  return (
    data.length > 10 &&
    data[0] === 0xF0 &&
    data[1] === 0x21 && data[2] === 0x25 && data[3] === 0x7E &&
    data[4] === 0x47 && data[5] === 0x50 && data[6] === 0x2D && data[7] === 0x32 &&
    data[8] === cmd && data[9] === sub
  );
}

export interface UseMidiDeviceReturn {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  errorMessage: string | null;
  deviceName: string | null;
  currentSlot: number | null;
  presetNames: (string | null)[];
  namesLoadProgress: number;

  connect: () => Promise<void>;
  disconnect: () => void;
  loadPresetNames: () => Promise<void>;
  pullPreset: (slot: number) => Promise<GP200Preset>;
  pushPreset: (preset: GP200Preset, slot: number) => Promise<void>;
}

export function useMidiDevice(): UseMidiDeviceReturn {
  const [status, setStatus] = useState<UseMidiDeviceReturn['status']>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [currentSlot, setCurrentSlot] = useState<number | null>(null);
  const [presetNames, setPresetNames] = useState<(string | null)[]>(new Array(256).fill(null));
  const [namesLoadProgress, setNamesLoadProgress] = useState(0);

  const outputRef = useRef<MIDIOutput | null>(null);
  const inputRef  = useRef<MIDIInput | null>(null);

  const onMidiMessage = useCallback((event: MIDIMessageEvent) => {
    const data = new Uint8Array(event.data.buffer ?? event.data);
    // sub=0x4E: initial state dump → parse currentSlot
    if (isSysEx(data, 0x12, 0x4E)) {
      const slot = data[10]; // assumed payload[1]; unverified — see spec §6 note
      if (slot >= 0 && slot < 256) setCurrentSlot(slot);
    }
  }, []);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setErrorMessage(null);
    try {
      if (!navigator.requestMIDIAccess) {
        throw new Error('Web MIDI API not supported in this browser');
      }
      const access = await navigator.requestMIDIAccess({ sysex: true });
      const output = [...access.outputs.values()].find(p => p.name.includes('GP-200')) ?? null;
      const input  = [...access.inputs.values()].find(p => p.name.includes('GP-200')) ?? null;
      if (!output || !input) {
        throw new Error('GP-200 not found in MIDI ports');
      }
      outputRef.current = output;
      inputRef.current  = input;
      (input as MIDIInput).onmidimessage = onMidiMessage as EventListener;
      setDeviceName(input.name);
      setStatus('connected');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [onMidiMessage]);

  const disconnect = useCallback(() => {
    if (inputRef.current) (inputRef.current as MIDIInput).onmidimessage = null;
    outputRef.current = null;
    inputRef.current  = null;
    setStatus('disconnected');
    setDeviceName(null);
    setCurrentSlot(null);
    setErrorMessage(null);
  }, []);

  const pullPreset = useCallback((slot: number): Promise<GP200Preset> => {
    return new Promise((resolve, reject) => {
      if (!outputRef.current || !inputRef.current) {
        reject(new Error('Not connected'));
        return;
      }
      const chunks: Uint8Array[] = [];
      let attempts = 0;
      let timer: ReturnType<typeof setTimeout>;

      function tryRequest() {
        chunks.length = 0;
        timer = setTimeout(() => {
          if (attempts < 1) {
            attempts++;
            tryRequest();
          } else {
            (inputRef.current as MIDIInput).onmidimessage = onMidiMessage as EventListener;
            reject(new Error('Read timeout'));
          }
        }, READ_TIMEOUT_MS);

        (inputRef.current as MIDIInput).onmidimessage = ((event: MIDIMessageEvent) => {
          const data = new Uint8Array(event.data.buffer ?? event.data);
          // Also pass to persistent handler
          onMidiMessage(event);
          if (isSysEx(data, 0x12, 0x18) && data[10] === slot) {
            chunks.push(data);
            if (chunks.length === 7) {
              clearTimeout(timer);
              (inputRef.current as MIDIInput).onmidimessage = onMidiMessage as EventListener;
              try { resolve(SysExCodec.parseReadChunks(chunks)); }
              catch (e) { reject(e); }
            }
          }
        }) as EventListener;

        outputRef.current!.send(SysExCodec.buildReadRequest(slot));
      }

      tryRequest();
    });
  }, [onMidiMessage]);

  const pushPreset = useCallback(async (preset: GP200Preset, slot: number): Promise<void> => {
    if (!outputRef.current) throw new Error('Not connected');
    const chunks = SysExCodec.buildWriteChunks(preset, slot);
    for (const chunk of chunks) {
      outputRef.current.send(chunk);
      // Small delay between chunks to avoid MIDI buffer overflow
      await new Promise(r => setTimeout(r, 20));
    }
  }, []);

  const loadPresetNames = useCallback(async (): Promise<void> => {
    if (!outputRef.current || !inputRef.current) return;
    const names = new Array<string | null>(256).fill(null);
    for (let slot = 0; slot < 256; slot++) {
      const name = await new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), READ_TIMEOUT_MS);
        (inputRef.current as MIDIInput).onmidimessage = ((event: MIDIMessageEvent) => {
          const data = new Uint8Array(event.data.buffer ?? event.data);
          onMidiMessage(event);
          if (isSysEx(data, 0x12, 0x18) && data[10] === slot) {
            const off = data[11] | (data[12] << 8);
            if (off === 0) { // first chunk contains name
              clearTimeout(timer);
              (inputRef.current as MIDIInput).onmidimessage = onMidiMessage as EventListener;
              resolve(SysExCodec.parsePresetName(data));
            }
          }
        }) as EventListener;
        outputRef.current!.send(SysExCodec.buildReadRequest(slot));
      });
      names[slot] = name;
      setPresetNames([...names]);
      setNamesLoadProgress(slot + 1);
    }
    (inputRef.current as MIDIInput).onmidimessage = onMidiMessage as EventListener;
  }, [onMidiMessage]);

  return {
    status, errorMessage, deviceName, currentSlot, presetNames, namesLoadProgress,
    connect, disconnect, loadPresetNames, pullPreset, pushPreset,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/unit/useMidiDevice.test.ts
```
Expected: PASS

- [ ] **Step 5: Run all unit tests**

```bash
npm run test
```
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useMidiDevice.ts tests/unit/useMidiDevice.test.ts
git commit -m "feat: useMidiDevice hook (Web MIDI connect/pull/push)"
```

---

## Task 7: DeviceStatusBar component

**Files:**
- Create: `src/components/DeviceStatusBar.tsx`

The component renders a single row: LED indicator + status text + (when connected) Pull/Push buttons. Uses `useTranslations('device')` for all strings.

- [ ] **Step 1: Create the component**

```typescript
// src/components/DeviceStatusBar.tsx
'use client';
import { useTranslations } from 'next-intl';
import type { UseMidiDeviceReturn } from '@/hooks/useMidiDevice';
import { SysExCodec } from '@/core/SysExCodec';

interface DeviceStatusBarProps {
  midiDevice: UseMidiDeviceReturn;
  currentPresetName: string | null;
  hasPreset: boolean;
  onPullRequest: () => void;
  onPushRequest: () => void;
}

export function DeviceStatusBar({
  midiDevice,
  currentPresetName,
  hasPreset,
  onPullRequest,
  onPushRequest,
}: DeviceStatusBarProps) {
  const t = useTranslations('device');
  const { status, errorMessage, currentSlot, connect, disconnect } = midiDevice;

  const ledColor =
    status === 'connected'   ? 'var(--accent-green)' :
    status === 'connecting'  ? 'var(--accent-amber)' :
    status === 'error'       ? 'var(--accent-red)'   :
    '#555';

  const slotLabel = currentSlot !== null ? SysExCodec.slotToLabel(currentSlot) : '—';
  const slotName  = currentSlot !== null && midiDevice.presetNames[currentSlot]
    ? ` »${midiDevice.presetNames[currentSlot]}«`
    : currentPresetName ? ` »${currentPresetName}«` : '';

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm"
      style={{
        border: `1px solid ${status === 'connected' ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)'}`,
        background: status === 'connected' ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)',
      }}
      data-testid="device-status-bar"
    >
      {/* LED */}
      <span
        style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: ledColor,
          boxShadow: status === 'connected' ? `0 0 6px ${ledColor}` :
                     status === 'connecting' ? `0 0 6px ${ledColor}` : 'none',
          animation: status === 'connecting' ? 'pulse 1s infinite' : 'none',
        }}
      />

      {/* Status text */}
      {status === 'disconnected' && (
        <span className="font-mono-display" style={{ color: 'var(--text-muted)' }}>
          {t('noDevice')}
        </span>
      )}
      {status === 'connecting' && (
        <span className="font-mono-display" style={{ color: 'var(--accent-amber)' }}>
          {t('connecting')}
        </span>
      )}
      {status === 'connected' && (
        <span className="font-mono-display" style={{ color: 'var(--accent-green)', fontSize: '0.8em' }}>
          GP-200
          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
            · Slot <strong style={{ color: 'var(--accent-amber)' }}>{slotLabel}</strong>
            {slotName}
          </span>
        </span>
      )}
      {status === 'error' && (
        <span className="font-mono-display" style={{ color: 'var(--accent-red)', fontSize: '0.8em' }}>
          {errorMessage ?? t('error')}
        </span>
      )}

      {/* Actions */}
      <div className="ml-auto flex gap-2">
        {status === 'disconnected' && !('requestMIDIAccess' in navigator) && (
          <span className="font-mono-display" style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>
            {t('chromeOnly')}
          </span>
        )}
        {status === 'disconnected' && 'requestMIDIAccess' in navigator && (
          <button
            onClick={connect}
            className="font-mono-display text-xs font-bold uppercase px-3 py-1 rounded"
            style={{ border: '1px solid rgba(212,162,78,0.4)', color: 'var(--accent-amber)', background: 'transparent' }}
          >
            {t('connect')}
          </button>
        )}
        {status === 'error' && (
          <button
            onClick={connect}
            className="font-mono-display text-xs font-bold uppercase px-3 py-1 rounded"
            style={{ border: '1px solid rgba(255,80,80,0.4)', color: 'var(--accent-red)', background: 'transparent' }}
          >
            {t('retry')}
          </button>
        )}
        {status === 'connected' && (
          <>
            <button
              onClick={onPullRequest}
              className="font-mono-display text-xs font-bold px-3 py-1 rounded"
              style={{ border: '1px solid rgba(212,162,78,0.4)', color: 'var(--accent-amber)', background: 'rgba(212,162,78,0.06)' }}
            >
              {t('pull')}
            </button>
            <button
              onClick={onPushRequest}
              disabled={!hasPreset}
              className="font-mono-display text-xs font-bold px-3 py-1 rounded disabled:opacity-40"
              style={{ border: '1px solid rgba(212,162,78,0.4)', color: 'var(--accent-amber)', background: 'rgba(212,162,78,0.06)' }}
            >
              {t('push')}
            </button>
            <button
              onClick={disconnect}
              className="font-mono-display text-xs px-2 py-1 rounded"
              style={{ color: 'var(--text-muted)', opacity: 0.5 }}
            >
              ×
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run all tests (no unit tests for this component)**

```bash
npm run test
```
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/DeviceStatusBar.tsx
git commit -m "feat: DeviceStatusBar component"
```

---

## Task 8: DeviceSlotBrowser component

**Files:**
- Create: `src/components/DeviceSlotBrowser.tsx`

Modal showing 256 slots in 64 rows of 4 (1A–64D). Supports search by name, keyboard navigation, progress bar while loading names.

- [ ] **Step 1: Create the component**

```typescript
// src/components/DeviceSlotBrowser.tsx
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { SysExCodec } from '@/core/SysExCodec';

interface DeviceSlotBrowserProps {
  mode: 'pull' | 'push';
  presetNames: (string | null)[];
  namesLoadProgress: number;
  currentSlot: number | null;
  onConfirm: (slot: number) => void;
  onCancel: () => void;
}

export function DeviceSlotBrowser({
  mode,
  presetNames,
  namesLoadProgress,
  currentSlot,
  onConfirm,
  onCancel,
}: DeviceSlotBrowserProps) {
  const t = useTranslations('device');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number | null>(currentSlot);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && selected !== null) onConfirm(selected);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm, selected]);

  // Filter: build a Set of visible slots
  const filteredSlots = useCallback((): Set<number> => {
    if (!search.trim()) return new Set(Array.from({ length: 256 }, (_, i) => i));
    const q = search.toLowerCase();
    const result = new Set<number>();
    for (let s = 0; s < 256; s++) {
      const name = presetNames[s] ?? '';
      const label = SysExCodec.slotToLabel(s);
      if (name.toLowerCase().includes(q) || label.toLowerCase().includes(q)) result.add(s);
    }
    return result;
  }, [search, presetNames]);

  const visible = filteredSlots();
  const confirmLabel = selected !== null
    ? mode === 'pull'
      ? t('pullFrom', { slot: SysExCodec.slotToLabel(selected) })
      : t('pushTo',   { slot: SysExCodec.slotToLabel(selected) })
    : mode === 'pull' ? t('pull') : t('push');

  // 64 banks, each with A/B/C/D
  const banks = Array.from({ length: 64 }, (_, bank) =>
    Array.from({ length: 4 }, (__, letter) => bank * 4 + letter)
  ).filter(row => row.some(s => visible.has(s)));

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="flex flex-col rounded-xl overflow-hidden"
        style={{
          width: 'min(600px, 95vw)',
          maxHeight: '80vh',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-active)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-active)' }}>
          <span className="font-mono-display font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('browserTitle')}
          </span>
          {namesLoadProgress < 256 && (
            <div className="flex-1 h-1 rounded-full overflow-hidden ml-4" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(namesLoadProgress / 256) * 100}%`, background: 'var(--accent-amber)' }}
              />
            </div>
          )}
          <button onClick={onCancel} className="ml-auto" style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Search */}
        <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border-active)' }}>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            className="w-full bg-transparent font-mono-display text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        {/* Slot grid */}
        <div className="overflow-y-auto flex-1 p-2">
          {banks.map((row) => {
            const bankNum = Math.floor(row[0] / 4) + 1;
            return (
              <div
                key={bankNum}
                className="grid grid-cols-4 rounded mb-1 overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {row.map((slot) => {
                  const isSelected = selected === slot;
                  const isCurrent  = currentSlot === slot;
                  const isVisible  = visible.has(slot);
                  const name = presetNames[slot];
                  const label = SysExCodec.slotToLabel(slot);
                  if (!isVisible) return (
                    <div key={slot} style={{ opacity: 0.15, padding: '6px 8px' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.65em', color: 'var(--text-muted)' }}>{label}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.7em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {name ?? '…'}
                      </div>
                    </div>
                  );
                  return (
                    <button
                      key={slot}
                      onClick={() => setSelected(slot)}
                      onDoubleClick={() => onConfirm(slot)}
                      style={{
                        padding: '6px 8px',
                        textAlign: 'left',
                        background: isSelected ? 'rgba(212,162,78,0.18)' : isCurrent ? 'rgba(212,162,78,0.07)' : 'transparent',
                        borderRight: '1px solid rgba(255,255,255,0.06)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        fontFamily: 'monospace', fontSize: '0.65em',
                        color: isSelected ? 'var(--accent-amber)' : 'var(--text-muted)',
                        marginBottom: 2,
                      }}>
                        {label}{isCurrent ? ' ◀' : ''}
                      </div>
                      <div style={{
                        fontFamily: 'monospace', fontSize: '0.7em',
                        color: isSelected ? 'var(--accent-amber)' : 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {name ?? (namesLoadProgress < 256 ? '…' : '—')}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--border-active)' }}>
          <button
            onClick={onCancel}
            className="font-mono-display text-sm px-4 py-2 rounded"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-muted)' }}
          >
              {t('cancel')}
          </button>
          <button
            onClick={() => { if (selected !== null) onConfirm(selected); }}
            disabled={selected === null}
            className="font-mono-display text-sm font-bold px-4 py-2 rounded disabled:opacity-40"
            style={{
              border: '1px solid var(--accent-amber)',
              color: 'var(--accent-amber)',
              background: 'rgba(212,162,78,0.1)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run all tests**

```bash
npm run test
```
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/DeviceSlotBrowser.tsx
git commit -m "feat: DeviceSlotBrowser modal (256 slots, 4-pack, search)"
```

---

## Task 9: Editor integration

**Files:**
- Modify: `src/app/[locale]/editor/page.tsx`

Wire `useMidiDevice`, `DeviceStatusBar`, and `DeviceSlotBrowser` into the editor page. Add `slotBrowserMode` state. Connect pull/push callbacks.

- [ ] **Step 1: Update editor/page.tsx**

Add these imports at the top:
```typescript
import { useMidiDevice } from '@/hooks/useMidiDevice';
import { DeviceStatusBar } from '@/components/DeviceStatusBar';
import { DeviceSlotBrowser } from '@/components/DeviceSlotBrowser';
```

Add inside `EditorPage()`, after the existing `const { preset, ... } = usePreset()` line:
```typescript
const midiDevice = useMidiDevice();
const [slotBrowserMode, setSlotBrowserMode] = useState<'pull' | 'push' | null>(null);
```

Add these handler functions (after `handleSaveToPresets`):
```typescript
async function handlePullConfirm(slot: number) {
  try {
    const loaded = await midiDevice.pullPreset(slot);
    loadPreset(loaded);
  } catch {
    alert(t('loadError')); // t is useTranslations('editor') — 'editor.loadError' exists
  } finally {
    setSlotBrowserMode(null);
  }
}

async function handlePushConfirm(slot: number) {
  if (!preset) return;
  try {
    await midiDevice.pushPreset(preset, slot);
  } catch {
    alert('Push fehlgeschlagen');
  } finally {
    setSlotBrowserMode(null);
  }
}

function handleOpenBrowser(mode: 'pull' | 'push') {
  setSlotBrowserMode(mode);
  if (midiDevice.presetNames.every(n => n === null)) {
    midiDevice.loadPresetNames();
  }
}
```

In the JSX, after the patch name header `<div>` and before the signal chain `<div>`, add:
```tsx
<DeviceStatusBar
  midiDevice={midiDevice}
  currentPresetName={preset?.patchName ?? null}
  hasPreset={!!preset}
  onPullRequest={() => handleOpenBrowser('pull')}
  onPushRequest={() => handleOpenBrowser('push')}
/>
```

At the very bottom of the returned JSX (after the action buttons `</div>` but inside the outer `</div>`), add:
```tsx
{slotBrowserMode && (
  <DeviceSlotBrowser
    mode={slotBrowserMode}
    presetNames={midiDevice.presetNames}
    namesLoadProgress={midiDevice.namesLoadProgress}
    currentSlot={midiDevice.currentSlot}
    onConfirm={slotBrowserMode === 'pull' ? handlePullConfirm : handlePushConfirm}
    onCancel={() => setSlotBrowserMode(null)}
  />
)}
```

Also add `DeviceStatusBar` to the pre-load screen (when `!preset`), after `<FileUpload>`:
```tsx
<div className="mt-4">
  <DeviceStatusBar
    midiDevice={midiDevice}
    currentPresetName={null}
    hasPreset={false}
    onPullRequest={() => handleOpenBrowser('pull')}
    onPushRequest={() => {}}
  />
</div>
```

- [ ] **Step 2: Run all unit tests**

```bash
npm run test
```
Expected: All tests pass

- [ ] **Step 3: Build to check TypeScript**

```bash
npm run build
```
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 4: Manual smoke test (requires Chrome + GP-200 connected)**

1. Open `http://localhost:3000/editor`
2. The DeviceStatusBar should appear below "Patch Name" on the upload screen
3. Click "Verbinden" — browser shows MIDI permission prompt
4. Accept — status changes to "GP-200 · Slot XX"
5. Click "← Pull" — slot browser opens, names begin loading (progress bar visible)
6. Select a slot, click "Pull von XA" — editor loads the preset
7. Edit something, click "Push →", select a target slot — push should complete silently
8. On the device, navigate to that slot — it should play the modified preset

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/editor/page.tsx
git commit -m "feat: integrate Web MIDI device sync into editor (Issue #6)"
```

---

## Notes for implementers

**Known unknowns to validate on first hardware test:**
1. `currentSlot` from sub=0x4E at `payload[1]` — assumed, not verified in captures. If it's wrong, `currentSlot` will be `null` and the auto-sync display won't work (harmless fallback). Add a `console.log` during first hardware test.
2. The 36-byte write header template — the `0x27` marker positions are confirmed but bytes 22–35 are assumed to be zeros. If push doesn't work, decode a fresh Windows-capture write payload and compare headers using `scripts/analyze-sysex.py`.
3. Inter-chunk delay for push (20ms) — may need tuning. If push drops chunks, increase to 50ms.

**Write header extraction (if needed):**
```bash
python3 scripts/analyze-sysex.py /home/manuel/gp200-capture-windows.pcap 2>/dev/null | head -40
```
This shows the decoded write payload. The first 36 bytes are the write header template.
