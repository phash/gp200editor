import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSession, requireVerifiedUser, refreshSessionCookie } from '@/lib/session';
import { uploadPreset, deletePreset } from '@/lib/storage';
import { patchPresetSchema } from '@/lib/validators';
import { PRSTDecoder } from '@/core/PRSTDecoder';
import type { GP200Preset } from '@/core/types';
import { extractModules, extractEffects } from '@/core/extractModules';
import { verifyCsrf } from '@/lib/csrf';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const result = await requireVerifiedUser();
  if (result.error) return result.error;
  const { user, session } = result;
  await refreshSessionCookie(session);

  const { id } = await context.params;

  const existing = await prisma.preset.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  // Parse tags
  const rawTags = formData.get('tags');
  let tagsArray: string[] | undefined;
  if (rawTags && typeof rawTags === 'string') {
    try {
      tagsArray = JSON.parse(rawTags);
    } catch {
      tagsArray = rawTags.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  const rawName = formData.get('name');
  const rawDescription = formData.get('description');
  const rawStyle = formData.get('style');

  const parsed = patchPresetSchema.safeParse({
    name: rawName && typeof rawName === 'string' ? rawName : undefined,
    description:
      rawDescription === ''
        ? null
        : rawDescription && typeof rawDescription === 'string'
          ? rawDescription
          : undefined,
    tags: tagsArray,
    style: rawStyle === '' ? null : rawStyle && typeof rawStyle === 'string' ? rawStyle : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Build DB update data
  const updateData: {
    name?: string;
    description?: string | null;
    tags?: string[];
    style?: string | null;
    modules?: string[];
    effects?: string[];
    presetKey?: string;
  } = {};

  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.tags !== undefined) updateData.tags = parsed.data.tags;
  if (parsed.data.style !== undefined) updateData.style = parsed.data.style;

  // Handle file replacement
  const file = formData.get('preset');
  let oldKey: string | null = null;

  if (file && file instanceof File) {
    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.length !== 1224 && buffer.length !== 1176) {
      return NextResponse.json(
        { error: 'Invalid PRST file: unexpected size' },
        { status: 400 },
      );
    }

    let decoded: GP200Preset;
    try {
      decoded = new PRSTDecoder(buffer).decode();
    } catch {
      return NextResponse.json({ error: 'Invalid PRST file' }, { status: 400 });
    }

    // 1. Upload new file first
    const newKey = `preset-${user.id}-${crypto.randomUUID().replace(/-/g, '')}.prst`;
    try {
      await uploadPreset(newKey, buffer);
    } catch {
      return NextResponse.json({ error: 'Failed to upload preset file' }, { status: 500 });
    }

    // Track old key for cleanup
    oldKey = existing.presetKey;
    updateData.presetKey = newKey;

    // If no explicit name override, use name from new file
    if (!parsed.data.name) {
      updateData.name = decoded.patchName.trim() || 'Untitled';
    }
    updateData.modules = extractModules(decoded);
    updateData.effects = extractEffects(decoded);
  }

  // 2. Update DB
  let updated;
  try {
    updated = await prisma.preset.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        shareToken: true,
        downloadCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch {
    // Rollback: delete newly uploaded S3 file if DB update failed
    if (updateData.presetKey) {
      await deletePreset(updateData.presetKey).catch(() => {});
    }
    return NextResponse.json({ error: 'Failed to update preset' }, { status: 500 });
  }

  // 3. Best-effort delete old Garage object
  if (oldKey) {
    await deletePreset(oldKey).catch(() => {});
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!verifyCsrf(_request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { user, session } = await validateSession();
  if (!user || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await refreshSessionCookie(session);

  const { id } = await context.params;

  const existing = await prisma.preset.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete Garage object first (best-effort), then DB record
  await deletePreset(existing.presetKey).catch(() => {});
  await prisma.preset.delete({ where: { id } });

  return NextResponse.json({});
}
