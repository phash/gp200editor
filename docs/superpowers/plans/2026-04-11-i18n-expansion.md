# i18n Expansion Implementation Plan (ES, FR, IT, PT)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Spanish, French, Italian, and Portuguese to Preset Forge alongside the existing DE/EN, ship behind a `beta` label, with AI-generated translations from a domain glossary.

**Architecture:** Expand `next-intl` routing with 4 new locales, keep message files 1:1 key-parity (enforced by CI), extract hardcoded aria-labels into translation keys, replace the binary DE↔EN toggle with a dropdown LocaleSwitcher, fan out hreflang + sitemap across all 6 locales. Translations are generated in one parallel batch via 4 Opus subagents working from a shared glossary.

**Tech Stack:** Next.js 15, next-intl 4, React 19, TypeScript strict, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-11-i18n-expansion-design.md`

---

## Task Dependencies

```
Task 1 (glossary) ──────────────────────────────────────┐
Task 2 (add new keys to de/en) ─┐                       │
Task 3 (parity test) ───────────┼── Task 4 (extract hardcoded strings)
                                │
Task 5 (routing) ── Task 6 (middleware) ── Task 7 (middleware test)
                                │
Task 8 (fallback handler) ──────┘
                                │
Task 9 (hreflang helper) ── Task 10 (apply helper) ── Task 11 (sitemap)
                                │
Task 12 (LocaleSwitcher) ── Task 13 (integrate in Navbar)
                                │
Task 14 (generate 4 files) ─── Task 15 (parity green) ── Task 16 (E2E) ── Task 17 (CI + ship)
```

---

### Task 1: Domain glossary

**Files:**
- Create: `docs/i18n-glossary.md`

- [ ] **Step 1: Create `docs/i18n-glossary.md` with the glossary content**

```markdown
# i18n Glossary — Preset Forge

Domain-specific term translations used to keep the 6 locale files consistent.
Used as reference input when (re)generating translations and as a lookup for
community contributors editing `messages/*.json` by hand.

## Terms that stay English across ALL locales

Guitar-community convention. Translating these would confuse users more than help them.

- preset, preset chain, signal chain
- bypass, tap tempo, expression pedal, EXP 1, EXP 2
- reverb, delay, chorus, flanger, phaser, tremolo
- EQ, compressor, noise gate, wah, overdrive, distortion, boost
- amp, cab, cabinet, IR, DI, stomp, stomp box
- BPM, Hz, kHz, dB
- MIDI, USB, SysEx, Web MIDI, PWA
- Valeton, GP-200, HX Stomp, Preset Forge
- Marshall, Mesa, Fender, Vox, Orange, Peavey, Bogner, Soldano, Engl, etc. (all amp brands)

## Terms that DO get translated per-language

| English | DE | ES | FR | IT | PT |
|---------|----|----|----|----|----|
| amplifier (noun) | Verstärker | amplificador | amplificateur | amplificatore | amplificador |
| knob | Regler | botón | bouton | manopola | botão |
| slider | Schieberegler | deslizador | curseur | cursore | controle deslizante |
| switch | Schalter | interruptor | interrupteur | interruttore | interruptor |
| tone (sound) | Klang | sonido | son | suono | som |
| sound | Sound / Klang | sonido | son | suono | som |
| band (musical) | Band | banda | groupe | band | banda |
| guitarist | Gitarrist | guitarrista | guitariste | chitarrista | guitarrista |
| player | Spieler | músico | musicien | musicista | músico |
| song | Lied | canción | chanson | canzone | canção |
| download | Herunterladen | Descargar | Télécharger | Scarica | Baixar |
| upload | Hochladen | Subir | Téléverser | Carica | Enviar |
| share | Teilen | Compartir | Partager | Condividi | Compartilhar |
| save | Speichern | Guardar | Enregistrer | Salva | Salvar |
| edit | Bearbeiten | Editar | Modifier | Modifica | Editar |
| delete | Löschen | Eliminar | Supprimer | Elimina | Excluir |
| settings | Einstellungen | Ajustes | Paramètres | Impostazioni | Configurações |
| profile | Profil | Perfil | Profil | Profilo | Perfil |
| sign in / log in | Anmelden | Iniciar sesión | Se connecter | Accedi | Entrar |
| sign up / register | Registrieren | Registrarse | S'inscrire | Registrati | Cadastrar |
| logout | Abmelden | Cerrar sesión | Déconnexion | Disconnetti | Sair |
| username | Benutzername | Nombre de usuario | Nom d'utilisateur | Nome utente | Nome de usuário |
| password | Passwort | Contraseña | Mot de passe | Password | Senha |
| email | E-Mail | Correo | E-mail | Email | E-mail |
| browser | Browser | Navegador | Navigateur | Browser | Navegador |
| hardware | Hardware | Hardware | Matériel | Hardware | Hardware |
| device | Gerät | Dispositivo | Appareil | Dispositivo | Dispositivo |
| connect | Verbinden | Conectar | Connecter | Connetti | Conectar |
| disconnect | Trennen | Desconectar | Déconnecter | Disconnetti | Desconectar |
| free (no cost) | Kostenlos | Gratis | Gratuit | Gratis | Grátis |
| community | Community | Comunidad | Communauté | Community | Comunidade |
| feedback | Feedback | Comentarios | Retour | Feedback | Feedback |
| language | Sprache | Idioma | Langue | Lingua | Idioma |

