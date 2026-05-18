import { NextRequest, NextResponse } from 'next/server';
import { validateSession, refreshSessionCookie } from '@/lib/session';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import { uploadAudio, deleteAudio } from '@/lib/storage';
import { validateAudio, MAX_AUDIO_BYTES } from '@/lib/audioValidation';
import { adminDeleteReasonSchema } from '@/lib/commentValidators';

const EXT_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
};

// Best-effort S3 cleanup. Wrapping the call lets us tolerate either a thrown
// error (Garage unreachable) or a non-Promise return from the mock layer
// without surfacing an unhandled rejection.
async function safeDeleteAudio(key: string): Promise<void> {
  try {
    await deleteAudio(key);
  } catch {
    /* swallow — orphaned S3 object is acceptable */
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!verifyCsrf(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { user, session } = await validateSession();
  if (!user || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: 'Email not verified' }, { status: 403 });
  await refreshSessionCookie(session);

  const limit = rateLimit(`audio-upload:${user.id}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many audio uploads.' }, { status: 429 });
  }

  const { id } = await params;
  const preset = await prisma.preset.findUnique({
    where: { id },
    select: { id: true, userId: true, audioKey: true },
  });
  if (!preset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isOwner = preset.userId === user.id;
  const isAdmin = user.role === 'ADMIN';
  if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const fd = await request.formData().catch(() => null);
  const file = fd?.get('audio');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
  }

  // Pre-buffer guard: refuse oversized uploads BEFORE materialising the file
  // into a Node Buffer. Without this a hostile 1.9 GB POST would allocate the
  // entire heap before validateAudio's post-buffer length check fires.
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'tooBig' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await validateAudio(buf, file.type);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  const ext = EXT_BY_MIME[result.mime] ?? 'mp3';
  const newKey = `preset-${preset.id}-${Date.now()}.${ext}`;

  await uploadAudio(newKey, buf, result.mime);

  await prisma.preset.update({
    where: { id: preset.id },
    data: {
      audioKey: newKey,
      audioMimeType: result.mime,
      audioDurationMs: result.durationMs,
    },
  });

  if (preset.audioKey) {
    await safeDeleteAudio(preset.audioKey);
  }

  // Audit when an admin replaces audio they did not author.
  if (isAdmin && !isOwner) {
    await prisma.adminAction.create({
      data: {
        adminId: user.id,
        action: 'REPLACE_PRESET_AUDIO',
        targetType: 'preset',
        targetId: preset.id,
        reason: null,
        metadata: { previousAudioKey: preset.audioKey, newAudioKey: newKey },
      },
    });
  }

  return NextResponse.json({
    audioKey: newKey,
    audioUrl: `/api/preset-audio/${newKey}`,
    audioMimeType: result.mime,
    audioDurationMs: result.durationMs,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!verifyCsrf(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { user, session } = await validateSession();
  if (!user || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: 'Email not verified' }, { status: 403 });
  await refreshSessionCookie(session);

  const { id } = await params;
  const preset = await prisma.preset.findUnique({
    where: { id },
    select: { id: true, userId: true, audioKey: true },
  });
  if (!preset) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!preset.audioKey) return NextResponse.json({ error: 'No audio attached' }, { status: 404 });

  const isOwner = preset.userId === user.id;
  const isAdmin = user.role === 'ADMIN';
  if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let reason: string | null = null;
  if (isAdmin && !isOwner) {
    const json = await request.json().catch(() => null);
    const parsed = adminDeleteReasonSchema.safeParse(json?.reason);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    reason = parsed.data;
  }

  await prisma.preset.update({
    where: { id: preset.id },
    data: { audioKey: null, audioMimeType: null, audioDurationMs: null },
  });
  await safeDeleteAudio(preset.audioKey);

  if (isAdmin && !isOwner) {
    await prisma.adminAction.create({
      data: {
        adminId: user.id,
        action: 'DELETE_PRESET_AUDIO',
        targetType: 'preset',
        targetId: preset.id,
        reason,
        metadata: { audioKey: preset.audioKey },
      },
    });
  }

  return NextResponse.json({ ok: true });
}
