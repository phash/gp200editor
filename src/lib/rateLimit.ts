const attempts = new Map<string, { count: number; resetAt: number }>();

// In development/test environments, use much higher limits to allow parallel E2E tests
const DEV = process.env.NODE_ENV !== 'production';

export function rateLimit(key: string, maxAttempts: number, windowMs: number): { allowed: boolean; remaining: number } {
  if (DEV) return { allowed: true, remaining: maxAttempts };
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  entry.count++;
  if (entry.count > maxAttempts) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: maxAttempts - entry.count };
}
