import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/withAdminAuth';

export const GET = withAdminAuth(
  async () => {
    // Renamed from {users, presets, errors, suspended} → {userCount, ...} to
    // match what the AdminDashboard + Navbar have always been reading. The
    // old keys produced a silently-broken badge for months; this is the fix.
    //
    // unresolvedCritical/unresolvedError feed the sidebar severity badge from
    // issue #70 — only unresolved rows count, so resolving a fingerprint
    // immediately clears the badge.
    const [userCount, presetCount, errorCount, suspendedCount, unresolvedCritical, unresolvedError, newFeedback] =
      await Promise.all([
        prisma.user.count(),
        prisma.preset.count(),
        prisma.errorLog.count(),
        prisma.user.count({ where: { suspended: true } }),
        prisma.errorLog.count({ where: { severity: 'critical', resolvedAt: null } }),
        prisma.errorLog.count({ where: { severity: 'error', resolvedAt: null } }),
        // Unread /feedback submissions — drives the admin tab/banner/navbar badge.
        prisma.feedback.count({ where: { status: 'NEW' } }),
      ]);
    return NextResponse.json({
      userCount,
      presetCount,
      errorCount,
      suspendedCount,
      unresolvedCritical,
      unresolvedError,
      newFeedback,
    });
  },
  { csrf: false },
);
