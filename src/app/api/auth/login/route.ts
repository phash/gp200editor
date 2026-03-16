import { NextRequest, NextResponse } from 'next/server';
import { verify } from '@node-rs/argon2';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { lucia } from '@/lib/auth';
import { loginSchema } from '@/lib/validators';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Same message regardless — no user enumeration
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const valid = await verify(user.passwordHash, password);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  return NextResponse.json({ userId: user.id });
}
