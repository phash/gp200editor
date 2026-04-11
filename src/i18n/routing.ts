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
});

// Typed navigation helpers — import Link, useRouter, usePathname from this module
// instead of from 'next/navigation' for locale-aware routing
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
