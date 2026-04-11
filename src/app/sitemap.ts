import { prisma } from '@/lib/prisma';
import { listAmpCategories } from '@/core/ampCategories';
import { LOCALES, BASE_URL } from '@/lib/hreflang';

// Force dynamic generation — the default sitemap.ts output is baked at build
// time when the DB is unreachable, which means library presets imported after
// deploy never show up in the xml. revalidate alone doesn't trigger regen for
// metadata routes reliably, so we mark the whole thing dynamic.
export const dynamic = 'force-dynamic';

type SitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
};

const STATIC_PAGES: Array<{
  path: string;
  changeFrequency: SitemapEntry['changeFrequency'];
  priority: number;
}> = [
  { path: '',            changeFrequency: 'weekly',  priority: 1.0 },
  { path: '/editor',     changeFrequency: 'weekly',  priority: 1.0 },
  { path: '/gallery',    changeFrequency: 'daily',   priority: 0.8 },
  { path: '/help',       changeFrequency: 'monthly', priority: 0.6 },
  { path: '/changelog',  changeFrequency: 'weekly',  priority: 0.5 },
];

export default async function sitemap(): Promise<SitemapEntry[]> {
  const now = new Date();

  const staticPages: SitemapEntry[] = STATIC_PAGES.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: `${BASE_URL}/${locale}${page.path}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
  );

  // Amp category landing pages — one per (amp, locale) combo.
  const ampPages: SitemapEntry[] = listAmpCategories().flatMap((cat) =>
    LOCALES.map((locale) => ({
      url: `${BASE_URL}/${locale}/amp/${cat.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  );

  // Public preset share pages — 6 locale variants + 1 JSON endpoint per preset.
  // Sitemap.xml has a hard limit of 50 000 URLs. With 6 locales + 1 JSON per
  // preset we get 7 entries per preset, so cap well below that.
  // Each preset emits 6 locale variants + 1 JSON endpoint = 7 entries. At
  // 5000 presets that's 35k URLs, leaving ~14k headroom under Google's 50k
  // sitemap cap for the static + amp-category entries. If we hit this limit
  // on a production build, we've silently started dropping presets from the
  // index — that's ops-visible via console.warn + needs a sitemap-index split.
  const SITEMAP_PRESET_LIMIT = 5000;
  let presetPages: SitemapEntry[] = [];
  try {
    const publicPresets = await prisma.preset.findMany({
      where: { public: true },
      orderBy: { updatedAt: 'desc' },
      take: SITEMAP_PRESET_LIMIT,
      select: { shareToken: true, updatedAt: true },
    });

    if (publicPresets.length === SITEMAP_PRESET_LIMIT) {
      console.warn(
        `[sitemap] hit SITEMAP_PRESET_LIMIT (${SITEMAP_PRESET_LIMIT}) — ` +
          `older public presets are being excluded from the sitemap. ` +
          `Plan a sitemap-index split before the library grows further.`,
      );
    }

    presetPages = publicPresets.flatMap((preset) => {
      const entries: SitemapEntry[] = LOCALES.map((locale) => ({
        url: `${BASE_URL}/${locale}/share/${preset.shareToken}`,
        lastModified: preset.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
      // One locale-less JSON endpoint per preset (API route, not locale-scoped)
      entries.push({
        url: `${BASE_URL}/api/share/${preset.shareToken}/json`,
        lastModified: preset.updatedAt,
        changeFrequency: 'yearly' as const,
        priority: 0.3,
      });
      return entries;
    });
  } catch (err) {
    // Database unavailable during build — skip dynamic pages. Log so ops
    // can see if this is happening in production (was previously silent
    // which hid the post-deploy ISR regression).
    console.error(
      '[sitemap] failed to load public presets:',
      err instanceof Error ? `${err.name}: ${err.message}` : err,
    );
  }

  return [...staticPages, ...ampPages, ...presetPages];
}
