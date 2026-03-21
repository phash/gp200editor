import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSession, refreshSessionCookie } from '@/lib/session';
import { verifyCsrf } from '@/lib/csrf';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  if (!verifyCsrf(_request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { user, session } = await validateSession();
  if (!user || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await refreshSessionCookie(session);

  const { id } = await context.params;

  const preset = await prisma.preset.findUnique({
    where: { id },
    select: { userId: true, public: true },
  });

  if (!preset) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (preset.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await prisma.preset.update({
    where: { id },
    data: { public: !preset.public },
    select: { id: true, public: true },
  });

  return NextResponse.json(updated);
}
