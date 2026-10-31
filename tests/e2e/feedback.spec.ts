import { test, expect } from '@playwright/test';
import { registerAndVerifyViaAPI } from './helpers';

test.describe('Feedback form', () => {
  test('navbar CTA is visible and asks anonymous users to sign in', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const cta = page.locator('[data-testid="nav-feedback-cta"]');
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page.locator('[data-testid="feedback-login-required"]')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-form"]')).toHaveCount(0);
  });

  test('verified user can send feedback with page context', async ({ page, baseURL }) => {
    await registerAndVerifyViaAPI(page.context().request, baseURL);

    await page.goto('/gallery', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="nav-feedback-cta"]').click();
    await expect(page).toHaveURL(/\/feedback\?from=%2Fgallery/);
    await expect(page.locator('[data-testid="feedback-form"]')).toBeVisible();
    // Submit is enabled once React has hydrated; typing earlier gets reset.
    await expect(page.locator('[data-testid="feedback-submit"]')).toBeEnabled();

    await page.locator('[data-testid="feedback-category-IDEA"]').click();
    await page.locator('[data-testid="feedback-message"]').fill(`E2E idea ${Date.now()}: please add undo`);
    await page.locator('[data-testid="feedback-submit"]').click();
    await expect(page.locator('[data-testid="feedback-success"]')).toBeVisible();
  });

  test('rejects cross-origin posts', async ({ request, baseURL }) => {
    const res = await request.post(`${baseURL}/api/feedback`, {
      data: { category: 'BUG', message: 'cross origin attempt here' },
      headers: { origin: 'https://evil.example' },
    });
    expect(res.status()).toBe(403);
  });
});
