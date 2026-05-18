import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    preset: { findUnique: vi.fn() },
    comment: { create: vi.fn() },
  },
}));
vi.mock('@/lib/session', () => ({
  requireVerifiedUser: vi.fn(),
}));
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(() => true) }));
vi.mock('@/lib/rateLimit', () => ({ rateLimit: vi.fn(() => ({ allowed: true, remaining: 9 })) }));

import { POST } from '@/app/api/presets/[id]/comments/route';
import { prisma } from '@/lib/prisma';
import { requireVerifiedUser } from '@/lib/session';

function makeRequest(body: unknown, headers: Record<string,string> = {}) {
  return new NextRequest('http://test/api/presets/p1/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://test', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(requireVerifiedUser).mockResolvedValue({ user: { id: 'u1' } as never, session: {} as never });
  vi.mocked(prisma.preset.findUnique).mockResolvedValue({ id: 'p1', public: true } as never);
});

describe('POST /api/presets/[id]/comments', () => {
  it('creates top-level comment for verified user', async () => {
    vi.mocked(prisma.comment.create).mockResolvedValue({ id: 'c1', body: 'hi' } as never);
    const res = await POST(makeRequest({ body: 'hi' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    expect(prisma.comment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ presetId: 'p1', userId: 'u1', body: 'hi', parentId: null }),
    }));
  });

  it('rejects empty body', async () => {
    const res = await POST(makeRequest({ body: '   ' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
  });

  it('rejects body > 1000 chars', async () => {
    const res = await POST(makeRequest({ body: 'x'.repeat(1001) }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireVerifiedUser).mockResolvedValue({ error: new Response(null, { status: 401 }) } as never);
    const res = await POST(makeRequest({ body: 'hi' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 403 on CSRF fail', async () => {
    const { verifyCsrf } = await import('@/lib/csrf');
    vi.mocked(verifyCsrf).mockReturnValueOnce(false);
    const res = await POST(makeRequest({ body: 'hi' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-public preset', async () => {
    vi.mocked(prisma.preset.findUnique).mockResolvedValue({ id: 'p1', public: false } as never);
    const res = await POST(makeRequest({ body: 'hi' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 429 when rate-limited', async () => {
    const { rateLimit } = await import('@/lib/rateLimit');
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0 });
    const res = await POST(makeRequest({ body: 'hi' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(429);
  });
});
