'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';

type Locale = 'de' | 'en' | 'es' | 'fr' | 'it' | 'pt';

// Flag emoji + ISO code. Remove a locale from BETA_LOCALES to drop its
// "beta" badge — that's the entire rollout mechanism, no config flag.
const LOCALE_META: Record<Locale, { flag: string; code: string }> = {
  de: { flag: '🇩🇪', code: 'DE' },
  en: { flag: '🇬🇧', code: 'EN' },
  es: { flag: '🇪🇸', code: 'ES' },
  fr: { flag: '🇫🇷', code: 'FR' },
  it: { flag: '🇮🇹', code: 'IT' },
  pt: { flag: '🇵🇹', code: 'PT' },
};

const LOCALE_ORDER: Locale[] = ['de', 'en', 'es', 'fr', 'it', 'pt'];
const BETA_LOCALES = new Set<Locale>(['es', 'fr', 'it', 'pt']);

export function LocaleSwitcher() {
  const t = useTranslations('nav');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  const current = LOCALE_META[locale];

  function choose(target: Locale) {
    setOpen(false);
    if (target !== locale) {
      router.replace(pathname, { locale: target });
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('switchLocale')}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="locale-switcher-trigger"
        className="font-mono-display text-xs px-2.5 py-1 rounded transition-all flex items-center gap-1.5"
        style={{
          border: '1px solid var(--border-active)',
          color: 'var(--text-secondary)',
        }}
      >
        <span aria-hidden="true">{current.flag}</span>
        <span>{current.code}</span>
        <span aria-hidden="true" className="opacity-70">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 min-w-[140px] rounded py-1 z-50"
          style={{
            background: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          {LOCALE_ORDER.map((l) => {
            const meta = LOCALE_META[l];
            const isActive = l === locale;
            return (
              <button
                key={l}
                role="menuitem"
                onClick={() => choose(l)}
                className="w-full text-left px-3 py-1.5 text-xs font-mono-display flex items-center gap-2 transition-colors hover:!bg-[var(--glow-amber)]"
                style={{
                  color: isActive ? 'var(--accent-amber)' : 'var(--text-secondary)',
                }}
              >
                <span aria-hidden="true">{meta.flag}</span>
                <span>{meta.code}</span>
                {BETA_LOCALES.has(l) && (
                  <span
                    className="ml-auto text-[9px] uppercase tracking-wider opacity-60"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    beta
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
