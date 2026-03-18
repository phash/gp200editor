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
