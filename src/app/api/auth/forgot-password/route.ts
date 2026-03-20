import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { forgotPasswordSchema } from '@/lib/validators';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);

  // Always 200 — no user enumeration, even on bad input
  if (!parsed.success) return NextResponse.json({});

  const { email } = parsed.data;
  const locale = (body?.locale === 'de' ? 'de' : 'en') as string;

  const { allowed } = rateLimit(`forgot:${email}`, 3, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any previous unused tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const token = await prisma.passwordResetToken.create({
      data: { tokenHash, userId: user.id, expiresAt },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/auth/reset-password?token=${rawToken}`;
    // SMTP errors propagate as 500 (intentional — user knows to retry)
    try {
      await sendPasswordResetEmail(email, resetUrl);
    } catch (err) {
      // Clean up the orphaned token before propagating the error
      await prisma.passwordResetToken.delete({ where: { id: token.id } }).catch(() => {});
      throw err;
    }
  }

  return NextResponse.json({});
}
