import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import {
  findAmpCategoryBySlug,
  listAmpCategories,
} from '@/core/ampCategories';
import { buildAlternates, BASE_URL } from '@/lib/hreflang';
import { serializeJsonLd } from '@/lib/jsonLd';
import { LOCALES, type Locale } from '@/i18n/locales';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string; locale: Locale }>;
};

/** Pre-render every known amp slug for every locale. Each becomes a
 *  standalone indexable landing page targeting long-tail amp queries. */
export async function generateStaticParams() {
  const cats = listAmpCategories();
  return cats.flatMap((cat) => LOCALES.map((locale) => ({ slug: cat.slug, locale })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const cat = findAmpCategoryBySlug(slug);
  if (!cat) return {};

  const t = await getTranslations({ locale });
  const title = t('amp.metaTitle', { name: cat.realName });
  const description = t('amp.metaDescription', { name: cat.realName });
  const canonical = `${BASE_URL}/${locale}/amp/${slug}`;

  // Empty amp pages (no community presets) are noindex'd to avoid being
  // flagged as thin content. Crawl is still allowed so Google reaches the
  // breadcrumb back to /gallery. Count is an index-only lookup — cheap
  // even though the page render below also queries presets.
  const presetCount = await prisma.preset.count({
    where: { public: true, effects: { hasSome: cat.valetonNames } },
  });
  const isEmpty = presetCount === 0;

  return {
    title,
    description,
    ...(isEmpty && { robots: { index: false, follow: true } }),
    alternates: buildAlternates(`/amp/${slug}`, locale),
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      siteName: 'Preset Forge',
      locale: locale === 'de' ? 'de_DE' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

/** JSON-LD emission is safe here: the content is either static
 *  (cat.realName, cat.slug from EFFECT_DESCRIPTIONS), route params validated
 *  by Next.js routing (locale, slug), or DB fields (preset.name) which are
 *  user content but additionally escaped via the .replace(/</g, ...) pass
 *  below. The escape prevents any string containing "</script>" from ending
 *  the script block early even before the JSON parser sees it. */
function buildCollectionJsonLd(opts: {
  realName: string;
  locale: Locale;
  slug: string;
  presets: Array<{ name: string; shareToken: string }>;
  homeLabel: string;
  galleryLabel: string;
}) {
  const base = `${BASE_URL}/${opts.locale}`;
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${opts.realName} Valeton GP-200 Presets`,
        description: `Free Valeton GP-200 presets modelled on the ${opts.realName}.`,
        url: `${base}/amp/${opts.slug}`,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: opts.presets.length,
          itemListElement: opts.presets.slice(0, 25).map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${base}/share/${p.shareToken}`,
            name: p.name,
          })),
        },
      },
      // Mirrors the visible Home · Gallery · Amp breadcrumb above so Google can
      // render a breadcrumb trail in the result snippet.
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: opts.homeLabel, item: base },
          { '@type': 'ListItem', position: 2, name: opts.galleryLabel, item: `${base}/gallery` },
          { '@type': 'ListItem', position: 3, name: opts.realName, item: `${base}/amp/${opts.slug}` },
        ],
      },
    ],
  };
  return serializeJsonLd(data);
}

export default async function AmpCategoryPage({ params }: Props) {
  const { slug, locale } = await params;
  const cat = findAmpCategoryBySlug(slug);
  if (!cat) notFound();

  // Query public presets whose `effects` array overlaps with any of the
  // Valeton names mapped to this amp slug. hasSome = Postgres array overlap.
  const presets = await prisma.preset.findMany({
    where: {
      public: true,
      effects: { hasSome: cat.valetonNames },
    },
    orderBy: [{ ratingAverage: 'desc' }, { downloadCount: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      name: true,
      description: true,
      shareToken: true,
      downloadCount: true,
      ratingAverage: true,
      ratingCount: true,
      tags: true,
      user: { select: { username: true } },
    },
  });

  const t = await getTranslations({ locale });
  const jsonLd = buildCollectionJsonLd({
    realName: cat.realName,
    locale,
    slug,
    presets,
    homeLabel: t('nav.home'),
    galleryLabel: t('nav.gallery'),
  });

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      <nav className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        <Link href={`/${locale}`} className="hover:underline">{t('nav.home')}</Link>
        {' · '}
        <Link href={`/${locale}/gallery`} className="hover:underline">{t('nav.gallery')}</Link>
        {' · '}
        <span style={{ color: 'var(--text-secondary)' }}>{t('amp.breadcrumbAmp')}: {cat.realName}</span>
      </nav>

      <header className="mb-6">
        <h1
          className="font-mono-display text-2xl font-bold tracking-tight mb-2"
          style={{ color: 'var(--accent-amber)' }}
        >
          {cat.realName}
        </h1>
        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
          {presets.length === 0
            ? t('amp.introEmpty')
            : t('amp.introCount', { count: presets.length, name: cat.realName })}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('amp.valetonModels', { count: cat.valetonNames.length })}{' '}
          {cat.valetonNames.map((n, i) => (
            <span key={n}>
              {i > 0 && ', '}
              <code
                className="font-mono-display px-1.5 py-0.5 rounded"
                style={{ background: 'var(--bg-surface-raised)', color: 'var(--text-secondary)' }}
              >
                {n}
              </code>
            </span>
          ))}
        </p>
      </header>

      {presets.length > 0 && (
        <ul className="space-y-3">
          {presets.map((p) => (
            <li
              key={p.id}
              className="rounded-lg p-4"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Link
                href={`/${locale}/share/${p.shareToken}`}
                className="block"
              >
                <h2
                  className="font-mono-display font-bold text-lg mb-1"
                  style={{ color: 'var(--accent-amber)' }}
                >
                  {p.name}
                </h2>
                {p.description && (
                  <p
                    className="text-sm mb-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {p.description}
                  </p>
                )}
                <div className="flex gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{t('amp.by')} @{p.user.username}</span>
                  <span>·</span>
                  <span>{p.downloadCount} {t('presets.downloads')}</span>
                  {p.ratingCount > 0 && (
                    <>
                      <span>·</span>
                      <span>★ {p.ratingAverage.toFixed(1)} ({p.ratingCount})</span>
                    </>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
