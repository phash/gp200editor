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

  const { id: parentId } = await params;
  const json = await request.json().catch(() => null);
  const parsed = commentBodySchema.safeParse(json?.body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const parent = await prisma.comment.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true, presetId: true },
  });
  if (!parent) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (parent.parentId !== null) {
    return NextResponse.json({ error: 'Replies must target a top-level comment' }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: { presetId: parent.presetId, userId: user.id, body: parsed.data, parentId: parent.id },
    include: { user: { select: { id: true, username: true, avatarKey: true } } },
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

function serializeUser(u: { id: string; username: string; avatarKey: string | null }) {
  return { id: u.id, username: u.username, avatarUrl: u.avatarKey ? `/api/avatar/${u.avatarKey}` : null };
}
