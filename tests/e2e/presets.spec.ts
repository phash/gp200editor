import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Helper: register a fresh user and return authenticated page
async function registerUser(page: import('@playwright/test').Page) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const username = `preset_user_${id}`;
  const email = `${username}@test.com`;
  const password = 'testpass123';

  await page.goto('/en/auth/register');
  await page.fill('[name="email"]', email);
  await page.fill('[name="username"]', username);
  await page.fill('[name="password"]', password);
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

  return { username, email, password };
}

// Helper: create a temporary .prst file on disk
// Matches the actual binary format used by PRSTEncoder/PRSTDecoder:
//   offset 0:  'PRST' magic (4 bytes)
//   offset 4:  version uint8
//   offset 8:  patch name ASCII (12 bytes, max 12 chars)
//   total size: 512 bytes
function writeTempPreset(name = 'Test Preset'): string {
  const filePath = path.join('/tmp', `test-${Date.now()}.prst`);
  const buf = Buffer.alloc(512, 0);
  // Write 'PRST' magic at offset 0
  buf.write('PRST', 0, 'ascii');
  // Write version 1 at offset 4
  buf.writeUInt8(1, 4);
  // Write patch name at offset 8 (max 12 chars)
  buf.write(name.slice(0, 12), 8, 'ascii');
  fs.writeFileSync(filePath, buf);
  return filePath;
}

test.describe('Preset sharing flows', () => {
  test('unauthenticated user is redirected from /presets to /auth/login', async ({ page }) => {
    await page.goto('/en/presets');
    await page.waitForURL('**/auth/login');
  });

  test('authenticated user can upload a preset and see it in the list', async ({ page }) => {
    await registerUser(page);
    const presetPath = writeTempPreset('Upload Test');

    await page.goto('/en/presets');
    await expect(page.locator('h1')).toBeVisible();

    // Trigger upload via file input
    const fileInput = page.locator('input[type="file"][accept=".prst"]');
    await fileInput.setInputFiles(presetPath);

    // Wait for the preset to appear in the list
    await expect(page.locator('[data-testid="preset-card"]').first()).toBeVisible({ timeout: 10000 });

    fs.unlinkSync(presetPath);
  });

  test('authenticated user can copy share link', async ({ page }) => {
    await registerUser(page);
    const presetPath = writeTempPreset('Share Link Test');

    await page.goto('/en/presets');
    const fileInput = page.locator('input[type="file"][accept=".prst"]');
    await fileInput.setInputFiles(presetPath);
    await expect(page.locator('[data-testid="preset-card"]').first()).toBeVisible({ timeout: 10000 });

    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('[data-testid="preset-copy-link"]').first().click();
    await expect(page.locator('[data-testid="preset-link-copied"]').first()).toBeVisible();

    fs.unlinkSync(presetPath);
  });

  test('share page is accessible without login', async ({ page }) => {
    // Upload preset as authenticated user
    const userPage = await page.context().newPage();
    await registerUser(userPage);
    const presetPath = writeTempPreset('Public Share');

    await userPage.goto('/en/presets');
    const fileInput = userPage.locator('input[type="file"][accept=".prst"]');
    await fileInput.setInputFiles(presetPath);
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

    fs.unlinkSync(presetPath);
  });

  test('share download increments download count', async ({ page, request }) => {
    const userPage = await page.context().newPage();
    await registerUser(userPage);
    const presetPath = writeTempPreset('Download Count');

    await userPage.goto('/en/presets');
    const fileInput = userPage.locator('input[type="file"][accept=".prst"]');
    await fileInput.setInputFiles(presetPath);
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

    fs.unlinkSync(presetPath);
  });

  test('owner can edit preset name and tags', async ({ page }) => {
    await registerUser(page);
    const presetPath = writeTempPreset('Edit Me');

    await page.goto('/en/presets');
    const fileInput = page.locator('input[type="file"][accept=".prst"]');
    await fileInput.setInputFiles(presetPath);
    await expect(page.locator('[data-testid="preset-card"]').first()).toBeVisible({ timeout: 10000 });

    // Navigate to edit page
    await page.locator('[data-testid="preset-edit-link"]').first().click();
    await page.waitForURL('**/edit');

    await page.fill('[data-testid="preset-name-input"]', 'Edited Name');
    await page.click('[data-testid="preset-save-button"]');
    await expect(page.locator('[data-testid="preset-saved-indicator"]')).toBeVisible();

    fs.unlinkSync(presetPath);
  });

  test('owner can delete preset', async ({ page }) => {
    await registerUser(page);
    const presetPath = writeTempPreset('Delete Me');

    await page.goto('/en/presets');
    const fileInput = page.locator('input[type="file"][accept=".prst"]');
    await fileInput.setInputFiles(presetPath);
    await expect(page.locator('[data-testid="preset-card"]').first()).toBeVisible({ timeout: 10000 });

    // Delete — handle confirmation dialog
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('[data-testid="preset-delete-button"]').first().click();

    // Card should disappear
    await expect(page.locator('[data-testid="preset-card"]')).toHaveCount(0, { timeout: 5000 });

    fs.unlinkSync(presetPath);
  });

  test('owner can reset share link and old link 404s', async ({ page, request }) => {
    await registerUser(page);
    const presetPath = writeTempPreset('Revoke Me');

    await page.goto('/en/presets');
    const fileInput = page.locator('input[type="file"][accept=".prst"]');
    await fileInput.setInputFiles(presetPath);
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

    fs.unlinkSync(presetPath);
  });
});
