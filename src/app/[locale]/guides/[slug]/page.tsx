import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link } from '@/i18n/routing';
import { BASE_URL, type Locale } from '@/lib/hreflang';
import { serializeJsonLd } from '@/lib/jsonLd';
import { getGuide, guideLocales, allGuideParams } from '@/content/guides';

/** Pre-render only the (locale, slug) pairs that have real content. Other
 *  locales render on demand, hit getGuide() === null, and 404 — keeping
 *  untranslated guide URLs out of the index. */
export function generateStaticParams() {
  return allGuideParams();
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const guide = getGuide(locale, slug);
  if (!guide) return {};

  const canonical = `${BASE_URL}/${locale}/guides/${slug}`;
  // hreflang covers only the locales that actually have this guide, plus
  // x-default → English. Listing all 7 would point alternates at 404s.
  const languages: Record<string, string> = {};
  const locales = guideLocales(slug);
  for (const l of locales) languages[l] = `${BASE_URL}/${l}/guides/${slug}`;
  if (locales.includes('en')) languages['x-default'] = `${BASE_URL}/en/guides/${slug}`;

  const title = `${guide.title} | Preset Forge`;
  return {
    title,
    description: guide.description,
    alternates: { canonical, languages },
    openGraph: {
      title,
      description: guide.description,
      url: canonical,
      type: 'article',
      siteName: 'Preset Forge',
      images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description: guide.description },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const guide = getGuide(locale, slug);
  if (!guide) notFound();

  const t = await getTranslations({ locale, namespace: 'guides' });
  const nav = await getTranslations({ locale, namespace: 'nav' });
  const canonical = `${BASE_URL}/${locale}/guides/${slug}`;
  const base = `${BASE_URL}/${locale}`;

  // TechArticle + BreadcrumbList. Static, author-controlled content, but still
  // routed through serializeJsonLd per project convention.
  const jsonLd = serializeJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: guide.title,
        description: guide.description,
        inLanguage: locale,
        datePublished: guide.updated,
        dateModified: guide.updated,
        author: { '@type': 'Organization', name: 'Preset Forge' },
        publisher: { '@type': 'Organization', name: 'Preset Forge' },
        mainEntityOfPage: canonical,
        url: canonical,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: nav('home'), item: base },
          { '@type': 'ListItem', position: 2, name: t('title'), item: `${base}/guides` },
          { '@type': 'ListItem', position: 3, name: guide.title, item: canonical },
        ],
      },
    ],
  });

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <nav className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
        <Link href="/" className="hover:underline">{nav('home')}</Link>
        {' · '}
        <Link href="/guides" className="hover:underline">{t('title')}</Link>
      </nav>

      <article>
        <h1
          className="font-mono-display text-3xl font-bold tracking-tight mb-3"
          style={{ color: 'var(--accent-amber)' }}
        >
          {guide.title}
        </h1>
        <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
          {t('updated')} <time dateTime={guide.updated}>{guide.updated}</time>
        </p>
        <p className="text-base mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {guide.intro}
        </p>

        {guide.sections.map((section) => (
          <section key={section.heading} className="mb-8">
            <h2
              className="font-mono-display text-xl font-bold tracking-tight mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              {section.heading}
            </h2>
            {section.body?.map((para, i) => (
              <p key={i} className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {para}
              </p>
            ))}
            {section.steps && (
              <ol className="space-y-2 mt-2">
                {section.steps.map((step, i) => (
                  <li key={i} className="text-sm leading-relaxed flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-mono-display flex-shrink-0" style={{ color: 'var(--accent-amber)' }}>{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/editor"
            className="font-mono-display text-sm font-bold tracking-wider uppercase px-6 py-3 rounded-lg bg-[var(--glow-amber)] text-[var(--accent-amber)] border border-[var(--accent-amber)] [box-shadow:0_0_12px_var(--glow-amber)] hover:!bg-[var(--accent-amber)] hover:!text-[var(--bg-primary)]"
          >
            {t('ctaEditor')}
          </Link>
          <Link
            href="/guides"
            className="font-mono-display text-sm font-bold tracking-wider uppercase px-6 py-3 rounded-lg"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-subtle)' }}
          >
            {t('allGuides')}
          </Link>
        </div>
      </article>
    </main>
  );
}
