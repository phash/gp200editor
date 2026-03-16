import { z } from 'zod';

export const EffectSlotSchema = z.object({
  slotIndex: z.number().int().min(0).max(10), // GP-200 has 11 slots (0–10)
  effectId: z.number().int().min(0).max(0xFFFFFFFF), // LE uint32 effect code
  enabled: z.boolean(),
  /** Effect parameters: 15 x float32 LE values per slot */
  params: z.array(z.number()),
});

export const GP200PresetSchema = z.object({
  version: z.string(),
  patchName: z.string().max(32), // longest known name: "Stone in Love" = 13 chars
  effects: z.array(EffectSlotSchema),
  checksum: z.number().int().min(0).max(65535), // LE uint16 at end of file
});

export type EffectSlot = z.infer<typeof EffectSlotSchema>;
export type GP200Preset = z.infer<typeof GP200PresetSchema>;
