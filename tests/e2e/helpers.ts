import type { Page, APIRequestContext } from '@playwright/test';

export const UNIQUE = () => `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * Decode Quoted-Printable encoding (used by Mailhog email bodies).
 * Handles soft line breaks (=\n) and hex-encoded chars (=3D → =).
 */
function decodeQP(text: string): string {
  return text
    .replace(/=\r?\n/g, '')                          // remove QP soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>       // decode =XX hex chars
      String.fromCharCode(parseInt(hex, 16)),
    );
}

/**
 * Extract verification token from a Mailhog email for a given address.
 * Uses Mailhog's search API to find the email by recipient (handles large mailboxes).
 * Retries up to 5 times with 500ms delay for email delivery.
 */
async function extractVerificationToken(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  const mailbox = email.split('@')[0];

  for (let attempt = 0; attempt < 5; attempt++) {
    const mailhogRes = await request.get(
      `http://localhost:8025/api/v2/search?kind=to&query=${mailbox}`,
    );
    const result = await mailhogRes.json();

    const verifyEmail = result.items?.find(
      (m: { Content: { Body: string } }) =>
        m.Content.Body.includes('verify-email'),
    );

    if (verifyEmail) {
      const body = decodeQP(verifyEmail.Content.Body);
      const tokenMatch = body.match(/token=([a-f0-9]{64})/);
      if (tokenMatch) {
        return tokenMatch[1];
      }
    }

    // Wait and retry
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`Verification email not found for ${email} in Mailhog after 5 attempts`);
}

/**
 * Register a user and verify email via Mailhog, resulting in an auto-login session.
 * Works with the email verification flow:
 *   1. POST /api/auth/register → creates unverified user + sends verification email
 *   2. Fetch email from Mailhog → extract verification token
 *   3. GET /api/auth/verify-email?token=... → verifies email + creates session (auto-login)
 *   4. Navigate to profile to confirm logged-in state
 */
export async function registerAndVerify(
  page: Page,
  request?: APIRequestContext,
): Promise<{ username: string; email: string; password: string }> {
  const username = UNIQUE();
  const email = `${username}@test.com`;
  const password = 'testpass123';

  // 1. Register via UI
  await page.goto('/en/auth/register');
  await page.fill('[name="email"]', email);
  await page.fill('[name="username"]', username);
  await page.fill('[name="password"]', password);
  await page.click('[type="submit"]');

  // 2. Wait for email delivery
  await page.waitForTimeout(1000);

  // 3. Extract and verify token
  const apiCtx = request || page.request;
  const token = await extractVerificationToken(apiCtx, email);

  // 4. Verify email via API (this auto-logs in via session cookie)
  const verifyRes = await page.request.get(
    `http://localhost:3000/api/auth/verify-email?token=${token}`,
  );
  if (!verifyRes.ok()) {
    throw new Error(`Email verification failed: ${verifyRes.status()}`);
  }

  // 5. Navigate to profile to confirm session is active
  await page.goto('/en/profile');
  await page.waitForURL('**/profile');

  return { username, email, password };
}

/**
 * Register a user via API and verify email via Mailhog (no browser UI).
 * Returns the credentials for subsequent API-based login.
 */
export async function registerAndVerifyViaAPI(
  request: APIRequestContext,
  baseUrl = 'http://localhost:3000',
): Promise<{ username: string; email: string; password: string }> {
  const username = UNIQUE();
  const email = `${username}@test.com`;
  const password = 'testpass123';

  // Register via API
  const regRes = await request.post(`${baseUrl}/api/auth/register`, {
    data: { email, username, password },
  });
  if (!regRes.ok()) {
    throw new Error(`Register failed: ${regRes.status()} ${await regRes.text()}`);
  }

  // Wait for email delivery
  await new Promise((r) => setTimeout(r, 500));

  // Extract and verify token
  const token = await extractVerificationToken(request, email);

  // Verify email via API (also creates session)
  const verifyRes = await request.get(
    `${baseUrl}/api/auth/verify-email?token=${token}`,
  );
  if (!verifyRes.ok()) {
    throw new Error(`Verification failed: ${verifyRes.status()}`);
  }

  return { username, email, password };
}

/**
 * Create a valid 1224-byte .prst buffer for upload tests.
 */
export function createTestPresetBuffer(name = 'Test Preset'): Buffer {
  const buf = Buffer.alloc(1224, 0);
  buf.write('TSRP', 0x00, 'ascii');     // Magic Header (reversed)
  buf[0x15] = 0x01;                      // Version byte
  buf.write(name.slice(0, 16), 0x44, 'ascii'); // Patch Name at offset 0x44

  // Write effect block markers for 11 slots
  for (let i = 0; i < 11; i++) {
    const base = 0xa0 + i * 0x48;
    buf[base] = 0x14;
    buf[base + 2] = 0x44;
    buf[base + 4] = i; // slot index
  }

  return buf;
}