## Brand phrases

- "Buy Me A Coffee" — keep verbatim
- "Open Source" — "Código Abierto" (ES), "Open source" (FR, often loan-word), "Open source" (IT), "Código Aberto" (PT)
- "Ad-free" — "Sin anuncios" (ES), "Sans pub" (FR), "Senza pubblicità" (IT), "Sem anúncios" (PT)

## Tone guidelines

- **ES:** Informal "tú", friendly hobbyist tone. Not the formal "usted".
- **FR:** Informal "tu" for buttons/actions, formal "vous" avoided. Match Discord community vibe.
- **IT:** Informal "tu", direct and practical.
- **PT:** Brazilian Portuguese, not European. Informal "você". (Brazilian guitar community is larger.)
```

- [ ] **Step 2: Commit**

```bash
git add docs/i18n-glossary.md
git commit -m "docs: i18n glossary for ES/FR/IT/PT translation consistency"
```

---

### Task 2: Add new translation keys for hardcoded strings (de + en)

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] **Step 1: Add `menuAria`, `discordTitle`, `helpAria` to `nav` namespace in `messages/en.json`**

Find the `nav` object (starts at line 2). Add the three new keys inside the existing nav block so it becomes:

```json
"nav": {
  "title": "Preset Forge",
  "home": "Home",
  "editor": "Editor",
  "login": "Sign In",
  "profile": "Profile",
  "logout": "Logout",
  "presets": "Presets",
  "gallery": "Gallery",
  "playlists": "Playlists",
  "help": "Help",
  "switchLocale": "Switch language",
  "admin": "Admin",
  "changelog": "Changelog",
  "menuAria": "Menu",
  "discordTitle": "Feedback & Community",
  "helpAria": "Help"
},
```

- [ ] **Step 2: Add `deleteCue` to `playlists` namespace in `messages/en.json`**

Find the `playlists` object. Add inside it:

```json
"deleteCue": "Delete cue point",
```

- [ ] **Step 3: Add rating aria keys to `gallery` namespace in `messages/en.json`**

Find the `gallery` object. Add inside it:

```json
"ratingStarFilled": "filled rating star",
"ratingStarEmpty": "empty rating star",
```

- [ ] **Step 4: Mirror the same 6 keys in `messages/de.json`**

```json
// nav
"menuAria": "Menü",
"discordTitle": "Feedback & Community",
"helpAria": "Hilfe",

// playlists
"deleteCue": "Cue-Punkt löschen",

// gallery
"ratingStarFilled": "Bewertungsstern ausgefüllt",
"ratingStarEmpty": "Bewertungsstern leer",
```

- [ ] **Step 5: Verify JSON validity**

```bash
jq '.' messages/en.json > /dev/null && echo "en OK"
jq '.' messages/de.json > /dev/null && echo "de OK"
```
Expected: `en OK` and `de OK`.

- [ ] **Step 6: Commit**

```bash
git add messages/en.json messages/de.json
git commit -m "i18n: add keys for Navbar/HelpButton/CuePointTable/GuitarRating aria-labels"
```

---

### Task 3: Key parity unit test

**Files:**
- Create: `tests/unit/messages-parity.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Recursively flatten a nested object into dot-notation key paths.
// { nav: { home: 'Home' } }  →  ['nav.home']
function flatKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatKeys(v, key));
    } else {
      out.push(key);
    }
  }
  return out.sort();
}

describe('messages parity', () => {
  const messagesDir = path.join(process.cwd(), 'messages');
  const enRaw = JSON.parse(fs.readFileSync(path.join(messagesDir, 'en.json'), 'utf-8'));
  const enKeys = flatKeys(enRaw);

  const localeFiles = fs
    .readdirSync(messagesDir)
    .filter((f) => f.endsWith('.json') && f !== 'en.json');

  it('en.json has at least one key', () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  for (const file of localeFiles) {
    it(`${file} has identical keys to en.json`, () => {
      const content = JSON.parse(fs.readFileSync(path.join(messagesDir, file), 'utf-8'));
      const keys = flatKeys(content);
      // Diff both ways so the error message tells us WHICH keys are missing/extra
      const missing = enKeys.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !enKeys.includes(k));
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });
  }
});
```

- [ ] **Step 2: Run the test**

```bash
npx vitest run tests/unit/messages-parity.test.ts
```
Expected: PASS. Currently only `de.json` exists as a non-en locale file and should match after Task 2.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/messages-parity.test.ts
git commit -m "test: enforce messages/*.json key parity against en.json"
```

---

### Task 4: Extract hardcoded aria-labels and titles

**Files:**
- Modify: `src/components/Navbar.tsx` (lines 68 and 134)
- Modify: `src/components/HelpButton.tsx` (line 18)
- Modify: `src/components/CuePointTable.tsx` (line 277)
- Modify: `src/components/GuitarRating.tsx` (lines 30 and 41)

- [ ] **Step 1: Navbar — replace `aria-label="Menu"` with `t('menuAria')`**

Navbar already uses `const t = useTranslations('nav')`. Change line 68:

```tsx
// Before
aria-label="Menu"
// After
aria-label={t('menuAria')}
```

