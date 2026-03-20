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
  it('returns a 46-byte SysEx message with correct framing', () => {
    const req = SysExCodec.buildReadRequest(0);
    expect(req.length).toBe(46);
    expect(req[0]).toBe(0xF0);
    expect(req[8]).toBe(0x11);
    expect(req[9]).toBe(0x10);
    expect(req[45]).toBe(0xF7);
  });

  it('slot 0 matches capture exactly', () => {
    const req = SysExCodec.buildReadRequest(0);
    const expected = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x11, 0x10,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00,
      0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0xF7,
    ]);
    expect(req).toEqual(expected);
  });

  it('slot 1: nibble-encoded at [25-26], [37-38], [41-42]', () => {
    const req = SysExCodec.buildReadRequest(1);
    expect(req[25]).toBe(0x00); expect(req[26]).toBe(0x01);
    expect(req[37]).toBe(0x00); expect(req[38]).toBe(0x01);
    expect(req[41]).toBe(0x00); expect(req[42]).toBe(0x01);
  });

  it('slot 254 (0xFE): nibble-encoded as 0F 0E', () => {
    const req = SysExCodec.buildReadRequest(254);
    expect(req[25]).toBe(0x0F); expect(req[26]).toBe(0x0E);
    expect(req[37]).toBe(0x0F); expect(req[38]).toBe(0x0E);
    expect(req[41]).toBe(0x0F); expect(req[42]).toBe(0x0E);
  });

  it('slot 255 (0xFF): nibble-encoded as 0F 0F', () => {
    const req = SysExCodec.buildReadRequest(255);
    expect(req[25]).toBe(0x0F); expect(req[26]).toBe(0x0F);
    expect(req[37]).toBe(0x0F); expect(req[38]).toBe(0x0F);
    expect(req[41]).toBe(0x0F); expect(req[42]).toBe(0x0F);
  });

  it('constants are correct for all slots', () => {
    for (const slot of [0, 1, 127, 254, 255]) {
      const req = SysExCodec.buildReadRequest(slot);
      for (let i = 10; i <= 17; i++) expect(req[i]).toBe(0x00);
      expect(req[18]).toBe(0x04);
      expect(req[22]).toBe(0x01); expect(req[23]).toBe(0x00);
      expect(req[30]).toBe(0x01); expect(req[31]).toBe(0x00);
      expect(req[34]).toBe(0x04);
    }
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

describe('SysExCodec: handshake builders', () => {
  it('buildIdentityQuery returns exact 22-byte message', () => {
    const msg = SysExCodec.buildIdentityQuery();
    expect(msg).toEqual(new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x11, 0x04,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xF7,
    ]));
  });

  it('buildEnterEditorMode returns exact 14-byte message', () => {
    const msg = SysExCodec.buildEnterEditorMode();
    expect(msg).toEqual(new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x11, 0x12,
      0x00, 0x00, 0x00,
      0xF7,
    ]));
  });

  it('buildStateDumpRequest returns exact 22-byte message', () => {
    const msg = SysExCodec.buildStateDumpRequest();
    expect(msg).toEqual(new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x11, 0x04,
      0x00, 0x00, 0x00, 0x00, 0x06, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xF7,
    ]));
  });

  it('buildVersionCheck returns exact 34-byte message', () => {
    const msg = SysExCodec.buildVersionCheck();
    expect(msg).toEqual(new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x11, 0x0A,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x06, 0x00, 0x00,
      0x0D, 0x04, 0x0F, 0x07, 0x08, 0x0B, 0x00, 0x00, 0x0C, 0x0B, 0x04, 0x05,
      0xF7,
    ]));
  });

  it('buildAssignmentQuery section 0 page 0 block 0 is 70 bytes', () => {
    const msg = SysExCodec.buildAssignmentQuery(0, 0, 0);
    expect(msg.length).toBe(70);
    expect(msg[0]).toBe(0xF0);
    expect(msg[8]).toBe(0x11);
    expect(msg[9]).toBe(0x1C);
    expect(msg[10]).toBe(0x00);
    expect(msg[14]).toBe(0x09);
    expect(msg[22]).toBe(0x00);
    expect(msg[69]).toBe(0xF7);
  });

  it('buildAssignmentQuery increments block byte', () => {
    const msg5 = SysExCodec.buildAssignmentQuery(0, 0, 5);
    expect(msg5[22]).toBe(0x05);
    const msgF = SysExCodec.buildAssignmentQuery(0, 0, 15);
    expect(msgF[22]).toBe(0x0F);
  });

  it('buildAssignmentQuery page 1 sets page byte at [21]', () => {
    const msg = SysExCodec.buildAssignmentQuery(0, 1, 0);
    expect(msg[21]).toBe(0x01);
  });

  it('buildAssignmentQuery section 1 uses different header', () => {
    const msg = SysExCodec.buildAssignmentQuery(1, 0, 0);
    expect(msg[13]).toBe(0x01);
    expect(msg[14]).toBe(0x02);
  });
});

