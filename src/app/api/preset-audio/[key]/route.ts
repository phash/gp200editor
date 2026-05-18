import { NextRequest, NextResponse } from 'next/server';
import { getAudioStream } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import type { Readable } from 'stream';

// Match the upload route's key construction: preset-<cuid>-<timestamp>.<ext>.
const KEY_PATTERN = /^preset-[a-z0-9]+-\d+\.(mp3|m4a|aac)$/;

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!KEY_PATTERN.test(key)) {
    return new NextResponse(null, { status: 404 });
  }

  // Confirm the key is referenced by a preset (extra round-trip but cheap
  // for a public endpoint — and it pins the content-type to the row's
  // recorded mime so a renamed file in the bucket can't masquerade).
  const preset = await prisma.preset.findFirst({
    where: { audioKey: key },
    select: { id: true, audioMimeType: true },
  });
  if (!preset || !preset.audioMimeType) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const stream = await getAudioStream(key);
    // Garage streams hang when handed straight to NextResponse in
    // standalone builds — buffer first (same pattern as the avatar route).
    const chunks: Buffer[] = [];
    for await (const chunk of stream as Readable) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    return new Response(buffer as BodyInit, {
      headers: {
        'Content-Type': preset.audioMimeType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
