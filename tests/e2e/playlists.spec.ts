import { test, expect } from '@playwright/test';

test.describe('Playlists', () => {
  test('page loads and shows empty state', async ({ page }) => {
    await page.goto('/de/playlists');
    await expect(page.locator('h1')).toContainText('Playlists');
    await expect(page.locator('text=Noch keine Playlists')).toBeVisible();
  });

  test('create playlist and navigate to editor', async ({ page }) => {
    await page.goto('/de/playlists');

    // Click create button
    await page.click('text=Neue Playlist');

    // Fill in name
    const input = page.locator('input[placeholder]').first();
    await input.fill('Test Playlist');

    // Save (click the save button next to the input)
    await page.locator('button:has-text("Speichern")').first().click();

    // Should navigate to edit view - check for back button
    await expect(page.locator('text=Zurück zur Übersicht')).toBeVisible();
  });

  test('create playlist, add song with preset, save and verify', async ({ page }) => {
    await page.goto('/de/playlists');

    // Create playlist
    await page.click('text=Neue Playlist');
    const nameInput = page.locator('input[placeholder]').first();
    await nameInput.fill('E2E Test Playlist');
    await page.locator('button:has-text("Speichern")').first().click();

    // Now in editor view - add a song
    await page.click('text=Song hinzufügen');

    // Fill song name
    const songInput = page.locator('input[placeholder="z.B. Master of Puppets"]');
    await songInput.fill('Test Song');

    // Add YouTube URL
    const ytInput = page.locator('input[placeholder*="youtube"]');
    await ytInput.fill('https://youtube.com/watch?v=dQw4w9WgXcQ');

    // Upload a preset
    const fileInput = page.locator('input[type="file"][accept=".prst"]').first();
    await fileInput.setInputFiles('prst/63-B American Idiot.prst');

    // Verify preset chip appears
    await expect(page.locator('text=American Idiot')).toBeVisible({ timeout: 5000 });

    // Save playlist
    await page.locator('button:has-text("Speichern")').last().click();

    // Back to overview - should see our playlist
    await expect(page.locator('text=E2E Test Playlist')).toBeVisible();
    // Should show song count
    await expect(page.locator('text=1 Song')).toBeVisible();
  });

  test('open playlist in player mode', async ({ page }) => {
    await page.goto('/de/playlists');

    // Create a playlist with a song first
    await page.click('text=Neue Playlist');
    const nameInput = page.locator('input[placeholder]').first();
    await nameInput.fill('Player Test');
    await page.locator('button:has-text("Speichern")').first().click();

    // Add song
    await page.click('text=Song hinzufügen');
    await page.locator('input[placeholder="z.B. Master of Puppets"]').fill('My Song');
    await page.locator('input[placeholder*="youtube"]').fill('https://youtube.com/watch?v=dQw4w9WgXcQ');

    // Upload preset
    const fileInput = page.locator('input[type="file"][accept=".prst"]').first();
    await fileInput.setInputFiles('prst/63-B American Idiot.prst');
    await expect(page.locator('text=American Idiot')).toBeVisible({ timeout: 5000 });

    // Save
    await page.locator('button:has-text("Speichern")').last().click();
    await expect(page.locator('text=Player Test')).toBeVisible();

    // Click playlist name to open player
    await page.locator('text=Player Test').first().click();

    // Player view - check YouTube embed and song
    await expect(page.locator('text=My Song')).toBeVisible();
    await expect(page.locator('iframe[title*="YouTube"]')).toBeVisible();

    // Check preset chip
    await expect(page.locator('[role="tab"]')).toBeVisible();
  });

  test('navbar has playlists link', async ({ page }) => {
    await page.goto('/de');
    const playlistLink = page.locator('a[href*="playlists"]').first();
    await expect(playlistLink).toBeVisible();
    await expect(playlistLink).toContainText('Playlists');
  });

  test('playlists page works in English', async ({ page }) => {
    await page.goto('/en/playlists');
    await expect(page.locator('h1')).toContainText('Playlists');
    await expect(page.locator('text=No playlists yet')).toBeVisible();
  });

  test('editor has Add to Playlist button after loading preset', async ({ page }) => {
    await page.goto('/de/editor');

    // Upload a preset file via the hidden file input
    const fileInput = page.getByTestId('file-input');
    await fileInput.setInputFiles('prst/63-B American Idiot.prst');

    // Wait for preset to load - patch name should appear in the name input
    await expect(page.getByTestId('patch-name-input')).toHaveValue(/American Idiot/i, { timeout: 5000 });

    // Now the Add to Playlist button should be visible
    const btn = page.locator('button:has-text("Zur Playlist hinzufügen")');
    await expect(btn).toBeVisible();
  });
});