describe('SysExCodec: handshake parsers', () => {
  it('parseIdentityResponse extracts device info from capture', () => {
    const msg = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x12, 0x08,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00, 0x00,
      0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x00,
      0xF7,
    ]);
    const info = SysExCodec.parseIdentityResponse(msg);
    expect(info.deviceType).toBe(0x04);
    // Identity response bytes [22]/[26] are NOT firmware version (always 1.2 regardless of FW)
    expect(info.firmwareValues).toEqual([]);
  });

  it('parseVersionResponse: all-zero nibble data → accepted', () => {
    const msg = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x12, 0x0A,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x06, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xF7,
    ]);
    expect(SysExCodec.parseVersionResponse(msg)).toEqual({ accepted: true });
  });

  it('parseVersionResponse: non-zero nibble data → not accepted', () => {
    const msg = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32,
      0x12, 0x0A,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x06, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xF7,
    ]);
    expect(SysExCodec.parseVersionResponse(msg)).toEqual({ accepted: false });
  });

  it('parseAssignmentResponse extracts cab name from capture block 0', () => {
    // Exact bytes from capture response (D→H sub=0x1C, block 0)
    const msg = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x12, 0x1C,
      0x00, 0x00, 0x00, 0x00, 0x09, 0x01, 0x00, 0x01, 0x08,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x05, 0x09, 0x04, 0x01, 0x02, 0x00,
      0x04, 0x08, 0x05, 0x07, 0x04, 0x01,
      0x05, 0x04, 0x02, 0x00,
      0x03, 0x04, 0x03, 0x01, 0x03, 0x02, 0x02, 0x00,
      0x04, 0x06, 0x04, 0x0E, 0x03, 0x05,
      0x00, 0x00,
      0xF7,
    ]);
    const entry = SysExCodec.parseAssignmentResponse(msg, 0, 0);
    expect(entry.section).toBe(0);
    expect(entry.page).toBe(0);
    expect(entry.block).toBe(0);
    expect(entry.name).toBe('YA HWAT 412 FN5');
  });
});

describe('SysExCodec: parseStateDump', () => {
  it('always returns slot 0 (byte[10] is NOT the slot)', () => {
    // byte[10] is consistently 0x06 in real captures regardless of active slot
    const fakeChunk = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x12, 0x4E,
      0x06, // NOT the slot — always 0x06
      0x00, 0x00,
      0x00, 0x00,
      0xF7,
    ]);
    const result = SysExCodec.parseStateDump([fakeChunk]);
    expect(result.slot).toBe(0);
  });

  it('defaults to slot 0 when no chunks provided', () => {
    const result = SysExCodec.parseStateDump([]);
    expect(result.slot).toBe(0);
  });
});

