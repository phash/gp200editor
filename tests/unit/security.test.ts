import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── rateLimit tests ──────────────────────────────────────────────────────

describe('rateLimit', () => {
  // Need to reimport for each test since it uses module-level state
  let rateLimit: typeof import('@/lib/rateLimit').rateLimit;

  beforeEach(async () => {
    // Force production mode for testing actual logic
    vi.stubEnv('NODE_ENV', 'production');
    // Clear module cache to get fresh Map
    vi.resetModules();
    const mod = await import('@/lib/rateLimit');
    rateLimit = mod.rateLimit;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows first request', () => {
    const result = rateLimit('user:1', 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks after exceeding max attempts', () => {
    const key = 'user:exceed';
    for (let i = 0; i < 5; i++) {
      rateLimit(key, 5, 60_000);
    }
    const result = rateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('allows after window expires', async () => {
    vi.useFakeTimers();
    const key = 'user:expiry';
    const windowMs = 100; // 100ms window
    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, windowMs);
    }
    // Should be blocked
    expect(rateLimit(key, 3, windowMs).allowed).toBe(false);

    // Advance time past the window
    await vi.advanceTimersByTimeAsync(windowMs + 1);
    expect(rateLimit(key, 3, windowMs).allowed).toBe(true);
    vi.useRealTimers();
  });

  it('remaining decreases with each request', () => {
    const key = 'user:remaining';
    const r1 = rateLimit(key, 10, 60_000);
    const r2 = rateLimit(key, 10, 60_000);
    const r3 = rateLimit(key, 10, 60_000);
    expect(r1.remaining).toBe(9);
    expect(r2.remaining).toBe(8);
    expect(r3.remaining).toBe(7);
  });

  it('DEV bypass: allows unlimited requests in non-production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const mod = await import('@/lib/rateLimit');
    const rateLimitDev = mod.rateLimit;

    const key = 'user:dev';
    for (let i = 0; i < 100; i++) {
      const result = rateLimitDev(key, 5, 60_000);
      expect(result.allowed).toBe(true);
    }
  });
});

// ─── CSRF tests ───────────────────────────────────────────────────────────

describe('verifyCsrf', () => {
  let verifyCsrf: typeof import('@/lib/csrf').verifyCsrf;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/csrf');
    verifyCsrf = mod.verifyCsrf;
  });

  function makeRequest(headers: Record<string, string | null>): Request {
    const headersObj = new Headers();
    for (const [key, value] of Object.entries(headers)) {
      if (value !== null) headersObj.set(key, value);
    }
    return { headers: headersObj } as unknown as Request;
  }

  it('rejects requests with no origin and no referer', () => {
    const req = makeRequest({ host: 'localhost:3000' });
    expect(verifyCsrf(req)).toBe(false);
  });

  it('accepts valid origin matching host', () => {
    const req = makeRequest({
      host: 'preset-forge.com',
      origin: 'https://preset-forge.com',
    });
    expect(verifyCsrf(req)).toBe(true);
  });

  it('accepts http origin for localhost', () => {
    const req = makeRequest({
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    });
    expect(verifyCsrf(req)).toBe(true);
  });

  it('accepts valid referer', () => {
    const req = makeRequest({
      host: 'preset-forge.com',
      referer: 'https://preset-forge.com/editor',
    });
    expect(verifyCsrf(req)).toBe(true);
  });

  it('rejects referer from different origin', () => {
    const req = makeRequest({
      host: 'preset-forge.com',
      referer: 'https://evil.com/preset-forge.com/editor',
    });
    expect(verifyCsrf(req)).toBe(false);
  });

  it('rejects origin from different domain than host', () => {
    const req = makeRequest({
      host: 'preset-forge.com',
      origin: 'https://evil.com',
    });
    expect(verifyCsrf(req)).toBe(false);
  });

  it('uses NEXT_PUBLIC_APP_URL when set', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://my-custom-domain.com');
    vi.resetModules();
    const mod = await import('@/lib/csrf');
    const verifyCsrfCustom = mod.verifyCsrf;
    const req = makeRequest({
      origin: 'https://my-custom-domain.com',
    });
    expect(verifyCsrfCustom(req)).toBe(true);
    vi.unstubAllEnvs();
  });

  it('rejects malformed referer', () => {
    const req = makeRequest({
      host: 'preset-forge.com',
      referer: 'not-a-valid-url',
    });
    expect(verifyCsrf(req)).toBe(false);
  });
});

// ─── Turnstile tests ──────────────────────────────────────────────────────

describe('verifyTurnstile', () => {
  let verifyTurnstile: typeof import('@/lib/turnstile').verifyTurnstile;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/turnstile');
    verifyTurnstile = mod.verifyTurnstile;
  });

  it('bypasses in development when secret not set', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const mod = await import('@/lib/turnstile');
    expect(await mod.verifyTurnstile('any-token', '127.0.0.1')).toBe(true);
    vi.unstubAllEnvs();
  });

  it('blocks in production when secret not set', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const mod = await import('@/lib/turnstile');
    expect(await mod.verifyTurnstile('any-token', '127.0.0.1')).toBe(false);
    vi.unstubAllEnvs();
  });

  it('returns false on fetch failure', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const mod = await import('@/lib/turnstile');
    expect(await mod.verifyTurnstile('token', '127.0.0.1')).toBe(false);
    vi.unstubAllEnvs();
  });

  it('returns false when Cloudflare returns success: false', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    });
    const mod = await import('@/lib/turnstile');
    expect(await mod.verifyTurnstile('bad-token', '127.0.0.1')).toBe(false);
    vi.unstubAllEnvs();
  });

  it('returns true on successful verification', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
    const mod = await import('@/lib/turnstile');
    expect(await mod.verifyTurnstile('valid-token', '127.0.0.1')).toBe(true);
    vi.unstubAllEnvs();
  });

  it('sends correct payload to Cloudflare', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret-123');
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = mockFetch;
    const mod = await import('@/lib/turnstile');
    await mod.verifyTurnstile('my-token', '1.2.3.4');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: expect.any(URLSearchParams),
      }),
    );
    const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('secret')).toBe('secret-123');
    expect(body.get('response')).toBe('my-token');
    expect(body.get('remoteip')).toBe('1.2.3.4');
    vi.unstubAllEnvs();
  });
});
