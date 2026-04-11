import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAdminAction } from '@/lib/admin';
import { withAdminAuth } from '@/lib/withAdminAuth';
import { adminWarnUserSchema } from '@/lib/validators.admin';
import { sendWarningEmail } from '@/lib/email';
import { logError } from '@/lib/errorLog';

export const POST = withAdminAuth<{ id: string }>(async (request, { admin, params }) => {
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = adminWarnUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await sendWarningEmail(target.email, parsed.data.reason, parsed.data.message);

  try {
    await logAdminAction({
      adminId: admin.id,
      action: 'WARN_USER',
      targetType: 'user',
      targetId: id,
      reason: parsed.data.reason,
      metadata: parsed.data.message ? { message: parsed.data.message } : undefined,
    });
  } catch (err) {
    await logError({
      level: 'error',
      message: 'logAdminAction failed (WARN_USER)',
      stack: err instanceof Error ? err.stack : undefined,
      metadata: { adminId: admin.id, targetId: id, reason: parsed.data.reason },
    }).catch(() => {});
  }

  return NextResponse.json({ success: true });
});
