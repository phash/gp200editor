import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export function Footer() {
  const t = useTranslations('footer');
  return (
    <footer
      role="contentinfo"
      className="px-6 py-3 text-xs text-center"
      style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}
      data-testid="footer"
    >
      {t('disclaimer')}
      <span style={{ margin: '0 8px' }}>·</span>
      <Link
        href="/legal"
        style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}
      >
        {t('legal')}
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
      <span style={{ margin: '0 8px' }}>·</span>
      <a
        href="https://buymeacoffee.com/phash"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#ffdd33', textDecoration: 'underline' }}
      >
        ☕ Buy me a coffee
      </a>
    </footer>
  );
}
