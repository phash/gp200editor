import { z } from 'zod';
import type { GP200Preset } from '@/core/types';

export const PRESET_JSON_SCHEMA_VERSION = 1;

/** Strictly one-way literal — if we ever ship v2, existing consumers keep working against v1. */
const schemaVersionLiteral = z.literal(1);

const nameRefSchema = z.object({
  valetonName: z.string(),
  realName: z.string().nullable(),
});

const signalChainEntrySchema = z.object({
  slot: z.number().int().min(0).max(10),
  module: z.string(),
  active: z.boolean(),
  valetonName: z.string(),
  realName: z.string().nullable(),
  category: z.string(),
});

const rawPresetDataSchema = z.object({
  patchName: z.string(),
  author: z.string().nullable(),
  effects: z.array(z.object({
    slotIndex: z.number().int().min(0).max(10),
    active: z.boolean(),
    effectId: z.number().int().nonnegative(),
    params: z.array(z.number()),
  })),
  fileSize: z.number().int().positive(),
  checksum: z.string(),
});

export const PresetJsonSchema = z.object({
  schemaVersion: schemaVersionLiteral,
  name: z.string(),
  author: z.string().nullable(),
  description: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  sourceLabel: z.string().nullable(),
  summary: z.string(),
  signalChain: z.array(signalChainEntrySchema),
  highlights: z.object({
    amp: nameRefSchema.nullable(),
    cab: nameRefSchema.nullable(),
    drive: nameRefSchema.nullable(),
  }),
  raw: rawPresetDataSchema,
  urls: z.object({
    download: z.string(),
    openInEditor: z.string(),
    html: z.string(),
  }),
});

export type PresetJson = z.infer<typeof PresetJsonSchema>;
export type SignalChainEntry = z.infer<typeof signalChainEntrySchema>;
export type NameRef = z.infer<typeof nameRefSchema>;
export type RawPresetData = z.infer<typeof rawPresetDataSchema>;

// Function stubs — implemented in Task 4/5/6.
export function encodeToJson(_preset: GP200Preset, _opts: EncodeOpts): PresetJson {
  throw new Error('encodeToJson not implemented');
}

export function decodeFromJson(_json: PresetJson): GP200Preset {
  throw new Error('decodeFromJson not implemented');
}

export type EncodeOpts = {
  shareToken: string;
  locale: 'de' | 'en';
  sourceUrl: string | null;
  sourceLabel: string | null;
  description: string | null;
};
