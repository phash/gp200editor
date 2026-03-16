import { test, expect } from '@playwright/test';

const UNIQUE = () => `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

async function registerAndLogin(page: import('@playwright/test').Page) {
  const username = UNIQUE();
  const email = `${username}@test.com`;
  await page.goto('/en/auth/register');
  await page.fill('[name="email"]', email);
  await page.fill('[name="username"]', username);
  await page.fill('[name="password"]', 'testpass123');
  await page.click('[type="submit"]');
  await page.waitForURL('**/profile');
  return { username, email };
}

test.describe('Profile page', () => {
  test('shows own username after login', async ({ page }) => {
    const { username } = await registerAndLogin(page);
    await expect(page.locator(`text=${username}`)).toBeVisible();
  });

  test('can update bio and it persists', async ({ page }) => {
    await registerAndLogin(page);
    await page.fill('[name="bio"]', 'Guitar enthusiast');
    await page.click('[data-testid="save-profile"]');
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();

    await page.reload();
    await expect(page.locator('[name="bio"]')).toHaveValue('Guitar enthusiast');
  });

  test('other user profile page shows username and no edit form', async ({ page }) => {
    const { username: user1 } = await registerAndLogin(page);

    // Logout and register user2 to get a second session
    await page.click('[data-testid="nav-logout"]');
    const username2 = UNIQUE();
    await page.goto('/en/auth/register');
    await page.fill('[name="email"]', `${username2}@test.com`);
    await page.fill('[name="username"]', username2);
    await page.fill('[name="password"]', 'testpass123');
    await page.click('[type="submit"]');
    await page.waitForURL('**/profile');

    // Visit user1's read-only profile
    await page.goto(`/en/profile/${user1}`);
    await expect(page.locator(`text=@${user1}`)).toBeVisible();
    // Read-only page has no save button
    await expect(page.locator('[data-testid="save-profile"]')).not.toBeVisible();
  });
});
