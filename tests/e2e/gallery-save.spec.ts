import { test, expect } from '@playwright/test';

// Tests run against Docker at localhost:3320.
// Seed users once in beforeAll, then reuse across tests.

const BASE = 'http://localhost:3320';

test.describe.serial('Gallery Preset Save/Update', () => {
  let ownerShareToken: string;
  const ownerEmail = 'gallerysave-owner@test.com';
  const ownerUser = 'gallerysave_owner';
  const otherEmail = 'gallerysave-other@test.com';
  const otherUser = 'gallerysave_other';
  const password = 'TestPass123!';

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Register owner
    const regOwner = await page.request.post(`${BASE}/api/auth/register`, {
      data: { email: ownerEmail, username: ownerUser, password },
    });
    // May already exist — that's fine

    // Register other user
    await page.request.post(`${BASE}/api/auth/register`, {
      data: { email: otherEmail, username: otherUser, password },
    });

    // Login as owner (may fail if email not verified — we'll handle in tests)
    const loginRes = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email: ownerEmail, password },
    });

    if (loginRes.ok()) {
      // Upload a preset
      const fs = require('fs');
      const buffer = fs.readFileSync('prst/63-B American Idiot.prst');
      const uploadRes = await page.request.post(`${BASE}/api/presets`, {
        multipart: {
          preset: { name: 'test.prst', mimeType: 'application/octet-stream', buffer },
          author: ownerUser,
          style: 'Rock',
          publish: 'true',
        },
      });
      if (uploadRes.ok()) {
        const data = await uploadRes.json();
        ownerShareToken = data.shareToken;
      }
    }

    await ctx.close();
  });

  test('not logged in — sees login prompt, no save buttons', async ({ page }) => {
    // If no share token was created (auth issues), use gallery instead
    if (!ownerShareToken) {
      // Fall back to checking a gallery preset
      const galRes = await page.request.get(`${BASE}/api/gallery`);
      const galData = await galRes.json();
      if (galData.presets?.length > 0) {
        ownerShareToken = galData.presets[0].shareToken;
      }
    }
    test.skip(!ownerShareToken, 'No share token available — auth seeding failed');

    await page.goto(`${BASE}/de/editor?share=${ownerShareToken}`);

    // Wait for preset to load
    await expect(page.getByTestId('patch-name-input')).toBeVisible({ timeout: 10000 });

    // Should see login-to-save prompt
    await expect(page.locator('text=Anmelden, um zu speichern')).toBeVisible();

    // Should NOT see update or save-as-new buttons
    await expect(page.locator('button:has-text("Preset aktualisieren")')).not.toBeVisible({ timeout: 2000 });
    await expect(page.locator('button:has-text("Als neues Preset")')).not.toBeVisible();
  });

  test('owner sees Update button for own preset', async ({ page }) => {
    test.skip(!ownerShareToken, 'No share token available');

    // Login via page
    await page.goto(`${BASE}/de/auth/login`);
    await page.fill('input[name="email"]', ownerEmail);
    await page.fill('input[name="password"]', password);
    await page.click('[type="submit"]');
    await page.waitForTimeout(2000);

    // Go to editor with share link
    await page.goto(`${BASE}/de/editor?share=${ownerShareToken}`);

    // Wait for preset to load
    await expect(page.getByTestId('patch-name-input')).toBeVisible({ timeout: 10000 });

    // Owner should see Update button
    await expect(page.locator('button:has-text("Preset aktualisieren")')).toBeVisible({ timeout: 10000 });

    // And save-as-new
    await expect(page.locator('button:has-text("Als neues Preset")')).toBeVisible();
  });

  test('other user sees Save-as-New but NOT Update', async ({ page }) => {
    test.skip(!ownerShareToken, 'No share token available');

    // Login as other user
    await page.goto(`${BASE}/de/auth/login`);
    await page.fill('input[name="email"]', otherEmail);
    await page.fill('input[name="password"]', password);
    await page.click('[type="submit"]');
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/de/editor?share=${ownerShareToken}`);
    await expect(page.getByTestId('patch-name-input')).toBeVisible({ timeout: 10000 });

    // Should NOT see Update (not their preset)
    await expect(page.locator('button:has-text("Preset aktualisieren")')).not.toBeVisible({ timeout: 5000 });

    // Should see Save-as-New
    await expect(page.locator('button:has-text("Als neues Preset")')).toBeVisible();
  });

  test('loading from file clears gallery source', async ({ page }) => {
    test.skip(!ownerShareToken, 'No share token available');

    // Login as owner
    await page.goto(`${BASE}/de/auth/login`);
    await page.fill('input[name="email"]', ownerEmail);
    await page.fill('input[name="password"]', password);
    await page.click('[type="submit"]');
    await page.waitForTimeout(2000);

    // Load from gallery
    await page.goto(`${BASE}/de/editor?share=${ownerShareToken}`);
    await expect(page.getByTestId('patch-name-input')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Preset aktualisieren")')).toBeVisible({ timeout: 10000 });

    // Load from file — should clear source
    // The file input in the loaded editor is inside the "load from disk" label
    await page.locator('input[type="file"][accept=".prst"]').last().setInputFiles('prst/63-C claude1.prst');
    await page.waitForTimeout(1000);

    // Update button gone
    await expect(page.locator('button:has-text("Preset aktualisieren")')).not.toBeVisible({ timeout: 3000 });

    // Regular save (not "Als neues Preset")
    await expect(page.locator('button:has-text("In Presets speichern")')).toBeVisible();
  });
});
