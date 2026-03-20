import { getTranslations } from 'next-intl/server';

export default async function LegalPage() {
  const t = await getTranslations('legal');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Impressum */}
      <section className="mb-12">
        <h1
          className="font-mono-display text-2xl font-bold tracking-tight mb-6"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('impressumTitle')}
        </h1>
        <div
          className="rounded-lg p-6 space-y-4 text-sm"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <div>
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('responsible')}
            </p>
            <p>Manuel Rödig</p>
            <p>Tannenweg 6</p>
            <p>85405 Nandlstadt</p>
            <p>{t('country')}</p>
          </div>
          <div>
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('contact')}
            </p>
            <p>
              {t('email')}:{' '}
              <a href="mailto:phash@phash.de" style={{ color: 'var(--accent-amber)' }}>
                phash@phash.de
              </a>
            </p>
          </div>
          <div>
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('contentResponsible')}
            </p>
            <p>{t('contentResponsibleText')}</p>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="mb-12">
        <h2
          className="font-mono-display text-2xl font-bold tracking-tight mb-6"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('disclaimerTitle')}
        </h2>
        {[
          { title: t('liabilityContentTitle'), text: t('liabilityContentText') },
          { title: t('liabilityLinksTitle'), text: t('liabilityLinksText') },
          { title: t('copyrightTitle'), text: t('copyrightText') },
          { title: t('trademarkTitle'), text: t('trademarkText') },
        ].map((item) => (
          <div key={item.title} className="mb-4">
            <h3
              className="font-mono-display text-sm font-bold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {item.title}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {item.text}
            </p>
          </div>
        ))}
      </section>

      {/* Datenschutzerklärung */}
      <section className="mb-12">
        <h2
          className="font-mono-display text-2xl font-bold tracking-tight mb-6"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('privacyTitle')}
        </h2>

        {/* Verantwortlicher */}
        <div className="mb-6">
          <h3
            className="font-mono-display text-sm font-bold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('privacyResponsibleTitle')}
          </h3>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <p>Manuel Rödig</p>
            <p>Tannenweg 6, 85405 Nandlstadt, {t('country')}</p>
            <p>
              {t('email')}:{' '}
              <a href="mailto:phash@phash.de" style={{ color: 'var(--accent-amber)' }}>
                phash@phash.de
              </a>
            </p>
          </div>
        </div>

        {[
          { title: t('privacyOverviewTitle'), text: t('privacyOverviewText') },
          { title: t('privacyRightsTitle'), text: t('privacyRightsText') },
          { title: t('privacyServerLogsTitle'), text: t('privacyServerLogsText') },
          { title: t('privacyCookiesTitle'), text: t('privacyCookiesText') },
          { title: t('privacyAccountTitle'), text: t('privacyAccountText') },
          { title: t('privacyStorageTitle'), text: t('privacyStorageText') },
          { title: t('privacyAnalyticsTitle'), text: t('privacyAnalyticsText') },
          { title: t('privacyEmailTitle'), text: t('privacyEmailText') },
          { title: t('privacySslTitle'), text: t('privacySslText') },
        ].map((item) => (
          <div key={item.title} className="mb-4">
            <h3
              className="font-mono-display text-sm font-bold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {item.title}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {item.text}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
