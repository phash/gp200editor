import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSession, refreshSessionCookie } from '@/lib/session';
import { verifyCsrf } from '@/lib/csrf';
import { patchProfileSchema } from '@/lib/validators';

function toResponse(user: {
  id: string;
  username: string;
  email: string;
  role: string;
  bio: string | null;
  website: string | null;
  avatarKey: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    bio: user.bio,
    website: user.website,
    avatarUrl: user.avatarKey ? `/api/avatar/${user.avatarKey}` : null,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function GET() {
  const { user, session } = await validateSession();
  if (!user || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await refreshSessionCookie(session);

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  return NextResponse.json(toResponse(dbUser));
}

export async function PATCH(request: NextRequest) {
  if (!verifyCsrf(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { user, session } = await validateSession();
  if (!user || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await refreshSessionCookie(session);

  const body = await request.json().catch(() => null);
  const parsed = patchProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Build update object carefully:
  // - undefined (field absent) → Prisma skips the field (no-op)
  // - null (field explicitly cleared) → Prisma sets column to NULL
  // The ?? undefined pattern must NOT be used here as it collapses null to undefined.
  const data: { bio?: string | null; website?: string | null } = {};
  if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;
  if (parsed.data.website !== undefined) data.website = parsed.data.website;

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  return NextResponse.json(toResponse(updated));
}
