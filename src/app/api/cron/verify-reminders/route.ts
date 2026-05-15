import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function authorized(request: NextRequest): boolean {
  const provided = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!provided || !secret) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    d2: { sent: 0, failed: 0, skippedByRace: 0 },
    d7: { sent: 0, failed: 0, skippedByRace: 0 },
  });
}
