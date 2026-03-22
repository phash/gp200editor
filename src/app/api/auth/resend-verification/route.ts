import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rateLimit';
import { logError } from '@/lib/errorLog';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = body?.email;
  const locale = (body?.locale === 'de' ? 'de' : 'en') as string;
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const { allowed } = rateLimit(`resend:${email}`, 3, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to prevent user enumeration
  if (!user || user.emailVerified) {
    return NextResponse.json({ sent: true });
  }

  // Delete old unused tokens for this user
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  // Generate new token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3320';
  const verifyUrl = `${appUrl}/${locale}/auth/verify-email?token=${token}`;

  try {
    await sendVerificationEmail(email, verifyUrl);
  } catch (err) {
    logError({
      message: `Failed to resend verification email: ${err instanceof Error ? err.message : String(err)}`,
      stack: err instanceof Error ? err.stack : undefined,
      url: '/api/auth/resend-verification',
    }).catch(() => {});
  }

  return NextResponse.json({ sent: true });
}
