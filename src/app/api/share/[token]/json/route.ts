import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadPresetBuffer } from '@/lib/storage';
import { PRSTDecoder } from '@/core/PRSTDecoder';
import { encodeToJson } from '@/core/PRSTJsonCodec';

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

  const buffer = await downloadPresetBuffer(preset.presetKey);
  const decoded = new PRSTDecoder(buffer).decode();

  const json = encodeToJson(decoded, {
    shareToken: token,
    locale: 'en',
    sourceUrl: preset.sourceUrl,
    sourceLabel: preset.sourceLabel,
    description: preset.description,
  });

  return NextResponse.json(json, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
