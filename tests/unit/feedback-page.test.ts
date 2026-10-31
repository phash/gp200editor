import { describe, it, expect, vi } from 'vitest';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/lib/session', () => ({ validateSession: vi.fn() }));

import { generateMetadata } from '@/app/[locale]/feedback/page';

// The feedback form sits behind a login wall: nothing to rank for.
describe('/feedback metadata', () => {
  it('is noindex but keeps links crawlable', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'en' as const }) });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('keeps a locale-aware canonical', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'de' as const }) });
    expect(meta.alternates?.canonical).toBe('https://www.preset-forge.com/de/feedback');
  });
});
