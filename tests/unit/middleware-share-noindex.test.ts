import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

// GSC 2026-07-30..2026-10-29: ~25 /editor?share=<token> URLs were indexed as
// separate pages despite their canonical pointing at /editor (≈200
// impressions, 1 click) — plus one /editor?share=undefined. The query string
// only tells the client which gallery preset to preload; the document is the
// same editor. noindex keeps them out of the index, follow keeps the link
// graph intact.
const req = (path: string) => new NextRequest(`https://www.preset-forge.com${path}`);

describe('X-Robots-Tag on editor share links', () => {
  it.each([
    '/editor?share=61117479729d4a64be3b25d34b905c11',
    '/editor?share=undefined',
    '/editor?share=',
    '/de/editor?share=abc',
    '/pt-BR/editor?share=abc',
    '/editor/?share=abc',
    '/editor?foo=1&share=abc',
  ])('marks %s noindex, follow', async (path) => {
    const res = await middleware(req(path));
    expect(res?.headers.get('x-robots-tag')).toBe('noindex, follow');
  });

  it('also marks the /en/ redirect hop noindex', async () => {
    const res = await middleware(req('/en/editor?share=abc'));
    expect(res?.status).toBe(308);
    expect(res?.headers.get('x-robots-tag')).toBe('noindex, follow');
  });

  it.each([
    '/editor',
    '/de/editor',
    '/editor?foo=1',
    '/gallery?share=abc',
    '/share/abc',
    '/editorial?share=abc',
  ])('leaves %s indexable', async (path) => {
    const res = await middleware(req(path));
    expect(res?.headers.get('x-robots-tag')).toBeNull();
  });
});
