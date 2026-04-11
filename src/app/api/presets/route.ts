import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSession, requireVerifiedUser, refreshSessionCookie } from '@/lib/session';
import { uploadPreset, deletePreset } from '@/lib/storage';
import { uploadPresetSchema } from '@/lib/validators';
import { PRSTDecoder } from '@/core/PRSTDecoder';
import type { GP200Preset } from '@/core/types';
import { extractModules, extractEffects } from '@/core/extractModules';
import { verifyCsrf } from '@/lib/csrf';
import { logError } from '@/lib/errorLog';

export async function POST(request: Request) {
  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const result = await requireVerifiedUser();
  if (result.error) return result.error;
  const { user } = result;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('preset');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No preset file provided' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // 1. Check size (user presets = 1224 bytes, factory presets = 1176 bytes)
  if (buffer.length !== 1224 && buffer.length !== 1176) {
    return NextResponse.json(
      { error: 'Invalid PRST file: unexpected size' },
      { status: 400 },
    );
  }

  // 2. Validate + decode in one step
  let decoded: GP200Preset;
  try {
    decoded = new PRSTDecoder(buffer).decode();
  } catch {
    return NextResponse.json({ error: 'Invalid PRST file' }, { status: 400 });
  }

  // 3. Parse and validate metadata fields
  const rawTags = formData.get('tags');
  let tagsArray: string[] = [];
  if (rawTags && typeof rawTags === 'string') {
    try {
      tagsArray = JSON.parse(rawTags);
    } catch {
      tagsArray = rawTags.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  const parsed = uploadPresetSchema.safeParse({
    description: formData.get('description') ?? undefined,
    tags: tagsArray.length > 0 ? tagsArray : undefined,
    author: formData.get('author') ?? undefined,
    style: formData.get('style') ?? undefined,
    publish: formData.get('publish') === 'true' ? true : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // 4. Generate key and upload to Garage
  const key = `preset-${user.id}-${crypto.randomUUID().replace(/-/g, '')}.prst`;

  try {
    await uploadPreset(key, buffer);
  } catch {
    return NextResponse.json({ error: 'Failed to upload preset file' }, { status: 500 });
  }

  // 5. Create DB record
  try {
    const preset = await prisma.preset.create({
      data: {
        userId: user.id,
        presetKey: key,
        name: decoded.patchName.trim() || file.name.replace(/\.prst$/i, '').slice(0, 32) || 'Untitled',
        description: parsed.data.description ?? null,
        tags: parsed.data.tags ?? [],
        author: parsed.data.author ?? null,
        style: parsed.data.style ?? null,
        shareToken: crypto.randomUUID().replace(/-/g, ''),
        public: parsed.data.publish ?? false,
        modules: extractModules(decoded),
        effects: extractEffects(decoded),
      },
      select: {
        id: true,
        name: true,
        modules: true,
        shareToken: true,
        public: true,
      },
    });

    return NextResponse.json(preset, { status: 201 });
  } catch (err) {
    // Clean up orphaned S3 file
    await deletePreset(key).catch(() => {});
    logError({
      message: `Failed to create preset: ${err instanceof Error ? err.message : String(err)}`,
      stack: err instanceof Error ? err.stack : undefined,
      url: '/api/presets',
      userId: user.id,
    }).catch(() => {});
    return NextResponse.json({ error: 'Failed to save preset' }, { status: 500 });
  }
}

// Pagination guard: prevent a single user with many presets from returning
// an unbounded list (memory bloat + slow response). The frontend only ever
// renders a fixed page, so a generous upper bound is fine.
const USER_PRESETS_DEFAULT_LIMIT = 100;
const USER_PRESETS_MAX_LIMIT = 500;

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: Request) {
  const { user, session } = await validateSession();
  if (!user || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await refreshSessionCookie(session);

  const url = new URL(request.url);
  const limit = parsePositiveInt(
    url.searchParams.get('limit'),
    USER_PRESETS_DEFAULT_LIMIT,
    USER_PRESETS_MAX_LIMIT,
  );
  const page = parsePositiveInt(url.searchParams.get('page'), 1, Number.MAX_SAFE_INTEGER);

  const where = { userId: user.id } as const;

  const [presets, total] = await Promise.all([
    prisma.preset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        modules: true,
        author: true,
        style: true,
        public: true,
        shareToken: true,
        downloadCount: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.preset.count({ where }),
  ]);

  return NextResponse.json({ presets, total, page, limit });
}
