import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    errorLog: {
      create: vi.fn().mockResolvedValue({ id: 'test-id' }),
    },
  },
}));

import { logError } from '@/lib/errorLog';
import { prisma } from '@/lib/prisma';

describe('logError', () => {
  it('creates error log entry with defaults', async () => {
    await logError({ message: 'Test error' });
    expect(prisma.errorLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        level: 'error',
        message: 'Test error',
        stack: null,
        url: null,
        userId: null,
        metadata: null,
      }),
    });
  });

  it('passes all fields when provided', async () => {
    await logError({
      message: 'S3 timeout',
      level: 'warn',
      stack: 'Error: timeout\n  at upload',
      url: '/api/presets',
      userId: 'user123',
      metadata: { fileSize: 1224 },
    });
    expect(prisma.errorLog.create).toHaveBeenCalledWith({
      data: {
        level: 'warn',
        message: 'S3 timeout',
        stack: 'Error: timeout\n  at upload',
        url: '/api/presets',
        userId: 'user123',
        metadata: { fileSize: 1224 },
      },
    });
  });
});
