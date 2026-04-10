import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { type NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

// Lucia v3 default session cookie name — must match lucia.sessionCookieName in src/lib/auth.ts
const SESSION_COOKIE = 'auth_session';

// Compile once at module load — avoids rebuilding the regex on every request.
// Locale list must match routing.ts (de, en). Single regex with alternation
// lets us match all three protected trees in one test instead of three.
const PROTECTED_ROUTE_PATTERN = /^\/(de|en)\/(profile|presets|admin)(?:\/|$)/;

function loginRedirect(request: NextRequest, pathname: string) {
  const locale = pathname.startsWith('/en') ? 'en' : 'de';
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
