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
import { LOCALES, localeUrl } from '@/lib/hreflang';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no active amps. Individual tests override when amp URLs matter.
  (getActiveAmpSlugs as ReturnType<typeof vi.fn>).mockResolvedValue(new Set());
});

describe('sitemap', () => {
  it('never lists a /en/ URL — those only redirect under as-needed prefixing', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { shareToken: 'abc', updatedAt: new Date('2026-04-01') },
    ]);
    (getActiveAmpSlugs as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Set(['fender-65-twin-reverb']),
    );

    const entries = await sitemap();
    const prefixed = entries.filter((e) => /preset-forge\.com\/en(\/|$)/.test(e.url));
    expect(prefixed).toEqual([]);
  });

  it('lists the unprefixed English home page', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain('https://www.preset-forge.com');
    expect(urls).toContain('https://www.preset-forge.com/de');
  });

  it('emits only the x-default (English) share URL per public preset', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { shareToken: 'abc', updatedAt: new Date('2026-04-01') },
    ]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://www.preset-forge.com/share/abc');
    // The other six locales are near-duplicates — the preset name, amp and
    // parameter values are identical, only the surrounding chrome is
    // translated. They stay reachable and self-canonical, but listing all
    // seven made share pages 70% of the sitemap and starved the amp and
    // guide pages of crawl budget. Google finds the rest via hreflang.
    for (const locale of ['de', 'es', 'fr', 'it', 'pt', 'pt-BR']) {
      expect(urls).not.toContain(`https://www.preset-forge.com/${locale}/share/abc`);
    }
  });

  it('emits no /api/ URLs — the sitemap is for pages, not JSON endpoints', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { shareToken: 'abc', updatedAt: new Date('2026-04-01') },
    ]);

    const entries = await sitemap();
    expect(entries.filter((e) => e.url.includes('/api/'))).toHaveLength(0);
  });

  it('emits exactly one entry per preset', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({
        shareToken: `tok${i}`,
        updatedAt: new Date(),
      })),
    );

    const entries = await sitemap();
    const presetEntries = entries.filter(
      (e) => e.url.includes('/share/') && !e.url.includes('/amp/'),
    );
    expect(presetEntries).toHaveLength(10);
  });

  it('omits /changelog — it is noindex and must not be advertised for crawl', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const entries = await sitemap();
    expect(entries.filter((e) => e.url.includes('/changelog'))).toHaveLength(0);
  });

  it('emits amp category URLs for all 7 locales (only for active slugs)', async () => {
    (prisma.preset.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    // Pretend 12 amp slugs have presets — sitemap should emit them, skip the rest.
    const activeSlugs = new Set(['fender-65-twin-reverb', 'mesa-boogie-mark-iv-lead-channel', 'marshall-jcm800-lead-bright-channel', 'marshall-jcm800-lead-normal-channel', 'fender-deluxe-reverb', 'bogner-xtc-blue-channel', 'bogner-xtc-red-channel', 'fender-tweed-deluxe', 'engl-savage-120-amplifier', 'diezel-vh4-channel-1-clean', 'diezel-vh4-channel-2-crunch', 'ampeg-svt-bass-amp']);
    (getActiveAmpSlugs as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeSlugs);

    const entries = await sitemap();
    // English is unprefixed under localePrefix 'as-needed', so match on the
    // URL each locale is actually served from rather than assuming a prefix.
    const perLocale = LOCALES.map((l) =>
      entries.filter((e) => e.url.startsWith(localeUrl(l, '/amp/'))),
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
