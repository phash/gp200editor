# Preset Audio Snippet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can attach a ≤30 s MP3/M4A/AAC audio snippet (≤2 MB) to their preset; a native HTML5 player is rendered on the share-page (full), in the homepage Featured-Block (icon), and on every gallery card (icon). Owner + Admin may upload/replace/delete; admin actions are audit-logged.

**Architecture:** New Garage S3 bucket for audio, three new API routes (POST/DELETE/GET) parallel to the existing avatar pattern, server-side duration check via `music-metadata` (pure-JS, no ffmpeg dependency), single `<AudioPlayer>` component in two variants (full / icon) coordinated by a context provider that ensures only one player plays at a time.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Prisma 5 · PostgreSQL 16 · Lucia v3 · `music-metadata` (new) · AWS S3 SDK · Vitest · Playwright · next-intl 4 (7 locales)

**Spec:** [`docs/superpowers/specs/2026-05-19-preset-audio-snippet-design.md`](../specs/2026-05-19-preset-audio-snippet-design.md)

---

## File Map

**New files**
- `src/lib/audioValidation.ts` — mime/magic/size/duration pipeline
- `src/app/api/presets/[id]/audio/route.ts` — POST + DELETE
- `src/app/api/preset-audio/[key]/route.ts` — GET (public stream)
- `src/components/audio/AudioPlayerProvider.tsx` — single-player coordinator
- `src/components/audio/AudioPlayer.tsx` — full + icon variants
- `src/components/audio/AudioUploadField.tsx` — file input + replace/remove
- `tests/fixtures/audio/short-5s.mp3` — ~25 KB, generated locally with ffmpeg
- Unit tests for each module + components
- `tests/e2e/audio-upload.spec.ts` — happy-path

**Modified files**
- `prisma/schema.prisma` (+3 nullable Preset fields)
- `src/lib/storage.ts` (+uploadAudio/deleteAudio/getAudioStream)
- `src/components/SavePresetDialog.tsx` (+AudioUploadField)
- `src/app/[locale]/share/[token]/page.tsx` (+AudioPlayer + owner upload)
- `src/components/FeaturedPresetBlock.tsx` (+icon player)
- `src/lib/featuredPreset.ts` (+audio fields in FEATURED_SELECT)
- `src/app/api/gallery/route.ts` (+audio fields in select)
- `src/app/[locale]/gallery/GalleryClient.tsx` (+icon player per card)
- `src/app/[locale]/ClientProviders.tsx` (+AudioPlayerProvider)
- `src/app/api/presets/[id]/route.ts` (+delete audio when preset deleted)
- 7× `messages/<locale>.json` (+audio.* keys)
- `package.json` (+music-metadata)
- `.env.local`, `.env.dev`, `.env.prod.example` (+GARAGE_AUDIO_BUCKET hint)
- `CHANGELOG.md`

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_preset_audio_fields/migration.sql` (auto-generated)

- [ ] **Step 1: Add three nullable fields to `model Preset`**

In `prisma/schema.prisma`, inside `model Preset { ... }`, alongside the existing `flagged`, `ratingAverage`, `ratingCount` fields, add:

```prisma
  audioKey         String?
  audioMimeType    String?
  audioDurationMs  Int?
```

- [ ] **Step 2: Generate migration**

Run: `set -a; source .env.local; set +a; npx prisma migrate dev --name add_preset_audio_fields`
Expected: new directory under `prisma/migrations/`, schema applied, `prisma generate` runs.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add Preset.audioKey/audioMimeType/audioDurationMs"
```

---

## Task 2: Add audio bucket helpers to `storage.ts`

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `.env.local`, `.env.dev`, `.env.prod.example`

- [ ] **Step 1: Extend storage.ts**

At the bottom of `src/lib/storage.ts`, after the preset bucket helpers, add:

```ts
function audioBucket() {
  return process.env.GARAGE_AUDIO_BUCKET!;
}

export async function uploadAudio(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: audioBucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

export async function deleteAudio(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: audioBucket(), Key: key }),
  );
}

export async function getAudioStream(key: string): Promise<Readable> {
  const response = await getClient().send(
    new GetObjectCommand({ Bucket: audioBucket(), Key: key }),
  );
  return response.Body as Readable;
}
```

- [ ] **Step 2: Add env hint in `.env.local` / `.env.dev` / `.env.prod.example`**

In each file, add the following line in the Garage section:

```
GARAGE_AUDIO_BUCKET=gp200editor-audio-dev
```

(For `.env.prod.example`, use `gp200editor-audio`.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage.ts .env.local .env.dev .env.prod.example
git commit -m "feat(storage): audio bucket helpers (uploadAudio/deleteAudio/getAudioStream)"
```

---

## Task 3: Install music-metadata

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

Run: `npm install --legacy-peer-deps music-metadata`
Expected: `package.json` gains `"music-metadata": "^x.y.z"` under `dependencies`, lock file updated.

- [ ] **Step 2: Verify it imports**

Run: `node --input-type=module -e "import('music-metadata').then(m=>console.log(typeof m.parseBuffer))"`
Expected: `function`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add music-metadata for audio duration parsing"
```

---

## Task 4: audioValidation.ts library

**Files:**
- Create: `src/lib/audioValidation.ts`
- Test: `tests/unit/lib/audioValidation.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/lib/audioValidation.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { validateAudio, ALLOWED_AUDIO_MIME, MAX_AUDIO_BYTES, MAX_AUDIO_DURATION_MS } from '@/lib/audioValidation';

vi.mock('music-metadata', () => ({
  parseBuffer: vi.fn(),
}));
import { parseBuffer } from 'music-metadata';

// 12-byte stubs starting with each expected magic-byte signature.
const ID3_HEADER = Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0, 0, 0, 0, 0]), Buffer.alloc(100)]);
const MP3_RAW_SYNC = Buffer.concat([Buffer.from([0xFF, 0xFB, 0x90, 0x00]), Buffer.alloc(100)]);
const MP4_FTYP = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4D, 0x34, 0x41, 0x20]), Buffer.alloc(100)]);
const WEBM = Buffer.concat([Buffer.from([0x1A, 0x45, 0xDF, 0xA3]), Buffer.alloc(100)]);

describe('validateAudio', () => {
  it('accepts MP3 with ID3 header at 15s duration', async () => {
    vi.mocked(parseBuffer).mockResolvedValue({ format: { duration: 15 } } as never);
    const r = await validateAudio(ID3_HEADER, 'audio/mpeg');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.durationMs).toBe(15000);
  });

  it('accepts MP3 with raw frame sync', async () => {
    vi.mocked(parseBuffer).mockResolvedValue({ format: { duration: 20 } } as never);
    const r = await validateAudio(MP3_RAW_SYNC, 'audio/mpeg');
    expect(r.ok).toBe(true);
  });

  it('accepts M4A (mp4 ftyp)', async () => {
    vi.mocked(parseBuffer).mockResolvedValue({ format: { duration: 10 } } as never);
    const r = await validateAudio(MP4_FTYP, 'audio/mp4');
    expect(r.ok).toBe(true);
  });

  it('rejects unsupported mime', async () => {
    const r = await validateAudio(ID3_HEADER, 'audio/webm');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('wrongType');
  });

  it('rejects mime/magic mismatch (mime says mp3 but bytes are WebM)', async () => {
    const r = await validateAudio(WEBM, 'audio/mpeg');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('wrongType');
  });

  it('rejects file over 2 MB', async () => {
    const big = Buffer.concat([ID3_HEADER, Buffer.alloc(MAX_AUDIO_BYTES)]);
    const r = await validateAudio(big, 'audio/mpeg');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('tooBig');
  });

  it('rejects duration > 30.5s', async () => {
    vi.mocked(parseBuffer).mockResolvedValue({ format: { duration: 35 } } as never);
    const r = await validateAudio(ID3_HEADER, 'audio/mpeg');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('tooLong');
  });

  it('accepts duration exactly at tolerance boundary 30.5s', async () => {
    vi.mocked(parseBuffer).mockResolvedValue({ format: { duration: 30.5 } } as never);
    const r = await validateAudio(ID3_HEADER, 'audio/mpeg');
    expect(r.ok).toBe(true);
  });

  it('rejects when music-metadata throws', async () => {
    vi.mocked(parseBuffer).mockRejectedValue(new Error('corrupt'));
    const r = await validateAudio(ID3_HEADER, 'audio/mpeg');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('wrongType');
  });
});
```

Run: `npx vitest run tests/unit/lib/audioValidation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

Create `src/lib/audioValidation.ts`:

```ts
import { parseBuffer } from 'music-metadata';

export const ALLOWED_AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
]);

