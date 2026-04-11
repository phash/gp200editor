import type { GP200Preset } from '@/core/types';

type TagInput = {
  preset: GP200Preset;
  sourceLabel: string;
  name: string;
};

const GENRE_PATTERNS: Array<[RegExp, string]> = [
  [/metal|brutal|djent/i, 'metal'],
  [/clean|pristine|jazz/i, 'clean'],
  [/blues|bb king/i, 'blues'],
  [/ambient|shimmer|pad/i, 'ambient'],
];

export function autoTag({ sourceLabel, name }: TagInput): string[] {
  const tags: string[] = [];
  if (sourceLabel.startsWith('Valeton')) tags.push('factory');
  else if (sourceLabel.startsWith('github.com')) tags.push('github');
  else if (sourceLabel === 'guitarpatches.com') tags.push('community');

  for (const [re, tag] of GENRE_PATTERNS) {
    if (re.test(name)) {
      tags.push(tag);
      break;
    }
  }
  return tags.slice(0, 3);
}
