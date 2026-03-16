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
    </footer>
  );
}
