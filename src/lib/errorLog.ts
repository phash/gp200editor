import { createHash } from 'node:crypto';
import { prisma } from './prisma';
import { Prisma } from '@prisma/client';
import { sendCriticalErrorEmail } from './criticalErrorEmail';

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';
export type ErrorCategory =
  | 'api'
  | 'client'
  | 'auth'
  | 'db'
  | 's3'
  | 'external'
  | 'validation'
  | 'rate_limit'
  | 'legacy';

export interface LogErrorOpts {
  message: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  stack?: string;
  route?: string;
  method?: string;
  url?: string;
  userId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
  /** Back-compat for the old `level: 'error' | 'warn'` signature. */
  level?: 'error' | 'warn';
}

const EMAIL_THROTTLE_MS = 60 * 60 * 1000; // 1h per fingerprint

/** SHA-256(category|message), first 32 hex chars. Stable identity for grouping. */
export function computeFingerprint(category: string, message: string): string {
  return createHash('sha256').update(`${category}|${message}`).digest('hex').slice(0, 32);
}

/**
 * Fire-and-forget error logger. Never throws — wraps DB + email failures so the
 * caller path is never broken by the observability layer itself.
 *
 * Returns the affected row id (or null if logging itself failed) so callers can
 * deep-link to /admin/errors/<id> from response payloads if they want to.
 */
export async function logError(opts: LogErrorOpts): Promise<string | null> {
  // Translate the legacy `level` shorthand to the new severity + category model.
  const severity: ErrorSeverity = opts.severity ?? (opts.level === 'warn' ? 'warning' : 'error');
  const category: ErrorCategory = opts.category ?? 'api';
  const fingerprint = computeFingerprint(category, opts.message);

  // Mirror to console so existing log scrapers / docker logs still see something.
  const logLine = `[ErrorLog:${severity}] ${category} ${opts.message}`;
  if (severity === 'critical' || severity === 'error') {
    console.error(logLine, opts.stack ?? '');
  } else if (severity === 'warning') {
    console.warn(logLine);
  } else {
    console.info(logLine);
  }

  try {
    const now = new Date();
    const existing = await prisma.errorLog.findFirst({
      where: { fingerprint, resolvedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });

    let row;
    if (existing) {
      row = await prisma.errorLog.update({
        where: { id: existing.id },
        data: {
          count: { increment: 1 },
          lastSeenAt: now,
          // Refresh contextual fields on every occurrence so the admin UI shows
          // the *latest* invocation, not the original — that's what's needed
          // when triaging "is this still happening / where".
          stack: opts.stack ?? existing.stack,
          route: opts.route ?? existing.route,
          method: opts.method ?? existing.method,
          url: opts.url ?? existing.url,
          userId: opts.userId ?? existing.userId,
          ip: opts.ip ?? existing.ip,
          severity, // allow upgrading severity if the same fingerprint reoccurs harder
        },
      });
    } else {
      row = await prisma.errorLog.create({
        data: {
          fingerprint,
          category,
          severity,
          message: opts.message,
          stack: opts.stack ?? null,
          route: opts.route ?? null,
          method: opts.method ?? null,
          url: opts.url ?? null,
          userId: opts.userId ?? null,
          ip: opts.ip ?? null,
          metadata: (opts.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });
    }

    if (severity === 'critical') {
      await maybeSendCriticalEmail(row.id, fingerprint, row.lastEmailedAt, {
        severity,
        category,
        message: opts.message,
        stack: opts.stack,
        route: opts.route,
        method: opts.method,
        count: row.count,
      });
    }

    return row.id;
  } catch (err) {
    console.error('[ErrorLog] failed to persist error', err);
    return null;
  }
}

async function maybeSendCriticalEmail(
  id: string,
  fingerprint: string,
  lastEmailedAt: Date | null,
  body: {
    severity: ErrorSeverity;
    category: ErrorCategory;
    message: string;
    stack?: string;
    route?: string;
    method?: string;
    count: number;
  },
): Promise<void> {
  const now = Date.now();
  if (lastEmailedAt && now - lastEmailedAt.getTime() < EMAIL_THROTTLE_MS) return;

  // Claim the throttle slot *before* sending so two concurrent critical errors
  // can't both pass the check and double-send. If the send itself fails we
  // still keep lastEmailedAt set — the next occurrence within the hour just
  // won't retry, which is the correct tradeoff (alert fatigue > silent
  // duplicate spam).
  await prisma.errorLog.update({
    where: { id },
    data: { lastEmailedAt: new Date(now) },
  });

  try {
    await sendCriticalErrorEmail({ id, fingerprint, ...body });
  } catch (err) {
    console.error('[ErrorLog] critical-email send failed', err);
  }
}
