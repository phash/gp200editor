import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { validateSession, refreshSessionCookie } from '@/lib/session';
import { uploadAvatar, deleteAvatar } from '@/lib/storage';
import { verifyCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rateLimit';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

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
  const webp = await sharp(input)
    // fit: 'inside' preserves aspect ratio; image scaled down to fit within 512×512
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .webp()
    .toBuffer();

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