describe('SysExCodec: buildToggleEffect', () => {
  it('returns a 46-byte SysEx with CMD=0x12, sub=0x10', () => {
    const msg = SysExCodec.buildToggleEffect(0, true);
    expect(msg.length).toBe(46);
    expect(msg[0]).toBe(0xF0);
    expect(msg[8]).toBe(0x12);
    expect(msg[9]).toBe(0x10);
    expect(msg[45]).toBe(0xF7);
  });

  it('WAH OFF matches capture (gp200-capture-20260319-100548)', () => {
    const msg = SysExCodec.buildToggleEffect(1, false);
    expect(msg[38]).toBe(1);   // WAH block index
    expect(msg[40]).toBe(0);   // OFF
    // Verify full message against captured bytes
    const expected = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x12, 0x10,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
      0x05, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00,
      0x00, 0x09, 0x0C, 0x00, 0x02, 0xF7,
    ]);
    expect(msg).toEqual(expected);
  });

  it('AMP ON matches capture (gp200-capture-20260319-101538)', () => {
    const msg = SysExCodec.buildToggleEffect(3, true);
    expect(msg[38]).toBe(3);   // AMP block index
    expect(msg[40]).toBe(1);   // ON
    const expected = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x12, 0x10,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
      0x05, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x03, 0x00,
      0x01, 0x09, 0x0C, 0x00, 0x02, 0xF7,
    ]);
    expect(msg).toEqual(expected);
  });

  it('sets block index for all 11 blocks', () => {
    for (let b = 0; b <= 10; b++) {
      const msg = SysExCodec.buildToggleEffect(b, true);
      expect(msg[38]).toBe(b);
      expect(msg[40]).toBe(1);
    }
  });
});

describe('SysExCodec: buildParamChange', () => {
  it('returns a 62-byte SysEx with CMD=0x12, sub=0x18', () => {
    const msg = SysExCodec.buildParamChange(8, 0, 0x0B000004, 50.0);
    expect(msg.length).toBe(62);
    expect(msg[0]).toBe(0xF0);
    expect(msg[8]).toBe(0x12);
    expect(msg[9]).toBe(0x18);
    expect(msg[61]).toBe(0xF7);
  });

  it('nibble-decoded payload has correct block, param, effectId, value', () => {
    // DLY Ping Pong, Mix = 43.0
    const msg = SysExCodec.buildParamChange(8, 0, 0x0B000004, 43.0);
    const nibbles = msg.slice(13, 61);
    const decoded = SysExCodec.nibbleDecode(nibbles);
    expect(decoded.length).toBe(24);
    // Constants
    expect(decoded[2]).toBe(0x04);
    expect(decoded[8]).toBe(0x05);
    expect(decoded[10]).toBe(0x0C);
    expect(decoded[14]).toBe(0x6F);
    // Block + param
    expect(decoded[12]).toBe(8);   // DLY
    expect(decoded[13]).toBe(0);   // Mix
    // EffectId LE bytes
    expect(decoded[16]).toBe(0x04);  // variant low byte
    expect(decoded[17]).toBe(0x00);
    expect(decoded[18]).toBe(0x00);
    expect(decoded[19]).toBe(0x0B);  // module type
    // Float value
    const view = new DataView(decoded.buffer, decoded.byteOffset);
    expect(view.getFloat32(20, true)).toBeCloseTo(43.0, 4);
  });

  it('AMP Mess4 LD Gain=50 matches captured structure', () => {
    // capture 102857: Block=3, Param=0, effectId=0x07000055
    const msg = SysExCodec.buildParamChange(3, 0, 0x07000055, 50.0);
    const decoded = SysExCodec.nibbleDecode(msg.slice(13, 61));
    expect(decoded[12]).toBe(3);    // AMP
    expect(decoded[13]).toBe(0);    // Gain
    expect(decoded[16]).toBe(0x55); // variant
    expect(decoded[19]).toBe(0x07); // AMP module
    const view = new DataView(decoded.buffer, decoded.byteOffset);
    expect(view.getFloat32(20, true)).toBeCloseTo(50.0, 4);
  });

  it('nibble encoding round-trips correctly', () => {
    const msg = SysExCodec.buildParamChange(5, 3, 0x0A000010, 75.5);
    const nibbles = msg.slice(13, 61);
    const decoded = SysExCodec.nibbleDecode(nibbles);
    const reEncoded = SysExCodec.nibbleEncode(decoded);
    expect(reEncoded).toEqual(nibbles);
  });
});

