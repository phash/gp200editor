'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter, usePathname } from '@/i18n/routing';

const LOCALES = [
  { code: 'de', flag: '🇩🇪', label: 'DE' },
  { code: 'en', flag: '🇬🇧', label: 'EN' },
  { code: 'fr', flag: '🇫🇷', label: 'FR' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

export function Navbar() {
  const t = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [localeOpen, setLocaleOpen] = useState(false);
  const localeRef = useRef<HTMLDivElement>(null);

  const currentLocale = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (localeRef.current && !localeRef.current.contains(e.target as Node)) {
        setLocaleOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function switchLocale(code: LocaleCode) {
    router.replace(pathname, { locale: code });
    setLocaleOpen(false);
  }

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { username?: string; role?: string } | null) => {
        setUsername(data?.username ?? null);
        setRole(data?.role ?? null);
        if (data?.role === 'ADMIN') {
          fetch('/api/admin/stats')
            .then((r) => (r.ok ? r.json() : null))
            .then((stats: { errorCount?: number } | null) => setErrorCount(stats?.errorCount ?? 0))
            .catch(() => setErrorCount(0));
        }
      })
      .catch(() => { setUsername(null); setRole(null); });
  }, [pathname]);

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
      className="relative flex items-center justify-between px-6 py-3 border-b"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center gap-3">
        <Link href="/" className="font-mono-display text-lg font-bold tracking-tight" data-testid="nav-home-link"
          style={{ color: 'var(--accent-amber)' }}>
          {t('title')}
        </Link>
        <span className="hidden sm:inline font-mono-display text-[10px] tracking-wider uppercase px-1.5 py-0.5 rounded"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
          FW 1.8.0
        </span>
      </div>
      {/* Hamburger button — mobile only */}
      <button
        className="md:hidden flex flex-col gap-1 p-1"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Menu"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span className="block w-5 h-0.5" style={{ background: 'currentColor' }} />
        <span className="block w-5 h-0.5" style={{ background: 'currentColor' }} />
        <span className="block w-5 h-0.5" style={{ background: 'currentColor' }} />
      </button>

      {/* Desktop nav links */}
      <div className="hidden md:flex gap-5 items-center text-sm">
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
        <Link href="/playlists" className="transition-colors hover:text-[var(--accent-amber)]"
          style={{ color: pathname === '/playlists' ? 'var(--accent-amber)' : 'var(--text-secondary)' }}
          data-testid="nav-link-playlists">
          {t('playlists')}
        </Link>
        <Link href="/gallery" className="transition-colors hover:text-[var(--accent-amber)]"
          style={{ color: pathname === '/gallery' ? 'var(--accent-amber)' : 'var(--text-secondary)' }}
          data-testid="nav-link-gallery">
          {t('gallery')}
        </Link>
        <Link href="/help" className="transition-colors hover:text-[var(--accent-amber)]"
          style={{ color: pathname === '/help' ? 'var(--accent-amber)' : 'var(--text-secondary)' }}
          data-testid="nav-link-help">
          {t('help')}
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
          href="https://discord.gg/8V4bVtXw"
          target="_blank"
          rel="noopener noreferrer"
          title="Feedback & Community"
          className="font-mono-display text-xs px-2.5 py-1 rounded transition-all flex items-center gap-1"
          style={{
            border: '1px solid rgba(88,101,242,0.3)',
            color: '#5865F2',
            background: 'rgba(88,101,242,0.08)',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(88,101,242,0.2)';
            e.currentTarget.style.boxShadow = '0 0 8px rgba(88,101,242,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(88,101,242,0.08)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <svg width="16" height="12" viewBox="0 0 127.14 96.36" fill="currentColor">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53.19s5-12.5,11.45-12.5S54,46.36,53.89,53.19,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53.19s5-12.5,11.44-12.5S96.23,46.36,96.12,53.19,91.08,65.69,84.69,65.69Z"/>
          </svg>
        </a>
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
        <div ref={localeRef} className="relative" suppressHydrationWarning>
          <button
            onClick={() => setLocaleOpen((o) => !o)}
            aria-label={t('switchLocale')}
            data-testid="nav-locale-switcher"
            className="font-mono-display text-xs px-2.5 py-1 rounded transition-all flex items-center gap-1.5"
            style={{
              border: `1px solid ${localeOpen ? 'var(--accent-amber)' : 'var(--border-active)'}`,
              color: localeOpen ? 'var(--accent-amber)' : 'var(--text-secondary)',
            }}
          >
            <span>{currentLocale.flag}</span>
            <span>{currentLocale.label}</span>
            <span style={{ fontSize: '8px', opacity: 0.7 }}>▼</span>
          </button>
          {localeOpen && (
            <div
              className="absolute right-0 top-full mt-1 rounded overflow-hidden z-50 flex flex-col"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-active)',
                minWidth: '80px',
              }}
            >
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => switchLocale(l.code)}
                  className="font-mono-display text-xs px-3 py-1.5 flex items-center gap-2 transition-colors text-left"
                  style={{
                    color: l.code === locale ? 'var(--accent-amber)' : 'var(--text-secondary)',
                    background: l.code === locale ? 'rgba(245,158,11,0.1)' : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (l.code !== locale) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={(e) => { if (l.code !== locale) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {role === 'ADMIN' && (
          <Link href="/admin" className="font-mono-display text-xs px-2.5 py-1 rounded transition-all relative"
            style={{
              border: '1px solid rgba(245,158,11,0.3)',
              color: 'var(--accent-amber)',
              background: pathname === '/admin' ? 'rgba(245,158,11,0.15)' : 'transparent',
            }}
            data-testid="nav-link-admin">
            {t('admin')}
            {errorCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
            )}
          </Link>
        )}
      </div>

      {/* Mobile nav menu */}
      {mobileOpen && (
        <div
          className="md:hidden absolute top-full left-0 right-0 flex flex-col gap-3 px-6 py-4 text-sm z-40"
          style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <Link href="/" onClick={() => setMobileOpen(false)} className="transition-colors hover:text-[var(--accent-amber)]"
            style={{ color: pathname === '/' ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>
            {t('home')}
          </Link>
          <Link href="/editor" onClick={() => setMobileOpen(false)} className="transition-colors hover:text-[var(--accent-amber)]"
            style={{ color: pathname === '/editor' ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>
            {t('editor')}
          </Link>
          <Link href="/playlists" onClick={() => setMobileOpen(false)} className="transition-colors hover:text-[var(--accent-amber)]"
            style={{ color: pathname === '/playlists' ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>
            {t('playlists')}
          </Link>
          <Link href="/gallery" onClick={() => setMobileOpen(false)} className="transition-colors hover:text-[var(--accent-amber)]"
            style={{ color: pathname === '/gallery' ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>
            {t('gallery')}
          </Link>
          <Link href="/help" onClick={() => setMobileOpen(false)} className="transition-colors hover:text-[var(--accent-amber)]"
            style={{ color: pathname === '/help' ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>
            {t('help')}
          </Link>
          {role === 'ADMIN' && (
            <Link href="/admin" onClick={() => setMobileOpen(false)}
              className="transition-colors hover:text-[var(--accent-amber)] relative"
              style={{ color: pathname === '/admin' ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>
              {t('admin')}
              {errorCount > 0 && (
                <span className="inline-block w-2 h-2 rounded-full ml-1" style={{ background: '#ef4444' }} />
              )}
            </Link>
          )}
          {username ? (
            <>
              <Link href="/profile" onClick={() => setMobileOpen(false)} className="transition-colors hover:text-[var(--accent-amber)]"
                style={{ color: 'var(--text-secondary)' }}>
                {t('profile')}
              </Link>
              <Link href="/presets" onClick={() => setMobileOpen(false)} className="transition-colors hover:text-[var(--accent-amber)]"
                style={{ color: 'var(--text-secondary)' }}>
                {t('presets')}
              </Link>
              <button onClick={() => { setMobileOpen(false); handleLogout(); }}
                className="text-left transition-colors hover:text-[var(--accent-amber)]"
                style={{ color: 'var(--text-secondary)' }}>
                {t('logout')}
              </button>
            </>
          ) : (
            <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="transition-colors hover:text-[var(--accent-amber)]"
              style={{ color: 'var(--text-secondary)' }}>
              {tAuth('login')}
            </Link>
          )}
          <div className="flex gap-2 items-center pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => { switchLocale(l.code); setMobileOpen(false); }}
                className="font-mono-display text-xs px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors"
                style={{
                  border: `1px solid ${l.code === locale ? 'var(--accent-amber)' : 'var(--border-active)'}`,
                  color: l.code === locale ? 'var(--accent-amber)' : 'var(--text-secondary)',
                }}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
