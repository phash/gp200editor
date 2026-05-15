import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    emailVerificationToken: { create: vi.fn().mockResolvedValue({} as never) },
  },
}));
vi.mock('@/lib/email', () => ({ sendVerifyReminderEmail: vi.fn() }));
vi.mock('@/lib/errorLog', () => ({ logError: vi.fn().mockResolvedValue(undefined) }));

import { POST } from '@/app/api/cron/verify-reminders/route';

function makeReq(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/cron/verify-reminders', {
    method: 'POST',
    headers,
  }) as unknown as Parameters<typeof POST>[0];
}

describe('cron verify-reminders — auth guard', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value';
  });

  it('returns 401 when Authorization header missing', async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns 401 when bearer is wrong', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer wrong' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET env is unset', async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(makeReq({ authorization: 'Bearer anything' }));
    expect(res.status).toBe(401);
  });

  it('returns 200 with correct bearer', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    expect(res.status).toBe(200);
  });

  it('returns counts payload on 200', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    const json = await res.json();
    expect(json).toEqual({
      d2: { sent: 0, failed: 0, skippedByRace: 0 },
      d7: { sent: 0, failed: 0, skippedByRace: 0 },
    });
  });
});
