import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AdminForbiddenError } from '@/lib/admin';
import { verifyCsrf } from '@/lib/csrf';

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    throw e;
  }

  const { id } = await params;

  const error = await prisma.errorLog.findUnique({ where: { id } });
  if (!error) {
    return NextResponse.json({ error: 'Error not found' }, { status: 404 });
  }

  await prisma.errorLog.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
