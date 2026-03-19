import { prisma } from '@/lib/prisma';

const BASE_URL = 'https://preset-forge.com';

type SitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
};

export default async function sitemap(): Promise<SitemapEntry[]> {
  const staticPages: SitemapEntry[] = [
    { url: `${BASE_URL}/de/editor`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/en/editor`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/de/gallery`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/en/gallery`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/de/help`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/en/help`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  let presetPages: SitemapEntry[] = [];
  try {
    const publicPresets = await prisma.preset.findMany({
      where: { public: true },
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
    ]);
  } catch {
    // Database unavailable during build — skip dynamic pages
  }

  return [...staticPages, ...presetPages];
}
