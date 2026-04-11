import { prisma } from '@/lib/prisma';

// Revalidate the sitemap every hour so new library presets become indexable
// without redeploying. Default Next.js behaviour caches sitemap.ts output at
// build time, which means any DB change post-deploy is invisible to Google.
export const revalidate = 3600;

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
  } catch {
    // Database unavailable during build — skip dynamic pages
  }

  return [...staticPages, ...presetPages];
}
