import { describe, it, expect } from 'vitest';
import { PRSTDecoder, PRST_MAGIC } from '@/core/PRSTDecoder';

/** Creates a minimal test buffer with known content */
function buildTestBuffer(): Uint8Array {
  const buf = new Uint8Array(512).fill(0);
  // Magic-Header "PRST" (placeholder — real bytes TBD)
  buf[0] = 0x50; buf[1] = 0x52; buf[2] = 0x53; buf[3] = 0x54; // "PRST"
  // Version (placeholder offset 4)
  buf[4] = 0x01;
  // Patch name at offset 8, max 12 bytes (placeholder)
  'TestPatch'.split('').forEach((c, i) => { buf[8 + i] = c.charCodeAt(0); });
  return buf;
}

describe('PRSTDecoder', () => {
  it('erkennt den Magic-Header', () => {
    const buf = buildTestBuffer();
    const decoder = new PRSTDecoder(buf);
    expect(decoder.hasMagic()).toBe(true);
  });

  it('hasMagic() gibt false zurück bei leerem Buffer', () => {
    const empty = new Uint8Array(512).fill(0);
    const decoder = new PRSTDecoder(empty);
    expect(decoder.hasMagic()).toBe(false);
  });

  it('liest den Patch-Namen', () => {
    const buf = buildTestBuffer();
    const decoder = new PRSTDecoder(buf);
    expect(decoder.decode().patchName).toBe('TestPatch');
  });

  it('wirft bei ungültigem Magic', () => {
    const bad = new Uint8Array(512).fill(0);
    const decoder = new PRSTDecoder(bad);
    expect(() => decoder.decode()).toThrow('Invalid .prst file');
  });
});
