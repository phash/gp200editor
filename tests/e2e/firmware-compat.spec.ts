import { test, expect, type Page } from '@playwright/test';

/**
 * Mock the Web MIDI API to simulate a GP-200 with a specific firmware version.
 * The mock handles the full handshake sequence:
 *   1. Identity query → identity response (with firmware version)
 *   2. Enter editor mode → (no response needed, just a delay)
 *   3. State dump request → 5 state dump chunks
 *   4. Version check → version response
 *   5. Assignment queries → timeout (skipped)
 *   6. Read request → timeout (skipped, non-critical)
 */
function buildMidiMock(firmwareMajor: number, firmwareMinor: number) {
  return `
    (() => {
      const HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32];

      // Pre-built responses
      const identityResponse = new Uint8Array([
        ...HEADER, 0x12, 0x08,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x02, 0x00, 0x00, 0x00,
        ${firmwareMajor}, 0x00, 0x00, 0x00,
        ${firmwareMinor}, 0x00, 0x00, 0x00,
        0xF7,
      ]);

      // State dump chunk (0x4E) — minimal valid chunk
      function makeStateDumpChunk() {
        const chunk = new Uint8Array(100);
        chunk.set(HEADER);
        chunk[8] = 0x12;
        chunk[9] = 0x4E;
        chunk[chunk.length - 1] = 0xF7;
        return chunk;
      }

      // Version response (0x0A) — all zeros at [21..32] = accepted
      const versionResponse = new Uint8Array([
        ...HEADER, 0x12, 0x0A,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0xF7,
      ]);

      let messageHandler = null;
      let sendCount = 0;

      function respond(data) {
        // Must read handler at call time, not capture time — waitForResponse replaces it
        setTimeout(() => {
          const h = mockInput.onmidimessage;
          if (h) h({ data });
        }, 10);
      }

      function respondMultiple(chunks, delay) {
        chunks.forEach((chunk, i) => {
          setTimeout(() => {
            const h = mockInput.onmidimessage;
            if (h) h({ data: chunk });
          }, delay * (i + 1));
        });
      }

      const mockInput = {
        name: 'Valeton GP-200 MIDI 1',
        get onmidimessage() { return messageHandler; },
        set onmidimessage(fn) { messageHandler = fn; },
      };

      const mockOutput = {
        name: 'Valeton GP-200 MIDI 1',
        send(data) {
          const arr = data instanceof Uint8Array ? data : new Uint8Array(data);
          sendCount++;
          console.log('[MIDI-MOCK] send #' + sendCount + ' cmd=0x' + arr[8]?.toString(16) + ' sub=0x' + arr[9]?.toString(16) + ' len=' + arr.length);

          // Match by CMD + SUB bytes
          if (arr.length > 10 && arr[8] === 0x11) {
            const sub = arr[9];

            if (sub === 0x04) {
              if (sendCount <= 2) {
                // First 0x04 = identity query
                console.log('[MIDI-MOCK] → identity response');
                respond(identityResponse);
              } else {
                // Later 0x04 = state dump request
                console.log('[MIDI-MOCK] → state dump (5 chunks)');
                const chunks = Array.from({ length: 5 }, () => makeStateDumpChunk());
                respondMultiple(chunks, 20);
              }
            } else if (sub === 0x12) {
              console.log('[MIDI-MOCK] → enter editor (no response)');
            } else if (sub === 0x0A) {
              console.log('[MIDI-MOCK] → version response');
              respond(versionResponse);
            }
            } else if (sub === 0x1C) {
              // Assignment query → respond with dummy 0x12/0x1C response
              const assignResp = new Uint8Array(80);
              assignResp.set(HEADER);
              assignResp[8] = 0x12;
              assignResp[9] = 0x1C;
              assignResp[assignResp.length - 1] = 0xF7;
              respond(assignResp);
            } else if (sub === 0x10) {
              // Read request → respond with 7 dummy 0x12/0x18 chunks
              for (let c = 0; c < 7; c++) {
                const readChunk = new Uint8Array(62);
                readChunk.set(HEADER);
                readChunk[8] = 0x12;
                readChunk[9] = 0x18;
                readChunk[readChunk.length - 1] = 0xF7;
                setTimeout(() => {
                  const h = mockInput.onmidimessage;
                  if (h) h({ data: readChunk });
                }, 15 * (c + 1));
              }
            }
            // Other messages — ignore
          }
        },
      };

      // Override with defineProperty to prevent browser from restoring the native impl
      Object.defineProperty(navigator, 'requestMIDIAccess', {
        value: async () => ({
          inputs: { values: () => [mockInput][Symbol.iterator]() },
          outputs: { values: () => [mockOutput][Symbol.iterator]() },
        }),
        writable: false,
        configurable: true,
      });
    })();
  `;
}

async function setupAndConnect(page: Page, major: number, minor: number) {
  await page.context().grantPermissions(['midi', 'midi-sysex']);
  await page.goto('/de/editor');

  // Inject mock AFTER page loads but BEFORE clicking connect.
  // Must use evaluate with function to properly override navigator.requestMIDIAccess
  await page.evaluate(([fwMajor, fwMinor]) => {
    const HEADER = [0xF0, 0x21, 0x25, 0x7E, 0x47, 0x50, 0x2D, 0x32];

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

    const versionResponse = makeChunk(0x0A, 34);

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

    // Dialog should appear with firmware info
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog.locator('text=1.7')).toBeVisible();

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
    await expect(dialog.locator('text=0.9')).toBeVisible();
  });
});
