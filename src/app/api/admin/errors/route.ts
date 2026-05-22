import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/withAdminAuth';
import { adminErrorsQuerySchema, adminErrorsPatchSchema } from '@/lib/validators.admin';
import { logAdminAction } from '@/lib/admin';

export const GET = withAdminAuth(async (request) => {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = adminErrorsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { q, severity, category, resolved, page, limit } = parsed.data;

  const where: Record<string, unknown> = {};
  if (q) where.message = { contains: q, mode: 'insensitive' };
  if (severity) where.severity = severity;
  if (category) where.category = category;
  if (resolved === 'true') where.resolvedAt = { not: null };
  else if (resolved === 'false') where.resolvedAt = null;

  // Sorted by severity (critical > error > warning > info) then most-recent
  // occurrence first. severity is a string column so we sort it client-side
  // after fetch — server-side ORDER BY CASE WHEN ... would beat the indexes.
  const [errors, total, unresolvedCounts] = await Promise.all([
    prisma.errorLog.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.errorLog.count({ where }),
    // Sidebar badge data: unresolved counts by severity, independent of filters.
    prisma.errorLog.groupBy({
      by: ['severity'],
      where: { resolvedAt: null },
      _count: { _all: true },
    }),
  ]);

  const severityRank: Record<string, number> = { critical: 0, error: 1, warning: 2, info: 3 };
  const sorted = errors.slice().sort((a, b) => {
    const r = (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99);
    if (r !== 0) return r;
    return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
  });

  return NextResponse.json({
    errors: sorted.map((e) => ({
      id: e.id,
      fingerprint: e.fingerprint,
      category: e.category,
      severity: e.severity,
      message: e.message,
      stack: e.stack,
      route: e.route,
      method: e.method,
      url: e.url,
      userId: e.userId,
      ip: e.ip,
      metadata: e.metadata,
      count: e.count,
      firstSeenAt: e.firstSeenAt.toISOString(),
      lastSeenAt: e.lastSeenAt.toISOString(),
      resolvedAt: e.resolvedAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
    unresolvedCounts: Object.fromEntries(
      unresolvedCounts.map((row) => [row.severity, row._count._all]),
    ),
  });
}, { csrf: false });

export const PATCH = withAdminAuth(async (request, { admin }) => {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = adminErrorsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { fingerprint, ids, resolved } = parsed.data;

  // Resolve by fingerprint (groups every row sharing the same hash) or by
  // explicit id list. fingerprint is the common case from the UI; ids is for
  // ad-hoc selection.
  const where = fingerprint ? { fingerprint } : { id: { in: ids! } };
  const { count } = await prisma.errorLog.updateMany({
    where,
    data: { resolvedAt: resolved ? new Date() : null },
  });

  try {
    await logAdminAction({
      adminId: admin.id,
      action: resolved ? 'RESOLVE_ERROR' : 'UNRESOLVE_ERROR',
      targetType: 'user',
      targetId: admin.id,
      metadata: { fingerprint, ids, count },
    });
  } catch {
    // ignore audit failure
  }

  return NextResponse.json({ success: true, count });
});

export const DELETE = withAdminAuth(async (_request, { admin }) => {
  const { count } = await prisma.errorLog.deleteMany();
  try {
    await logAdminAction({
      adminId: admin.id,
      action: 'PURGE_ERROR_LOGS',
      targetType: 'user',
      targetId: admin.id,
      metadata: { count },
    });
  } catch {
    // swallow — don't fail the DELETE because audit logging errored
  }
  return NextResponse.json({ success: true, count });
});
