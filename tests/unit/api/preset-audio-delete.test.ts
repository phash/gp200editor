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
vi.mock('@/lib/storage', () => ({ deleteAudio: vi.fn(() => Promise.resolve()) }));

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
