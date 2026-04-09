import { NextRequest, NextResponse } from 'next/server';
import { getAvatarStream } from '@/lib/storage';
import type { Readable } from 'stream';

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  // Validate key format to prevent probing arbitrary bucket paths
  const KEY_PATTERN = /^user-[a-z0-9]+-\d+\.webp$/;
  if (!KEY_PATTERN.test(key)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const stream = await getAvatarStream(key);

    // Buffer the stream first — direct streaming hangs in standalone builds
    const chunks: Buffer[] = [];
    for await (const chunk of stream as Readable) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
