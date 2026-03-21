import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help & FAQ — GP-200 Editor, Linux Support, USB MIDI | Preset Forge',
  description: 'How to use Preset Forge: load and edit GP-200 presets, connect via USB MIDI, import HX Stomp presets, build live setlists. Works on Linux (tested on Linux Mint), Windows, and macOS.',
  openGraph: {
    title: 'Help & FAQ — GP-200 Preset Editor | Preset Forge',
    description: 'Complete guide to Preset Forge: GP-200 preset editing, Linux support (Linux Mint tested), USB MIDI live editing, HX Stomp import, live setlists with cue points.',
  },
};

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
        t('usbMidiPullPush'),
      ],
    },
    {
      id: 'gallery',
      title: t('galleryTitle'),
      items: [
        t('galleryUpload'),
        t('galleryShare'),
        t('galleryDownload'),
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

  // JSON-LD: static translation strings only, not user input — safe
  const faqJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
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
    </div>
  );
}
