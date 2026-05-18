import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    comment: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    adminAction: { create: vi.fn() },
  },
}));
vi.mock('@/lib/session', () => ({ validateSession: vi.fn() }));
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(() => true) }));

import { DELETE } from '@/app/api/comments/[id]/route';
import { prisma } from '@/lib/prisma';
import { validateSession } from '@/lib/session';

function req(body?: unknown) {
  return new NextRequest('http://test/api/comments/c1', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', origin: 'http://test' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => vi.clearAllMocks());

describe('DELETE /api/comments/[id]', () => {
  it('author soft-deletes own comment', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'u1', role: 'USER' }, session: {} } as never);
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: null } as never);
    vi.mocked(prisma.comment.update).mockResolvedValue({ id: 'c1' } as never);
    const res = await DELETE(req(), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(200);
    expect(prisma.comment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deletedAt: expect.any(Date), deletedBy: 'AUTHOR', body: null }),
    }));
  });

  it('returns 403 when non-author non-admin tries to delete', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'u2', role: 'USER' }, session: {} } as never);
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: null } as never);
    const res = await DELETE(req(), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(403);
  });

  it('admin hard-deletes with reason and logs AdminAction', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' }, session: {} } as never);
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: null } as never);
    vi.mocked(prisma.comment.count).mockResolvedValue(2);
    vi.mocked(prisma.comment.delete).mockResolvedValue({ id: 'c1' } as never);
    const res = await DELETE(req({ reason: 'spam content removed' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(200);
    expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(prisma.adminAction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        adminId: 'admin1', action: 'DELETE_COMMENT', targetType: 'comment', targetId: 'c1',
        reason: 'spam content removed',
      }),
    }));
  });

  it('admin hard-delete requires reason ≥ 5 chars', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' }, session: {} } as never);
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: null } as never);
    const res = await DELETE(req({ reason: 'hi' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when comment not found', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: { id: 'u1', role: 'USER' }, session: {} } as never);
    vi.mocked(prisma.comment.findUnique).mockResolvedValue(null);
    const res = await DELETE(req(), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(validateSession).mockResolvedValue({ user: null, session: null });
    const res = await DELETE(req(), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(401);
  });
});
