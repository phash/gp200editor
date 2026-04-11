import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { type NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

// Lucia v3 default session cookie name — must match lucia.sessionCookieName in src/lib/auth.ts
const SESSION_COOKIE = 'auth_session';

// Locale list must match routing.ts. We extract locale segment + protected
// subtree in one regex so adding a locale is a single-line change.
const PROTECTED_ROUTE_PATTERN =
  /^\/(de|en|es|fr|it|pt)\/(profile|presets|admin)(?:\/|$)/;

// Extract the locale prefix from a pathname, falling back to en if the path
// doesn't start with a known locale. Used for login-redirect so a user on
// /fr/profile without a session gets redirected to /fr/auth/login, not /de.
const LOCALE_PREFIX_PATTERN = /^\/(de|en|es|fr|it|pt)(?=\/|$)/;

function loginRedirect(request: NextRequest, pathname: string) {
  const match = LOCALE_PREFIX_PATTERN.exec(pathname);
  const locale = match ? match[1] : 'en';
  return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PROTECTED_ROUTE_PATTERN.test(pathname)) {
    // Edge runtime can't call Prisma, so only cookie *presence* is verified
    // here. Each page/route revalidates the session server-side before any
    // authenticated work.
    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionCookie) {
      return loginRedirect(request, pathname);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Exclude Next.js internals, static files, and all API routes
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
};
