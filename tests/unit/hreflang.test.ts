import { describe, it, expect } from 'vitest';
import { buildHreflang, buildAlternates, localeUrl } from '@/lib/hreflang';

// English is the default locale and routing runs with localePrefix
// 'as-needed', so English lives at the unprefixed path and /en/... only
// redirects there. Every URL we hand Google must be the served one.
describe('localeUrl', () => {
  it('leaves English unprefixed', () => {
    expect(localeUrl('en', '/editor')).toBe('https://www.preset-forge.com/editor');
  });

  it('prefixes every other locale', () => {
    expect(localeUrl('de', '/editor')).toBe('https://www.preset-forge.com/de/editor');
    expect(localeUrl('pt-BR', '/editor')).toBe('https://www.preset-forge.com/pt-BR/editor');
  });

  it('renders the English root as the bare origin', () => {
    expect(localeUrl('en', '/')).toBe('https://www.preset-forge.com');
    expect(localeUrl('de', '/')).toBe('https://www.preset-forge.com/de');
  });
});

describe('buildHreflang', () => {
  it('returns all 7 locale URLs + x-default for a static path', () => {
    const result = buildHreflang('/editor');
    expect(result).toEqual({
      de: 'https://www.preset-forge.com/de/editor',
      en: 'https://www.preset-forge.com/editor',
      es: 'https://www.preset-forge.com/es/editor',
      fr: 'https://www.preset-forge.com/fr/editor',
      it: 'https://www.preset-forge.com/it/editor',
      pt: 'https://www.preset-forge.com/pt/editor',
      'pt-BR': 'https://www.preset-forge.com/pt-BR/editor',
      'x-default': 'https://www.preset-forge.com/editor',
    });
  });

  it('handles root path', () => {
    const result = buildHreflang('/');
    expect(result.en).toBe('https://www.preset-forge.com');
    expect(result['x-default']).toBe('https://www.preset-forge.com');
    expect(result.de).toBe('https://www.preset-forge.com/de');
  });

  it('handles paths with dynamic segments', () => {
    const result = buildHreflang('/share/abc123');
    expect(result.fr).toBe('https://www.preset-forge.com/fr/share/abc123');
  });
});

describe('buildAlternates', () => {
  it('returns a full alternates object ready for Metadata', () => {
    const result = buildAlternates('/gallery', 'en');
    expect(result.canonical).toBe('https://www.preset-forge.com/gallery');
    expect(result.languages).toHaveProperty('es');
    expect(result.languages?.['x-default']).toBe('https://www.preset-forge.com/gallery');
  });

  it('accepts the root path "/"', () => {
    const result = buildAlternates('/', 'de');
    expect(result.canonical).toBe('https://www.preset-forge.com/de');
    expect(result.languages?.en).toBe('https://www.preset-forge.com');
  });

  it('never canonicalises to a URL that only redirects', () => {
    // /en/... 307s to the unprefixed path under localePrefix 'as-needed'.
    // A canonical pointing at a redirect is the bug this replaces.
    for (const path of ['/', '/editor', '/gallery', '/share/abc123']) {
      expect(buildAlternates(path, 'en').canonical).not.toMatch(/preset-forge\.com\/en(\/|$)/);
    }
  });
});

// Edge cases for buildHreflang that aren't obvious from the happy-path tests
describe('buildHreflang edge cases', () => {
  it('handles deeply nested paths', () => {
    const result = buildHreflang('/amp/marshall-jcm800');
    expect(result.de).toBe('https://www.preset-forge.com/de/amp/marshall-jcm800');
    expect(result['x-default']).toBe('https://www.preset-forge.com/amp/marshall-jcm800');
  });

  it('does not strip trailing slashes (caller responsibility)', () => {
    // The helper is intentionally dumb — trailing slashes are preserved.
    // Pages should normalize paths before calling if they care about
    // canonicalization.
    const result = buildHreflang('/editor/');
    expect(result.en).toBe('https://www.preset-forge.com/editor/');
  });

  it('passes query strings through (caller responsibility)', () => {
    const result = buildHreflang('/share/abc?debug=1');
    expect(result.fr).toBe('https://www.preset-forge.com/fr/share/abc?debug=1');
  });

  it('returns 8 entries — 7 locales + x-default', () => {
    const result = buildHreflang('/editor');
    expect(Object.keys(result).length).toBe(8);
    expect(Object.keys(result).sort()).toEqual(
      ['de', 'en', 'es', 'fr', 'it', 'pt', 'pt-BR', 'x-default'].sort(),
    );
  });
});
