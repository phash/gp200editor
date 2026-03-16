import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('footer');
  return (
    <footer
      role="contentinfo"
      className="px-6 py-4 bg-gray-900 text-gray-400 text-sm text-center"
      data-testid="footer"
    >
      {t('disclaimer')}
    </footer>
  );
}