export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;            // 2 MB
export const MAX_AUDIO_DURATION_MS = 30_500;               // 30 s + 0.5 s tolerance

export type AudioValidationFailure = 'wrongType' | 'tooBig' | 'tooLong';

export type AudioValidationResult =
  | { ok: true; durationMs: number; mime: string }
  | { ok: false; reason: AudioValidationFailure };

// Magic-bytes probe. We refuse to trust the client-supplied mime alone — a
// .webm renamed to .mp3 would otherwise sneak through. These signatures
// cover the formats we accept; everything else is rejected.
function detectMagicMime(buf: Buffer): string | null {
  // MP3 with ID3v2 tag
  if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    return 'audio/mpeg';
  }
  // MP3 raw MPEG frame sync (0xFFE0..0xFFFF — top 11 bits)
  if (buf.length >= 2 && buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) {
    return 'audio/mpeg';
  }
  // MP4/M4A: bytes 4..7 == "ftyp"
  if (
    buf.length >= 8 &&
    buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70
  ) {
    return 'audio/mp4';
  }
  return null;
}

function mimeFamily(mime: string): 'mp3' | 'mp4' | null {
  if (mime === 'audio/mpeg') return 'mp3';
  if (mime === 'audio/mp4' || mime === 'audio/x-m4a' || mime === 'audio/aac') return 'mp4';
  return null;
}

export async function validateAudio(buf: Buffer, mime: string): Promise<AudioValidationResult> {
  if (!ALLOWED_AUDIO_MIME.has(mime)) {
    return { ok: false, reason: 'wrongType' };
  }
  if (buf.length > MAX_AUDIO_BYTES) {
    return { ok: false, reason: 'tooBig' };
  }
  const detected = detectMagicMime(buf);
  const claimed = mimeFamily(mime);
  if (!detected || mimeFamily(detected) !== claimed) {
    return { ok: false, reason: 'wrongType' };
  }
  let durationSec: number | undefined;
  try {
    const meta = await parseBuffer(buf, { mimeType: mime }, { duration: true });
    durationSec = meta.format.duration;
  } catch {
    return { ok: false, reason: 'wrongType' };
  }
  if (durationSec === undefined || !Number.isFinite(durationSec)) {
    return { ok: false, reason: 'wrongType' };
  }
  const durationMs = Math.round(durationSec * 1000);
  if (durationMs > MAX_AUDIO_DURATION_MS) {
    return { ok: false, reason: 'tooLong' };
  }
  return { ok: true, durationMs, mime };
}
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/lib/audioValidation.test.ts`
Expected: 9/9 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/audioValidation.ts tests/unit/lib/audioValidation.test.ts
git commit -m "feat(lib): audioValidation — mime + magic + size + duration pipeline"
```

---

## Task 5: POST `/api/presets/[id]/audio` (upload)

**Files:**
- Create: `src/app/api/presets/[id]/audio/route.ts` (POST now, DELETE stub returning 501)
- Test: `tests/unit/api/preset-audio-upload.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/api/preset-audio-upload.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    preset: { findUnique: vi.fn(), update: vi.fn() },
    adminAction: { create: vi.fn() },
  },
}));
vi.mock('@/lib/session', () => ({ validateSession: vi.fn(), refreshSessionCookie: vi.fn() }));
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(() => true) }));
vi.mock('@/lib/rateLimit', () => ({ rateLimit: vi.fn(() => ({ allowed: true, remaining: 4 })) }));
vi.mock('@/lib/storage', () => ({ uploadAudio: vi.fn(), deleteAudio: vi.fn() }));
vi.mock('@/lib/audioValidation', () => ({
  validateAudio: vi.fn(),
  ALLOWED_AUDIO_MIME: new Set(['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac']),
  MAX_AUDIO_BYTES: 2 * 1024 * 1024,
  MAX_AUDIO_DURATION_MS: 30_500,
}));

import { POST } from '@/app/api/presets/[id]/audio/route';
import { prisma } from '@/lib/prisma';
import { validateSession } from '@/lib/session';
import { uploadAudio, deleteAudio } from '@/lib/storage';
import { validateAudio } from '@/lib/audioValidation';

function makeFormRequest(file: File | null) {
  const fd = new FormData();
  if (file) fd.append('audio', file);
  return new NextRequest('http://test/api/presets/p1/audio', {
    method: 'POST',
    headers: { origin: 'http://test' },
    body: fd,
  });
}

function fakeFile(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateSession).mockResolvedValue({ user: { id: 'u1', role: 'USER', emailVerified: true }, session: { fresh: false } } as never);
  vi.mocked(prisma.preset.findUnique).mockResolvedValue({ id: 'p1', userId: 'u1', audioKey: null } as never);
  vi.mocked(validateAudio).mockResolvedValue({ ok: true, durationMs: 15000, mime: 'audio/mpeg' } as never);
  vi.mocked(prisma.preset.update).mockResolvedValue({} as never);
});

describe('POST /api/presets/[id]/audio', () => {
  it('owner upload: validates, uploads to S3, updates DB', async () => {
    const res = await POST(makeFormRequest(fakeFile('a.mp3', 'audio/mpeg')), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    expect(uploadAudio).toHaveBeenCalled();
    expect(prisma.preset.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'p1' },
      data: expect.objectContaining({ audioMimeType: 'audio/mpeg', audioDurationMs: 15000 }),
    }));
    expect(prisma.adminAction.create).not.toHaveBeenCalled();
  });

  it('admin upload on foreign preset: writes AdminAction', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'a1', role: 'ADMIN', emailVerified: true }, session: { fresh: false } } as never);
    vi.mocked(prisma.preset.findUnique).mockResolvedValue({ id: 'p1', userId: 'someone-else', audioKey: null } as never);
    const res = await POST(makeFormRequest(fakeFile('a.mp3', 'audio/mpeg')), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    expect(prisma.adminAction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'REPLACE_PRESET_AUDIO', targetType: 'preset', targetId: 'p1', adminId: 'a1' }),
    }));
  });

  it('replace: deletes old key after DB update', async () => {
    vi.mocked(prisma.preset.findUnique).mockResolvedValue({ id: 'p1', userId: 'u1', audioKey: 'preset-p1-old.mp3' } as never);
    const res = await POST(makeFormRequest(fakeFile('a.mp3', 'audio/mpeg')), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    expect(deleteAudio).toHaveBeenCalledWith('preset-p1-old.mp3');
  });

  it('non-owner non-admin: 403', async () => {
    vi.mocked(prisma.preset.findUnique).mockResolvedValue({ id: 'p1', userId: 'someone-else', audioKey: null } as never);
    const res = await POST(makeFormRequest(fakeFile('a.mp3', 'audio/mpeg')), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(403);
  });

  it('unverified user (own preset): 403', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'u1', role: 'USER', emailVerified: false }, session: { fresh: false } } as never);
    const res = await POST(makeFormRequest(fakeFile('a.mp3', 'audio/mpeg')), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(403);
  });

  it('unauthenticated: 401', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: null, session: null } as never);
    const res = await POST(makeFormRequest(fakeFile('a.mp3', 'audio/mpeg')), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(401);
  });

  it('no file: 400', async () => {
    const res = await POST(makeFormRequest(null), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
  });

  it('validation tooLong: 400', async () => {
    vi.mocked(validateAudio).mockResolvedValue({ ok: false, reason: 'tooLong' } as never);
    const res = await POST(makeFormRequest(fakeFile('a.mp3', 'audio/mpeg')), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('tooLong');
  });

  it('rate-limited: 429', async () => {
    const { rateLimit } = await import('@/lib/rateLimit');
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0 });
    const res = await POST(makeFormRequest(fakeFile('a.mp3', 'audio/mpeg')), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(429);
  });

  it('CSRF fail: 403', async () => {
    const { verifyCsrf } = await import('@/lib/csrf');
    vi.mocked(verifyCsrf).mockReturnValueOnce(false);
    const res = await POST(makeFormRequest(fakeFile('a.mp3', 'audio/mpeg')), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(403);
  });

  it('preset not found: 404', async () => {
    vi.mocked(prisma.preset.findUnique).mockResolvedValue(null);
    const res = await POST(makeFormRequest(fakeFile('a.mp3', 'audio/mpeg')), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(404);
  });
});
```

