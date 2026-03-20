import { test, expect } from '@playwright/test';

test.describe('Offline / PWA', () => {
  test('service worker registers and activates', async ({ page }) => {
    await page.goto('/de/editor');

    const swActive = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });

    expect(swActive).toBe(true);
  });

  test('editor loads offline after caching', async ({ page, context }) => {
    // First visit — SW registers and activates (skipWaiting + clients.claim)
    await page.goto('/de/editor');
    await expect(page.locator('h1')).toBeVisible();

    // Wait for SW to claim this page
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      // Wait a bit for claim to propagate
      await new Promise(r => setTimeout(r, 500));
    });

    // Second visit — SW intercepts fetch, caches the response
    await page.reload();
    await expect(page.locator('h1')).toBeVisible();

    // Now go offline
    await context.setOffline(true);

    // Reload — should serve from SW cache
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch {
      // Some navigations throw in offline but page still renders
    }

    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  });

  test('playlists page loads offline after caching', async ({ page, context }) => {
    await page.goto('/de/playlists');
    await expect(page.locator('h1')).toContainText('Playlists');

    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      await new Promise(r => setTimeout(r, 500));
    });

    // Second visit to cache
    await page.reload();
    await expect(page.locator('h1')).toContainText('Playlists');

    await context.setOffline(true);

    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch {
      // may throw offline
    }

    await expect(page.locator('h1')).toContainText('Playlists', { timeout: 10000 });
  });

  test('playlist data persists offline via IndexedDB', async ({ page, context }) => {
    // Create playlist online
    await page.goto('/de/playlists');
    await page.click('text=Neue Playlist');
    await page.locator('input[placeholder]').first().fill('Offline Persist');
    await page.locator('button:has-text("Speichern")').first().click();
    await page.locator('text=Zurück zur Übersicht').click();
    await expect(page.locator('text=Offline Persist')).toBeVisible();

    // Ensure SW is active and page is cached
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      await new Promise(r => setTimeout(r, 500));
    });
    await page.reload();
    await expect(page.locator('text=Offline Persist')).toBeVisible();

    // Go offline
    await context.setOffline(true);

    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch {
      // may throw offline
    }

    // Playlist should still be visible (IndexedDB persists)
    await expect(page.locator('text=Offline Persist')).toBeVisible({ timeout: 10000 });
  });

  test('YouTube embed shows offline placeholder', async ({ page, context }) => {
    // Create playlist with YouTube song
    await page.goto('/de/playlists');
    await page.click('text=Neue Playlist');
    await page.locator('input[placeholder]').first().fill('YT Offline');
    await page.locator('button:has-text("Speichern")').first().click();

    await page.click('text=Song hinzufügen');
    await page.locator('input[placeholder="z.B. Master of Puppets"]').fill('Offline Song');
    await page.locator('input[placeholder*="youtube"]').fill('https://youtube.com/watch?v=dQw4w9WgXcQ');

    const fileInput = page.locator('input[type="file"][accept=".prst"]').first();
    await fileInput.setInputFiles('prst/63-B American Idiot.prst');
    await expect(page.locator('text=American Idiot')).toBeVisible({ timeout: 5000 });

    await page.locator('button:has-text("Speichern")').last().click();
    await expect(page.locator('text=YT Offline')).toBeVisible();

    // Open player — YouTube should work online
    await page.locator('text=YT Offline').first().click();
    await expect(page.locator('text=Offline Song')).toBeVisible();
    await expect(page.locator('iframe[title*="YouTube"]')).toBeVisible({ timeout: 5000 });

    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(1000);

    // YouTube should be replaced with offline placeholder
    await expect(page.locator('text=Video offline nicht verfügbar')).toBeVisible({ timeout: 5000 });
  });
});
