import { describe, it, expect } from 'vitest';
import { SysExCodec } from '@/core/SysExCodec';
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
  const parts = [HEADER, [slot, offLo, offHi], Array.from(nibbleData), [0xF7]];
  return new Uint8Array(parts.flat());
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
    for (let i = 0; i < encoded.length; i++) {
      expect(encoded[i]).toBeLessThanOrEqual(0x0F);
    }
  });
});

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

  it('returns exactly 7 chunks', () => {
    const chunks = SysExCodec.buildWriteChunks(samplePreset, 5);
    expect(chunks).toHaveLength(7);
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

  it('chunks decode to 1184 bytes total', () => {
    const chunks = SysExCodec.buildWriteChunks(samplePreset, 0);
    // Each chunk: [10-byte header][slot:1][offLo:1][offHi:1][nibbleData...][F7:1]
    const nibbles = chunks.flatMap(c => Array.from(c.slice(13, c.length - 1)));
    const decoded = SysExCodec.nibbleDecode(new Uint8Array(nibbles));
    expect(decoded.length).toBe(1184);
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
