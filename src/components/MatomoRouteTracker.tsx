'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { usePathname } from '@/i18n/routing';
import { trackPageView } from '@/lib/analytics';

/**
 * Sends a Matomo page view on every client-side route change. The first page
 * of a visit is tracked by the snippet in the layout, so the initial render is
 * skipped. The locale is part of the dependency list because `usePathname`
 * from next-intl strips it — switching /help to /de/help would go unseen.
 */
export function MatomoRouteTracker() {
  const pathname = usePathname();
  const locale = useLocale();
  const previousUrl = useRef<string | null>(null);

  useEffect(() => {
    const url = window.location.href;
    if (previousUrl.current === null) {
      previousUrl.current = url;
      return;
    }
    if (previousUrl.current === url) return;
    const referrer = previousUrl.current;
    previousUrl.current = url;
    // Give the App Router a moment to commit the new page's <title>.
    const id = setTimeout(() => trackPageView(url, document.title, referrer), 300);
    return () => clearTimeout(id);
  }, [pathname, locale]);

  return null;
}
