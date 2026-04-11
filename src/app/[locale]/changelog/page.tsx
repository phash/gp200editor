import type { Metadata } from 'next';
import { Link } from '@/i18n/routing';
import { getChangelog } from '@/lib/changelog';

export const revalidate = 3600;

const BASE_URL = 'https://preset-forge.com';

type Props = {
  params: Promise<{ locale: 'de' | 'en' }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const title = 'Changelog — Preset Forge';
  const description =
    'Every release of the Preset Forge Valeton GP-200 editor. Features, bug fixes, protocol discoveries, SEO improvements.';
  const canonical = `${BASE_URL}/${locale}/changelog`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        de: `${BASE_URL}/de/changelog`,
        en: `${BASE_URL}/en/changelog`,
        'x-default': `${BASE_URL}/en/changelog`,
      },
    },
    openGraph: { title, description, url: canonical, type: 'website', siteName: 'Preset Forge' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function ChangelogPage({ params }: Props) {
  const { locale } = await params;
  void locale;
  const releases = getChangelog();

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <header className="mb-8">
        <Link
          href="/"
          className="text-xs hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          ← Home
        </Link>
        <h1
          className="font-mono-display text-3xl font-bold tracking-tight mt-3 mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Changelog
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Every shipped change, newest first. Sourced from{' '}
          <code
            className="font-mono-display text-xs px-1.5 py-0.5 rounded"
            style={{ background: 'var(--bg-surface-raised)' }}
          >
            CHANGELOG.md
          </code>{' '}
          in the repo.
        </p>
      </header>

      <ol className="space-y-10">
        {releases.map((release) => (
          <li key={release.date}>
            <div className="flex items-baseline gap-3 mb-4">
              <span
                className="font-mono-display text-sm font-bold tracking-wider"
                style={{ color: 'var(--accent-amber)' }}
              >
                {release.date}
              </span>
              <span
                className="flex-1"
                style={{ borderBottom: '1px dashed var(--border-subtle)' }}
              />
            </div>
            {release.sections.map((section) => (
              <div key={section.heading} className="mb-5 last:mb-0">
                <h3
                  className="font-mono-display text-[11px] uppercase tracking-wider mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {section.heading}
                </h3>
                <ul className="space-y-2 text-sm">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span style={{ color: 'var(--accent-amber)' }}>·</span>
                      <span>
                        {item.title && (
                          <strong style={{ color: 'var(--text-secondary)' }}>{item.title}</strong>
                        )}
                        {item.title && item.body && (
                          <span style={{ color: 'var(--text-muted)' }}> — {item.body}</span>
                        )}
                        {!item.title && (
                          <span style={{ color: 'var(--text-muted)' }}>{item.body}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </li>
        ))}
      </ol>
    </main>
  );
}
