import { test, expect } from '@playwright/test';

const UNIQUE = () => `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

test.describe('Auth flows', () => {
  test('register → auto-login → redirected to profile', async ({ page }) => {
    const username = UNIQUE();
    const email = `${username}@test.com`;

    await page.goto('/en/auth/register');
    await page.fill('[name="email"]', email);
    await page.fill('[name="username"]', username);
    await page.fill('[name="password"]', 'testpass123');
    await page.click('[type="submit"]');

    await page.waitForURL('**/profile');
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
    const username = UNIQUE();
    const email = `${username}@test.com`;
    const password = 'testpass123';

    await page.goto('/en/auth/register');
    await page.fill('[name="email"]', email);
    await page.fill('[name="username"]', username);
    await page.fill('[name="password"]', password);
    await page.click('[type="submit"]');
    await page.waitForURL('**/profile');

    await page.click('[data-testid="nav-logout"]');
    await page.waitForURL('**/auth/login');

    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', password);
    await page.click('[type="submit"]');
    await page.waitForURL('**/profile');
  });

  test('forgot password sends email to Mailhog', async ({ page, request }) => {
    const username = UNIQUE();
    const email = `${username}@test.com`;

    // Register
    await page.goto('/en/auth/register');
    await page.fill('[name="email"]', email);
    await page.fill('[name="username"]', username);
    await page.fill('[name="password"]', 'testpass123');
    await page.click('[type="submit"]');
    await page.waitForURL('**/profile');

    // Logout
    await page.click('[data-testid="nav-logout"]');

    // Forgot password
    await page.goto('/en/auth/forgot-password');
    await page.fill('[name="email"]', email);
    await page.click('[type="submit"]');
    await expect(page.locator('[data-testid="forgot-password-sent"]')).toBeVisible();

    // Verify email in Mailhog
    const mailhog = await request.get('http://localhost:8025/api/v2/messages');
    const messages = await mailhog.json();
    const resetEmail = messages.items?.find(
      (m: { To: Array<{ Mailbox: string; Domain: string }> }) =>
        `${m.To[0].Mailbox}@${m.To[0].Domain}` === email,
    );
    expect(resetEmail).toBeDefined();
  });

  test('unauthenticated user is redirected from /profile to /auth/login', async ({ page }) => {
    await page.goto('/en/profile');
    await page.waitForURL('**/auth/login');
  });
});
