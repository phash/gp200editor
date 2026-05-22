import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { logError } from '@/lib/errorLog';
import { rateLimit } from '@/lib/rateLimit';
import { validateSession } from '@/lib/session';

// Surface uncaught client-side render errors to the same observability pipeline
// as server errors. Reported by src/app/[locale]/error.tsx (App-Router error
// boundary). Anonymous reports allowed; userId attached when a session exists.

const bodySchema = z.object({
  message: z.string().min(1).max(500),
  stack: z.string().max(8000).optional(),
  url: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return req.headers.get('x-real-ip');
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  // Hard ceiling on client-side error volume per IP — without this, a misbehaving
  // tab in a loop could flood the table. Generous enough to survive a real
  // outage (when many users genuinely hit errors at once).
  const { allowed } = rateLimit(`client-error:${ip ?? 'anon'}`, 30, 60_000);
  if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { user } = await validateSession();

  await logError({
    message: parsed.data.message,
    stack: parsed.data.stack,
    url: parsed.data.url,
    metadata: parsed.data.metadata,
    category: 'client',
    severity: 'error',
    userId: user?.id,
    ip: ip ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
