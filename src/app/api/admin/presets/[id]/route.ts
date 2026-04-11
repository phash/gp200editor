import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, AdminForbiddenError, logAdminAction } from '@/lib/admin';
import { adminPatchPresetSchema } from '@/lib/validators.admin';
import { verifyCsrf } from '@/lib/csrf';
import { deletePreset } from '@/lib/storage';
import { logError } from '@/lib/errorLog';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let admin;
  try {
    ({ user: admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AdminForbiddenError)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    throw e;
  }

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = adminPatchPresetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const target = await prisma.preset.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.flagged !== undefined) data.flagged = parsed.data.flagged;
  if (parsed.data.public !== undefined) data.public = parsed.data.public;
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.tags !== undefined) data.tags = parsed.data.tags;
  if (parsed.data.style !== undefined) data.style = parsed.data.style;

  const updated = await prisma.preset.update({ where: { id }, data });

  // Determine action
  let action = 'edit_preset';
  if (parsed.data.flagged === true) action = 'flag_preset';
  if (parsed.data.flagged === false) action = 'unflag_preset';
  if (parsed.data.public === false) action = 'unpublish_preset';
  if (parsed.data.public === true) action = 'publish_preset';

  // Audit trail must be reliable — await and log failures. We still return
  // the update success to the client because the preset was in fact patched,
  // but a missing audit entry is a logged operational error.
  try {
    await logAdminAction({
      adminId: admin.id,
      action,
      targetType: 'preset',
      targetId: id,
    });
  } catch (err) {
    await logError({
      level: 'error',
      message: 'logAdminAction failed (patch_preset)',
      stack: err instanceof Error ? err.stack : undefined,
      metadata: { adminId: admin.id, targetId: id, action },
    }).catch(() => {});
  }

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    public: updated.public,
    flagged: updated.flagged,
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let admin;
  try {
    ({ user: admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AdminForbiddenError)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    throw e;
  }

  const { id } = await params;

  const target = await prisma.preset.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
  }

  deletePreset(target.presetKey).catch(() => {});
  await prisma.preset.delete({ where: { id } });

  try {
    await logAdminAction({
      adminId: admin.id,
      action: 'delete_preset',
      targetType: 'preset',
      targetId: id,
      metadata: { name: target.name, owner: target.userId },
    });
  } catch (err) {
    await logError({
      level: 'error',
      message: 'logAdminAction failed (delete_preset)',
      stack: err instanceof Error ? err.stack : undefined,
      metadata: { adminId: admin.id, targetId: id, name: target.name },
    }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
