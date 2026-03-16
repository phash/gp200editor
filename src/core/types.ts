import { z } from 'zod';

export const EffectSlotSchema = z.object({
  slotIndex: z.number().int().min(0).max(9),
  effectId: z.number().int().min(0),
  enabled: z.boolean(),
  /** Parameter array — length and meaning are effect-dependent */
  params: z.array(z.number().int().min(0).max(255)),
});

export const GP200PresetSchema = z.object({
  version: z.string(),
  patchName: z.string().max(12),
  effects: z.array(EffectSlotSchema),
  checksum: z.number().int().min(0).max(255),
});

export type EffectSlot = z.infer<typeof EffectSlotSchema>;
export type GP200Preset = z.infer<typeof GP200PresetSchema>;
