import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AdminForbiddenError } from '@/lib/admin';
import { adminErrorsQuerySchema } from '@/lib/validators.admin';
import { verifyCsrf } from '@/lib/csrf';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    throw e;
  }

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = adminErrorsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { q, level, page, limit } = parsed.data;

  const where: Record<string, unknown> = {};
  if (q) where.message = { contains: q, mode: 'insensitive' };
  if (level) where.level = level;

  const [errors, total] = await Promise.all([
    prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.errorLog.count({ where }),
  ]);

  return NextResponse.json({
    errors: errors.map((e) => ({
      id: e.id,
      level: e.level,
      message: e.message,
      stack: e.stack,
      url: e.url,
      userId: e.userId,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  });
}

export async function DELETE(request: NextRequest) {
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

  await prisma.errorLog.deleteMany();
  return NextResponse.json({ success: true });
}
