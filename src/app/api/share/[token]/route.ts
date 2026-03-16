import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;

  const preset = await prisma.preset.findUnique({
    where: { shareToken: token },
    include: { user: { select: { username: true } } },
  });

  if (!preset) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    name: preset.name,
    description: preset.description,
    tags: preset.tags,
    username: preset.user.username,
    downloadCount: preset.downloadCount,
    createdAt: preset.createdAt.toISOString(),
  });
}
