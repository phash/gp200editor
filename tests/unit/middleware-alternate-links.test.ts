import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

// next-intl's middleware emits its own `Link: <...>; rel="alternate"`
// hreflang set, and it derives x-default from the *unprefixed* path. Next.js
// metadata (src/lib/hreflang.ts) emits an HTML hreflang set whose x-default
// is the /en/ URL. Both were being served on every page:
//
//   HTTP  Link: <https://www.preset-forge.com/help>;    hreflang="x-default"
//   HTML  <link rel="alternate" hrefLang="x-default" href=".../en/help">
//
// Two contradicting x-default declarations for one page. Google discards a
// conflicting hreflang cluster, and the header actively told it the
// unprefixed URL — which only 307-redirects — was the canonical entry point.
// GSC confirms which one won: /help 577 impressions, /en/help 3.
//
// The HTML metadata is the single source of truth, so the header is off.
describe('intl middleware alternate links', () => {
  it('does not emit hreflang Link headers', async () => {
    const res = await middleware(
      new NextRequest('https://www.preset-forge.com/en/help'),
    );

    const link = res?.headers.get('link') ?? '';
    expect(link).not.toContain('hreflang');
  });

  it('serves the unprefixed path directly instead of redirecting', async () => {
    // localePrefix 'as-needed': English lives here. No hop, and no
    // temporary redirect for Google to keep in the index.
    const res = await middleware(new NextRequest('https://www.preset-forge.com/help'));

    expect(res?.status).toBe(200);
  });

  it('redirects the /en/ form onto the unprefixed path', async () => {
    const res = await middleware(new NextRequest('https://www.preset-forge.com/en/help'));

    expect(res?.status).toBe(307);
    expect(new URL(res!.headers.get('location')!).pathname).toBe('/help');
  });
});
