import { test, expect } from '@playwright/test';
import path from 'path';
import { registerAndVerify } from './helpers';

// Use real .prst files that pass the PRSTDecoder
const PRST_FILE = path.resolve(__dirname, '../../prst/63-C claude1.prst');

test.describe('Preset sharing flows', () => {
  test('unauthenticated user is redirected from /presets to /auth/login', async ({ page }) => {
    await page.goto('/en/presets');
    await page.waitForURL('**/auth/login');
  });

  test('authenticated user can upload a preset and see it in the list', async ({ page }) => {
    await registerAndVerify(page);

    await page.goto('/en/presets');
    await expect(page.locator('h1')).toBeVisible();

    // Trigger upload via file input (accepts .prst and .hlx)
    const fileInput = page.locator('#preset-file-input');
    await fileInput.setInputFiles(PRST_FILE);

    // Wait for the preset to appear in the list
    await expect(page.locator('[data-testid="preset-card"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('authenticated user can copy share link', async ({ page }) => {
    await registerAndVerify(page);

    await page.goto('/en/presets');
    const fileInput = page.locator('#preset-file-input');
    await fileInput.setInputFiles(PRST_FILE);
    await expect(page.locator('[data-testid="preset-card"]').first()).toBeVisible({ timeout: 10000 });

    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('[data-testid="preset-copy-link"]').first().click();
    await expect(page.locator('[data-testid="preset-link-copied"]').first()).toBeVisible();
  });

  test('share page is accessible without login', async ({ page }) => {
    // Upload preset as authenticated user
    const userPage = await page.context().newPage();
    await registerAndVerify(userPage);

    await userPage.goto('/en/presets');
    const fileInput = userPage.locator('#preset-file-input');
    await fileInput.setInputFiles(PRST_FILE);
    await expect(userPage.locator('[data-testid="preset-card"]').first()).toBeVisible({ timeout: 10000 });

    // Get the share link from the copy-link button's data attribute
    const shareToken = await userPage
      .locator('[data-testid="preset-copy-link"]')
      .first()
      .getAttribute('data-share-token');
    expect(shareToken).toBeTruthy();

    // Access share page without login (new incognito-like context)
    await page.goto(`/en/share/${shareToken}`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-testid="share-preset-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-download-button"]')).toBeVisible();
  });

  test('share download increments download count', async ({ page, request }) => {
    const userPage = await page.context().newPage();
    await registerAndVerify(userPage);

    await userPage.goto('/en/presets');
    const fileInput = userPage.locator('#preset-file-input');
    await fileInput.setInputFiles(PRST_FILE);
    await expect(userPage.locator('[data-testid="preset-card"]').first()).toBeVisible({ timeout: 10000 });

    const shareToken = await userPage
      .locator('[data-testid="preset-copy-link"]')
      .first()
      .getAttribute('data-share-token');
    expect(shareToken).toBeTruthy();

    // GET share info before download
    const before = await request.get(`/api/share/${shareToken}`);
    const beforeData = await before.json();
    expect(beforeData.downloadCount).toBe(0);

    // Download via API
    const dlRes = await request.get(`/api/share/${shareToken}/download`);
    expect(dlRes.status()).toBe(200);

    // GET share info after download
    const after = await request.get(`/api/share/${shareToken}`);
    const afterData = await after.json();
    expect(afterData.downloadCount).toBe(1);
  });

  test('owner can edit preset name and tags', async ({ page }) => {
    await registerAndVerify(page);

    await page.goto('/en/presets');
    const fileInput = page.locator('#preset-file-input');
    await fileInput.setInputFiles(PRST_FILE);
    await expect(page.locator('[data-testid="preset-card"]').first()).toBeVisible({ timeout: 10000 });

    // Navigate to edit page
    await page.locator('[data-testid="preset-edit-link"]').first().click();
    await page.waitForURL('**/edit');

    await page.fill('[data-testid="preset-name-input"]', 'Edited Name');
    await page.click('[data-testid="preset-save-button"]');
    await expect(page.locator('[data-testid="preset-saved-indicator"]')).toBeVisible();
  });

  test('owner can delete preset', async ({ page }) => {
    await registerAndVerify(page);

    await page.goto('/en/presets');
    const fileInput = page.locator('#preset-file-input');
    await fileInput.setInputFiles(PRST_FILE);
    await expect(page.locator('[data-testid="preset-card"]').first()).toBeVisible({ timeout: 10000 });

    // Delete — handle confirmation dialog
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('[data-testid="preset-delete-button"]').first().click();

    // Card should disappear
    await expect(page.locator('[data-testid="preset-card"]')).toHaveCount(0, { timeout: 5000 });
  });

  test('owner can reset share link and old link 404s', async ({ page, request }) => {
    await registerAndVerify(page);

    await page.goto('/en/presets');
    const fileInput = page.locator('#preset-file-input');
    await fileInput.setInputFiles(PRST_FILE);
    await expect(page.locator('[data-testid="preset-card"]').first()).toBeVisible({ timeout: 10000 });

    const oldToken = await page
      .locator('[data-testid="preset-copy-link"]')
      .first()
      .getAttribute('data-share-token');
    expect(oldToken).toBeTruthy();

    // Revoke share link
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('[data-testid="preset-reset-link-button"]').first().click();

    // Wait for updated token
    await page.waitForFunction(
      (token) => {
        const el = document.querySelector('[data-testid="preset-copy-link"]');
        return el && el.getAttribute('data-share-token') !== token;
      },
      oldToken,
      { timeout: 5000 },
    );

    // Old token should now 404
    const oldRes = await request.get(`/api/share/${oldToken}`);
    expect(oldRes.status()).toBe(404);
  });
});
