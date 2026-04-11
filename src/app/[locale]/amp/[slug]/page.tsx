import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import {
  findAmpCategoryBySlug,
  listAmpCategories,
} from '@/core/ampCategories';

export const dynamic = 'force-dynamic';

import { buildAlternates, BASE_URL } from '@/lib/hreflang';

type Props = {
  params: Promise<{ slug: string; locale: 'de' | 'en' }>;
};

/** Pre-render every known amp slug for both locales. Each becomes a
 *  standalone indexable landing page targeting long-tail amp queries. */
export async function generateStaticParams() {
  const cats = listAmpCategories();
  return cats.flatMap((cat) => [
    { slug: cat.slug, locale: 'en' },
    { slug: cat.slug, locale: 'de' },
  ]);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const cat = findAmpCategoryBySlug(slug);
  if (!cat) return {};

  const title = `${cat.realName} - Free Valeton GP-200 Presets | Preset Forge`;
  const description = `Browse free Valeton GP-200 presets modelled on the ${cat.realName}. Download any preset and open it in the browser editor - works on Linux, Windows, macOS.`;
  const canonical = `${BASE_URL}/${locale}/amp/${slug}`;

  return {
    title,
    description,
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
  locale: 'de' | 'en';
  slug: string;
  presets: Array<{ name: string; shareToken: string }>;
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${opts.realName} Valeton GP-200 Presets`,
    description: `Free Valeton GP-200 presets modelled on the ${opts.realName}.`,
    url: `${BASE_URL}/${opts.locale}/amp/${opts.slug}`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: opts.presets.length,
      itemListElement: opts.presets.slice(0, 25).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${BASE_URL}/${opts.locale}/share/${p.shareToken}`,
        name: p.name,
      })),
    },
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
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

  const jsonLd = buildCollectionJsonLd({
    realName: cat.realName,
    locale,
    slug,
    presets,
  });

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      <nav className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        <Link href={`/${locale}`} className="hover:underline">Home</Link>
        {' · '}
        <Link href={`/${locale}/gallery`} className="hover:underline">Gallery</Link>
        {' · '}
        <span style={{ color: 'var(--text-secondary)' }}>Amp: {cat.realName}</span>
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
            ? 'No presets yet for this amp. Be the first to upload one!'
            : `${presets.length} free Valeton GP-200 ${presets.length === 1 ? 'preset' : 'presets'} modelled on the ${cat.realName}.`}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Valeton model{cat.valetonNames.length > 1 ? 's' : ''}:{' '}
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
                  <span>by @{p.user.username}</span>
                  <span>·</span>
                  <span>{p.downloadCount} downloads</span>
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
