import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/i18n/locales';
import { renderEmailHtml, renderEmailText } from '@/lib/emailTemplate';
import enMsg from '../../messages/en.json';
import deMsg from '../../messages/de.json';
import esMsg from '../../messages/es.json';
import frMsg from '../../messages/fr.json';
import itMsg from '../../messages/it.json';
import ptMsg from '../../messages/pt.json';

const ALL = { de: deMsg, en: enMsg, es: esMsg, fr: frMsg, it: itMsg, pt: ptMsg };

describe('renderEmailHtml', () => {
  it('includes brand wordmark and amber CTA', () => {
    const html = renderEmailHtml({
      locale: 'en',
      heading: 'Hello',
      intro: 'Body',
      cta: { label: 'Click', url: 'https://example.com' },
    });
    expect(html).toContain('PRESET FORGE');
    expect(html).toContain('Click');
    expect(html).toContain('https://example.com');
    expect(html).toContain('#d4a24e');
  });

  it('escapes html in headings and intros', () => {
    const html = renderEmailHtml({
      locale: 'en',
      heading: '<script>alert(1)</script>',
      intro: '"&\'<>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;');
    expect(html).toContain('&amp;');
  });

  it('renders sections with optional CTA links', () => {
    const html = renderEmailHtml({
      locale: 'en',
      heading: 'h',
      intro: 'i',
      sections: [
        { title: 'A', body: 'aaa', cta: { label: 'Go', url: 'https://a.test' } },
        { title: 'B', body: 'bbb' },
      ],
    });
    expect(html).toContain('A');
    expect(html).toContain('aaa');
    expect(html).toContain('https://a.test');
    expect(html).toContain('B');
    expect(html).toContain('bbb');
  });

  it('includes preheader hidden block for inbox preview', () => {
    const html = renderEmailHtml({
      locale: 'en',
      heading: 'h',
      intro: 'i',
      preheader: 'preview-snippet',
    });
    expect(html).toContain('preview-snippet');
    expect(html).toMatch(/display:\s*none/);
  });
});

describe('renderEmailText', () => {
  it('returns plain-text fallback with heading, intro, cta url', () => {
    const text = renderEmailText({
      locale: 'en',
      heading: 'Hello',
      intro: 'Body',
      cta: { label: 'Click', url: 'https://example.com' },
    });
    expect(text).toContain('Hello');
    expect(text).toContain('Body');
    expect(text).toContain('https://example.com');
  });
});

describe('email i18n keys (parity)', () => {
  const REQUIRED_PATHS = [
    'email.brand',
    'email.tagline',
    'email.footerNote',
    'email.verify.subject',
    'email.verify.heading',
    'email.verify.intro',
    'email.verify.ctaLabel',
    'email.reset.subject',
    'email.reset.heading',
    'email.reset.intro',
    'email.reset.ctaLabel',
    'email.warning.subject',
    'email.warning.heading',
    'email.warning.reasonLabel',
    'email.warning.detailsLabel',
    'email.welcome.subject',
    'email.welcome.heading',
    'email.welcome.intro',
    'email.welcome.stepUpload.title',
    'email.welcome.stepUpload.ctaLabel',
    'email.welcome.stepEditor.title',
    'email.welcome.stepEditor.ctaLabel',
    'email.welcome.stepGallery.title',
    'email.welcome.stepGallery.ctaLabel',
    'email.welcome.stepProfile.title',
    'email.welcome.stepProfile.ctaLabel',
    'email.verifyReminderD2.subject',
    'email.verifyReminderD2.preheader',
    'email.verifyReminderD2.heading',
    'email.verifyReminderD2.intro',
    'email.verifyReminderD2.ctaLabel',
    'email.verifyReminderD2.closing',
    'email.verifyReminderD7.subject',
    'email.verifyReminderD7.preheader',
    'email.verifyReminderD7.heading',
    'email.verifyReminderD7.intro',
    'email.verifyReminderD7.ctaLabel',
    'email.verifyReminderD7.closing',
  ];

  function getPath(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, k) => {
      if (acc && typeof acc === 'object' && k in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[k];
      }
      return undefined;
    }, obj);
  }

  for (const locale of LOCALES) {
    it(`${locale}: has all required email.* keys`, () => {
      const msg = ALL[locale];
      for (const path of REQUIRED_PATHS) {
        const val = getPath(msg, path);
        expect(val, `${locale} missing ${path}`).toBeTruthy();
        expect(typeof val, `${locale} ${path} not string`).toBe('string');
      }
    });
  }

  it('welcome heading contains {username} placeholder in every locale', () => {
    for (const locale of LOCALES) {
      const heading = getPath(ALL[locale], 'email.welcome.heading') as string;
      expect(heading, `${locale} welcome.heading must include {username}`).toContain('{username}');
    }
  });
});
