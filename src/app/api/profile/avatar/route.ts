import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { validateSession, refreshSessionCookie } from '@/lib/session';
import { uploadAvatar, deleteAvatar } from '@/lib/storage';
import { verifyCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rateLimit';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PIXELS = 25_000_000; // ~5000x5000 — refuse image bombs before sharp decodes

// Match the client-claimed mime against the file's actual magic bytes to
// reject a renamed binary (or an HTML page pretending to be a PNG).
function detectImageMime(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  // WebP: RIFF....WEBP at bytes [0..3] + [8..11]
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp';
  return null;
}

export async function POST(request: Request) {
  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { user, session } = await validateSession();
  if (!user || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await refreshSessionCookie(session);

  // Avatar uploads run Sharp (CPU-heavy) + S3 PUT — cap at 5/h/user so a
  // compromised session can't burn the resize pipeline.
  const limit = rateLimit(`avatar:${user.id}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many avatar uploads.' }, { status: 429 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('avatar');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No avatar file provided' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use JPEG, PNG, or WebP.' },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large. Max 5 MB.' }, { status: 400 });
  }

  const input = Buffer.from(await file.arrayBuffer());

  // Magic-byte probe — refuse a renamed binary even if the client mime
  // looks legit. Family must match the claimed mime; otherwise reject.
  const detected = detectImageMime(input);
  if (!detected || detected !== file.type) {
    return NextResponse.json({ error: 'Unsupported file type. Use JPEG, PNG, or WebP.' }, { status: 400 });
  }

  // limitInputPixels caps sharp's decoded surface so a 50000x50000 PNG
  // (compression bomb) can't burn the worker. Wrap in try/catch so any
  // sharp throw becomes a clean 400 instead of leaking a 500 stack.
  let webp: Buffer;
  try {
    webp = await sharp(input, { limitInputPixels: MAX_PIXELS })
      // fit: 'inside' preserves aspect ratio; scaled to fit within 512×512
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .webp()
      .toBuffer();
  } catch {
    return NextResponse.json({ error: 'Image could not be processed.' }, { status: 400 });
  }

  const newKey = `user-${user.id}-${Date.now()}.webp`;

  // Upload new object, then update DB, then delete old (safest order)
  await uploadAvatar(newKey, webp);

  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { avatarKey: true },
  });

  await prisma.user.update({ where: { id: user.id }, data: { avatarKey: newKey } });

  // Best-effort delete of old avatar after DB update
  if (dbUser.avatarKey) {
    await deleteAvatar(dbUser.avatarKey).catch(() => {});
  }

  return NextResponse.json({ avatarUrl: `/api/avatar/${newKey}` });
}
