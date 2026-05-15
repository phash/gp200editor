import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendVerifyReminderEmail } from '@/lib/email';
import { logError } from '@/lib/errorLog';

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

interface ReminderBucket {
  sent: number;
  failed: number;
  skippedByRace: number;
}

interface ReminderPassArgs {
  field: 'welcomeReminderD2SentAt' | 'welcomeReminderD7SentAt';
  daysAgo: number;
  day: 2 | 7;
  bucket: ReminderBucket;
}

async function runReminderPass(args: ReminderPassArgs): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - args.daysAgo * 24 * 60 * 60 * 1000);

  const candidates = await prisma.user.findMany({
    where: {
      emailVerified: false,
      [args.field]: null,
      createdAt: { lt: cutoff },
    },
    select: { id: true, email: true, locale: true },
    take: 200,
  });

  for (const u of candidates) {
    const claim = await prisma.user.updateMany({
      where: { id: u.id, [args.field]: null },
      data: { [args.field]: now },
    });
    if (claim.count === 0) {
      args.bucket.skippedByRace++;
      continue;
    }

    try {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await prisma.emailVerificationToken.create({
        data: {
          userId: u.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.preset-forge.com';
      const verifyUrl = `${appUrl}/${u.locale}/auth/verify-email?token=${token}`;
      await sendVerifyReminderEmail(u.email, verifyUrl, u.locale, args.day);
      args.bucket.sent++;
    } catch (err) {
      await prisma.user.update({
        where: { id: u.id },
        data: { [args.field]: null },
      });
      await logError({
        message: `Verify reminder D${args.day} failed for user ${u.id}: ${err instanceof Error ? err.message : String(err)}`,
        stack: err instanceof Error ? err.stack : undefined,
        url: '/api/cron/verify-reminders',
        userId: u.id,
      }).catch(() => {});
      args.bucket.failed++;
    }
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = {
    d2: { sent: 0, failed: 0, skippedByRace: 0 } as ReminderBucket,
    d7: { sent: 0, failed: 0, skippedByRace: 0 } as ReminderBucket,
  };

  await runReminderPass({
    field: 'welcomeReminderD2SentAt',
    daysAgo: 2,
    day: 2,
    bucket: result.d2,
  });

  await runReminderPass({
    field: 'welcomeReminderD7SentAt',
    daysAgo: 7,
    day: 7,
    bucket: result.d7,
  });

  return NextResponse.json(result);
}
