import type { Metadata } from 'next';

export const BASE_URL = 'https://preset-forge.com';

export const LOCALES = ['de', 'en', 'es', 'fr', 'it', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];

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
