import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/withAdminAuth';

export const DELETE = withAdminAuth<{ id: string }>(async (_request, { params }) => {
  const { id } = await params;

  const error = await prisma.errorLog.findUnique({ where: { id } });
  if (!error) {
    return NextResponse.json({ error: 'Error not found' }, { status: 404 });
  }

  await prisma.errorLog.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
