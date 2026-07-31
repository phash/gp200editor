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
  'pt-BR': { flag: '🇧🇷', code: 'PT-BR' },
};

// Locales still behind a `beta` badge in the switcher. Remove an entry to
// graduate a locale to stable — one-line change, no config flag. Exported
// so future tests (e.g. sitemap-priority lowering) can read the same set.
export const BETA_LOCALES = new Set<Locale>(['es', 'fr', 'it', 'pt', 'pt-BR']);

// The default locale. Routing runs with localePrefix 'as-needed', so this
// one locale is served from the unprefixed path and its /en/... form only
// redirects there. Keep in sync with defaultLocale in src/i18n/routing.ts —
// the unit tests assert both ends.
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Absolute URL of `path` in `locale`, using the form the server actually
 * serves. English is unprefixed; every other locale carries its prefix.
 *
 * This distinction is the whole point: handing Google `/en/help` as a
 * canonical or hreflang target names a URL that only 307-redirects, which
 * is how the index ended up split between prefixed and unprefixed forms
 * of the same page.
 */
export function localeUrl(locale: Locale, path: string): string {
  const normalized = path === '/' ? '' : path;
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return `${BASE_URL}${prefix}${normalized}`;
}

/**
 * Build an hreflang `languages` map for next.js Metadata.alternates.
 * The path should be the locale-less segment — e.g. "/editor" or
 * "/share/abc123". The helper covers every locale + serves x-default
 * from English.
 */
export function buildHreflang(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const locale of LOCALES) {
    out[locale] = localeUrl(locale, path);
  }
  out['x-default'] = localeUrl(DEFAULT_LOCALE, path);
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
  return {
    canonical: localeUrl(currentLocale, path),
    languages: buildHreflang(path),
  };
}
