import { describe, it, expect } from 'vitest';
import { renderEmailLayout } from '@/lib/emailTemplate';

describe('renderEmailLayout', () => {
  it('produces a complete HTML document with dark color-scheme', () => {
    const html = renderEmailLayout({
      preheader: 'hello',
      bodyHtml: '<p>x</p>',
      locale: 'en',
    });
    expect(html).toContain('<!doctype html');
    expect(html).toContain('color-scheme');
    expect(html).toContain('dark');
    expect(html).toContain('<p>x</p>');
    expect(html).toContain('hello');
  });

  it('escapes preheader text', () => {
    const html = renderEmailLayout({
      preheader: '<script>alert(1)</script>',
      bodyHtml: '',
      locale: 'en',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
