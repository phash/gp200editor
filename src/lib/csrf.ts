export function verifyCsrf(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  // Require at least one of origin/referer for state-changing requests.
  // Browsers always send at least one; absence means a non-standard client
  // or privacy proxy. Combined with SameSite=Lax cookies this blocks cross-site POSTs.
  if (!origin && !referer) return false;

  const allowed = host ? [host, `https://${host}`, `http://${host}`] : [];
  if (process.env.NEXT_PUBLIC_APP_URL) allowed.push(process.env.NEXT_PUBLIC_APP_URL);
  if (origin && allowed.some(a => origin.startsWith(a.replace(/\/$/, '')))) return true;
  if (referer && allowed.some(a => referer.startsWith(a.replace(/\/$/, '')))) return true;
  return false;
}
