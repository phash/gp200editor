import { describe, it, expect } from 'vitest';
import { GUIDES, GUIDE_SLUGS, guideLocales, guideLinkLocale } from '@/content/guides';
import type { Locale } from '@/i18n/locales';

const entries = (Object.entries(GUIDES) as [Locale, NonNullable<(typeof GUIDES)[Locale]>][])
  .flatMap(([locale, guides]) => Object.entries(guides).map(([key, guide]) => ({ locale, key, guide })));

describe('guide content', () => {
  it('has an English original for every listed slug', () => {
    for (const slug of GUIDE_SLUGS) expect(guideLocales(slug)).toContain('en');
  });

  it('only contains listed slugs, keyed by their own slug', () => {
    for (const { key, guide } of entries) {
      expect(guide.slug).toBe(key);
      expect(GUIDE_SLUGS as readonly string[]).toContain(key);
    }
  });

  it('ships every listed guide in EN, DE, ES and PT-BR', () => {
    for (const slug of GUIDE_SLUGS) {
      expect(guideLocales(slug)).toEqual(expect.arrayContaining(['en', 'de', 'es', 'pt-BR']));
    }
  });

  it.each(entries.map((e) => [`${e.locale}/${e.key}`, e.guide] as const))(
    '%s has search-ready metadata and content',
    (_, guide) => {
      expect(guide.title.length).toBeGreaterThan(10);
      expect(guide.title.length).toBeLessThanOrEqual(70);
      expect(guide.description.length).toBeGreaterThan(50);
      expect(guide.description.length).toBeLessThanOrEqual(200);
      expect(guide.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(guide.sections.length).toBeGreaterThanOrEqual(3);
    },
  );

  it('links only to locale-less internal paths', () => {
    for (const { guide } of entries) {
      for (const link of guide.sections.flatMap((s) => s.links ?? [])) {
        expect(link.href).toMatch(/^\/(?!(?:de|en|es|fr|it|pt|pt-BR)(?:\/|$))/);
        expect(link.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps translations structurally aligned with the English original', () => {
    for (const { locale, key, guide } of entries) {
      const en = GUIDES.en![key];
      expect(guide.sections.length, `${locale}/${key}`).toBe(en.sections.length);
      guide.sections.forEach((section, i) => {
        expect(section.steps?.length, `${locale}/${key} §${i} steps`).toBe(en.sections[i].steps?.length);
        expect(section.links?.map((l) => l.href), `${locale}/${key} §${i} links`).toEqual(
          en.sections[i].links?.map((l) => l.href),
        );
      });
    }
  });
});

describe('guideLinkLocale', () => {
  it('keeps the page locale when the guide is translated', () => {
    expect(guideLinkLocale('de', 'gp-200-on-linux')).toBe('de');
    expect(guideLinkLocale('pt-BR', 'valeton-gp-200-editor')).toBe('pt-BR');
  });

  it('falls back to English for locales without a translation', () => {
    expect(guideLinkLocale('fr', 'gp-200-on-linux')).toBe('en');
    expect(guideLinkLocale('it', 'valeton-gp-200-editor')).toBe('en');
  });
});
