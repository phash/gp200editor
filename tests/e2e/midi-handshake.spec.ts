/**
 * GP-200 Hardware MIDI — Handshake sequence test
 *
 * Requires: GP-200 connected via USB, app running on BASE_URL
 * Run: npx playwright test tests/e2e/midi-handshake.spec.ts --config=playwright-hw.config.ts
 */
import { test, expect, chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SCREENSHOTS = path.join(os.tmpdir(), 'gp200-handshake-test');

test('GP-200 handshake: connect, verify state, disconnect', async () => {
  test.setTimeout(90_000);
  fs.mkdirSync(SCREENSHOTS, { recursive: true });

  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({ permissions: ['midi', 'midi-sysex'] });
  const page = await context.newPage();

  const midiLogs: string[] = [];
  page.on('dialog', async d => { await d.accept(); });
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[GP-200]') || text.includes('MIDI')) {
      midiLogs.push(text);
      console.log(`  MIDI: ${text}`);
    }
  });

  const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';

  try {
    // 1. Navigate to editor
    await page.goto(`${baseURL}/de/editor`, { timeout: 30_000 });
    console.log('1. Editor page loaded');

    const statusBar = page.getByTestId('device-status-bar');
    await expect(statusBar).toBeVisible();

    // 2. Click Connect
    const connectBtn = page.getByRole('button', { name: 'Verbinden' });
    await expect(connectBtn).toBeVisible({ timeout: 5_000 });
    await connectBtn.click();
    console.log('2. Connect clicked');

    // 3. Wait for handshake to complete — either "GP-200" (connected with FW info)
    //    or error message. The "Initialisierung" state is transient and may flash by.
    //    Take a screenshot right after click to try to catch it.
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOTS, '01-after-connect.png') });

    // 4. Wait for final state: connected OR error (up to 45s for full handshake + assignments)
    const connectedLocator = statusBar.getByText('FW');
    const errorLocator = statusBar.locator('span').filter({ hasText: /timeout|error|failed|nicht gefunden/i });
    const noDeviceError = statusBar.locator('span').filter({ hasText: /not found|nicht gefunden/i });

    try {
      // First check: did we get an error immediately (no device)?
      const quickError = await noDeviceError.isVisible({ timeout: 3_000 }).catch(() => false);
      if (quickError) {
        const errorText = await statusBar.innerText();
        console.log(`3. NO DEVICE CONNECTED: "${errorText.replace(/\n/g, ' | ')}"`);
        console.log('   → Connect your GP-200 via USB and re-run the test');
        await page.screenshot({ path: path.join(SCREENSHOTS, '02-no-device.png') });
        test.skip(true, 'GP-200 not connected via USB');
        return;
      }

      // Wait for connected state with firmware info
      await expect(connectedLocator).toBeVisible({ timeout: 45_000 });
      console.log('3. Handshake completed — connected with firmware info');
    } catch {
      // Timeout or other error — capture state
      const statusText = await statusBar.innerText().catch(() => '(could not read)');
      console.log(`3. Status after timeout: "${statusText.replace(/\n/g, ' | ')}"`);
      await page.screenshot({ path: path.join(SCREENSHOTS, '02-timeout.png') });
      throw new Error(`Handshake did not complete. Status: ${statusText}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOTS, '02-connected.png') });

    // 5. Verify connected state details
    const statusText = await statusBar.innerText();
    console.log(`4. Status bar: "${statusText.replace(/\n/g, ' | ')}"`);
    expect(statusText).toContain('GP-200');
    expect(statusText).toContain('FW');
    expect(statusText).toContain('Slot');

    // 6. Check if preset was auto-loaded
    const patchNameInput = page.getByTestId('patch-name-input');
    if (await patchNameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const presetName = await patchNameInput.inputValue();
      console.log(`5. Auto-loaded preset: "${presetName}"`);
      expect(presetName.length).toBeGreaterThan(0);
    } else {
      console.log('5. No preset auto-loaded (upload zone still visible)');
    }

    // 7. Verify Pull/Push buttons
    await expect(page.getByRole('button', { name: '← Pull' })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('button', { name: 'Push →' })).toBeVisible({ timeout: 3_000 });
    console.log('6. Pull/Push buttons visible');

    // 8. Check MIDI logs
    console.log(`7. Total MIDI log messages: ${midiLogs.length}`);
    if (midiLogs.length > 0) {
      console.log(`   First: ${midiLogs[0].substring(0, 100)}`);
      console.log(`   Last:  ${midiLogs[midiLogs.length - 1].substring(0, 100)}`);
    }

    // 9. Disconnect
    await page.getByRole('button', { name: '×' }).click();
    await expect(page.getByRole('button', { name: 'Verbinden' })).toBeVisible({ timeout: 5_000 });
    console.log('8. Disconnected');
    await page.screenshot({ path: path.join(SCREENSHOTS, '03-disconnected.png') });

    console.log(`\nScreenshots: ${SCREENSHOTS}`);
    console.log('TEST PASSED');

  } catch (e) {
    console.error(`ERROR: ${e}`);
    await page.screenshot({ path: path.join(SCREENSHOTS, 'error.png'), fullPage: true }).catch(() => {});
    throw e;
  } finally {
    await context.close();
    await browser.close();
  }
});
