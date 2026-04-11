import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/withAdminAuth';
import { adminUsersQuerySchema } from '@/lib/validators.admin';

export const GET = withAdminAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const parsed = adminUsersQuerySchema.safeParse({
    q: searchParams.get('q') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { q, page, limit } = parsed.data;
  const skip = (page - 1) * limit;

  const where = q
    ? {
        OR: [
          { username: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        suspended: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { presets: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}, { csrf: false });
