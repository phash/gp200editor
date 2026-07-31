import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import { LOCALES, type Locale } from './locales';

// Re-export LOCALES + Locale type so existing callers of '@/i18n/routing'
// keep working. The actual definition lives in ./locales which has no
// imports and is safe to load from any context.
export { LOCALES, type Locale };

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: 'en',
  localeDetection: true,
  // English is served from the unprefixed path; /en/... only redirects to
  // it. With the previous 'always' every entry point cost a 307 hop, and
  // because next-intl issues that redirect as *temporary*, Google kept the
  // redirecting URL in the index instead of consolidating onto the target.
  // The index ended up split down the middle — /help 577 impressions vs
  // /en/help 3, but /en/gallery 308 vs /gallery 10 (GSC Q2/2026). Roughly
  // 70% of indexed impressions already sit on the unprefixed form, so this
  // is the shape that costs the least to converge on.
  // src/lib/hreflang.ts DEFAULT_LOCALE must match defaultLocale above.
  localePrefix: 'as-needed',
  // Off: next-intl would otherwise emit its own `Link: <...>;
  // rel="alternate"` hreflang set from the middleware, deriving x-default
  // from the *unprefixed* path. Next.js metadata already emits an HTML
  // hreflang set (src/lib/hreflang.ts) whose x-default is the /en/ URL, so
  // every page shipped two contradicting x-default declarations. Google
  // consolidated on the unprefixed URL — which only 307-redirects and holds
  // no content (GSC Q2/2026: /help 577 impressions, /en/help 3).
  // buildAlternates() is the single source of truth for hreflang.
  alternateLinks: false,
});

// Typed navigation helpers — import Link, useRouter, usePathname from this module
// instead of from 'next/navigation' for locale-aware routing
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
