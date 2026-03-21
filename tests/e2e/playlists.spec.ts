import { test, expect } from '@playwright/test';
import * as fs from 'fs';

// QP decode helper (Mailhog returns Quoted-Printable encoded bodies)
function decodeQP(text: string): string {
  return text
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

// Seed gallery presets once for gallery picker tests
let gallerySeeded = false;

async function seedGalleryPresets(request: import('@playwright/test').APIRequestContext) {
  if (gallerySeeded) return;

  const email = `playlist_seed_${Date.now()}@test.com`;
  const username = `playlist_seed_${Date.now() % 100000}`;

  // Register
  const regRes = await request.post('/api/auth/register', {
    data: { email, username, password: 'testpass123' },
  });
  if (!regRes.ok()) return;

  // Verify email via Mailhog (search by recipient)
  const mailbox = email.split('@')[0];
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    const mailhogRes = await request.get(
      `http://localhost:8025/api/v2/search?kind=to&query=${mailbox}`,
    );
    const result = await mailhogRes.json();
    const verifyEmail = result.items?.find(
      (m: { Content: { Body: string } }) =>
        m.Content.Body.includes('verify-email'),
    );
    if (verifyEmail) {
      const body = decodeQP(verifyEmail.Content.Body);
      const tokenMatch = body.match(/token=([a-f0-9]{64})/);
      if (tokenMatch) {
        await request.get(`/api/auth/verify-email?token=${tokenMatch[1]}`);
        break;
      }
    }
  }

  // Upload and publish presets
  const presetFiles = ['prst/63-B American Idiot.prst', 'prst/63-C claude1.prst'];
  for (const file of presetFiles) {
    if (!fs.existsSync(file)) continue;
    const uploadRes = await request.post('/api/presets', {
      multipart: {
        preset: { name: file.split('/').pop()!, mimeType: 'application/octet-stream', buffer: fs.readFileSync(file) },
        publish: 'true',
      },
    });
    if (!uploadRes.ok()) continue;
    const preset = await uploadRes.json();
    await request.post(`/api/presets/${preset.id}/publish`);
  }

  gallerySeeded = true;
}

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
    await expect(page.locator('text=American Idiot').first()).toBeVisible({ timeout: 5000 });

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
    await expect(page.locator('text=American Idiot').first()).toBeVisible({ timeout: 5000 });

    // Save
    await page.locator('button:has-text("Speichern")').last().click();
    await expect(page.locator('text=Player Test')).toBeVisible();

    // Click playlist name to open player
    await page.locator('text=Player Test').first().click();

    // Player view - check YouTube embed and song
    await expect(page.locator('text=My Song')).toBeVisible();
    await expect(page.locator('iframe')).toBeVisible();

    // Check Cue Points section exists
    await expect(page.locator('text=Cue Points').first()).toBeVisible();
  });

  test('add presets from gallery picker', async ({ page }) => {
    // Seed gallery with published presets
    await seedGalleryPresets(page.request);

    await page.goto('/de/playlists');

    // Create playlist
    await page.click('text=Neue Playlist');
    const nameInput = page.locator('input[placeholder]').first();
    await nameInput.fill('Gallery Picker Test');
    await page.locator('button:has-text("Speichern")').first().click();

    // Add a song
    await page.click('text=Song hinzufügen');
    await page.locator('input[placeholder="z.B. Master of Puppets"]').fill('Gallery Song');

    // Click "Aus Galerie" button
    await page.locator('button:has-text("Aus Galerie")').click();

    // Gallery picker dialog should open
    await expect(page.locator('text=Presets aus Galerie wählen')).toBeVisible();

    // Should show gallery presets (wait for fetch)
    await expect(page.locator('text=American Idiot').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=claude1').first()).toBeVisible();

    // Select 2 presets by clicking them
    await page.locator('button:has-text("American Idiot")').first().click();
    await page.locator('button:has-text("claude1")').first().click();

    // Should show "2 ausgewählt"
    await expect(page.locator('text=2 ausgewählt')).toBeVisible();

    // Click Add button
    await page.locator('button:has-text("Hinzufügen (2)")').click();

    // Dialog should close, presets should appear as chips in the song
    await expect(page.locator('text=Presets aus Galerie wählen')).not.toBeVisible({ timeout: 10000 });

    // Both preset names should appear as chips in the editor
    await expect(page.locator('span:has-text("American Idiot")').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('span:has-text("claude1")').first()).toBeVisible({ timeout: 5000 });

    // Save and verify
    await page.locator('button:has-text("Speichern")').last().click();
    await expect(page.locator('text=Gallery Picker Test')).toBeVisible();
  });

  test('gallery picker search and filter', async ({ page }) => {
    await seedGalleryPresets(page.request);

    await page.goto('/de/playlists');

    // Create playlist and add song
    await page.click('text=Neue Playlist');
    await page.locator('input[placeholder]').first().fill('Filter Test');
    await page.locator('button:has-text("Speichern")').first().click();
    await page.click('text=Song hinzufügen');
    await page.locator('input[placeholder="z.B. Master of Puppets"]').fill('Filter Song');

    // Open gallery picker
    await page.locator('button:has-text("Aus Galerie")').click();
    await expect(page.locator('text=Presets aus Galerie wählen')).toBeVisible();

    // Wait for presets to load
    await expect(page.locator('text=American Idiot').first()).toBeVisible({ timeout: 10000 });

    // Search for "claude"
    const searchInput = page.locator('input[placeholder*="durchsuchen"]');
    await searchInput.fill('claude');

    // Should filter to only claude1
    await expect(page.locator('text=claude1').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("American Idiot")')).toHaveCount(0, { timeout: 3000 });

    // Clear search
    await searchInput.clear();
    await expect(page.locator('text=American Idiot').first()).toBeVisible({ timeout: 5000 });

    // Close with ESC
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Presets aus Galerie wählen')).not.toBeVisible();
  });

  test('gallery picker max 5 selection limit', async ({ page }) => {
    await seedGalleryPresets(page.request);

    await page.goto('/de/playlists');

    // Create playlist + song
    await page.click('text=Neue Playlist');
    await page.locator('input[placeholder]').first().fill('Max Test');
    await page.locator('button:has-text("Speichern")').first().click();
    await page.click('text=Song hinzufügen');
    await page.locator('input[placeholder="z.B. Master of Puppets"]').fill('Max Song');

    // Open gallery picker
    await page.locator('button:has-text("Aus Galerie")').click();
    await expect(page.locator('text=American Idiot').first()).toBeVisible({ timeout: 10000 });

    // Select available presets (we only have 2 seeded)
    await page.locator('button:has-text("American Idiot")').first().click();
    await page.locator('button:has-text("claude1")').first().click();

    await expect(page.locator('text=2 ausgewählt')).toBeVisible();

    // Add button should show count
    await expect(page.locator('button:has-text("Hinzufügen (2)")')).toBeVisible();

    // Close without adding
    await page.keyboard.press('Escape');
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
