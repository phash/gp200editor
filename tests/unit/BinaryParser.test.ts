import { describe, it, expect } from 'vitest';
import { BinaryParser } from '@/core/BinaryParser';

describe('BinaryParser', () => {
  const buf = new Uint8Array([0x47, 0x50, 0x00, 0x0a, 0x41, 0x42]);

  it('reads a single byte at offset', () => {
    const p = new BinaryParser(buf);
    expect(p.readUint8(0)).toBe(0x47);
    expect(p.readUint8(1)).toBe(0x50);
  });

  it('reads a fixed-length ASCII string', () => {
    const p = new BinaryParser(buf);
    expect(p.readAscii(0, 2)).toBe('GP');
  });

  it('reads a uint16 little-endian', () => {
    // bytes [0x47, 0x50] → 0x5047
    const p = new BinaryParser(buf);
    expect(p.readUint16LE(0)).toBe(0x5047);
  });

  it('throws RangeError on out-of-bounds uint8 read', () => {
    const p = new BinaryParser(buf);
    expect(() => p.readUint8(100)).toThrow(RangeError);
  });

  it('throws RangeError when readUint16LE spans past end of buffer', () => {
    const p = new BinaryParser(buf); // length 6
    expect(() => p.readUint16LE(5)).toThrow(RangeError); // needs 2 bytes, only 1 left
  });

  it('throws RangeError when readAscii spans past end of buffer', () => {
    const p = new BinaryParser(buf); // length 6
    expect(() => p.readAscii(4, 10)).toThrow(RangeError);
  });
});
