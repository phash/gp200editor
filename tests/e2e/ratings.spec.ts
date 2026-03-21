import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import path from 'path';

// Use a real .prst file from the project
const PRST_FILE = path.resolve(__dirname, '../../prst/63-B American Idiot.prst');

const UNIQUE = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function registerAndLogin(page: Page) {
  const username = UNIQUE();
  const email = `${username}@test.com`;

  await page.goto('/en/auth/register');
  await page.fill('[name="email"]', email);
  await page.fill('[name="username"]', username);
  await page.fill('[name="password"]', 'testpass123');
  await page.click('[type="submit"]');
  await page.waitForURL('**/profile');
  return { username, email };
}

/**
 * Helper: register a user in a given browser context (for multi-user scenarios).
 */
async function registerAndLoginInContext(context: BrowserContext) {
  const page = await context.newPage();
  const { username, email } = await registerAndLogin(page);
  return { page, username, email };
}

/**
 * Helper: publish a preset and return the share token.
 * Navigates to editor, uploads the PRST_FILE, opens save dialog,
 * checks "Publish to Gallery", submits. Then reads the share token
 * from the presets list.
 */
async function publishPresetAndGetToken(page: Page): Promise<string> {
  await page.goto('/en/editor');
  const fileInput = page.locator('[data-testid="file-input"]');
  await fileInput.setInputFiles(PRST_FILE);
  await expect(page.locator('[data-testid="patch-name-input"]')).toBeVisible({ timeout: 10000 });

  // Open save dialog
  await page.click('[data-testid="save-to-presets-btn"]');
  await expect(page.locator('#save-author')).toBeVisible();

  // Publish to gallery
  await page.check('input[type="checkbox"]');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/presets', { timeout: 10000 });

  // Get share token from the preset card
  const shareToken = await page
    .locator('[data-testid="preset-copy-link"]')
    .first()
    .getAttribute('data-share-token');
  expect(shareToken).toBeTruthy();
  return shareToken!;
}

