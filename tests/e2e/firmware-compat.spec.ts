import { test, expect, type Page } from '@playwright/test';

/**
 * Mock Web MIDI API to simulate a GP-200 with a specific firmware version.
 * The mock handles the handshake sequence and conditionally returns
 * version check response based on whether firmware is "tested" (1.8).
 */
async function setupAndConnect(page: Page, major: number, minor: number) {
  await page.context().grantPermissions(['midi', 'midi-sysex']);
  await page.goto('/de/editor');

  // Inject mock AFTER page loads but BEFORE clicking connect.
  await page.evaluate(([fwMajor, fwMinor]) => {
    const HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32];
    // "Tested" = firmware 1.8 only
    const isTested = fwMajor === 1 && fwMinor === 8;

    const identityResponse = new Uint8Array([
      ...HEADER, 0x12, 0x08,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x00, 0x00,
      fwMajor, 0x00, 0x00, 0x00,
      fwMinor, 0x00, 0x00, 0x00,
      0xF7,
    ]);

    function makeChunk(sub: number, len: number) {
      const chunk = new Uint8Array(len);
      chunk.set(new Uint8Array(HEADER));
      chunk[8] = 0x12;
      chunk[9] = sub;
      chunk[chunk.length - 1] = 0xF7;
      return chunk;
    }

    // Version response: all zeros = accepted, non-zero at [21] = rejected
    const versionResponse = makeChunk(0x0A, 34);
    if (!isTested) {
      versionResponse[21] = 0x01; // untested → rejected
    }

    let messageHandler: ((event: { data: Uint8Array }) => void) | null = null;
    let sendCount = 0;

    const mockInput = {
      name: 'Valeton GP-200 MIDI 1',
      get onmidimessage() { return messageHandler; },
      set onmidimessage(fn: ((event: { data: Uint8Array }) => void) | null) { messageHandler = fn; },
    };

    function respond(data: Uint8Array) {
      setTimeout(() => {
        const h = mockInput.onmidimessage;
        if (h) h({ data });
      }, 10);
    }

    const mockOutput = {
      name: 'Valeton GP-200 MIDI 1',
      send(data: Uint8Array | number[]) {
        const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
        sendCount++;
        if (arr.length > 10 && arr[8] === 0x11) {
          const sub = arr[9];
          if (sub === 0x04) {
            if (sendCount <= 2) {
              respond(identityResponse);
            } else {
              // State dump — 5 chunks
              for (let c = 0; c < 5; c++) {
                const chunk = makeChunk(0x4E, 100);
                setTimeout(() => { const h = mockInput.onmidimessage; if (h) h({ data: chunk }); }, 20 * (c + 1));
              }
            }
          } else if (sub === 0x0A) {
            respond(versionResponse);
          } else if (sub === 0x1C) {
            respond(makeChunk(0x1C, 80));
          } else if (sub === 0x10) {
            for (let c = 0; c < 7; c++) {
              const chunk = makeChunk(0x18, 62);
              setTimeout(() => { const h = mockInput.onmidimessage; if (h) h({ data: chunk }); }, 15 * (c + 1));
            }
          }
        }
      },
    };

    (navigator as any).requestMIDIAccess = async () => ({
      inputs: { values: () => [mockInput][Symbol.iterator]() },
      outputs: { values: () => [mockOutput][Symbol.iterator]() },
    });
  }, [major, minor] as const);

  // Click connect
  await page.locator('button:has-text("GP-200 verbinden")').click();

  // Wait for handshake to complete
  await page.waitForTimeout(5000);
}

test.describe('Firmware Compatibility Check', () => {
  test('untested firmware (1.7) shows blocking dialog', async ({ page }) => {
    await setupAndConnect(page, 1, 7);

    // Dialog should appear
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Continue button should be disabled before checkbox
    const continueBtn = dialog.locator('button:has-text("Weiter")');
    await expect(continueBtn).toBeVisible();
    await expect(continueBtn).toHaveAttribute('disabled', '');
  });

  test('acknowledge checkbox enables continue button', async ({ page }) => {
    await setupAndConnect(page, 1, 7);
    await expect(page.locator('[role="alertdialog"]')).toBeVisible({ timeout: 10000 });

    // Check the acknowledgment checkbox
    await page.locator('input[type="checkbox"]').check();

    // Click continue
    await page.locator('button:has-text("Weiter")').click();

    // Dialog should close
    await expect(page.locator('[role="alertdialog"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('disconnect button closes dialog and disconnects', async ({ page }) => {
    await setupAndConnect(page, 1, 7);
    await expect(page.locator('[role="alertdialog"]')).toBeVisible({ timeout: 10000 });

    // Click disconnect
    await page.locator('button:has-text("Verbindung trennen")').click();

    // Dialog should close
    await expect(page.locator('[role="alertdialog"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('tested firmware (1.8) does NOT show dialog', async ({ page }) => {
    await setupAndConnect(page, 1, 8);

    // Should NOT show compatibility dialog
    await expect(page.locator('[role="alertdialog"]')).not.toBeVisible({ timeout: 5000 });

    // Should show connected state (GP-200 in status bar)
    await expect(page.locator('text=GP-200')).toBeVisible();
  });

  test('old firmware (0.9) also triggers dialog', async ({ page }) => {
    await setupAndConnect(page, 0, 9);

    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });
  });
});
