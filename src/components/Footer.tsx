import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export function Footer() {
  const t = useTranslations('footer');
  return (
    <footer
      role="contentinfo"
      className="px-6 py-4 text-xs text-center"
      style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}
      data-testid="footer"
    >
      <div className="mb-3">
        <a
          href="https://buymeacoffee.com/phash"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="footer-support-cta"
          className="inline-flex items-center gap-2 font-mono-display text-sm font-bold px-5 py-2 rounded transition-all bg-[rgba(255,221,51,0.08)] hover:bg-[rgba(255,221,51,0.2)] hover:shadow-[0_0_12px_rgba(255,221,51,0.4)]"
          style={{
            border: '1px solid rgba(255,221,51,0.4)',
            color: '#ffdd33',
            textDecoration: 'none',
          }}
        >
          <span aria-hidden="true">🎸</span>
          {t('supportCta')}
        </a>
      </div>
      {t('disclaimer')}
      <span style={{ margin: '0 8px' }}>·</span>
      <Link
        href="/legal"
        style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}
      >
        {t('legal')}
      </Link>
      <span style={{ margin: '0 8px' }}>·</span>
      <Link
        href="/guides"
        style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}
      >
        {t('guides')}
      </Link>
      <span style={{ margin: '0 8px' }}>·</span>
      {t('poweredBy')}{' '}
      <a
        href="https://phash.de"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--accent-amber)', textDecoration: 'underline' }}
      >
        phash.de
      </a>
      <span style={{ margin: '0 8px' }}>·</span>
      <a
        href="mailto:phash@phash.de"
        style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
      >
        Contact
      </a>
    </footer>
  );
}