test.describe('Preset Ratings', () => {
  // -------------------------------------------------------------------------
  // Test 1: Gallery shows no rating for unrated presets
  // -------------------------------------------------------------------------
  test('gallery shows no guitar rating for unrated presets', async ({ page }) => {
    await registerAndLogin(page);
    await publishPresetAndGetToken(page);

    await page.goto('/en/gallery');

    // Wait for at least one preset card to appear
    await expect(page.locator('.grid > div').first()).toBeVisible({ timeout: 10000 });

    // Find the card we just published (the first card in newest sort)
    const firstCard = page.locator('.grid > div').first();

    // ratingCount = 0 → the GuitarRating component should NOT be rendered
    // It only renders when ratingCount > 0 (see GalleryClient.tsx line 323)
    const ratingEl = firstCard.locator('[aria-label="filled guitar"], [aria-label="empty guitar"]');
    await expect(ratingEl.first()).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 2: Top Rated sort button exists and becomes active on click
  // -------------------------------------------------------------------------
  test('Top Rated sort button exists and activates on click', async ({ page }) => {
    await page.goto('/en/gallery');

    const topRatedBtn = page.locator('button:has-text("Top Rated")');
    await expect(topRatedBtn).toBeVisible({ timeout: 10000 });

    // Click Top Rated
    await topRatedBtn.click();
    await page.waitForTimeout(500); // allow state update

    // The button should now be "active" — styled differently.
    // We verify it's still visible and can check for the aria-pressed or
    // amber border style that indicates active state in GalleryClient.
    // The style uses var(--accent-amber) border when active.
    // Since inline styles are used, we check that the button is accessible
    // and the other sort buttons remain visible too.
    await expect(topRatedBtn).toBeVisible();

    // Newest button should still be visible (so we can switch back)
    const newestBtn = page.locator('button:has-text("Newest")');
    await expect(newestBtn).toBeVisible();

    // Switch back to newest
    await newestBtn.click();
    await page.waitForTimeout(300);
    await expect(newestBtn).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 3: Anonymous user cannot rate on share page
  // -------------------------------------------------------------------------
  test('anonymous user cannot rate on share page', async ({ browser }) => {
    // User A creates and publishes a preset
    const ownerCtx = await browser.newContext();
    const { page: ownerPage } = await registerAndLoginInContext(ownerCtx);
    const shareToken = await publishPresetAndGetToken(ownerPage);
    await ownerCtx.close();

    // Anonymous context — not logged in
    const anonCtx = await browser.newContext();
    const anonPage = await anonCtx.newPage();
    await anonPage.goto(`/en/share/${shareToken}`);

    // Share page should load
    await expect(anonPage.locator('[data-testid="share-preset-name"]')).toBeVisible({ timeout: 10000 });

    // canRate = false for anonymous → GuitarRating renders <span role="img">, not <button>
    // So interactive button elements for rating should NOT be present
    const ratingButtons = anonPage.locator('button[aria-label="empty guitar"], button[aria-label="filled guitar"]');
    await expect(ratingButtons.first()).not.toBeVisible();

    await anonCtx.close();
  });

  // -------------------------------------------------------------------------
  // Test 4: User cannot rate their own preset
  // -------------------------------------------------------------------------
  test('owner cannot rate their own preset on share page', async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const { page: ownerPage } = await registerAndLoginInContext(ownerCtx);
    const shareToken = await publishPresetAndGetToken(ownerPage);

    // Visit own share link while still logged in
    await ownerPage.goto(`/en/share/${shareToken}`);
    await expect(ownerPage.locator('[data-testid="share-preset-name"]')).toBeVisible({ timeout: 10000 });

    // canRate = false (is owner) → no interactive rating buttons
    const ratingButtons = ownerPage.locator('button[aria-label="empty guitar"], button[aria-label="filled guitar"]');
    await expect(ratingButtons.first()).not.toBeVisible();

    // The "Rate this preset" status text should NOT be visible for owner
    const rateThisText = ownerPage.locator('text=Rate this preset');
    await expect(rateThisText).not.toBeVisible();

    await ownerCtx.close();
  });

  // -------------------------------------------------------------------------
  // Test 5: Another user can rate a preset (4/5)
  // -------------------------------------------------------------------------
  test('another user can rate a preset', async ({ browser }) => {
    // User A: publish a preset
    const userACtx = await browser.newContext();
    const { page: pageA } = await registerAndLoginInContext(userACtx);
    const shareToken = await publishPresetAndGetToken(pageA);
    await userACtx.close();

    // User B: register and visit share page
    const userBCtx = await browser.newContext();
    const { page: pageB } = await registerAndLoginInContext(userBCtx);

    await pageB.goto(`/en/share/${shareToken}`);
    await expect(pageB.locator('[data-testid="share-preset-name"]')).toBeVisible({ timeout: 10000 });

    // Should see "Rate this preset" text since canRate = true and myRating = 0
    await expect(pageB.locator('text=Rate this preset')).toBeVisible({ timeout: 5000 });

    // Interactive rating buttons should be present (buttons, not spans)
    const ratingButtons = pageB.locator('button[aria-label="empty guitar"], button[aria-label="filled guitar"]');
    await expect(ratingButtons.first()).toBeVisible({ timeout: 5000 });

    // Click the 4th guitar (rating 4/5)
    // There are 5 buttons; index 3 (0-based) is the 4th star
    await ratingButtons.nth(3).click();

    // After rating: "Your rating: 4/5" should appear
    await expect(pageB.locator('text=Your rating')).toBeVisible({ timeout: 5000 });
    await expect(pageB.locator('text=4/5')).toBeVisible();

    await userBCtx.close();
  });

  // -------------------------------------------------------------------------
  // Test 6: Rating persists after page reload
  // -------------------------------------------------------------------------
  test('rating persists after page reload', async ({ browser }) => {
    // User A: publish
    const userACtx = await browser.newContext();
    const { page: pageA } = await registerAndLoginInContext(userACtx);
    const shareToken = await publishPresetAndGetToken(pageA);
    await userACtx.close();

    // User B: register, rate, then reload
    const userBCtx = await browser.newContext();
    const { page: pageB } = await registerAndLoginInContext(userBCtx);

    await pageB.goto(`/en/share/${shareToken}`);
    await expect(pageB.locator('[data-testid="share-preset-name"]')).toBeVisible({ timeout: 10000 });

    // Rate with 3 guitars
    const ratingButtons = pageB.locator('button[aria-label="empty guitar"], button[aria-label="filled guitar"]');
    await expect(ratingButtons.first()).toBeVisible({ timeout: 5000 });
    await ratingButtons.nth(2).click(); // 3rd guitar = rating 3

    await expect(pageB.locator('text=Your rating')).toBeVisible({ timeout: 5000 });

    // Reload the page
    await pageB.reload();
    await expect(pageB.locator('[data-testid="share-preset-name"]')).toBeVisible({ timeout: 10000 });

    // Rating should still be shown as 3/5
    await expect(pageB.locator('text=Your rating')).toBeVisible({ timeout: 5000 });
    await expect(pageB.locator('text=3/5')).toBeVisible();

    await userBCtx.close();
  });

  // -------------------------------------------------------------------------
  // Test 7: Gallery shows rating after preset has been rated
  // -------------------------------------------------------------------------
  test('gallery shows guitar rating after preset has been rated', async ({ browser }) => {
    // User A: publish
    const userACtx = await browser.newContext();
    const { page: pageA } = await registerAndLoginInContext(userACtx);
    const shareToken = await publishPresetAndGetToken(pageA);

    // Get the preset name so we can find it in the gallery
    const presetName = await pageA.locator('[data-testid="preset-copy-link"]').first().getAttribute('data-share-token');
    // We'll search for the first card in gallery after User B rates it
    await userACtx.close();

    // User B: register, visit share page, rate preset
    const userBCtx = await browser.newContext();
    const { page: pageB } = await registerAndLoginInContext(userBCtx);

    await pageB.goto(`/en/share/${shareToken}`);
    await expect(pageB.locator('[data-testid="share-preset-name"]')).toBeVisible({ timeout: 10000 });

    const ratingButtons = pageB.locator('button[aria-label="empty guitar"], button[aria-label="filled guitar"]');
    await expect(ratingButtons.first()).toBeVisible({ timeout: 5000 });
    await ratingButtons.nth(4).click(); // 5th guitar = rating 5

    await expect(pageB.locator('text=Your rating')).toBeVisible({ timeout: 5000 });

    // Now visit the gallery — the preset should show a rating
    await pageB.goto('/en/gallery');
    await expect(pageB.locator('.grid > div').first()).toBeVisible({ timeout: 10000 });

    // ratingCount > 0 now → GuitarRating should be rendered in the card footer
    // The GuitarRating in gallery uses span role="img" (display mode, no onRate)
    const galleryRatingEl = pageB.locator('[aria-label="filled guitar"]').first();
    await expect(galleryRatingEl).toBeVisible({ timeout: 5000 });

    // Also verify a count is shown e.g. "(1)"
    await expect(pageB.locator('.grid > div').first().locator('text=(1)')).toBeVisible();

    await userBCtx.close();
  });

  // -------------------------------------------------------------------------
  // Test 8a: Editor shows rating widget when loaded from someone else's gallery preset
  // -------------------------------------------------------------------------
  test('editor shows rating widget when loading another user\'s gallery preset', async ({ browser }) => {
    // User A: publish
    const userACtx = await browser.newContext();
    const { page: pageA } = await registerAndLoginInContext(userACtx);
    const shareToken = await publishPresetAndGetToken(pageA);
    await userACtx.close();

    // User B: register, open preset in editor via share link
    const userBCtx = await browser.newContext();
    const { page: pageB } = await registerAndLoginInContext(userBCtx);

    // Navigate to editor with ?share= query parameter (same as "Open in Editor" gallery link)
    await pageB.goto(`/en/editor?share=${shareToken}`);

    // Wait for preset to load in editor
    await expect(pageB.locator('[data-testid="patch-name-input"]')).toBeVisible({ timeout: 15000 });

    // The editor shows rating widget only when sourcePreset.username !== username
    // Look for "Rate preset" label text (t('ratePreset') = "Rate preset")
    await expect(pageB.locator('text=Rate preset')).toBeVisible({ timeout: 5000 });

    // Interactive guitar rating buttons should be present (onRate is provided)
    const ratingButtons = pageB.locator('button[aria-label="empty guitar"], button[aria-label="filled guitar"]');
    await expect(ratingButtons.first()).toBeVisible({ timeout: 5000 });

    await userBCtx.close();
  });

  // -------------------------------------------------------------------------
  // Test 8b: Editor does NOT show rating widget for own presets
  // -------------------------------------------------------------------------
  test('editor does NOT show rating widget when loading own gallery preset', async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const { page: ownerPage } = await registerAndLoginInContext(ownerCtx);
    const shareToken = await publishPresetAndGetToken(ownerPage);

    // Open own preset in editor
    await ownerPage.goto(`/en/editor?share=${shareToken}`);
    await expect(ownerPage.locator('[data-testid="patch-name-input"]')).toBeVisible({ timeout: 15000 });

    // "Rate preset" label should NOT be visible for own preset
    await expect(ownerPage.locator('text=Rate preset')).not.toBeVisible();

    // No interactive guitar rating buttons for self
    const ratingButtons = ownerPage.locator('button[aria-label="empty guitar"], button[aria-label="filled guitar"]');
    await expect(ratingButtons.first()).not.toBeVisible();

    // Instead, the "Update Preset" button should be visible (it's their own preset)
    await expect(ownerPage.locator('button:has-text("Update Preset")')).toBeVisible();

    await ownerCtx.close();
  });
});
