import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    feedback: { findMany: vi.fn(), groupBy: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock('@/lib/admin', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin')>('@/lib/admin');
  return { ...actual, requireAdmin: vi.fn() };
});
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(() => true) }));

import { GET } from '@/app/api/admin/feedback/route';
import { PATCH } from '@/app/api/admin/feedback/[id]/route';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AdminForbiddenError } from '@/lib/admin';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'a1' }, session: {} } as never);
  vi.mocked(prisma.feedback.findMany).mockResolvedValue([
    { id: 'f1', category: 'BUG', message: 'x'.repeat(20), status: 'NEW', user: { id: 'u1', username: 'alice' } },
  ] as never);
  vi.mocked(prisma.feedback.groupBy).mockResolvedValue([{ status: 'NEW', _count: { _all: 1 } }] as never);
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/admin/feedback', () => {
  it('lists feedback with status counts for admins', async () => {
    const res = await GET(new NextRequest('http://test/api/admin/feedback'), {} as never);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.feedback).toHaveLength(1);
    expect(data.counts).toEqual({ NEW: 1, READ: 0, DONE: 0 });
  });

  it('filters by status and category', async () => {
    await GET(new NextRequest('http://test/api/admin/feedback?status=NEW&category=BUG'), {} as never);
    expect(prisma.feedback.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'NEW', category: 'BUG' },
    }));
  });

  it('ignores invalid filter values', async () => {
    await GET(new NextRequest('http://test/api/admin/feedback?status=nope&category=x'), {} as never);
    expect(prisma.feedback.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('returns 403 for non-admins', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new AdminForbiddenError());
    const res = await GET(new NextRequest('http://test/api/admin/feedback'), {} as never);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/admin/feedback/[id]', () => {
  function patch(body: unknown) {
    return new NextRequest('http://test/api/admin/feedback/f1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', origin: 'http://test' },
      body: JSON.stringify(body),
    });
  }

  it('updates the status', async () => {
    vi.mocked(prisma.feedback.findUnique).mockResolvedValue({ id: 'f1' } as never);
    vi.mocked(prisma.feedback.update).mockResolvedValue({ id: 'f1', status: 'DONE' } as never);
    const res = await PATCH(patch({ status: 'DONE' }), ctx('f1'));
    expect(res.status).toBe(200);
    expect(prisma.feedback.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'f1' }, data: { status: 'DONE' },
    }));
  });

  it('rejects an invalid status', async () => {
    const res = await PATCH(patch({ status: 'ARCHIVED' }), ctx('f1'));
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown feedback', async () => {
    vi.mocked(prisma.feedback.findUnique).mockResolvedValue(null);
    const res = await PATCH(patch({ status: 'READ' }), ctx('nope'));
    expect(res.status).toBe(404);
  });

  it('returns 403 for non-admins', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new AdminForbiddenError());
    const res = await PATCH(patch({ status: 'READ' }), ctx('f1'));
    expect(res.status).toBe(403);
  });
});
