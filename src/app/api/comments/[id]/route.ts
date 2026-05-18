import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser, validateSession } from '@/lib/session';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import { commentBodySchema, adminDeleteReasonSchema } from '@/lib/commentValidators';
import { commentUserSelect, serializeCommentUser } from '@/lib/commentSerializer';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyCsrf(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const auth = await requireVerifiedUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const limit = rateLimit(`comment-edit:${user.id}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many edits. Try again later.' }, { status: 429 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = commentBodySchema.safeParse(json?.body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, userId: true, deletedAt: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (existing.deletedAt) return NextResponse.json({ error: 'Cannot edit deleted comment' }, { status: 409 });

  const comment = await prisma.comment.update({
    where: { id },
    data: { body: parsed.data, editedAt: new Date() },
    include: { user: { select: commentUserSelect } },
  });
  return NextResponse.json({
    comment: { ...comment, user: serializeCommentUser(comment.user) },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyCsrf(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { user, session } = await validateSession();
  if (!user || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, userId: true, deletedAt: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = user.role === 'ADMIN';
  const isAuthor = existing.userId === user.id;
  if (!isAdmin && !isAuthor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (isAdmin && !isAuthor) {
    // Hard delete + audit log
    const json = await request.json().catch(() => null);
    const parsed = adminDeleteReasonSchema.safeParse(json?.reason);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const repliesDeletedCount = await prisma.comment.count({ where: { parentId: id } });
    await prisma.comment.delete({ where: { id } });
    await prisma.adminAction.create({
      data: {
        adminId: user.id,
        action: 'DELETE_COMMENT',
        targetType: 'comment',
        targetId: id,
        reason: parsed.data,
        metadata: { repliesDeletedCount },
      },
    });
    return NextResponse.json({ ok: true, repliesDeleted: repliesDeletedCount });
  }

  // Author soft-delete
  const limit = rateLimit(`comment-delete:${user.id}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many deletes. Try again later.' }, { status: 429 });
  }
  if (existing.deletedAt) {
    return NextResponse.json({ error: 'Already deleted' }, { status: 409 });
  }
  await prisma.comment.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: 'AUTHOR', body: null },
  });
  return NextResponse.json({ ok: true });
}
