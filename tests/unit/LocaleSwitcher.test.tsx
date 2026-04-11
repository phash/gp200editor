import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

// Mock next-intl + routing hooks the switcher uses. useTranslations returns
// a real-string map (not passthrough of the key) so a future rename of a
// translation key would actually fail the test — the earlier passthrough
// version only verified that the component called t() with _some_ string.
//
// Note: the mock must export LOCALES + the Locale type because
// @/lib/hreflang re-exports them from @/i18n/routing. If the mock is
// missing LOCALES, the re-export resolves to undefined and the switcher
// crashes with "Cannot read properties of undefined (reading 'map')".
const replaceMock = vi.fn();
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/editor',
  LOCALES: ['de', 'en', 'es', 'fr', 'it', 'pt'] as const,
}));
vi.mock('next-intl', () => {
  const messages: Record<string, string> = {
    switchLocale: 'Switch language',
    // Other nav keys the switcher might touch — listed so drift fails loudly
    home: 'Home',
    editor: 'Editor',
  };
  return {
    useLocale: () => 'de',
    useTranslations: () => (key: string) => messages[key] ?? `MISSING:${key}`,
  };
});

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    replaceMock.mockClear();
  });

  it('renders trigger with the real translated aria-label', () => {
    render(<LocaleSwitcher />);
    expect(screen.getByRole('button', { name: 'Switch language' })).toBeTruthy();
  });

  it('opens a menu with all 6 locale options when clicked', () => {
    render(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.length).toBe(6);
  });

  it('shows beta label only on es/fr/it/pt', () => {
    render(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));
    const betaLabels = screen.getAllByText('beta');
    expect(betaLabels.length).toBe(4);
  });

  it('calls router.replace with chosen locale on click', () => {
    render(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));
    const frOption = screen.getByRole('menuitem', { name: /FR/i });
    fireEvent.click(frOption);
    expect(replaceMock).toHaveBeenCalledWith('/editor', { locale: 'fr' });
  });

  it('closes on Escape key', () => {
    render(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));
    expect(screen.getAllByRole('menuitem').length).toBe(6);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryAllByRole('menuitem').length).toBe(0);
  });

  it('fails loudly if t() receives an unknown key', () => {
    // Regression guard for the real-string mock — if a future refactor
    // calls t('nonExistent'), we get "MISSING:nonExistent" in the DOM
    // instead of the key being echoed as if it were a valid string.
    render(<LocaleSwitcher />);
    expect(screen.queryByText(/^MISSING:/)).toBeNull();
  });
});
