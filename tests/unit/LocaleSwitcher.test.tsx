import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

// Mock next-intl + routing hooks the switcher uses
const replaceMock = vi.fn();
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/editor',
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'de',
  useTranslations: () => (key: string) => key,
}));

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    replaceMock.mockClear();
  });

  it('renders trigger with aria-label for the switcher', () => {
    render(<LocaleSwitcher />);
    expect(screen.getByRole('button', { name: /switchLocale/i })).toBeTruthy();
  });

  it('opens a menu with all 6 locale options when clicked', () => {
    render(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /switchLocale/i }));
    const items = screen.getAllByRole('menuitem');
    expect(items.length).toBe(6);
  });

  it('shows beta label only on es/fr/it/pt', () => {
    render(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /switchLocale/i }));
    const betaLabels = screen.getAllByText('beta');
    expect(betaLabels.length).toBe(4);
  });

  it('calls router.replace with chosen locale on click', () => {
    render(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /switchLocale/i }));
    const frOption = screen.getByRole('menuitem', { name: /FR/i });
    fireEvent.click(frOption);
    expect(replaceMock).toHaveBeenCalledWith('/editor', { locale: 'fr' });
  });

  it('closes on Escape key', () => {
    render(<LocaleSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: /switchLocale/i }));
    expect(screen.getAllByRole('menuitem').length).toBe(6);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryAllByRole('menuitem').length).toBe(0);
  });
});
