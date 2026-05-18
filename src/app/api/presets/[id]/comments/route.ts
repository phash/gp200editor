import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '@/lib/session';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import { commentBodySchema } from '@/lib/commentValidators';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyCsrf(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const auth = await requireVerifiedUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const limit = rateLimit(`comment-create:${user.id}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many comments. Try again later.' }, { status: 429 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = commentBodySchema.safeParse(json?.body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const preset = await prisma.preset.findUnique({
    where: { id },
    select: { id: true, public: true },
  });
  if (!preset || !preset.public) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const comment = await prisma.comment.create({
    data: { presetId: id, userId: user.id, body: parsed.data, parentId: null },
    include: { user: { select: userSelect } },
  });

  const { user: commentUser, ...commentRest } = comment as typeof comment & {
    user: { id: string; username: string; avatarKey: string | null };
  };

  return NextResponse.json({
    comment: {
      ...commentRest,
      user: commentUser ? serializeUser(commentUser) : null,
    },
  });
}

const userSelect = { id: true, username: true, avatarKey: true } as const;

function serializeUser(u: { id: string; username: string; avatarKey: string | null }) {
  return { id: u.id, username: u.username, avatarUrl: u.avatarKey ? `/api/avatar/${u.avatarKey}` : null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cursor = request.nextUrl.searchParams.get('cursor');
  const LIMIT = 20;

  const topLevels = await prisma.comment.findMany({
    where: { presetId: id, parentId: null },
    orderBy: { createdAt: 'desc' },
    take: LIMIT + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: { select: userSelect },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: userSelect } },
      },
    },
  });

  const hasMore = topLevels.length > LIMIT;
  const items = topLevels.slice(0, LIMIT);
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const sanitized = items.map((c) => ({
    ...c,
    body: c.deletedAt ? null : c.body,
    user: serializeUser(c.user),
    replies: c.replies.map((r) => ({
      ...r,
      body: r.deletedAt ? null : r.body,
      user: serializeUser(r.user),
    })),
  }));

  return NextResponse.json({ comments: sanitized, nextCursor });
}
