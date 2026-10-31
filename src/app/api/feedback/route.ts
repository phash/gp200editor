import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '@/lib/session';
import { verifyCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import { feedbackSchema, USER_AGENT_MAX } from '@/lib/feedbackValidators';
import { sendFeedbackEmail } from '@/lib/criticalErrorEmail';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * POST /api/feedback — feedback form submission.
 *
 * Bot protection, in order: CSRF origin check → verified-email session
 * (accounts already passed Turnstile + disposable-mail block at sign-up)
 * → per-user rate limits (3/h, 10/day) → honeypot → length limits →
 * duplicate check (same text by same user within 24h).
 */
export async function POST(request: NextRequest) {
  if (!verifyCsrf(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const auth = await requireVerifiedUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const hourly = rateLimit(`feedback-hour:${user.id}`, 3, HOUR);
  const daily = rateLimit(`feedback-day:${user.id}`, 10, DAY);
  if (!hourly.allowed || !daily.allowed) {
    return NextResponse.json({ error: 'Too many submissions. Try again later.' }, { status: 429 });
  }

  const json = await request.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { category, message, pagePath, locale, company_url } = parsed.data;

  // Honeypot hit: pretend success so the bot learns nothing.
  if (company_url) return NextResponse.json({ ok: true }, { status: 201 });

  const duplicate = await prisma.feedback.findFirst({
    where: { userId: user.id, message, createdAt: { gte: new Date(Date.now() - DAY) } },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: 'Duplicate feedback' }, { status: 409 });
  }

  const userAgent = request.headers.get('user-agent')?.slice(0, USER_AGENT_MAX) ?? null;
  const feedback = await prisma.feedback.create({
    data: { userId: user.id, category, message, pagePath, locale, userAgent },
    select: { id: true },
  });

  // Mail failure must not fail the submission — the row is the source of truth.
  await sendFeedbackEmail({
    id: feedback.id,
    category,
    username: user.username,
    email: user.email,
    message,
    pagePath,
    userAgent,
    locale,
  }).catch(() => {});

  return NextResponse.json({ ok: true, id: feedback.id }, { status: 201 });
}
