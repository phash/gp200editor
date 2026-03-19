import { useTranslations } from 'next-intl';

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
      <a
        href="https://buymeacoffee.com/phash"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--accent-amber)', textDecoration: 'none' }}
      >
        Buy me a coffee
      </a>
    </footer>
  );
}
