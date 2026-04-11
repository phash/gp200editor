import { z } from 'zod';
import type { GP200Preset } from '@/core/types';
import { EFFECT_MAP } from '@/core/effectNames';
import { EFFECT_DESCRIPTIONS } from '@/core/effectDescriptions';

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

export type EncodeOpts = {
  shareToken: string;
  locale: 'de' | 'en' | 'es' | 'fr' | 'it' | 'pt';
  sourceUrl: string | null;
  sourceLabel: string | null;
  description: string | null;
};

const MODULE_CATEGORIES: Record<string, string> = {
  PRE: 'Compressor / Boost',
  NR:  'Noise Gate',
  EQ:  'Equalizer',
  WAH: 'Wah',
  DST: 'Overdrive / Distortion',
  MOD: 'Modulation',
  AMP: 'Amp head',
  CAB: 'Cabinet',
  DLY: 'Delay',
  RVB: 'Reverb',
  VOL: 'Volume',
  UNKNOWN: 'Unknown',
};

export function buildSignalChain(preset: GP200Preset): SignalChainEntry[] {
  return preset.effects
    .slice()
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((slot) => {
      const info = EFFECT_MAP[slot.effectId];
      const valetonName = info ? info.name : `Unknown #${slot.effectId}`;
      const moduleCode = info ? info.module : 'UNKNOWN';
      const realName = info ? (EFFECT_DESCRIPTIONS[info.name] ?? null) : null;
      const category = MODULE_CATEGORIES[moduleCode] ?? 'Unknown';
      return {
        slot: slot.slotIndex,
        module: moduleCode,
        active: slot.enabled,
        valetonName,
        realName,
        category,
      };
    });
}

export function pickHighlights(chain: SignalChainEntry[]): PresetJson['highlights'] {
  const firstActive = (module: string): NameRef | null => {
    const entry = chain.find((c) => c.active && c.module === module);
    return entry ? { valetonName: entry.valetonName, realName: entry.realName } : null;
  };
  return {
    amp:   firstActive('AMP'),
    cab:   firstActive('CAB'),
    drive: firstActive('DST'),
  };
}

/**
 * Generates a short English prose description of the preset.
 * Deterministic — same inputs produce the same output.
 * Used both in PresetJson.summary and in the share-page sr-only block.
 */
export function generateSummary(chain: SignalChainEntry[], presetName: string): string {
  const firstReal = (module: string): string | null => {
    const entry = chain.find((c) => c.active && c.module === module);
    if (!entry) return null;
    return entry.realName ?? entry.valetonName;
  };
  const amp = firstReal('AMP');
  const cab = firstReal('CAB');
  const dst = firstReal('DST');
  const mod = firstReal('MOD');
  const dly = firstReal('DLY');
  const rvb = firstReal('RVB');

  if (!amp && !cab && !dst) {
    return `Valeton GP-200 preset "${presetName}".`;
  }

  const parts: string[] = [];
  if (dst && amp) parts.push(`${dst} into a ${amp} amp`);
  else if (amp)   parts.push(`${amp} amp`);
  else if (dst)   parts.push(`${dst} drive`);
  if (cab) parts.push(`routed to a ${cab} cabinet`);
  if (mod) parts.push(`modulated with ${mod}`);
  if (dly) parts.push(`with ${dly} delay`);
  if (rvb) parts.push(`and ${rvb} reverb`);

  return `Valeton GP-200 preset "${presetName}": ${parts.join(', ')}.`;
}

// Function stubs — implemented in Task 5/6.
export function encodeToJson(preset: GP200Preset, opts: EncodeOpts): PresetJson {
  const chain = buildSignalChain(preset);
  const highlights = pickHighlights(chain);
  const summary = generateSummary(chain, preset.patchName);

  // User presets are 1224 bytes; factory presets are 1176. We persist only user
  // presets. Checksum is already a uint16 on GP200Preset.
  const checksumHex = `0x${preset.checksum.toString(16).padStart(4, '0')}`;

  return {
    schemaVersion: 1,
    name: preset.patchName,
    author: preset.author ?? null,
    description: opts.description,
    sourceUrl: opts.sourceUrl,
    sourceLabel: opts.sourceLabel,
    summary,
    signalChain: chain,
    highlights,
    raw: {
      patchName: preset.patchName,
      author: preset.author ?? null,
      effects: preset.effects.map((e) => ({
        slotIndex: e.slotIndex,
        active: e.enabled,
        effectId: e.effectId,
        params: e.params,
      })),
      fileSize: 1224,
      checksum: checksumHex,
    },
    urls: {
      download: `/api/share/${opts.shareToken}/download`,
      openInEditor: `/${opts.locale}/editor?share=${opts.shareToken}`,
      html: `/${opts.locale}/share/${opts.shareToken}`,
    },
  };
}

export function decodeFromJson(json: PresetJson): GP200Preset {
  // Rebuild the internal GP200Preset structure from the raw block only.
  // All enriched fields (signalChain, highlights, summary) are derived.
  const checksum = Number.parseInt(json.raw.checksum.replace(/^0x/, ''), 16);

  const effects = json.raw.effects.map((e) => ({
    slotIndex: e.slotIndex,
    enabled: e.active,
    effectId: e.effectId,
    params: e.params,
  }));

  return {
    version: '1',
    patchName: json.raw.patchName,
    author: json.raw.author ?? undefined,
    effects,
    checksum,
  } as GP200Preset;
}
