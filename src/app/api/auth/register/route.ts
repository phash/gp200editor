import { NextRequest, NextResponse } from 'next/server';
import { hash } from '@node-rs/argon2';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { lucia } from '@/lib/auth';
import { registerSchema } from '@/lib/validators';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { email, username, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });

  if (existing?.email === email) {
    return NextResponse.json({ error: 'Email already taken' }, { status: 409 });
  }
  if (existing?.username === username) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
  }

  const passwordHash = await hash(password);

  // Let Prisma generate the CUID via @default(cuid()) in the schema
  let user;
  try {
    user = await prisma.user.create({
      data: { email, username, passwordHash },
    });
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
      const field = (e.meta?.target as string[] | undefined)?.[0] ?? 'field';
      const message = field === 'email' ? 'Email already taken' : 'Username already taken';
      return NextResponse.json({ error: message }, { status: 409 });
    }
    throw e;
  }

  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  return NextResponse.json({ userId: user.id }, { status: 201 });
}
