'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter, usePathname } from '@/i18n/routing';

export function Navbar() {
  const t = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);

  const otherLocale = locale === 'de' ? 'en' : 'de';

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { username?: string } | null) =>
        setUsername(data?.username ?? null),
      )
      .catch(() => setUsername(null));
  }, [pathname]);

  function switchLocale() {
    router.replace(pathname, { locale: otherLocale });
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUsername(null);
    router.push('/');
    router.refresh();
  }

  return (
    <nav
      role="navigation"
      aria-label={t('title')}
      className="flex items-center justify-between px-6 py-4 bg-gray-900 text-white"
    >
      <Link href="/" className="text-xl font-bold" data-testid="nav-home-link">
        {t('title')}
      </Link>
      <div className="flex gap-4 items-center">
        <Link href="/" className="hover:underline" data-testid="nav-link-home">
          {t('home')}
        </Link>
        <Link href="/editor" className="hover:underline" data-testid="nav-link-editor">
          {t('editor')}
        </Link>
        {username ? (
          <>
            <Link href="/profile" className="hover:underline" data-testid="nav-link-profile">
              {t('profile')}
            </Link>
            <Link href="/presets" className="hover:underline" data-testid="nav-link-presets">
              {t('presets')}
            </Link>
            <button
              onClick={handleLogout}
              data-testid="nav-logout"
              className="hover:underline text-sm"
            >
              {t('logout')}
            </button>
          </>
        ) : (
          <Link href="/auth/login" className="hover:underline" data-testid="nav-link-login">
            {tAuth('login')}
          </Link>
        )}
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
