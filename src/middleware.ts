import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { LOCALES } from './i18n/locales';
import { type NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

// Lucia v3 default session cookie name — must match lucia.sessionCookieName in src/lib/auth.ts
const SESSION_COOKIE = 'auth_session';

// Build the locale alternation from LOCALES so adding a 7th/8th locale
// doesn't silently bypass the auth-cookie guard. Locales can contain a
// dash (e.g. pt-BR), so escape regex meta-characters.
const LOCALE_ALT = LOCALES.map((l) => l.replace(/[-]/g, '\\-')).join('|');

// The locale prefix is optional: routing runs with localePrefix 'as-needed',
// so the default locale is served from the unprefixed path and /profile is
// as real a URL as /de/profile. Requiring the prefix here would let the
// unprefixed form walk past the guard entirely.
export const PROTECTED_ROUTE_PATTERN = new RegExp(
  `^(?:/(?:${LOCALE_ALT}))?/(?:profile|presets|admin)(?:/|$)`,
);

// Extract the locale prefix from a pathname. Used for login-redirect so a
// user on /fr/profile without a session gets redirected to /fr/auth/login,
// not /de. Returns null for an unprefixed path — that's the default locale,
// which is served without a prefix, so the login URL stays unprefixed too
// rather than bouncing through a redirect.
export const LOCALE_PREFIX_PATTERN = new RegExp(`^/(${LOCALE_ALT})(?=/|$)`);

// English is served unprefixed, so /en/... only ever redirects there. That
// redirect does not depend on the visitor, but next-intl issues it as a
// temporary 307 — and Google kept the /en/ URLs in its index (GSC Oct 2026:
// 655 impressions on /en/*). Locale-detection redirects stay 307: those
// depend on cookie and Accept-Language.
const DEFAULT_LOCALE_PREFIX_PATTERN = new RegExp(`^/${routing.defaultLocale}(?=/|$)`);

// /editor?share=<token> only tells the client which gallery preset to preload
// — the document is the plain editor. Google indexed ~25 of these as separate
// pages despite the canonical (GSC Oct 2026), so they get an explicit
// noindex. follow keeps the links on the page counting.
const EDITOR_PATH_PATTERN = new RegExp(`^(?:/(?:${LOCALE_ALT}))?/editor/?$`);

export function isEditorShareLink(url: URL): boolean {
  return EDITOR_PATH_PATTERN.test(url.pathname) && url.searchParams.has('share');
}

function makePermanent(response: NextResponse) {
  const permanent = new NextResponse(null, { status: 308, headers: response.headers });
  // Keep it out of the browser cache: a cached hop would skip the middleware,
  // which sets the English locale cookie on this request.
  permanent.headers.set('Cache-Control', 'no-store');
  return permanent;
}

function loginRedirect(request: NextRequest, pathname: string) {
  const match = LOCALE_PREFIX_PATTERN.exec(pathname);
  const prefix = match ? `/${match[1]}` : '';
  return NextResponse.redirect(new URL(`${prefix}/auth/login`, request.url));
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

  let response = intlMiddleware(request);
  if (DEFAULT_LOCALE_PREFIX_PATTERN.test(pathname) && response.status === 307) {
    response = makePermanent(response);
  }
  if (isEditorShareLink(request.nextUrl)) {
    response.headers.set('X-Robots-Tag', 'noindex, follow');
  }
  return response;
}

export const config = {
  // Exclude Next.js internals, static files, and all API routes
  matcher: ['/((?!_next|_vercel|api|.*\\..*).*)'],
};
