import { describe, it, expect, beforeEach } from 'vitest';
import { trackEvent, trackPageView } from '@/lib/analytics';

beforeEach(() => {
  delete window._paq;
});

describe('trackEvent', () => {
  it('queues an event even before matomo.js has loaded', () => {
    trackEvent('Editor', 'Load', 'prst');
    expect(window._paq).toEqual([['trackEvent', 'Editor', 'Load', 'prst']]);
  });

  it('omits the name when none is given', () => {
    trackEvent('Editor', 'Download');
    expect(window._paq).toEqual([['trackEvent', 'Editor', 'Download']]);
  });

  it('appends to an existing queue', () => {
    window._paq = [['disableCookies']];
    trackEvent('Account', 'Register');
    expect(window._paq).toHaveLength(2);
  });
});

describe('trackPageView', () => {
  it('sets url, title and referrer before tracking the view', () => {
    trackPageView('https://example.test/de/help', 'Hilfe', 'https://example.test/');
    expect(window._paq).toEqual([
      ['setReferrerUrl', 'https://example.test/'],
      ['setCustomUrl', 'https://example.test/de/help'],
      ['setDocumentTitle', 'Hilfe'],
      ['trackPageView'],
      ['enableLinkTracking'],
    ]);
  });
});
