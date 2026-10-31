import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';

const MESSAGES = { en, fr } as const;

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async (arg: string | { locale: string; namespace: string }) => {
    const { locale, namespace } =
      typeof arg === 'string' ? { locale: 'en', namespace: arg } : arg;
    const ns = (MESSAGES as unknown as Record<string, Record<string, Record<string, string>>>)[locale][namespace];
    return (key: string) => ns[key] ?? key;
  }),
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, locale, children }: { href: string; locale?: string; children: React.ReactNode }) => (
    <a href={href} data-locale={locale}>{children}</a>
  ),
}));

import HelpPage from '@/app/[locale]/help/page';

async function renderHelp(locale: 'en' | 'fr') {
  const ui = await HelpPage({ params: Promise.resolve({ locale }) });
  return render(ui);
}

function faqJsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  const graph = JSON.parse(script!.innerHTML)['@graph'] as { '@type': string; mainEntity?: { name: string; acceptedAnswer: { text: string } }[] }[];
  return graph.find((n) => n['@type'] === 'FAQPage')!.mainEntity!;
}

// GSC 2026-07-30..10-29: /help had 627 impressions at 0.6% CTR, mostly for
// conversational follow-ups ("what about android?", "chromebook?", "i'm
// using linux", "it still doesn't work", Firefox's add-on notice). Each of
// those needs a direct answer — on the page and in the FAQPage JSON-LD.
describe('help FAQ', () => {
  it.each([
    ['Android', en.help.faqAndroidQ],
    ['Chromebook', en.help.faqChromebookQ],
    ['Firefox add-on', en.help.faqFirefoxQ],
    ['Linux', en.help.faqLinuxQ],
    ['Windows 11', en.help.faqWindowsQ],
    ['not detected', en.help.faqNotDetectedQ],
  ])('answers the %s question on the page and in JSON-LD', async (_, question) => {
    const { container, getByText } = await renderHelp('en');
    expect(getByText(question)).toBeTruthy();
    expect(faqJsonLd(container).map((q) => q.name)).toContain(question);
  });

  it('keeps every visible FAQ entry in the JSON-LD, answer included', async () => {
    const { container } = await renderHelp('en');
    const visible = [...container.querySelectorAll('h3')].map((h) => h.textContent);
    const ld = faqJsonLd(container);
    expect(ld.map((q) => q.name)).toEqual(visible);
    for (const q of ld) expect(q.acceptedAnswer.text.length).toBeGreaterThan(40);
  });

  it('links the Linux answer to the Linux guide in the page locale when translated', async () => {
    const { getByText } = await renderHelp('en');
    const link = getByText(en.help.faqLinuxLink).closest('a')!;
    expect(link.getAttribute('href')).toBe('/guides/gp-200-on-linux');
    expect(link.getAttribute('data-locale')).toBe('en');
  });

  it('falls back to the English Linux guide where it is not translated', async () => {
    const { getByText } = await renderHelp('fr');
    const link = getByText(fr.help.faqLinuxLink).closest('a')!;
    expect(link.getAttribute('data-locale')).toBe('en');
  });
});