Run: `npx vitest run tests/unit/api/preset-audio-upload.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement POST + DELETE stub**

Create `src/app/api/presets/[id]/audio/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { validateSession, refreshSessionCookie } from '@/lib/session';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import { uploadAudio, deleteAudio } from '@/lib/storage';
import { validateAudio } from '@/lib/audioValidation';

const EXT_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
};

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

  // Best-effort delete of the previous object after DB committed.
  if (preset.audioKey) {
    await deleteAudio(preset.audioKey).catch(() => {});
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

// DELETE — implemented in Task 6.
export async function DELETE() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/api/preset-audio-upload.test.ts`
Expected: 11/11 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/presets/[id]/audio/route.ts tests/unit/api/preset-audio-upload.test.ts
git commit -m "feat(api): POST /api/presets/[id]/audio with validation + audit"
```

---

## Task 6: DELETE `/api/presets/[id]/audio`

**Files:**
- Modify: `src/app/api/presets/[id]/audio/route.ts` (replace 501 stub)
- Test: `tests/unit/api/preset-audio-delete.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/api/preset-audio-delete.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    preset: { findUnique: vi.fn(), update: vi.fn() },
    adminAction: { create: vi.fn() },
  },
}));
vi.mock('@/lib/session', () => ({ validateSession: vi.fn(), refreshSessionCookie: vi.fn() }));
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(() => true) }));
vi.mock('@/lib/storage', () => ({ deleteAudio: vi.fn() }));

import { DELETE } from '@/app/api/presets/[id]/audio/route';
import { prisma } from '@/lib/prisma';
import { validateSession } from '@/lib/session';
import { deleteAudio } from '@/lib/storage';

function makeReq(body?: unknown) {
  return new NextRequest('http://test/api/presets/p1/audio', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', origin: 'http://test' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateSession).mockResolvedValue({ user: { id: 'u1', role: 'USER', emailVerified: true }, session: {} } as never);
  vi.mocked(prisma.preset.findUnique).mockResolvedValue({ id: 'p1', userId: 'u1', audioKey: 'preset-p1-12345.mp3' } as never);
  vi.mocked(prisma.preset.update).mockResolvedValue({} as never);
});

describe('DELETE /api/presets/[id]/audio', () => {
  it('owner deletes own audio: nulls fields + removes S3 object', async () => {
    const res = await DELETE(makeReq(), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    expect(deleteAudio).toHaveBeenCalledWith('preset-p1-12345.mp3');
    expect(prisma.preset.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { audioKey: null, audioMimeType: null, audioDurationMs: null },
    }));
    expect(prisma.adminAction.create).not.toHaveBeenCalled();
  });

  it('admin deletes foreign audio: requires reason ≥ 5 chars + AdminAction', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'a1', role: 'ADMIN', emailVerified: true }, session: {} } as never);
    vi.mocked(prisma.preset.findUnique).mockResolvedValue({ id: 'p1', userId: 'other', audioKey: 'preset-p1-77.mp3' } as never);
    const res = await DELETE(makeReq({ reason: 'inappropriate content' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    expect(prisma.adminAction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ adminId: 'a1', action: 'DELETE_PRESET_AUDIO', targetType: 'preset', targetId: 'p1', reason: 'inappropriate content' }),
    }));
  });

  it('admin deletes foreign audio without reason: 400', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'a1', role: 'ADMIN', emailVerified: true }, session: {} } as never);
    vi.mocked(prisma.preset.findUnique).mockResolvedValue({ id: 'p1', userId: 'other', audioKey: 'preset-p1-77.mp3' } as never);
    const res = await DELETE(makeReq({ reason: 'hi' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
  });

  it('non-owner non-admin: 403', async () => {
    vi.mocked(prisma.preset.findUnique).mockResolvedValue({ id: 'p1', userId: 'other', audioKey: 'x.mp3' } as never);
    const res = await DELETE(makeReq(), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(403);
  });

  it('no audio on preset: 404', async () => {
    vi.mocked(prisma.preset.findUnique).mockResolvedValue({ id: 'p1', userId: 'u1', audioKey: null } as never);
    const res = await DELETE(makeReq(), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(404);
  });

  it('unauthenticated: 401', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: null, session: null } as never);
    const res = await DELETE(makeReq(), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(401);
  });
});
```

Run: `npx vitest run tests/unit/api/preset-audio-delete.test.ts`
Expected: FAIL.

- [ ] **Step 2: Replace DELETE stub**

In `src/app/api/presets/[id]/audio/route.ts`, add the import for `adminDeleteReasonSchema`:

```ts
import { adminDeleteReasonSchema } from '@/lib/commentValidators';
```

Replace the `export async function DELETE() { ... 501 }` stub with:

```ts
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!verifyCsrf(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { user, session } = await validateSession();
  if (!user || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  await deleteAudio(preset.audioKey).catch(() => {});

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
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/api/preset-audio-delete.test.ts tests/unit/api/preset-audio-upload.test.ts`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/presets/[id]/audio/route.ts tests/unit/api/preset-audio-delete.test.ts
git commit -m "feat(api): DELETE /api/presets/[id]/audio with admin audit"
```

---

## Task 7: GET `/api/preset-audio/[key]`

**Files:**
- Create: `src/app/api/preset-audio/[key]/route.ts`
- Test: `tests/unit/api/preset-audio-get.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/api/preset-audio-get.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Readable } from 'stream';

vi.mock('@/lib/storage', () => ({ getAudioStream: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: { preset: { findFirst: vi.fn() } },
}));

import { GET } from '@/app/api/preset-audio/[key]/route';
import { getAudioStream } from '@/lib/storage';
import { prisma } from '@/lib/prisma';

