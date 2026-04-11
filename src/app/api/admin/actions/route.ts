import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/withAdminAuth';
import { adminActionsQuerySchema } from '@/lib/validators.admin';

export const GET = withAdminAuth(async (request) => {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = adminActionsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { page, limit } = parsed.data;

  const [actions, total] = await Promise.all([
    prisma.adminAction.findMany({
      include: { admin: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.adminAction.count(),
  ]);

  return NextResponse.json({
    actions: actions.map((a) => ({
      id: a.id,
      adminUsername: a.admin?.username ?? '(deleted)',
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      reason: a.reason,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  });
}, { csrf: false });
