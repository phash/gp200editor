import { describe, it, expect } from 'vitest';
import { PRSTEncoder } from '@/core/PRSTEncoder';
import { PRSTDecoder, PRST_MAGIC } from '@/core/PRSTDecoder';
import type { GP200Preset } from '@/core/types';

/** A preset with 11 effect slots — the real GP-200 format always has exactly 11 */
const EMPTY_PARAMS = Array(60).fill(0);
const samplePreset: GP200Preset = {
  version: '1',
  patchName: 'MyPatch',
  effects: Array.from({ length: 11 }, (_, i) => ({
    slotIndex: i,
    effectId: 0,
    enabled: false,
    params: EMPTY_PARAMS,
  })),
  checksum: 0,
};

describe('PRSTEncoder', () => {
  it('schreibt den Magic-Header "TSRP"', () => {
    const encoder = new PRSTEncoder();
    const buf = encoder.encode(samplePreset);
    const arr = new Uint8Array(buf);
    const magic = String.fromCharCode(arr[0], arr[1], arr[2], arr[3]);
    expect(magic).toBe(PRST_MAGIC);
  });

  it('erzeugt genau 1224 Bytes', () => {
    const encoder = new PRSTEncoder();
    expect(encoder.encode(samplePreset).byteLength).toBe(1224);
  });

  it('encode → decode ergibt das gleiche Preset (round-trip)', () => {
    const encoder = new PRSTEncoder();
    const buf = new Uint8Array(encoder.encode(samplePreset));
    const decoder = new PRSTDecoder(buf);
    const decoded = decoder.decode();
    expect(decoded.patchName).toBe(samplePreset.patchName);
    expect(decoded.version).toBe(samplePreset.version);
    expect(decoded.checksum).toBe(samplePreset.checksum);
    expect(decoded.effects).toHaveLength(11);
    expect(decoded.effects[0].enabled).toBe(false);
    expect(decoded.effects[0].slotIndex).toBe(0);
  });
});
