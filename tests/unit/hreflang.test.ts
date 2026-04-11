import { describe, it, expect } from 'vitest';
import { buildHreflang, buildAlternates } from '@/lib/hreflang';

describe('buildHreflang', () => {
  it('returns all 6 locale URLs + x-default for a static path', () => {
    const result = buildHreflang('/editor');
    expect(result).toEqual({
      de: 'https://preset-forge.com/de/editor',
      en: 'https://preset-forge.com/en/editor',
      es: 'https://preset-forge.com/es/editor',
      fr: 'https://preset-forge.com/fr/editor',
      it: 'https://preset-forge.com/it/editor',
      pt: 'https://preset-forge.com/pt/editor',
      'x-default': 'https://preset-forge.com/en/editor',
    });
  });

  it('handles root path', () => {
    const result = buildHreflang('/');
    expect(result.en).toBe('https://preset-forge.com/en');
    expect(result['x-default']).toBe('https://preset-forge.com/en');
  });

  it('handles paths with dynamic segments', () => {
    const result = buildHreflang('/share/abc123');
    expect(result.fr).toBe('https://preset-forge.com/fr/share/abc123');
  });
});

describe('buildAlternates', () => {
  it('returns a full alternates object ready for Metadata', () => {
    const result = buildAlternates('/gallery', 'en');
    expect(result.canonical).toBe('https://preset-forge.com/en/gallery');
    expect(result.languages).toHaveProperty('es');
    expect(result.languages?.['x-default']).toBe('https://preset-forge.com/en/gallery');
  });
});
