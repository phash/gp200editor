import type { GP200Preset } from '@/core/types';
import { EFFECT_MAP } from '@/core/effectNames';
import { EFFECT_DESCRIPTIONS } from '@/core/effectDescriptions';

type Resolved = { valetonName: string; realName: string | null };

function findActiveInModule(preset: GP200Preset, module: string): Resolved | null {
  for (const slot of preset.effects) {
    if (!slot.enabled) continue;
    const info = EFFECT_MAP[slot.effectId];
    if (info?.module === module) {
      return {
        valetonName: info.name,
        realName: EFFECT_DESCRIPTIONS[info.name] ?? null,
      };
    }
  }
  return null;
}

export function generateDescription(preset: GP200Preset, hint?: string): string {
  const amp = findActiveInModule(preset, 'AMP');
  const cab = findActiveInModule(preset, 'CAB');
  const drive = findActiveInModule(preset, 'DST');

  const parts: string[] = [];
  if (amp)   parts.push(`${amp.realName ?? amp.valetonName} amp`);
  if (cab)   parts.push(`${cab.realName ?? cab.valetonName} cabinet`);
  if (drive) parts.push(`with ${drive.realName ?? drive.valetonName} drive`);

  const base =
    parts.length > 0
      ? `Valeton GP-200 preset: ${parts.join(', ')}.`
      : 'Valeton GP-200 preset.';

  return hint ? `${base} ${hint}` : base;
}
