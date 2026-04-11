import { NextResponse, type NextRequest } from 'next/server';
import type { User, Session } from 'lucia';
import { requireAdmin, AdminForbiddenError } from './admin';
import { verifyCsrf } from './csrf';

/**
 * Thin wrapper that collapses the 9-line CSRF + requireAdmin + try/catch
 * boilerplate every admin route needs into one call.
 *
 * Usage for a GET (no CSRF needed):
 * ```ts
 * export const GET = withAdminAuth(async (_req, { admin }) => {
 *   return NextResponse.json({ ... });
 * }, { csrf: false });
 * ```
 *
 * Usage for a PATCH with dynamic [id] route:
 * ```ts
 * export const PATCH = withAdminAuth<{ params: Promise<{ id: string }> }>(
 *   async (req, { admin, params }) => {
 *     const { id } = await params;
 *     ...
 *   },
 * );
 * ```
 *
 * The wrapper injects `admin` (the authenticated admin user) and `session`
 * into the handler context. CSRF defaults to ON for non-GET methods and can
 * be turned off with `{ csrf: false }` for pure reads.
 *
 * The handler always receives a real context object — if the route has no
 * dynamic segments, `params` is absent and the handler can ignore it.
 */
// Next.js 15 route handlers always receive `{ params: Promise<...> }` as
// the second arg, even for routes with no dynamic segments (in that case
// params is Promise<{}>). The wrapper must match this shape or tsc fails
// with "Type '...' does not satisfy RouteHandlerConfig".
type AdminContext = { admin: User; session: Session };
type RouteCtx<TParams extends Record<string, string>> = { params: Promise<TParams> };

type AdminHandler<TParams extends Record<string, string>> = (
  request: NextRequest,
  context: RouteCtx<TParams> & AdminContext,
) => Promise<Response> | Response;

type AdminAuthOpts = {
  /** Skip CSRF check. Default: true (i.e. CSRF is enforced). */
  csrf?: boolean;
};

export function withAdminAuth<TParams extends Record<string, string> = Record<string, never>>(
  handler: AdminHandler<TParams>,
  opts: AdminAuthOpts = {},
): (request: NextRequest, context: RouteCtx<TParams>) => Promise<Response> {
  const enforceCsrf = opts.csrf !== false;

  return async function wrapped(
    request: NextRequest,
    context: RouteCtx<TParams>,
  ): Promise<Response> {
    // CSRF check runs BEFORE auth so an unauthenticated CSRF miss returns
    // 403 without touching the session DB — cheaper + same signal.
    if (enforceCsrf && !verifyCsrf(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let admin: User;
    let session: Session;
    try {
      ({ user: admin, session } = await requireAdmin());
    } catch (e) {
      if (e instanceof AdminForbiddenError) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      throw e;
    }

    return handler(request, { ...context, admin, session });
  };
}
