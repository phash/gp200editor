import { describe, it, expect } from 'vitest';
import { extractModules } from '@/core/extractModules';
import type { GP200Preset } from '@/core/types';

describe('extractModules', () => {
  it('returns unique module names for active effects', () => {
    const preset: GP200Preset = {
      version: '1',
      patchName: 'Test',
      effects: [
        { slotIndex: 0, enabled: true, effectId: 0x03000000, params: [] },  // DST (Green OD)
        { slotIndex: 1, enabled: true, effectId: 0x07000001, params: [] },  // AMP (Tweedy)
        { slotIndex: 2, enabled: false, effectId: 0x0B000000, params: [] }, // DLY (Pure, inactive)
        { slotIndex: 3, enabled: true, effectId: 0x0C000000, params: [] },  // RVB (Room)
        { slotIndex: 4, enabled: true, effectId: 0x03000004, params: [] },  // DST (Swarm, duplicate)
      ],
      checksum: 0,
    };
    const modules = extractModules(preset);
    expect(modules).toEqual(['DST', 'AMP', 'RVB']);
  });

  it('returns empty array for no active effects', () => {
    const preset: GP200Preset = {
      version: '1',
      patchName: 'Empty',
      effects: [
        { slotIndex: 0, enabled: false, effectId: 0x03000000, params: [] },
      ],
      checksum: 0,
    };
    expect(extractModules(preset)).toEqual([]);
  });

  it('excludes Unknown modules', () => {
    const preset: GP200Preset = {
      version: '1',
      patchName: 'Test',
      effects: [
        { slotIndex: 0, enabled: true, effectId: 0xFFFFFFFF, params: [] },  // Unknown
        { slotIndex: 1, enabled: true, effectId: 0x07000001, params: [] },  // AMP (Tweedy)
      ],
      checksum: 0,
    };
    expect(extractModules(preset)).toEqual(['AMP']);
  });
});
