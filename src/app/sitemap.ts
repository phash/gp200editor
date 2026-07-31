import { prisma } from '@/lib/prisma';
import { listAmpCategories } from '@/core/ampCategories';
import { getActiveAmpSlugs } from '@/lib/ampActivity';
import { LOCALES, localeUrl, DEFAULT_LOCALE } from '@/lib/hreflang';
import { GUIDE_SLUGS, guideLocales, getGuide } from '@/content/guides';

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
  { path: '/guides',     changeFrequency: 'monthly', priority: 0.6 },
  // /changelog is deliberately absent — it is noindex (see its
  // generateMetadata). 2 100 words of release notes pulled 180 impressions
  // and 1 click over Q2/2026 (CTR 0.56%, the worst on the site) by ranking
  // for long-tail queries it cannot answer. Advertising it for crawl would
  // contradict the noindex.
];

// The single locale whose share URLs go into the sitemap. The other six
// variants of a share page carry identical preset data — same name, same
// amp, same parameter values — with only the chrome translated, so listing
// all seven made /share 1 190 of 1 712 sitemap URLs (70%) while the amp and
// guide pages that actually earn non-brand clicks got 9. The localized
// variants stay live, self-canonical and reachable via hreflang.
const SHARE_SITEMAP_LOCALE = DEFAULT_LOCALE;

export default async function sitemap(): Promise<SitemapEntry[]> {
  const now = new Date();

  const staticPages: SitemapEntry[] = STATIC_PAGES.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: localeUrl(locale, page.path || '/'),
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
  );

  // Amp category landing pages — only emit slugs that have ≥1 public preset.
  // Empty amp pages render "No presets yet" copy and are noindex'd at the
  // page level; including them in the sitemap would invite Google to crawl
  // 384 thin pages and dilute the site's overall quality signal.
  let activeAmpSlugs: Set<string>;
  try {
    activeAmpSlugs = await getActiveAmpSlugs();
  } catch (err) {
    console.error(
      '[sitemap] failed to load active amp slugs:',
      err instanceof Error ? `${err.name}: ${err.message}` : err,
    );
    activeAmpSlugs = new Set();
  }
  const ampPages: SitemapEntry[] = listAmpCategories()
    .filter((cat) => activeAmpSlugs.has(cat.slug))
    .flatMap((cat) =>
      LOCALES.map((locale) => ({
        url: localeUrl(locale, `/amp/${cat.slug}`),
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    );

  // Public preset share pages — one entry per preset (see
  // SHARE_SITEMAP_LOCALE). Sitemap.xml has a hard limit of 50 000 URLs; at
  // one entry per preset the cap below leaves ample headroom for the static,
  // amp and guide entries. If we ever hit the limit on a production build
  // we've silently started dropping presets from the index — that's
  // ops-visible via console.warn + needs a sitemap-index split.
  const SITEMAP_PRESET_LIMIT = 5000;
  let presetPages: SitemapEntry[] = [];
  try {
    // Exclude flagged presets — moderation must also remove a URL from the
    // sitemap so Googlebot stops surfacing it.
    const publicPresets = await prisma.preset.findMany({
      where: { public: true, flagged: false },
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

    // The /api/share/<token>/json endpoints used to be listed here. They are
    // API responses, not pages — 170 URLs of crawl budget spent on something
    // Google can only index as raw JSON. They are now robots-disallowed.
    presetPages = publicPresets.map((preset) => ({
      url: localeUrl(SHARE_SITEMAP_LOCALE, `/share/${preset.shareToken}`),
      lastModified: preset.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch (err) {
    // Database unavailable during build — skip dynamic pages. Log so ops
    // can see if this is happening in production (was previously silent
    // which hid the post-deploy ISR regression).
    console.error(
      '[sitemap] failed to load public presets:',
      err instanceof Error ? `${err.name}: ${err.message}` : err,
    );
  }

  // Long-form guide detail pages — only the locales that actually have a
  // translation of each slug (others 404 and must stay out of the sitemap).
  const guidePages: SitemapEntry[] = GUIDE_SLUGS.flatMap((slug) =>
    guideLocales(slug).map((locale) => ({
      url: localeUrl(locale, `/guides/${slug}`),
      lastModified: new Date(getGuide(locale, slug)!.updated),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  );

  return [...staticPages, ...ampPages, ...guidePages, ...presetPages];
}
