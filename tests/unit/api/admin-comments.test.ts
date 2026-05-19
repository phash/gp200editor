import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { comment: { findMany: vi.fn() } },
}));
vi.mock('@/lib/admin', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin')>('@/lib/admin');
  return { ...actual, requireAdmin: vi.fn() };
});

import { GET } from '@/app/api/admin/comments/route';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AdminForbiddenError } from '@/lib/admin';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/admin/comments', () => {
  it('returns recent comments for admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'a1' }, session: {} } as never);
    vi.mocked(prisma.comment.findMany).mockResolvedValue([
      { id: 'c1', body: 'hi', user: { username: 'X' }, preset: { name: 'P1', shareToken: 't1' } },
    ] as never);
    const res = await GET(new NextRequest('http://test/api/admin/comments'), {} as never);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.comments).toHaveLength(1);
  });

  it('returns 403 for non-admin', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new AdminForbiddenError());
    const res = await GET(new NextRequest('http://test/api/admin/comments'), {} as never);
    expect(res.status).toBe(403);
  });
});
