/**
 * Thin wrapper around the Matomo command queue (`window._paq`).
 *
 * The Matomo snippet in `app/[locale]/layout.tsx` sets up cookieless,
 * Do-Not-Track-respecting tracking; everything pushed here goes through the
 * same queue and therefore obeys the same flags. Commands pushed before
 * matomo.js has loaded are queued and replayed by Matomo.
 *
 * Never put personal data (usernames, e-mail addresses, free text) into event
 * names — the privacy notice promises anonymous usage statistics only.
 */

type MatomoCommand = [string, ...unknown[]];

declare global {
  interface Window {
    _paq?: MatomoCommand[];
  }
}

function push(command: MatomoCommand): void {
  if (typeof window === 'undefined') return;
  window._paq = window._paq || [];
  window._paq.push(command);
}

export type AnalyticsCategory = 'Editor' | 'Device' | 'Preset' | 'Account' | 'Feedback';

export function trackEvent(category: AnalyticsCategory, action: string, name?: string): void {
  push(name === undefined ? ['trackEvent', category, action] : ['trackEvent', category, action, name]);
}

/**
 * Record a client-side navigation. The App Router swaps pages without a full
 * load, so Matomo only sees the first page of a visit unless we tell it.
 */
export function trackPageView(url: string, title: string, referrer: string): void {
  push(['setReferrerUrl', referrer]);
  push(['setCustomUrl', url]);
  push(['setDocumentTitle', title]);
  push(['trackPageView']);
  // Make the link/download tracker pick up links rendered by the new page.
  push(['enableLinkTracking']);
}
