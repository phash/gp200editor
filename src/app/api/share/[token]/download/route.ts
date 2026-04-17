import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadPresetBuffer } from '@/lib/storage';
import { rateLimit } from '@/lib/rateLimit';
import { logError } from '@/lib/errorLog';
import { getClientIp } from '@/lib/getClientIp';

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const ip = getClientIp(request);
  const { token } = await context.params;
  const { allowed } = rateLimit(`share-dl:${ip}:${token}`, 20, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many downloads. Please try again later.' }, { status: 429 });
  }

  const preset = await prisma.preset.findUnique({
    where: { shareToken: token },
  });

  if (!preset) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Read entire file into buffer (preset files are small, max 1224 bytes)
  let buffer: Buffer;
  try {
    buffer = await downloadPresetBuffer(preset.presetKey);
  } catch (err) {
    await logError({
      level: 'error',
      message: 'share download failed to read preset from S3',
      stack: err instanceof Error ? err.stack : undefined,
      metadata: { token, presetKey: preset.presetKey },
    }).catch(() => {});
    return NextResponse.json({ error: 'Storage temporarily unavailable' }, { status: 503 });
  }

  // Atomically increment download count
  await prisma.preset.update({
    where: { shareToken: token },
    data: { downloadCount: { increment: 1 } },
  });

  const safeFilename = preset.name.replace(/[\\\"\/\x00\r\n]/g, '_').slice(0, 64);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeFilename}.prst"`,
      'Content-Length': String(buffer.length),
    },
  });
}
