import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

// QP decode helper (Mailhog returns Quoted-Printable encoded bodies)
function decodeQP(text: string): string {
  return text
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

async function registerAndVerifyUser(
  request: APIRequestContext,
  email: string,
  username: string,
  password: string,
): Promise<boolean> {
  const regRes = await request.post('/api/auth/register', {
    data: { email, username, password },
  });
  if (!regRes.ok()) return false;

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
        const verifyRes = await request.get(`/api/auth/verify-email?token=${tokenMatch[1]}`);
        return verifyRes.ok();
      }
    }
  }
  return false;
}

test.describe.serial('Gallery Preset Save/Update', () => {
  let ownerShareToken: string;
  const ownerEmail = `gallerysave_owner_${Date.now()}@test.com`;
  const ownerUser = `gallerysave_owner_${Date.now() % 100000}`;
  const otherEmail = `gallerysave_other_${Date.now()}@test.com`;
  const otherUser = `gallerysave_other_${Date.now() % 100000}`;
  const password = 'TestPass123!';

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Register owner
    const ownerOk = await registerAndVerifyUser(page.request, ownerEmail, ownerUser, password);

    // Register other user (separate context to avoid session conflicts)
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await registerAndVerifyUser(page2.request, otherEmail, otherUser, password);
    await ctx2.close();

    if (ownerOk) {
      // Login as owner (verification created session in the request context)
      const loginRes = await page.request.post('/api/auth/login', {
        data: { email: ownerEmail, password },
      });

      if (loginRes.ok()) {
        // Upload a preset
        const fs = require('fs');
        const buffer = fs.readFileSync('prst/63-B American Idiot.prst');
        const uploadRes = await page.request.post('/api/presets', {
          multipart: {
            preset: { name: 'test.prst', mimeType: 'application/octet-stream', buffer },
            author: ownerUser,
            style: 'Rock',
            publish: 'true',
          },
        });
        if (uploadRes.ok()) {
          const data = await uploadRes.json();
          ownerShareToken = data.shareToken;
        }
      }
    }

    await ctx.close();
  });

  test('not logged in — sees login prompt, no save buttons', async ({ page }) => {
    if (!ownerShareToken) {
      const galRes = await page.request.get('/api/gallery');
      const galData = await galRes.json();
      if (galData.presets?.length > 0) {
        ownerShareToken = galData.presets[0].shareToken;
      }
    }
    test.skip(!ownerShareToken, 'No share token available — auth seeding failed');

    await page.goto(`/de/editor?share=${ownerShareToken}`);
    await expect(page.getByTestId('patch-name-input')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('text=Anmelden, um zu speichern')).toBeVisible();
    await expect(page.locator('button:has-text("Preset aktualisieren")')).not.toBeVisible({ timeout: 2000 });
    await expect(page.locator('button:has-text("Als neues Preset")')).not.toBeVisible();
  });

  test('owner sees Update button for own preset', async ({ page }) => {
    test.skip(!ownerShareToken, 'No share token available');

    await page.goto('/de/auth/login');
    await page.fill('input[name="login"]', ownerEmail);
    await page.fill('input[name="password"]', password);
    await page.click('[type="submit"]');
    await page.waitForTimeout(2000);

    await page.goto(`/de/editor?share=${ownerShareToken}`);
    await expect(page.getByTestId('patch-name-input')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Preset aktualisieren")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Als neues Preset")')).toBeVisible();
  });

  test('other user sees Save-as-New but NOT Update', async ({ page }) => {
    test.skip(!ownerShareToken, 'No share token available');

    await page.goto('/de/auth/login');
    await page.fill('input[name="login"]', otherEmail);
    await page.fill('input[name="password"]', password);
    await page.click('[type="submit"]');
    await page.waitForTimeout(2000);

    await page.goto(`/de/editor?share=${ownerShareToken}`);
    await expect(page.getByTestId('patch-name-input')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Preset aktualisieren")')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Als neues Preset")')).toBeVisible();
  });

  test('loading from file clears gallery source', async ({ page }) => {
    test.skip(!ownerShareToken, 'No share token available');

    await page.goto('/de/auth/login');
    await page.fill('input[name="login"]', ownerEmail);
    await page.fill('input[name="password"]', password);
    await page.click('[type="submit"]');
    await page.waitForTimeout(2000);

    await page.goto(`/de/editor?share=${ownerShareToken}`);
    await expect(page.getByTestId('patch-name-input')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Preset aktualisieren")')).toBeVisible({ timeout: 10000 });

    await page.locator('input[type="file"][accept=".prst,.hlx"]').last().setInputFiles('prst/63-C claude1.prst');
    await page.waitForTimeout(1000);

    await expect(page.locator('button:has-text("Preset aktualisieren")')).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator('button:has-text("In Presets speichern")')).toBeVisible();
  });
});
