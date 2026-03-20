import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PRSTDecoder, PRST_MAGIC } from '@/core/PRSTDecoder';

/** Builds a minimal valid test buffer matching the real .prst format */
function buildTestBuffer(): Uint8Array {
  const buf = new Uint8Array(1224).fill(0);
  // Magic "TSRP" at 0x00
  buf[0x00] = 0x54; buf[0x01] = 0x53; buf[0x02] = 0x52; buf[0x03] = 0x50;
  // Version at 0x15
  buf[0x15] = 0x01;
  // Patch name at 0x44
  'TestPatch'.split('').forEach((c, i) => { buf[0x44 + i] = c.charCodeAt(0); });
  // 11 effect blocks: marker 14 00 44 00 + slot index + bypass
  for (let slot = 0; slot < 11; slot++) {
    const base = 0xa0 + slot * 0x48;
    buf[base + 0] = 0x14; buf[base + 1] = 0x00; buf[base + 2] = 0x44; buf[base + 3] = 0x00;
    buf[base + 4] = slot;  // slot index
    buf[base + 5] = 0x00;  // bypassed
  }
  return buf;
}

/** Builds a buffer with known float32 param values at slot 0 */
function buildTestBufferWithParams(): Uint8Array {
  const buf = buildTestBuffer();
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // Write float32 LE values into slot 0 params (offset 0xa0 + 0x0c = 0xac)
  const base = 0xa0 + 0x0c;
  view.setFloat32(base + 0, 50.0, true);
  view.setFloat32(base + 4, 25.5, true);
  view.setFloat32(base + 8, 100.0, true);
  return buf;
}

describe('PRSTDecoder', () => {
  it('PRST_MAGIC ist "TSRP"', () => {
    expect(PRST_MAGIC).toBe('TSRP');
  });

  it('erkennt den Magic-Header', () => {
    const buf = buildTestBuffer();
    const decoder = new PRSTDecoder(buf);
    expect(decoder.hasMagic()).toBe(true);
  });

  it('hasMagic() gibt false zurueck bei leerem Buffer', () => {
    const empty = new Uint8Array(1224).fill(0);
    const decoder = new PRSTDecoder(empty);
    expect(decoder.hasMagic()).toBe(false);
  });

  it('liest den Patch-Namen', () => {
    const buf = buildTestBuffer();
    const decoder = new PRSTDecoder(buf);
    expect(decoder.decode().patchName).toBe('TestPatch');
  });

  it('reads author from offset 0x54', () => {
    const buf = buildTestBuffer();
    'TestAuthor'.split('').forEach((c, i) => { buf[0x54 + i] = c.charCodeAt(0); });
    const decoder = new PRSTDecoder(buf);
    const preset = decoder.decode();
    expect(preset.author).toBe('TestAuthor');
  });

  it('returns undefined author when empty', () => {
    const buf = buildTestBuffer();
    const decoder = new PRSTDecoder(buf);
    const preset = decoder.decode();
    expect(preset.author).toBeUndefined();
  });

  it('wirft bei ungueltigem Magic', () => {
    const bad = new Uint8Array(1224).fill(0);
    const decoder = new PRSTDecoder(bad);
    expect(() => decoder.decode()).toThrow('Invalid .prst file');
  });

  it('dekodiert 11 Effect-Slots mit 15 float32 params', () => {
    const buf = buildTestBuffer();
    const decoder = new PRSTDecoder(buf);
    const preset = decoder.decode();
    expect(preset.effects).toHaveLength(11);
    preset.effects.forEach((e, i) => {
      expect(e.slotIndex).toBe(i);
      expect(e.enabled).toBe(false);
      expect(e.params).toHaveLength(15);
    });
  });

  it('reads float32 param values correctly', () => {
    const buf = buildTestBufferWithParams();
    const decoder = new PRSTDecoder(buf);
    const preset = decoder.decode();
    const params = preset.effects[0].params;
    expect(params[0]).toBeCloseTo(50.0, 5);
    expect(params[1]).toBeCloseTo(25.5, 5);
    expect(params[2]).toBeCloseTo(100.0, 5);
    // Remaining params should be 0
    for (let i = 3; i < 15; i++) {
      expect(params[i]).toBe(0);
    }
  });
});

describe('PRSTDecoder mit echten .prst Dateien', () => {
  const fixtures = [
    { file: 'planung/36-C CHUGG.prst',          name: 'CHUGG' },
    { file: 'planung/57-A Stone in Love.prst',   name: 'Stone in Love' },
    { file: 'planung/ZZ-WokeUp.prst',            name: 'ZZ-WokeUp' },
  ];

  for (const { file, name } of fixtures) {
    const filePath = join(process.cwd(), file);
    it.skipIf(!existsSync(filePath))(`dekodiert "${name}" ohne Fehler`, () => {
      const data = new Uint8Array(readFileSync(filePath));
      const decoder = new PRSTDecoder(data);
      expect(decoder.hasMagic()).toBe(true);
      const preset = decoder.decode();
      expect(preset.patchName).toBe(name);
      expect(preset.effects).toHaveLength(11);
      preset.effects.forEach((e) => {
        expect(e.params).toHaveLength(15);
      });
    });
  }

  const authorFile = join(process.cwd(), 'prst/63-B American Idiot.prst');
  it.skipIf(!existsSync(authorFile))('reads author "Galtone Studio" from American Idiot.prst', () => {
    const data = new Uint8Array(readFileSync(authorFile));
    const preset = new PRSTDecoder(data).decode();
    expect(preset.patchName).toBe('American Idiot');
    expect(preset.author).toBe('Galtone Studio');
  });
});