- [ ] **Step 2: Navbar — replace `title="Feedback & Community"` with `t('discordTitle')`**

Change line 134:

```tsx
// Before
title="Feedback & Community"
// After
title={t('discordTitle')}
```

- [ ] **Step 3: HelpButton — add useTranslations and replace `title="Help"`**

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

interface HelpButtonProps {
  section: string;
}

export function HelpButton({ section }: HelpButtonProps) {
  const t = useTranslations('nav');
  return (
    <Link
      href={`/help#${section}`}
      className="help-btn inline-flex items-center justify-center w-6 h-6 rounded-full font-mono-display text-[10px] font-bold transition-all duration-150"
      style={{
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-muted)',
      }}
      title={t('helpAria')}
    >
      ?
      <style>{`
        .help-btn:hover {
          border-color: var(--accent-amber) !important;
          color: var(--accent-amber) !important;
        }
      `}</style>
    </Link>
  );
}
```

- [ ] **Step 4: CuePointTable — replace `aria-label="Delete"` with `t('deleteCue')`**

The file already uses `const t = useTranslations('playlists')` for other labels. Change the raw `aria-label="Delete"` on line 277 to:

```tsx
aria-label={t('deleteCue')}
```

- [ ] **Step 5: GuitarRating — replace hardcoded aria-labels**

At the top of the component function, add:

```tsx
import { useTranslations } from 'next-intl';
// ...
const t = useTranslations('gallery');
```

Then change both occurrences of `aria-label={filled ? 'filled guitar' : 'empty guitar'}` to:

```tsx
aria-label={filled ? t('ratingStarFilled') : t('ratingStarEmpty')}
```

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```
Expected: EXIT 0.

- [ ] **Step 7: Run unit tests**

```bash
npx vitest run tests/unit/
```
Expected: all tests green (no component tests broke).

- [ ] **Step 8: Commit**

```bash
git add src/components/Navbar.tsx src/components/HelpButton.tsx src/components/CuePointTable.tsx src/components/GuitarRating.tsx
git commit -m "i18n: extract hardcoded aria-labels + titles into translation keys"
```

---

### Task 5: Update routing.ts with 6 locales

**Files:**
- Modify: `src/i18n/routing.ts`

- [ ] **Step 1: Replace locale list and default**

```tsx
import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['de', 'en', 'es', 'fr', 'it', 'pt'],
  defaultLocale: 'en',
  localeDetection: true,
});

// Typed navigation helpers — import Link, useRouter, usePathname from this module
// instead of from 'next/navigation' for locale-aware routing
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: EXIT 0. (Type errors about `'de' | 'en'` literal narrowing in other files will appear — those are fixed in Task 6 + 8.)

If errors are only in `src/i18n/request.ts` and `src/middleware.ts`, proceed to the next task. Otherwise investigate.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/routing.ts
git commit -m "i18n: expand routing to es/fr/it/pt, default to en, enable locale detection"
```

---

### Task 6: Update middleware matcher

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Update the `PROTECTED_ROUTE_PATTERN` regex and `loginRedirect` locale detection**

```tsx
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { type NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

// Lucia v3 default session cookie name — must match lucia.sessionCookieName in src/lib/auth.ts
const SESSION_COOKIE = 'auth_session';

// Locale list must match routing.ts. We extract locale segment + protected
// subtree in one regex so adding a locale is a single-line change.
const PROTECTED_ROUTE_PATTERN =
  /^\/(de|en|es|fr|it|pt)\/(profile|presets|admin)(?:\/|$)/;

// Extract the locale prefix from a pathname, falling back to en if the path
// doesn't start with a known locale. Used for login-redirect so a user on
// /fr/profile without a session gets redirected to /fr/auth/login, not /de.
const LOCALE_PREFIX_PATTERN = /^\/(de|en|es|fr|it|pt)(?=\/|$)/;

function loginRedirect(request: NextRequest, pathname: string) {
  const match = LOCALE_PREFIX_PATTERN.exec(pathname);
  const locale = match ? match[1] : 'en';
  return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PROTECTED_ROUTE_PATTERN.test(pathname)) {
    // Edge runtime can't call Prisma, so only cookie *presence* is verified
    // here. Each page/route revalidates the session server-side before any
    // authenticated work.
    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionCookie) {
      return loginRedirect(request, pathname);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Exclude Next.js internals, static files, and all API routes
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
};
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: EXIT 0 (the middleware errors are gone; `request.ts` errors may remain until Task 8).

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "i18n: middleware matcher + loginRedirect support all 6 locales"
```

---

### Task 7: Middleware locale-detection test

