import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { hash } from '@node-rs/argon2';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { lucia } from '@/lib/auth';
import { resetPasswordSchema } from '@/lib/validators';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { token, newPassword } = parsed.data;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (
    !resetToken ||
    resetToken.expiresAt < new Date() ||
    resetToken.usedAt !== null
  ) {
    return NextResponse.json({ error: 'Token invalid or expired' }, { status: 400 });
  }

  const passwordHash = await hash(newPassword);

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
  ]);

  // Invalidate all existing sessions, then auto-login with a fresh session
  await lucia.invalidateUserSessions(resetToken.userId);
  const session = await lucia.createSession(resetToken.userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  return NextResponse.json({});
}
