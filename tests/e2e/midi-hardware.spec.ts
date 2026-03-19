/**
 * GP-200 Hardware MIDI — Push preset via UI
 */
import { test, expect, chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const PRST_FILE = 'prst/63-B American Idiot.prst';
const TARGET_LABEL = '63C';
const SCREENSHOTS = path.join(os.tmpdir(), 'gp200-hw-test');

test('Push preset to GP-200 via UI', async () => {
  test.setTimeout(90_000);
  fs.mkdirSync(SCREENSHOTS, { recursive: true });

  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ permissions: ['midi', 'midi-sysex'] });
  const page = await context.newPage();

  page.on('dialog', async d => { console.log(`DIALOG: ${d.message()}`); await d.accept(); });
  page.on('console', msg => {
    if (msg.text().includes('[GP-200]')) console.log(`  MIDI: ${msg.text()}`);
  });

  try {
    const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
    await page.goto(`${baseURL}/de/editor`);
    console.log('1. Page loaded');

    // Upload .prst
    const prstBuffer = fs.readFileSync(path.resolve(PRST_FILE));
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'American Idiot.prst',
      mimeType: 'application/octet-stream',
      buffer: prstBuffer,
    });
    await expect(page.getByTestId('patch-name-input')).toHaveValue('American Idiot', { timeout: 5_000 });
    console.log('2. Preset loaded');

    // Connect
    await page.getByRole('button', { name: 'Verbinden' }).click();
    await expect(
      page.getByTestId('device-status-bar').getByText('GP-200')
    ).toBeVisible({ timeout: 10_000 });
    console.log('3. Connected');

    // Click Push
    const pushBtn = page.getByRole('button', { name: 'Push →' });
    await expect(pushBtn).toBeEnabled({ timeout: 3_000 });
    await pushBtn.click();
    console.log('4. Clicked Push');

    // Immediate screenshot (outside project dir to avoid HMR)
    await page.screenshot({ path: path.join(SCREENSHOTS, '01-after-push-click.png') });
    console.log(`5. Screenshot: ${SCREENSHOTS}/01-after-push-click.png`);

    // Check what's on the page
    const bodyText = await page.locator('body').innerText({ timeout: 3_000 });
    const hasBrowser = bodyText.includes('Preset');
    console.log(`6. Page has "Preset": ${hasBrowser}`);
    console.log(`   First 200 chars: ${bodyText.substring(0, 200).replace(/\n/g, ' | ')}`);

    // Try to find slot browser overlay
    const overlay = page.locator('.fixed.inset-0');
    const overlayCount = await overlay.count();
    console.log(`7. .fixed.inset-0 count: ${overlayCount}`);

    if (overlayCount > 0) {
      console.log('   Slot browser found! Proceeding...');

      // Search for slot
      const input = overlay.locator('input').first();
      await input.fill(TARGET_LABEL);
      await page.waitForTimeout(500);

      // Select slot
      const slot = overlay.locator('button').filter({ hasText: TARGET_LABEL }).first();
      if (await slot.count() > 0) {
        await slot.click();
        console.log(`8. Selected ${TARGET_LABEL}`);

        // Confirm
        const confirm = overlay.locator('button').filter({ hasText: /Push nach/ });
        if (await confirm.count() > 0) {
          await confirm.click();
          console.log('9. Confirmed push');
          await page.waitForTimeout(5_000); // wait for chunks to send
          console.log('10. Done!');
          await page.screenshot({ path: path.join(SCREENSHOTS, '02-push-done.png') });
        } else {
          console.log('8. No confirm button found');
        }
      } else {
        console.log(`8. No slot button "${TARGET_LABEL}" found`);
      }
    } else {
      console.log('   NO slot browser overlay found!');
      // Debug: dump all fixed/overlay elements
      const fixedEls = await page.locator('[class*="fixed"]').count();
      console.log(`   Elements with "fixed" class: ${fixedEls}`);
    }

  } finally {
    await context.close();
    await browser.close();
  }
});
