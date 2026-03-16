import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['de', 'en'],
  defaultLocale: 'de',
});

// Typed navigation helpers — import Link, useRouter, usePathname from this module
// instead of from 'next/navigation' for locale-aware routing
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
