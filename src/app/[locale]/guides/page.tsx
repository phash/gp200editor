import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link } from '@/i18n/routing';
import { buildAlternates, BASE_URL, type Locale } from '@/lib/hreflang';
import { listGuidesForIndex } from '@/content/guides';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guides' });
  const title = `${t('title')} — Preset Forge`;
  const description = t('subtitle');
  return {
    title,
    description,
    alternates: buildAlternates('/guides', locale as Locale),
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/${locale}/guides`,
      type: 'website',
      siteName: 'Preset Forge',
      images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
  };
}

export default async function GuidesIndexPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guides' });
  const rows = listGuidesForIndex(locale);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1
        className="font-mono-display text-3xl font-bold tracking-tight mb-3"
        style={{ color: 'var(--accent-amber)' }}
      >
        {t('title')}
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
        {t('subtitle')}
      </p>

      <ul className="space-y-4">
        {rows.map(({ slug, guide, localized }) => (
          <li key={slug}>
            <Link
              href={`/guides/${slug}`}
              locale={localized ? undefined : 'en'}
              className="block rounded-lg p-5 transition-all hover:[box-shadow:0_0_20px_var(--glow-amber)]"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="font-mono-display font-bold text-lg" style={{ color: 'var(--accent-amber)' }}>
                  {guide.title}
                </h2>
                {!localized && (
                  <span
                    className="font-mono-display text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
                  >
                    {t('inEnglish')}
                  </span>
                )}
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {guide.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
