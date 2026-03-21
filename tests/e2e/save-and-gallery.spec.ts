import { test, expect } from '@playwright/test';
import path from 'path';

// Use a real .prst file from the project (author field must be empty so save dialog pre-fills username)
const PRST_FILE = path.resolve(__dirname, '../../prst/63-C claude1.prst');
const PRESET_NAME = 'claude1';

const UNIQUE = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function registerAndLogin(page: import('@playwright/test').Page) {
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

test.describe('Register → Login → Editor → Save → Gallery', () => {
  test('full user flow: register, load preset, save with dialog, find in gallery', async ({ page }) => {
    // 1. Register
    const { username } = await registerAndLogin(page);

    // 2. Go to editor and load a .prst file
    await page.goto('/en/editor');
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(PRST_FILE);

    // Should see the preset loaded
    await expect(page.locator('[data-testid="patch-name-input"]')).toHaveValue(PRESET_NAME);
    await expect(page.locator('[data-testid="download-btn"]')).toBeVisible();

    // 3. Click "Save to My Presets" — should open dialog
    await page.click('[data-testid="save-to-presets-btn"]');

    // Dialog should be visible with author pre-filled
    await expect(page.locator('#save-author')).toBeVisible();
    await expect(page.locator('#save-author')).toHaveValue(username);

    // Fill in style and note
    await page.selectOption('#save-style', 'Rock');
    await page.fill('#save-note', 'E2E test preset');

    // Check "Publish to Gallery"
    await page.check('input[type="checkbox"]');

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to presets page
    await page.waitForURL('**/presets');

    // 4. Verify preset appears in user's preset list
    await expect(page.locator(`text=${PRESET_NAME}`).first()).toBeVisible();

    // 5. Go to gallery and find the published preset
    await page.goto('/en/gallery');
    await expect(page.locator(`text=${PRESET_NAME}`).first()).toBeVisible({ timeout: 5000 });

    // Verify author is shown on the card (style is only a filter, not displayed on cards)
    await expect(page.locator(`text=${username}`).first()).toBeVisible();
  });

  test('gallery search filters work', async ({ page }) => {
    // First create a preset to search for
    const { username } = await registerAndLogin(page);

    await page.goto('/en/editor');
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(PRST_FILE);
    await expect(page.locator('[data-testid="patch-name-input"]')).toHaveValue(PRESET_NAME);

    // Save with publish
    await page.click('[data-testid="save-to-presets-btn"]');
    await page.selectOption('#save-style', 'Metal');
    await page.fill('#save-note', 'Searchable preset');
    await page.check('input[type="checkbox"]');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/presets');

    // Go to gallery
    await page.goto('/en/gallery');

    // Search by name
    await page.fill('input[placeholder*="Search"]', 'claude');
    await page.waitForTimeout(500); // debounce
    await expect(page.locator(`text=${PRESET_NAME}`).first()).toBeVisible();

    // Clear search and filter by style
    await page.fill('input[placeholder*="Search"]', '');
    await page.waitForTimeout(500);
    await page.selectOption('select', 'Metal');
    await expect(page.locator(`text=${PRESET_NAME}`).first()).toBeVisible();

    // Filter by module — DST button should toggle and show presets with DST effects
    await page.selectOption('select', ''); // clear style filter
    await page.waitForTimeout(500);
    await page.click('button:has-text("DST")');
    await page.waitForTimeout(1000); // wait for data reload after filter
    // At least one DST preset should appear (from this or other test runs)
    await expect(page.locator('.grid > div').first()).toBeVisible();
  });

  test('save dialog can be cancelled', async ({ page }) => {
    await registerAndLogin(page);

    await page.goto('/en/editor');
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(PRST_FILE);
    await expect(page.locator('[data-testid="patch-name-input"]')).toHaveValue(PRESET_NAME);

    // Open save dialog
    await page.click('[data-testid="save-to-presets-btn"]');
    await expect(page.locator('#save-author')).toBeVisible();

    // Cancel
    await page.click('button:has-text("Cancel")');

    // Dialog should be closed, still on editor
    await expect(page.locator('#save-author')).not.toBeVisible();
    await expect(page.locator('[data-testid="patch-name-input"]')).toBeVisible();
  });

  test('load preset from disk button works in editor', async ({ page }) => {
    await registerAndLogin(page);

    await page.goto('/en/editor');

    // First load via drag zone to get into editor
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(PRST_FILE);
    await expect(page.locator('[data-testid="patch-name-input"]')).toHaveValue(PRESET_NAME);

    // Now use "Load from disk" button to load another file (same file, just testing the button works)
    const loadFromDisk = page.locator('label:has-text("Load preset from disk") input[type="file"]');
    await loadFromDisk.setInputFiles(PRST_FILE);

    // Should still show the preset
    await expect(page.locator('[data-testid="patch-name-input"]')).toHaveValue(PRESET_NAME);
  });

  test('unauthenticated user sees login prompt instead of save button', async ({ page }) => {
    await page.goto('/en/editor');
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(PRST_FILE);
    await expect(page.locator('[data-testid="patch-name-input"]')).toHaveValue(PRESET_NAME);

    // Should see "Sign in to save" text, not save button
    await expect(page.locator('text=Sign in to save')).toBeVisible();
  });

  test('gallery sort toggle works', async ({ page }) => {
    await page.goto('/en/gallery');

    // Default is newest
    const newestBtn = page.locator('button:has-text("Newest")');
    const popularBtn = page.locator('button:has-text("Most Popular")');

    await expect(newestBtn).toBeVisible();
    await expect(popularBtn).toBeVisible();

    // Switch to popular
    await popularBtn.click();
    await page.waitForTimeout(500);

    // Switch back to newest
    await newestBtn.click();
    await page.waitForTimeout(500);
  });
});
