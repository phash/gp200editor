import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { guideLinkLocale } from '@/content/guides';
import type { Locale } from '@/i18n/locales';

const FEATURE_KEYS = ['feature1', 'feature2', 'feature3', 'feature4', 'feature5', 'feature6', 'feature7'] as const;
const EDITOR_GUIDE = 'valeton-gp-200-editor';

/**
 * Server-rendered "about this editor" block below the editor UI.
 *
 * The editor page itself is a client component whose initial HTML is little
 * more than an upload box, so crawlers had almost no text to rank it on
 * ("gp 200 editor", "gp200 editor", "valeton gp-200 software editor" — GSC
 * Oct 2026, CTR 4.8%). This gives them the plain-text description, rendered
 * on the server and placed after the editor so it never gets in the way.
 */
export async function EditorAbout({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'editorAbout' });

  // "What it does" comes before the feature list, the rest after it.
  const sections = [
    { title: t('liveTitle'), body: t('liveBody') },
    { title: t('filesTitle'), body: t('filesBody') },
    { title: t('platformsTitle'), body: t('platformsBody') },
    { title: t('freeTitle'), body: t('freeBody') },
  ];

  const links = [
    { href: `/guides/${EDITOR_GUIDE}`, label: t('guideLink'), locale: guideLinkLocale(locale, EDITOR_GUIDE) },
    { href: '/help', label: t('helpLink'), locale },
    { href: '/gallery', label: t('galleryLink'), locale },
  ];

  return (
    <section
      aria-labelledby="editor-about-heading"
      data-testid="editor-about"
      className="max-w-3xl mx-auto px-8 pt-12 pb-16 mt-12"
      style={{ borderTop: '1px solid var(--border-subtle)' }}
    >
      <h2
        id="editor-about-heading"
        className="font-mono-display text-xl font-bold tracking-tight mb-4"
        style={{ color: 'var(--accent-amber)' }}
      >
        {t('heading')}
      </h2>
      <p className="text-sm mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {t('intro')}
      </p>

      <AboutSection title={t('whatTitle')} body={t('whatBody')} />

      <h3
        className="font-mono-display text-base font-bold tracking-tight mb-3"
        style={{ color: 'var(--text-primary)' }}
      >
        {t('featuresTitle')}
      </h3>
      <ul className="space-y-2 mb-8">
        {FEATURE_KEYS.map((key) => (
          <li
            key={key}
            className="text-sm pl-4"
            style={{ color: 'var(--text-secondary)', borderLeft: '2px solid var(--border-active)' }}
          >
            {t(key)}
          </li>
        ))}
      </ul>

      {sections.map((s) => (
        <AboutSection key={s.title} title={s.title} body={s.body} />
      ))}

      <ul className="flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              locale={l.locale}
              className="font-mono-display text-sm font-bold underline underline-offset-2 hover:opacity-80"
              style={{ color: 'var(--accent-amber)' }}
            >
              {l.label} <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AboutSection({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-8">
      <h3
        className="font-mono-display text-base font-bold tracking-tight mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {body}
      </p>
    </div>
  );
}
