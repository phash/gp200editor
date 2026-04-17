/**
 * Extract the best-effort client IP for rate-limiting purposes.
 * Header precedence matches what our Caddy reverse proxy injects:
 *   cf-connecting-ip > x-forwarded-for (first hop) > x-real-ip > 'unknown'.
 * Caddy strips any client-set variants of these headers and re-injects
 * server-trusted values, so we can trust them end-to-end in production.
 * Returns a string-safe fallback so callers never need to null-check.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
