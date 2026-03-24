export function verifyCsrf(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  if (!origin && !referer) return false;

  const allowedOrigins = new Set<string>();
  if (host) {
    allowedOrigins.add(`https://${host}`);
    allowedOrigins.add(`http://${host}`);
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    allowedOrigins.add(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ''));
  }

  // Exact origin match — prevents bypass via preset-forge.com.evil.com
  if (origin && allowedOrigins.has(origin)) return true;

  // For referer, extract origin portion only
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowedOrigins.has(refererOrigin)) return true;
    } catch {
      return false;
    }
  }

  return false;
}
