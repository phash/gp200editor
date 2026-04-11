import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadPresetBuffer } from '@/lib/storage';
import { PRSTDecoder } from '@/core/PRSTDecoder';
import { encodeToJson } from '@/core/PRSTJsonCodec';
import { logError } from '@/lib/errorLog';

type RouteParams = { params: Promise<{ token: string }> };

export async function GET(_: Request, { params }: RouteParams): Promise<Response> {
  const { token } = await params;

  const preset = await prisma.preset.findUnique({
    where: { shareToken: token, public: true },
    select: {
      shareToken: true,
      presetKey: true,
      sourceUrl: true,
      sourceLabel: true,
      description: true,
    },
  });

  if (!preset) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let json;
  try {
    const buffer = await downloadPresetBuffer(preset.presetKey);
    const decoded = new PRSTDecoder(buffer).decode();
    json = encodeToJson(decoded, {
      shareToken: token,
      locale: 'en',
      sourceUrl: preset.sourceUrl,
      sourceLabel: preset.sourceLabel,
      description: preset.description,
    });
  } catch (err) {
    await logError({
      level: 'error',
      message: 'share JSON endpoint failed to decode preset',
      stack: err instanceof Error ? err.stack : undefined,
      metadata: { token, presetKey: preset.presetKey },
    }).catch(() => {});
    return NextResponse.json({ error: 'Storage temporarily unavailable' }, { status: 503 });
  }

  return NextResponse.json(json, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
