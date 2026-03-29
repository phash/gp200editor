import { NextRequest, NextResponse } from 'next/server';
import { hash } from '@node-rs/argon2';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validators';
import { sendVerificationEmail } from '@/lib/email';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { rateLimit } from '@/lib/rateLimit';
import { logError } from '@/lib/errorLog';
import { verifyTurnstile } from '@/lib/turnstile';
import { isDisposableEmail } from '@/lib/disposableEmails';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-real-ip') || 'unknown';
  const { allowed } = rateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  // Honeypot: if the hidden "company_url" field is filled, it's a bot.
  // Return 201 silently to not reveal the trap.
  if (body?.company_url) {
    return NextResponse.json(
      { message: 'Account created. Please check your email to verify your account.' },
      { status: 201 },
    );
  }

  const { email, username, password } = parsed.data;
  const locale = (body?.locale === 'de' ? 'de' : 'en') as string;

  // Disposable email check
  if (isDisposableEmail(email)) {
    return NextResponse.json(
      { error: 'Please use a permanent email address' },
      { status: 400 },
    );
  }

  // Turnstile CAPTCHA verification
  const turnstileToken = body?.turnstileToken as string | undefined;
  if (turnstileToken !== undefined || process.env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken || !(await verifyTurnstile(turnstileToken, ip))) {
      return NextResponse.json(
        { error: 'CAPTCHA verification failed. Please try again.' },
        { status: 400 },
      );
    }
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });

  // Distinct error messages are an intentional UX choice. Rate limiting (#25) is
  // in place to mitigate enumeration attacks, and the trade-off favours clear
  // feedback so users know which field to correct.
  if (existing?.email === email) {
    return NextResponse.json({ error: 'Email already taken' }, { status: 409 });
  }
  if (existing?.username === username) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
  }

  const passwordHash = await hash(password);

  let user;
  try {
    user = await prisma.user.create({
      data: { email, username, passwordHash, emailVerified: false },
    });
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
      const field = (e.meta?.target as string[] | undefined)?.[0] ?? 'field';
      const message = field === 'email' ? 'Email already taken' : 'Username already taken';
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw e;
  }

  // Generate verification token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  // Send verification email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3320';
  const verifyUrl = `${appUrl}/${locale}/auth/verify-email?token=${token}`;

  try {
    await sendVerificationEmail(email, verifyUrl);
  } catch (err) {
    logError({
      message: `Failed to send verification email: ${err instanceof Error ? err.message : String(err)}`,
      stack: err instanceof Error ? err.stack : undefined,
      url: '/api/auth/register',
      userId: user.id,
    }).catch(() => {});
    // Don't fail registration if email sending fails — user can request resend
  }

  return NextResponse.json(
    { message: 'Account created. Please check your email to verify your account.' },
    { status: 201 },
  );
}
