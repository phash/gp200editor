import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

let pathname = '/';
let locale = 'en';
vi.mock('@/i18n/routing', () => ({ usePathname: () => pathname }));
vi.mock('next-intl', () => ({ useLocale: () => locale }));

import { MatomoRouteTracker } from '@/components/MatomoRouteTracker';

function navigate(path: string) {
  window.history.pushState({}, '', path);
}

function pageViews() {
  return (window._paq ?? []).filter((c) => c[0] === 'trackPageView').length;
}

beforeEach(() => {
  vi.useFakeTimers();
  delete window._paq;
  pathname = '/';
  locale = 'en';
  navigate('/');
});
afterEach(() => vi.useRealTimers());

describe('MatomoRouteTracker', () => {
  it('does not track the first page — the layout snippet already does', () => {
    render(<MatomoRouteTracker />);
    vi.advanceTimersByTime(1000);
    expect(pageViews()).toBe(0);
  });

  it('tracks a client-side navigation with the previous page as referrer', () => {
    const { rerender } = render(<MatomoRouteTracker />);
    navigate('/help');
    pathname = '/help';
    document.title = 'Help';
    rerender(<MatomoRouteTracker />);
    vi.advanceTimersByTime(1000);
    expect(pageViews()).toBe(1);
    expect(window._paq).toContainEqual(['setCustomUrl', 'http://localhost:3000/help']);
    expect(window._paq).toContainEqual(['setReferrerUrl', 'http://localhost:3000/']);
    expect(window._paq).toContainEqual(['setDocumentTitle', 'Help']);
  });

  it('tracks a locale switch even though the pathname stays the same', () => {
    navigate('/help');
    pathname = '/help';
    const { rerender } = render(<MatomoRouteTracker />);
    navigate('/de/help');
    locale = 'de';
    rerender(<MatomoRouteTracker />);
    vi.advanceTimersByTime(1000);
    expect(pageViews()).toBe(1);
    expect(window._paq).toContainEqual(['setCustomUrl', 'http://localhost:3000/de/help']);
  });
});
