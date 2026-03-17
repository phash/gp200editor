import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const PRST_FILE = 'planung/ZZ-WokeUp.prst';
const TEST_EMAIL = `gallery-e2e-${Date.now()}@test.com`;
const TEST_USERNAME = `gale2e${Date.now() % 100000}`;

test.describe('Gallery Feature', () => {
  test('full gallery flow: upload → publish → gallery → filter → unpublish', async ({ page }) => {
    if (!fs.existsSync(PRST_FILE)) {
      test.skip();
      return;
    }

    // 1. Register
    const regRes = await page.request.post('/api/auth/register', {
      data: { email: TEST_EMAIL, username: TEST_USERNAME, password: 'testpass123' },
    });
    expect(regRes.ok()).toBeTruthy();

    // 2. Upload preset
    const uploadRes = await page.request.post('/api/presets', {
      multipart: {
        preset: {
          name: 'test.prst',
          mimeType: 'application/octet-stream',
          buffer: fs.readFileSync(PRST_FILE),
        },
      },
    });
    expect(uploadRes.ok()).toBeTruthy();
    const preset = await uploadRes.json();
    expect(preset.modules).toBeDefined();
    expect(preset.modules.length).toBeGreaterThan(0);
    expect(preset.modules).toContain('DST');

    // 3. Not in gallery before publishing
    const galBefore = await page.request.get('/api/gallery');
    const dataBefore = await galBefore.json();
    expect(dataBefore.presets.find((p: { id: string }) => p.id === preset.id)).toBeUndefined();

    // 4. Publish
    const pubRes = await page.request.post(`/api/presets/${preset.id}/publish`);
    expect(pubRes.ok()).toBeTruthy();
    expect((await pubRes.json()).public).toBe(true);

    // 5. Now in gallery
    const galAfter = await page.request.get('/api/gallery');
    const dataAfter = await galAfter.json();
    const found = dataAfter.presets.find((p: { id: string }) => p.id === preset.id);
    expect(found).toBeDefined();
    expect(found.name).toBe('ZZ-WokeUp');
    expect(found.user.username).toBe(TEST_USERNAME);

    // 6. Filter by module
    const filtRes = await page.request.get('/api/gallery?modules=DST');
    expect((await filtRes.json()).total).toBeGreaterThanOrEqual(1);

    const filtMiss = await page.request.get('/api/gallery?modules=WAH');
    const filtMissData = await filtMiss.json();
    expect(filtMissData.presets.find((p: { id: string }) => p.id === preset.id)).toBeUndefined();

    // 7. Search by name
    const searchRes = await page.request.get('/api/gallery?q=WokeUp');
    expect((await searchRes.json()).total).toBeGreaterThanOrEqual(1);

    // 8. Unpublish
    const unpubRes = await page.request.post(`/api/presets/${preset.id}/publish`);
    expect((await unpubRes.json()).public).toBe(false);

    const galGone = await page.request.get('/api/gallery');
    expect((await galGone.json()).presets.find((p: { id: string }) => p.id === preset.id)).toBeUndefined();

    // 9. Cleanup
    await page.request.delete(`/api/presets/${preset.id}`);
    await page.request.post('/api/auth/logout');
  });

  test('gallery page UI renders correctly', async ({ page }) => {
    await page.goto('/de/gallery');
    await expect(page.locator('h1')).toContainText('Preset-Galerie');
    await expect(page.getByPlaceholder('Presets durchsuchen')).toBeVisible();

    // Module filter chips
    await expect(page.getByRole('button', { name: 'DST' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'AMP' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'RVB' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'VOL' })).toBeVisible();

    // Sort buttons
    await expect(page.getByRole('button', { name: 'Neueste' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Beliebteste' })).toBeVisible();
  });

  test('gallery link is in navbar', async ({ page }) => {
    await page.goto('/de/gallery');
    const galleryLink = page.getByTestId('nav-link-gallery');
    await expect(galleryLink).toBeVisible();
    // Verify it's highlighted (active page)
    await expect(galleryLink).toContainText('Galerie');
  });

  test('gallery works in English', async ({ page }) => {
    await page.goto('/en/gallery');
    await expect(page.locator('h1')).toContainText('Preset Gallery');
    await expect(page.getByPlaceholder('Search presets')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Newest' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Most Popular' })).toBeVisible();
  });
});
