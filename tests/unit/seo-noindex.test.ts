import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateMetadata as changelogMetadata } from '@/app/[locale]/changelog/page';
import { generateMetadata as legalMetadata } from '@/app/[locale]/legal/page';

// Pages that exist for humans but must never compete for search impressions.
// Both were measured in Google Search Console over 2026-04-30..2026-07-29:
//   /changelog  180 impressions →  1 click (CTR 0.56%, worst on the site)
//   /legal       21 impressions →  0 clicks
// They rank for long-tail queries they cannot answer, which drags the
// site-wide CTR and average position down without ever earning a visit.
describe('noindex pages', () => {
  it('marks /changelog noindex while keeping its links crawlable', async () => {
    const meta = await changelogMetadata({ params: Promise.resolve({ locale: 'en' as const }) });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('marks /legal noindex while keeping its links crawlable', async () => {
    const meta = await legalMetadata({ params: Promise.resolve({ locale: 'en' }) });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('keeps the canonical + hreflang block on noindex pages', async () => {
    // noindex removes the page from the index; it does not make duplicate
    // locale variants of it stop existing. The hreflang cluster stays so the
    // seven variants are still understood as one page.
    const meta = await changelogMetadata({ params: Promise.resolve({ locale: 'de' as const }) });
    expect(meta.alternates?.canonical).toBe('https://www.preset-forge.com/de/changelog');
  });
});

describe('robots.txt', () => {
  const robots = readFileSync(join(process.cwd(), 'public', 'robots.txt'), 'utf8');

  it('disallows /api/ — API routes are responses, not pages', () => {
    expect(robots).toMatch(/^Disallow: \/api\//m);
  });

  it('still allows the rest of the site and points at the sitemap', () => {
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toContain('Sitemap: https://www.preset-forge.com/sitemap.xml');
  });
});
