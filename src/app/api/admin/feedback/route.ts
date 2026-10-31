import { type NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/withAdminAuth';
import { prisma } from '@/lib/prisma';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  type FeedbackCategory,
  type FeedbackStatus,
} from '@/lib/feedbackValidators';

const LIMIT = 50;

// GET-only listing for the admin feedback tab. CSRF off (pure read);
// withAdminAuth still enforces session + ADMIN role.
export const GET = withAdminAuth(async (request: NextRequest) => {
  const sp = request.nextUrl.searchParams;
  const status = sp.get('status');
  const category = sp.get('category');
  const cursor = sp.get('cursor');

  const where: { status?: FeedbackStatus; category?: FeedbackCategory } = {};
  if ((FEEDBACK_STATUSES as readonly string[]).includes(status ?? '')) where.status = status as FeedbackStatus;
  if ((FEEDBACK_CATEGORIES as readonly string[]).includes(category ?? '')) where.category = category as FeedbackCategory;

  const [rows, grouped] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: LIMIT + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: { id: true, username: true } } },
    }),
    prisma.feedback.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const counts: Record<FeedbackStatus, number> = { NEW: 0, READ: 0, DONE: 0 };
  for (const g of grouped) counts[g.status as FeedbackStatus] = g._count._all;

  const hasMore = rows.length > LIMIT;
  const feedback = rows.slice(0, LIMIT);
  return NextResponse.json({
    feedback,
    counts,
    nextCursor: hasMore ? feedback[feedback.length - 1].id : null,
  });
}, { csrf: false });
