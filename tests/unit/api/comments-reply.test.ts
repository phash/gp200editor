import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { comment: { findUnique: vi.fn(), create: vi.fn() } },
}));
vi.mock('@/lib/session', () => ({
  requireVerifiedUser: vi.fn(() => Promise.resolve({ user: { id: 'u1' }, session: {} })),
}));
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(() => true) }));
vi.mock('@/lib/rateLimit', () => ({ rateLimit: vi.fn(() => ({ allowed: true, remaining: 9 })) }));

import { POST } from '@/app/api/comments/[id]/reply/route';
import { prisma } from '@/lib/prisma';

function req(body: unknown) {
  return new NextRequest('http://test/api/comments/c1/reply', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://test' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/comments/[id]/reply', () => {
  it('creates reply to top-level comment', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', parentId: null, presetId: 'p1' } as never);
    vi.mocked(prisma.comment.create).mockResolvedValue({ id: 'r1' } as never);
    const res = await POST(req({ body: 'reply text' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(200);
    expect(prisma.comment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ parentId: 'c1', presetId: 'p1', userId: 'u1', body: 'reply text' }),
    }));
  });

  it('rejects reply to reply (400)', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', parentId: 'c0', presetId: 'p1' } as never);
    const res = await POST(req({ body: 'x' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(400);
  });

  it('allows reply to soft-deleted parent', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue({ id: 'c1', parentId: null, presetId: 'p1', deletedAt: new Date() } as never);
    vi.mocked(prisma.comment.create).mockResolvedValue({ id: 'r1' } as never);
    const res = await POST(req({ body: 'x' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(200);
  });

  it('returns 404 when parent missing', async () => {
    vi.mocked(prisma.comment.findUnique).mockResolvedValue(null);
    const res = await POST(req({ body: 'x' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(404);
  });

  it('shares rate-limit bucket with top-level create', async () => {
    const { rateLimit } = await import('@/lib/rateLimit');
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0 });
    const res = await POST(req({ body: 'x' }), { params: Promise.resolve({ id: 'c1' }) });
    expect(res.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith('comment-create:u1', 10, 3600000);
  });
});
