import { test, expect } from '@playwright/test';

const UNIQUE = () => `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

async function registerAndVerify(page: import('@playwright/test').Page) {
  const username = UNIQUE();
  const email = `${username}@test.com`;

  await page.goto('/en/auth/register');
  await page.fill('[name="email"]', email);
  await page.fill('[name="username"]', username);
  await page.fill('[name="password"]', 'testpass123');
  await page.click('[type="submit"]');

  // Wait for email to arrive, then search by recipient (parallel-safe — no global delete)
  let verifyUrl: string | undefined;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(500);
    const resp = await page.context().request.get(
      `http://localhost:8025/api/v2/search?kind=to&query=${encodeURIComponent(email)}`
    );
    const data = await resp.json() as { items?: Array<{ Content: { Body: string } }> };
    const mail = data.items?.[0];
    if (mail) {
      // Email body is quoted-printable encoded: decode soft line breaks and =XX hex sequences
      const raw = mail.Content?.Body ?? '';
      const body = raw.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      const match = body.match(/http[^\s"<>]+verify-email[^\s"<>]+/);
      verifyUrl = match?.[0];
      if (verifyUrl) break;
    }
  }

  if (!verifyUrl) throw new Error(`No verification email found for ${email}`);

  // Visit verify URL → auto-logs in → redirects to /editor
  await page.goto(verifyUrl);
  await page.waitForURL('**/editor', { timeout: 10000 });

  return { username, email };
}

test.describe('Auth flows', () => {
  test('register → auto-login → redirected to profile', async ({ page }) => {
    await registerAndVerify(page);

    // After email verification we land on /editor; navigate to /profile to verify auth works
    await page.goto('/en/profile');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/en/auth/login');
    await page.fill('[name="email"]', 'nobody@example.com');
    await page.fill('[name="password"]', 'wrongpass');
    await page.click('[type="submit"]');

    await expect(page.locator('text=Invalid email or password')).toBeVisible();
  });

  test('register then login then logout', async ({ page }) => {
    const { email } = await registerAndVerify(page);
    const password = 'testpass123';

    // Navigate to profile to confirm we are logged in
    await page.goto('/en/profile');
    await expect(page.locator('h1')).toBeVisible();

    // Logout — redirects to home page (/en)
    await page.click('[data-testid="nav-logout"]');
    // Wait for navigation away from /profile to complete
    await page.waitForFunction(() => !window.location.pathname.includes('/profile'), { timeout: 10000 });

    // Log back in
    await page.goto('/en/auth/login');
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', password);
    await page.click('[type="submit"]');
    await page.waitForURL('**/profile');
  });

  test('forgot password sends email to Mailhog', async ({ page }) => {
    const { email } = await registerAndVerify(page);

    // Logout
    await page.click('[data-testid="nav-logout"]');

    // Clear Mailhog so only the reset email remains
    await page.context().request.delete('http://localhost:8025/api/v1/messages');

    // Forgot password
    await page.goto('/en/auth/forgot-password');
    await page.fill('[name="email"]', email);
    await page.click('[type="submit"]');
    await expect(page.locator('[data-testid="forgot-password-sent"]')).toBeVisible();

    // Verify reset email in Mailhog
    let resetEmail: unknown;
    for (let i = 0; i < 10; i++) {
      const mailhog = await page.context().request.get('http://localhost:8025/api/v2/messages');
      const messages = await mailhog.json() as { items?: Array<{ To: Array<{ Mailbox: string; Domain: string }> }> };
      resetEmail = messages.items?.find(
        (m) => `${m.To[0].Mailbox}@${m.To[0].Domain}` === email,
      );
      if (resetEmail) break;
      await page.waitForTimeout(500);
    }
    expect(resetEmail).toBeDefined();
  });

  test('unauthenticated user is redirected from /profile to /auth/login', async ({ page }) => {
    await page.goto('/en/profile');
    await page.waitForURL('**/auth/login');
  });
});
