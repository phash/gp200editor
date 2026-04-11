# i18n Expansion — 4 New Locales (ES, FR, IT, PT)

**Status:** Approved design, ready for implementation plan
**Date:** 2026-04-11
**Author:** Claude (Opus 4.6) via brainstorming session with @phash

## Goal

Expand Preset Forge from 2 locales (de, en) to 6 (de, en, es, fr, it, pt) without regressing the existing DE/EN experience, without translating effect/amp/preset content, and with machine-generated translations shipped behind a `beta` label.

## Non-Goals

- Translating `src/core/effectNames.ts`, `effectDescriptions.ts`, `effectParams.ts` — effect/amp/cab/pedal names stay English across all locales. That's the convention in the guitar community and avoids a whole class of "what do we call a Tube Screamer in Portuguese" questions.
- Translating user-generated content: preset name, description, tags, author, style, sourceLabel — these stay as ingested.
- Translating API error responses — they continue to return English strings. Frontend can map codes later if needed (separate scope).
- Translating CHANGELOG.md — technical release notes stay English.
- Native-speaker QA pass before ship — we ship machine translations with a `beta` label and iterate on Discord/GitHub feedback.
- Clean-code refactors flagged in the Apr 11 review (editor/page.tsx split, useMidiDevice split, admin middleware wrapper) — those are a separate follow-up PR.

## Architecture

### Locale list

```ts
// src/i18n/routing.ts
export const routing = defineRouting({
  locales: ['de', 'en', 'es', 'fr', 'it', 'pt'],
  defaultLocale: 'en',     // changed from 'de' — EN is the broader default
  localeDetection: true,   // Accept-Language + NEXT_LOCALE cookie
});
```

`localeDetection: true` gives us browser detection and cookie override for free. When a user clicks the switcher, next-intl writes `NEXT_LOCALE` (1 year). Subsequent visits use the cookie, not Accept-Language. No extra code needed.

### Message files

```
messages/
  de.json   (existing, 436 keys)
  en.json   (existing, 436 keys)
  es.json   (new)
  fr.json   (new)
  it.json   (new)
  pt.json   (new)
```

All 6 files MUST have identical key structures. Drift is prevented by a unit test (see Testing).

### Fallback strategy

`src/i18n/request.ts` registers a `getMessageFallback` handler that returns the English value when a key is missing in the active locale. In production this is silent; in dev we `console.warn` so missing keys surface during development. Never shows raw keys, never throws.

### Middleware

`src/middleware.ts` regex matcher changes from `(de|en)` to `(de|en|es|fr|it|pt)` in two places: loginRedirect locale detection and the auth-guard path match. No structural changes.

### Sitemap

`src/app/sitemap.ts` emits every static page, amp-category page, and public preset-share page across all 6 locales instead of 2. Currently ~586 URLs, becomes ~1,500 — well under the 50k hard limit.

### Hreflang

Every page that has a `generateMetadata` with `alternates.languages` gets all 6 entries plus `x-default` pointing at EN. Affected files (~8 blocks total):

- `src/app/[locale]/layout.tsx` — root alternates
- `src/app/[locale]/share/[token]/page.tsx`
- `src/app/[locale]/amp/[slug]/page.tsx`
- `src/app/[locale]/gallery/page.tsx`
- `src/app/[locale]/editor/layout.tsx`
- `src/app/[locale]/help/page.tsx`
- `src/app/[locale]/changelog/page.tsx`
- Any route added in future work — a helper `buildHreflang(path)` lives in `src/lib/hreflang.ts` to prevent drift.

## Locale Switcher Component

### File: `src/components/LocaleSwitcher.tsx` (new)

Standalone component extracted from Navbar. Navbar is already 290 lines and swelling; keeping the dropdown separate keeps both files focused.

### Trigger

Current flag + code pill: `🇩🇪 DE ▾`. Same size, border, font, and colors as today's locale toggle (amber border, mono font). Only adds the `▾` indicator.

### Dropdown contents

