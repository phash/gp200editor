import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('zeigt Headline und Upload-CTA', async ({ page }) => {
    await page.goto('/de');
    // Home redirects to editor — check upload zone as CTA
    await expect(page.getByTestId('file-upload-zone')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Preset');
  });

  test('Navbar zeigt Sprachschalter', async ({ page }) => {
    await page.goto('/de');
    await expect(page.getByTestId('nav-locale-switcher')).toBeVisible();
  });

  test('Sprache wechseln zu EN', async ({ page }) => {
    await page.goto('/de');
    await page.getByTestId('nav-locale-switcher').click();
    await expect(page).toHaveURL(/\/en/);
    await expect(page.locator('h1')).toContainText('Preset');
  });
});

test.describe('Editor Page', () => {
  test('zeigt Upload-Zone wenn kein Preset geladen', async ({ page }) => {
    await page.goto('/de/editor');
    await expect(page.getByTestId('file-upload-zone')).toBeVisible();
  });

  test('zeigt Editor-UI nach Preset-Upload', async ({ page }) => {
    await page.goto('/de/editor');

    // Create minimal test buffer matching real .prst format (1224 bytes)
    const testPreset = Buffer.alloc(1224, 0);
    testPreset.write('TSRP', 0x00, 'ascii');  // Magic Header (reversed)
    testPreset[0x15] = 0x01;                  // Version byte
    testPreset.write('TestPatch', 0x44, 'ascii'); // Patch Name at offset 0x44
    // Write effect block markers for 11 slots
    for (let i = 0; i < 11; i++) {
      const base = 0xa0 + i * 0x48;
      testPreset[base] = 0x14; testPreset[base + 2] = 0x44;
      testPreset[base + 4] = i; // slot index
    }

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
