import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAdminAction } from '@/lib/admin';
import { withAdminAuth } from '@/lib/withAdminAuth';
import { adminPatchUserSchema } from '@/lib/validators.admin';
import { deletePreset, deleteAvatar } from '@/lib/storage';
import { lucia } from '@/lib/auth';
import { logError } from '@/lib/errorLog';

export const PATCH = withAdminAuth<{ id: string }>(async (request, { admin, params }) => {
  const { id } = await params;

  if (id === admin.id) {
    return NextResponse.json({ error: 'Cannot modify yourself' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = adminPatchUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      suspended: true,
      emailVerified: true,
      createdAt: true,
    },
  });

  // Invalidate all sessions if user is being suspended
  if (parsed.data.suspended === true) {
    await lucia.invalidateUserSessions(id);
  }

  // Audit trail must survive DB hiccups — the PATCH has already committed,
  // so we log-and-continue rather than throwing 500 to the client (matches
  // the preset-routes pattern from PR1).
  try {
    await logAdminAction({
      adminId: admin.id,
      action: 'PATCH_USER',
      targetType: 'user',
      targetId: id,
      metadata: parsed.data as Record<string, unknown>,
    });
  } catch (err) {
    await logError({
      level: 'error',
      message: 'logAdminAction failed (PATCH_USER)',
      stack: err instanceof Error ? err.stack : undefined,
      metadata: { adminId: admin.id, targetId: id },
    }).catch(() => {});
  }

  return NextResponse.json(updated);
});

export const DELETE = withAdminAuth<{ id: string }>(async (_request, { admin, params }) => {
  const { id } = await params;

  if (id === admin.id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      avatarKey: true,
      presets: { select: { presetKey: true } },
    },
  });

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Defensive check: refuse to delete other admins. Forces the deleting admin
  // to first demote the target via PATCH, which is an auditable action. Without
  // this, an admin can silently delete other admins and leave the site with
  // only one admin (their own account, which can't self-delete) — a fragile
  // state that complicates recovery.
  if (target.role === 'ADMIN') {
    return NextResponse.json(
      { error: 'Cannot delete an admin. Demote to USER first.' },
      { status: 400 },
    );
  }

  // Delete all preset files from S3
  await Promise.all(
    target.presets.map((p) => deletePreset(p.presetKey).catch(() => {})),
  );

  // Delete avatar file from S3
  if (target.avatarKey) {
    await deleteAvatar(target.avatarKey).catch(() => {});
  }

  // Delete user (cascades sessions, presets, ratings, tokens)
  await prisma.user.delete({ where: { id } });

  try {
    await logAdminAction({
      adminId: admin.id,
      action: 'DELETE_USER',
      targetType: 'user',
      targetId: id,
    });
  } catch (err) {
    await logError({
      level: 'error',
      message: 'logAdminAction failed (DELETE_USER)',
      stack: err instanceof Error ? err.stack : undefined,
      metadata: { adminId: admin.id, targetId: id },
    }).catch(() => {});
  }

  return NextResponse.json({ success: true });
});
