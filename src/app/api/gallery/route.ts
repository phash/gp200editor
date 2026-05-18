import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { galleryQuerySchema } from '@/lib/validators';
import { validateSession } from '@/lib/session';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = galleryQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { q, modules, effects, style, sort, page, limit } = parsed.data;

  const where: Prisma.PresetWhereInput = { public: true };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { tags: { hasSome: [q] } },
      { author: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (effects && effects.length > 0) {
    where.effects = { hasSome: effects };
  } else if (modules && modules.length > 0) {
    where.modules = { hasSome: modules };
  }

  if (style) {
    where.style = { equals: style, mode: 'insensitive' };
  }

  const orderBy: Prisma.PresetOrderByWithRelationInput =
    sort === 'popular'   ? { downloadCount: 'desc' } :
    sort === 'top-rated' ? { ratingAverage: 'desc' } :
                           { createdAt: 'desc' };

  const [{ user }, [presets, total]] = await Promise.all([
    validateSession(),
    Promise.all([
      prisma.preset.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          tags: true,
          modules: true,
          effects: true,
          author: true,
          style: true,
          shareToken: true,
          downloadCount: true,
          ratingAverage: true,
          ratingCount: true,
          createdAt: true,
          flagged: true,
          userId: true,
          audioKey: true,
          audioMimeType: true,
          audioDurationMs: true,
          user: { select: { username: true } },
        },
      }),
      prisma.preset.count({ where }),
    ]),
  ]);

  // Per-page "my rating" lookup so paginated cards reflect the user's own
  // score without needing a separate request. Server-side SSR could carry
  // this for page 1, but the GalleryClient does an internal fetch when
  // filters/sort change or "load more" fires — we need it here too.
  let myRatings: Record<string, number> = {};
  if (user && presets.length > 0) {
    const ratings = await prisma.presetRating.findMany({
      where: { userId: user.id, presetId: { in: presets.map((p) => p.id) } },
      select: { presetId: true, score: true },
    });
    myRatings = Object.fromEntries(ratings.map((r) => [r.presetId, r.score]));
  }

  const enriched = presets.map((p) => ({
    ...p,
    canRate: !!user && !!user.emailVerified && p.userId !== user.id,
    rateReason: !user
      ? 'anon' as const
      : !user.emailVerified
        ? 'unverified' as const
        : p.userId === user.id
          ? 'own' as const
          : null,
    existingRating: myRatings[p.id] ?? 0,
  }));

  return NextResponse.json({ presets: enriched, total, page, limit });
}
