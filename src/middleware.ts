import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { type NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

// Lucia v3 default session cookie name — must match lucia.sessionCookieName in src/lib/auth.ts
const SESSION_COOKIE = 'auth_session';

function extractLocale(pathname: string): string {
  return routing.locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? routing.defaultLocale;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /[locale]/profile and /[locale]/profile/* routes.
  const profilePattern = /^\/(de|en|fr)(\/profile)(\/|$)/;
  if (profilePattern.test(pathname)) {
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      const locale = extractLocale(pathname);
      return NextResponse.redirect(
        new URL(`/${locale}/auth/login`, request.url),
      );
    }
    // Note: only cookie presence is checked here (edge runtime can't call Prisma).
    // Full session validation happens inside each profile page/route.
  }

  // Protect /[locale]/presets and /[locale]/presets/* routes.
  const presetsPattern = /^\/(de|en|fr)(\/presets)(\/|$)/;
  if (presetsPattern.test(pathname)) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE);
    if (!sessionCookie) {
      const locale = extractLocale(pathname);
      return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url));
    }
  }

  // Protect /[locale]/admin routes.
  const adminPattern = /^\/(de|en|fr)(\/admin)(\/|$)/;
  if (adminPattern.test(pathname)) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE);
    if (!sessionCookie) {
      const locale = extractLocale(pathname);
      return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Exclude Next.js internals, static files, and all API routes
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
};
