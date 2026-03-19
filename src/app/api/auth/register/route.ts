import { NextRequest, NextResponse } from 'next/server';
import { hash } from '@node-rs/argon2';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validators';
import { sendVerificationEmail } from '@/lib/email';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { email, username, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });

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
  const verifyUrl = `${appUrl}/en/auth/verify-email?token=${token}`;

  try {
    await sendVerificationEmail(email, verifyUrl);
  } catch (err) {
    console.error('Failed to send verification email:', err);
    // Don't fail registration if email sending fails — user can request resend
  }

  return NextResponse.json(
    { message: 'Account created. Please check your email to verify your account.' },
    { status: 201 },
  );
}
