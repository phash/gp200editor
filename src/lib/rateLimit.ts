const attempts = new Map<string, { count: number; resetAt: number }>();

// In development/test environments, use much higher limits to allow parallel E2E tests
const DEV = process.env.NODE_ENV !== 'production';

// Evict expired entries every 5 minutes to prevent unbounded memory growth
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  attempts.forEach((entry, key) => {
    if (now > entry.resetAt) attempts.delete(key);
  });
}, CLEANUP_INTERVAL);
cleanupTimer.unref(); // don't keep process alive just for cleanup

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
