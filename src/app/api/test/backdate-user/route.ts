import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  // Only enable in development or test. Any other NODE_ENV (production,
  // staging, unset, lowercase mismatch like "Production") → 404.
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    return NextResponse.json({ error: 'disabled' }, { status: 404 });
  }
  const expected = process.env.TEST_SECRET;
  // No default: missing TEST_SECRET means the endpoint is unreachable.
  if (!expected || req.headers.get('x-test-secret') !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = (await req.json()) as { email?: string; hoursAgo?: number };
  if (
    !body.email ||
    typeof body.hoursAgo !== 'number' ||
    !Number.isFinite(body.hoursAgo) ||
    body.hoursAgo < 0 ||
    body.hoursAgo > 24 * 365
  ) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  const ts = new Date(Date.now() - body.hoursAgo * 3600 * 1000);
  const r = await prisma.user.updateMany({
    where: { email: body.email },
    data: { createdAt: ts },
  });
  return NextResponse.json({ count: r.count, createdAt: ts.toISOString() });
}
