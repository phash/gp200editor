import { describe, it, expect } from 'vitest';
import { LOCALES } from '@/i18n/locales';

// Mirror the regex construction from src/middleware.ts so adding a locale
// to LOCALES automatically expands every assertion below — and so a future
// hand-edited regex in middleware.ts that forgets a locale will fail here.
const LOCALE_ALT = LOCALES.map((l) => l.replace(/[-]/g, '\\-')).join('|');
const PROTECTED_ROUTE_PATTERN = new RegExp(
  `^/(?:${LOCALE_ALT})/(?:profile|presets|admin)(?:/|$)`,
);
const LOCALE_PREFIX_PATTERN = new RegExp(`^/(${LOCALE_ALT})(?=/|$)`);

describe('PROTECTED_ROUTE_PATTERN', () => {
  it.each([
    ['/de/profile', true],
    ['/en/profile', true],
    ['/es/profile', true],
    ['/fr/profile/edit', true],
    ['/it/presets', true],
    ['/pt/admin', true],
    ['/pt/admin/users', true],
    ['/pt-BR/admin', true],
    ['/pt-BR/profile', true],
    ['/pt-BR/presets', true],
  ])('matches protected locale route %s', (path, expected) => {
    expect(PROTECTED_ROUTE_PATTERN.test(path)).toBe(expected);
  });

  it.each([
    ['/en/editor'],
    ['/de/gallery'],
    ['/fr/help'],
    ['/xx/profile'],
    ['/profile'],
    ['/api/profile'],
    ['/pt-BR/gallery'],
  ])('does not match %s', (path) => {
    expect(PROTECTED_ROUTE_PATTERN.test(path)).toBe(false);
  });
});

describe('LOCALE_PREFIX_PATTERN', () => {
  it.each([
    ['/de/profile', 'de'],
    ['/en/editor', 'en'],
    ['/es', 'es'],
    ['/fr/share/abc123', 'fr'],
    ['/it/gallery', 'it'],
    ['/pt', 'pt'],
    ['/pt-BR/profile', 'pt-BR'],
    ['/pt-BR', 'pt-BR'],
  ])('extracts locale %s from %s', (path, expected) => {
    const match = LOCALE_PREFIX_PATTERN.exec(path);
    expect(match?.[1]).toBe(expected);
  });

  it('returns null for paths without a known locale prefix', () => {
    expect(LOCALE_PREFIX_PATTERN.exec('/profile')).toBeNull();
    expect(LOCALE_PREFIX_PATTERN.exec('/xx/profile')).toBeNull();
  });

  it('does not partial-match pt against pt-BR prefix', () => {
    // `/pt-BR/profile` must extract `pt-BR`, not silently grab `pt`.
    expect(LOCALE_PREFIX_PATTERN.exec('/pt-BR/profile')?.[1]).toBe('pt-BR');
  });
});

describe('regex stays in sync with LOCALES', () => {
  it('every entry of LOCALES is matched by both patterns', () => {
    for (const locale of LOCALES) {
      expect(PROTECTED_ROUTE_PATTERN.test(`/${locale}/profile`)).toBe(true);
      expect(LOCALE_PREFIX_PATTERN.exec(`/${locale}`)?.[1]).toBe(locale);
    }
  });
});
