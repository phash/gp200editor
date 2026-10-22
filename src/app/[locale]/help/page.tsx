import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { buildAlternates, BASE_URL, type Locale } from '@/lib/hreflang';
import { serializeJsonLd } from '@/lib/jsonLd';
import { Link } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'help' });
  const title = t('metaTitle');
  const description = t('metaDescription');
  return {
    title,
    description,
    alternates: buildAlternates('/help', locale as Locale),
    openGraph: {
      title,
      description,
      images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
  };
}

export default async function HelpPage() {
  const t = await getTranslations('help');

  const sections: { id: string; title: string; items: string[] }[] = [
    {
      id: 'editor',
      title: t('gettingStartedTitle'),
      items: [
        t('gettingStartedLoad'),
        t('gettingStartedEdit'),
        t('gettingStartedSave'),
        t('gettingStartedReorder'),
        t('gettingStartedAuthor'),
      ],
    },
    {
      id: 'hlx-import',
      title: t('hxStompTitle'),
      items: [
        t('hxStompLoad'),
        t('hxStompExperimental'),
        t('hxStompWhat'),
      ],
    },
    {
      id: 'midi',
      title: t('usbMidiTitle'),
      items: [
        t('usbMidiBrowser'),
        t('usbMidiConnect'),
        t('usbMidiLive'),
        t('usbMidiLoadPush'),
        t('usbMidiPullPush'),
        t('usbMidiNameEdit'),
      ],
    },
    {
      id: 'controllers',
      title: t('controllersTitle'),
      items: [
        t('controllersDesc'),
      ],
    },
    {
      id: 'gallery',
      title: t('galleryTitle'),
      items: [
        t('galleryUpload'),
        t('galleryShare'),
        t('galleryDownload'),
        t('galleryAudio'),
        t('galleryComments'),
      ],
    },
    {
      id: 'bank-nav',
      title: t('bankNavTitle'),
      items: [
        t('bankNavTabs'),
        t('bankNavPrevNext'),
      ],
    },
    {
      id: 'playlists',
      title: t('playlistsTitle'),
      items: [
        t('playlistsCreate'),
        t('playlistsSlots'),
        t('playlistsCuePoints'),
        t('playlistsCountIn'),
        t('playlistsReconnect'),
      ],
    },
    {
      id: 'shortcuts',
      title: t('shortcutsTitle'),
      items: [
        t('shortcutsPlaylistUpDown'),
        t('shortcutsPlaylistLeftRight'),
        t('shortcutsEffectReorder'),
      ],
    },
  ];

  const faq = [
    { q: t('faqLinuxQ'), a: t('faqLinuxA') },
    { q: t('faqBrowserQ'), a: t('faqBrowserA') },
    { q: t('faqFirmwareQ'), a: t('faqFirmwareA') },
    { q: t('faqFormatQ'), a: t('faqFormatA') },
    { q: t('faqOfflineQ'), a: t('faqOfflineA') },
    { q: t('faqHxStompQ'), a: t('faqHxStompA') },
  ];

  // Pointer sections to standalone pages (guides, changelog) — rendered after
  // the FAQ with a link instead of duplicating their content here.
  const pointers = [
    { id: 'guides', title: t('guidesTitle'), desc: t('guidesDesc'), href: '/guides', label: t('guidesLink') },
    { id: 'changelog', title: t('changelogTitle'), desc: t('changelogDesc'), href: '/changelog', label: t('changelogLink') },
  ] as const;

  // JSON-LD: static translation strings only. Emitted as a single @graph with
  // the FAQPage plus one HowTo per procedural section, so answer engines / LLMs
  // can extract both the Q&A and the ordered step lists. Routed through
  // serializeJsonLd per project convention (escapes </script> + U+2028/9).
  const jsonLd = serializeJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: faq.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
      ...sections.map((section) => ({
        '@type': 'HowTo',
        name: section.title,
        step: section.items.map((text, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          text,
        })),
      })),
    ],
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <h1
        className="font-mono-display text-2xl font-bold tracking-tight mb-8"
        style={{ color: 'var(--accent-amber)' }}
      >
        {t('title')}
      </h1>

      {sections.map((section) => (
        <section key={section.id} id={section.id} className="mb-8">
          <h2
            className="font-mono-display text-lg font-bold tracking-tight mb-3"
            style={{ color: 'var(--accent-amber)' }}
          >
            {section.title}
          </h2>
          <ul className="space-y-2">
            {section.items.map((item) => (
              <li
                key={item}
                className="text-sm pl-4"
                style={{
                  color: 'var(--text-secondary)',
                  borderLeft: '2px solid var(--border-active)',
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mb-8">
        <h2
          className="font-mono-display text-lg font-bold tracking-tight mb-4"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('faqTitle')}
        </h2>
        <div className="space-y-4">
          {faq.map((entry) => (
            <div
              key={entry.q}
              className="rounded-lg p-4"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <h3
                className="font-mono-display text-sm font-bold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                {entry.q}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {entry.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {pointers.map((p) => (
        <section key={p.id} id={p.id} className="mb-8">
          <h2
            className="font-mono-display text-lg font-bold tracking-tight mb-3"
            style={{ color: 'var(--accent-amber)' }}
          >
            {p.title}
          </h2>
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            {p.desc}
          </p>
          <Link
            href={p.href}
            className="font-mono-display text-sm font-bold underline underline-offset-2 hover:opacity-80"
            style={{ color: 'var(--accent-amber)' }}
          >
            {p.label} <span aria-hidden="true">→</span>
          </Link>
        </section>
      ))}
    </div>
  );
}
