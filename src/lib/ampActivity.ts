import { prisma } from '@/lib/prisma';
import { listAmpCategories } from '@/core/ampCategories';

/**
 * Set of amp-category slugs that have at least one public preset.
 *
 * Used to keep empty amp landing pages out of the sitemap — Google
 * penalises sites with hundreds of thin/empty pages, and we ship with
 * ~64 amp slugs but most still have zero community presets.
 */
export async function getActiveAmpSlugs(): Promise<Set<string>> {
  const presets = await prisma.preset.findMany({
    where: { public: true },
    select: { effects: true },
  });

  const usedNames = new Set<string>();
  for (const p of presets) {
    for (const name of p.effects) usedNames.add(name);
  }

  const active = new Set<string>();
  for (const cat of listAmpCategories()) {
    if (cat.valetonNames.some((n) => usedNames.has(n))) {
      active.add(cat.slug);
    }
  }
  return active;
}