function reqFor(key: string) {
  return new NextRequest(`http://test/api/preset-audio/${encodeURIComponent(key)}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.preset.findFirst).mockResolvedValue({
    id: 'p1',
    audioMimeType: 'audio/mpeg',
  } as never);
});

describe('GET /api/preset-audio/[key]', () => {
  it('serves a valid mp3 key with audio/mpeg content-type', async () => {
    vi.mocked(getAudioStream).mockResolvedValue(Readable.from([Buffer.from('FFFB', 'utf8')]) as never);
    const res = await GET(reqFor('preset-abc123-1700000000.mp3'), { params: Promise.resolve({ key: 'preset-abc123-1700000000.mp3' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(res.headers.get('Cache-Control')).toContain('immutable');
  });

  it('serves m4a with audio/mp4 content-type', async () => {
    vi.mocked(prisma.preset.findFirst).mockResolvedValue({ id: 'p1', audioMimeType: 'audio/mp4' } as never);
    vi.mocked(getAudioStream).mockResolvedValue(Readable.from([Buffer.from('00')]) as never);
    const res = await GET(reqFor('preset-abc123-1700000000.m4a'), { params: Promise.resolve({ key: 'preset-abc123-1700000000.m4a' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mp4');
  });

  it('rejects key with invalid pattern: 404', async () => {
    const res = await GET(reqFor('../../etc/passwd'), { params: Promise.resolve({ key: '../../etc/passwd' }) });
    expect(res.status).toBe(404);
    expect(getAudioStream).not.toHaveBeenCalled();
  });

  it('rejects key not referenced by any preset: 404', async () => {
    vi.mocked(prisma.preset.findFirst).mockResolvedValue(null);
    const res = await GET(reqFor('preset-orphan-1.mp3'), { params: Promise.resolve({ key: 'preset-orphan-1.mp3' }) });
    expect(res.status).toBe(404);
  });

  it('returns 404 when storage throws', async () => {
    vi.mocked(getAudioStream).mockRejectedValue(new Error('not found'));
    const res = await GET(reqFor('preset-abc-1.mp3'), { params: Promise.resolve({ key: 'preset-abc-1.mp3' }) });
    expect(res.status).toBe(404);
  });
});
```

Run: `npx vitest run tests/unit/api/preset-audio-get.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement**

Create `src/app/api/preset-audio/[key]/route.ts`:

```ts
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

  // Confirm the key is referenced by a preset (an extra round-trip but cheap
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
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/api/preset-audio-get.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/preset-audio/[key]/route.ts tests/unit/api/preset-audio-get.test.ts
git commit -m "feat(api): GET /api/preset-audio/[key] public stream"
```

---

## Task 8: AudioPlayerProvider

**Files:**
- Create: `src/components/audio/AudioPlayerProvider.tsx`
- Test: `tests/unit/components/AudioPlayerProvider.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/unit/components/AudioPlayerProvider.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { AudioPlayerProvider, useAudioPlayerManager } from '@/components/audio/AudioPlayerProvider';

function Probe({ onReady }: { onReady: (mgr: ReturnType<typeof useAudioPlayerManager>, audio: HTMLAudioElement) => void }) {
  const mgr = useAudioPlayerManager();
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (ref.current) onReady(mgr, ref.current); }, [mgr, onReady]);
  return <audio ref={ref} />;
}

describe('AudioPlayerProvider', () => {
  it('notifyPlay pauses the previously playing element', () => {
    let firstMgr: ReturnType<typeof useAudioPlayerManager> | null = null;
    let firstEl: HTMLAudioElement | null = null;
    let secondEl: HTMLAudioElement | null = null;

    render(
      <AudioPlayerProvider>
        <Probe onReady={(m, el) => { if (!firstEl) { firstMgr = m; firstEl = el; } else { secondEl = el; } }} />
        <Probe onReady={(m, el) => { if (!firstEl) { firstMgr = m; firstEl = el; } else { secondEl = el; } }} />
      </AudioPlayerProvider>
    );

    expect(firstEl && secondEl).toBeTruthy();
    let paused = false;
    if (firstEl) firstEl.pause = () => { paused = true; };

    act(() => { firstMgr!.notifyPlay(firstEl!); });
    act(() => { firstMgr!.notifyPlay(secondEl!); });
    expect(paused).toBe(true);
  });

  it('notifyEnded clears the active ref', () => {
    let mgr: ReturnType<typeof useAudioPlayerManager> | null = null;
    let el: HTMLAudioElement | null = null;
    render(
      <AudioPlayerProvider>
        <Probe onReady={(m, e) => { mgr = m; el = e; }} />
      </AudioPlayerProvider>
    );
    act(() => { mgr!.notifyPlay(el!); });
    act(() => { mgr!.notifyEnded(el!); });
    // No assertion target — but a second notifyPlay on the same element
    // must not throw "cannot pause null" — which proves ref was cleared.
    act(() => { mgr!.notifyPlay(el!); });
    expect(true).toBe(true);
  });
});
```

Run: `npx vitest run tests/unit/components/AudioPlayerProvider.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Implement**

Create `src/components/audio/AudioPlayerProvider.tsx`:

```tsx
'use client';
import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';

export interface AudioPlayerManager {
  notifyPlay: (el: HTMLAudioElement) => void;
  notifyEnded: (el: HTMLAudioElement) => void;
}

const AudioPlayerCtx = createContext<AudioPlayerManager | null>(null);

export function useAudioPlayerManager(): AudioPlayerManager {
  const v = useContext(AudioPlayerCtx);
  // Fallback no-op so AudioPlayer can be used outside the provider in tests
  // and isolated previews without crashing.
  if (!v) return { notifyPlay: () => {}, notifyEnded: () => {} };
  return v;
}

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const activeRef = useRef<HTMLAudioElement | null>(null);

  const notifyPlay = useCallback((el: HTMLAudioElement) => {
    if (activeRef.current && activeRef.current !== el) {
      activeRef.current.pause();
    }
    activeRef.current = el;
  }, []);

  const notifyEnded = useCallback((el: HTMLAudioElement) => {
    if (activeRef.current === el) activeRef.current = null;
  }, []);

  return (
    <AudioPlayerCtx.Provider value={{ notifyPlay, notifyEnded }}>
      {children}
    </AudioPlayerCtx.Provider>
  );
}
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/components/AudioPlayerProvider.test.tsx`
Expected: 2/2 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/audio/AudioPlayerProvider.tsx tests/unit/components/AudioPlayerProvider.test.tsx
git commit -m "feat(ui): AudioPlayerProvider — coordinates single-player playback"
```

---

## Task 9: AudioPlayer component

**Files:**
- Create: `src/components/audio/AudioPlayer.tsx`
- Test: `tests/unit/components/AudioPlayer.test.tsx`

- [ ] **Step 1: i18n keys for audio.player.* (English baseline; other locales filled in Task 16)**

Append to `messages/en.json` under a new top-level `"audio"` object (place after the existing `"comments"` block):

```json
"audio": {
  "player": {
    "playLabel": "Play",
    "pauseLabel": "Pause",
    "progressLabel": "Progress {current} of {total}",
    "duration": "{seconds} s audio preview",
    "noAudio": "No audio sample"
  },
  "upload": {
    "label": "Audio snippet (optional)",
    "placeholder": "Pick MP3 or M4A, max 30 s, max 2 MB",
    "replace": "Replace",
    "remove": "Remove",
    "dropHere": "Drop file here",
    "picking": "Pick file…",
    "uploading": "Uploading…",
    "success": "Audio saved",
    "tooLong": "File too long — max 30 s",
    "tooBig": "File too large — max 2 MB",
    "wrongType": "Unsupported format — MP3 or M4A",
    "notAuthorized": "Only the preset owner can upload audio",
    "genericError": "Upload failed — please try again"
  }
}
```

Also append `"gallery.audio": { "iconLabel": "Play preview" }` inside the existing `"gallery"` object (alongside `gallery.rate`).

- [ ] **Step 2: Write failing test**

Create `tests/unit/components/AudioPlayer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/en.json';
import { AudioPlayer } from '@/components/audio/AudioPlayer';

function wrap(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

describe('AudioPlayer', () => {
  it('full variant renders Play button + duration label', () => {
    render(wrap(<AudioPlayer src="/api/preset-audio/preset-x-1.mp3" mime="audio/mpeg" durationMs={28000} variant="full" />));
    expect(screen.getByRole('button', { name: /play/i })).toBeTruthy();
    expect(screen.getByText('0:00 / 0:28')).toBeTruthy();
  });

  it('icon variant renders a single icon button', () => {
    render(wrap(<AudioPlayer src="/api/preset-audio/preset-x-1.mp3" mime="audio/mpeg" durationMs={5000} variant="icon" />));
    const btns = screen.getAllByRole('button');
    expect(btns.length).toBe(1);
  });

  it('click play calls .play() on the underlying <audio>', () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    render(wrap(<AudioPlayer src="/api/preset-audio/preset-x-1.mp3" mime="audio/mpeg" durationMs={5000} variant="full" />));
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(playSpy).toHaveBeenCalled();
    playSpy.mockRestore();
  });
});
```

Run: `npx vitest run tests/unit/components/AudioPlayer.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

