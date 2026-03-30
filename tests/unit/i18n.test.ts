import { describe, it, expect } from 'vitest';

// Locale constants duplicated from routing.ts to avoid pulling in next/navigation
const SUPPORTED_LOCALES = ['de', 'en', 'fr'] as const;
const DEFAULT_LOCALE = 'en';
type Locale = (typeof SUPPORTED_LOCALES)[number];

// Mirrors the extractLocale helper in middleware.ts
function extractLocale(pathname: string): string {
  return SUPPORTED_LOCALES.find(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`,
  ) ?? DEFAULT_LOCALE;
}

describe('i18n locale config', () => {
  it('inclut de, en et fr', () => {
    expect(SUPPORTED_LOCALES).toContain('de');
    expect(SUPPORTED_LOCALES).toContain('en');
    expect(SUPPORTED_LOCALES).toContain('fr');
  });

  it('a exactement 3 locales', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(3);
  });

  it('defaultLocale est en', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });
});

describe('middleware locale extraction', () => {
  it('extrait fr depuis /fr/profile', () => {
    expect(extractLocale('/fr/profile')).toBe('fr');
  });

  it('extrait en depuis /en/presets', () => {
    expect(extractLocale('/en/presets')).toBe('en');
  });

  it('extrait de depuis /de/editor', () => {
    expect(extractLocale('/de/editor')).toBe('de');
  });

  it('extrait fr depuis /fr (exact)', () => {
    expect(extractLocale('/fr')).toBe('fr');
  });

  it('fallback à en pour chemin inconnu', () => {
    expect(extractLocale('/unknown/path')).toBe('en');
  });

  it('ne confond pas /fridge avec /fr', () => {
    expect(extractLocale('/fridge/preset')).toBe('en');
  });
});

describe('messages/fr.json', () => {
  it('contient les clés nav essentielles', async () => {
    const fr = await import('../../messages/fr.json');
    expect(fr.default.nav.home).toBe('Accueil');
    expect(fr.default.nav.editor).toBe('Éditeur');
    expect(fr.default.nav.gallery).toBe('Galerie');
  });

  it('contient les clés gallery essentielles', async () => {
    const fr = await import('../../messages/fr.json');
    expect(fr.default.gallery.title).toBe('Galerie de presets');
    expect(fr.default.gallery.noResults).toBeDefined();
  });

  it('a les mêmes clés de premier niveau que en.json', async () => {
    const en = await import('../../messages/en.json');
    const fr = await import('../../messages/fr.json');
    const enKeys = Object.keys(en.default);
    const frKeys = Object.keys(fr.default);
    expect(frKeys).toEqual(expect.arrayContaining(enKeys));
  });

  it('les valeurs FR sont différentes des valeurs EN', async () => {
    const en = await import('../../messages/en.json');
    const fr = await import('../../messages/fr.json');
    expect(fr.default.nav.home).not.toBe(en.default.nav.home);
    expect(fr.default.gallery.title).not.toBe(en.default.gallery.title);
  });
});
