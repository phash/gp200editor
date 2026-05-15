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
import { prisma } from '@/lib/prisma';
import { sendVerifyReminderEmail } from '@/lib/email';

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

describe('cron verify-reminders — D2 pass', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value';
    vi.mocked(prisma.user.findMany).mockReset().mockResolvedValue([]);
    vi.mocked(prisma.user.updateMany).mockReset().mockResolvedValue({ count: 1 });
    vi.mocked(prisma.user.update).mockReset().mockResolvedValue({} as never);
    vi.mocked(prisma.emailVerificationToken.create).mockReset().mockResolvedValue({} as never);
    vi.mocked(sendVerifyReminderEmail).mockReset().mockResolvedValue();
  });

  it('queries D2 candidates with the correct filter', async () => {
    await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    const findMany = vi.mocked(prisma.user.findMany);
    expect(findMany).toHaveBeenCalled();
    const firstCallArgs = findMany.mock.calls[0]![0]!;
    expect(firstCallArgs.where).toMatchObject({
      emailVerified: false,
      welcomeReminderD2SentAt: null,
    });
    const createdAt = firstCallArgs.where!.createdAt as { lt: Date };
    expect(createdAt.lt).toBeInstanceOf(Date);
    expect(firstCallArgs.take).toBe(200);
  });

  it('sends D2 reminder for each candidate that wins the claim', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'u1', email: 'a@b.de', locale: 'de', username: 'alice' },
      { id: 'u2', email: 'c@d.de', locale: 'en', username: 'bob' },
    ] as never).mockResolvedValueOnce([]);

    const res = await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    const json = await res.json();
    expect(json.d2.sent).toBe(2);
    expect(sendVerifyReminderEmail).toHaveBeenCalledTimes(2);
    // First call: alice in DE, day=2
    const firstCall = vi.mocked(sendVerifyReminderEmail).mock.calls[0]!;
    expect(firstCall[0]).toBe('a@b.de');     // to
    expect(firstCall[2]).toBe('de');          // locale
    expect(firstCall[3]).toBe(2);             // day
  });

  it('skips candidates lost to race claim', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'u1', email: 'a@b.de', locale: 'de', username: 'alice' },
    ] as never).mockResolvedValueOnce([]);
    vi.mocked(prisma.user.updateMany).mockResolvedValueOnce({ count: 0 });

    const res = await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    const json = await res.json();
    expect(json.d2.sent).toBe(0);
    expect(json.d2.skippedByRace).toBe(1);
    expect(sendVerifyReminderEmail).not.toHaveBeenCalled();
  });

  it('rolls back the timestamp when send fails', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'u1', email: 'a@b.de', locale: 'de', username: 'alice' },
    ] as never).mockResolvedValueOnce([]);
    vi.mocked(sendVerifyReminderEmail).mockRejectedValueOnce(new Error('SMTP down'));

    const res = await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    const json = await res.json();
    expect(json.d2.failed).toBe(1);
    expect(json.d2.sent).toBe(0);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { welcomeReminderD2SentAt: null },
    });
  });
});

describe('cron verify-reminders — D7 pass', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value';
    vi.mocked(prisma.user.findMany).mockReset().mockResolvedValue([]);
    vi.mocked(prisma.user.updateMany).mockReset().mockResolvedValue({ count: 1 });
    vi.mocked(prisma.emailVerificationToken.create).mockReset().mockResolvedValue({} as never);
    vi.mocked(sendVerifyReminderEmail).mockReset().mockResolvedValue();
  });

  it('queries D7 candidates after D2 query', async () => {
    await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    const findMany = vi.mocked(prisma.user.findMany);
    expect(findMany).toHaveBeenCalledTimes(2);
    const d7Args = findMany.mock.calls[1]![0]!;
    expect(d7Args.where).toMatchObject({
      emailVerified: false,
      welcomeReminderD7SentAt: null,
    });
  });

  it('sends D7 reminder for D7 candidates', async () => {
    vi.mocked(prisma.user.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'u3', email: 'e@f.de', locale: 'fr', username: 'cleo' },
      ] as never);

    const res = await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    const json = await res.json();
    expect(json.d7.sent).toBe(1);
    expect(sendVerifyReminderEmail).toHaveBeenCalledWith(
      'e@f.de',
      expect.stringMatching(/auth\/verify-email\?token=/),
      'fr',
      7,
    );
  });
});
