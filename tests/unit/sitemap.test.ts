import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    preset: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/ampActivity', () => ({
  getActiveAmpSlugs: vi.fn(),
}));

import sitemap from '@/app/sitemap';
import { prisma } from '@/lib/prisma';
import { getActiveAmpSlugs } from '@/lib/ampActivity';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no active amps. Individual tests override when amp URLs matter.
  (getActiveAmpSlugs as ReturnType<typeof vi.fn>).mockResolvedValue(new Set());
});

describe('sitemap', () => {
  it('emits HTML + JSON URLs for each public preset', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { shareToken: 'abc', updatedAt: new Date('2026-04-01') },
    ]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    // All 6 locale variants
    expect(urls).toContain('https://www.preset-forge.com/de/share/abc');
    expect(urls).toContain('https://www.preset-forge.com/en/share/abc');
    expect(urls).toContain('https://www.preset-forge.com/es/share/abc');
    expect(urls).toContain('https://www.preset-forge.com/fr/share/abc');
    expect(urls).toContain('https://www.preset-forge.com/it/share/abc');
    expect(urls).toContain('https://www.preset-forge.com/pt/share/abc');
    // Plus the JSON endpoint
    expect(urls).toContain('https://www.preset-forge.com/api/share/abc/json');
  });

  it('emits seven entries per preset (6 locale HTML + 1 JSON)', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({
        shareToken: `tok${i}`,
        updatedAt: new Date(),
      })),
    );

    const entries = await sitemap();
    const presetEntries = entries.filter(
      (e) =>
        (e.url.includes('/share/') || e.url.includes('/api/share/')) &&
        !e.url.includes('/amp/'),
    );
    expect(presetEntries).toHaveLength(70);
  });

  it('emits amp category URLs for all 6 locales (only for active slugs)', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    // Pretend 12 amp slugs have presets — sitemap should emit them, skip the rest.
    const activeSlugs = new Set(['fender-65-twin-reverb', 'mesa-boogie-mark-iv-lead-channel', 'marshall-jcm800-lead-bright-channel', 'marshall-jcm800-lead-normal-channel', 'fender-deluxe-reverb', 'bogner-xtc-blue-channel', 'bogner-xtc-red-channel', 'fender-tweed-deluxe', 'engl-savage-120-amplifier', 'diezel-vh4-channel-1-clean', 'diezel-vh4-channel-2-crunch', 'ampeg-svt-bass-amp']);
    (getActiveAmpSlugs as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeSlugs);

    const entries = await sitemap();
    const perLocale = ['de', 'en', 'es', 'fr', 'it', 'pt'].map((l) =>
      entries.filter((e) => e.url.match(new RegExp(`/${l}/amp/[a-z0-9-]+$`))),
    );

    // Every locale should have one URL per active slug that exists in the
    // category table (some test slugs may not exist; the filter is what we care
    // about, not exact counts). At minimum half of our 12 candidates resolve.
    expect(perLocale[0].length).toBeGreaterThanOrEqual(6);
    for (const locale of perLocale.slice(1)) {
      expect(locale.length).toBe(perLocale[0].length);
    }
  });

  it('omits amp URLs for slugs without any public presets', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    (getActiveAmpSlugs as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Set());

    const entries = await sitemap();
    const ampEntries = entries.filter((e) => e.url.includes('/amp/'));
    expect(ampEntries).toHaveLength(0);
  });

  it('survives when prisma throws (DB unavailable at build time)', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('no db'));
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
  });
});
