import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { comment: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock('@/lib/session', () => ({
  requireVerifiedUser: vi.fn(() => Promise.resolve({ user: { id: 'u1' }, session: {} })),
}));
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(() => true) }));
vi.mock('@/lib/rateLimit', () => ({ rateLimit: vi.fn(() => ({ allowed: true, remaining: 29 })) }));

import { PATCH } from '@/app/api/comments/[id]/route';
import { prisma } from '@/lib/prisma';

function req(body: unknown) {
  return new NextRequest('http://test/api/comments/c1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', origin: 'http://test' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/comments/[id]', () => {
  it('updates body and sets editedAt for author', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: null } as never);
    vi.mocked(prisma.comment.update).mockResolvedValue({ id: 'c1', body: 'new', editedAt: new Date(), user: { id: 'u1', username: 'a', avatarKey: null } } as never);
    const res = await PATCH(req({ body: 'new' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(200);
    expect(prisma.comment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ body: 'new', editedAt: expect.any(Date) }),
    }));
  });

  it('returns 403 when not author', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u2', deletedAt: null } as never);
    const res = await PATCH(req({ body: 'new' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(403);
  });

  it('returns 409 when comment soft-deleted', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: new Date() } as never);
    const res = await PATCH(req({ body: 'new' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(409);
  });

  it('rejects empty body', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: null } as never);
    const res = await PATCH(req({ body: '   ' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(400);
  });

  it('uses comment-edit rate-limit bucket', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', userId: 'u1', deletedAt: null } as never);
    const { rateLimit } = await import('@/lib/rateLimit');
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0 });
    const res = await PATCH(req({ body: 'x' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith('comment-edit:u1', 30, 3600000);
  });
});
