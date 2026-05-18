import { describe, it, expect, vi } from 'vitest';
import { computeBayesScore, pickFeaturedPreset } from '@/lib/featuredPreset';

describe('computeBayesScore', () => {
  it('1×5★ with C=4, m=5 → 4.17', () => {
    expect(computeBayesScore({ ratingAverage: 5, ratingCount: 1 }, 4, 5)).toBeCloseTo(4.17, 2);
  });
  it('50×4.7★ with C=4, m=5 → ~4.64', () => {
    expect(computeBayesScore({ ratingAverage: 4.7, ratingCount: 50 }, 4, 5)).toBeCloseTo(4.64, 2);
  });
  it('zero ratings returns C', () => {
    expect(computeBayesScore({ ratingAverage: 0, ratingCount: 0 }, 4, 5)).toBe(4);
  });
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    preset: { aggregate: vi.fn(), findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';

describe('pickFeaturedPreset', () => {
  it('picks highest Bayes score among 30-day candidates', async () => {
    vi.mocked(prisma.preset.aggregate).mockResolvedValue({ _avg: { ratingAverage: 4.0 } } as never);
    vi.mocked(prisma.preset.findMany).mockResolvedValue([
      { id: 'a', ratingAverage: 5, ratingCount: 1 } as never,
      { id: 'b', ratingAverage: 4.5, ratingCount: 20 } as never,
    ]);
    const top = await pickFeaturedPreset();
    expect(top?.id).toBe('b');
  });

  it('falls back to all-time when 30-day window is empty', async () => {
    vi.mocked(prisma.preset.aggregate).mockResolvedValue({ _avg: { ratingAverage: 4.0 } } as never);
    vi.mocked(prisma.preset.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'all-time', ratingAverage: 5, ratingCount: 10 } as never]);
    const top = await pickFeaturedPreset();
    expect(top?.id).toBe('all-time');
  });

  it('returns null when DB has no rated presets at all', async () => {
    vi.mocked(prisma.preset.aggregate).mockResolvedValue({ _avg: { ratingAverage: null } } as never);
    vi.mocked(prisma.preset.findMany).mockResolvedValue([]);
    const top = await pickFeaturedPreset();
    expect(top).toBeNull();
  });
});
