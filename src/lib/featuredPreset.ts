import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

const M = 5;
const FALLBACK_C = 4.0;
const WINDOW_DAYS = 30;

export interface RatingShape { ratingAverage: number; ratingCount: number }

export function computeBayesScore(p: RatingShape, C: number, m: number = M): number {
  if (p.ratingCount === 0) return C;
  return (C * m + p.ratingAverage * p.ratingCount) / (m + p.ratingCount);
}

const FEATURED_SELECT = {
  id: true,
  name: true,
  description: true,
  shareToken: true,
  ratingAverage: true,
  ratingCount: true,
  modules: true,
  effects: true,
  style: true,
  author: true,
  user: { select: { id: true, username: true, avatarKey: true } },
} satisfies Prisma.PresetSelect;

export type FeaturedPreset = Prisma.PresetGetPayload<{ select: typeof FEATURED_SELECT }>;

export async function pickFeaturedPreset(): Promise<FeaturedPreset | null> {
  const prior = await prisma.preset.aggregate({
    _avg: { ratingAverage: true },
    where: { public: true, ratingCount: { gte: 1 } },
  });
  const C = prior._avg.ratingAverage ?? FALLBACK_C;

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 3600 * 1000);
  let candidates = await prisma.preset.findMany({
    where: {
      public: true,
      flagged: false,
      ratings: { some: { updatedAt: { gte: cutoff } } },
      ratingCount: { gte: 1 },
    },
    select: FEATURED_SELECT,
  });

  if (candidates.length === 0) {
    candidates = await prisma.preset.findMany({
      where: { public: true, flagged: false, ratingCount: { gte: 1 } },
      select: FEATURED_SELECT,
    });
  }
  if (candidates.length === 0) return null;

  return candidates
    .map((p) => ({ p, score: computeBayesScore(p, C) }))
    .sort((a, b) => b.score - a.score)[0].p;
}
