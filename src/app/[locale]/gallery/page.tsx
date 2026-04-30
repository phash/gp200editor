import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link } from '@/i18n/routing';
import { prisma } from '@/lib/prisma';
import { GalleryClient } from './GalleryClient';
import { HelpButton } from '@/components/HelpButton';
import { buildAlternates, BASE_URL, type Locale } from '@/lib/hreflang';
import { serializeJsonLd } from '@/lib/jsonLd';

// The interactive GalleryClient renders fully client-side — Googlebot sees
// an empty shell and never reaches /share/* pages via internal links from
// /gallery. We mitigate that by emitting a server-rendered directory of
// the most recent public presets below the client app: same data the user
// gets, just in a flat HTML list that the crawler can follow without JS.
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Preset Gallery — Browse & Share GP-200 Presets | Preset Forge',
    description: 'Browse community presets for the Valeton GP-200. Filter by effect type across 305 effects, download presets directly into the editor, and share your own tones. Free, no account needed to browse.',
    alternates: buildAlternates('/gallery', locale as Locale),
    openGraph: {
      title: 'GP-200 Preset Gallery — 305 Effects, Community Sharing | Preset Forge',
      description: 'Discover Valeton GP-200 presets shared by the community. Filter by amp, distortion, delay, reverb and 305 other effects. Download and edit in the browser — works on Linux, Windows, macOS.',
      images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
  };
}

type Props = { params: Promise<{ locale: string }> };

export default async function GalleryPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations('gallery');

  // Server-side fetch: 30 newest public presets for the SEO directory.
  // Failure here must not break the page — fall back to the empty list.
  let recent: Array<{
    id: string;
    name: string;
    shareToken: string;
    description: string | null;
    author: string | null;
    user: { username: string };
  }> = [];
  try {
    recent = await prisma.preset.findMany({
      where: { public: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        name: true,
        shareToken: true,
        description: true,
        author: true,
        user: { select: { username: true } },
      },
    });
  } catch (err) {
    console.error(
      '[gallery] failed to load recent presets for SSR directory:',
      err instanceof Error ? `${err.name}: ${err.message}` : err,
    );
  }

  // ItemList JSON-LD makes the directory machine-readable for richer
  // crawling signals on top of the plain anchor links below.
  const itemListJsonLd = serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Recent community presets',
    numberOfItems: recent.length,
    itemListElement: recent.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${BASE_URL}/${locale}/share/${p.shareToken}`,
      name: p.name,
    })),
  });
  const itemListInnerHtml = { __html: itemListJsonLd };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <h1
          className="font-mono-display text-xl font-bold tracking-tight"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('title')}
        </h1>
        <HelpButton section="gallery" />
      </div>
      <GalleryClient />

      {recent.length > 0 && (
        <section className="mt-16 pt-8" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <h2
            className="font-mono-display text-sm uppercase tracking-wider mb-4"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('recentHeading')}
          </h2>
          <ul className="space-y-1.5 text-sm">
            {recent.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-2">
                <Link
                  href={`/share/${p.shareToken}`}
                  className="font-mono-display hover:underline"
                  style={{ color: 'var(--accent-amber)' }}
                >
                  {p.name}
                </Link>
                <span style={{ color: 'var(--text-muted)' }}>
                  by @{p.user.username}
                </span>
                {p.description && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    — {p.description.slice(0, 120)}{p.description.length > 120 ? '…' : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            ↑ {t('browseAll')}
          </p>
          {/* JSON-LD ItemList (developer-controlled data, escaped via serializeJsonLd) */}
          {/* eslint-disable-next-line react/no-danger */}
          <script type="application/ld+json" dangerouslySetInnerHTML={itemListInnerHtml} />
        </section>
      )}
    </main>
  );
}
