import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPresetStream } from '@/lib/storage';

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;

  const preset = await prisma.preset.findUnique({
    where: { shareToken: token },
  });

  if (!preset) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Get stream first — only increment if stream succeeds
  const stream = await getPresetStream(preset.presetKey);

  // Atomically increment download count
  await prisma.preset.update({
    where: { shareToken: token },
    data: { downloadCount: { increment: 1 } },
  });

  const safeFilename = preset.name.replace(/[\\\"]/g, '_').slice(0, 64);

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeFilename}.prst"`,
      'Content-Length': '512',
    },
  });
}
