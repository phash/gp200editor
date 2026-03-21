import { test, expect } from '@playwright/test';
import { registerAndVerify } from './helpers';

test.describe('Profile page', () => {
  test('shows own username after login', async ({ page }) => {
    const { username } = await registerAndVerify(page);
    await expect(page.locator(`text=${username}`)).toBeVisible();
  });

  test('can update bio and it persists', async ({ page }) => {
    await registerAndVerify(page);
    await page.fill('[name="bio"]', 'Guitar enthusiast');
    await page.click('[data-testid="save-profile"]');
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();

    await page.reload();
    await expect(page.locator('[name="bio"]')).toHaveValue('Guitar enthusiast');
  });

  test('other user profile page shows username and no edit form', async ({ page }) => {
    const { username: user1 } = await registerAndVerify(page);

    // Logout and register user2
    await page.click('[data-testid="nav-logout"]');
    const { username: user2 } = await registerAndVerify(page);
    void user2;

    // Visit user1's read-only profile
    await page.goto(`/en/profile/${user1}`);
    await expect(page.locator(`text=@${user1}`)).toBeVisible();
    // Read-only page has no save button
    await expect(page.locator('[data-testid="save-profile"]')).not.toBeVisible();
  });
});
