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

/** Append a label to a name only if the name doesn't already contain it.
 *  Prevents "Fender Twin Reverb cabinet cabinet" (the real name already
 *  says "cabinet") while still producing "Marshall JCM800 amp" for
 *  bare real names. */
function labelledName(ref: Resolved, label: 'amp' | 'cabinet' | 'drive'): string {
  const name = ref.realName ?? ref.valetonName;
  return name.toLowerCase().includes(label) ? name : `${name} ${label}`;
}

export function generateDescription(preset: GP200Preset, hint?: string): string {
  const amp = findActiveInModule(preset, 'AMP');
  const cab = findActiveInModule(preset, 'CAB');
  const drive = findActiveInModule(preset, 'DST');

  const parts: string[] = [];
  if (amp)   parts.push(labelledName(amp, 'amp'));
  if (cab)   parts.push(labelledName(cab, 'cabinet'));
  if (drive) parts.push(`with ${labelledName(drive, 'drive')}`);

  const base =
    parts.length > 0
      ? `Valeton GP-200 preset: ${parts.join(', ')}.`
      : 'Valeton GP-200 preset.';

  return hint ? `${base} ${hint}` : base;
}
