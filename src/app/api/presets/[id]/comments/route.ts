import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '@/lib/session';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import { commentBodySchema } from '@/lib/commentValidators';
import { commentUserSelect, serializeCommentUser } from '@/lib/commentSerializer';

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

  // Block commenting on private, flagged, or non-existent presets. flagged
  // pauses activity until moderation completes; non-public excludes drafts
  // and revoked links.
  const preset = await prisma.preset.findUnique({
    where: { id },
    select: { id: true, public: true, flagged: true },
  });
  if (!preset || !preset.public || preset.flagged) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const comment = await prisma.comment.create({
    data: { presetId: id, userId: user.id, body: parsed.data, parentId: null },
    include: { user: { select: commentUserSelect } },
  });

  return NextResponse.json({
    comment: { ...comment, user: serializeCommentUser(comment.user) },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Refuse to expose a discussion that has been un-published or flagged —
  // un-publishing is the user's way of revoking the share link, and the
  // comment thread must follow.
  const preset = await prisma.preset.findUnique({
    where: { id },
    select: { id: true, public: true, flagged: true },
  });
  if (!preset || !preset.public || preset.flagged) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cursor = request.nextUrl.searchParams.get('cursor');
  const LIMIT = 20;

  const topLevels = await prisma.comment.findMany({
    where: { presetId: id, parentId: null },
    orderBy: { createdAt: 'desc' },
    take: LIMIT + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: { select: commentUserSelect },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: commentUserSelect } },
      },
    },
  });

  const hasMore = topLevels.length > LIMIT;
  const items = topLevels.slice(0, LIMIT);
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const sanitized = items.map((c) => ({
    ...c,
    body: c.deletedAt ? null : c.body,
    user: serializeCommentUser(c.user),
    replies: c.replies.map((r) => ({
      ...r,
      body: r.deletedAt ? null : r.body,
      user: serializeCommentUser(r.user),
    })),
  }));

  return NextResponse.json({ comments: sanitized, nextCursor });
}
