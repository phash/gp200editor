import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { galleryQuerySchema } from '@/lib/validators';
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
    // Fine-grained: filter by specific effect names
    where.effects = { hasSome: effects };
  } else if (modules && modules.length > 0) {
    // Coarse: filter by module category
    where.modules = { hasSome: modules };
  }

  if (style) {
    where.style = { equals: style, mode: 'insensitive' };
  }

  const orderBy: Prisma.PresetOrderByWithRelationInput =
    sort === 'popular' ? { downloadCount: 'desc' } : { createdAt: 'desc' };

  const [presets, total] = await Promise.all([
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
        createdAt: true,
        user: { select: { username: true } },
      },
    }),
    prisma.preset.count({ where }),
  ]);

  return NextResponse.json({ presets, total, page, limit });
}
