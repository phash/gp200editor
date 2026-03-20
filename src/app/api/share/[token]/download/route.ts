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

  // Read entire file into buffer (preset files are small, max 1224 bytes)
  const stream = await getPresetStream(preset.presetKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  // Atomically increment download count
  await prisma.preset.update({
    where: { shareToken: token },
    data: { downloadCount: { increment: 1 } },
  });

  const safeFilename = preset.name.replace(/[\\\"\/\x00]/g, '_').slice(0, 64);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeFilename}.prst"`,
      'Content-Length': String(buffer.length),
    },
  });
}
