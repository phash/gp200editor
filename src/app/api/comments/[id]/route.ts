import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '@/lib/session';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import { commentBodySchema } from '@/lib/commentValidators';

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
    include: { user: { select: { id: true, username: true, avatarKey: true } } },
  });
  return NextResponse.json({ comment });
}

// DELETE — implemented in Task 8 (this is a stub to keep the route file present).
export async function DELETE() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
