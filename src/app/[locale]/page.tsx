import { Suspense } from 'react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { getLatestUserFacingRelease } from '@/lib/changelog';
import { ChangelogItemContent } from '@/components/ChangelogItemContent';
import { serializeJsonLd } from '@/lib/jsonLd';
import { FeaturedPresetBlock } from '@/components/FeaturedPresetBlock';
import type { Locale } from '@/i18n/locales';

type FaqItem = { q: string; a: string };

// Landing page — renders a marketing-style overview of what Preset Forge
// is and does. Was previously just a redirect to /editor. Server Component
// so we can read CHANGELOG.md at render time without bloating the client
// bundle.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations('home');

  // Most recent release reduced to user-facing sections — security, schema,
  // and protocol notes stay in the full /changelog but don't headline the
  // landing page.
  const latest = getLatestUserFacingRelease();

  // Read the FAQ array from translations (next-intl returns the raw value
  // for non-string keys via t.raw). Used both for visible rendering and the
  // FAQPage JSON-LD emitted inline below.
  const faqItems = t.raw('faq.items') as FaqItem[];
  const faqJsonLd = serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <Suspense fallback={null}>
        <FeaturedPresetBlock locale={locale} />
      </Suspense>

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

        {/* Product shot — gives the text-only hero a real glimpse of the
            editor, framed as a browser window. Lazy-loaded: the LCP is the
            headline above, and on most viewports this sits below the fold. */}
        <figure className="mt-12 mx-auto max-w-2xl">
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border-subtle)', boxShadow: '0 12px 48px rgba(0,0,0,0.5)' }}
          >
            <div
              className="flex items-center gap-1.5 px-3 py-2"
              style={{ background: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent-red)' }} aria-hidden />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent-amber)' }} aria-hidden />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent-green)' }} aria-hidden />
              <span
                className="ml-3 font-mono-display text-[10px] tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                preset-forge.com/editor
              </span>
            </div>
            <Image
              src="/editor-preview.webp"
              alt={t('hero.previewAlt')}
              width={880}
              height={963}
              sizes="(max-width: 672px) 100vw, 672px"
              className="block w-full h-auto"
            />
          </div>
        </figure>
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
                        <ChangelogItemContent item={item} />
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

      {/* ───────── FAQ ───────── */}
      <section className="mb-14">
        <h2
          className="font-mono-display text-sm uppercase tracking-wider mb-6 text-center"
          style={{ color: 'var(--text-muted)' }}
        >
          {t('faq.heading')}
        </h2>
        <div className="space-y-3 max-w-3xl mx-auto">
          {faqItems.map((item, i) => (
            <details
              key={i}
              className="rounded-lg p-4 group"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <summary
                className="font-mono-display font-bold text-base cursor-pointer list-none flex items-center justify-between"
                style={{ color: 'var(--accent-amber)' }}
              >
                <span>{item.q}</span>
                <span className="text-xs ml-3 transition-transform group-open:rotate-180" aria-hidden>▾</span>
              </summary>
              <p
                className="text-sm mt-3"
                style={{ color: 'var(--text-secondary)' }}
              >
                {item.a}
              </p>
            </details>
          ))}
        </div>
        {/* FAQ JSON-LD: serializeJsonLd escapes `<`, ` `, ` ` so this
            is safe for static developer-controlled content from messages/*.json */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: faqJsonLd }}
        />
      </section>

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
