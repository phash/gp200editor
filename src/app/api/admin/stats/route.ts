import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AdminForbiddenError } from '@/lib/admin';

export async function GET() {
  let admin;
  try {
    ({ user: admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AdminForbiddenError)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    throw e;
  }

  void admin; // used for auth only

  const [users, presets, errors, suspended] = await Promise.all([
    prisma.user.count(),
    prisma.preset.count(),
    prisma.errorLog.count(),
    prisma.user.count({ where: { suspended: true } }),
  ]);

  return NextResponse.json({ users, presets, errors, suspended });
}
