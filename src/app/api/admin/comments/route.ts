import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AdminForbiddenError } from '@/lib/admin';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw e;
  }

  const cursor = request.nextUrl.searchParams.get('cursor');
  const LIMIT = 50;
  const comments = await prisma.comment.findMany({
    orderBy: { createdAt: 'desc' },
    take: LIMIT + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: { select: { id: true, username: true } },
      preset: { select: { id: true, name: true, shareToken: true } },
    },
  });

  const hasMore = comments.length > LIMIT;
  const items = comments.slice(0, LIMIT);
  const nextCursor = hasMore ? items[items.length - 1].id : null;
  return NextResponse.json({ comments: items, nextCursor });
}