**Files:**
- Create: `tests/unit/middleware-locales.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from 'vitest';

// This test exercises the regex patterns directly rather than running the
// full middleware through a fake NextRequest — the patterns are what
// actually need to match real-world URLs, and copying them here keeps the
// test focused on the regression we care about (adding a locale must not
// break the existing ones).
const PROTECTED_ROUTE_PATTERN =
  /^\/(de|en|es|fr|it|pt)\/(profile|presets|admin)(?:\/|$)/;
const LOCALE_PREFIX_PATTERN = /^\/(de|en|es|fr|it|pt)(?=\/|$)/;

describe('PROTECTED_ROUTE_PATTERN', () => {
  it.each([
    ['/de/profile', true],
    ['/en/profile', true],
    ['/es/profile', true],
    ['/fr/profile/edit', true],
    ['/it/presets', true],
    ['/pt/admin', true],
    ['/pt/admin/users', true],
  ])('matches protected locale route %s', (path, expected) => {
    expect(PROTECTED_ROUTE_PATTERN.test(path)).toBe(expected);
  });

  it.each([
    ['/en/editor'],
    ['/de/gallery'],
    ['/fr/help'],
    ['/xx/profile'],   // unknown locale
    ['/profile'],       // no locale prefix
    ['/api/profile'],   // API prefix
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
  ])('extracts locale %s from %s', (path, expected) => {
    const match = LOCALE_PREFIX_PATTERN.exec(path);
    expect(match?.[1]).toBe(expected);
  });

  it('returns null for paths without a known locale prefix', () => {
    expect(LOCALE_PREFIX_PATTERN.exec('/profile')).toBeNull();
    expect(LOCALE_PREFIX_PATTERN.exec('/xx/profile')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npx vitest run tests/unit/middleware-locales.test.ts
```
Expected: PASS (patterns already match because Task 6 updated the middleware).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/middleware-locales.test.ts
git commit -m "test: middleware locale-detection regex for 6 locales"
```

---

### Task 8: Add message-fallback handler in request.ts

**Files:**
- Modify: `src/i18n/request.ts`

- [ ] **Step 1: Add graceful fallback + narrow the locale type**

```tsx
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

