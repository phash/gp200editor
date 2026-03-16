import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSession, refreshSessionCookie } from '@/lib/session';
import { getPresetStream } from '@/lib/storage';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { user, session } = await validateSession();
  if (!user || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await refreshSessionCookie(session);

  const { id } = await context.params;

  const preset = await prisma.preset.findUnique({ where: { id } });
  if (!preset) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (preset.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const stream = await getPresetStream(preset.presetKey);

  const safeFilename = preset.name.replace(/[\\\"]/g, '_').slice(0, 64);

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeFilename}.prst"`,
      'Content-Length': '512',
    },
  });
}
