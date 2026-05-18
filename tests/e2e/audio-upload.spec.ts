import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const PRST = path.resolve(__dirname, '../../prst/63-B American Idiot.prst');
const AUDIO = path.resolve(__dirname, '../fixtures/audio/short-5s.mp3');
const UNIQUE = () => `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function registerAndLogin(page: Page) {
  const username = UNIQUE();
  const email = `${username}@test.com`;
  await page.goto('/en/auth/register');
  await page.fill('[name="email"]', email);
  await page.fill('[name="username"]', username);
  await page.fill('[name="password"]', 'testpass123');
  await page.click('[type="submit"]');
  let verifyUrl: string | undefined;
  for (let i = 0; i < 15 && !verifyUrl; i++) {
    await page.waitForTimeout(500);
    const r = await page.context().request.get(`http://localhost:8025/api/v2/search?kind=to&query=${encodeURIComponent(email)}`);
    const data = (await r.json()) as { items?: Array<{ Content: { Body: string } }> };
    const body = data.items?.[0]?.Content.Body ?? '';
    const decoded = body.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    verifyUrl = decoded.match(/http[^\s"<>]+verify-email[^\s"<>]+/)?.[0];
  }
  if (!verifyUrl) throw new Error('no verify mail');
  await page.goto(verifyUrl);
  await page.getByRole('button', { name: /verify my email/i }).click();
  await page.waitForURL('**/editor', { timeout: 10000 });
}

test('audio upload via save dialog appears on share page', async ({ page }) => {
  await registerAndLogin(page);
  await page.goto('/en/editor');
  await page.locator('input[type="file"]').first().setInputFiles(PRST);
  await page.getByRole('button', { name: /save to gallery/i }).click();
  await page.fill('[name="name"]', `e2e-audio-${UNIQUE()}`);
  // The save dialog now has two file inputs (preset + audio). Pick the one
  // accepting audio MIME types.
  const audioInput = page.locator('input[type="file"][accept*="audio"]');
  await audioInput.setInputFiles(AUDIO);
  // Make public if there is a checkbox.
  const publicCheckbox = page.locator('[name="public"]');
  if (await publicCheckbox.count() > 0) await publicCheckbox.check();
  await page.getByRole('button', { name: /^save$/i }).click();
  await page.waitForURL('**/share/**', { timeout: 15000 }).catch(() => {});

  // Navigate to gallery and open the just-saved preset's share page.
  await page.goto('/en/gallery', { waitUntil: 'domcontentloaded' });
  await page.locator('a[href*="/share/"]').first().click();

  // Confirm the audio player rendered.
  await expect(page.getByRole('button', { name: /^play$/i })).toBeVisible({ timeout: 5000 });
});