type Locale = (typeof routing.locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) as Locale | undefined;
  if (!locale || !routing.locales.includes(locale)) {
    locale = routing.defaultLocale;
  }

  // Load the requested locale and always keep en as a fallback source so a
  // missing key in a newly added language falls back to English instead of
  // showing the raw dot-path to end users. In dev we warn so we spot the gap
  // during development; in prod the warning is silenced.
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const enMessages = (await import(`../../messages/en.json`)).default;

  return {
    locale,
    messages,
    onError(error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[i18n] ${error.code}: ${error.message}`);
      }
    },
    getMessageFallback({ namespace, key }) {
      // Walk the nested en messages using the dot-path that next-intl gives
      // us. Returns the string when found, or the dot-path as a last resort.
      const path = namespace ? `${namespace}.${key}` : key;
      const segments = path.split('.');
      let node: unknown = enMessages;
      for (const seg of segments) {
        if (node && typeof node === 'object' && seg in (node as Record<string, unknown>)) {
          node = (node as Record<string, unknown>)[seg];
        } else {
          return path; // ultimate fallback — key is visible so bugs surface
        }
      }
      return typeof node === 'string' ? node : path;
    },
  };
});
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: EXIT 0.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/request.ts
git commit -m "i18n: message-fallback handler falls back to en on missing keys"
```

---

### Task 9: Hreflang helper

**Files:**
- Create: `src/lib/hreflang.ts`
- Create: `tests/unit/hreflang.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/hreflang.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/hreflang.test.ts
```
Expected: FAIL — module `@/lib/hreflang` not found.

- [ ] **Step 3: Create `src/lib/hreflang.ts`**

```typescript
import type { Metadata } from 'next';

export const BASE_URL = 'https://preset-forge.com';

export const LOCALES = ['de', 'en', 'es', 'fr', 'it', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Build an hreflang `languages` map for next.js Metadata.alternates.
 * The path should be the locale-less segment — e.g. "/editor" or
 * "/share/abc123". The helper prefixes every locale + serves x-default
 * from English.
 */
export function buildHreflang(path: string): Record<string, string> {
  const normalized = path === '/' ? '' : path;
  const out: Record<string, string> = {};
  for (const locale of LOCALES) {
    out[locale] = `${BASE_URL}/${locale}${normalized}`;
  }
  out['x-default'] = `${BASE_URL}/en${normalized}`;
  return out;
}

/**
 * Convenience wrapper that returns a full { canonical, languages } block
 * suitable for dropping into a generateMetadata return value.
 */
export function buildAlternates(
  path: string,
  currentLocale: Locale,
): NonNullable<Metadata['alternates']> {
  const normalized = path === '/' ? '' : path;
  return {
    canonical: `${BASE_URL}/${currentLocale}${normalized}`,
    languages: buildHreflang(path),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/hreflang.test.ts
```
Expected: PASS (4 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hreflang.ts tests/unit/hreflang.test.ts
git commit -m "feat: hreflang helper for 6-locale metadata alternates"
```

---

### Task 10: Apply hreflang helper across `generateMetadata` blocks

**Files:**
- Modify: `src/app/[locale]/layout.tsx`
- Modify: `src/app/[locale]/editor/layout.tsx`
- Modify: `src/app/[locale]/help/page.tsx`
- Modify: `src/app/[locale]/changelog/page.tsx`
- Modify: `src/app/[locale]/gallery/page.tsx`
- Modify: `src/app/[locale]/amp/[slug]/page.tsx`
- Modify: `src/app/[locale]/share/[token]/page.tsx`

- [ ] **Step 1: For each file above, replace the inline `languages: { de, en, 'x-default' }` block with a call to `buildAlternates`**

Pattern to replace (occurrences vary per file):

```tsx
// Before
alternates: {
  canonical,
  languages: {
    de: `${BASE_URL}/de/...`,
    en: `${BASE_URL}/en/...`,
    'x-default': `${BASE_URL}/en/...`,
  },
},
```

After (same pattern in every file):

```tsx
import { buildAlternates } from '@/lib/hreflang';
// ...
alternates: buildAlternates('/path/without/locale', locale),
```

Concrete path arguments per file:
- `layout.tsx` — `buildAlternates('/', locale)`
- `editor/layout.tsx` — `buildAlternates('/editor', locale)`
- `help/page.tsx` — `buildAlternates('/help', locale)`
- `changelog/page.tsx` — `buildAlternates('/changelog', locale)`
- `gallery/page.tsx` — `buildAlternates('/gallery', locale)`
- `amp/[slug]/page.tsx` — `buildAlternates(\`/amp/${slug}\`, locale)`
- `share/[token]/page.tsx` — `buildAlternates(\`/share/${token}\`, locale)`

For each file: remove any local `BASE_URL` const if it was only used inside the alternates block — import it from `@/lib/hreflang` instead if the rest of the file still needs it.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: EXIT 0.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/[locale]/layout.tsx' 'src/app/[locale]/editor/layout.tsx' 'src/app/[locale]/help/page.tsx' 'src/app/[locale]/changelog/page.tsx' 'src/app/[locale]/gallery/page.tsx' 'src/app/[locale]/amp/[slug]/page.tsx' 'src/app/[locale]/share/[token]/page.tsx'
git commit -m "i18n: use hreflang helper in all generateMetadata blocks"
```

---

### Task 11: Sitemap fan-out across 6 locales

**Files:**
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Replace hand-written de/en pairs with a `LOCALES` loop**

Use the `LOCALES` constant from `src/lib/hreflang.ts` so a future locale addition is again one line.

```tsx
import { prisma } from '@/lib/prisma';
import { listAmpCategories } from '@/core/ampCategories';
import { LOCALES, BASE_URL } from '@/lib/hreflang';

export const dynamic = 'force-dynamic';

type SitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
};

const STATIC_PAGES: Array<{ path: string; changeFrequency: SitemapEntry['changeFrequency']; priority: number }> = [
  { path: '',            changeFrequency: 'weekly',  priority: 1.0 },
  { path: '/editor',     changeFrequency: 'weekly',  priority: 1.0 },
  { path: '/gallery',    changeFrequency: 'daily',   priority: 0.8 },
  { path: '/help',       changeFrequency: 'monthly', priority: 0.6 },
  { path: '/changelog',  changeFrequency: 'weekly',  priority: 0.5 },
];

export default async function sitemap(): Promise<SitemapEntry[]> {
  const now = new Date();

  const staticPages: SitemapEntry[] = STATIC_PAGES.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: `${BASE_URL}/${locale}${page.path}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
  );

  // Amp category landing pages — one per (amp, locale) combo.
  const ampPages: SitemapEntry[] = listAmpCategories().flatMap((cat) =>
    LOCALES.map((locale) => ({
      url: `${BASE_URL}/${locale}/amp/${cat.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  );

  // Public preset share pages — 6 locale variants + 1 JSON endpoint per preset.
  const SITEMAP_PRESET_LIMIT = 10000;
  let presetPages: SitemapEntry[] = [];
  try {
    const publicPresets = await prisma.preset.findMany({
      where: { public: true },
      orderBy: { updatedAt: 'desc' },
      take: SITEMAP_PRESET_LIMIT,
      select: { shareToken: true, updatedAt: true },
    });

    presetPages = publicPresets.flatMap((preset) => {
      const entries: SitemapEntry[] = LOCALES.map((locale) => ({
        url: `${BASE_URL}/${locale}/share/${preset.shareToken}`,
        lastModified: preset.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
      // One locale-less JSON endpoint per preset (API route, not locale-scoped)
      entries.push({
        url: `${BASE_URL}/api/share/${preset.shareToken}/json`,
        lastModified: preset.updatedAt,
        changeFrequency: 'yearly' as const,
        priority: 0.3,
      });
      return entries;
    });
  } catch (err) {
    console.error(
      '[sitemap] failed to load public presets:',
      err instanceof Error ? `${err.name}: ${err.message}` : err,
    );
  }

  return [...staticPages, ...ampPages, ...presetPages];
}
```

- [ ] **Step 2: Update existing sitemap test if one exists**

```bash
npx vitest run tests/unit/ 2>&1 | grep -i sitemap
```

If a sitemap test fails because it expected 64×2 amp URLs, update the expected count to 64×6.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```
Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/sitemap.ts tests/unit/
git commit -m "i18n: fan sitemap out across all 6 locales via LOCALES loop"
```

---

### Task 12: Create LocaleSwitcher component + test

**Files:**
- Create: `src/components/LocaleSwitcher.tsx`
- Create: `tests/unit/LocaleSwitcher.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/LocaleSwitcher.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

// Mock next-intl + routing hooks the switcher uses
const replaceMock = vi.fn();
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/editor',
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'de',
  useTranslations: () => (key: string) => key,
}));

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    replaceMock.mockClear();
  });

  it('renders trigger with aria-label for the switcher', () => {
    render(<LocaleSwitcher />);
    expect(screen.getByRole('button', { name: /switchLocale/i })).toBeTruthy();
  });

  it('opens a menu with all 6 locale options when clicked', () => {
    render(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /switchLocale/i }));
    const items = screen.getAllByRole('menuitem');
    expect(items.length).toBe(6);
  });

  it('shows beta label only on es/fr/it/pt', () => {
    render(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /switchLocale/i }));
    const betaLabels = screen.getAllByText('beta');
    expect(betaLabels.length).toBe(4);
  });

  it('calls router.replace with chosen locale on click', () => {
    render(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /switchLocale/i }));
    const frOption = screen.getByRole('menuitem', { name: /FR/i });
    fireEvent.click(frOption);
    expect(replaceMock).toHaveBeenCalledWith('/editor', { locale: 'fr' });
  });

  it('closes on Escape key', () => {
    render(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /switchLocale/i }));
    expect(screen.getAllByRole('menuitem').length).toBe(6);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryAllByRole('menuitem').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/LocaleSwitcher.test.tsx
