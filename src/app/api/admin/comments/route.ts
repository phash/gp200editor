import { type NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/withAdminAuth';
import { prisma } from '@/lib/prisma';

// GET-only listing for the admin moderation tab. CSRF is off because GETs
// don't mutate; withAdminAuth still enforces the session + ADMIN role.
export const GET = withAdminAuth(async (request: NextRequest) => {
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
}, { csrf: false });
