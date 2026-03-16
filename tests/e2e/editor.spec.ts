import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('zeigt Headline und Upload-CTA', async ({ page }) => {
    await page.goto('/de');
    await expect(page.getByTestId('home-upload-cta')).toBeVisible();
    await expect(page.locator('h1')).toContainText('GP-200');
  });

  test('Navbar zeigt Sprachschalter', async ({ page }) => {
    await page.goto('/de');
    await expect(page.getByTestId('nav-locale-switcher')).toBeVisible();
  });

  test('Sprache wechseln zu EN', async ({ page }) => {
    await page.goto('/de');
    await page.getByTestId('nav-locale-switcher').click();
    await expect(page).toHaveURL(/\/en/);
    await expect(page.locator('h1')).toContainText('GP-200');
  });
});

test.describe('Editor Page', () => {
  test('zeigt Upload-Zone wenn kein Preset geladen', async ({ page }) => {
    await page.goto('/de/editor');
    await expect(page.getByTestId('file-upload-zone')).toBeVisible();
  });

  test('zeigt Editor-UI nach Preset-Upload', async ({ page }) => {
    await page.goto('/de/editor');

    // Create minimal test buffer: "PRST" magic + version + PatchName "TestPatch"
    const testPreset = Buffer.alloc(512, 0);
    testPreset.write('PRST', 0, 'ascii');  // Magic Header
    testPreset[4] = 0x01;                  // Version byte
    testPreset.write('TestPatch', 8, 'ascii'); // Patch Name at offset 8

    // Upload via hidden file input
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: 'test.prst',
      mimeType: 'application/octet-stream',
      buffer: testPreset,
    });

    // Editor UI must appear
    await expect(page.getByTestId('patch-name-input')).toBeVisible();
    await expect(page.getByTestId('download-btn')).toBeVisible();

    // Patch name from file must be in the input
    await expect(page.getByTestId('patch-name-input')).toHaveValue('TestPatch');
  });
});
