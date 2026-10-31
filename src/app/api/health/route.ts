import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pingStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/** A check that does not answer within this time counts as failed. */
const CHECK_TIMEOUT_MS = 3000;

type CheckResult = { ok: boolean; ms: number };

async function runCheck(fn: () => Promise<unknown>): Promise<CheckResult> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS);
  });
  try {
    await Promise.race([fn(), timeout]);
    return { ok: true, ms: Date.now() - started };
  } catch {
    // Public endpoint: report only up/down, never the error text (hosts, ports).
    return { ok: false, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/health — readiness of the app and its dependencies.
 * Used by the Docker healthcheck, scripts/deploy-update.sh and external
 * uptime monitors. 200 = all checks ok, 503 = at least one failed.
 */
export async function GET() {
  const [database, storage] = await Promise.all([
    runCheck(() => prisma.$queryRaw`SELECT 1`),
    runCheck(() => pingStorage()),
  ]);
  const ok = database.ok && storage.ok;
  return NextResponse.json(
    { status: ok ? 'ok' : 'error', checks: { database, storage }, time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
