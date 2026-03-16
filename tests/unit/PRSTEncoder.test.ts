import { describe, it, expect } from 'vitest';
import { PRSTEncoder } from '@/core/PRSTEncoder';
import { PRSTDecoder, PRST_MAGIC } from '@/core/PRSTDecoder';
import type { GP200Preset } from '@/core/types';

const samplePreset: GP200Preset = {
  version: '1',
  patchName: 'MyPatch',
  effects: [],
  checksum: 0,
};

describe('PRSTEncoder', () => {
  it('schreibt den Magic-Header', () => {
    const encoder = new PRSTEncoder();
    const buf = encoder.encode(samplePreset);
    const arr = new Uint8Array(buf);
    const magic = String.fromCharCode(arr[0], arr[1], arr[2], arr[3]);
    expect(magic).toBe(PRST_MAGIC);
  });

  it('encode → decode ergibt das gleiche Preset (round-trip)', () => {
    const encoder = new PRSTEncoder();
    const buf = new Uint8Array(encoder.encode(samplePreset));
    const decoder = new PRSTDecoder(buf);
    const decoded = decoder.decode();
    expect(decoded.patchName).toBe(samplePreset.patchName);
    expect(decoded.version).toBe(samplePreset.version);
    expect(decoded.checksum).toBe(samplePreset.checksum);
    expect(decoded.effects).toHaveLength(samplePreset.effects.length);
  });
});
