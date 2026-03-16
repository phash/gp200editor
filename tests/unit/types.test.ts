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

  it('akzeptiert "Stone in Love" (13 Zeichen)', () => {
    const result = GP200PresetSchema.safeParse({
      version: '1',
      patchName: 'Stone in Love',
      effects: [],
      checksum: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects patchName longer than 32 chars', () => {
    const result = GP200PresetSchema.safeParse({
      version: '1',
      patchName: 'A'.repeat(33),
      effects: [],
      checksum: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('EffectSlotSchema', () => {
  it('validates a valid effect slot with float32 params', () => {
    const result = EffectSlotSchema.safeParse({
      slotIndex: 0,
      effectId: 5,
      enabled: true,
      params: [50.0, 30.5, 0.0],
    });
    expect(result.success).toBe(true);
  });

  it('akzeptiert slotIndex 10 (11 Slots total, 0-10)', () => {
    const result = EffectSlotSchema.safeParse({
      slotIndex: 10,
      effectId: 0,
      enabled: false,
      params: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects slotIndex out of range (max 10)', () => {
    const result = EffectSlotSchema.safeParse({
      slotIndex: 11,
      effectId: 0,
      enabled: false,
      params: [],
    });
    expect(result.success).toBe(false);
  });

  it('accepts float32 param values (not limited to 0-255)', () => {
    const result = EffectSlotSchema.safeParse({
      slotIndex: 0,
      effectId: 0,
      enabled: true,
      params: [256, -12.5, 0.1, 10000],
    });
    expect(result.success).toBe(true);
  });

  it('accepts 15 float32 params (full slot)', () => {
    const params = Array.from({ length: 15 }, (_, i) => i * 6.67);
    const result = EffectSlotSchema.safeParse({
      slotIndex: 0,
      effectId: 0,
      enabled: true,
      params,
    });
    expect(result.success).toBe(true);
  });
});
