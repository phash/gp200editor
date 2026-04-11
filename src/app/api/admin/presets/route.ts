import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/withAdminAuth';
import { adminPresetsQuerySchema } from '@/lib/validators.admin';

export const GET = withAdminAuth(async (request) => {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = adminPresetsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { q, flagged, userId, page, limit } = parsed.data;

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { author: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (flagged) where.flagged = true;
  if (userId) where.userId = userId;

  const [presets, total] = await Promise.all([
    prisma.preset.findMany({
      where,
      select: {
        id: true,
        name: true,
        author: true,
        style: true,
        public: true,
        flagged: true,
        modules: true,
        downloadCount: true,
        ratingAverage: true,
        createdAt: true,
        user: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.preset.count({ where }),
  ]);

  return NextResponse.json({
    presets: presets.map((p) => ({
      id: p.id,
      name: p.name,
      author: p.author,
      style: p.style,
      public: p.public,
      flagged: p.flagged,
      modules: p.modules,
      downloadCount: p.downloadCount,
      ratingAverage: p.ratingAverage,
      createdAt: p.createdAt.toISOString(),
      ownerUsername: p.user.username,
    })),
    total,
    page,
    limit,
  });
}, { csrf: false });
