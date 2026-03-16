import { describe, it, expect } from 'vitest';
import { GP200PresetSchema, EffectSlotSchema } from '@/core/types';

describe('GP200PresetSchema', () => {
  it('validates a valid preset', () => {
    const result = GP200PresetSchema.safeParse({
      version: '1',   // Consistent with decoder output: String(readUint8())
      patchName: 'TestPatch',
      effects: [],
      checksum: 0xab,
    });
    expect(result.success).toBe(true);
  });

  it('rejects patchName longer than 12 chars', () => {
    const result = GP200PresetSchema.safeParse({
      version: '1',
      patchName: 'ThisNameIsTooLong',
      effects: [],
      checksum: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('EffectSlotSchema', () => {
  it('validates a valid effect slot', () => {
    const result = EffectSlotSchema.safeParse({
      slotIndex: 0,
      effectId: 5,
      enabled: true,
      params: [127, 64, 0],
    });
    expect(result.success).toBe(true);
  });

  it('rejects slotIndex out of range (max 9)', () => {
    const result = EffectSlotSchema.safeParse({
      slotIndex: 10,
      effectId: 0,
      enabled: false,
      params: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects param value out of byte range (max 255)', () => {
    const result = EffectSlotSchema.safeParse({
      slotIndex: 0,
      effectId: 0,
      enabled: true,
      params: [256],
    });
    expect(result.success).toBe(false);
  });
});
