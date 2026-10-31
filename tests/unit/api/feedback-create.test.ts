import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    feedback: { create: vi.fn(), findFirst: vi.fn() },
  },
}));
vi.mock('@/lib/session', () => ({ requireVerifiedUser: vi.fn() }));
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(() => true) }));
vi.mock('@/lib/rateLimit', () => ({ rateLimit: vi.fn(() => ({ allowed: true, remaining: 2 })) }));
vi.mock('@/lib/criticalErrorEmail', () => ({ sendFeedbackEmail: vi.fn(() => Promise.resolve()) }));

import { POST } from '@/app/api/feedback/route';
import { prisma } from '@/lib/prisma';
import { requireVerifiedUser } from '@/lib/session';
import { verifyCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rateLimit';
import { sendFeedbackEmail } from '@/lib/criticalErrorEmail';

const VALID = { category: 'BUG', message: 'The editor does not detect my GP-200 on Linux.', pagePath: '/editor', locale: 'de' };

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://test/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://test', 'user-agent': 'TestAgent/1.0', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyCsrf).mockReturnValue(true);
  vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 2 });
  vi.mocked(requireVerifiedUser).mockResolvedValue({
    user: { id: 'u1', username: 'alice', email: 'a@example.com' } as never,
    session: {} as never,
  });
  vi.mocked(prisma.feedback.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.feedback.create).mockResolvedValue({ id: 'f1' } as never);
});

describe('POST /api/feedback', () => {
  it('stores feedback of a verified user with context', async () => {
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(201);
    expect(prisma.feedback.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'u1',
        category: 'BUG',
        message: VALID.message,
        pagePath: '/editor',
        locale: 'de',
        userAgent: 'TestAgent/1.0',
      }),
    }));
  });

  it('notifies the admin by mail', async () => {
    await POST(makeRequest(VALID));
    expect(sendFeedbackEmail).toHaveBeenCalledWith(expect.objectContaining({
      id: 'f1', category: 'BUG', username: 'alice', message: VALID.message,
    }));
  });

  it('still succeeds when the admin mail fails', async () => {
    vi.mocked(sendFeedbackEmail).mockRejectedValueOnce(new Error('smtp down'));
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(201);
  });

  it('returns 403 on CSRF failure without touching the session', async () => {
    vi.mocked(verifyCsrf).mockReturnValueOnce(false);
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(403);
    expect(requireVerifiedUser).not.toHaveBeenCalled();
  });

  it('returns 401 for anonymous users', async () => {
    vi.mocked(requireVerifiedUser).mockResolvedValue({ error: new Response(null, { status: 401 }) } as never);
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(401);
    expect(prisma.feedback.create).not.toHaveBeenCalled();
  });

  it('returns 403 for unverified users', async () => {
    vi.mocked(requireVerifiedUser).mockResolvedValue({ error: new Response(null, { status: 403 }) } as never);
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(403);
    expect(prisma.feedback.create).not.toHaveBeenCalled();
  });

  it('returns 429 when the per-user rate limit is hit', async () => {
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0 });
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(429);
    expect(prisma.feedback.create).not.toHaveBeenCalled();
  });

  it('checks both an hourly and a daily limit keyed by user', async () => {
    await POST(makeRequest(VALID));
    const keys = vi.mocked(rateLimit).mock.calls.map((c) => c[0]);
    expect(keys).toEqual(expect.arrayContaining(['feedback-hour:u1', 'feedback-day:u1']));
  });

  it('silently accepts but drops honeypot submissions', async () => {
    const res = await POST(makeRequest({ ...VALID, company_url: 'http://spam.example' }));
    expect(res.status).toBe(201);
    expect(prisma.feedback.create).not.toHaveBeenCalled();
    expect(sendFeedbackEmail).not.toHaveBeenCalled();
  });

  it('rejects an unknown category', async () => {
    const res = await POST(makeRequest({ ...VALID, category: 'SPAM' }));
    expect(res.status).toBe(400);
  });

  it('rejects too short messages', async () => {
    const res = await POST(makeRequest({ ...VALID, message: '   short  ' }));
    expect(res.status).toBe(400);
  });

  it('rejects messages over 2000 chars', async () => {
    const res = await POST(makeRequest({ ...VALID, message: 'x'.repeat(2001) }));
    expect(res.status).toBe(400);
  });

  it('rejects invalid JSON', async () => {
    const req = new NextRequest('http://test/api/feedback', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://test' }, body: '{nope',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate of the same message within 24h', async () => {
    vi.mocked(prisma.feedback.findFirst).mockResolvedValueOnce({ id: 'old' } as never);
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(409);
    expect(prisma.feedback.create).not.toHaveBeenCalled();
  });

  it('drops a pagePath that is not a same-origin path', async () => {
    await POST(makeRequest({ ...VALID, pagePath: 'https://evil.example/x' }));
    expect(prisma.feedback.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pagePath: null }),
    }));
  });

  it('falls back to en for an unknown locale', async () => {
    await POST(makeRequest({ ...VALID, locale: 'xx' }));
    expect(prisma.feedback.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ locale: 'en' }),
    }));
  });

  it('truncates very long user agents', async () => {
    await POST(makeRequest(VALID, { 'user-agent': 'A'.repeat(1000) }));
    const data = vi.mocked(prisma.feedback.create).mock.calls[0][0].data as { userAgent: string };
    expect(data.userAgent.length).toBe(400);
  });
});
