import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

export function logError(opts: {
  message: string;
  level?: 'error' | 'warn';
  stack?: string;
  url?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}): Promise<unknown> {
  const level = opts.level ?? 'error';

  if (level === 'error') {
    console.error(`[ErrorLog] ${opts.message}`, opts.stack ?? '');
  } else {
    console.warn(`[ErrorLog] ${opts.message}`);
  }

  return prisma.errorLog.create({
    data: {
      level,
      message: opts.message,
      stack: opts.stack ?? null,
      url: opts.url ?? null,
      userId: opts.userId ?? null,
      metadata: opts.metadata as Prisma.InputJsonValue ?? undefined,
    },
  });
}
