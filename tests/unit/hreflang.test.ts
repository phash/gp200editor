import { describe, it, expect } from 'vitest';
import { buildHreflang, buildAlternates } from '@/lib/hreflang';

describe('buildHreflang', () => {
  it('returns all 6 locale URLs + x-default for a static path', () => {
    const result = buildHreflang('/editor');
    expect(result).toEqual({
      de: 'https://www.preset-forge.com/de/editor',
      en: 'https://www.preset-forge.com/en/editor',
      es: 'https://www.preset-forge.com/es/editor',
      fr: 'https://www.preset-forge.com/fr/editor',
      it: 'https://www.preset-forge.com/it/editor',
      pt: 'https://www.preset-forge.com/pt/editor',
      'x-default': 'https://www.preset-forge.com/en/editor',
    });
  });

  it('handles root path', () => {
    const result = buildHreflang('/');
    expect(result.en).toBe('https://www.preset-forge.com/en');
    expect(result['x-default']).toBe('https://www.preset-forge.com/en');
  });

  it('handles paths with dynamic segments', () => {
    const result = buildHreflang('/share/abc123');
    expect(result.fr).toBe('https://www.preset-forge.com/fr/share/abc123');
  });
});

describe('buildAlternates', () => {
  it('returns a full alternates object ready for Metadata', () => {
    const result = buildAlternates('/gallery', 'en');
    expect(result.canonical).toBe('https://www.preset-forge.com/en/gallery');
    expect(result.languages).toHaveProperty('es');
    expect(result.languages?.['x-default']).toBe('https://www.preset-forge.com/en/gallery');
  });

  it('accepts the root path "/"', () => {
    const result = buildAlternates('/', 'de');
    expect(result.canonical).toBe('https://www.preset-forge.com/de');
    expect(result.languages?.en).toBe('https://www.preset-forge.com/en');
  });
});

// Edge cases for buildHreflang that aren't obvious from the happy-path tests
describe('buildHreflang edge cases', () => {
  it('handles deeply nested paths', () => {
    const result = buildHreflang('/amp/marshall-jcm800');
    expect(result.de).toBe('https://www.preset-forge.com/de/amp/marshall-jcm800');
    expect(result['x-default']).toBe('https://www.preset-forge.com/en/amp/marshall-jcm800');
  });

  it('does not strip trailing slashes (caller responsibility)', () => {
    // The helper is intentionally dumb — trailing slashes are preserved.
    // Pages should normalize paths before calling if they care about
    // canonicalization.
    const result = buildHreflang('/editor/');
    expect(result.en).toBe('https://www.preset-forge.com/en/editor/');
  });

  it('passes query strings through (caller responsibility)', () => {
    const result = buildHreflang('/share/abc?debug=1');
    expect(result.fr).toBe('https://www.preset-forge.com/fr/share/abc?debug=1');
  });

  it('returns 7 entries — 6 locales + x-default', () => {
    const result = buildHreflang('/editor');
    expect(Object.keys(result).length).toBe(7);
    expect(Object.keys(result).sort()).toEqual(
      ['de', 'en', 'es', 'fr', 'it', 'pt', 'x-default'].sort(),
    );
  });
});
