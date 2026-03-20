import { getTranslations } from 'next-intl/server';

export default async function HelpPage() {
  const t = await getTranslations('help');

  const sections = [
    {
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
      title: t('hxStompTitle'),
      items: [
        t('hxStompLoad'),
        t('hxStompExperimental'),
        t('hxStompWhat'),
      ],
    },
    {
      title: t('usbMidiTitle'),
      items: [
        t('usbMidiBrowser'),
        t('usbMidiConnect'),
        t('usbMidiLive'),
        t('usbMidiPullPush'),
      ],
    },
    {
      title: t('galleryTitle'),
      items: [
        t('galleryUpload'),
        t('galleryShare'),
        t('galleryDownload'),
      ],
    },
    {
      title: t('bankNavTitle'),
      items: [
        t('bankNavTabs'),
        t('bankNavPrevNext'),
      ],
    },
    {
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
      title: t('shortcutsTitle'),
      items: [
        t('shortcutsPlaylistUpDown'),
        t('shortcutsPlaylistLeftRight'),
      ],
    },
  ];

  const faq = [
    { q: t('faqBrowserQ'), a: t('faqBrowserA') },
    { q: t('faqFirmwareQ'), a: t('faqFirmwareA') },
    { q: t('faqFormatQ'), a: t('faqFormatA') },
    { q: t('faqOfflineQ'), a: t('faqOfflineA') },
    { q: t('faqHxStompQ'), a: t('faqHxStompA') },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1
        className="font-mono-display text-2xl font-bold tracking-tight mb-8"
        style={{ color: 'var(--accent-amber)' }}
      >
        {t('title')}
      </h1>

      {sections.map((section) => (
        <section key={section.title} className="mb-8">
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
