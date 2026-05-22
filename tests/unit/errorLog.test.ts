import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() escapes the TDZ trap: vi.mock() factories are hoisted above
// imports, but consts declared at module-top are not. Using hoisted() puts the
// mock variables in the same hoisted scope as the mock factory.
const { prismaMock, emailMock } = vi.hoisted(() => ({
  prismaMock: {
    errorLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  emailMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/criticalErrorEmail', () => ({ sendCriticalErrorEmail: emailMock }));

import { logError, computeFingerprint } from '@/lib/errorLog';

beforeEach(() => {
  prismaMock.errorLog.findFirst.mockReset();
  prismaMock.errorLog.create.mockReset();
  prismaMock.errorLog.update.mockReset();
  emailMock.mockReset();
  emailMock.mockResolvedValue(undefined);
});

describe('computeFingerprint', () => {
  it('is stable for the same category+message', () => {
    const a = computeFingerprint('api', 'Boom');
    const b = computeFingerprint('api', 'Boom');
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it('differs when category changes', () => {
    expect(computeFingerprint('api', 'Boom')).not.toBe(computeFingerprint('client', 'Boom'));
  });

  it('differs when message changes', () => {
    expect(computeFingerprint('api', 'Boom')).not.toBe(computeFingerprint('api', 'Boom2'));
  });
});

describe('logError - create vs update', () => {
  it('creates a new row when no existing fingerprint matches', async () => {
    prismaMock.errorLog.findFirst.mockResolvedValue(null);
    prismaMock.errorLog.create.mockResolvedValue({ id: 'new-id', count: 1, lastEmailedAt: null });

    await logError({ message: 'Fresh error', category: 'api' });

    expect(prismaMock.errorLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.errorLog.update).not.toHaveBeenCalled();
    const created = prismaMock.errorLog.create.mock.calls[0][0].data;
    expect(created.fingerprint).toBe(computeFingerprint('api', 'Fresh error'));
    expect(created.severity).toBe('error');
    expect(created.category).toBe('api');
  });

  it('increments count on existing unresolved row instead of inserting', async () => {
    prismaMock.errorLog.findFirst.mockResolvedValue({
      id: 'existing-id',
      count: 5,
      lastEmailedAt: null,
      stack: 'old stack',
      route: '/old',
      method: 'GET',
      url: null,
      userId: null,
      ip: null,
    });
    prismaMock.errorLog.update.mockResolvedValue({ id: 'existing-id', count: 6, lastEmailedAt: null });

    await logError({ message: 'Recurring', category: 'api', stack: 'new stack', route: '/new' });

    expect(prismaMock.errorLog.create).not.toHaveBeenCalled();
    expect(prismaMock.errorLog.update).toHaveBeenCalledTimes(1);
    const updateArgs = prismaMock.errorLog.update.mock.calls[0][0];
    expect(updateArgs.where.id).toBe('existing-id');
    expect(updateArgs.data.count).toEqual({ increment: 1 });
    // contextual fields should be refreshed to the latest occurrence
    expect(updateArgs.data.stack).toBe('new stack');
    expect(updateArgs.data.route).toBe('/new');
  });

  it('maps legacy level=warn → severity=warning', async () => {
    prismaMock.errorLog.findFirst.mockResolvedValue(null);
    prismaMock.errorLog.create.mockResolvedValue({ id: 'w', count: 1, lastEmailedAt: null });

    await logError({ message: 'Soft fail', level: 'warn' });

    expect(prismaMock.errorLog.create.mock.calls[0][0].data.severity).toBe('warning');
  });

  it('returns null without throwing when the DB call rejects', async () => {
    prismaMock.errorLog.findFirst.mockRejectedValue(new Error('db down'));

    const result = await logError({ message: 'never persists' });

    expect(result).toBeNull();
  });
});

describe('logError - critical email trigger', () => {
  it('sends a mail on first critical occurrence and claims the throttle slot', async () => {
    prismaMock.errorLog.findFirst.mockResolvedValue(null);
    prismaMock.errorLog.create.mockResolvedValue({ id: 'crit-id', count: 1, lastEmailedAt: null });
    // second update call is the lastEmailedAt claim
    prismaMock.errorLog.update.mockResolvedValue({ id: 'crit-id' });

    await logError({ message: 'CRITICAL', category: 'api', severity: 'critical' });

    expect(emailMock).toHaveBeenCalledTimes(1);
    // lastEmailedAt claim happens BEFORE the send so concurrent triggers don't double-send
    expect(prismaMock.errorLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'crit-id' },
        data: expect.objectContaining({ lastEmailedAt: expect.any(Date) }),
      }),
    );
  });

  it('suppresses mail when lastEmailedAt is within the 1h throttle window', async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    prismaMock.errorLog.findFirst.mockResolvedValue({
      id: 'crit-id',
      count: 10,
      lastEmailedAt: fiveMinAgo,
      stack: null, route: null, method: null, url: null, userId: null, ip: null,
    });
    prismaMock.errorLog.update.mockResolvedValue({ id: 'crit-id', count: 11, lastEmailedAt: fiveMinAgo });

    await logError({ message: 'CRITICAL', category: 'api', severity: 'critical' });

    expect(emailMock).not.toHaveBeenCalled();
  });

  it('resends mail when the throttle window has elapsed', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    prismaMock.errorLog.findFirst.mockResolvedValue({
      id: 'crit-id',
      count: 50,
      lastEmailedAt: twoHoursAgo,
      stack: null, route: null, method: null, url: null, userId: null, ip: null,
    });
    prismaMock.errorLog.update.mockResolvedValue({ id: 'crit-id', count: 51, lastEmailedAt: twoHoursAgo });

    await logError({ message: 'CRITICAL', category: 'api', severity: 'critical' });

    expect(emailMock).toHaveBeenCalledTimes(1);
  });

  it('never sends mail for non-critical severities', async () => {
    prismaMock.errorLog.findFirst.mockResolvedValue(null);
    prismaMock.errorLog.create.mockResolvedValue({ id: 'e', count: 1, lastEmailedAt: null });

    await logError({ message: 'normal', severity: 'error' });
    await logError({ message: 'normal', severity: 'warning' });
    await logError({ message: 'normal', severity: 'info' });

    expect(emailMock).not.toHaveBeenCalled();
  });
});
