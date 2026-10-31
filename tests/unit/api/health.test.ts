import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: { $queryRaw: vi.fn() },
}));
vi.mock('@/lib/storage', () => ({
  pingStorage: vi.fn(),
}));

import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/prisma';
import { pingStorage } from '@/lib/storage';

beforeEach(() => {
  vi.mocked(prisma.$queryRaw).mockReset().mockResolvedValue([{ '?column?': 1 }] as never);
  vi.mocked(pingStorage).mockReset().mockResolvedValue(undefined);
});

describe('GET /api/health', () => {
  it('returns 200 with every check ok when database and storage answer', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.checks.database.ok).toBe(true);
    expect(data.checks.storage.ok).toBe(true);
    expect(typeof data.checks.database.ms).toBe('number');
  });

  it('is never cached — a stale 200 would hide an outage', async () => {
    const res = await GET();
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('returns 503 when the database is down', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const res = await GET();
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.status).toBe('error');
    expect(data.checks.database.ok).toBe(false);
    expect(data.checks.storage.ok).toBe(true);
  });

  it('returns 503 when storage is down', async () => {
    vi.mocked(pingStorage).mockRejectedValue(new Error('NoSuchBucket'));
    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).checks.storage.ok).toBe(false);
  });

  it('does not leak internal error details to the public', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const body = await (await GET()).text();
    expect(body).not.toContain('10.0.0.5');
    expect(body).not.toContain('ECONNREFUSED');
  });

  it('fails a check that hangs instead of hanging itself', async () => {
    vi.useFakeTimers();
    vi.mocked(pingStorage).mockReturnValue(new Promise(() => {}));
    const pending = GET();
    await vi.advanceTimersByTimeAsync(5000);
    const res = await pending;
    vi.useRealTimers();
    expect(res.status).toBe(503);
    expect((await res.json()).checks.storage.ok).toBe(false);
  });
});
