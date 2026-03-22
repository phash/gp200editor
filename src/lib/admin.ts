import { validateSession, refreshSessionCookie } from './session';
import { prisma } from './prisma';
import type { User, Session } from 'lucia';

export class AdminForbiddenError extends Error {
  constructor() {
    super('Forbidden');
  }
}

export async function requireAdmin(): Promise<{ user: User; session: Session }> {
  const { user, session } = await validateSession();
  if (!user || !session) throw new AdminForbiddenError();
  if (user.role !== 'ADMIN') throw new AdminForbiddenError();
  await refreshSessionCookie(session);
  return { user, session };
}

export function logAdminAction(opts: {
  adminId: string;
  action: string;
  targetType: 'user' | 'preset';
  targetId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<unknown> {
  return prisma.adminAction.create({
    data: {
      adminId: opts.adminId,
      action: opts.action,
      targetType: opts.targetType,
      targetId: opts.targetId,
      reason: opts.reason ?? null,
      metadata: opts.metadata ?? null,
    },
  });
}
