/**
 * Minimal MIDI diagnostic
 */
import { test, expect, chromium } from '@playwright/test';

test('MIDI minimal: connect + screenshot', async () => {
  test.setTimeout(30_000);

  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ permissions: ['midi', 'midi-sysex'] });
  const page = await context.newPage();

  // Handle any dialogs (alerts) automatically
  page.on('dialog', async dialog => {
    console.log(`  DIALOG: ${dialog.type()} "${dialog.message()}"`);
    await dialog.accept();
  });

  page.on('console', msg => {
    if (msg.text().includes('GP-200') || msg.text().includes('MIDI'))
      console.log(`  [MIDI] ${msg.text()}`);
  });

  const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';

  try {
    await page.goto(`${baseURL}/de/editor`);
    console.log('1. Page loaded');

    await page.getByRole('button', { name: 'Verbinden' }).click();
    await page.waitForTimeout(3000);
    console.log('2. Waited 3s after Connect click');

    const statusText = await page.getByTestId('device-status-bar').innerText();
    console.log(`3. Status bar: "${statusText.replace(/\n/g, ' | ')}"`);

    await page.screenshot({ path: 'test-results/midi-min-01.png', fullPage: true });
    console.log('4. Screenshot taken');

    // Try clicking Pull
    const pullBtn = page.getByRole('button', { name: '← Pull' });
    if (await pullBtn.count() > 0) {
      await pullBtn.click();
      console.log('5. Clicked Pull');
      await page.waitForTimeout(2000);
      console.log('6. Waited 2s');
      await page.screenshot({ path: 'test-results/midi-min-02.png', fullPage: true });
      console.log('7. Screenshot taken');

      // Check page content
      const body = await page.locator('body').innerText();
      console.log(`8. Has "Preset auswählen": ${body.includes('Preset')}`);
      console.log(`9. Has "63C": ${body.includes('63C')}`);
    } else {
      console.log('5. No Pull button found');
    }
  } catch (e) {
    console.log(`ERROR: ${e}`);
    await page.screenshot({ path: 'test-results/midi-min-error.png', fullPage: true }).catch(() => {});
  } finally {
    await context.close();
    await browser.close();
  }
});