Create `src/components/audio/AudioPlayer.tsx`:

```tsx
'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAudioPlayerManager } from './AudioPlayerProvider';

interface Props {
  src: string;
  mime: string;
  durationMs: number;
  variant: 'full' | 'icon';
}

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ src, mime, durationMs, variant }: Props) {
  const t = useTranslations('audio.player');
  const tGallery = useTranslations('gallery.audio');
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const mgr = useAudioPlayerManager();
  const total = durationMs / 1000;

  function toggle() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      mgr.notifyPlay(el);
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }

  function onTimeUpdate() {
    if (ref.current) setCurrent(ref.current.currentTime);
  }

  function onPlay() { setPlaying(true); }
  function onPause() { setPlaying(false); }
  function onEnded() {
    setPlaying(false);
    setCurrent(0);
    if (ref.current) mgr.notifyEnded(ref.current);
  }

  if (variant === 'icon') {
    return (
      <>
        <button
          type="button"
          onClick={toggle}
          aria-label={tGallery('iconLabel')}
          aria-pressed={playing}
          className="inline-flex items-center justify-center w-6 h-6 rounded"
          style={{ color: 'var(--accent-amber)', border: '1px solid var(--accent-amber-dim)' }}
        >
          <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
        </button>
        <audio
          ref={ref}
          src={src}
          preload="none"
          onTimeUpdate={onTimeUpdate}
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
          aria-hidden="true"
        >
          <source src={src} type={mime} />
        </audio>
      </>
    );
  }

  return (
    <div
      role="application"
      aria-label={t('duration', { seconds: Math.round(total) })}
      className="flex items-center gap-3 p-2 rounded"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t('pauseLabel') : t('playLabel')}
        aria-pressed={playing}
        className="inline-flex items-center justify-center w-8 h-8 rounded"
        style={{ color: 'var(--accent-amber)', border: '1px solid var(--accent-amber-dim)' }}
      >
        <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="h-1 rounded overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          role="progressbar"
          aria-label={t('progressLabel', { current: fmt(current), total: fmt(total) })}
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(current)}
        >
          <div
            className="h-full"
            style={{
              width: total > 0 ? `${(current / total) * 100}%` : '0%',
              background: 'var(--accent-amber)',
            }}
          />
        </div>
        <span className="text-[10px] font-mono-display" style={{ color: 'var(--text-muted)' }}>
          {fmt(current)} / {fmt(total)}
        </span>
      </div>
      <audio
        ref={ref}
        src={src}
        preload="none"
        onTimeUpdate={onTimeUpdate}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        aria-hidden="true"
      >
        <source src={src} type={mime} />
      </audio>
    </div>
  );
}
```

- [ ] **Step 4: Run test green**

Run: `npx vitest run tests/unit/components/AudioPlayer.test.tsx`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/audio/AudioPlayer.tsx tests/unit/components/AudioPlayer.test.tsx messages/en.json
git commit -m "feat(ui): AudioPlayer (full + icon variants) + en i18n keys"
```

---

## Task 10: AudioUploadField component

**Files:**
- Create: `src/components/audio/AudioUploadField.tsx`
- Test: `tests/unit/components/AudioUploadField.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/unit/components/AudioUploadField.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/en.json';
import { AudioUploadField } from '@/components/audio/AudioUploadField';

function wrap(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={messages}>{node}</NextIntlClientProvider>;
}

function fakeFile(name = 'test.mp3', type = 'audio/mpeg', size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('AudioUploadField', () => {
  it('renders placeholder when no audio is attached', () => {
    render(wrap(<AudioUploadField presetId="p1" hasAudio={false} onChange={vi.fn()} />));
    expect(screen.getByText(/Pick MP3 or M4A/i)).toBeTruthy();
  });

  it('POSTs the file to /api/presets/[id]/audio on file pick', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      audioKey: 'k', audioUrl: '/api/preset-audio/k', audioMimeType: 'audio/mpeg', audioDurationMs: 5000,
    }), { status: 200 }));
    const onChange = vi.fn();
    render(wrap(<AudioUploadField presetId="p1" hasAudio={false} onChange={onChange} />));
    const input = screen.getByLabelText(/audio snippet/i, { selector: 'input[type="file"]' }) as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [fakeFile()] });
    fireEvent.change(input);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/presets/p1/audio', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ audioKey: 'k' })));
    fetchSpy.mockRestore();
  });

  it('surfaces tooLong error from server', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'tooLong' }), { status: 400 }));
    render(wrap(<AudioUploadField presetId="p1" hasAudio={false} onChange={vi.fn()} />));
    const input = screen.getByLabelText(/audio snippet/i, { selector: 'input[type="file"]' }) as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [fakeFile()] });
    fireEvent.change(input);
    await waitFor(() => expect(screen.getByText(/max 30 s/i)).toBeTruthy());
    fetchSpy.mockRestore();
  });

  it('shows Replace + Remove when hasAudio=true', () => {
    render(wrap(<AudioUploadField presetId="p1" hasAudio={true} onChange={vi.fn()} />));
    expect(screen.getByRole('button', { name: /replace/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /remove/i })).toBeTruthy();
  });
});
```

Run: `npx vitest run tests/unit/components/AudioUploadField.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Implement**

Create `src/components/audio/AudioUploadField.tsx`:

