import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { lucia } from '@/lib/auth';
import { validateSession } from '@/lib/session';

export async function POST() {
  const { session } = await validateSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await lucia.invalidateSession(session.id);

  const cookieStore = await cookies();
  const blank = lucia.createBlankSessionCookie();
  cookieStore.set(blank.name, blank.value, blank.attributes);

  return NextResponse.json({});
}
