import { lucia } from './auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { User, Session } from 'lucia';

export type SessionResult =
  | { user: User; session: Session }
  | { user: null; session: null };

/**
 * Validates the session cookie. Use in Server Components and Route Handlers.
 */
export async function validateSession(): Promise<SessionResult> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) return { user: null, session: null };
  const result = await lucia.validateSession(sessionId);
  // Block suspended users — invalidate their session immediately
  if (result.user?.suspended) {
    await lucia.invalidateSession(sessionId).catch(() => {});
    return { user: null, session: null };
  }
  return result;
}

/**
 * Validates session and requires emailVerified === true.
 * Returns the user/session or an error NextResponse.
 */
export async function requireVerifiedUser(): Promise<
  | { user: User; session: Session; error?: undefined }
  | { user?: undefined; session?: undefined; error: Response }
> {
  const { user, session } = await validateSession();
  if (!user || !session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!user.emailVerified) {
    return { error: NextResponse.json({ error: 'Email not verified' }, { status: 403 }) };
  }
  return { user, session };
}

/**
 * Call from Route Handlers after validateSession() to extend a near-expiry session.
 * Lucia sets session.fresh = true when it has extended the expiry.
 * Server Components cannot set cookies, so skip this call there.
 */
export async function refreshSessionCookie(session: Session): Promise<void> {
  if (!session.fresh) return;
  const cookieStore = await cookies();
  const cookie = lucia.createSessionCookie(session.id);
  cookieStore.set(cookie.name, cookie.value, cookie.attributes);
}
