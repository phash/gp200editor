import { NextRequest, NextResponse } from 'next/server';
import { getAudioStream } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import { validateSession } from '@/lib/session';
import type { Readable } from 'stream';

// Match the upload route's key construction: preset-<cuid>-<timestamp>.<ext>.
// The .aac extension is kept for backwards-compatibility with any older
// uploads from before audio/aac was dropped from the allow-list.
const KEY_PATTERN = /^preset-[a-z0-9]+-\d+\.(mp3|m4a|aac)$/;

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!KEY_PATTERN.test(key)) {
    return new NextResponse(null, { status: 404 });
  }

  // Confirm the key is referenced by a preset, pin content-type to the row,
  // and consult `public`/`flagged` so unpublishing a preset also withdraws
  // its audio. The key itself is CUID-derived and not trivially guessable,
  // but the URL is already in the wild while the preset was public — without
  // this gate it would remain reachable forever.
  const preset = await prisma.preset.findFirst({
    where: { audioKey: key },
    select: { id: true, userId: true, public: true, flagged: true, audioMimeType: true },
  });
  if (!preset || !preset.audioMimeType) {
    return new NextResponse(null, { status: 404 });
  }

  if (!preset.public || preset.flagged) {
    // Owner + admin can still pull their own private audio (replace flow
    // needs to render the player after un-publish + revisit).
    const { user } = await validateSession();
    const allowed = user && (user.id === preset.userId || user.role === 'ADMIN');
    if (!allowed) {
      return new NextResponse(null, { status: 404 });
    }
  }

  try {
    const stream = await getAudioStream(key);
    // Garage streams hang when handed straight to NextResponse in standalone
    // builds — buffer first (same pattern as the avatar route).
    const chunks: Buffer[] = [];
    for await (const chunk of stream as Readable) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // 1 h cache without `immutable` — short enough that un-publish actually
    // revokes the asset within an hour at every cache layer. The key already
    // changes when the user replaces the audio, so this won't double-fetch
    // unchanged content.
    return new Response(buffer as BodyInit, {
      headers: {
        'Content-Type': preset.audioMimeType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
