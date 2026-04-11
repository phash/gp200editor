import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { getChangelog } from '@/lib/changelog';

// Landing page — renders a marketing-style overview of what Preset Forge
// is and does. Was previously just a redirect to /editor. Server Component
// so we can read CHANGELOG.md at render time without bloating the client
// bundle.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: 'de' | 'en' | 'es' | 'fr' | 'it' | 'pt' }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations('home');

  // Pull the most recent release for the "what's new" section.
  const releases = getChangelog();
  const latest = releases[0];

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      {/* ───────── Hero ───────── */}
      <section className="mb-14 text-center">
        <p
          className="font-mono-display text-xs uppercase tracking-widest mb-3"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('hero.tagline')}
        </p>
        <h1
          className="font-mono-display text-4xl md:text-5xl font-bold tracking-tight mb-5"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('hero.headline')}
        </h1>
        <p
          className="max-w-2xl mx-auto text-base md:text-lg mb-6"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('hero.subtitle')}
        </p>

        <div className="flex flex-wrap justify-center gap-2 mb-7">
          {(['free', 'adFree', 'openSource', 'linux'] as const).map((badge) => (
            <span
              key={badge}
              className="font-mono-display text-[11px] uppercase tracking-wider px-3 py-1 rounded"
              style={{
                color: 'var(--accent-amber)',
                background: 'var(--glow-amber)',
                border: '1px solid var(--accent-amber-dim)',
              }}
            >
              {t(`hero.badges.${badge}`)}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/editor"
            className="font-mono-display text-sm font-bold tracking-wider uppercase px-8 py-3 rounded-lg transition-all duration-150 bg-[var(--glow-amber)] text-[var(--accent-amber)] border border-[var(--accent-amber)] [box-shadow:0_0_12px_var(--glow-amber)] hover:!bg-[var(--accent-amber)] hover:!text-[var(--bg-primary)] hover:[box-shadow:0_0_20px_var(--glow-amber)]"
          >
            {t('hero.ctaEditor')}
          </Link>
          <Link
            href="/gallery"
            className="font-mono-display text-sm font-bold tracking-wider uppercase px-8 py-3 rounded-lg transition-all duration-150"
            style={{
              color: 'var(--text-secondary)',
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {t('hero.ctaGallery')}
          </Link>
        </div>
      </section>

      {/* ───────── Features grid ───────── */}
      <section className="mb-14">
        <h2
          className="font-mono-display text-sm uppercase tracking-wider mb-6 text-center"
          style={{ color: 'var(--text-muted)' }}
        >
          {t('features.heading')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            title={t('features.editor.title')}
            body={t('features.editor.body')}
            cta={t('features.editor.cta')}
            href="/editor"
          />
          <FeatureCard
            title={t('features.library.title')}
            body={t('features.library.body')}
            cta={t('features.library.cta')}
            href="/gallery"
          />
          <FeatureCard
            title={t('features.amps.title')}
            body={t('features.amps.body')}
            cta={t('features.amps.cta')}
            href="/amp/marshall-jcm800"
          />
          <FeatureCard
            title={t('features.hlx.title')}
            body={t('features.hlx.body')}
          />
          <FeatureCard
            title={t('features.playlists.title')}
            body={t('features.playlists.body')}
            href="/playlists"
          />
          <FeatureCard
            title={t('features.midi.title')}
            body={t('features.midi.body')}
          />
        </div>
      </section>

      {/* ───────── What's new ───────── */}
      {latest && (
        <section className="mb-14">
          <div className="flex items-baseline justify-between mb-4">
            <h2
              className="font-mono-display text-sm uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('whatsNew.heading')}
            </h2>
            <Link
              href="/changelog"
              className="text-xs hover:underline"
              style={{ color: 'var(--accent-amber)' }}
            >
              {t('whatsNew.readMore')}
            </Link>
          </div>
          <div
            className="rounded-lg p-5"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-baseline gap-3 mb-3">
              <span
                className="font-mono-display text-[11px] uppercase tracking-wider px-2 py-0.5 rounded"
                style={{
                  color: 'var(--accent-amber)',
                  background: 'var(--glow-amber)',
                  border: '1px solid var(--accent-amber-dim)',
                }}
              >
                {t('whatsNew.latest')}
              </span>
              <span className="font-mono-display text-xs" style={{ color: 'var(--text-muted)' }}>
                {latest.date}
              </span>
            </div>
            {latest.sections.map((section) => (
              <div key={section.heading} className="mb-3 last:mb-0">
                <h3
                  className="font-mono-display text-[11px] uppercase tracking-wider mb-1.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {section.heading}
                </h3>
                <ul className="space-y-1 text-sm">
                  {section.items.slice(0, 4).map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span style={{ color: 'var(--accent-amber)' }}>·</span>
                      <span>
                        {item.title && (
                          <strong style={{ color: 'var(--text-secondary)' }}>{item.title}</strong>
                        )}
                        {item.title && item.body && (
                          <span style={{ color: 'var(--text-muted)' }}> — {item.body}</span>
                        )}
                        {!item.title && <span style={{ color: 'var(--text-muted)' }}>{item.body}</span>}
                      </span>
                    </li>
                  ))}
                  {section.items.length > 4 && (
                    <li className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      +{section.items.length - 4} more
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ───────── Support / community ───────── */}
      <section className="mb-8">
        <h2
          className="font-mono-display text-sm uppercase tracking-wider mb-6 text-center"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('support.heading')}
        </h2>
        <p
          className="max-w-2xl mx-auto text-sm md:text-base text-center mb-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('support.body')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SupportCard
            title={t('support.bmacTitle')}
            body={t('support.bmacBody')}
            cta={t('support.bmacCta')}
            href="https://buymeacoffee.com/phash"
            external
          />
          <SupportCard
            title={t('support.discordTitle')}
            body={t('support.discordBody')}
            cta={t('support.discordCta')}
            href="https://discord.gg/8V4bVtXw"
            external
          />
        </div>
      </section>

      {/* Hidden hint to crawlers about the locale — already covered by
          hreflang in the layout, but explicit never hurts. */}
      <p className="sr-only">
        Valeton GP-200 preset editor — {locale === 'de' ? 'Deutsch' : 'English'}.
      </p>
    </main>
  );
}

// ───────── Sub-components ─────────

function FeatureCard({
  title,
  body,
  cta,
  href,
}: {
  title: string;
  body: string;
  cta?: string;
  href?: string;
}) {
  const content = (
    <div
      className="h-full rounded-lg p-5 transition-colors"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <h3
        className="font-mono-display font-bold text-base mb-2"
        style={{ color: 'var(--accent-amber)' }}
      >
        {title}
      </h3>
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
        {body}
      </p>
      {cta && href && (
        <span
          className="text-xs font-mono-display uppercase tracking-wider"
          style={{ color: 'var(--accent-amber)' }}
        >
          {cta}
        </span>
      )}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }
  return content;
}

function SupportCard({
  title,
  body,
  cta,
  href,
  external,
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external && { target: '_blank', rel: 'noopener' })}
      className="block rounded-lg p-5 transition-all hover:[box-shadow:0_0_20px_var(--glow-amber)]"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--accent-amber-dim)',
      }}
    >
      <h3
        className="font-mono-display font-bold text-base mb-2"
        style={{ color: 'var(--accent-amber)' }}
      >
        {title}
      </h3>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        {body}
      </p>
      <span
        className="inline-block font-mono-display text-xs font-bold tracking-wider uppercase px-4 py-2 rounded"
        style={{
          color: 'var(--accent-amber)',
          background: 'var(--glow-amber)',
          border: '1px solid var(--accent-amber)',
        }}
      >
        {cta}
      </span>
    </a>
  );
}
