import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { lucia } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
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

  return NextResponse.json({ verified: true });
}
