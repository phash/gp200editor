import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AdminForbiddenError, logAdminAction } from '@/lib/admin';
import { adminWarnUserSchema } from '@/lib/validators.admin';
import { sendWarningEmail } from '@/lib/email';
import { verifyCsrf } from '@/lib/csrf';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let admin;
  try {
    ({ user: admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AdminForbiddenError)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    throw e;
  }

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

  await logAdminAction({
    adminId: admin.id,
    action: 'WARN_USER',
    targetType: 'user',
    targetId: id,
    reason: parsed.data.reason,
    metadata: parsed.data.message ? { message: parsed.data.message } : undefined,
  });

  return NextResponse.json({ success: true });
}
