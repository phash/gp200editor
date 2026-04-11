// Single source of truth for the locale list. This file has ZERO imports
// so it can be loaded from any context — test runners, edge middleware,
// client bundles — without pulling in next-intl's navigation chain.
//
// Both src/i18n/routing.ts (which wires this into defineRouting) and
// src/lib/hreflang.ts (which builds canonical URLs) import from here.
// Adding a locale is a single-tuple change — the rest follows.
export const LOCALES = ['de', 'en', 'es', 'fr', 'it', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];
