import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/withAdminAuth';

export const GET = withAdminAuth(
  async () => {
    const [users, presets, errors, suspended] = await Promise.all([
      prisma.user.count(),
      prisma.preset.count(),
      prisma.errorLog.count(),
      prisma.user.count({ where: { suspended: true } }),
    ]);
    return NextResponse.json({ users, presets, errors, suspended });
  },
  { csrf: false },
);
