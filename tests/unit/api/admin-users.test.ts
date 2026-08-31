import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findMany: vi.fn(), count: vi.fn() } },
}));
vi.mock('@/lib/admin', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin')>('@/lib/admin');
  return { ...actual, requireAdmin: vi.fn() };
});

import { GET } from '@/app/api/admin/users/route';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AdminForbiddenError } from '@/lib/admin';

const CREATED_AT = new Date('2026-04-13T19:53:00.000Z');

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    username: 'alice',
    email: 'alice@example.com',
    role: 'USER',
    suspended: false,
    emailVerified: true,
    createdAt: CREATED_AT,
    _count: { presets: 3 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'admin1' }, session: {} } as never);
  vi.mocked(prisma.user.count).mockResolvedValue(1 as never);
});

describe('GET /api/admin/users', () => {
  it('exposes the preset count as a flat presetCount field', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([dbUser()] as never);

    const res = await GET(new NextRequest('http://test/api/admin/users'), {} as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.users[0].presetCount).toBe(3);
  });

  it('does not leak the raw Prisma _count shape to the client', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([dbUser()] as never);

    const res = await GET(new NextRequest('http://test/api/admin/users'), {} as never);
    const data = await res.json();

    expect(data.users[0]._count).toBeUndefined();
  });

  it('reports the email verification state of each user', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      dbUser({ id: 'u1', emailVerified: true }),
      dbUser({ id: 'u2', username: 'bob', emailVerified: false, _count: { presets: 0 } }),
    ] as never);
    vi.mocked(prisma.user.count).mockResolvedValue(2 as never);

    const res = await GET(new NextRequest('http://test/api/admin/users'), {} as never);
    const data = await res.json();

    expect(data.users.map((u: { emailVerified: boolean }) => u.emailVerified)).toEqual([true, false]);
  });

  it('returns 403 for non-admin', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new AdminForbiddenError());
    const res = await GET(new NextRequest('http://test/api/admin/users'), {} as never);
    expect(res.status).toBe(403);
  });
});
