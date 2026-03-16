import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSession, refreshSessionCookie } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { user, session } = await validateSession();
  if (!user || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await refreshSessionCookie(session);

  const { id } = await context.params;

  const existing = await prisma.preset.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const newToken = crypto.randomUUID().replace(/-/g, '');

  const updated = await prisma.preset.update({
    where: { id },
    data: { shareToken: newToken },
    select: { shareToken: true },
  });

  return NextResponse.json({ shareToken: updated.shareToken });
}
