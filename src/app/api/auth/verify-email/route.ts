import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { lucia } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/getClientIp';
import { sendWelcomeEmail } from '@/lib/email';
import { logError } from '@/lib/errorLog';
import { LOCALES, type Locale } from '@/i18n/locales';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed } = rateLimit(`verify-email:${ip}`, 10, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : null;
  const locale: Locale = (LOCALES as readonly string[]).includes(body?.locale) ? body.locale : 'en';
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const verifyToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!verifyToken || verifyToken.usedAt || verifyToken.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
  }

  // Mark token as used and verify the user
  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: verifyToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: verifyToken.userId },
      data: { emailVerified: true },
    }),
  ]);

  // Block auto-login for suspended users
  if (verifyToken.user.suspended) {
    return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
  }

  // Auto-login after verification
  const session = await lucia.createSession(verifyToken.userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  // Welcome mail — don't fail verification if mail fails
  try {
    await sendWelcomeEmail(verifyToken.user.email, verifyToken.user.username, locale);
  } catch (err) {
    logError({
      message: `Failed to send welcome email: ${err instanceof Error ? err.message : String(err)}`,
      stack: err instanceof Error ? err.stack : undefined,
      url: '/api/auth/verify-email',
      userId: verifyToken.userId,
    }).catch(() => {});
  }

  return NextResponse.json({ verified: true });
}
