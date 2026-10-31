import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LOCALES } from '@/i18n/locales';

import de from '../../messages/de.json';
import en from '../../messages/en.json';
import es from '../../messages/es.json';
import fr from '../../messages/fr.json';
import it_ from '../../messages/it.json';
import pt from '../../messages/pt.json';
import ptBR from '../../messages/pt-BR.json';

const MESSAGES: Record<string, typeof en> = { de, en, es, fr, it: it_, pt, 'pt-BR': ptBR };

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async ({ locale, namespace }: { locale: string; namespace: string }) => {
    const ns = (MESSAGES[locale] as unknown as Record<string, Record<string, string>>)[namespace];
    return (key: string) => ns[key] ?? `MISSING:${key}`;
  }),
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, locale, children }: { href: string; locale?: string; children: React.ReactNode }) => (
    <a href={href} data-locale={locale}>{children}</a>
  ),
}));

import { EditorAbout } from '@/components/EditorAbout';
import { generateMetadata } from '@/app/[locale]/editor/layout';

// GSC 2026-07-30..10-29: /editor at 4.8% CTR; "gp 200 editor" (pos 4.9),
// "gp200 editor" (pos 5.2, 0 clicks). The editor page is a client
// component with almost no server-rendered text, so this block carries it.
describe('EditorAbout', () => {
  it('renders the full text block server-side, with no missing keys', async () => {
    const { container } = render(await EditorAbout({ locale: 'en' }));
    const text = container.textContent ?? '';
    expect(text).not.toContain('MISSING:');
    expect(text).toContain(en.editorAbout.heading);
    expect(container.querySelectorAll('li').length).toBeGreaterThanOrEqual(7);
    const words = text.split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(500);
    expect(words).toBeLessThanOrEqual(750);
  });

  it('uses an h2 so the editor keeps its own h1', async () => {
    const { container } = render(await EditorAbout({ locale: 'en' }));
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('h2')?.textContent).toBe(en.editorAbout.heading);
  });

  it('links the editor guide in the page locale, or English where untranslated', async () => {
    const guideLink = async (locale: 'de' | 'fr') => {
      const { container } = render(await EditorAbout({ locale }));
      return container.querySelector('a[href="/guides/valeton-gp-200-editor"]')!;
    };
    expect((await guideLink('de')).getAttribute('data-locale')).toBe('de');
    expect((await guideLink('fr')).getAttribute('data-locale')).toBe('en');
  });
});

describe('editor metadata', () => {
  it.each(LOCALES)('%s names the GP-200 editor and stays within snippet length', async (locale) => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale }) });
    const title = String(meta.title);
    expect(title).toMatch(/GP-200 Editor|Editor GP-200|Éditeur GP-200/);
    expect(title).toContain('GP200');
    expect(title.length).toBeLessThanOrEqual(75);
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
    expect(meta.alternates?.canonical).toBeTruthy();
  });

  it('is localized instead of English everywhere', async () => {
    const enMeta = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
    const deMeta = await generateMetadata({ params: Promise.resolve({ locale: 'de' }) });
    expect(deMeta.description).not.toBe(enMeta.description);
  });
});
