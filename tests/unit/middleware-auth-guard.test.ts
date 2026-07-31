import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { LOCALES } from '@/i18n/locales';

const ORIGIN = 'https://www.preset-forge.com';

function request(path: string, opts: { session?: boolean } = {}) {
  const req = new NextRequest(`${ORIGIN}${path}`);
  if (opts.session) req.cookies.set('auth_session', 'not-validated-here');
  return req;
}

function locationOf(res: Response | undefined) {
  const loc = res?.headers.get('location');
  return loc ? new URL(loc, ORIGIN).pathname : null;
}

// Under localePrefix 'as-needed' the default locale is served from the
// unprefixed path, so /profile, /presets and /admin are live URLs — not
// only /en/profile. The cookie-presence guard has to cover both shapes or
// the unprefixed form walks straight past it.
describe('auth guard covers unprefixed default-locale routes', () => {
  it.each(['/profile', '/presets', '/admin'])(
    'redirects %s to login when no session cookie is present',
    async (path) => {
      const res = await middleware(request(path));
      expect(locationOf(res)).toBe('/auth/login');
    },
  );

  it('redirects nested unprefixed protected routes too', async () => {
    expect(locationOf(await middleware(request('/admin/users')))).toBe('/auth/login');
    expect(locationOf(await middleware(request('/profile/edit')))).toBe('/auth/login');
  });

  it('keeps the visitor in their locale when the path is prefixed', async () => {
    expect(locationOf(await middleware(request('/de/profile')))).toBe('/de/auth/login');
    expect(locationOf(await middleware(request('/pt-BR/admin')))).toBe('/pt-BR/auth/login');
  });

  it('guards every locale, prefixed and unprefixed alike', async () => {
    for (const locale of LOCALES) {
      const res = await middleware(request(`/${locale}/profile`));
      // Every locale must end up at *some* login page rather than the
      // profile itself. pt-BR must not partial-match as pt.
      expect(locationOf(res)).toMatch(/\/auth\/login$/);
    }
  });

  it('does not intercept public routes', async () => {
    expect(locationOf(await middleware(request('/gallery')))).not.toBe('/auth/login');
    expect(locationOf(await middleware(request('/de/gallery')))).not.toBe('/auth/login');
  });

  it('lets a request through when the session cookie is present', async () => {
    // The cookie is only checked for presence here — edge runtime can't
    // reach Prisma. Each page revalidates the session server-side.
    const res = await middleware(request('/profile', { session: true }));
    expect(locationOf(res)).not.toBe('/auth/login');
  });
});
