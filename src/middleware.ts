import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { type NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

// Lucia v3 default session cookie name — must match lucia.sessionCookieName in src/lib/auth.ts
const SESSION_COOKIE = 'auth_session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /[locale]/profile and /[locale]/profile/* routes.
  // Locale list must match routing.ts (de, en).
  const profilePattern = /^\/(de|en)(\/profile)(\/|$)/;
  if (profilePattern.test(pathname)) {
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      const locale = pathname.startsWith('/en') ? 'en' : 'de';
      return NextResponse.redirect(
        new URL(`/${locale}/auth/login`, request.url),
      );
    }
    // Note: only cookie presence is checked here (edge runtime can't call Prisma).
    // Full session validation happens inside each profile page/route.
  }

  return intlMiddleware(request);
}

export const config = {
  // Exclude Next.js internals, static files, and all API routes
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
};