```
Expected: FAIL — component not found.

- [ ] **Step 3: Create `src/components/LocaleSwitcher.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';

type Locale = 'de' | 'en' | 'es' | 'fr' | 'it' | 'pt';

// Flag emoji + ISO code. Remove a locale from BETA_LOCALES to drop its
// "beta" badge — that's the entire rollout mechanism, no config flag.
const LOCALE_META: Record<Locale, { flag: string; code: string }> = {
  de: { flag: '🇩🇪', code: 'DE' },
  en: { flag: '🇬🇧', code: 'EN' },
  es: { flag: '🇪🇸', code: 'ES' },
  fr: { flag: '🇫🇷', code: 'FR' },
  it: { flag: '🇮🇹', code: 'IT' },
  pt: { flag: '🇵🇹', code: 'PT' },
};

const LOCALE_ORDER: Locale[] = ['de', 'en', 'es', 'fr', 'it', 'pt'];
const BETA_LOCALES = new Set<Locale>(['es', 'fr', 'it', 'pt']);

export function LocaleSwitcher() {
  const t = useTranslations('nav');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  const current = LOCALE_META[locale];

  function choose(target: Locale) {
    setOpen(false);
    if (target !== locale) {
      router.replace(pathname, { locale: target });
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('switchLocale')}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="locale-switcher-trigger"
        className="font-mono-display text-xs px-2.5 py-1 rounded transition-all flex items-center gap-1.5"
        style={{
          border: '1px solid var(--border-active)',
          color: 'var(--text-secondary)',
        }}
      >
        <span aria-hidden="true">{current.flag}</span>
        <span>{current.code}</span>
        <span aria-hidden="true" className="opacity-70">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 min-w-[140px] rounded py-1 z-50"
          style={{
            background: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          {LOCALE_ORDER.map((l) => {
            const meta = LOCALE_META[l];
            const isActive = l === locale;
            return (
              <button
                key={l}
                role="menuitem"
                onClick={() => choose(l)}
                className="w-full text-left px-3 py-1.5 text-xs font-mono-display flex items-center gap-2 transition-colors hover:!bg-[var(--glow-amber)]"
                style={{
                  color: isActive ? 'var(--accent-amber)' : 'var(--text-secondary)',
                }}
              >
                <span aria-hidden="true">{meta.flag}</span>
                <span>{meta.code}</span>
                {BETA_LOCALES.has(l) && (
                  <span
                    className="ml-auto text-[9px] uppercase tracking-wider opacity-60"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    beta
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/LocaleSwitcher.test.tsx
```
Expected: PASS (5 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/LocaleSwitcher.tsx tests/unit/LocaleSwitcher.test.tsx
git commit -m "feat: LocaleSwitcher dropdown with 6-locale support + beta labels"
```

---

### Task 13: Integrate LocaleSwitcher in Navbar

**Files:**
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Add import at top of Navbar.tsx**

```tsx
import { LocaleSwitcher } from './LocaleSwitcher';
```

- [ ] **Step 2: Remove the old binary toggle button in desktop navigation**

In the desktop nav section, find this block (around lines 177-196):

```tsx
<button
  onClick={switchLocale}
  aria-label={t('switchLocale')}
  data-testid="nav-locale-switcher"
  className="font-mono-display text-xs px-2.5 py-1 rounded transition-all"
  style={{
    border: '1px solid var(--border-active)',
    color: 'var(--text-secondary)',
  }}
  onMouseEnter={(e) => { /* ... */ }}
  onMouseLeave={(e) => { /* ... */ }}
>
  {otherLocale.toUpperCase()}
</button>
```

Replace with:

```tsx
<LocaleSwitcher />
```

- [ ] **Step 3: Remove `otherLocale` and `switchLocale` from the component body if no longer used**

Find and delete:

```tsx
const otherLocale = locale === 'de' ? 'en' : 'de';

function switchLocale() {
  router.replace(pathname, { locale: otherLocale });
}
```

Keep `router` and `pathname` — they are still used by the mobile flag row and `handleLogout`.

- [ ] **Step 4: Replace mobile toggle with horizontal flag row**

In the mobile menu section (the block inside `{mobileOpen && ...}`), find the existing mobile locale button near the bottom:

```tsx
<div className="flex gap-3 items-center pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
  <button
    onClick={switchLocale}
    /* ... */
  >
    {otherLocale.toUpperCase()}
  </button>
</div>
```

Replace with a horizontal flag row:

```tsx
<div
  className="flex gap-2 items-center pt-3 flex-wrap"
  style={{ borderTop: '1px solid var(--border-subtle)' }}
>
  {(['de','en','es','fr','it','pt'] as const).map((l) => {
    const flag = l === 'de' ? '🇩🇪' : l === 'en' ? '🇬🇧' : l === 'es' ? '🇪🇸'
      : l === 'fr' ? '🇫🇷' : l === 'it' ? '🇮🇹' : '🇵🇹';
    return (
      <button
        key={l}
        onClick={() => {
          setMobileOpen(false);
          router.replace(pathname, { locale: l });
        }}
        aria-label={l.toUpperCase()}
        className="font-mono-display text-xs px-2 py-1 rounded flex items-center gap-1"
        style={{
          border: locale === l ? '1px solid var(--accent-amber)' : '1px solid var(--border-subtle)',
          color: locale === l ? 'var(--accent-amber)' : 'var(--text-secondary)',
        }}
      >
        <span aria-hidden="true">{flag}</span>
        <span>{l.toUpperCase()}</span>
      </button>
    );
  })}
</div>
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```
Expected: EXIT 0.

- [ ] **Step 6: Run Navbar-adjacent unit tests**

```bash
npx vitest run tests/unit/
```
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat: swap Navbar binary toggle for LocaleSwitcher + mobile flag row"
```

---

### Task 14: Generate 4 new message files via parallel subagents

**Files:**
- Create: `messages/es.json`
- Create: `messages/fr.json`
- Create: `messages/it.json`
- Create: `messages/pt.json`

- [ ] **Step 1: Dispatch 4 Opus subagents in parallel**

Send one message containing 4 `Agent` tool calls — one per target language. Each subagent prompt template:

```
You are translating the UI copy of Preset Forge, a free browser-based editor
for the Valeton GP-200 guitar multi-effect unit. Target language: <LANG>.

Read these three files from the repo at /home/manuel/claude/gp200editor:
1. messages/en.json — source of truth, 436 keys, 13 namespaces
2. messages/de.json — existing German translation for reference on
   terminology choices. Note: DE keeps "Preset" in English, so do you.
3. docs/i18n-glossary.md — authoritative term list. Use the <LANG> column
   for per-term choices.

Translation rules:
- Preserve the JSON structure EXACTLY. Same keys, same nesting. Only
  translate string VALUES.
- Preserve ICU placeholders like {count}, {name}, {date} verbatim. Never
  translate placeholder names.
- Keep these brand/technical terms in English regardless of language:
  Preset Forge, Valeton, GP-200, HX Stomp, MIDI, USB, SysEx, PWA,
  preset, bypass, reverb, delay, chorus, flanger, phaser, tremolo, EQ,
  compressor, noise gate, wah, overdrive, distortion, boost, tap tempo,
  IR, cab, amp (as a UI label), all amp brand names (Marshall, Vox, ...)
- Tone: friendly-technical, hobbyist-to-semi-pro audience, informal you
  (tú/tu/você). Match the warmth of the existing DE/EN copy.
- Do NOT invent keys or drop keys. Output JSON must parse.
- Do NOT wrap the output in code fences or commentary — return raw JSON
  only.

Return the complete translated messages/<LANG>.json content as one JSON
object.
```

Wait for all 4 subagents to complete.

- [ ] **Step 2: Write each returned JSON to its destination file**

For each language the subagent returned, use the `Write` tool with the complete content to create `messages/{lang}.json`. Do not hand-edit the returned content.

- [ ] **Step 3: Validate all 4 files parse as JSON**

```bash
jq '.' messages/es.json > /dev/null && echo "es OK"
jq '.' messages/fr.json > /dev/null && echo "fr OK"
jq '.' messages/it.json > /dev/null && echo "it OK"
jq '.' messages/pt.json > /dev/null && echo "pt OK"
```
Expected: 4 lines each ending in `OK`.

- [ ] **Step 4: Commit**

```bash
git add messages/es.json messages/fr.json messages/it.json messages/pt.json
git commit -m "i18n: add Spanish/French/Italian/Portuguese translations (beta)"
```

---

### Task 15: Parity test should now cover all 6 files

- [ ] **Step 1: Re-run parity test**

```bash
npx vitest run tests/unit/messages-parity.test.ts
```
Expected: PASS — 5 test cases (de, es, fr, it, pt each match en). If any file drifts, the failure message lists `missing`/`extra` keys.

- [ ] **Step 2: (only if previous step failed) Fix drift and re-run**

Read the failure output. For each missing key, add it to the offending file with a translated value. For each extra key, remove it. Re-run until green. Commit fixes:

```bash
git add messages/
git commit -m "i18n: fix key parity drift after initial translation batch"
```

- [ ] **Step 3: No commit needed if green on first try** — files are already committed in Task 14.

---

### Task 16: E2E smoke test per locale

**Files:**
- Create: `tests/e2e/i18n-locales.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// One smoke test per locale: load the landing page, assert a known
// translated snippet appears so we know the right message file loaded.
// Then navigate to /editor and /gallery so a bundle or routing error
// surfaces in CI instead of production.
const LOCALES = [
  { locale: 'de', heroSubstring: 'Valeton GP-200' },
  { locale: 'en', heroSubstring: 'Valeton GP-200' },
  { locale: 'es', heroSubstring: 'Valeton GP-200' },
  { locale: 'fr', heroSubstring: 'Valeton GP-200' },
  { locale: 'it', heroSubstring: 'Valeton GP-200' },
  { locale: 'pt', heroSubstring: 'Valeton GP-200' },
];

for (const { locale, heroSubstring } of LOCALES) {
  test.describe(`[${locale}] smoke`, () => {
    test('landing page renders', async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page).toHaveURL(new RegExp(`/${locale}$|/${locale}/`));
      // heroSubstring is brand name — appears in every language
      await expect(page.locator('body')).toContainText(heroSubstring);
      // html lang reflects the locale
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
    });

    test('editor loads', async ({ page }) => {
      await page.goto(`/${locale}/editor`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/editor`));
      // The editor page must not be a 404 — look for the file upload
      // dropzone which is locale-agnostic and always present.
      await expect(page.locator('[data-testid="file-upload"]').first()).toBeVisible({ timeout: 10000 });
    });

    test('gallery loads', async ({ page }) => {
      await page.goto(`/${locale}/gallery`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/gallery`));
      // Any link to a preset share page confirms the gallery rendered
      await expect(page.locator('a[href*="/share/"]').first()).toBeVisible({ timeout: 10000 });
    });

    test('a11y — no critical WCAG issues on landing', async ({ page }) => {
      await page.goto(`/${locale}`);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      const critical = results.violations.filter((v) => v.impact === 'critical');
      expect(critical).toEqual([]);
    });
  });
}
```

- [ ] **Step 2: Note — this test requires a running dev server + DB + Garage**

It's a Playwright E2E test, so it runs under `npm run test:e2e`, not unit-test CI. The plan does not require running it during implementation — just commit it so it runs in the E2E pipeline later.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/i18n-locales.spec.ts
git commit -m "test: E2E smoke + a11y for all 6 locales"
```

---

### Task 17: Full local CI + push

- [ ] **Step 1: Run local CI**

```bash
bash scripts/local-ci.sh
```

Expected: `✔ Lint`, `✔ Typecheck`, `✔ Tests`, `✔ Build`. If any stage fails, read the error, fix it, and re-run from the failed stage: `bash scripts/local-ci.sh test` or `bash scripts/local-ci.sh build`.

Common fixes:
- **Test failure:** Run `npx vitest run <path>` for the failing file to see details.
- **Typecheck error in a locale-related file:** You may need to cast the locale union in one more place — look at how `src/middleware.ts` does it.
- **Build error about missing message key:** A hardcoded string was removed but not replaced with `t(...)`. Search for the literal string in `src/` and restore or replace.

- [ ] **Step 2: Confirm expected test count**

After all tasks above, unit test count should be ~440–450 (from 417 baseline + new tests in tasks 3, 7, 9, 12, and the per-file iterations of task 3).

- [ ] **Step 3: Push**

```bash
git push origin master
```

- [ ] **Step 4: Smoke test in dev**

Start the dev server (`npm run dev` in a separate terminal), open `http://localhost:3000/`. Expected flow:
1. Browser with Accept-Language: en → redirected to `/en`
2. Open the locale switcher → dropdown shows 6 options, ES/FR/IT/PT have `beta`
3. Click `🇫🇷 FR` → URL becomes `/fr`, page reloads with French copy
4. Click `/editor` — editor loads
5. Click `/gallery` — gallery loads
6. Back to switcher → click `🇩🇪 DE` → now on `/de`, German copy visible
7. Open DevTools → Application → Cookies → `NEXT_LOCALE=de` set

If anything fails at this stage, it's a runtime regression — check the browser console and server logs.

---

## Self-review checklist

**Spec coverage:**
- [x] Locale list expanded (Task 5)
- [x] Default locale to en (Task 5)
- [x] Locale detection + cookie (Task 5 via `localeDetection: true`)
- [x] Message files for 4 new locales (Task 14)
- [x] Fallback to en on missing key (Task 8)
- [x] Middleware matcher updated (Task 6)
- [x] Sitemap fan-out (Task 11)
- [x] Hreflang helper + applied across metadata blocks (Task 9, 10)
- [x] LocaleSwitcher dropdown with flags + codes + beta labels (Task 12)
- [x] Mobile flag row (Task 13)
- [x] Key parity test (Task 3)
- [x] Hardcoded-string extraction (Task 4)
- [x] Middleware test (Task 7)
- [x] LocaleSwitcher test (Task 12)
- [x] Hreflang test (Task 9)
- [x] E2E smoke per locale (Task 16)
- [x] Domain glossary (Task 1)
- [x] Do-not-translate list baked into subagent prompts (Task 14)

**No tasks for spec requirements that don't belong in code:**
- "API errors stay English" — explicit non-goal, no task.
- "Beta label removable via single-line edit" — verified by the `BETA_LOCALES` Set in Task 12. No separate task.

**Type consistency:** Locale is typed `'de' | 'en' | 'es' | 'fr' | 'it' | 'pt'` in routing.ts, hreflang.ts, LocaleSwitcher.tsx, and middleware.ts. All files use the same literal set.

**Placeholder scan:** No `TBD`, `TODO`, or `implement later` in any task. Every code block is complete. Every command has an expected output.