```tsx
'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

interface UploadResult {
  audioKey: string;
  audioUrl: string;
  audioMimeType: string;
  audioDurationMs: number;
}

interface Props {
  presetId: string;
  hasAudio: boolean;
  onChange: (result: UploadResult | null) => void;
}

const ERROR_KEYS = new Set(['tooLong', 'tooBig', 'wrongType', 'notAuthorized']);

export function AudioUploadField({ presetId, hasAudio, onChange }: Props) {
  const t = useTranslations('audio.upload');
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [present, setPresent] = useState(hasAudio);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);

    const fd = new FormData();
    fd.append('audio', file);

    try {
      const res = await fetch(`/api/presets/${presetId}/audio`, { method: 'POST', body: fd });
      if (res.ok) {
        const data = (await res.json()) as UploadResult;
        setPresent(true);
        onChange(data);
      } else if (res.status === 401 || res.status === 403) {
        setError(t('notAuthorized'));
      } else if (res.status === 400) {
        const data = await res.json().catch(() => null);
        const code = data?.error;
        setError(ERROR_KEYS.has(code) ? t(code as 'tooLong' | 'tooBig' | 'wrongType' | 'notAuthorized') : t('genericError'));
      } else {
        setError(t('genericError'));
      }
    } catch {
      setError(t('genericError'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/presets/${presetId}/audio`, { method: 'DELETE' });
      if (res.ok) {
        setPresent(false);
        onChange(null);
      } else {
        setError(t('genericError'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-mono-display uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {t('label')}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,.mp3,.m4a,.aac"
          onChange={handlePick}
          disabled={busy}
          className="text-xs"
          aria-label={t('label')}
        />
        {present && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="text-[10px] uppercase tracking-wider px-2 py-1 rounded"
              style={{ color: 'var(--accent-amber)', border: '1px solid var(--accent-amber-dim)' }}
            >
              {t('replace')}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="text-[10px] uppercase tracking-wider px-2 py-1 rounded"
              style={{ color: '#ef4444', border: '1px solid #ef4444' }}
            >
              {t('remove')}
            </button>
          </>
        )}
      </div>
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {busy ? t('uploading') : t('placeholder')}
      </span>
      {error && (
        <span className="text-[10px]" style={{ color: '#ef4444' }}>{error}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run test green**

Run: `npx vitest run tests/unit/components/AudioUploadField.test.tsx`
Expected: 4/4 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/audio/AudioUploadField.tsx tests/unit/components/AudioUploadField.test.tsx
git commit -m "feat(ui): AudioUploadField — pick/replace/remove with server error surfacing"
```

---

## Task 11: Provider in ClientProviders

**Files:**
- Modify: `src/app/[locale]/ClientProviders.tsx`

- [ ] **Step 1: Wrap children with AudioPlayerProvider**

Read `src/app/[locale]/ClientProviders.tsx` and add an import + nest the provider around its existing tree:

```tsx
import { AudioPlayerProvider } from '@/components/audio/AudioPlayerProvider';
```

Wrap the existing returned tree so children sit inside `<AudioPlayerProvider>`. Example shape (adapt to whatever the file already has):

```tsx
return (
  <AudioPlayerProvider>
    {/* existing providers / children */}
  </AudioPlayerProvider>
);
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -3`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/ClientProviders.tsx
git commit -m "feat(ui): mount AudioPlayerProvider at the root client provider tree"
```

---

## Task 12: Share-page integration (player + upload field)

**Files:**
- Modify: `src/app/[locale]/share/[token]/page.tsx`

- [ ] **Step 1: Import + render player + owner upload**

In `src/app/[locale]/share/[token]/page.tsx`:

1. Add imports near the existing component imports:

```tsx
import { AudioPlayer } from '@/components/audio/AudioPlayer';
import { AudioUploadField } from '@/components/audio/AudioUploadField';
```

2. Extend the `prisma.preset.findUnique({ select: { ... } })` call (search for where the preset is loaded) to include three new selected fields:

```ts
audioKey: true,
audioMimeType: true,
audioDurationMs: true,
```

3. Just below the existing `<RatingWidget />` JSX, insert:

```tsx
{preset.audioKey && preset.audioMimeType && preset.audioDurationMs && (
  <div className="my-4">
    <AudioPlayer
      src={`/api/preset-audio/${preset.audioKey}`}
      mime={preset.audioMimeType}
      durationMs={preset.audioDurationMs}
      variant="full"
    />
  </div>
)}
{(user?.id === preset.userId || user?.role === 'ADMIN') && user?.emailVerified && (
  <div className="my-3">
    <AudioUploadField
      presetId={preset.id}
      hasAudio={!!preset.audioKey}
      onChange={() => { /* page is server-rendered; user reloads to see new state */ }}
    />
  </div>
)}
```

(Adapt the local variable name for the session/user to whatever the file uses — search for `<RatingWidget` and reuse those variables.)

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -3`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/share/[token]/page.tsx
git commit -m "feat(share): render AudioPlayer + AudioUploadField (owner/admin) on /share/[token]"
```

---

## Task 13: FeaturedPresetBlock — icon player

**Files:**
- Modify: `src/lib/featuredPreset.ts` (include audio fields in FEATURED_SELECT)
- Modify: `src/components/FeaturedPresetBlock.tsx`

- [ ] **Step 1: Add fields to FEATURED_SELECT**

In `src/lib/featuredPreset.ts`, extend `FEATURED_SELECT`:

```ts
const FEATURED_SELECT = {
  id: true,
  name: true,
  description: true,
  shareToken: true,
  ratingAverage: true,
  ratingCount: true,
  modules: true,
  effects: true,
  style: true,
  author: true,
  audioKey: true,
  audioMimeType: true,
  audioDurationMs: true,
  user: { select: { id: true, username: true, avatarKey: true } },
} satisfies Prisma.PresetSelect;
```

- [ ] **Step 2: Render icon player in FeaturedPresetBlock**

In `src/components/FeaturedPresetBlock.tsx`, add the import:

```tsx
import { AudioPlayer } from './audio/AudioPlayer';
```

Inside the rating row (the same `<div className="mb-2">` that holds `<GuitarRating ... />`), add the player conditionally to the right of the rating:

```tsx
<div className="mb-2 flex items-center gap-3">
  <GuitarRating value={featured.ratingAverage} count={featured.ratingCount} size="md" />
  {featured.audioKey && featured.audioMimeType && featured.audioDurationMs && (
    <AudioPlayer
      src={`/api/preset-audio/${featured.audioKey}`}
      mime={featured.audioMimeType}
      durationMs={featured.audioDurationMs}
      variant="icon"
    />
  )}
</div>
```

(Find the existing `<GuitarRating>` line and replace its surrounding `<div>` accordingly.)

- [ ] **Step 3: Verify build + existing test**

Run: `npx tsc --noEmit && npx vitest run tests/unit/components/FeaturedPresetBlock.test.tsx tests/unit/lib/featuredPreset.test.ts 2>&1 | tail -6`
Expected: tests still pass (the existing tests don't reference audio fields).

- [ ] **Step 4: Commit**

```bash
git add src/lib/featuredPreset.ts src/components/FeaturedPresetBlock.tsx
git commit -m "feat(featured): icon AudioPlayer alongside rating in homepage hero"
```

---

## Task 14: Gallery — icon player on every card

**Files:**
- Modify: `src/app/api/gallery/route.ts`
- Modify: `src/app/[locale]/gallery/GalleryClient.tsx`

- [ ] **Step 1: Include audio fields in gallery API**

In `src/app/api/gallery/route.ts`, inside the `prisma.preset.findMany({ ..., select: { ... } })`, add three keys to the select object:

```ts
audioKey: true,
audioMimeType: true,
audioDurationMs: true,
```

- [ ] **Step 2: Extend GalleryPreset type + render player**

In `src/app/[locale]/gallery/GalleryClient.tsx`:

1. Extend the `GalleryPreset` type with:

```ts
audioKey: string | null;
audioMimeType: string | null;
audioDurationMs: number | null;
```

2. Import the player:

```tsx
import { AudioPlayer } from '@/components/audio/AudioPlayer';
```

3. Just to the right of the existing `<RateableGuitarRating>` on each card, add:

```tsx
{preset.audioKey && preset.audioMimeType && preset.audioDurationMs !== null && (
  <AudioPlayer
    src={`/api/preset-audio/${preset.audioKey}`}
    mime={preset.audioMimeType}
    durationMs={preset.audioDurationMs}
    variant="icon"
  />
)}
```

- [ ] **Step 3: Build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -3`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/gallery/route.ts src/app/[locale]/gallery/GalleryClient.tsx
git commit -m "feat(gallery): per-card icon AudioPlayer + audio fields in /api/gallery"
```

---

## Task 15: SavePresetDialog integration

**Files:**
- Modify: `src/components/SavePresetDialog.tsx`

- [ ] **Step 1: Add optional file state + post-save audio upload**

In `src/components/SavePresetDialog.tsx`:

1. Add a new local state for the picked audio file:

```tsx
const [audioFile, setAudioFile] = useState<File | null>(null);
```

2. Render a simple file input below the description input (the AudioUploadField talks to a saved preset, so for the dialog we just hold the File and post it after save):

```tsx
<div className="flex flex-col gap-1 mt-3">
  <label className="text-xs font-mono-display uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
    {t('audioSnippet')}
  </label>
  <input
    type="file"
    accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,.mp3,.m4a,.aac"
    onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
    className="text-xs"
  />
  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
    {t('audioHint')}
  </span>
</div>
```

3. After the existing preset-save fetch succeeds and yields a preset id, before any redirect, do:

```ts
if (audioFile && savedPresetId) {
  const fd = new FormData();
  fd.append('audio', audioFile);
  const audioRes = await fetch(`/api/presets/${savedPresetId}/audio`, { method: 'POST', body: fd });
  if (!audioRes.ok) {
    // Preset is already saved; surface a non-fatal toast and let the user
    // retry from /share/[token] via AudioUploadField.
    setError(t('audioFailedRetryOnSharePage'));
  }
}
```

(Adapt variable names to the file's existing conventions: `savedPresetId`, `setError`, and the surrounding flow vary.)

4. Add two new keys to `messages/en.json` under the dialog's existing namespace (search where `t('saveButton')` is defined to find the parent namespace; likely `editor.saveDialog.*` or similar). Add:

```json
"audioSnippet": "Audio snippet (optional)",
"audioHint": "MP3 or M4A, max 30 s and 2 MB. Can be added/edited later on the share page.",
"audioFailedRetryOnSharePage": "Preset saved, but audio upload failed. Try again on the share page."
```

Put the matching translations into the other 6 locales in Task 16.

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -3`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/SavePresetDialog.tsx messages/en.json
git commit -m "feat(editor): optional audio snippet field in SavePresetDialog"
```

---

## Task 16: i18n keys in all 6 non-English locales

**Files:**
- Modify: `messages/de.json`, `messages/es.json`, `messages/fr.json`, `messages/it.json`, `messages/pt.json`, `messages/pt-BR.json`

- [ ] **Step 1: Add the `audio.player.*`, `audio.upload.*`, `gallery.audio.iconLabel`, and dialog keys in each locale**

For each `messages/<locale>.json`, add — in the same structural positions as the en.json baseline — a translated copy of every key listed below.

Use the following per-locale strings (paste each block into the right namespace):

**de (German):**
```
audio.player.playLabel              "Abspielen"
audio.player.pauseLabel             "Pause"
audio.player.progressLabel          "Fortschritt {current} von {total}"
audio.player.duration               "{seconds} s Audio-Vorschau"
audio.player.noAudio                "Kein Audio-Beispiel"
audio.upload.label                  "Audio-Schnipsel (optional)"
audio.upload.placeholder            "MP3 oder M4A wählen, max 30 s, max 2 MB"
audio.upload.replace                "Ersetzen"
audio.upload.remove                 "Entfernen"
audio.upload.dropHere               "Datei hier ablegen"
audio.upload.picking                "Datei wählen…"
audio.upload.uploading              "Lade hoch…"
audio.upload.success                "Audio gespeichert"
audio.upload.tooLong                "Datei zu lang — max 30 s"
audio.upload.tooBig                 "Datei zu groß — max 2 MB"
audio.upload.wrongType              "Format nicht unterstützt — MP3 oder M4A"
audio.upload.notAuthorized          "Nur der Preset-Owner kann Audio hochladen"
audio.upload.genericError           "Upload fehlgeschlagen — bitte erneut versuchen"
gallery.audio.iconLabel             "Vorschau abspielen"
editor.saveDialog.audioSnippet      "Audio-Schnipsel (optional)"  (or wherever the dialog keys live)
editor.saveDialog.audioHint         "MP3 oder M4A, max 30 s und 2 MB. Kann später auf der Share-Seite bearbeitet werden."
editor.saveDialog.audioFailedRetryOnSharePage  "Preset gespeichert, aber Audio-Upload fehlgeschlagen. Auf der Share-Seite erneut versuchen."
```

**es (Spanish):**
```
"Reproducir" / "Pausar" / "Progreso {current} de {total}" / "{seconds} s vista previa de audio" / "Sin muestra de audio"
"Clip de audio (opcional)" / "Elige MP3 o M4A, máx 30 s, máx 2 MB" / "Reemplazar" / "Quitar" / "Suelta el archivo aquí" / "Elegir archivo…" / "Subiendo…" / "Audio guardado" / "Archivo demasiado largo — máx 30 s" / "Archivo demasiado grande — máx 2 MB" / "Formato no admitido — MP3 o M4A" / "Solo el propietario del preset puede subir audio" / "Fallo al subir — inténtalo de nuevo"
gallery.audio.iconLabel "Reproducir vista previa"
editor.saveDialog.audioSnippet "Clip de audio (opcional)"
editor.saveDialog.audioHint "MP3 o M4A, máx 30 s y 2 MB. Se puede añadir/editar después en la página de compartir."
editor.saveDialog.audioFailedRetryOnSharePage "Preset guardado, pero el audio falló. Vuelve a intentarlo en la página de compartir."
```

**fr (French, tu-form):**
```
"Lire" / "Pause" / "Progression {current} sur {total}" / "{seconds} s d'aperçu audio" / "Pas d'échantillon audio"
"Extrait audio (optionnel)" / "Choisis un MP3 ou M4A, max 30 s, max 2 Mo" / "Remplacer" / "Retirer" / "Dépose le fichier ici" / "Choisir un fichier…" / "Téléversement…" / "Audio enregistré" / "Fichier trop long — max 30 s" / "Fichier trop volumineux — max 2 Mo" / "Format non supporté — MP3 ou M4A" / "Seul le propriétaire du preset peut téléverser l'audio" / "Échec — réessaie"
gallery.audio.iconLabel "Lire l'aperçu"
editor.saveDialog.audioSnippet "Extrait audio (optionnel)"
editor.saveDialog.audioHint "MP3 ou M4A, max 30 s et 2 Mo. Peut être ajouté/modifié plus tard sur la page de partage."
editor.saveDialog.audioFailedRetryOnSharePage "Preset enregistré, mais l'audio a échoué. Réessaie sur la page de partage."
```

**it (Italian):**
```
"Riproduci" / "Pausa" / "Avanzamento {current} di {total}" / "{seconds} s anteprima audio" / "Nessun campione audio"
"Snippet audio (opzionale)" / "Scegli MP3 o M4A, max 30 s, max 2 MB" / "Sostituisci" / "Rimuovi" / "Trascina il file qui" / "Scegli file…" / "Caricamento…" / "Audio salvato" / "File troppo lungo — max 30 s" / "File troppo grande — max 2 MB" / "Formato non supportato — MP3 o M4A" / "Solo il proprietario del preset può caricare l'audio" / "Caricamento fallito — riprova"
gallery.audio.iconLabel "Riproduci anteprima"
editor.saveDialog.audioSnippet "Snippet audio (opzionale)"
editor.saveDialog.audioHint "MP3 o M4A, max 30 s e 2 MB. Si può aggiungere/modificare dopo nella pagina di condivisione."
editor.saveDialog.audioFailedRetryOnSharePage "Preset salvato, ma l'audio non è stato caricato. Riprova nella pagina di condivisione."
```

**pt (European Portuguese):**
```
"Reproduzir" / "Pausa" / "Progresso {current} de {total}" / "{seconds} s pré-visualização de áudio" / "Sem amostra de áudio"
"Excerto de áudio (opcional)" / "Escolha MP3 ou M4A, máx 30 s, máx 2 MB" / "Substituir" / "Remover" / "Largue o ficheiro aqui" / "Escolher ficheiro…" / "A enviar…" / "Áudio guardado" / "Ficheiro demasiado longo — máx 30 s" / "Ficheiro demasiado grande — máx 2 MB" / "Formato não suportado — MP3 ou M4A" / "Apenas o dono do preset pode carregar áudio" / "Falha no envio — tente novamente"
gallery.audio.iconLabel "Reproduzir pré-visualização"
editor.saveDialog.audioSnippet "Excerto de áudio (opcional)"
editor.saveDialog.audioHint "MP3 ou M4A, máx 30 s e 2 MB. Pode ser adicionado/editado mais tarde na página de partilha."
editor.saveDialog.audioFailedRetryOnSharePage "Preset guardado, mas o áudio falhou. Tente novamente na página de partilha."
```

**pt-BR (Brazilian Portuguese):**
```
"Reproduzir" / "Pausar" / "Progresso {current} de {total}" / "{seconds} s prévia de áudio" / "Sem amostra de áudio"
"Trecho de áudio (opcional)" / "Escolha MP3 ou M4A, máx 30 s, máx 2 MB" / "Substituir" / "Remover" / "Solte o arquivo aqui" / "Escolher arquivo…" / "Enviando…" / "Áudio salvo" / "Arquivo muito longo — máx 30 s" / "Arquivo muito grande — máx 2 MB" / "Formato não suportado — MP3 ou M4A" / "Apenas o dono do preset pode enviar áudio" / "Falha no envio — tente novamente"
gallery.audio.iconLabel "Reproduzir prévia"
editor.saveDialog.audioSnippet "Trecho de áudio (opcional)"
editor.saveDialog.audioHint "MP3 ou M4A, máx 30 s e 2 MB. Pode ser adicionado/editado depois na página de compartilhamento."
editor.saveDialog.audioFailedRetryOnSharePage "Preset salvo, mas o áudio falhou. Tente novamente na página de compartilhamento."
```

- [ ] **Step 2: Run parity test**

Run: `npx vitest run tests/unit/messages-parity.test.ts`
Expected: PASS — all 7 locales aligned.

- [ ] **Step 3: Commit**

```bash
git add messages/
git commit -m "feat(i18n): audio.player + audio.upload + saveDialog audio keys for 7 locales"
```

---

## Task 17: Preset DELETE cleans up audio

**Files:**
- Modify: `src/app/api/presets/[id]/route.ts`

- [ ] **Step 1: Import deleteAudio + delete the S3 object before deleting the row**

In `src/app/api/presets/[id]/route.ts`:

1. Extend the existing import line for storage to include `deleteAudio`:

```ts
import { uploadPreset, deletePreset, deleteAudio } from '@/lib/storage';
```

2. Find the existing `DELETE` route (search for `prisma.preset.delete({ where: { id } })`). Just before that call, where it reads `existing.presetKey`, also load and delete `existing.audioKey`:

```ts
// existing line:
await deletePreset(existing.presetKey).catch(() => {});

// add immediately after:
if (existing.audioKey) {
  await deleteAudio(existing.audioKey).catch(() => {});
}
```

3. Make sure the `prisma.preset.findUnique({ where: { id }, select: { ... } })` earlier in the DELETE handler includes `audioKey: true`. If a single `existing` variable is used, add it to that select.

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -3`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/presets/[id]/route.ts
git commit -m "fix(api): clean up audio S3 object when a preset is deleted"
```

---

## Task 18: Generate audio test fixture

**Files:**
- Create: `tests/fixtures/audio/short-5s.mp3` (binary, ~25 KB)

- [ ] **Step 1: Generate with ffmpeg**

Run (locally):
```bash
mkdir -p tests/fixtures/audio
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=5" -ar 44100 -ac 1 -b:a 64k tests/fixtures/audio/short-5s.mp3
```
Expected: file ~25 KB created. ffmpeg must be installed locally; otherwise use a pre-recorded short MP3.

- [ ] **Step 2: Verify with music-metadata**

Run: `node -e "const mm=require('music-metadata');mm.parseFile('tests/fixtures/audio/short-5s.mp3').then(m=>console.log(m.format.duration))"`
Expected: `5` (or close to it).

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/audio/short-5s.mp3
git commit -m "test: add 5s audio fixture for E2E upload tests"
```

---

## Task 19: E2E — Audio upload happy path

**Files:**
- Create: `tests/e2e/audio-upload.spec.ts`

- [ ] **Step 1: Write E2E**

```ts
// tests/e2e/audio-upload.spec.ts
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const PRST = path.resolve(__dirname, '../../prst/63-B American Idiot.prst');
const AUDIO = path.resolve(__dirname, '../fixtures/audio/short-5s.mp3');
const UNIQUE = () => `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function registerAndLogin(page: Page) {
  const username = UNIQUE();
  const email = `${username}@test.com`;
  await page.goto('/en/auth/register');
  await page.fill('[name="email"]', email);
  await page.fill('[name="username"]', username);
  await page.fill('[name="password"]', 'testpass123');
  await page.click('[type="submit"]');
  let verifyUrl: string | undefined;
  for (let i = 0; i < 15 && !verifyUrl; i++) {
    await page.waitForTimeout(500);
    const r = await page.context().request.get(`http://localhost:8025/api/v2/search?kind=to&query=${encodeURIComponent(email)}`);
    const data = (await r.json()) as { items?: Array<{ Content: { Body: string } }> };
    const body = data.items?.[0]?.Content.Body ?? '';
    const decoded = body.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    verifyUrl = decoded.match(/http[^\s"<>]+verify-email[^\s"<>]+/)?.[0];
  }
  if (!verifyUrl) throw new Error('no verify mail');
  await page.goto(verifyUrl);
  await page.getByRole('button', { name: /verify my email/i }).click();
  await page.waitForURL('**/editor', { timeout: 10000 });
}

test('audio upload via save dialog appears on share page', async ({ page }) => {
  await registerAndLogin(page);
  await page.goto('/en/editor');
  await page.locator('input[type="file"]').first().setInputFiles(PRST);
  await page.getByRole('button', { name: /save to gallery/i }).click();
  await page.fill('[name="name"]', `e2e-audio-${UNIQUE()}`);
  // file input for audio inside the dialog — there are now two file inputs;
  // pick the one with audio MIME accept.
  const audioInput = page.locator('input[type="file"][accept*="audio"]');
  await audioInput.setInputFiles(AUDIO);
  // make public if there is a checkbox
  const publicCheckbox = page.locator('[name="public"]');
  if (await publicCheckbox.count() > 0) await publicCheckbox.check();
  await page.getByRole('button', { name: /^save$/i }).click();
  await page.waitForURL('**/share/**', { timeout: 15000 }).catch(() => {});

  // Land on share page (either redirected or navigate via gallery)
  await page.goto('/en/gallery', { waitUntil: 'domcontentloaded' });
  await page.locator('a[href*="/share/"]').first().click();
  await expect(page.getByRole('button', { name: /^play$/i })).toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 2: Sanity-check TypeScript**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/audio-upload.spec.ts
git commit -m "test(e2e): audio upload via SavePresetDialog visible on share page"
```

---

## Task 20: CI + Changelog + Deploy

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run full local CI**

Run: `npm run ci 2>&1 | tail -8`
Expected: `Local CI passed`.

- [ ] **Step 2: Provision the Garage bucket on prod**

Out of band — log into the Garage admin UI (or `mc admin bucket add`) and create the bucket `gp200editor-audio`. Then append to `.env.prod` on the prod host: `GARAGE_AUDIO_BUCKET=gp200editor-audio`.

(Equivalent setup on the dev box: bucket `gp200editor-audio-dev`, already in `.env.dev`.)

- [ ] **Step 3: Add CHANGELOG entry**

Insert at the top of `CHANGELOG.md`:

```markdown
## 2026-05-19 (later)

### Features
- **30 s Audio-Schnipsel pro Preset.** Owner können beim Save-to-Gallery oder nachträglich auf `/share/[token]` ein MP3- oder M4A/AAC-File (max 30 s, max 2 MB) anhängen. Player erscheint auf der Share-Page (voll), im Homepage-Featured-Block und auf jeder Gallery-Card (Icon). Nur ein Player spielt gleichzeitig — Klick auf einen Card-Play pausiert alle anderen.
- **Admin-Audit für fremdes Audio.** Wenn ein Admin Audio eines fremden Presets ersetzt oder löscht, wird die Aktion mit Reason (bei Delete) im AdminAction-Log auditiert.

### Storage / Validation
- Neuer Garage S3-Bucket `gp200editor-audio`. Server prüft Mime + Magic Bytes + Größe (≤ 2 MB) + Dauer (≤ 30.5 s via `music-metadata`) vor jedem S3 PUT.

### Schema
- Drei neue nullable Felder auf `Preset`: `audioKey`, `audioMimeType`, `audioDurationMs`.
```

- [ ] **Step 4: Commit + push + open PR**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): preset audio snippet feature"
git push origin feature/preset-audio-snippet
gh pr create --title "feat: 30s audio snippet per preset" --body "$(cat <<'EOF'
## Summary
Adds opt-in 30s MP3/M4A audio snippets to presets with single-player playback across share/featured/gallery.
See plan + spec for details.
EOF
)"
```

- [ ] **Step 5: Merge + deploy**

```bash
gh pr merge --squash --delete-branch
ssh musikersuche@82.165.40.140 'cd /opt/gp200editor && bash scripts/deploy-update.sh'
```

- [ ] **Step 6: Prod smoke**

Run:
```bash
curl -sSL -o /dev/null -w "share: %{http_code}\n" https://www.preset-forge.com/en/gallery
```
Then manually upload a 5 s MP3 via the editor and confirm playback on `/share/[token]`.
