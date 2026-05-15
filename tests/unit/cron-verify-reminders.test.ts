import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    emailVerificationToken: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({} as never),
    },
  },
}));
vi.mock('@/lib/email', () => ({ sendVerifyReminderEmail: vi.fn() }));
vi.mock('@/lib/errorLog', () => ({ logError: vi.fn().mockResolvedValue(undefined) }));
// rateLimit is module-scoped (in-memory map). Mock it so each test controls
// the gate cleanly without state bleeding between tests.
vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 5 }),
}));

import { POST } from '@/app/api/cron/verify-reminders/route';
import { prisma } from '@/lib/prisma';
import { sendVerifyReminderEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rateLimit';

function makeReq(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/cron/verify-reminders', {
    method: 'POST',
    headers,
  }) as unknown as Parameters<typeof POST>[0];
}

describe('cron verify-reminders — auth guard', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value';
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 5 });
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
    vi.mocked(rateLimit).mockReset().mockReturnValue({ allowed: true, remaining: 5 });
    vi.mocked(prisma.user.findMany).mockReset().mockResolvedValue([]);
    vi.mocked(prisma.user.updateMany).mockReset().mockResolvedValue({ count: 1 });
    vi.mocked(prisma.user.update).mockReset().mockResolvedValue({} as never);
    vi.mocked(prisma.emailVerificationToken.deleteMany).mockReset().mockResolvedValue({ count: 0 });
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
    vi.mocked(rateLimit).mockReset().mockReturnValue({ allowed: true, remaining: 5 });
    vi.mocked(prisma.user.findMany).mockReset().mockResolvedValue([]);
    vi.mocked(prisma.user.updateMany).mockReset().mockResolvedValue({ count: 1 });
    vi.mocked(prisma.emailVerificationToken.deleteMany).mockReset().mockResolvedValue({ count: 0 });
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

describe('cron verify-reminders — rate limit', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value';
    vi.mocked(prisma.user.findMany).mockReset().mockResolvedValue([]);
    vi.mocked(prisma.user.updateMany).mockReset().mockResolvedValue({ count: 1 });
    vi.mocked(sendVerifyReminderEmail).mockReset().mockResolvedValue();
    vi.mocked(rateLimit).mockReset();
  });

  it('returns 429 when rateLimit denies the request', async () => {
    vi.mocked(rateLimit).mockReturnValue({ allowed: false, remaining: 0 });
    const res = await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json).toEqual({ error: 'rate-limited' });
    // No DB work should have happened
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('invokes rateLimit with the cron-verify-reminders key and 6/min budget', async () => {
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 5 });
    await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    expect(rateLimit).toHaveBeenCalledWith(
      expect.stringMatching(/^cron-verify-reminders:/),
      6,
      60 * 1000,
    );
  });
});

describe('cron verify-reminders — single-flight', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value';
    vi.mocked(rateLimit).mockReset().mockReturnValue({ allowed: true, remaining: 5 });
    vi.mocked(prisma.user.findMany).mockReset().mockResolvedValue([]);
    vi.mocked(prisma.user.updateMany).mockReset().mockResolvedValue({ count: 1 });
    vi.mocked(sendVerifyReminderEmail).mockReset().mockResolvedValue();
  });

  it('returns 409 when another invocation is in-flight', async () => {
    // Hold the first findMany unresolved → first POST stays inside the
    // try block with cronInFlight=true. The second POST then short-circuits
    // with 409.
    let firstResolve: (value: unknown[]) => void = () => {};
    vi.mocked(prisma.user.findMany).mockReturnValueOnce(
      new Promise((res) => {
        firstResolve = res;
      }) as never,
    );
    const first = POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    // Yield once so `first` enters runReminderPass before we issue `second`
    await Promise.resolve();
    const second = await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    expect(second.status).toBe(409);
    const json = await second.json();
    expect(json).toEqual({ error: 'in-flight' });
    // Release the first call so the flag clears for downstream tests
    firstResolve([]);
    await first;
  });
});

describe('cron verify-reminders — locale validation', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value';
    vi.mocked(rateLimit).mockReset().mockReturnValue({ allowed: true, remaining: 5 });
    vi.mocked(prisma.user.findMany).mockReset().mockResolvedValue([]);
    vi.mocked(prisma.user.updateMany).mockReset().mockResolvedValue({ count: 1 });
    vi.mocked(prisma.user.update).mockReset().mockResolvedValue({} as never);
    vi.mocked(prisma.emailVerificationToken.deleteMany).mockReset().mockResolvedValue({ count: 0 });
    vi.mocked(prisma.emailVerificationToken.create).mockReset().mockResolvedValue({} as never);
    vi.mocked(sendVerifyReminderEmail).mockReset().mockResolvedValue();
  });

  it('falls back to "en" when user locale is not in LOCALES', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 'u1', email: 'a@b.de', locale: 'xx', username: 'mallory' },
    ] as never).mockResolvedValueOnce([]);

    await POST(makeReq({ authorization: 'Bearer test-secret-value' }));
    const call = vi.mocked(sendVerifyReminderEmail).mock.calls[0]!;
    expect(call[2]).toBe('en');
    // verifyUrl must also use 'en'
    expect(call[1]).toMatch(/\/en\/auth\/verify-email/);
  });
});
