import { prisma } from '@/lib/prisma';
import { listAmpCategories } from '@/core/ampCategories';

// Force dynamic generation — the default sitemap.ts output is baked at build
// time when the DB is unreachable, which means library presets imported after
// deploy never show up in the xml. revalidate alone doesn't trigger regen for
// metadata routes reliably, so we mark the whole thing dynamic. The actual
// Cache-Control header is still set by Next.js to `max-age=0, must-revalidate`,
// so Caddy/Google still cache the rendered output briefly via their own rules.
export const dynamic = 'force-dynamic';

const BASE_URL = 'https://preset-forge.com';

type SitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
};

export default async function sitemap(): Promise<SitemapEntry[]> {
  const staticPages: SitemapEntry[] = [
    { url: `${BASE_URL}/en`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/de`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/en/editor`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/de/editor`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/en/gallery`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/de/gallery`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/en/help`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/de/help`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ];

  // Sitemap.xml has a hard limit of 50 000 URLs. Each preset generates two
  // entries (de + en), so cap the query well below that to avoid OOM / slow
  // builds once the gallery grows. Order by updatedAt so the newest presets
  // are always indexed first.
  const SITEMAP_PRESET_LIMIT = 10000;

  let presetPages: SitemapEntry[] = [];
  try {
    const publicPresets = await prisma.preset.findMany({
      where: { public: true },
      orderBy: { updatedAt: 'desc' },
      take: SITEMAP_PRESET_LIMIT,
      select: { shareToken: true, updatedAt: true },
    });

    presetPages = publicPresets.flatMap((preset) => [
      {
        url: `${BASE_URL}/de/share/${preset.shareToken}`,
        lastModified: preset.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      },
      {
        url: `${BASE_URL}/en/share/${preset.shareToken}`,
        lastModified: preset.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      },
      {
        url: `${BASE_URL}/api/share/${preset.shareToken}/json`,
        lastModified: preset.updatedAt,
        changeFrequency: 'yearly' as const,
        priority: 0.3,
      },
    ]);
  } catch (err) {
    // Database unavailable during build — skip dynamic pages. Log so ops
    // can see if this is happening in production (was previously silent
    // which hid the post-deploy ISR regression).
    console.error(
      '[sitemap] failed to load public presets:',
      err instanceof Error ? `${err.name}: ${err.message}` : err,
    );
  }

  // Amp category landing pages — one per (amp, locale) combo. These are
  // indexed separately from individual presets and target long-tail amp
  // queries like "Marshall JCM800 Valeton GP-200 preset".
  const ampPages: SitemapEntry[] = listAmpCategories().flatMap((cat) => [
    {
      url: `${BASE_URL}/en/amp/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/de/amp/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
  ]);

  return [...staticPages, ...ampPages, ...presetPages];
}
