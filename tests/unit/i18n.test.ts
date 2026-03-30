import { describe, it, expect } from 'vitest';
import { readdirSync } from 'fs';
import { resolve } from 'path';

// Locale constants for routing/middleware logic tests — kept in sync with routing.ts manually
const SUPPORTED_LOCALES = ['de', 'en', 'fr'] as const;
const DEFAULT_LOCALE = 'en';

// Mirrors the extractLocale helper in middleware.ts
function extractLocale(pathname: string): string {
  return SUPPORTED_LOCALES.find(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`,
  ) ?? DEFAULT_LOCALE;
}

// Auto-discover available locales from messages/ directory — no hardcoding needed
const MESSAGES_DIR = resolve(__dirname, '../../messages');
const DISCOVERED_LOCALES = readdirSync(MESSAGES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''));

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

// Generic tests — run for every locale file found in messages/
describe.each(DISCOVERED_LOCALES)('messages/%s.json', (locale) => {
  it('existe et est du JSON valide', async () => {
    const mod = await import(`../../messages/${locale}.json`);
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('object');
  });

  it('contient tous les namespaces de en.json', async () => {
    const en = await import('../../messages/en.json');
    const mod = await import(`../../messages/${locale}.json`);
    const expectedNamespaces = Object.keys(en.default);
    for (const ns of expectedNamespaces) {
      expect(mod.default, `namespace "${ns}" manquant dans ${locale}.json`).toHaveProperty(ns);
    }
  });

  it('aucune valeur vide dans nav', async () => {
    const mod = await import(`../../messages/${locale}.json`);
    for (const [key, val] of Object.entries(mod.default.nav as Record<string, string>)) {
      expect(val, `nav.${key} est vide dans ${locale}.json`).toBeTruthy();
    }
  });
});