```
🇩🇪 DE
🇬🇧 EN
🇪🇸 ES  beta
🇫🇷 FR  beta
🇮🇹 IT  beta
🇵🇹 PT  beta
```

- Flag emojis (Unicode regional indicator pairs) render natively on all target platforms. No external flag assets.
- `beta` label is a small dimmed-gray span next to each of ES/FR/IT/PT.
- Removing the beta label per locale is a one-line edit in this file — no config flag, no feature toggle, no DB field.

### Behavior

- Click a row → `router.replace(pathname, { locale })` (next-intl sets the cookie automatically via `localeDetection`)
- ESC closes
- Click outside closes
- Active locale highlighted with amber border

### Accessibility

- Trigger button: `aria-label={t('nav.switchLocale')}` (existing i18n key), `aria-haspopup="menu"`, `aria-expanded`
- Dropdown items: `<button role="menuitem">`
- Keyboard: Tab focuses trigger, Enter opens, ArrowDown/ArrowUp navigates, Enter selects, ESC closes
- axe-core in E2E verifies no contrast/label regressions

### Mobile

Mobile menu does not use a dropdown. Instead, it shows a horizontal flag row (all 6 flags in one flex container), with the active locale wrapped in an amber border. Simpler on touch, no overlay complexity, fits existing mobile-menu styling.

## Translation Workflow

### Domain glossary

File: `docs/i18n-glossary.md` (new, committed)

Lists ~40 domain terms with their target translation in each of the 4 new languages. Includes both:

- Terms that DO get translated per-language (e.g. amplifier, knob, tone, preset-chain)
- Terms that deliberately stay English across all languages (e.g. preset, bypass, tap tempo, reverb, delay, chorus, EQ, wah, overdrive, distortion, compressor, noise gate) — these are guitar-community convention.

The glossary is both a prompt input for the AI translator and a human reference for later contributor edits.

### Generation

Four Opus-class subagents dispatched in parallel from one controller message, one per new language. Each receives:

1. Complete `messages/en.json` as source-of-truth content
2. `messages/de.json` as reference (shows how the DE version handled similar choices)
3. The glossary file
4. Context instructions: product description, audience (hobby to semi-pro guitarists), tone (friendly-technical), what NOT to translate
5. Instruction to preserve the JSON structure exactly — same keys, same nesting

Each subagent returns complete JSON content. Controller writes it raw to `messages/{locale}.json`. No post-processing.

### Quality contract

- Key structure must match `en.json` exactly (tested)
- ICU message format placeholders (`{name}`, `{count}`) must be preserved
- No keys translated (keys are identifiers, only values)
- Brand names unchanged: Preset Forge, GP-200, Valeton, HX Stomp, Discord, Buy Me A Coffee, etc.

## Hardcoded String Extraction

Six hardcoded user-facing strings found in the i18n coverage review need to become `useTranslations()` calls. All in existing client components:

- `src/components/Navbar.tsx:68` — `aria-label="Menu"` → `t('nav.menuAria')`
- `src/components/Navbar.tsx:134` — `title="Feedback & Community"` → `t('nav.discordTitle')`
- `src/components/HelpButton.tsx` — `title="Help"` → `t('nav.helpAria')`
- `src/components/CuePointTable.tsx` — `aria-label="Delete"` → `t('playlists.deleteCue')`
- `src/components/GuitarRating.tsx` — rating star `aria-label` → `t('gallery.ratingStarAria', { filled })`

Six new keys added to the existing namespaces, then all 6 locale files get them populated during the translation step.

## Error Messages (not translated)

API routes continue to return English error strings (`"Unauthorized"`, `"Invalid email or password"`, etc.). This is a deliberate non-goal for this PR. The right long-term fix is to have the API return `{ code: "INVALID_CREDENTIALS" }` and let the client map codes to localized strings, but that touches every fetch call site and is out of scope here.

Metadata titles that are currently hardcoded in `generateMetadata` blocks (e.g., `'Changelog — Preset Forge'`) ARE localized as part of this PR via `getTranslations()`.

