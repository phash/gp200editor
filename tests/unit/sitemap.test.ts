import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    preset: {
      findMany: vi.fn(),
    },
  },
}));

import sitemap from '@/app/sitemap';
import { prisma } from '@/lib/prisma';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sitemap', () => {
  it('emits HTML + JSON URLs for each public preset', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { shareToken: 'abc', updatedAt: new Date('2026-04-01') },
    ]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://preset-forge.com/de/share/abc');
    expect(urls).toContain('https://preset-forge.com/en/share/abc');
    expect(urls).toContain('https://preset-forge.com/api/share/abc/json');
  });

  it('emits three entries per preset', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({
        shareToken: `tok${i}`,
        updatedAt: new Date(),
      })),
    );

    const entries = await sitemap();
    const presetEntries = entries.filter((e) => e.url.includes('/share/') || e.url.includes('/api/share/'));
    expect(presetEntries).toHaveLength(30);
  });

  it('survives when prisma throws (DB unavailable at build time)', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('no db'));
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
  });
});
