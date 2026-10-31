import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { count: vi.fn(async () => 5) },
    preset: { count: vi.fn(async () => 7) },
    errorLog: { count: vi.fn(async () => 1) },
    feedback: { count: vi.fn(async () => 3) },
  },
}));
vi.mock('@/lib/admin', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin')>('@/lib/admin');
  return { ...actual, requireAdmin: vi.fn() };
});

import { GET } from '@/app/api/admin/stats/route';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

beforeEach(() => {
  vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'a1' }, session: {} } as never);
});

describe('GET /api/admin/stats', () => {
  it('reports the number of new (unread) feedback entries', async () => {
    const res = await GET(new NextRequest('http://test/api/admin/stats'), {} as never);
    const data = await res.json();
    expect(data.newFeedback).toBe(3);
    expect(prisma.feedback.count).toHaveBeenCalledWith({ where: { status: 'NEW' } });
  });
});