## Testing

### Unit tests (new)

1. **`tests/unit/messages-parity.test.ts`** — Reads all 6 message files, extracts flat dot-path keys from each, asserts every file has exactly the same key set as `en.json`. Fails CI if any file drifts.

2. **`tests/unit/LocaleSwitcher.test.tsx`** — Renders with 6 options, click dispatches router replace with correct locale, ESC closes, Beta label only on ES/FR/IT/PT, active locale has amber styling.

3. **`tests/unit/middleware-locales.test.ts`** — Mocks NextRequest with various Accept-Language headers. Asserts `fr-FR` → `/fr`, `xx-YY` → `/en`, `NEXT_LOCALE=es` cookie overrides Accept-Language.

### E2E tests (new)

**`tests/e2e/i18n-locales.spec.ts`** — For each of the 6 locales:
1. Load `/${locale}` — assert HTML contains a known translated snippet from that locale's hero headline
2. Load `/${locale}/editor` — assert page renders without JS errors
3. Load `/${locale}/gallery` — assert gallery renders
4. axe-core WCAG 2.1 AA scan

6 locales × 3 pages + a11y = ~30s additional CI time.

### Existing tests

All existing unit + E2E tests continue to pass unchanged. The new locales are additive.

## Rollout

Single PR. Lokale CI (lint + typecheck + test + build) runs to green. Merged to master. Prod deploy via existing `deploy-update.sh`. Post-deploy smoke: open switcher, click through FR/ES/IT/PT, confirm editor loads in each. No feature flags, no gradual rollout — these are additive changes.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Middleware regex wrong → 404 loop on locale routes | Unit test covers matcher |
| Sitemap explodes to 50k+ URLs | At 1,500 URLs we're 97% below limit |
| Translation quality off for some locales | Beta label, Discord feedback loop, glossary-driven regeneration on demand |
| Hardcoded-string extraction breaks a component | Per-component unit test + Playwright smoke |
| Key drift between locale files | CI-gated parity test |
| next-intl fallback doesn't trigger | `getMessageFallback` unit test + manual dev check |
| Prod CSP blocks flag emojis or dropdown | Already tested — CSP allows inline styles (existing practice), emojis are Unicode not external |

## File Impact Summary

**New files (7):**
- `messages/es.json`, `messages/fr.json`, `messages/it.json`, `messages/pt.json`
- `src/components/LocaleSwitcher.tsx`
- `src/lib/hreflang.ts`
- `docs/i18n-glossary.md`
- `tests/unit/messages-parity.test.ts`
- `tests/unit/LocaleSwitcher.test.tsx`
- `tests/unit/middleware-locales.test.ts`
- `tests/e2e/i18n-locales.spec.ts`

**Modified files (~12):**
- `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/middleware.ts`
- `src/components/Navbar.tsx` (integrates LocaleSwitcher, extracts hardcoded strings)
- `src/components/HelpButton.tsx`, `CuePointTable.tsx`, `GuitarRating.tsx` (extract hardcoded strings)
- `src/app/sitemap.ts`
- `src/app/[locale]/layout.tsx`, `editor/layout.tsx`, `help/page.tsx`, `changelog/page.tsx`, `gallery/page.tsx`, `amp/[slug]/page.tsx`, `share/[token]/page.tsx`
- `messages/de.json`, `messages/en.json` (add 6 new keys for hardcoded-string extraction)

## Success Criteria

- All 6 locales load and render Home/Editor/Gallery/Share/Amp-category pages without JS errors
- Locale switcher opens, shows 6 options with flags + codes + beta labels, clicking changes the locale and persists via cookie
- Unit + E2E tests green
- Sitemap lists every static + amp-category + share URL × 6 with correct hreflang
- `messages-parity.test.ts` asserts 0 key drift across files
- No regression in existing DE/EN user journeys (verified via existing E2E suite)
- `npm run ci` passes end-to-end
- Production smoke-test: DE, EN, ES, FR, IT, PT each load the editor and show a preset
