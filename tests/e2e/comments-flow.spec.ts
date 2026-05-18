import { test, expect } from '@playwright/test';
import path from 'path';

const PRST_FILE = path.resolve(__dirname, '../../prst/63-B American Idiot.prst');
const UNIQUE = () => `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function registerAndLogin(page: import('@playwright/test').Page) {
  const username = UNIQUE();
  const email = `${username}@test.com`;

  await page.goto('/en/auth/register');
  await page.fill('[name="email"]', email);
  await page.fill('[name="username"]', username);
  await page.fill('[name="password"]', 'testpass123');
  await page.click('[type="submit"]');

  let verifyUrl: string | undefined;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(500);
    const resp = await page.context().request.get(
      `http://localhost:8025/api/v2/search?kind=to&query=${encodeURIComponent(email)}`,
    );
    const data = await resp.json() as { items?: Array<{ Content: { Body: string } }> };
    const mail = data.items?.[0];
    if (mail) {
      const raw = mail.Content?.Body ?? '';
      const body = raw
        .replace(/=\r?\n/g, '')
        .replace(/=([0-9A-Fa-f]{2})/g, (_: unknown, h: string) =>
          String.fromCharCode(parseInt(h, 16)),
        );
      const match = body.match(/http[^\s"<>]+verify-email[^\s"<>]+/);
      verifyUrl = match?.[0];
      if (verifyUrl) break;
    }
  }
  if (!verifyUrl) throw new Error(`No verification email for ${email}`);

  await page.goto(verifyUrl);
  await page.getByRole('button', { name: /Verify my email/i }).click();
  await page.waitForURL('**/editor', { timeout: 10000 });
  return { username, email };
}

/**
 * Publish a preset and return its shareToken by reading from the presets list page.
 * Follows the same pattern as ratings.spec.ts publishPresetAndGetToken().
 */
async function publishPresetAndGetToken(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/en/editor');
  const fileInput = page.locator('[data-testid="file-input"]');
  await fileInput.setInputFiles(PRST_FILE);
  await expect(page.locator('[data-testid="patch-name-input"]')).toBeVisible({ timeout: 10000 });

  await page.click('[data-testid="save-to-presets-btn"]');
  await expect(page.locator('#save-author')).toBeVisible();

  await page.check('input[type="checkbox"]');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/presets', { timeout: 10000 });

  const shareToken = await page
    .locator('[data-testid="preset-copy-link"]')
    .first()
    .getAttribute('data-share-token');
  expect(shareToken).toBeTruthy();
  return shareToken!;
}

test.describe('Comments flow on share page', () => {
  /**
   * Full CRUD flow:
   *   User A creates a public preset.
   *   User B (separate browser context) posts a comment, replies, edits, then soft-deletes.
   * After soft-delete the placeholder "Removed by author" is visible
   * but the reply thread is still rendered beneath the deleted parent.
   */
  test('post → reply → edit → soft-delete, reply survives', async ({ browser }) => {
    // -- User A: create a public preset -----------------------------------------
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await registerAndLogin(pageA);
    const shareToken = await publishPresetAndGetToken(pageA);
    await ctxA.close();

    // -- User B: register in an isolated context ---------------------------------
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await registerAndLogin(pageB);

    await pageB.goto(`/en/share/${shareToken}`, { waitUntil: 'domcontentloaded' });

    // -- Post a top-level comment ------------------------------------------------
    // CommentForm renders a <textarea placeholder="Share your thoughts…">
    const textarea = pageB.getByPlaceholder(/Share your thoughts/i);
    await expect(textarea).toBeVisible({ timeout: 8000 });
    await textarea.fill('first e2e comment');
    // CommentForm submit button text is t('post') = "Post" (not isEdit)
    await pageB.getByRole('button', { name: /^post$/i }).click();
    await expect(pageB.getByText('first e2e comment')).toBeVisible({ timeout: 5000 });

    // -- Reply to the top-level comment -----------------------------------------
    // CommentItem renders a "Reply" button only for top-level (parentId is null)
    await pageB.getByRole('button', { name: /^reply$/i }).first().click();
    // After clicking Reply, CommentList shows a CommentForm in the nested div
    const replyTextarea = pageB.getByPlaceholder(/Share your thoughts/i).nth(1);
    await expect(replyTextarea).toBeVisible({ timeout: 3000 });
    await replyTextarea.fill('e2e reply');
    // The reply form's submit is the second "Post" button on the page
    await pageB.getByRole('button', { name: /^post$/i }).nth(1).click();
    await expect(pageB.getByText('e2e reply')).toBeVisible({ timeout: 5000 });

    // -- Edit the top-level comment ---------------------------------------------
    // CommentItem renders an "Edit" button for own comments (t('edit') = "Edit")
    await pageB.getByRole('button', { name: /^edit$/i }).first().click();
    // Editing mode replaces body <p> with a CommentForm (isEdit=true)
    // The textarea is now the first visible text box in the page
    const editTextarea = pageB.getByPlaceholder(/Share your thoughts/i).first();
    await editTextarea.clear();
    await editTextarea.fill('edited e2e comment');
    // In edit mode, the button label is t('save') = "Save"
    await pageB.getByRole('button', { name: /^save$/i }).click();
    await expect(pageB.getByText('edited e2e comment')).toBeVisible({ timeout: 5000 });
    // "(edited)" span should appear (t('edited') = "edited")
    await expect(pageB.locator('span.italic', { hasText: /edited/i }).first()).toBeVisible();

    // -- Soft-delete the top-level comment --------------------------------------
    // CommentItem "Delete" button triggers onDelete(id), no browser confirm
    await pageB.getByRole('button', { name: /^delete$/i }).first().click();
    // After deletion, API returns deletedBy="AUTHOR", so placeholder shows t('deletedByAuthor')
    await expect(pageB.getByText(/Removed by author/i)).toBeVisible({ timeout: 5000 });
    // Reply under the deleted parent must still be rendered
    await expect(pageB.getByText('e2e reply')).toBeVisible();

    await ctxB.close();
  });
});