describe('SysExCodec: buildReorderEffects', () => {
  it('returns a 78-byte SysEx with CMD=0x12, sub=0x20', () => {
    const msg = SysExCodec.buildReorderEffects([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(msg.length).toBe(78);
    expect(msg[0]).toBe(0xF0);
    expect(msg[8]).toBe(0x12);
    expect(msg[9]).toBe(0x20);
    expect(msg[77]).toBe(0xF7);
  });

  it('NR↔AMP swap matches capture (gp200-capture-20260319-101714)', () => {
    // Reorder 1: PRE, WAH, BOOST, NR(4), AMP(3), CAB, EQ, MOD, DLY, RVB, VOL
    const msg = SysExCodec.buildReorderEffects([0, 1, 2, 4, 3, 5, 6, 7, 8, 9, 10]);
    // Exact bytes from USB capture gp200-capture-20260319-101714 Pkt 457 (t=35.9s)
    const expected = new Uint8Array([
      0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32, 0x12, 0x20, // [0-9]   header
      0x00, 0x00, 0x00,                                              // [10-12] slot/offset
      0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00,              // [13-20] nibble data
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,              // [21-28]
      0x00, 0x08, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,              // [29-36]
      0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x04,              // [37-44]
      0x00, 0x00, 0x00, 0x01, 0x00, 0x02, 0x00, 0x04,              // [45-52]
      0x00, 0x03, 0x00, 0x05, 0x00, 0x06, 0x00, 0x07,              // [53-60]
      0x00, 0x08, 0x00, 0x09, 0x00, 0x0A, 0x04, 0x04,              // [61-68]
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,              // [69-76]
      0xF7,                                                          // [77]
    ]);
    expect(msg).toEqual(expected);
  });

  it('DLY↔RVB swap produces correct routing at decoded[16:27]', () => {
    const msg = SysExCodec.buildReorderEffects([0, 1, 2, 4, 3, 5, 6, 7, 9, 8, 10]);
    const decoded = SysExCodec.nibbleDecode(msg.slice(13, 77));
    expect(Array.from(decoded.slice(16, 27))).toEqual([0, 1, 2, 4, 3, 5, 6, 7, 9, 8, 10]);
    expect(decoded[27]).toBe(0x44); // terminator
  });

  it('default order has sequential indices', () => {
    const msg = SysExCodec.buildReorderEffects([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const decoded = SysExCodec.nibbleDecode(msg.slice(13, 77));
    expect(Array.from(decoded.slice(16, 27))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe('SysExCodec: buildAuthorName', () => {
  it('produces 78-byte SysEx with correct structure', () => {
    const msg = SysExCodec.buildAuthorName('Manuel');
    expect(msg.length).toBe(78);
    expect(msg[0]).toBe(0xF0);
    expect(msg[8]).toBe(0x12); // CMD
    expect(msg[9]).toBe(0x20); // sub
    expect(msg[77]).toBe(0xF7);
  });

  it('encodes author name at decoded[16]', () => {
    const msg = SysExCodec.buildAuthorName('Manuel');
    const decoded = SysExCodec.nibbleDecode(msg.slice(13, 77));
    expect(decoded[8]).toBe(0x09); // msg type: author
    expect(decoded[16]).toBe('M'.charCodeAt(0));
    expect(decoded[17]).toBe('a'.charCodeAt(0));
    expect(decoded[18]).toBe('n'.charCodeAt(0));
    expect(decoded[19]).toBe('u'.charCodeAt(0));
    expect(decoded[20]).toBe('e'.charCodeAt(0));
    expect(decoded[21]).toBe('l'.charCodeAt(0));
    expect(decoded[22]).toBe(0); // null terminated
  });

  it('truncates author to 16 chars', () => {
    const msg = SysExCodec.buildAuthorName('A'.repeat(20));
    const decoded = SysExCodec.nibbleDecode(msg.slice(13, 77));
    for (let i = 0; i < 16; i++) expect(decoded[16 + i]).toBe('A'.charCodeAt(0));
  });
});

describe('SysExCodec: buildStyleName', () => {
  it('produces 62-byte SysEx with correct structure', () => {
    const msg = SysExCodec.buildStyleName('Green Day');
    expect(msg.length).toBe(62);
    expect(msg[0]).toBe(0xF0);
    expect(msg[8]).toBe(0x12);
    expect(msg[9]).toBe(0x18);
    expect(msg[61]).toBe(0xF7);
  });

  it('encodes style name at decoded[8]', () => {
    const msg = SysExCodec.buildStyleName('Rock');
    const decoded = SysExCodec.nibbleDecode(msg.slice(13, 61));
    expect(decoded[0]).toBe(0x03); // style header
    expect(decoded[1]).toBe(0x20);
    expect(decoded[8]).toBe('R'.charCodeAt(0));
    expect(decoded[9]).toBe('o'.charCodeAt(0));
    expect(decoded[10]).toBe('c'.charCodeAt(0));
    expect(decoded[11]).toBe('k'.charCodeAt(0));
    expect(decoded[12]).toBe(0);
  });
});

describe('SysExCodec: buildNote', () => {
  it('produces 126-byte SysEx with correct structure', () => {
    const msg = SysExCodec.buildNote('TestNote');
    expect(msg.length).toBe(126);
    expect(msg[0]).toBe(0xF0);
    expect(msg[8]).toBe(0x12);
    expect(msg[9]).toBe(0x38);
    expect(msg[125]).toBe(0xF7);
  });

  it('encodes note text at decoded[16]', () => {
    const msg = SysExCodec.buildNote('TestNote');
    const decoded = SysExCodec.nibbleDecode(msg.slice(13, 125));
    expect(decoded[8]).toBe(0x0B); // msg type: note
    expect(decoded[16]).toBe('T'.charCodeAt(0));
    expect(decoded[17]).toBe('e'.charCodeAt(0));
    expect(decoded[18]).toBe('s'.charCodeAt(0));
    expect(decoded[19]).toBe('t'.charCodeAt(0));
    expect(decoded[20]).toBe('N'.charCodeAt(0));
    expect(decoded[21]).toBe('o'.charCodeAt(0));
    expect(decoded[22]).toBe('t'.charCodeAt(0));
    expect(decoded[23]).toBe('e'.charCodeAt(0));
    expect(decoded[24]).toBe(0);
  });
});

describe('SysExCodec: author in read/write chunks', () => {
  it('parsePresetFromDecoded reads author from decoded[44:60]', () => {
    // Build a minimal decoded payload (912+ bytes)
    const decoded = new Uint8Array(920).fill(0);
    // Name at [28:44]
    'TestName'.split('').forEach((c, i) => { decoded[28 + i] = c.charCodeAt(0); });
    // Author at [44:60]
    'TestAuthor'.split('').forEach((c, i) => { decoded[44 + i] = c.charCodeAt(0); });
    // Effect blocks at [120:912] — need markers
    for (let b = 0; b < 11; b++) {
      const base = 120 + b * 72;
      decoded[base] = 0x14; decoded[base + 2] = 0x44;
      decoded[base + 4] = b;
    }
    const preset = SysExCodec.parsePresetFromDecoded(decoded);
    expect(preset.patchName).toBe('TestName');
    expect(preset.author).toBe('TestAuthor');
  });

  it('buildWriteChunks includes author in payload', () => {
    const preset = {
      version: '1', patchName: 'Test', author: 'Author1', checksum: 0,
      effects: Array.from({ length: 11 }, (_, i) => ({ slotIndex: i, effectId: 0, enabled: false, params: Array(15).fill(0) })),
    };
    const chunks = SysExCodec.buildWriteChunks(preset, 0);
    // Reassemble all chunks to get the full write payload
    const decoded = SysExCodec.assembleChunks(chunks);
    // Write payload: author at [52:68] (read payload has it at [44:60], +8 offset for write header)
    let author = '';
    for (let i = 0; i < 16; i++) {
      if (decoded[52 + i] === 0) break;
      author += String.fromCharCode(decoded[52 + i]);
    }
    expect(author).toBe('Author1');
  });
});
