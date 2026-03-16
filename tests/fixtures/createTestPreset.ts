import { PRSTEncoder } from '@/core/PRSTEncoder';
import type { GP200Preset } from '@/core/types';

/**
 * Creates a valid 512-byte GP-200 .prst buffer suitable for upload tests.
 * Uses 10 disabled effect slots (slotIndex 0–9) with effectId 0 and zero
 * parameter bytes. patchName is truncated to 12 characters to satisfy the
 * GP200PresetSchema constraint.
 */
export function createTestPresetBuffer(patchName = 'Test Preset'): Buffer {
  const preset: GP200Preset = {
    version: '1',
    patchName: patchName.slice(0, 12),
    effects: Array.from({ length: 10 }, (_, i) => ({
      slotIndex: i,
      effectId: 0,
      enabled: false,
      params: Array(60).fill(0),
    })),
    checksum: 0,
  };

  const arrayBuffer = new PRSTEncoder().encode(preset);
  return Buffer.from(arrayBuffer);
}
