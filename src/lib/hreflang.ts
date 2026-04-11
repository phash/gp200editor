import type { Metadata } from 'next';
import { LOCALES, type Locale } from '@/i18n/locales';

// Prod domain — `www.` is canonical per the DNS + Caddy setup. Hreflang
// and OG URLs must match so Google doesn't treat apex and www as duplicates.
export const BASE_URL = 'https://www.preset-forge.com';

// Re-export so existing call sites importing from @/lib/hreflang keep working.
export { LOCALES, type Locale };

// UI presentation data for the locale switcher and mobile flag row. Lives
// here (not in a component file) so sitemap, switcher, Navbar, and any
// future SEO helper all read from one source of truth. Adding a locale is
// a two-line change: one entry here and one in LOCALES above.
export const LOCALE_META: Record<Locale, { flag: string; code: string }> = {
  de: { flag: '🇩🇪', code: 'DE' },
  en: { flag: '🇬🇧', code: 'EN' },
  es: { flag: '🇪🇸', code: 'ES' },
  fr: { flag: '🇫🇷', code: 'FR' },
  it: { flag: '🇮🇹', code: 'IT' },
  pt: { flag: '🇵🇹', code: 'PT' },
};

// Locales still behind a `beta` badge in the switcher. Remove an entry to
// graduate a locale to stable — one-line change, no config flag. Exported
// so future tests (e.g. sitemap-priority lowering) can read the same set.
export const BETA_LOCALES = new Set<Locale>(['es', 'fr', 'it', 'pt']);

/**
 * Build an hreflang `languages` map for next.js Metadata.alternates.
 * The path should be the locale-less segment — e.g. "/editor" or
 * "/share/abc123". The helper prefixes every locale + serves x-default
 * from English.
 */
export function buildHreflang(path: string): Record<string, string> {
  const normalized = path === '/' ? '' : path;
  const out: Record<string, string> = {};
  for (const locale of LOCALES) {
    out[locale] = `${BASE_URL}/${locale}${normalized}`;
  }
  out['x-default'] = `${BASE_URL}/en${normalized}`;
  return out;
}

/**
 * Convenience wrapper that returns a full { canonical, languages } block
 * suitable for dropping into a generateMetadata return value.
 */
export function buildAlternates(
  path: string,
  currentLocale: Locale,
): NonNullable<Metadata['alternates']> {
  const normalized = path === '/' ? '' : path;
  return {
    canonical: `${BASE_URL}/${currentLocale}${normalized}`,
    languages: buildHreflang(path),
  };
}
