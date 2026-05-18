// @vitest-environment node
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
