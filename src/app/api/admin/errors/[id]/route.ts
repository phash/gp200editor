import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/withAdminAuth';
import { logAdminAction } from '@/lib/admin';

export const DELETE = withAdminAuth<{ id: string }>(async (_request, { params, admin }) => {
  const { id } = await params;

  const error = await prisma.errorLog.findUnique({ where: { id } });
  if (!error) {
    return NextResponse.json({ error: 'Error not found' }, { status: 404 });
  }

  await prisma.errorLog.delete({ where: { id } });
  try {
    await logAdminAction({
      adminId: admin.id,
      action: 'DELETE_ERROR_LOG',
      targetType: 'user',
      targetId: admin.id,
      metadata: { errorId: id, level: error.level, message: error.message.slice(0, 120) },
    });
  } catch {
    // non-fatal
  }
  return NextResponse.json({ success: true });
});
