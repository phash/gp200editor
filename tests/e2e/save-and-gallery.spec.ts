import { test, expect } from '@playwright/test';
import path from 'path';

// Use a real .prst file from the project
const PRST_FILE = path.resolve(__dirname, '../../prst/63-C claude1.prst');

import { registerAndVerify } from './helpers';

test.describe('Register → Login → Editor → Save → Gallery', () => {
  test('full user flow: register, load preset, save with dialog, find in gallery', async ({ page }) => {
    // 1. Register
    const { username } = await registerAndVerify(page);

    // 2. Go to editor and load a .prst file
    await page.goto('/en/editor');
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(PRST_FILE);

    // Should see the preset loaded
    await expect(page.locator('[data-testid="patch-name-input"]')).toHaveValue(/claude1/i);
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
    await expect(page.locator('text=claude1').first()).toBeVisible();

    // 5. Go to gallery and find the published preset
    await page.goto('/en/gallery');
    await expect(page.locator('text=claude1').first()).toBeVisible({ timeout: 5000 });

    // Verify author and style are shown
    await expect(page.locator(`text=${username}`).first()).toBeVisible();
    // Verify style is shown as inline span (not the hidden <option>)
    await expect(page.locator('span:has-text("Rock"):visible').first()).toBeVisible({ timeout: 5000 });
  });

  test('gallery search filters work', async ({ page }) => {
    // First create a preset to search for
    const { username } = await registerAndVerify(page);

    await page.goto('/en/editor');
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(PRST_FILE);
    await expect(page.locator('[data-testid="patch-name-input"]')).toHaveValue(/claude1/i);

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
    await page.fill('input[placeholder*="Search"]', 'claude1');
    await page.waitForTimeout(500); // debounce
    await expect(page.locator('text=claude1').first()).toBeVisible();

    // Clear search and filter by style
    await page.fill('input[placeholder*="Search"]', '');
    await page.waitForTimeout(500);
    await page.selectOption('select', 'Metal');
    await expect(page.locator('text=claude1').first()).toBeVisible();
  });

  test('save dialog can be cancelled', async ({ page }) => {
    await registerAndVerify(page);

    await page.goto('/en/editor');
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(PRST_FILE);
    await expect(page.locator('[data-testid="patch-name-input"]')).toHaveValue(/claude1/i);

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
    await registerAndVerify(page);

    await page.goto('/en/editor');

    // First load via drag zone to get into editor
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(PRST_FILE);
    await expect(page.locator('[data-testid="patch-name-input"]')).toHaveValue(/claude1/i);

    // Now use "Load from disk" button to load another file (same file, just testing the button works)
    const loadFromDisk = page.locator('label:has-text("Load preset from disk") input[type="file"]');
    await loadFromDisk.setInputFiles(PRST_FILE);

    // Should still show the preset
    await expect(page.locator('[data-testid="patch-name-input"]')).toHaveValue(/claude1/i);
  });

  test('unauthenticated user sees login prompt instead of save button', async ({ page }) => {
    await page.goto('/en/editor');
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(PRST_FILE);
    await expect(page.locator('[data-testid="patch-name-input"]')).toHaveValue(/claude1/i);

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
