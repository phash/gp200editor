import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: { comment: { findMany: vi.fn() } },
}));

import { GET } from '@/app/api/presets/[id]/comments/route';
import { prisma } from '@/lib/prisma';

beforeEach(() => { vi.clearAllMocks(); });

function makeReq(url = 'http://test/api/presets/p1/comments') {
  return new NextRequest(url);
}

const userStub = { id: 'u', username: 'alice', avatarKey: null };

describe('GET /api/presets/[id]/comments', () => {
  it('returns top-level comments with replies', async () => {
    vi.mocked(prisma.comment.findMany).mockResolvedValue([
      { id: 'c1', body: 'hi', deletedAt: null, replies: [{ id: 'r1', body: 'reply', deletedAt: null, user: userStub }], user: userStub },
    ] as never);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'p1' }) });
    const data = await res.json();
    expect(data.comments).toHaveLength(1);
    expect(data.comments[0].replies).toHaveLength(1);
  });

  it('strips body of soft-deleted comments', async () => {
    vi.mocked(prisma.comment.findMany).mockResolvedValue([
      { id: 'c1', body: 'should-be-stripped', deletedAt: new Date(), deletedBy: 'AUTHOR', replies: [], user: userStub },
    ] as never);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'p1' }) });
    const data = await res.json();
    expect(data.comments[0].body).toBeNull();
    expect(data.comments[0].deletedBy).toBe('AUTHOR');
  });

  it('returns nextCursor when hasMore', async () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      id: `c${i}`, body: 'x', deletedAt: null, replies: [], user: userStub,
    }));
    vi.mocked(prisma.comment.findMany).mockResolvedValue(items as never);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'p1' }) });
    const data = await res.json();
    expect(data.comments).toHaveLength(20);
    expect(data.nextCursor).toBe('c19');
  });

  it('returns null cursor when no more', async () => {
    vi.mocked(prisma.comment.findMany).mockResolvedValue([
      { id: 'c1', body: 'hi', deletedAt: null, replies: [], user: userStub },
    ] as never);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'p1' }) });
    const data = await res.json();
    expect(data.nextCursor).toBeNull();
  });
});
