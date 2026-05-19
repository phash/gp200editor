import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;

  // Flagged or un-published presets must not surface even with a valid
  // share token — moderation has to actually take effect.
  const preset = await prisma.preset.findFirst({
    where: { shareToken: token, public: true, flagged: false },
    include: { user: { select: { username: true } } },
  });

  if (!preset) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    tags: preset.tags,
    author: preset.author,
    style: preset.style,
    username: preset.user.username,
    downloadCount: preset.downloadCount,
    createdAt: preset.createdAt.toISOString(),
  });
}
