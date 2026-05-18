import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/en.json';

vi.mock('@/lib/featuredPreset', () => ({ pickFeaturedPreset: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { comment: { findMany: vi.fn() } } }));
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async ({ namespace }: { namespace: string }) => {
    const map: Record<string, string> = {
      'home.featured.title': 'Featured · Top Rated · 30 Days',
      'home.featured.recentComments': 'Recent comments',
      'home.featured.openPreset': 'Open preset →',
      'home.featured.noFeatured': 'No featured preset yet',
    };
    return (key: string) => map[`${namespace}.${key}`] ?? key;
  }),
}));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, className, style }: { href: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
    <a href={href} className={className} style={style}>{children}</a>
  ),
  LOCALES: ['de', 'en', 'es', 'fr', 'it', 'pt'] as const,
}));

import { FeaturedPresetBlock } from '@/components/FeaturedPresetBlock';
import { pickFeaturedPreset } from '@/lib/featuredPreset';
import { prisma } from '@/lib/prisma';

function wrap(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

describe('FeaturedPresetBlock', () => {
  it('renders featured preset with comments', async () => {
    vi.mocked(pickFeaturedPreset).mockResolvedValue({
      id: 'p1', name: 'Crunchy 80s', description: 'driven Marshall tone',
      shareToken: 't1', ratingAverage: 4.8, ratingCount: 23,
      effects: ['', '', '', 'JCM800', '', '', '', '', '', '', ''],
      user: { username: 'manu', avatarKey: null },
    } as never);
    vi.mocked(prisma.comment.findMany).mockResolvedValue([
      { id: 'c1', body: 'Killer!', user: { username: 'gibsonfan' }, deletedAt: null },
    ] as never);

    const ui = await FeaturedPresetBlock({ locale: 'en' });
    render(wrap(ui));
    expect(screen.getByText('Crunchy 80s')).toBeTruthy();
    expect(screen.getByText(/4\.8/)).toBeTruthy();
    expect(screen.getByText('Killer!')).toBeTruthy();
  });

  it('renders null when no preset available', async () => {
    vi.mocked(pickFeaturedPreset).mockResolvedValue(null);
    const ui = await FeaturedPresetBlock({ locale: 'en' });
    expect(ui).toBeNull();
  });
});
