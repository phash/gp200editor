'use client';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter, usePathname } from '@/i18n/routing';

export function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const otherLocale = locale === 'de' ? 'en' : 'de';

  function switchLocale() {
    // next-intl router.replace with locale option — no fragile string.replace
    router.replace(pathname, { locale: otherLocale });
  }

  return (
    <nav
      role="navigation"
      aria-label={t('title')}
      className="flex items-center justify-between px-6 py-4 bg-gray-900 text-white"
    >
      <Link
        href="/"
        className="text-xl font-bold"
        data-testid="nav-home-link"
      >
        {t('title')}
      </Link>
      <div className="flex gap-4 items-center">
        <Link
          href="/"
          className="hover:underline"
          data-testid="nav-link-home"
        >
          {t('home')}
        </Link>
        <Link
          href="/editor"
          className="hover:underline"
          data-testid="nav-link-editor"
        >
          {t('editor')}
        </Link>
        <button
          onClick={switchLocale}
          aria-label={`Switch to ${otherLocale.toUpperCase()}`}
          data-testid="nav-locale-switcher"
          className="px-3 py-1 border border-white rounded hover:bg-white hover:text-gray-900 transition"
        >
          {otherLocale.toUpperCase()}
        </button>
      </div>
    </nav>
  );
}
