import { test, expect } from '@playwright/test';
import { gotoForm, registerAndVerify, UNIQUE } from './helpers';

test.describe('Auth flows', () => {
  test('register → verify email → auto-login → redirected to profile', async ({ page }) => {
    const { username } = await registerAndVerify(page);
    await expect(page.locator(`text=${username}`)).toBeVisible();
  });

  test('login with wrong password shows error', async ({ page }) => {
    await gotoForm(page, '/en/auth/login');
    await page.fill('[name="login"]', 'nobody@example.com');
    await page.fill('[name="password"]', 'wrongpass');
    await page.click('[type="submit"]');

    await expect(page.locator('text=Invalid email or password')).toBeVisible();
  });

  test('register then login then logout', async ({ page }) => {
    const { email, password } = await registerAndVerify(page);

    // Logout — redirects to the home page
    await page.click('[data-testid="nav-logout"]');
    await page.waitForURL((url) => url.pathname === '/');

    // Login again
    await gotoForm(page, '/en/auth/login');
    await page.fill('[name="login"]', email);
    await page.fill('[name="password"]', password);
    await page.click('[type="submit"]');
    await page.waitForURL('**/profile');
  });

  test('forgot password sends email to Mailhog', async ({ page, request }) => {
    const { email } = await registerAndVerify(page);

    // Logout
    await page.click('[data-testid="nav-logout"]');
    await page.waitForURL((url) => url.pathname === '/');

    // Forgot password
    await gotoForm(page, '/en/auth/forgot-password');
    await page.fill('[name="email"]', email);
    await page.click('[type="submit"]');
    await expect(page.locator('[data-testid="forgot-password-sent"]')).toBeVisible();

    // Verify email in Mailhog. The search API scales with a full mailbox; the
    // body is quoted-printable, so match on a fragment that never wraps.
    await expect
      .poll(async () => {
        const res = await request.get(
          `http://localhost:8025/api/v2/search?kind=to&query=${encodeURIComponent(email)}`,
        );
        const { items = [] } = (await res.json()) as { items?: Array<{ Content: { Body: string } }> };
        return items.filter((m) => m.Content.Body.replace(/=\r?\n/g, '').includes('reset-password')).length;
      })
      .toBeGreaterThan(0);
  });

  test('unauthenticated user is redirected from /profile to /auth/login', async ({ page }) => {
    await page.goto('/en/profile');
    await page.waitForURL('**/auth/login');
  });
});
