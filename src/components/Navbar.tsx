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
      className="flex items-center justify-between px-6 py-3 border-b"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
    >
      <Link href="/" className="font-mono-display text-lg font-bold tracking-tight" data-testid="nav-home-link"
        style={{ color: 'var(--accent-amber)' }}>
        {t('title')}
      </Link>
      <div className="flex gap-5 items-center text-sm">
        <Link href="/" className="transition-colors hover:text-[var(--accent-amber)]"
          style={{ color: pathname === '/' ? 'var(--accent-amber)' : 'var(--text-secondary)' }}
          data-testid="nav-link-home">
          {t('home')}
        </Link>
        <Link href="/editor" className="transition-colors hover:text-[var(--accent-amber)]"
          style={{ color: pathname === '/editor' ? 'var(--accent-amber)' : 'var(--text-secondary)' }}
          data-testid="nav-link-editor">
          {t('editor')}
        </Link>
        <Link href="/gallery" className="transition-colors hover:text-[var(--accent-amber)]"
          style={{ color: pathname === '/gallery' ? 'var(--accent-amber)' : 'var(--text-secondary)' }}
          data-testid="nav-link-gallery">
          {t('gallery')}
        </Link>
        {username ? (
          <>
            <Link href="/profile" className="transition-colors hover:text-[var(--accent-amber)]"
              style={{ color: 'var(--text-secondary)' }} data-testid="nav-link-profile">
              {t('profile')}
            </Link>
            <Link href="/presets" className="transition-colors hover:text-[var(--accent-amber)]"
              style={{ color: 'var(--text-secondary)' }} data-testid="nav-link-presets">
              {t('presets')}
            </Link>
            <button onClick={handleLogout} data-testid="nav-logout"
              className="transition-colors hover:text-[var(--accent-amber)]"
              style={{ color: 'var(--text-secondary)' }}>
              {t('logout')}
            </button>
          </>
        ) : (
          <Link href="/auth/login" className="transition-colors hover:text-[var(--accent-amber)]"
            style={{ color: 'var(--text-secondary)' }} data-testid="nav-link-login">
            {tAuth('login')}
          </Link>
        )}
        <a
          href="https://buymeacoffee.com/phash"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono-display text-xs px-2.5 py-1 rounded transition-all"
          style={{
            border: '1px solid rgba(255,221,51,0.3)',
            color: '#ffdd33',
            background: 'rgba(255,221,51,0.08)',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,221,51,0.2)';
            e.currentTarget.style.boxShadow = '0 0 8px rgba(255,221,51,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,221,51,0.08)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          ☕
        </a>
        <button
          onClick={switchLocale}
          aria-label={`Switch to ${otherLocale.toUpperCase()}`}
          data-testid="nav-locale-switcher"
          className="font-mono-display text-xs px-2.5 py-1 rounded transition-all"
          style={{
            border: '1px solid var(--border-active)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-amber)';
            e.currentTarget.style.color = 'var(--accent-amber)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-active)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          {otherLocale.toUpperCase()}
        </button>
      </div>
    </nav>
  );
}
