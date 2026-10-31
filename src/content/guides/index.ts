import { LOCALES, type Locale } from '@/i18n/locales';
import type { Guide } from './types';
import { GUIDES_EN } from './en';
import { GUIDES_DE } from './de';
import { GUIDES_ES } from './es';
import { GUIDES_PT_BR } from './pt-BR';

export type { Guide, GuideSection, GuideLink } from './types';

/**
 * Long-form guide content. Lives here rather than in messages/*.json so the
 * prose stays out of the flat key-parity system (it would dwarf the UI strings
 * and a missing paragraph shouldn't fail the parity test). Each guide is
 * authored per locale; a slug only renders a page for locales present in
 * GUIDES, and its hreflang set is exactly those locales. Locales without a
 * translation fall back to the English guide on the /guides index (flagged
 * with a badge) and are excluded from that guide's sitemap + hreflang.
 *
 * One file per locale (./en.ts, ./de.ts, …), each a slug -> Guide map.
 * Spanish and Brazilian Portuguese come first after EN/DE: Brazil and the
 * Spanish-speaking countries together send more search clicks than any other
 * market (GSC, Oct 2026). Open follow-ups live in docs/content-roadmap.md.
 */

/** Guide content keyed by locale -> slug. Only locales present here render a
 *  page for that slug. */
export const GUIDES: Partial<Record<Locale, Record<string, Guide>>> = {
  en: GUIDES_EN,
  de: GUIDES_DE,
  es: GUIDES_ES,
  'pt-BR': GUIDES_PT_BR,
};

/** Canonical slug order for the /guides index. */
export const GUIDE_SLUGS = ['valeton-gp-200-editor', 'prst-file', 'gp-200-on-linux'] as const;

/** The exact guide for a (locale, slug), or null when that locale has no
 *  translation of it. */
export function getGuide(locale: Locale, slug: string): Guide | null {
  return GUIDES[locale]?.[slug] ?? null;
}

/** Locales that have a translation of this slug — its hreflang set and the
 *  basis for generateStaticParams. */
export function guideLocales(slug: string): Locale[] {
  return LOCALES.filter((l) => GUIDES[l]?.[slug]);
}

/** Every (locale, slug) pair with real content, for generateStaticParams. */
export function allGuideParams(): { locale: Locale; slug: string }[] {
  return (Object.keys(GUIDES) as Locale[]).flatMap((locale) =>
    Object.keys(GUIDES[locale] ?? {}).map((slug) => ({ locale, slug })),
  );
}

export type GuideIndexRow = { slug: string; guide: Guide; localized: boolean };

/** Index rows for a preferred locale: the localized guide when it exists,
 *  otherwise the English fallback flagged `localized: false`. */
export function listGuidesForIndex(preferred: Locale): GuideIndexRow[] {
  return GUIDE_SLUGS.flatMap((slug): GuideIndexRow[] => {
    const localized = GUIDES[preferred]?.[slug];
    if (localized) return [{ slug, guide: localized, localized: true }];
    const fallback = GUIDES.en?.[slug];
    return fallback ? [{ slug, guide: fallback, localized: false }] : [];
  });
}

/** Locale to link a guide in from a page rendered in `preferred`: the page's
 *  own locale when the guide is translated, otherwise English. Untranslated
 *  guide URLs 404, so a plain locale-relative link would break on fr/it/pt. */
export function guideLinkLocale(preferred: Locale, slug: string): Locale {
  // English is the original every listed slug ships in (guides-content test).
  return GUIDES[preferred]?.[slug] ? preferred : 'en';
}
